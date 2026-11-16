import 'server-only';

import { z } from 'zod';
import { getSiprovClient, type SiprovRecord } from './client';
import { finishSiprovSyncRun, saveSiprovSnapshots, startSiprovSyncRun } from './sync-store';

const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const SiprovSyncRequestSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('daily'), days: z.number().int().min(1).max(7).default(2) }),
  z.object({
    mode: z.literal('initial'),
    startDate: DateSchema,
    endDate: DateSchema
  })
]);

export type SiprovSyncRequest = z.infer<typeof SiprovSyncRequestSchema>;

export async function reconcileSiprov(
  input: SiprovSyncRequest
): Promise<{ benefits: number; titles: number }> {
  const runId = await startSiprovSyncRun(input.mode);
  const counts = { benefits: 0, titles: 0 };

  try {
    const client = getSiprovClient();
    let benefits: SiprovRecord[];
    let start: Date;
    let end: Date;

    if (input.mode === 'initial') {
      start = parseIsoDate(input.startDate);
      end = parseIsoDate(input.endDate);
      assertRange(start, end, 1095);
      benefits = await client.listAllAssociates(formatSiprovDate(start), formatSiprovDate(end));
    } else {
      end = today();
      start = addDays(end, -(input.days - 1));
      const updatedByDay = await Promise.all(
        eachDay(start, end).map((date) => client.listAssociatesUpdated(formatSiprovDate(date)))
      );
      benefits = uniqueRecords(updatedByDay.flat(), ['codBeneficio', 'sequencial', 'id']);
    }

    const titleParams = {
      startDate: formatSiprovDate(start),
      endDate: formatSiprovDate(end)
    };
    const titleGroups = await Promise.all([
      client.listAllTitles({ ...titleParams, dateField: 'emission' }),
      client.listAllTitles({ ...titleParams, dateField: 'due' }),
      client.listAllTitles({ ...titleParams, dateField: 'liquidation' })
    ]);
    const titles = uniqueRecords(titleGroups.flat(), ['codTitulo', 'id']);

    Object.assign(counts, await saveSiprovSnapshots(benefits, titles));
    await finishSiprovSyncRun(runId, 'success', counts);
    return counts;
  } catch (error) {
    await finishSiprovSyncRun(
      runId,
      'error',
      counts,
      error instanceof Error ? error.message : 'Falha desconhecida.'
    );
    throw error;
  }
}

function parseIsoDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    throw new Error('Período de sincronização inválido.');
  }
  return date;
}

function assertRange(start: Date, end: Date, maxDays: number): void {
  const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
  if (days < 1 || days > maxDays) {
    throw new Error(`O período inicial deve ter entre 1 e ${maxDays} dias.`);
  }
}

function today(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function eachDay(start: Date, end: Date): Date[] {
  const result: Date[] = [];
  for (let date = new Date(start); date <= end; date = addDays(date, 1)) result.push(date);
  return result;
}

function formatSiprovDate(date: Date): string {
  return [date.getDate(), date.getMonth() + 1, date.getFullYear()]
    .map((part, index) => (index < 2 ? String(part).padStart(2, '0') : String(part)))
    .join('/');
}

function uniqueRecords(records: SiprovRecord[], keys: string[]): SiprovRecord[] {
  const unique = new Map<string, SiprovRecord>();
  records.forEach((record, index) => {
    const value = keys.map((key) => record[key]).find((candidate) => candidate != null);
    unique.set(
      value == null ? `missing:${index}:${JSON.stringify(record)}` : String(value),
      record
    );
  });
  return [...unique.values()];
}
