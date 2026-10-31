import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addBalance, balanceFor, calculateStay, clock, ensureFines, initialData, normalizePlate, paymentLabel, readData, rememberPlate, settleFine, settleSession, validPlate } from '../lib/parking.mjs';

test('normaliza y valida patentes de automóvil actuales y antiguas', () => {
  assert.equal(normalizePlate('bc-df 12'), 'BCDF12');
  assert.ok(validPlate('BCDF12'));
  assert.ok(validPlate('AB1234'));
  assert.ok(!validPlate('123456'));
  assert.ok(!validPlate('BCDF1'));
  assert.ok(!validPlate('AAAA12'));
});

const pendingSession = () => ({ plate: 'BCDF12', parkingId: 'lastarria', startedAt: Date.now() - 120000, endedAt: Date.now() - 60000 });

test('cada patente recibe una multa pagada y una pendiente una sola vez', () => {
  const original = initialData();
  const data = ensureFines(ensureFines(original, 'BCDF12'), 'AB1234');
  assert.equal(data.finesByPlate.BCDF12.length, 2);
  assert.deepEqual(data.finesByPlate.BCDF12.map(f => f.status), ['pending', 'paid']);
  assert.notEqual(data.finesByPlate.BCDF12[0].id, data.finesByPlate.AB1234[0].id);
  assert.equal(ensureFines(data, 'BCDF12'), data);
  assert.deepEqual(original.finesByPlate, {});
  assert.deepEqual(readData(JSON.stringify(data)), data);
  assert.throws(() => ensureFines(data, 'invalid'));
});

test('pago de multa guarda estado y comprobante sin modificar estadía, saldo ni otra patente', () => {
  const data = { ...ensureFines(ensureFines(addBalance(initialData(), 'BCDF12', 5000), 'BCDF12'), 'AB1234'), session: pendingSession() };
  const fine = data.finesByPlate.BCDF12[0];
  const next = settleFine(data, 'BCDF12', fine.id, 'PA-MULTA');
  assert.equal(next.finesByPlate.BCDF12[0].status, 'paid');
  assert.equal(next.receipts[0].kind, 'fine');
  assert.equal(next.receipts[0].fineId, fine.id);
  assert.equal(next.receipts[0].total, fine.amount);
  assert.deepEqual(next.session, data.session);
  assert.deepEqual(next.balances, data.balances);
  assert.deepEqual(next.finesByPlate.AB1234, data.finesByPlate.AB1234);
  assert.equal(data.finesByPlate.BCDF12[0].status, 'pending');
  const restored = readData(JSON.stringify(next));
  assert.deepEqual(restored, next);
  assert.equal(ensureFines(restored, 'BCDF12').finesByPlate.BCDF12[0].status, 'paid');
  assert.throws(() => settleFine(restored, 'BCDF12', fine.id, 'DUPLICADO'), /ya está pagada/);
  assert.throws(() => settleFine(data, 'AB1234', fine.id, 'OTRA'), /No encontramos/);
  assert.equal(restored.receipts.length, 1);
});

test('datos anteriores migran sin emitir multas y rechaza multas o comprobantes corruptos', () => {
  const legacy = { version: 1, plate: 'BCDF12', session: null, receipts: [] };
  assert.deepEqual(readData(JSON.stringify(legacy)).finesByPlate, {});
  const data = ensureFines(initialData(), 'BCDF12');
  const corrupt = structuredClone(data);
  corrupt.finesByPlate.BCDF12[0].amount = -1;
  assert.throws(() => readData(JSON.stringify(corrupt)));
  const paid = settleFine(data, 'BCDF12', data.finesByPlate.BCDF12[0].id, 'TEST');
  paid.receipts[0].total = -1;
  assert.throws(() => readData(JSON.stringify(paid)));
});

test('paga multa con saldo de su patente y persiste descuento y comprobante sin duplicarlo', () => {
  const data = { ...ensureFines(ensureFines(addBalance(addBalance(initialData(), 'BCDF12', 20000), 'AB1234', 30000), 'BCDF12'), 'AB1234'), session: pendingSession() };
  const fine = data.finesByPlate.AB1234[0];
  const next = settleFine(data, 'AB1234', fine.id, 'PREPAGO', Date.now(), 'balance');
  assert.equal(balanceFor(next, 'AB1234'), 15000);
  assert.equal(balanceFor(next, 'BCDF12'), 20000);
  assert.deepEqual(next.session, data.session);
  assert.equal(next.finesByPlate.AB1234[0].status, 'paid');
  assert.equal(next.finesByPlate.BCDF12[0].status, 'pending');
  assert.equal(next.receipts[0].paymentMethod, 'balance');
  assert.equal(next.receipts[0].balanceAfter, 15000);
  assert.deepEqual(readData(JSON.stringify(next)), next);
  assert.equal(balanceFor(data, 'AB1234'), 30000);
  assert.throws(() => settleFine(next, 'AB1234', fine.id, 'DUP', Date.now(), 'balance'), /ya está pagada/);
  assert.equal(next.receipts.length, 1);
});

test('multa con saldo insuficiente no descuenta ni se paga; saldo exacto llega a cero', () => {
  const data = ensureFines(addBalance(initialData(), 'BCDF12', 14999), 'BCDF12');
  const fine = data.finesByPlate.BCDF12[0];
  const snapshot = structuredClone(data);
  assert.throws(() => settleFine(data, 'BCDF12', fine.id, 'INSUFICIENTE', Date.now(), 'balance'), /saldo no alcanza/);
  assert.deepEqual(data, snapshot);
  const funded = addBalance(data, 'BCDF12', 1);
  const paid = settleFine(funded, 'BCDF12', fine.id, 'EXACTO', Date.now(), 'balance');
  assert.equal(balanceFor(paid, 'BCDF12'), 0);
  assert.equal(paid.receipts[0].balanceAfter, 0);
  const alternative = settleFine(funded, 'BCDF12', fine.id, 'ALTERNATIVO', Date.now(), 'simulated');
  assert.equal(balanceFor(alternative, 'BCDF12'), 15000);
  assert.equal(alternative.receipts[0].balanceAfter, undefined);
  assert.throws(() => settleFine(data, 'BCDF12', fine.id, 'INVALIDO', Date.now(), 'invalid'));
  paid.receipts[0].balanceAfter = -1;
  assert.throws(() => readData(JSON.stringify(paid)));
});

test('recuerda las últimas cinco patentes confirmadas, sin duplicados y por uso reciente', () => {
  const original = initialData();
  let data = original;
  for (const plate of ['AB1234', 'BCDF12', 'CD5678', 'GHJK34', 'EF9012', 'LPRS56']) data = rememberPlate(data, plate);
  assert.deepEqual(data.recentPlates, ['LPRS56', 'EF9012', 'GHJK34', 'CD5678', 'BCDF12']);
  data = rememberPlate(data, 'bc-df 12');
  assert.equal(data.plate, 'BCDF12');
  assert.deepEqual(data.recentPlates, ['BCDF12', 'LPRS56', 'EF9012', 'GHJK34', 'CD5678']);
  assert.deepEqual(readData(JSON.stringify(data)), data);
  assert.deepEqual(original.recentPlates, []);
  assert.throws(() => rememberPlate(data, 'invalid'));
});

test('recupera patentes anteriores por fecha y conserva saldo, sesión y comprobantes', () => {
  const session = pendingSession();
  const receipt = (plate, endedAt) => ({ ...session, plate, startedAt: endedAt - 60000, endedAt, total: 35, rate: 35, minutes: 1, id: plate });
  const legacy = { version: 1, plate: 'AB1234', session: null, balances: { BCDF12: 5000 }, receipts: [receipt('CD5678', session.startedAt - 120000), receipt('BCDF12', session.startedAt - 60000), receipt('AB1234', session.startedAt - 180000)] };
  const restored = readData(JSON.stringify(legacy));
  assert.deepEqual(restored.recentPlates, ['AB1234', 'BCDF12', 'CD5678']);
  assert.deepEqual(restored.balances, legacy.balances);
  assert.deepEqual(restored.receipts, legacy.receipts);
  assert.deepEqual(readData(JSON.stringify({ ...legacy, session })).recentPlates, ['BCDF12', 'AB1234', 'CD5678']);
  assert.throws(() => readData(JSON.stringify({ ...legacy, recentPlates: 'AB1234' })));
  assert.throws(() => readData(JSON.stringify({ ...legacy, recentPlates: ['invalid'] })));
});

test('migra datos antiguos sin perder sesión ni comprobantes', () => {
  const legacy = { version: 1, plate: 'BCDF12', session: pendingSession(), receipts: [] };
  const paidLegacy = { ...legacy.session, ...calculateStay(legacy.session.startedAt, legacy.session.endedAt, 35), rate: 35, id: 'OLD', paidAt: Date.now() };
  legacy.receipts = [paidLegacy];
  const restored = readData(JSON.stringify(legacy));
  assert.deepEqual(restored.session, legacy.session);
  assert.deepEqual(restored.receipts, legacy.receipts);
  assert.deepEqual(restored.balances, {});
  assert.equal(paymentLabel(restored.receipts[0]), 'Pago simulado');
});

test('recargas acumulables y saldos aislados por patente sobreviven a la persistencia', () => {
  const original = initialData();
  let data = addBalance(original, 'BCDF12', 5000);
  data = addBalance(data, 'BCDF12', 2000);
  data = addBalance(data, 'AB1234', 10000);
  data = readData(JSON.stringify(data));
  assert.equal(balanceFor(data, 'BCDF12'), 7000);
  assert.equal(balanceFor(data, 'AB1234'), 10000);
  assert.equal(balanceFor(data, 'CD5678'), 0);
  assert.deepEqual(original.balances, {});
  for (const invalid of [-1, 0, 1.5, NaN, Infinity, 100001]) assert.throws(() => addBalance(data, 'BCDF12', invalid));
  assert.throws(() => addBalance(data, '__proto__', 5000));
});

test('pagar con saldo descuenta solo a la patente de la sesión y guarda el comprobante', () => {
  const source = { ...addBalance(addBalance(initialData(), 'BCDF12', 5000), 'AB1234', 9000), session: pendingSession() };
  const paid = settleSession(source, 'balance', 'TEST-1', Date.now());
  assert.equal(paid.session, null);
  assert.equal(balanceFor(paid, 'BCDF12'), 5000 - paid.receipts[0].total);
  assert.equal(balanceFor(paid, 'AB1234'), 9000);
  assert.equal(paid.receipts[0].paymentMethod, 'balance');
  assert.equal(paid.receipts[0].balanceAfter, balanceFor(paid, 'BCDF12'));
  assert.equal(balanceFor(source, 'BCDF12'), 5000);
  assert.deepEqual(readData(JSON.stringify(paid)), paid);
  assert.throws(() => settleSession(paid, 'balance', 'TEST-2', Date.now()));
});

test('saldo insuficiente no modifica sesión, saldo ni comprobantes; permite pago alternativo', () => {
  const data = { ...addBalance(initialData(), 'BCDF12', 1), session: pendingSession() };
  const snapshot = structuredClone(data);
  assert.throws(() => settleSession(data, 'balance', 'TEST', Date.now()), /saldo no alcanza/);
  assert.deepEqual(data, snapshot);
  const paid = settleSession(data, 'simulated', 'TEST', Date.now());
  assert.equal(paid.receipts[0].paymentMethod, 'simulated');
  assert.equal(balanceFor(paid, 'BCDF12'), 1);
  const exact = { ...data, balances: { BCDF12: paid.receipts[0].total } };
  assert.equal(balanceFor(settleSession(exact, 'balance', 'EXACT', Date.now()), 'BCDF12'), 0);
});

test('rechaza saldos corruptos y comprobantes con descuentos inválidos', () => {
  for (const balances of [[], '5000', { BCDF12: -1 }, { BCDF12: 1.5 }, { BCDF12: '5000' }, { invalid: 5000 }]) {
    assert.throws(() => readData(JSON.stringify({ ...initialData(), balances })));
  }
  const paid = settleSession({ ...addBalance(initialData(), 'BCDF12', 5000), session: pendingSession() }, 'balance', 'TEST', Date.now());
  paid.receipts[0].balanceAfter = -1;
  assert.throws(() => readData(JSON.stringify(paid)));
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
