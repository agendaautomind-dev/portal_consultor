import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveConsultantPeriod } from './period.ts';

const today = new Date(2026, 10, 14);

test('resolve a competência solicitada e os seis meses do gráfico', () => {
  const period = resolveConsultantPeriod('2026-08', today);

  assert.equal(period.key, '2026-08');
  assert.equal(period.start.getDate(), 1);
  assert.equal(period.end.getDate(), 31);
  assert.equal(period.historyStart.getMonth(), 2);
});

test('não aceita competência futura', () => {
  assert.equal(resolveConsultantPeriod('2026-12', today).key, '2026-11');
});
