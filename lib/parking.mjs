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
export const initialData = () => ({ version: 1, plate: '', session: null, receipts: [] });
function validSession(s) {
  return s && validPlate(s.plate) && PARKINGS.some(p => p.id === s.parkingId) && Number.isFinite(s.startedAt) && s.startedAt > 0 && s.startedAt <= Date.now() && (s.endedAt === null || (Number.isFinite(s.endedAt) && s.endedAt >= s.startedAt));
}
export function readData(raw) {
  if (!raw) return initialData();
  const data = JSON.parse(raw);
  if (data?.version !== 1 || !Array.isArray(data.receipts) || typeof data.plate !== 'string' || (data.session !== null && !validSession(data.session))) throw new Error('Datos guardados no válidos');
  if (data.receipts.some(r => !validSession(r) || !Number.isFinite(r.endedAt) || typeof r.id !== 'string' || !Number.isFinite(r.total) || !Number.isFinite(r.rate) || !Number.isFinite(r.minutes))) throw new Error('Comprobantes no válidos');
  return data;
}
