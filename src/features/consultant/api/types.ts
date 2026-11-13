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

export interface ConsultantDashboardData {
  consultantName: string;
  accessScope: ConsultantAccessScope;
  periodLabel: string;
  isDemo: boolean;
  updatedAt: string;
  salesCount: number;
  activeSales: number;
  salesValue: number;
  commissionForecast: number | null;
  target: number;
  delinquency: DelinquencySummary;
  delinquentAccounts: DelinquentAccount[];
  performance: MonthlyPerformance[];
  recentSales: ConsultantSale[];
}
