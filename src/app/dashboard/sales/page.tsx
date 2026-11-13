import { auth } from '@clerk/nextjs/server';
import PageContainer from '@/components/layout/page-container';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { getConsultantDashboardData } from '@/features/consultant/api/service';
import { SalesTable } from '@/features/consultant/components/consultant-dashboard';

export default async function SalesPage() {
  await auth.protect();
  const data = await getConsultantDashboardData();
  const isTeamView = data.accessScope === 'representative';
  return (
    <PageContainer
      pageTitle={isTeamView ? 'Vendas da equipe' : 'Minhas vendas'}
      pageDescription={
        isTeamView
          ? 'Consulte as adesões vinculadas à sua equipe na Siprov.'
          : 'Consulte as adesões vinculadas ao seu cadastro na Siprov.'
      }
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
          {data.recentSales.length} registros exibidos
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
