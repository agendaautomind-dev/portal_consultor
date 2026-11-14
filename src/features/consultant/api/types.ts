export type SaleStatus = 'Ativa' | 'Em análise' | 'Pendente' | 'Cancelada';
export type ConsultantAccessScope = 'consultant' | 'representative';

export interface ConsultantSale {
  id: string;
  associate: string;
  plan: string;
  vehicle: string;
  date: string;
  value: number;
  commission: number | null;
  status: SaleStatus;
}

export interface MonthlyPerformance {
  month: string;
  sales: number;
  target: number;
}

export interface PeriodOption {
  value: string;
  label: string;
}

export interface DelinquentAccount {
  id: string;
  associate: string;
  benefit: string;
  dueDate: string;
  daysOverdue: number;
  overdueTitles: number;
  amount: number;
  range: '1–30 dias' | '31–60 dias' | '61–90 dias' | 'Mais de 90 dias';
}

export interface DelinquencySummary {
  associates: number;
  overdueTitles: number;
  overdueAmount: number;
  overdueRate: number;
  overdueValueRate: number;
  dueTitles: number;
  dueAmount: number;
}

export interface ConsultantBaseData {
  consultantName: string;
  accessScope: ConsultantAccessScope;
  isDemo: boolean;
  updatedAt: string;
}

export interface ConsultantSalesData extends ConsultantBaseData {
  periodKey: string;
  periodLabel: string;
  periodOptions: PeriodOption[];
  salesCount: number;
  activeSales: number;
  salesValue: number;
  commissionForecast: number | null;
  target: number;
  performance: MonthlyPerformance[];
  bestMonth: MonthlyPerformance | null;
  recentSales: ConsultantSale[];
}

export interface ConsultantDelinquencyData extends ConsultantBaseData {
  delinquency: DelinquencySummary;
  delinquentAccounts: DelinquentAccount[];
}

export interface ConsultantDashboardData extends ConsultantSalesData, ConsultantDelinquencyData {}
