import 'server-only';

import type { Sql, TransactionSql } from 'postgres';
import { getDatabase } from '@/lib/database';
import type { SiprovRecord } from './client';
import { parseSiprovDate, type SiprovWebhookEvent } from './webhook';

const globalSyncSchema = globalThis as typeof globalThis & {
  portalSyncSchema?: Promise<void>;
};

interface BenefitRow {
  siprov_id: number;
  person_id: number | null;
  consultant_id: number | null;
  representative_id: number | null;
  status: string | null;
  registered_at: Date | null;
  joined_at: Date | null;
  activated_at: Date | null;
  raw: SiprovRecord;
}

interface TitleRow {
  siprov_id: number;
  person_id: number | null;
  benefit_id: number | null;
  title_type: string | null;
  status: string | null;
  issued_at: Date | null;
  due_at: Date | null;
  liquidated_at: Date | null;
  amount: number | null;
  paid_amount: number | null;
  net_amount: number | null;
  raw: SiprovRecord;
}

export async function saveSiprovWebhook(event: SiprovWebhookEvent): Promise<boolean> {
  const sql = getDatabase();
  await ensureSiprovSyncSchema(sql);

  return sql.begin(async (tx) => {
    const inserted = await tx<{ event_key: string }[]>`
      INSERT INTO siprov_webhook_events (
        event_key, event_type, history_code, happened_at, entity, payload
      ) VALUES (
        ${event.eventKey}, ${event.type}, ${event.historyCode}, ${event.happenedAt},
        ${event.entity}, ${tx.json(event.payload)}
      )
      ON CONFLICT (event_key) DO NOTHING
      RETURNING event_key
    `;
    if (inserted.length === 0) return false;

    if (event.type === 'benefit') await upsertBenefitRows(tx, [event.object]);
    else await upsertTitleRows(tx, [{ ...event.object, tipo: event.entity }]);

    await tx`
      UPDATE siprov_webhook_events
      SET status = 'processed', processed_at = NOW()
      WHERE event_key = ${event.eventKey}
    `;
    return true;
  });
}

export async function saveSiprovSnapshots(
  benefits: SiprovRecord[],
  titles: SiprovRecord[]
): Promise<{ benefits: number; titles: number }> {
  const sql = getDatabase();
  await ensureSiprovSyncSchema(sql);
  return sql.begin(async (tx) => ({
    benefits: await upsertBenefitRows(tx, benefits),
    titles: await upsertTitleRows(tx, titles)
  }));
}

export async function startSiprovSyncRun(mode: string): Promise<number> {
  const sql = getDatabase();
  await ensureSiprovSyncSchema(sql);
  const rows = await sql<{ id: number }[]>`
    INSERT INTO siprov_sync_runs (mode) VALUES (${mode}) RETURNING id
  `;
  if (!rows[0]) throw new Error('Não foi possível iniciar o registro da sincronização.');
  return rows[0].id;
}

export async function finishSiprovSyncRun(
  id: number,
  status: 'success' | 'error',
  counts: { benefits: number; titles: number },
  error?: string
): Promise<void> {
  const sql = getDatabase();
  await sql`
    UPDATE siprov_sync_runs
    SET status = ${status}, benefit_count = ${counts.benefits}, title_count = ${counts.titles},
        error = ${error?.slice(0, 1000) ?? null}, finished_at = NOW()
    WHERE id = ${id}
  `;
}

async function ensureSiprovSyncSchema(sql: Sql): Promise<void> {
  globalSyncSchema.portalSyncSchema ??= sql
    .unsafe(`
    CREATE TABLE IF NOT EXISTS siprov_webhook_events (
      id BIGSERIAL PRIMARY KEY,
      event_key TEXT NOT NULL UNIQUE,
      event_type TEXT NOT NULL CHECK (event_type IN ('benefit', 'title')),
      history_code BIGINT,
      happened_at TIMESTAMPTZ,
      entity TEXT,
      payload JSONB NOT NULL,
      status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'processed', 'error')),
      error TEXT,
      received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      processed_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS siprov_webhook_events_status_idx
      ON siprov_webhook_events (status, received_at);

    CREATE TABLE IF NOT EXISTS siprov_benefits (
      siprov_id BIGINT PRIMARY KEY,
      person_id BIGINT,
      consultant_id BIGINT,
      representative_id BIGINT,
      status TEXT,
      registered_at TIMESTAMPTZ,
      joined_at TIMESTAMPTZ,
      activated_at TIMESTAMPTZ,
      raw JSONB NOT NULL,
      synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS siprov_benefits_consultant_idx
      ON siprov_benefits (consultant_id, activated_at);
    CREATE INDEX IF NOT EXISTS siprov_benefits_representative_idx
      ON siprov_benefits (representative_id, activated_at);

    CREATE TABLE IF NOT EXISTS siprov_financial_titles (
      siprov_id BIGINT PRIMARY KEY,
      person_id BIGINT,
      benefit_id BIGINT,
      title_type TEXT,
      status TEXT,
      issued_at TIMESTAMPTZ,
      due_at TIMESTAMPTZ,
      liquidated_at TIMESTAMPTZ,
      amount NUMERIC(14, 2),
      paid_amount NUMERIC(14, 2),
      net_amount NUMERIC(14, 2),
      raw JSONB NOT NULL,
      synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS siprov_financial_titles_due_idx
      ON siprov_financial_titles (due_at, status);

    CREATE TABLE IF NOT EXISTS siprov_sync_runs (
      id BIGSERIAL PRIMARY KEY,
      mode TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'error')),
      benefit_count INTEGER NOT NULL DEFAULT 0,
      title_count INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      finished_at TIMESTAMPTZ
    );
  `)
    .then(() => undefined)
    .catch((error) => {
      globalSyncSchema.portalSyncSchema = undefined;
      throw error;
    });
  return globalSyncSchema.portalSyncSchema;
}

async function upsertBenefitRows(sql: TransactionSql, records: SiprovRecord[]): Promise<number> {
  const rows = records.map(benefitRow).filter((row): row is BenefitRow => row !== null);
  await Promise.all(
    rows.map(
      (row) => sql`
        INSERT INTO siprov_benefits (
          siprov_id, person_id, consultant_id, representative_id, status,
          registered_at, joined_at, activated_at, raw
        ) VALUES (
          ${row.siprov_id}, ${row.person_id}, ${row.consultant_id}, ${row.representative_id},
          ${row.status}, ${row.registered_at}, ${row.joined_at}, ${row.activated_at},
          ${sql.json(row.raw)}
        )
        ON CONFLICT (siprov_id) DO UPDATE SET
          person_id = EXCLUDED.person_id,
          consultant_id = COALESCE(EXCLUDED.consultant_id, siprov_benefits.consultant_id),
          representative_id = COALESCE(EXCLUDED.representative_id, siprov_benefits.representative_id),
          status = EXCLUDED.status,
          registered_at = COALESCE(EXCLUDED.registered_at, siprov_benefits.registered_at),
          joined_at = COALESCE(EXCLUDED.joined_at, siprov_benefits.joined_at),
          activated_at = COALESCE(EXCLUDED.activated_at, siprov_benefits.activated_at),
          raw = EXCLUDED.raw,
          synced_at = NOW()
      `
    )
  );
  return rows.length;
}

async function upsertTitleRows(sql: TransactionSql, records: SiprovRecord[]): Promise<number> {
  const rows = records.map(titleRow).filter((row): row is TitleRow => row !== null);
  await Promise.all(
    rows.map(
      (row) => sql`
        INSERT INTO siprov_financial_titles (
          siprov_id, person_id, benefit_id, title_type, status, issued_at, due_at, liquidated_at,
          amount, paid_amount, net_amount, raw
        ) VALUES (
          ${row.siprov_id}, ${row.person_id}, ${row.benefit_id}, ${row.title_type}, ${row.status},
          ${row.issued_at}, ${row.due_at}, ${row.liquidated_at}, ${row.amount}, ${row.paid_amount},
          ${row.net_amount}, ${sql.json(row.raw)}
        )
        ON CONFLICT (siprov_id) DO UPDATE SET
          person_id = EXCLUDED.person_id,
          benefit_id = COALESCE(EXCLUDED.benefit_id, siprov_financial_titles.benefit_id),
          title_type = COALESCE(EXCLUDED.title_type, siprov_financial_titles.title_type),
          status = EXCLUDED.status,
          issued_at = COALESCE(EXCLUDED.issued_at, siprov_financial_titles.issued_at),
          due_at = COALESCE(EXCLUDED.due_at, siprov_financial_titles.due_at),
          liquidated_at = EXCLUDED.liquidated_at,
          amount = EXCLUDED.amount,
          paid_amount = EXCLUDED.paid_amount,
          net_amount = EXCLUDED.net_amount,
          raw = EXCLUDED.raw,
          synced_at = NOW()
      `
    )
  );
  return rows.length;
}

function benefitRow(record: SiprovRecord): BenefitRow | null {
  const id =
    positiveInteger(record.codBeneficio) ??
    positiveInteger(record.id) ??
    positiveInteger(record.sequencial);
  if (!id) return null;
  return {
    siprov_id: id,
    person_id: positiveInteger(record.codPessoa),
    consultant_id: positiveInteger(record.codConsultor),
    representative_id: positiveInteger(record.codRepresentante),
    status: text(record.nomeSituacao) ?? text(record.situacao) ?? text(record.status),
    registered_at: parseSiprovDate(record.dataCadastro),
    joined_at: parseSiprovDate(record.dataAdesao),
    activated_at: parseSiprovDate(record.dataAtivacao),
    raw: record
  };
}

function titleRow(record: SiprovRecord): TitleRow | null {
  const id = positiveInteger(record.codTitulo) ?? positiveInteger(record.id);
  if (!id) return null;
  return {
    siprov_id: id,
    person_id: positiveInteger(record.codPessoa),
    benefit_id: positiveInteger(record.codBeneficio),
    title_type: text(record.tipo) ?? text(record.entidade),
    status: text(record.nomeSituacao) ?? text(record.situacao) ?? text(record.status),
    issued_at: parseSiprovDate(record.dataEmissao),
    due_at: parseSiprovDate(record.dataVencimento),
    liquidated_at: parseSiprovDate(record.dataLiquidacao),
    amount: finiteNumber(record.valor),
    paid_amount: finiteNumber(record.valorPago) ?? finiteNumber(record.valorLiquidado),
    net_amount: finiteNumber(record.valorLiquido),
    raw: record
  };
}

function positiveInteger(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function finiteNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'string') {
    const normalized = value.includes(',') ? value.replace(/\./g, '').replace(',', '.') : value;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
