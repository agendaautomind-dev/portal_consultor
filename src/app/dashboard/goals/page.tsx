import { auth } from '@clerk/nextjs/server';
import PageContainer from '@/components/layout/page-container';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { getConsultantDashboardData } from '@/features/consultant/api/service';

export default async function GoalsPage() {
  await auth.protect();
  const data = await getConsultantDashboardData();
  const progress = Math.round((data.salesCount / data.target) * 100);
  return (
    <PageContainer
      pageTitle='Metas'
      pageDescription='Veja seu progresso e o que falta para fechar o período.'
    >
      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <CardTitle>Meta de novembro</CardTitle>
            <Badge variant='secondary'>{progress}%</Badge>
          </div>
        </CardHeader>
        <CardContent className='space-y-5'>
          <div>
            <span className='text-4xl font-bold'>{data.salesCount}</span>
            <span className='text-muted-foreground text-lg'> de {data.target} vendas</span>
          </div>
          <Progress value={progress} className='h-3' />
          <div className='grid gap-3 sm:grid-cols-3'>
            <GoalMetric label='Realizadas' value={String(data.salesCount)} />
            <GoalMetric label='Faltam' value={String(Math.max(0, data.target - data.salesCount))} />
            <GoalMetric label='Melhor mês' value='27 vendas' />
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  );
}

function GoalMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className='bg-muted/50 rounded-lg p-4'>
      <p className='text-muted-foreground text-sm'>{label}</p>
      <p className='mt-1 text-xl font-semibold'>{value}</p>
    </div>
  );
}
