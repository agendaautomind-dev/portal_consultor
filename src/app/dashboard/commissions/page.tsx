import { auth } from '@clerk/nextjs/server';
import PageContainer from '@/components/layout/page-container';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getConsultantSalesData } from '@/features/consultant/api/service';
import { PeriodSelect } from '@/features/consultant/components/period-select';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export default async function CommissionsPage({
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
      pageTitle={isTeamView ? 'Comissões da equipe' : 'Comissões'}
      pageDescription={
        isTeamView
          ? 'Confira a base de vendas ativadas da equipe enquanto a regra é definida.'
          : 'Confira sua base de vendas ativadas enquanto a regra de comissão é definida.'
      }
      pageHeaderAction={<PeriodSelect value={data.periodKey} options={data.periodOptions} />}
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
            : 'Vendas Siprov identificadas — regra de comissão a confirmar'}
        </Badge>
        {isTeamView && (
          <Badge variant='secondary' className='ml-2'>
            Visão da equipe
          </Badge>
        )}
      </div>
      <div className='grid gap-4 md:grid-cols-3'>
        <Summary
          title='Vendas ativadas'
          value={String(data.salesCount)}
          detail={data.periodLabel}
        />
        <Summary
          title='Mensalidades ativadas'
          value={currency.format(data.salesValue)}
          detail='Base comercial, não é comissão'
        />
        <Summary title='Comissão' value='A definir' detail='Aguardando a regra comercial' />
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
