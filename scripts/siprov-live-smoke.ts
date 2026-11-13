import { getSiprovClient, SiprovClientError } from '../src/lib/siprov/client.ts';

interface CheckResult {
  name: string;
  ok: boolean;
  durationMs: number;
  records?: number;
}

async function main() {
  const client = getSiprovClient();
  const checks: CheckResult[] = [];

  const vendors = await timed('vendors', () => client.listVendors(), checks);
  if (vendors.length === 0) throw new Error('A Siprov não retornou consultores ativos.');

  const requestedId = positiveInteger(process.env.SIPROV_TEST_CONSULTANT_ID);
  const fallbackId = positiveInteger(vendors[0]?.id);
  const consultantId = requestedId ?? fallbackId;
  if (!consultantId) throw new Error('Nenhum identificador de consultor válido foi retornado.');

  const consultantExists = vendors.some((vendor) => positiveInteger(vendor.id) === consultantId);
  if (!consultantExists) {
    throw new Error(
      'O SIPROV_TEST_CONSULTANT_ID deve receber o campo id retornado pela API de vendedores, não o código sequencial exibido no acesso web.'
    );
  }
  const accessScope =
    process.env.SIPROV_TEST_ACCESS_SCOPE?.trim().toLowerCase() === 'representative'
      ? 'representative'
      : 'consultant';
  const representativeId = positiveInteger(process.env.SIPROV_TEST_REPRESENTATIVE_ID);
  if (accessScope === 'representative' && !representativeId) {
    throw new Error(
      'Defina SIPROV_TEST_REPRESENTATIVE_ID com o código sequencial usado no filtro de representante da Siprov.'
    );
  }
  const sellerId = accessScope === 'representative' ? representativeId! : consultantId;
  const sellerFilter =
    accessScope === 'representative'
      ? ({ representativeId: sellerId } as const)
      : ({ consultantId: sellerId } as const);
  const scopeName = accessScope === 'representative' ? 'representative' : 'consultant';

  const end = new Date();
  const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 7);
  const dueStart = new Date(end.getFullYear(), end.getMonth() - 1, end.getDate());

  await timed(
    `associates_by_${scopeName}`,
    () =>
      client.listAssociates({
        ...sellerFilter,
        startDate: formatDate(start),
        endDate: formatDate(end)
      }),
    checks
  );
  await timed(
    `emitted_titles_by_${scopeName}`,
    () =>
      client.listTitles({
        ...sellerFilter,
        dateField: 'emission',
        startDate: formatDate(start),
        endDate: formatDate(end)
      }),
    checks
  );
  await timed(
    `due_titles_by_${scopeName}`,
    () =>
      client.listTitles({
        ...sellerFilter,
        dateField: 'due',
        startDate: formatDate(dueStart),
        endDate: formatDate(end)
      }),
    checks
  );

  process.stdout.write(
    `${JSON.stringify({
      status: 'ok',
      target: 'live-siprov',
      consultantValidated: true,
      accessScope,
      sellerId,
      period: { start: formatDate(start), end: formatDate(end) },
      checks
    })}\n`
  );
}

async function timed<T extends unknown[]>(
  name: string,
  operation: () => Promise<T>,
  checks: CheckResult[]
): Promise<T> {
  const startedAt = performance.now();
  const result = await operation();
  checks.push({
    name,
    ok: true,
    durationMs: Math.round(performance.now() - startedAt),
    records: result.length
  });
  return result;
}

function positiveInteger(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function formatDate(date: Date): string {
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Falha desconhecida no teste Siprov.';
  const httpStatus = error instanceof SiprovClientError ? (error.status ?? null) : null;
  process.stderr.write(
    `${JSON.stringify({ status: 'error', target: 'live-siprov', httpStatus, message })}\n`
  );
  process.exitCode = 1;
});
