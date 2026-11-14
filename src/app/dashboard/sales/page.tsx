import { auth } from '@clerk/nextjs/server';
import PageContainer from '@/components/layout/page-container';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { getConsultantSalesData } from '@/features/consultant/api/service';
import { SalesTable } from '@/features/consultant/components/consultant-dashboard';
import { PeriodSelect } from '@/features/consultant/components/period-select';

export default async function SalesPage({
  searchParams
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  await auth.protect();
  const { period } = await searchParams;
  const data = await getConsultantSalesData(period);
  const isTeamView = data.accessScope === 'representative';
  return (
    <PageContainer
      pageTitle={isTeamView ? 'Vendas da equipe' : 'Minhas vendas'}
      pageDescription={
        isTeamView
          ? 'Consulte os benefícios ativados vinculados à sua equipe na Siprov.'
          : 'Consulte os benefícios ativados vinculados ao seu cadastro na Siprov.'
      }
      pageHeaderAction={<PeriodSelect value={data.periodKey} options={data.periodOptions} />}
    >
      <div className='mb-4 flex items-center gap-2'>
        <Badge
          variant='outline'
          className={
            data.isDemo
              ? 'border-amber-300 bg-amber-50 text-amber-800'
              : 'border-emerald-300 bg-emerald-50 text-emerald-800'
          }
        >
          {data.isDemo ? 'Modo demonstração' : 'Dados oficiais Siprov'}
        </Badge>
        {isTeamView && <Badge variant='secondary'>Visão da equipe</Badge>}
        <span className='text-muted-foreground text-sm'>
          {data.recentSales.length} benefícios ativados em {data.periodLabel}
        </span>
      </div>
      <Card>
        <CardContent className='overflow-x-auto pt-6'>
          <SalesTable sales={data.recentSales} />
        </CardContent>
      </Card>
    </PageContainer>
  );
}
