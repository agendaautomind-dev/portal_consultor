import assert from 'node:assert/strict';
import { test } from 'node:test';
import { uniqueActivatedBenefits } from './activation.ts';

test('conta somente benefícios ativados e remove repetições', () => {
  const benefits = uniqueActivatedBenefits([
    { codBeneficio: 10, dataCadastro: '01/11/2026' },
    { codBeneficio: 11, dataAtivacao: '05/11/2026' },
    { codBeneficio: 11, dataAtivacao: '05/11/2026' },
    { codBeneficio: 12, dataAtivacao: '2026-11-06' }
  ]);

  assert.deepEqual(
    benefits.map((item) => item.codBeneficio),
    [11, 12]
  );
});
