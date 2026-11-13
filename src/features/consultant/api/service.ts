import 'server-only';

import { currentUser } from '@clerk/nextjs/server';
import { getSiprovClient, isSiprovEnabled, type SiprovRecord } from '@/lib/siprov/client';
import type {
  ConsultantDashboardData,
  ConsultantAccessScope,
  ConsultantSale,
  DelinquentAccount,
  MonthlyPerformance,
  SaleStatus
} from './types';

export class ConsultantConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConsultantConfigurationError';
  }
}

export async function getConsultantDashboardData(): Promise<ConsultantDashboardData> {
  if (!isSiprovEnabled()) return getDemoData();

  try {
    return await loadSiprovData();
  } catch (error) {
    if (process.env.SIPROV_FALLBACK_TO_DEMO?.trim().toLowerCase() === 'true') {
      return getDemoData();
    }
    throw error;
  }
}

async function loadSiprovData(): Promise<ConsultantDashboardData> {
  const client = getSiprovClient();
  const consultant = await resolveConsultant();
  const sellerFilter =
    consultant.accessScope === 'representative'
      ? ({ representativeId: consultant.sellerId } as const)
      : ({ consultantId: consultant.sellerId } as const);
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const historyStart = new Date(today.getFullYear(), today.getMonth() - 5, 1);
  const delinquencyStart =
    parseConfiguredDate(process.env.SIPROV_DELINQUENCY_START_DATE) ??
    new Date(today.getFullYear() - 2, today.getMonth(), 1);
  const shouldValidateVendor = process.env.SIPROV_SKIP_VENDOR_VALIDATION !== 'true';

  const [vendors, associates, dueTitles] = await Promise.all([
    shouldValidateVendor ? client.listVendors() : Promise.resolve([]),
    client.listAssociates({
      ...sellerFilter,
      startDate: formatSiprovDate(historyStart),
      endDate: formatSiprovDate(today)
    }),
    client.listTitles({
      ...sellerFilter,
      dateField: 'due',
      startDate: formatSiprovDate(delinquencyStart),
      endDate: formatSiprovDate(today)
    })
  ]);

  const vendor = vendors.find((item) => integer(item.id) === consultant.vendorId);
  if (!vendor && shouldValidateVendor) {
    throw new ConsultantConfigurationError('O consultor configurado não está ativo na Siprov.');
  }

  const currentAssociates = associates.filter((item) => {
    const date = associateDate(item);
    return date !== null && date >= monthStart && date <= today;
  });
  const commissionRate = optionalPercentage(process.env.SIPROV_COMMISSION_RATE_PERCENT);
  const sales = currentAssociates.map((item) => mapSale(item, commissionRate));
  const delinquency = buildDelinquency(dueTitles, today);
  const maturedTitles = dueTitles.filter((item) => isMaturedTitle(item, today));
  const maturedAmount = roundCurrency(
    maturedTitles.reduce((sum, item) => sum + titleAmount(item), 0)
  );
  const target = positiveInteger(process.env.SIPROV_MONTHLY_TARGET, 25);
  const consultantName = text(vendor?.nome) || consultant.name;

  return {
    consultantName,
    accessScope: consultant.accessScope,
    periodLabel: new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(today),
    isDemo: false,
    updatedAt: new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'America/Sao_Paulo'
    }).format(today),
    salesCount: sales.length,
    activeSales: sales.filter((sale) => sale.status === 'Ativa').length,
    salesValue: roundCurrency(sales.reduce((sum, sale) => sum + sale.value, 0)),
    commissionForecast:
      commissionRate === null
        ? null
        : roundCurrency(sales.reduce((sum, sale) => sum + (sale.commission ?? 0), 0)),
    target,
    delinquency: {
      associates: delinquency.accounts.length,
      overdueTitles: delinquency.overdueTitles,
      overdueAmount: delinquency.overdueAmount,
      overdueRate:
        maturedTitles.length > 0
          ? roundPercentage((delinquency.overdueTitles / maturedTitles.length) * 100)
          : 0,
      overdueValueRate:
        maturedAmount > 0 ? roundPercentage((delinquency.overdueAmount / maturedAmount) * 100) : 0,
      dueTitles: maturedTitles.length,
      dueAmount: maturedAmount
    },
    delinquentAccounts: delinquency.accounts,
    performance: buildPerformance(associates, target, today),
    recentSales: sales.toSorted((a, b) => parseBrazilianDate(b.date) - parseBrazilianDate(a.date))
  };
}

async function resolveConsultant(): Promise<{
  vendorId: number;
  sellerId: number;
  name: string;
  accessScope: ConsultantAccessScope;
}> {
  const user = await currentUser();
  if (!user) throw new ConsultantConfigurationError('Usuário não autenticado.');

  const metadata = user.privateMetadata as Record<string, unknown>;
  const accessScope: ConsultantAccessScope =
    normalize(text(metadata.siprovAccessScope)) === 'representative'
      ? 'representative'
      : 'consultant';
  const vendorId = integer(metadata.siprovConsultantId);
  const sellerId =
    accessScope === 'representative' ? integer(metadata.siprovRepresentativeId) : vendorId;
  if (!vendorId || vendorId <= 0 || !sellerId || sellerId <= 0) {
    throw new ConsultantConfigurationError(
      accessScope === 'representative'
        ? 'Seu usuário ainda não possui siprovConsultantId e siprovRepresentativeId configurados.'
        : 'Seu usuário ainda não foi vinculado a um consultor da Siprov. Contate o administrador.'
    );
  }

  return {
    vendorId,
    sellerId,
    name: user.firstName || user.fullName || 'Consultor',
    accessScope
  };
}

function mapSale(item: SiprovRecord, commissionRate: number | null): ConsultantSale {
  const status = mapStatus(text(item.situacao) || text(item.tipoSituacao));
  const value = associateValue(item);
  const date = associateDate(item);
  const vehicle = record(item.veiculo);
  const vehicleLabel = [text(vehicle?.marca), text(vehicle?.modelo)].filter(Boolean).join(' ');

  return {
    id: String(integer(item.sequencial) || integer(item.codBeneficio) || '—'),
    associate: text(item.nomePessoa) || 'Associado não identificado',
    plan: text(item.nomePlanoPrincipal) || firstPlanName(item.planos) || 'Plano não informado',
    vehicle: vehicleLabel || text(item.tipoBeneficio) || 'Benefício',
    date: date ? formatSiprovDate(date) : '—',
    value,
    commission:
      commissionRate !== null && status === 'Ativa'
        ? roundCurrency(value * (commissionRate / 100))
        : null,
    status
  };
}

function buildPerformance(
  items: SiprovRecord[],
  target: number,
  today: Date
): MonthlyPerformance[] {
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth() - (5 - index), 1);
    const sales = items.filter((item) => {
      const itemDate = associateDate(item);
      return (
        itemDate?.getFullYear() === date.getFullYear() && itemDate.getMonth() === date.getMonth()
      );
    }).length;
    return {
      month: new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(date).replace('.', ''),
      sales,
      target
    };
  });
}

function buildDelinquency(
  items: SiprovRecord[],
  referenceDate: Date
): {
  accounts: DelinquentAccount[];
  overdueTitles: number;
  overdueAmount: number;
} {
  const overdue = items.filter((item) => isOverdue(item, referenceDate));
  const grouped = new Map<string, { items: SiprovRecord[]; oldest: Date }>();

  for (const item of overdue) {
    const key = String(
      integer(item.codBeneficio) || integer(item.codPessoa) || integer(item.codTitulo) || 'unknown'
    );
    const dueDate = titleDueDate(item) ?? referenceDate;
    const existing = grouped.get(key);
    if (existing) {
      existing.items.push(item);
      if (dueDate < existing.oldest) existing.oldest = dueDate;
    } else {
      grouped.set(key, { items: [item], oldest: dueDate });
    }
  }

  const accounts = [...grouped.entries()].map(([key, group]) => {
    const first = group.items[0];
    const daysOverdue = Math.max(
      1,
      Math.floor((referenceDate.getTime() - group.oldest.getTime()) / 86_400_000)
    );
    return {
      id: key,
      associate:
        text(first.nomePessoa) || text(first.nomeAssociado) || 'Associado não identificado',
      benefit: text(first.nomePlano) || text(first.descricao) || 'Benefício Siprov',
      dueDate: formatSiprovDate(group.oldest),
      daysOverdue,
      overdueTitles: group.items.length,
      amount: roundCurrency(
        group.items.reduce((sum, item) => sum + titleOutstandingAmount(item), 0)
      ),
      range: overdueRange(daysOverdue)
    } satisfies DelinquentAccount;
  });

  return {
    accounts: accounts.toSorted((a, b) => b.daysOverdue - a.daysOverdue),
    overdueTitles: overdue.length,
    overdueAmount: roundCurrency(
      overdue.reduce((sum, item) => sum + titleOutstandingAmount(item), 0)
    )
  };
}

function isOverdue(item: SiprovRecord, referenceDate: Date): boolean {
  if (!isMaturedTitle(item, referenceDate)) return false;
  if (parseDate(item.dataLiquidacao) || parseDate(item.dataPagamento)) return false;
  const status = normalize(text(item.nomeSituacao) || text(item.situacao));
  if (
    ['liquidado', 'pago', 'quitado', 'baixado', 'recebido'].some((value) => status.includes(value))
  ) {
    return false;
  }
  return titleOutstandingAmount(item) > 0;
}

function isMaturedTitle(item: SiprovRecord, referenceDate: Date): boolean {
  const dueDate = titleDueDate(item);
  if (!dueDate || dueDate > referenceDate) return false;
  const status = normalize(text(item.nomeSituacao) || text(item.situacao));
  return !status.includes('cancel');
}

function titleAmount(item: SiprovRecord): number {
  return number(item.valor) ?? number(item.valorTitulo) ?? 0;
}

function titleOutstandingAmount(item: SiprovRecord): number {
  const explicit = number(item.valorEmAberto) ?? number(item.saldo);
  if (explicit !== null) return Math.max(0, explicit);
  return Math.max(0, titleAmount(item) - (number(item.valorPago) ?? 0));
}

function titleDueDate(item: SiprovRecord): Date | null {
  return parseDate(item.dataVencimento) ?? parseDate(item.vencimento);
}

function associateDate(item: SiprovRecord): Date | null {
  return parseDate(item.dataAtivacao) ?? parseDate(item.dataAdesao) ?? parseDate(item.dataCadastro);
}

function associateValue(item: SiprovRecord): number {
  const monthly = number(item.valorMensalidade);
  if (monthly !== null) return roundCurrency(monthly);
  if (!Array.isArray(item.planos)) return 0;
  return roundCurrency(
    item.planos.reduce(
      (sum, plan) => sum + (record(plan) ? (number(record(plan)?.valor) ?? 0) : 0),
      0
    )
  );
}

function firstPlanName(value: unknown): string {
  if (!Array.isArray(value)) return '';
  for (const item of value) {
    const name = text(record(item)?.nome);
    if (name) return name;
  }
  return '';
}

function mapStatus(value: string): SaleStatus {
  const status = normalize(value);
  if (status.includes('cancel') || status.includes('inativ')) return 'Cancelada';
  if (status.includes('pend')) return 'Pendente';
  if (status.includes('ativ')) return 'Ativa';
  return 'Em análise';
}

function overdueRange(days: number): DelinquentAccount['range'] {
  if (days <= 30) return '1–30 dias';
  if (days <= 60) return '31–60 dias';
  if (days <= 90) return '61–90 dias';
  return 'Mais de 90 dias';
}

function parseConfiguredDate(value: string | undefined): Date | null {
  return parseDate(value);
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const brazilian = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(value.trim());
  if (brazilian)
    return validDate(Number(brazilian[3]), Number(brazilian[2]) - 1, Number(brazilian[1]));
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (iso) return validDate(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  return null;
}

function validDate(year: number, month: number, day: number): Date | null {
  const date = new Date(year, month, day);
  return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day
    ? date
    : null;
}

function formatSiprovDate(date: Date): string {
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

function parseBrazilianDate(value: string): number {
  return parseDate(value)?.getTime() ?? 0;
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function number(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return null;
  const normalized = value.includes(',') ? value.replace(/\./g, '').replace(',', '.') : value;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function integer(value: unknown): number | null {
  const parsed = number(value);
  return parsed !== null && Number.isInteger(parsed) ? parsed : null;
}

function record(value: unknown): SiprovRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as SiprovRecord)
    : null;
}

function optionalPercentage(value: string | undefined): number | null {
  const parsed = number(value);
  return parsed !== null && parsed >= 0 && parsed <= 100 ? parsed : null;
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = integer(value);
  return parsed !== null && parsed > 0 ? parsed : fallback;
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundPercentage(value: number): number {
  return Math.round(value * 10) / 10;
}

function getDemoData(): ConsultantDashboardData {
  return {
    consultantName: 'Lucas',
    accessScope: 'consultant',
    periodLabel: 'Novembro de 2026',
    isDemo: true,
    updatedAt: '03/11/2026 às 10:30',
    salesCount: 18,
    activeSales: 15,
    salesValue: 21640,
    commissionForecast: 3246,
    target: 25,
    delinquency: {
      associates: 7,
      overdueTitles: 9,
      overdueAmount: 4380,
      overdueRate: 8.4,
      overdueValueRate: 8.4,
      dueTitles: 107,
      dueAmount: 52140
    },
    delinquentAccounts: [
      {
        id: 'SC-0984',
        associate: 'Paulo Mendes',
        benefit: 'Plano Completo · Chevrolet Onix',
        dueDate: '02/10/2026',
        daysOverdue: 32,
        overdueTitles: 2,
        amount: 980,
        range: '31–60 dias'
      },
      {
        id: 'SC-0912',
        associate: 'Fernanda Costa',
        benefit: 'Plano Premium · Hyundai HB20',
        dueDate: '14/10/2026',
        daysOverdue: 20,
        overdueTitles: 1,
        amount: 760,
        range: '1–30 dias'
      },
      {
        id: 'SC-0876',
        associate: 'João Ribeiro',
        benefit: 'Plano Essencial · Honda CG 160',
        dueDate: '01/09/2026',
        daysOverdue: 63,
        overdueTitles: 3,
        amount: 1240,
        range: '61–90 dias'
      },
      {
        id: 'SC-0791',
        associate: 'Camila Souza',
        benefit: 'Plano Completo · Fiat Mobi',
        dueDate: '22/10/2026',
        daysOverdue: 12,
        overdueTitles: 1,
        amount: 490,
        range: '1–30 dias'
      },
      {
        id: 'SC-0705',
        associate: 'Roberto Lima',
        benefit: 'Plano Premium · Jeep Compass',
        dueDate: '20/07/2026',
        daysOverdue: 106,
        overdueTitles: 2,
        amount: 910,
        range: 'Mais de 90 dias'
      }
    ],
    performance: [
      { month: 'Jun', sales: 14, target: 20 },
      { month: 'Jul', sales: 19, target: 20 },
      { month: 'Ago', sales: 22, target: 22 },
      { month: 'Set', sales: 20, target: 22 },
      { month: 'Out', sales: 27, target: 25 },
      { month: 'Nov', sales: 18, target: 25 }
    ],
    recentSales: [
      {
        id: 'SC-1048',
        associate: 'Mariana Oliveira',
        plan: 'Plano Completo',
        vehicle: 'Fiat Argo',
        date: '03/11/2026',
        value: 1490,
        commission: 223.5,
        status: 'Ativa'
      },
      {
        id: 'SC-1047',
        associate: 'Carlos Henrique',
        plan: 'Plano Essencial',
        vehicle: 'Honda CG 160',
        date: '02/11/2026',
        value: 890,
        commission: 133.5,
        status: 'Em análise'
      },
      {
        id: 'SC-1046',
        associate: 'Jéssica Santos',
        plan: 'Plano Premium',
        vehicle: 'Jeep Renegade',
        date: '01/11/2026',
        value: 1890,
        commission: 283.5,
        status: 'Ativa'
      },
      {
        id: 'SC-1045',
        associate: 'Rafael Almeida',
        plan: 'Plano Completo',
        vehicle: 'Chevrolet Onix',
        date: '31/10/2026',
        value: 1490,
        commission: null,
        status: 'Pendente'
      },
      {
        id: 'SC-1044',
        associate: 'Ana Paula Lima',
        plan: 'Plano Essencial',
        vehicle: 'Yamaha Fazer',
        date: '30/10/2026',
        value: 890,
        commission: 133.5,
        status: 'Ativa'
      },
      {
        id: 'SC-1043',
        associate: 'Bruno Ferreira',
        plan: 'Plano Completo',
        vehicle: 'Volkswagen T-Cross',
        date: '29/10/2026',
        value: 1490,
        commission: 0,
        status: 'Cancelada'
      }
    ]
  };
}
