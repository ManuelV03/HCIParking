'use client';

import { useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, CreditCard, MapPin, Plus, ReceiptText, Search, Ticket, Wallet } from 'lucide-react';
import { PARKINGS, balanceFor, dateTime, money, normalizePlate, validPlate } from '../../lib/parking.mjs';
import Modal from './modal';
import WalletDialog from './wallet';

export default function FinesView({ data, defaultPlate, heading, onConsult, onPay, onTopUp, onReceipt, paying }) {
  const [plate, setPlate] = useState(defaultPlate || '');
  const [shownPlate, setShownPlate] = useState(data.finesByPlate[defaultPlate] ? defaultPlate : '');
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [walletOpen, setWalletOpen] = useState(false);
  const results = useRef(null);
  const fines = data.finesByPlate[shownPlate] ?? [];
  const pending = fines.filter(f => f.status === 'pending');
  const visible = fines.filter(f => filter === 'all' || f.status === filter);
  const selected = fines.find(f => f.id === selectedId);
  const balance = balanceFor(data, shownPlate);
  const canUseBalance = Boolean(selected && balance >= selected.amount);
  const method = paymentMethod ?? (canUseBalance ? 'balance' : 'simulated');

  function consult(e) {
    e.preventDefault();
    if (!validPlate(plate)) { setError('Ingresa una patente válida: BCDF12 o AB1234.'); return; }
    if (onConsult(plate)) { setShownPlate(plate); setFilter('all'); setError(''); requestAnimationFrame(() => results.current?.focus()); }
  }

  return <>
    <div className="page-heading"><span className="eyebrow">TUS PAGOS, AL DÍA</span><h1 ref={heading} tabIndex={-1}>Tus multas</h1><p>Consulta las multas de tu patente y paga las pendientes.</p></div>
    <form className="fine-lookup" onSubmit={consult} noValidate>
      <label className="field-label" htmlFor="fine-plate">Patente a consultar</label>
      <div className="fine-lookup-controls"><input className="wallet-input wallet-plate" id="fine-plate" value={plate} autoCapitalize="characters" autoComplete="off" spellCheck={false} maxLength={8} placeholder="BCDF12" aria-invalid={Boolean(error)} aria-describedby={error ? 'fine-error' : undefined} onChange={e => { setPlate(normalizePlate(e.target.value)); setError(''); }}/><button className="primary" type="submit"><Search size={17}/>Consultar</button></div>
      {error && <p id="fine-error" className="field-error" role="alert">{error}</p>}
      {data.recentPlates.length > 0 && <fieldset className="fine-recent"><legend>Patentes recientes</legend>{data.recentPlates.map(value => <label key={value}><input type="radio" name="fine-recent" checked={plate === value} onChange={() => { setPlate(value); setError(''); }}/>{value}</label>)}</fieldset>}
    </form>
    {shownPlate ? <section className="fine-results" aria-label={`Multas de ${shownPlate}`}>
      <div className="fine-summary"><div><h2 ref={results} tabIndex={-1}>Patente {shownPlate}</h2><p>{pending.length === 0 ? 'No tienes multas pendientes.' : `${pending.length} multa pendiente de pago`}</p></div><div><span>Total pendiente</span><strong>{money(pending.reduce((total, f) => total + f.amount, 0))}</strong></div></div>
      <fieldset className="fine-filters"><legend className="sr-only">Filtrar multas</legend>{[['all', 'Todas', fines.length], ['pending', 'Pendientes', pending.length], ['paid', 'Pagadas', fines.length - pending.length]].map(([value, label, count]) => <label className={filter === value ? 'selected' : ''} key={value}><input type="radio" name="fine-filter" checked={filter === value} onChange={() => setFilter(value)}/><span>{label} <small>{count}</small></span></label>)}</fieldset>
      <div className="fine-list">{visible.map(fine => {
        const receipt = data.receipts.find(r => r.kind === 'fine' && r.fineId === fine.id && r.plate === shownPlate);
        return <article className="fine-item" key={fine.id}>
          <div className="fine-item-header"><span className={`fine-status ${fine.status}`}>{fine.status === 'paid' ? <CheckCircle2 size={15}/> : <Ticket size={15}/>}{fine.status === 'paid' ? 'Pagada' : 'No pagada'}</span><span>{fine.id}</span></div>
          <div className="fine-item-title"><h3>{fine.reason}</h3><strong>{money(fine.amount)}</strong></div>
          <p className="fine-location"><MapPin size={15}/>{PARKINGS.find(p => p.id === fine.parkingId).name}</p>
          <p className="fine-date">Fecha de emisión: {dateTime(fine.issuedAt)}</p>
          {fine.status === 'paid' ? <div className="fine-paid"><p>Pagada el {dateTime(fine.paidAt)}{!receipt && <span> · Pago de ejemplo</span>}</p>{receipt && <button className="text-button" onClick={() => onReceipt(receipt)}><ReceiptText size={16}/>Ver comprobante</button>}</div> : <button className="primary" disabled={paying} onClick={() => { setSelectedId(fine.id); setPaymentMethod(null); setError(''); }}>Pagar multa<ArrowRight size={18}/></button>}
        </article>;
      })}</div>
      {visible.length === 0 && <div className="fine-empty" role="status"><CheckCircle2 size={26}/><p>No hay multas en este estado.</p></div>}
    </section> : <div className="fine-empty"><Ticket size={32}/><h2>Consulta por patente</h2><p>Ingresa tu patente para revisar sus multas.</p></div>}
    <p className="fine-demo-note">Multas de prueba. Los motivos y montos son ficticios; no corresponden a infracciones reales.</p>
    {selected?.status === 'pending' && <Modal title="Pagar multa" busy={paying} onClose={() => { setSelectedId(null); setError(''); }}>
      <div className="modal-icon"><Ticket size={27}/></div><h2>Pagar multa</h2><p>{selected.reason}</p>
      <dl className="fine-payment-detail"><div><dt>Patente</dt><dd>{shownPlate}</dd></div><div><dt>N.º de multa</dt><dd>{selected.id}</dd></div><div><dt>Estacionamiento</dt><dd>{PARKINGS.find(p => p.id === selected.parkingId).name}</dd></div></dl>
      <div className="modal-summary"><span>Total a pagar</span><strong>{money(selected.amount)}</strong></div>
      <fieldset className="payment-options" disabled={paying}><legend>¿Cómo quieres pagar?</legend>
        <label className={`payment-choice ${method === 'balance' ? 'chosen' : ''}`}><input type="radio" name="fine-payment" checked={method === 'balance'} disabled={!canUseBalance} onChange={() => { setPaymentMethod('balance'); setError(''); }}/><Wallet size={22}/><span><strong>Usar saldo prepago</strong><small>{money(balance)} disponibles · {shownPlate}</small></span></label>
        {!canUseBalance ? <div className="balance-shortfall"><p>Te faltan {money(selected.amount - balance)} para pagar con saldo.</p><button type="button" onClick={() => { setPaymentMethod(null); setError(''); setWalletOpen(true); }}><Plus size={15}/>Recargar saldo</button></div> : method === 'balance' && <p className="balance-after">Después de pagar te quedarán <strong>{money(balance - selected.amount)}</strong>.</p>}
        <label className={`payment-choice ${method === 'simulated' ? 'chosen' : ''}`}><input type="radio" name="fine-payment" checked={method === 'simulated'} onChange={() => { setPaymentMethod('simulated'); setError(''); }}/><CreditCard size={22}/><span><strong>Pago de prueba</strong><small>Sin usar tu saldo ni ingresar datos bancarios</small></span></label>
      </fieldset>
      {error && <p className="field-error" role="alert">{error}</p>}
      <button className="primary" disabled={paying || (method === 'balance' && !canUseBalance)} onClick={async () => { setError(''); const result = await onPay(shownPlate, selected.id, method); if (!result) setError('No se confirmó el pago. Revisa el saldo y el estado de la multa antes de volver a intentarlo.'); }}>{paying ? 'Procesando pago de prueba…' : method === 'balance' ? `Pagar ${money(selected.amount)} con saldo` : `Simular pago de ${money(selected.amount)}`}{!paying && <ArrowRight size={18}/>}</button>
      <button className="text-button" disabled={paying} onClick={() => setSelectedId(null)}>Volver a mis multas</button><p className="microcopy">No se realizará ningún cobro real.</p>
    </Modal>}
    {walletOpen && selected?.status === 'pending' && <WalletDialog data={data} defaultPlate={shownPlate} lockedPlate={shownPlate} plateHint="Patente de esta multa." onTopUp={onTopUp} onClose={() => setWalletOpen(false)}/>}
  </>;
}
