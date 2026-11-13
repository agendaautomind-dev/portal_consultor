import { auth } from '@clerk/nextjs/server';
import PageContainer from '@/components/layout/page-container';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { getConsultantDashboardData } from '@/features/consultant/api/service';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export default async function DelinquencyPage() {
  await auth.protect();
  const data = await getConsultantDashboardData();
  const summary = data.delinquency;
  const isTeamView = data.accessScope === 'representative';

  return (
    <PageContainer
      pageTitle='Inadimplência'
      pageDescription={
        isTeamView
          ? 'Acompanhe os associados com títulos vencidos vinculados à equipe.'
          : 'Acompanhe os associados com títulos vencidos vinculados às suas vendas.'
      }
    >
      <div className='mb-4 flex flex-wrap items-center gap-2'>
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
        <span className='text-muted-foreground text-sm'>Atualizado em {data.updatedAt}</span>
      </div>

      <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-5'>
        <SummaryCard
          title='Associados inadimplentes'
          value={String(summary.associates)}
          detail={isTeamView ? 'Vinculados à equipe' : 'Vinculados ao consultor'}
        />
        <SummaryCard
          title='Títulos em atraso'
          value={`${summary.overdueTitles} de ${summary.dueTitles}`}
          detail='Inadimplentes sobre títulos vencidos'
        />
        <SummaryCard
          title='Valor em atraso'
          value={currency.format(summary.overdueAmount)}
          detail={`De ${currency.format(summary.dueAmount)} vencidos`}
        />
        <SummaryCard
          title='Índice por quantidade'
          value={`${summary.overdueRate.toLocaleString('pt-BR')}%`}
          detail='Sempre exibido com a base de cálculo'
        />
        <SummaryCard
          title='Índice por valor'
          value={`${summary.overdueValueRate.toLocaleString('pt-BR')}%`}
          detail='Valor em atraso sobre valor vencido'
        />
      </div>

      <Card className='mt-4'>
        <CardHeader>
          <CardTitle>Associados com pendências</CardTitle>
          <CardDescription>
            Ordenados pelo maior tempo em atraso. Dados pessoais sensíveis não são exibidos.
          </CardDescription>
        </CardHeader>
        <CardContent className='overflow-x-auto'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Benefício</TableHead>
                <TableHead>Associado</TableHead>
                <TableHead>Vencimento mais antigo</TableHead>
                <TableHead>Dias em atraso</TableHead>
                <TableHead>Faixa</TableHead>
                <TableHead className='text-center'>Títulos</TableHead>
                <TableHead className='text-right'>Valor em aberto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.delinquentAccounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell>
                    <div className='font-medium'>{account.id}</div>
                    <div className='text-muted-foreground max-w-64 text-xs'>{account.benefit}</div>
                  </TableCell>
                  <TableCell>{account.associate}</TableCell>
                  <TableCell className='whitespace-nowrap'>{account.dueDate}</TableCell>
                  <TableCell>{account.daysOverdue} dias</TableCell>
                  <TableCell>
                    <Badge variant='outline'>{account.range}</Badge>
                  </TableCell>
                  <TableCell className='text-center'>{account.overdueTitles}</TableCell>
                  <TableCell className='text-right font-medium'>
                    {currency.format(account.amount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className='text-muted-foreground mt-4 text-xs'>
        Critério: títulos de crédito vencidos e ainda não liquidados na data de referência. A
        inadimplência é atribuída ao consultor ou representante responsável pelo benefício na
        Siprov.
      </p>
    </PageContainer>
  );
}

function SummaryCard({ title, value, detail }: { title: string; value: string; detail: string }) {
  return (
    <Card>
      <CardContent className='pt-6'>
        <p className='text-muted-foreground text-sm'>{title}</p>
        <p className='mt-2 text-2xl font-bold tracking-tight'>{value}</p>
        <p className='text-muted-foreground mt-1 text-xs'>{detail}</p>
      </CardContent>
    </Card>
  );
}
