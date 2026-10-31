import test from 'node:test';
import assert from 'node:assert/strict';
import { calculate } from '../src/domain/calc.ts';

const sheet = [
  { price: 10, issued: 100, returned: 20 },
  { price: 15, issued: 100, returned: 10 },
  { price: 18, issued: 100, returned: 10 },
];

test('worked example from the handwritten sheet', () => {
  const r = calculate(sheet, [{ amount: 20, type: 'deduction' }, { amount: 200, type: 'deduction' }], 15, 9);
  assert.equal(r.gross, 3770);
  assert.equal(r.totalExpenses, 220);
  assert.equal(r.net, 3550);
  assert.equal(r.driver, 532.5);
  assert.equal(r.conductor, 319.5);
  assert.equal(r.owner, 2698);
});

test('additions increase the net', () => {
  const r = calculate(sheet, [{ amount: 100, type: 'addition' }, { amount: 50, type: 'deduction' }], 15, 9);
  assert.equal(r.totalExpenses, -50);
  assert.equal(r.net, 3820);
});

test('returned above issued never gives negative sales', () => {
  const r = calculate([{ price: 10, issued: 10, returned: 50 }], [], 15, 9);
  assert.equal(r.tickets[0].sold, 0);
  assert.equal(r.gross, 0);
});

test('a custom issue count and wages round to paise', () => {
  const r = calculate([{ price: 18, issued: 120, returned: 7 }], [], 15, 9);
  assert.equal(r.gross, 2034);
  assert.equal(r.driver, 305.1);
  assert.equal(r.conductor, 183.06);
  assert.equal(r.owner, 1545.84);
});

test('shares and owner always add back to net', () => {
  const r = calculate(sheet, [{ amount: 33.33, type: 'deduction' }], 15, 9);
  assert.equal(Math.round((r.driver + r.conductor + r.owner) * 100) / 100, r.net);
});
