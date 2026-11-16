import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseSiprovWebhook, secretMatches } from './webhook.ts';

test('normaliza e identifica o gatilho pelo histórico', () => {
  const event = parseSiprovWebhook(
    'title',
    JSON.stringify({
      codHistorico: 12345,
      dataHistorico: '2026-11-16T12:30:00.000Z',
      entidade: 'Crédito',
      objeto: { id: 99, valor: 150 }
    })
  );

  assert.equal(event.eventKey, 'title:12345');
  assert.equal(event.object.id, 99);
  assert.equal(event.happenedAt?.toISOString(), '2026-11-16T12:30:00.000Z');
});

test('rejeita segredo curto e aceita somente correspondência exata', () => {
  const secret = '12345678901234567890123456789012';
  assert.equal(secretMatches(secret, secret), true);
  assert.equal(secretMatches(`${secret}x`, secret), false);
  assert.equal(secretMatches('curto', 'curto'), false);
});
