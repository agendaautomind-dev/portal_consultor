import { createHash, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { SiprovRecord } from './client';

export type SiprovWebhookType = 'benefit' | 'title';

export interface SiprovWebhookEvent {
  eventKey: string;
  type: SiprovWebhookType;
  historyCode: number | null;
  happenedAt: Date | null;
  entity: string | null;
  object: SiprovRecord;
  payload: SiprovRecord;
}

const PayloadSchema = z
  .object({
    codHistorico: z.coerce.number().int().positive().optional(),
    dataHistorico: z.string().max(64).optional(),
    entidade: z.string().max(100).optional(),
    objeto: z.record(z.string(), z.unknown())
  })
  .passthrough();

export function parseSiprovWebhook(type: SiprovWebhookType, rawBody: string): SiprovWebhookEvent {
  if (!rawBody || Buffer.byteLength(rawBody, 'utf8') > 64 * 1024) {
    throw new Error('Payload Siprov vazio ou maior que 64 KB.');
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    throw new Error('Payload Siprov não contém JSON válido.');
  }

  const payload = PayloadSchema.parse(json);
  const historyCode = payload.codHistorico ?? null;
  const eventKey = historyCode
    ? `${type}:${historyCode}`
    : `${type}:sha256:${createHash('sha256').update(rawBody).digest('hex')}`;

  return {
    eventKey,
    type,
    historyCode,
    happenedAt: parseSiprovDate(payload.dataHistorico),
    entity: payload.entidade?.trim() || null,
    object: payload.objeto,
    payload
  };
}

export function secretMatches(received: string, configured: string | undefined): boolean {
  if (!configured || configured.length < 32) return false;
  const left = Buffer.from(received);
  const right = Buffer.from(configured);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function parseSiprovDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const brazilian = /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(
    value.trim()
  );
  if (brazilian) {
    return validDate(
      Number(brazilian[3]),
      Number(brazilian[2]) - 1,
      Number(brazilian[1]),
      Number(brazilian[4] ?? 0),
      Number(brazilian[5] ?? 0),
      Number(brazilian[6] ?? 0)
    );
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function validDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number
): Date | null {
  const date = new Date(year, month, day, hour, minute, second);
  return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day
    ? date
    : null;
}
