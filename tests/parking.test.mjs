import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateStay, clock, initialData, normalizePlate, readData, validPlate } from '../lib/parking.mjs';

test('normaliza y valida patentes de automóvil actuales y antiguas', () => {
  assert.equal(normalizePlate('bc-df 12'), 'BCDF12');
  assert.ok(validPlate('BCDF12'));
  assert.ok(validPlate('AB1234'));
  assert.ok(!validPlate('123456'));
  assert.ok(!validPlate('BCDF1'));
  assert.ok(!validPlate('AAAA12'));
});
test('cobra minutos iniciados sin cobrar un minuto extra en el límite exacto', () => {
  assert.deepEqual(calculateStay(0, 0, 35), { seconds: 0, minutes: 1, total: 35 });
  assert.equal(calculateStay(0, 60000, 35).total, 35);
  assert.equal(calculateStay(0, 60001, 35).total, 70);
  assert.equal(calculateStay(0, 61000, 35).total, 70);
  assert.equal(calculateStay(0, 3600000, 35).total, 2100);
  assert.equal(clock(3661), '01:01:01');
});
test('recupera sesión finalizada y comprobantes de forma consistente', () => {
  const session = { plate: 'BCDF12', parkingId: 'lastarria', startedAt: Date.now() - 120000, endedAt: Date.now() - 60000 };
  const data = { ...initialData(), plate: session.plate, session };
  assert.deepEqual(readData(JSON.stringify(data)), data);
  assert.deepEqual(readData(null), initialData());
  assert.throws(() => readData('{invalid'));
  assert.throws(() => readData(JSON.stringify({ ...data, session: { ...session, parkingId: 'invalid' } })));
  assert.throws(() => readData(JSON.stringify({ ...data, receipts: [{}] })));
});
