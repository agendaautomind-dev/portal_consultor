import { auth } from '@clerk/nextjs/server';
import PageContainer from '@/components/layout/page-container';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getConsultantDashboardData } from '@/features/consultant/api/service';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export default async function CommissionsPage() {
  await auth.protect();
  const data = await getConsultantDashboardData();
  const isTeamView = data.accessScope === 'representative';
  const confirmed = data.recentSales
    .filter((sale) => sale.status === 'Ativa')
    .reduce((sum, sale) => sum + (sale.commission ?? 0), 0);
  const pending = data.recentSales
    .filter((sale) => sale.status === 'Em análise' || sale.status === 'Pendente')
    .reduce((sum, sale) => sum + (sale.commission ?? 0), 0);
  return (
    <PageContainer
      pageTitle={isTeamView ? 'Comissões da equipe' : 'Comissões'}
      pageDescription={
        isTeamView
          ? 'Acompanhe os valores previstos e confirmados da equipe.'
          : 'Acompanhe valores previstos, confirmados e o histórico de pagamento.'
      }
    >
      <div className='mb-4'>
        <Badge
          variant='outline'
          className={
            data.isDemo
              ? 'border-amber-300 bg-amber-50 text-amber-800'
              : 'border-emerald-300 bg-emerald-50 text-emerald-800'
          }
        >
          {data.isDemo
            ? 'Cálculo demonstrativo — regra Siprov pendente'
            : data.commissionForecast === null
              ? 'Dados Siprov — configure a regra de comissão'
              : 'Dados e regra de comissão ativos'}
        </Badge>
        {isTeamView && (
          <Badge variant='secondary' className='ml-2'>
            Visão da equipe
          </Badge>
        )}
      </div>
      <div className='grid gap-4 md:grid-cols-3'>
        <Summary
          title='Previsão do mês'
          value={currency.format(data.commissionForecast ?? 0)}
          detail='Antes de validações e estornos'
        />
        <Summary
          title='Confirmada'
          value={currency.format(confirmed)}
          detail='Vendas ativas desta amostra'
        />
        <Summary
          title='Em validação'
          value={currency.format(pending)}
          detail='Análises e pendências'
        />
      </div>
      <Card className='mt-4'>
        <CardHeader>
          <CardTitle>Como a comissão será calculada</CardTitle>
          <CardDescription>
            O portal só exibirá valores reais após receber a regra oficial.
          </CardDescription>
        </CardHeader>
        <CardContent className='grid gap-4 text-sm md:grid-cols-3'>
          <Step
            number='1'
            title='Venda identificada'
            text='A adesão precisa retornar o código do consultor responsável.'
          />
          <Step
            number='2'
            title='Elegibilidade validada'
            text='Situação, ativação, prazo e possíveis cancelamentos são conferidos.'
          />
          <Step
            number='3'
            title='Valor consolidado'
            text='A regra por plano e faixa é aplicada com memória de cálculo auditável.'
          />
        </CardContent>
      </Card>
    </PageContainer>
  );
}

function Summary({ title, value, detail }: { title: string; value: string; detail: string }) {
  return (
    <Card>
      <CardContent className='pt-6'>
        <p className='text-muted-foreground text-sm'>{title}</p>
        <p className='mt-2 text-3xl font-bold'>{value}</p>
        <p className='text-muted-foreground mt-1 text-xs'>{detail}</p>
      </CardContent>
    </Card>
  );
}

function Step({ number, title, text }: { number: string; title: string; text: string }) {
  return (
    <div className='bg-muted/50 rounded-lg p-4'>
      <span className='bg-primary text-primary-foreground inline-flex size-7 items-center justify-center rounded-full text-xs font-bold'>
        {number}
      </span>
      <h3 className='mt-3 font-semibold'>{title}</h3>
      <p className='text-muted-foreground mt-1'>{text}</p>
    </div>
  );
}
