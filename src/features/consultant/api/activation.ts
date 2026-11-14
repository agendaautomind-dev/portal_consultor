import type { SiprovRecord } from '@/lib/siprov/client';

export function activationDate(item: SiprovRecord): Date | null {
  if (typeof item.dataAtivacao !== 'string' || !item.dataAtivacao.trim()) return null;
  const value = item.dataAtivacao.trim();
  const brazilian = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(value);
  if (brazilian) {
    return validDate(Number(brazilian[3]), Number(brazilian[2]) - 1, Number(brazilian[1]));
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return iso ? validDate(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])) : null;
}

export function uniqueActivatedBenefits(items: SiprovRecord[]): SiprovRecord[] {
  const unique = new Map<string, SiprovRecord>();
  for (const item of items) {
    if (!activationDate(item)) continue;
    const key = String(
      positiveInteger(item.codBeneficio) ??
        positiveInteger(item.sequencial) ??
        `${positiveInteger(item.codPessoa) ?? 'pessoa'}-${item.dataAtivacao}-${String(item.placa ?? '')}`
    );
    unique.set(key, item);
  }
  return [...unique.values()];
}

function positiveInteger(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function validDate(year: number, month: number, day: number): Date | null {
  const date = new Date(year, month, day);
  return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day
    ? date
    : null;
}
