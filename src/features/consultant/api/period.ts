import type { PeriodOption } from './types';

export interface ConsultantPeriod {
  key: string;
  label: string;
  start: Date;
  end: Date;
  historyStart: Date;
  options: PeriodOption[];
}

export function resolveConsultantPeriod(value?: string, today = new Date()): ConsultantPeriod {
  const currentStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const match = /^(\d{4})-(\d{2})$/.exec(value ?? '');
  const requested = match ? new Date(Number(match[1]), Number(match[2]) - 1, 1) : currentStart;
  const start =
    match &&
    requested.getTime() <= currentStart.getTime() &&
    requested.getMonth() === Number(match[2]) - 1
      ? requested
      : currentStart;
  const currentPeriod = start.getTime() === currentStart.getTime();
  const end = currentPeriod
    ? new Date(today.getFullYear(), today.getMonth(), today.getDate())
    : new Date(start.getFullYear(), start.getMonth() + 1, 0);
  const key = periodKey(start);
  const options = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(currentStart.getFullYear(), currentStart.getMonth() - index, 1);
    return { value: periodKey(date), label: periodLabel(date) };
  });

  if (!options.some((option) => option.value === key)) {
    options.push({ value: key, label: periodLabel(start) });
  }

  return {
    key,
    label: periodLabel(start),
    start,
    end,
    historyStart: new Date(start.getFullYear(), start.getMonth() - 5, 1),
    options
  };
}

function periodKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function periodLabel(date: Date): string {
  const label = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}
