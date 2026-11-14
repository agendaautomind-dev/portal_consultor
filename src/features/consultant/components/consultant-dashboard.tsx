'use client';

import Link from 'next/link';
import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import type { ConsultantDashboardData, ConsultantSale, SaleStatus } from '../api/types';
import { PeriodSelect } from './period-select';

interface ConsultantDashboardProps {
  data: ConsultantDashboardData;
}

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const statusVariant: Record<SaleStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  Ativa: 'default',
  'Em análise': 'secondary',
  Pendente: 'outline',
  Cancelada: 'destructive'
};

export function ConsultantDashboard({ data }: ConsultantDashboardProps) {
  const isTeamView = data.accessScope === 'representative';
  const targetProgress = Math.min(100, Math.round((data.salesCount / data.target) * 100));
  const maxChartValue = Math.max(
    ...data.performance.map((item) => Math.max(item.sales, item.target))
  );

  return (
    <div className='flex flex-1 flex-col gap-6'>
      <div className='flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between'>
        <div>
          <div className='mb-2 flex items-center gap-2'>
            <Badge
              variant='outline'
              className={
                data.isDemo
                  ? 'border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200'
                  : 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
              }
            >
              {data.isDemo ? 'Modo demonstração' : 'Dados oficiais Siprov'}
            </Badge>
            {isTeamView && <Badge variant='secondary'>Visão da equipe</Badge>}
            <span className='text-muted-foreground text-xs'>Atualizado em {data.updatedAt}</span>
          </div>
          <h1 className='text-2xl font-bold tracking-tight sm:text-3xl'>
            Olá, {data.consultantName} 👋
          </h1>
          <p className='text-muted-foreground mt-1'>
            {isTeamView
              ? 'Acompanhe o desempenho, as vendas e a inadimplência da sua equipe.'
              : 'Acompanhe seu desempenho, suas vendas e a inadimplência vinculada.'}
          </p>
        </div>
        <PeriodSelect value={data.periodKey} options={data.periodOptions} />
      </div>

      <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-5'>
        <MetricCard
          label={isTeamView ? 'Vendas da equipe no mês' : 'Vendas no mês'}
          value={String(data.salesCount)}
          detail={`${data.activeSales} vendas ativas`}
          icon={Icons.trendingUp}
        />
        <MetricCard
          label='Mensalidades ativadas'
          value={currency.format(data.salesValue)}
          detail={`Benefícios ativados em ${data.periodLabel}`}
          icon={Icons.product}
        />
        <MetricCard
          label='Comissão prevista'
          value={
            data.commissionForecast === null
              ? 'A calcular'
              : currency.format(data.commissionForecast)
          }
          detail='Regra comercial a confirmar'
          icon={Icons.billing}
        />
        <MetricCard
          label='Inadimplência'
          value={currency.format(data.delinquency.overdueAmount)}
          detail={`${data.delinquency.associates} associados · ${data.delinquency.overdueRate.toLocaleString('pt-BR')}%`}
          icon={Icons.warning}
        />
        <MetricCard
          label='Meta mensal'
          value={`${targetProgress}%`}
          detail={`${data.salesCount} de ${data.target} vendas`}
          icon={Icons.badgeCheck}
        >
          <Progress value={targetProgress} className='mt-3 h-2' />
        </MetricCard>
      </div>

      <div className='grid gap-4 lg:grid-cols-[1.5fr_1fr]'>
        <Card>
          <CardHeader>
            <CardTitle>Desempenho comercial</CardTitle>
            <CardDescription>
              {isTeamView
                ? 'Vendas da equipe em comparação com a meta mensal'
                : 'Vendas realizadas em comparação com a meta mensal'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className='flex h-64 items-end gap-3 pt-5 sm:gap-6'>
              {data.performance.map((item) => (
                <div key={item.month} className='flex h-full flex-1 flex-col justify-end gap-2'>
                  <div className='flex flex-1 items-end justify-center gap-1'>
                    <div
                      className='bg-primary min-h-1 w-3 rounded-t-sm sm:w-5'
                      style={{ height: `${(item.sales / maxChartValue) * 100}%` }}
                      title={`${item.sales} vendas`}
                    />
                    <div
                      className='bg-muted-foreground/25 min-h-1 w-3 rounded-t-sm sm:w-5'
                      style={{ height: `${(item.target / maxChartValue) * 100}%` }}
                      title={`Meta: ${item.target}`}
                    />
                  </div>
                  <span className='text-muted-foreground text-center text-xs'>{item.month}</span>
                </div>
              ))}
            </div>
            <div className='mt-4 flex items-center justify-center gap-5 text-xs'>
              <span className='flex items-center gap-2'>
                <span className='bg-primary size-2.5 rounded-sm' />
                Vendas
              </span>
              <span className='flex items-center gap-2'>
                <span className='bg-muted-foreground/25 size-2.5 rounded-sm' />
                Meta
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Progresso da meta</CardTitle>
            <CardDescription>
              Faltam {Math.max(0, data.target - data.salesCount)} vendas para alcançar a meta
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-6'>
            <div className='flex items-end justify-between'>
              <div>
                <span className='text-4xl font-bold'>{data.salesCount}</span>
                <span className='text-muted-foreground'> / {data.target}</span>
              </div>
              <Badge variant={targetProgress >= 100 ? 'default' : 'secondary'}>
                {targetProgress}% concluída
              </Badge>
            </div>
            <Progress value={targetProgress} className='h-3' />
            <div className='bg-muted/60 rounded-lg p-4'>
              <p className='text-sm font-medium'>Ritmo atual</p>
              <p className='text-muted-foreground mt-1 text-sm'>
                {data.salesCount >= data.target
                  ? 'Meta alcançada nesta competência.'
                  : `Faltam ${data.target - data.salesCount} vendas ativadas para a meta.`}
              </p>
            </div>
            <Button
              className='w-full'
              variant='outline'
              nativeButton={false}
              render={
                <Link
                  href={`/dashboard/goals?period=${data.periodKey}`}
                  aria-label='Ver detalhes da meta'
                />
              }
            >
              Ver detalhes da meta <Icons.arrowRight className='ml-2 size-4' />
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className='flex-row items-center justify-between'>
          <div>
            <CardTitle>Vendas recentes</CardTitle>
            <CardDescription>
              {isTeamView
                ? 'Últimos benefícios ativados vinculados à equipe'
                : 'Últimos benefícios ativados vinculados ao seu cadastro'}
            </CardDescription>
          </div>
          <Button
            variant='outline'
            size='sm'
            nativeButton={false}
            render={
              <Link href={`/dashboard/sales?period=${data.periodKey}`} aria-label='Ver todas' />
            }
          >
            Ver todas <Icons.arrowRight className='ml-2 size-4' />
          </Button>
        </CardHeader>
        <CardContent className='overflow-x-auto'>
          <SalesTable sales={data.recentSales.slice(0, 5)} />
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  children
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className='pt-6'>
        <div className='flex items-start justify-between gap-3'>
          <div>
            <p className='text-muted-foreground text-sm'>{label}</p>
            <p className='mt-2 text-2xl font-bold tracking-tight'>{value}</p>
            <p className='text-muted-foreground mt-1 text-xs'>{detail}</p>
          </div>
          <div className='bg-primary/10 text-primary rounded-lg p-2.5'>
            <Icon className='size-5' />
          </div>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

export function SalesTable({ sales }: { sales: ConsultantSale[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Venda</TableHead>
          <TableHead>Associado</TableHead>
          <TableHead>Plano / veículo</TableHead>
          <TableHead>Data</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className='text-right'>Valor</TableHead>
          <TableHead className='text-right'>Comissão</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sales.length === 0 && (
          <TableRow>
            <TableCell colSpan={7} className='text-muted-foreground py-8 text-center'>
              Nenhum benefício ativado nesta competência.
            </TableCell>
          </TableRow>
        )}
        {sales.map((sale) => (
          <TableRow key={sale.id}>
            <TableCell className='font-medium'>{sale.id}</TableCell>
            <TableCell>{sale.associate}</TableCell>
            <TableCell>
              <div>{sale.plan}</div>
              <div className='text-muted-foreground text-xs'>{sale.vehicle}</div>
            </TableCell>
            <TableCell className='whitespace-nowrap'>{sale.date}</TableCell>
            <TableCell>
              <Badge variant={statusVariant[sale.status]}>{sale.status}</Badge>
            </TableCell>
            <TableCell className='text-right'>{currency.format(sale.value)}</TableCell>
            <TableCell className='text-right'>
              {sale.commission === null ? (
                <span className='text-muted-foreground'>A definir</span>
              ) : (
                currency.format(sale.commission)
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
