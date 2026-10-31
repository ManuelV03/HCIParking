export const STORAGE_KEY = 'pausa-parking-v1';
export const PARKINGS = [
  { id: 'lastarria', name: 'Barrio Lastarria', address: 'José Victorino Lastarria 70', area: 'Santiago Centro', rate: 35, tag: 'Al aire libre', code: 'P-001', spaces: 'Acceso por calle Lastarria', image: '/parking.svg' },
  { id: 'providencia', name: 'Plaza de la Aviación', address: 'Av. Providencia 111', area: 'Providencia', rate: 40, tag: 'Subterráneo', code: 'P-002', spaces: 'Acceso por Av. Providencia', image: '/parking.svg' },
  { id: 'bellas-artes', name: 'Bellas Artes', address: 'José Miguel de la Barra 455', area: 'Santiago Centro', rate: 30, tag: 'Techado', code: 'P-003', spaces: 'Acceso por José Miguel de la Barra', image: '/parking.svg' },
];
export const money = value => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value);
export const normalizePlate = value => value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
export const validPlate = value => /^(?:[A-Z]{2}\d{4}|[BCDFGHJKLPRSTVWXYZ]{4}\d{2})$/.test(value);
export const formatPlate = value => value.length === 6 ? `${value.slice(0, 2)}·${value.slice(2, 4)}·${value.slice(4)}` : value;
export function calculateStay(startedAt, endedAt, rate) {
  const seconds = Math.max(0, Math.floor((endedAt - startedAt) / 1000));
  const minutes = Math.max(1, Math.ceil(Math.max(0, endedAt - startedAt) / 60000));
  return { seconds, minutes, total: minutes * rate };
}
export function clock(seconds) {
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(v => String(v).padStart(2, '0')).join(':');
}
export const dateTime = value => new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Santiago' }).format(new Date(value));
export const timeOnly = value => new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Santiago' }).format(new Date(value));
export const initialData = () => ({ version: 1, plate: '', session: null, receipts: [], balances: {}, recentPlates: [], finesByPlate: {} });
export function rememberPlate(data, value) {
  const plate = normalizePlate(value);
  if (!validPlate(plate)) throw new Error('Ingresa una patente válida: BCDF12 o AB1234.');
  return { ...data, plate, recentPlates: [plate, ...(data.recentPlates ?? []).filter(previous => previous !== plate)].slice(0, 5) };
}
export const balanceFor = (data, plate) => data.balances?.[plate] ?? 0;
export const paymentLabel = receipt => receipt.paymentMethod === 'balance' ? 'Saldo prepago (simulado)' : 'Pago simulado';

export function ensureFines(data, plate, now = Date.now()) {
  if (!validPlate(plate)) throw new Error('Ingresa una patente válida: BCDF12 o AB1234.');
  if (data.finesByPlate?.[plate]) return data;
  const day = 86400000;
  const fines = [
    { id: `MU-${plate}-01`, plate, parkingId: 'lastarria', reason: 'Estadía sin registro de inicio', amount: 15000, issuedAt: now - 7 * day, status: 'pending', paidAt: null, paymentReference: null },
    { id: `MU-${plate}-02`, plate, parkingId: 'bellas-artes', reason: 'Tiempo autorizado excedido', amount: 10000, issuedAt: now - 14 * day, status: 'paid', paidAt: now - 13 * day, paymentReference: `EJEMPLO-${plate}` },
  ];
  return { ...data, finesByPlate: { ...data.finesByPlate, [plate]: fines } };
}

export function settleFine(data, plate, fineId, paymentReference, paidAt = Date.now(), method = 'simulated') {
  const fines = data.finesByPlate?.[plate];
  const fine = fines?.find(fine => fine.id === fineId);
  if (!fine) throw new Error('No encontramos esta multa para la patente indicada.');
  if (fine.status === 'paid') throw new Error('Esta multa ya está pagada.');
  if (!['balance', 'simulated'].includes(method)) throw new Error('Selecciona un medio de pago.');
  const balance = balanceFor(data, plate);
  if (method === 'balance' && balance < fine.amount) throw new Error('El saldo no alcanza. Recarga o elige el pago de prueba.');
  const receipt = { kind: 'fine', id: paymentReference, plate, parkingId: fine.parkingId, fineId, reason: fine.reason, issuedAt: fine.issuedAt, total: fine.amount, paidAt, paymentMethod: method };
  let balances = data.balances;
  if (method === 'balance') {
    receipt.balanceAfter = balance - fine.amount;
    balances = { ...balances, [plate]: receipt.balanceAfter };
  }
  return { ...data, balances, finesByPlate: { ...data.finesByPlate, [plate]: fines.map(item => item.id === fineId ? { ...item, status: 'paid', paidAt, paymentReference } : item) }, receipts: [receipt, ...data.receipts] };
}

function validFineReceipt(r) {
  return r && r.kind === 'fine' && validPlate(r.plate) && PARKINGS.some(p => p.id === r.parkingId) && typeof r.id === 'string' && typeof r.fineId === 'string' && typeof r.reason === 'string' && Number.isSafeInteger(r.total) && r.total > 0 && Number.isFinite(r.issuedAt) && r.issuedAt > 0 && Number.isFinite(r.paidAt) && r.paidAt >= r.issuedAt && ['balance', 'simulated'].includes(r.paymentMethod);
}

export function addBalance(data, plate, amount) {
  if (!validPlate(plate)) throw new Error('Ingresa una patente válida: BCDF12 o AB1234.');
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 100000) throw new Error('Ingresa un monto entero entre $1 y $100.000.');
  const balance = balanceFor(data, plate) + amount;
  if (!Number.isSafeInteger(balance)) throw new Error('El saldo supera el límite permitido.');
  return { ...data, balances: { ...data.balances, [plate]: balance } };
}

export function settleSession(data, method, id, paidAt) {
  const session = data.session;
  if (!session?.endedAt) throw new Error('Esta estadía no tiene un pago pendiente.');
  if (!['balance', 'simulated'].includes(method)) throw new Error('Selecciona un medio de pago.');
  const parking = PARKINGS.find(p => p.id === session.parkingId);
  const stay = calculateStay(session.startedAt, session.endedAt, parking.rate);
  const balance = balanceFor(data, session.plate);
  if (method === 'balance' && balance < stay.total) throw new Error('El saldo no alcanza. Recarga o elige el pago de prueba.');
  const receipt = { ...session, ...stay, rate: parking.rate, id, paidAt, paymentMethod: method };
  let balances = data.balances;
  if (method === 'balance') {
    receipt.balanceAfter = balance - stay.total;
    balances = { ...balances, [session.plate]: receipt.balanceAfter };
  }
  // Una sola escritura posterior guarda el descuento, el comprobante y el cierre.
  return { ...data, balances, session: null, receipts: [receipt, ...data.receipts] };
}
function validSession(s) {
  return s && validPlate(s.plate) && PARKINGS.some(p => p.id === s.parkingId) && Number.isFinite(s.startedAt) && s.startedAt > 0 && s.startedAt <= Date.now() && (s.endedAt === null || (Number.isFinite(s.endedAt) && s.endedAt >= s.startedAt));
}
export function readData(raw) {
  if (!raw) return initialData();
  const data = JSON.parse(raw);
  if (data?.version !== 1 || !Array.isArray(data.receipts) || typeof data.plate !== 'string' || (data.session !== null && !validSession(data.session))) throw new Error('Datos guardados no válidos');
  if (data.receipts.some(r => r?.kind === 'fine' ? !validFineReceipt(r) : !validSession(r) || !Number.isFinite(r.endedAt) || typeof r.id !== 'string' || !Number.isFinite(r.total) || !Number.isFinite(r.rate) || !Number.isFinite(r.minutes))) throw new Error('Comprobantes no válidos');
  const balances = data.balances ?? {};
  if (typeof balances !== 'object' || Array.isArray(balances) || Object.entries(balances).some(([plate, amount]) => !validPlate(plate) || !Number.isSafeInteger(amount) || amount < 0)) throw new Error('Saldos guardados no válidos');
  if (data.receipts.some(r => (r.paymentMethod !== undefined && !['balance', 'simulated'].includes(r.paymentMethod)) || (r.paymentMethod === 'balance' && (!Number.isSafeInteger(r.balanceAfter) || r.balanceAfter < 0)))) throw new Error('Medios de pago guardados no válidos');
  if (data.recentPlates !== undefined && (!Array.isArray(data.recentPlates) || data.recentPlates.some(plate => typeof plate !== 'string' || !validPlate(plate)))) throw new Error('Patentes recientes no válidas');
  // Recupera patentes del historial anterior sin alterar sus pagos o saldos.
  const previousPlates = data.recentPlates ?? [data.session?.plate, data.plate, ...[...data.receipts].sort((a, b) => (b.endedAt ?? b.paidAt) - (a.endedAt ?? a.paidAt)).map(receipt => receipt.plate)];
  const recentPlates = [...new Set(previousPlates.filter(plate => typeof plate === 'string' && validPlate(plate)))].slice(0, 5);
  const finesByPlate = data.finesByPlate ?? {};
  if (typeof finesByPlate !== 'object' || Array.isArray(finesByPlate) || Object.entries(finesByPlate).some(([plate, fines]) => !validPlate(plate) || !Array.isArray(fines) || fines.length !== 2 || new Set(fines.map(f => f?.id)).size !== 2 || fines.some(f => !f || f.plate !== plate || typeof f.id !== 'string' || typeof f.reason !== 'string' || !PARKINGS.some(p => p.id === f.parkingId) || !Number.isSafeInteger(f.amount) || f.amount <= 0 || !Number.isFinite(f.issuedAt) || f.issuedAt <= 0 || !['paid', 'pending'].includes(f.status) || (f.status === 'paid' ? !Number.isFinite(f.paidAt) || f.paidAt < f.issuedAt || typeof f.paymentReference !== 'string' : f.paidAt !== null || f.paymentReference !== null)))) throw new Error('Multas guardadas no válidas');
  return { ...data, balances, recentPlates, finesByPlate };
}
