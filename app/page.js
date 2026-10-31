'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronRight, Clock3, CarFront, CreditCard, Download, HelpCircle, MapPin, Navigation, ParkingCircle, Plus, ReceiptText, Search, ShieldCheck, Sparkles, Ticket, Wallet, X } from 'lucide-react';
import { PARKINGS, STORAGE_KEY, addBalance, balanceFor, calculateStay, clock, dateTime, ensureFines, formatPlate, initialData, money, normalizePlate, paymentLabel, readData, rememberPlate, settleFine, settleSession, timeOnly, validPlate } from '../lib/parking.mjs';
import FinesView from './components/fines';
import Modal from './components/modal';
import WalletDialog from './components/wallet';

export default function Home() {
  const [data, setData] = useState(initialData);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState('parking');
  const [step, setStep] = useState(0);
  const [plate, setPlate] = useState('');
  const [parkingId, setParkingId] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [storageError, setStorageError] = useState('');
  const [now, setNow] = useState(Date.now());
  const [dialog, setDialog] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [paying, setPaying] = useState(false);
  const [help, setHelp] = useState(false);
  const [wallet, setWallet] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [paymentError, setPaymentError] = useState('');
  const [finesPlate, setFinesPlate] = useState('');
  const heading = useRef(null);
  const lock = useRef(false);
  const storageBlocked = useRef(false);
  const latest = useRef(data);

  useEffect(() => {
    try {
      const saved = readData(localStorage.getItem(STORAGE_KEY));
      latest.current = saved; setData(saved); setPlate(saved.plate);
    } catch { storageBlocked.current = true; setStorageError('No pudimos abrir los datos guardados. Revisa el almacenamiento del navegador y recarga antes de continuar.'); }
    setReady(true);
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const sync = event => {
      if (event.key !== STORAGE_KEY) return;
      try { const next = readData(event.newValue); latest.current = next; setData(next); setPlate(next.plate); setNow(Date.now()); setReceipt(null); }
      catch { storageBlocked.current = true; setStorageError('Los datos cambiaron en otra pestaña. Recarga para continuar.'); }
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  useEffect(() => { if (ready) heading.current?.focus(); }, [step, tab, receipt, data.session?.endedAt, Boolean(data.session)]);

  function commit(next) {
    if (storageBlocked.current) return false;
    try {
      const currentRaw = localStorage.getItem(STORAGE_KEY);
      if (JSON.stringify(readData(currentRaw)) !== JSON.stringify(latest.current)) {
        const current = readData(currentRaw); latest.current = current; setData(current);
        setStorageError('Tus datos cambiaron en otra pestaña. Revisa el estado actualizado y vuelve a intentarlo.'); return false;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      latest.current = next; setData(next); setStorageError(''); return true;
    } catch { setStorageError('No pudimos guardar los cambios. Habilita el almacenamiento de este navegador y vuelve a intentarlo.'); return false; }
  }

  const session = data.session;
  const selected = PARKINGS.find(p => p.id === (session?.parkingId || parkingId));
  const stay = session ? calculateStay(session.startedAt, session.endedAt ?? now, selected.rate) : null;
  const walletPlate = session?.plate || (validPlate(plate) ? plate : data.plate);
  const balance = balanceFor(data, walletPlate);
  const canUseBalance = Boolean(stay && balance >= stay.total);
  const method = paymentMethod ?? (canUseBalance ? 'balance' : 'simulated');
  const filtered = PARKINGS.filter(p => `${p.name} ${p.address} ${p.area} ${p.code}`.toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es')));

  function submitPlate(e) {
    e.preventDefault();
    if (!validPlate(plate)) { setError('Ingresa una patente válida: BCDF12 o AB1234.'); return; }
    if (commit(rememberPlate(data, plate))) { setError(''); setStep(1); }
  }
  function startStay() {
    if (latest.current.session || !validPlate(plate) || !selected) return;
    const startedAt = Date.now();
    if (commit({ ...data, plate, session: { plate, parkingId, startedAt, endedAt: null } })) { setNow(startedAt); setDialog(null); setPaymentMethod(null); setPaymentError(''); }
  }
  function finishStay() {
    if (commit({ ...data, session: { ...session, endedAt: Date.now() } })) { setDialog(null); setPaymentMethod(null); setPaymentError(''); }
  }
  function resumeStay() {
    if (commit({ ...data, session: { ...session, endedAt: null } })) setNow(Date.now());
  }
  async function pay() {
    if (lock.current || !session?.endedAt) return;
    lock.current = true; setPaying(true); setPaymentError('');
    await new Promise(resolve => setTimeout(resolve, 1200));
    const current = latest.current;
    if (current.session?.endedAt !== session.endedAt || current.session?.startedAt !== session.startedAt) { setPaying(false); lock.current = false; return; }
    try {
      const next = settleSession(current, method, `PA-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, Date.now());
      if (commit(next)) { setReceipt(next.receipts[0]); setStep(0); setPaymentMethod(null); }
    } catch (error) { setPaymentError(error.message); }
    finally { setPaying(false); lock.current = false; }
  }
  function topUp(targetPlate, amount, selectPlate = true) {
    if (lock.current) return false;
    const next = addBalance(latest.current, targetPlate, amount);
    if (!session && selectPlate) next.plate = targetPlate;
    if (!commit(next)) return false;
    if (!session && selectPlate) setPlate(targetPlate);
    if (targetPlate === session?.plate) { setPaymentMethod(balanceFor(next, targetPlate) >= stay.total ? 'balance' : null); setPaymentError(''); }
    return true;
  }
  function downloadReceipt(r) {
    const p = PARKINGS.find(p => p.id === r.parkingId);
    const text = r.kind === 'fine' ? `PAUSA | COMPROBANTE DE PAGO DE MULTA SIMULADA\n${r.id}\n\nEstado: Pagada (simulación)\nN.º de multa: ${r.fineId}\nPatente: ${r.plate}\nMotivo: ${r.reason}\nEstacionamiento: ${p.name}\nFecha de emisión: ${dateTime(r.issuedAt)}\nFecha de pago: ${dateTime(r.paidAt)}\nTotal: ${money(r.total)} CLP\nMedio de pago: ${paymentLabel(r)}${r.paymentMethod === 'balance' ? `\nSaldo después del pago: ${money(r.balanceAfter)} CLP` : ''}\n\nMulta ficticia. Sin cobro real ni validez tributaria.` : `PAUSA | COMPROBANTE DE PAGO SIMULADO\n${r.id}\n\nEstado: Pagado (simulación)\nEstacionamiento: ${p.name}\nDirección: ${p.address}\nPatente: ${r.plate}\nIngreso: ${dateTime(r.startedAt)}\nSalida: ${dateTime(r.endedAt)}\nTiempo: ${clock(r.seconds)}\nMinutos cobrados: ${r.minutes}\nTarifa: ${money(r.rate)} por minuto iniciado\nTotal: ${money(r.total)} CLP\nMedio de pago: ${paymentLabel(r)}${r.paymentMethod === 'balance' ? `\nSaldo después del pago: ${money(r.balanceAfter)} CLP` : ''}\n\nEste comprobante corresponde a una prueba y no tiene validez tributaria. No se realizó ningún cobro real.`;
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `${r.id}.txt`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function goParking() { setTab('parking'); setReceipt(null); }
  function consultFines(targetPlate) {
    const current = latest.current;
    const next = ensureFines(current, targetPlate);
    if (next !== current && !commit(next)) return false;
    setFinesPlate(targetPlate);
    return true;
  }
  function openFines() {
    const target = receipt?.kind === 'fine' ? receipt.plate : validPlate(walletPlate) ? walletPlate : finesPlate;
    if (validPlate(target) && !consultFines(target)) return;
    setTab('fines'); setReceipt(null);
  }
  async function payFine(targetPlate, fineId, method) {
    if (lock.current) return false;
    lock.current = true; setPaying(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1200));
      const next = settleFine(latest.current, targetPlate, fineId, `PA-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, Date.now(), method);
      if (!commit(next)) return false;
      setReceipt(next.receipts[0]);
      return true;
    } catch (error) { setStorageError(error.message); return false; }
    finally { lock.current = false; setPaying(false); }
  }

  return <div className="app-shell">
    <a href="#main" className="skip-link">Ir al contenido</a>
    <header className="header"><div className="header-inner">
      <button className="brand" onClick={goParking} aria-label="Pausa, inicio"><span className="brand-symbol"><span /><span /></span>pausa<span className="brand-dot">.</span></button>
      <span className="header-tagline">Tu tiempo, bien estacionado.</span>
      <div className="header-right"><span className="demo-badge"><span /> Modo prueba</span><button className="icon-button" aria-label="Ayuda" title="Ayuda" onClick={() => setHelp(true)}><HelpCircle size={21} /></button></div>
    </div></header>

    <div className="workspace">
      <nav className="tabs" aria-label="Navegación principal">
        <button className={tab === 'parking' ? 'tab active' : 'tab'} onClick={goParking} aria-current={tab === 'parking' ? 'page' : undefined}><CarFront size={19} /><span className="nav-label-wide">Mi estacionamiento</span><span className="nav-label-compact">Estacionar</span>{session && <span className="nav-dot" />}</button>
        <button className={`tab tab-receipts ${tab === 'receipts' ? 'active' : ''}`} onClick={() => { setTab('receipts'); setReceipt(null); }} aria-current={tab === 'receipts' ? 'page' : undefined}><ReceiptText size={19} />Comprobantes{data.receipts.length > 0 && <span className="count">{data.receipts.length}</span>}</button>
        <button className={tab === 'fines' ? 'tab active' : 'tab'} onClick={openFines} aria-current={tab === 'fines' ? 'page' : undefined}><Ticket size={19}/>Multas</button>
      </nav>
      {ready && <button className="balance-bar" disabled={paying} onClick={() => setWallet(true)} aria-label={validPlate(walletPlate) ? `Saldo prepago de ${walletPlate}: ${money(balance)}. Recargar` : 'Consultar o recargar saldo prepago'}><Wallet size={20}/><span><strong>Saldo prepago{validPlate(walletPlate) ? ` · ${walletPlate}` : ''}</strong><small>{validPlate(walletPlate) ? 'Disponible para tus estadías' : 'Asocia saldo a tu patente'}</small></span>{validPlate(walletPlate) && <b>{money(balance)}</b>}<span className="balance-action"><Plus size={16}/><span>Recargar</span></span></button>}
      {storageError && <div className="error-banner" role="alert">{storageError}<button onClick={() => location.reload()}>Recargar</button></div>}
      {session && tab !== 'parking' && <button className="live-banner" onClick={goParking}><span className="live-dot" />{session.endedAt ? 'Tienes un pago pendiente' : `Estadía en curso · ${clock(stay.seconds)}`}<strong>{money(stay.total)}</strong><ChevronRight size={18}/></button>}

      <main id="main" className="main">
        {!ready ? <div className="loading" role="status">Preparando tu estacionamiento…</div> : receipt ? <ReceiptView receipt={receipt} heading={heading} onDownload={downloadReceipt} onBack={() => { setReceipt(null); setTab('receipts'); }} onNew={receipt.kind === 'fine' ? openFines : goParking} /> : tab === 'fines' ? <FinesView data={data} defaultPlate={finesPlate} heading={heading} onConsult={consultFines} onPay={payFine} onTopUp={(target, amount) => topUp(target, amount, false)} onReceipt={setReceipt} paying={paying}/> : tab === 'receipts' ? <>
          <div className="page-heading"><span className="eyebrow">TODO EN ORDEN</span><h1 ref={heading} tabIndex={-1}>Tus comprobantes</h1><p>La tranquilidad de saber que ya pagaste.</p></div>
          {data.receipts.length === 0 ? <div className="empty-state"><div className="empty-icon"><ReceiptText size={34}/></div><h2>Aquí quedarán tus pagos</h2><p>Cuando termines tu primera estadía, encontrarás su comprobante en este lugar.</p><button className="primary" onClick={goParking}>Ir a estacionar<ArrowRight size={18}/></button></div> : <div className="receipt-list">{data.receipts.map(r => <button className="receipt-row" key={r.id} onClick={() => setReceipt(r)}><span className="receipt-icon"><ReceiptText size={23}/></span><span className="receipt-row-info"><strong>{r.kind === 'fine' ? 'Multa · ' : ''}{PARKINGS.find(p => p.id === r.parkingId).name}</strong><span>{dateTime(r.kind === 'fine' ? r.paidAt : r.endedAt)}</span><span className="small-plate">{r.plate}</span></span><span className="receipt-row-amount"><strong>{money(r.total)}</strong><span><Check size={13}/> Pagado</span></span><ChevronRight size={20}/></button>)}</div>}
        </> : session ? <>
          <div className="page-heading"><span className="eyebrow">{session.endedAt ? 'UN ÚLTIMO PASO' : 'DISFRUTA TU TIEMPO'}</span><h1 ref={heading} tabIndex={-1}>{session.endedAt ? 'Todo listo para pagar' : 'Tu estadía, bajo control'}</h1><p>{session.endedAt ? 'Revisa el detalle y confirma tu pago.' : 'Sigue con tu día. Aquí llevamos la cuenta.'}</p></div>
          <div className="content-grid"><section className="stay-panel">
            <div className="panel-top"><span className={session.endedAt ? 'status pending' : 'status'}><span />{session.endedAt ? 'Pago pendiente' : 'Estadía en curso'}</span><span className="plate-small"><CarFront size={16}/>{session.plate}</span></div>
            <div className="session-location"><MapPin size={17}/><span><strong>{selected.name}</strong><small>{selected.address} · {selected.code}</small></span></div>
            <div className="timer-block"><span className="field-label">{session.endedAt ? 'Tiempo total estacionado' : 'Tiempo estacionado'}</span><div className="timer" aria-label={`Tiempo estacionado ${clock(stay.seconds)}`}>{clock(stay.seconds)}</div><div className="timer-units"><span>HORAS</span><span>MINUTOS</span><span>SEGUNDOS</span></div></div>
            <div className="cost-block"><span>{session.endedAt ? 'Total a pagar' : 'Costo acumulado'}</span><div><strong>{money(stay.total)}</strong><span>CLP</span></div><small>{money(selected.rate)} por minuto iniciado · {stay.minutes} {stay.minutes === 1 ? 'minuto cobrado' : 'minutos cobrados'}</small></div>
            <div className="session-details"><span><Clock3 size={17}/>Ingreso<strong>{timeOnly(session.startedAt)}</strong></span>{session.endedAt && <span><CheckCircle2 size={17}/>Finalización<strong>{timeOnly(session.endedAt)}</strong></span>}</div>
            {session.endedAt ? <><div className="inline-note"><ShieldCheck size={18}/><span>Tu tiempo se detuvo. El monto está confirmado.</span></div>
              <fieldset className="payment-options" disabled={paying}><legend>¿Cómo quieres pagar?</legend>
                <label className={`payment-choice ${method === 'balance' ? 'chosen' : ''}`}><input type="radio" name="payment" value="balance" checked={method === 'balance'} disabled={!canUseBalance} onChange={() => { setPaymentMethod('balance'); setPaymentError(''); }}/><Wallet size={22}/><span><strong>Usar saldo prepago</strong><small>{money(balance)} disponibles · {session.plate}</small></span></label>
                {!canUseBalance ? <div className="balance-shortfall"><p>Te faltan {money(Math.max(0, stay.total - balance))} para pagar con saldo.</p><button type="button" disabled={paying} onClick={() => setWallet(true)}><Plus size={15}/>Recargar saldo</button></div> : method === 'balance' && <p className="balance-after">Después de pagar te quedarán <strong>{money(balance - stay.total)}</strong>.</p>}
                <label className={`payment-choice ${method === 'simulated' ? 'chosen' : ''}`}><input type="radio" name="payment" value="simulated" checked={method === 'simulated'} onChange={() => { setPaymentMethod('simulated'); setPaymentError(''); }}/><CreditCard size={22}/><span><strong>Pago de prueba</strong><small>Sin usar tu saldo ni ingresar datos bancarios</small></span></label>
              </fieldset>
              {paymentError && <p className="field-error" role="alert">{paymentError}</p>}
              <button className="primary" disabled={paying || (method === 'balance' && !canUseBalance)} onClick={pay}>{paying ? 'Procesando pago de prueba…' : method === 'balance' ? `Pagar ${money(stay.total)} con saldo` : `Simular pago de ${money(stay.total)}`}{!paying && <ArrowRight size={19}/>}</button><button className="text-button" disabled={paying} onClick={resumeStay}>Volver a mi estadía</button><p className="microcopy">Al volver, se incluirá todo el tiempo desde el ingreso.</p></> : <><button className="primary" onClick={() => setDialog('finish')}>Finalizar y pagar<ArrowRight size={19}/></button><p className="microcopy">El tiempo se detiene al confirmar la finalización.</p></>}
          </section><aside className="side-column"><ParkingSummary parking={selected}/><div className="reassurance"><ShieldCheck size={21}/><div><strong>{session.endedAt ? 'Solo una simulación' : 'Puedes cerrar esta página'}</strong><p>{session.endedAt ? 'Este pago no realizará ningún cobro real. Tu comprobante quedará guardado.' : 'Tu estadía sigue activa y se recuperará cuando vuelvas en este navegador.'}</p></div></div></aside></div>
        </> : <>
          <div className="page-heading"><span className="eyebrow">LLEGASTE. AHORA, RELÁJATE.</span><h1 ref={heading} tabIndex={-1}>{step === 0 ? 'Estaciona. Sigue con tu día.' : step === 1 ? '¿Dónde estacionaste?' : 'Todo claro, antes de empezar.'}</h1><p>{step === 0 ? 'Tu estacionamiento, sin vueltas y sin tickets de papel.' : step === 1 ? 'Elige el lugar en el que se encuentra tu vehículo.' : 'Revisa tu patente, el lugar y la tarifa de tu estadía.'}</p></div>
          <ol className="stepper" aria-label="Progreso">{['Tu patente', 'El lugar', 'Iniciar estadía'].map((label, i) => <li key={label} className={i === step ? 'current' : i < step ? 'complete' : ''} aria-current={i === step ? 'step' : undefined}><span>{i < step ? <Check size={14}/> : `0${i + 1}`}</span><span>{label}</span></li>)}</ol>
          <div className="content-grid"><section className="flow-panel" key={step}>
            {step === 0 ? <form onSubmit={submitPlate} noValidate><div className="section-icon"><CarFront size={24}/></div><h2>Partamos por tu patente</h2><p className="section-copy">Así identificamos tu vehículo durante la estadía.</p><RecentPlates plates={data.recentPlates} plate={plate} onSelect={value => { setPlate(value); setError(''); }}/><label className="field-label" htmlFor="plate">Patente de tu vehículo</label><div className={`plate-input ${error ? 'invalid' : ''}`}><div className="plate-country">CHILE<span>•••</span></div><input id="plate" autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="BCDF12" maxLength={8} value={plate} onChange={e => { setPlate(normalizePlate(e.target.value)); setError(''); }} aria-invalid={Boolean(error)} aria-describedby={error ? 'plate-error' : 'plate-hint'}/><CarFront size={25}/></div>{error ? <p className="field-error" id="plate-error" role="alert">{error}</p> : <p className="field-hint" id="plate-hint">Sin espacios ni guion. Ejemplo: BCDF12 o AB1234.</p>}<button className="primary" type="submit">Continuar<ArrowRight size={19}/></button><div className="private-note"><ShieldCheck size={16}/><span>Sin crear una cuenta. Solo tu patente.</span></div></form> : step === 1 ? <><button className="back-button" onClick={() => setStep(0)}><ArrowLeft size={16}/>Tu patente · {plate}</button><h2>Encuentra tu estacionamiento</h2><div className="search-field"><Search size={19}/><input aria-label="Buscar estacionamiento" placeholder="Buscar por nombre, dirección o código" value={query} onChange={e => setQuery(e.target.value)}/>{query && <button className="icon-button" aria-label="Limpiar búsqueda" onClick={() => setQuery('')}><X size={16}/></button>}</div><div className="list-label"><span>ESTACIONAMIENTOS</span><span>{filtered.length} disponibles</span></div><fieldset className="parking-list"><legend className="sr-only">Selecciona un estacionamiento</legend>{filtered.map(p => <label key={p.id} className={`parking-option ${parkingId === p.id ? 'selected' : ''}`}><input type="radio" name="parking" value={p.id} checked={parkingId === p.id} onChange={() => setParkingId(p.id)}/><span className="parking-pin"><MapPin size={21}/></span><span className="parking-option-info"><strong>{p.name}</strong><span>{p.address}</span><small>{p.area} · {p.code}</small><span className="option-rate">{money(p.rate)}<small> / min</small></span></span><span className="radio-mark">{parkingId === p.id && <span/>}</span></label>)}</fieldset>{filtered.length === 0 && <div className="no-results"><Search size={26}/><strong>No encontramos ese lugar</strong><p>Prueba con otro nombre, dirección o código.</p><button className="text-button" onClick={() => setQuery('')}>Ver todos</button></div>}<button className="primary" disabled={!parkingId} onClick={() => setStep(2)}>Ver tarifa y continuar<ArrowRight size={19}/></button></> : <><button className="back-button" onClick={() => setStep(1)}><ArrowLeft size={16}/>Cambiar estacionamiento</button><div className="review-location"><span className="section-icon"><MapPin size={24}/></span><div><span className="field-label">Tu estacionamiento</span><h2>{selected.name}</h2><p>{selected.address}</p></div></div><div className="review-plate"><span><CarFront size={19}/>Tu patente</span><strong>{formatPlate(plate)}</strong><button aria-label="Editar patente" className="text-link" onClick={() => setStep(0)}>Editar</button></div><div className="tariff"><div><span className="field-label">Tarifa por minuto</span><strong>{money(selected.rate)}<small> CLP</small></strong></div><span className="tariff-badge">Sin costo de servicio</span></div><div className="estimate"><span>15 minutos<strong>{money(selected.rate * 15)}</strong></span><span>30 minutos<strong>{money(selected.rate * 30)}</strong></span><span>1 hora<strong>{money(selected.rate * 60)}</strong></span></div><ul className="tariff-rules"><li><Check size={16}/>Se cobra cada minuto iniciado, desde el primero.</li><li><Check size={16}/>El tiempo comienza cuando inicias tu estadía.</li><li><Check size={16}/>Sin tarifa mínima adicional ni tope diario.</li></ul><button className="primary" onClick={startStay}>Iniciar mi estadía<ArrowRight size={19}/></button><p className="microcopy">Pagarás cuando decidas finalizar.</p></>}
          </section><aside className="side-column">{step === 0 ? <WelcomePanel/> : selected ? <ParkingSummary parking={selected}/> : <div className="selection-guide"><Navigation size={28}/><h2>El lugar correcto.<br/>La tarifa correcta.</h2><p>Compara el nombre y el código con la señalética del estacionamiento.</p><span><MapPin size={16}/> Santiago, Chile</span></div>}<div className="reassurance"><ShieldCheck size={21}/><div><strong>Con todo a la vista</strong><p>{step === 0 ? 'Conoce la tarifa antes de iniciar y revisa tu costo en cualquier momento.' : 'Los lugares y las tarifas son ficticios para esta versión de prueba.'}</p></div></div></aside></div>
        </>}
      </main>
      <footer><span className="footer-brand">pausa.</span><span>Menos vueltas. Más tiempo para ti.</span><span className="footer-location"><MapPin size={13}/>Hecho para moverte en Chile</span></footer>
    </div>

    {dialog === 'finish' && <Modal title="¿Terminaste tu estadía?" onClose={() => setDialog(null)}><div className="modal-icon"><Clock3 size={27}/></div><h2>¿Terminaste tu estadía?</h2><p>Al continuar, el cronómetro se detendrá y podrás revisar el monto final antes de pagar.</p><div className="modal-summary"><span>Acumulado hasta ahora</span><strong>{money(stay.total)}</strong></div><button className="primary" onClick={finishStay}>Sí, ir al pago<ArrowRight size={18}/></button><button className="text-button" onClick={() => setDialog(null)}>Seguir estacionado</button></Modal>}
    {wallet && <WalletDialog data={data} defaultPlate={walletPlate} lockedPlate={session?.plate} onClose={() => setWallet(false)} onTopUp={topUp}/>}
    {help && <Modal title="Estacionar en simple" onClose={() => setHelp(false)}><div className="modal-icon"><HelpCircle size={27}/></div><h2>Estacionar en simple</h2><p>Registra tu patente, elige el estacionamiento y revisa la tarifa. Inicia tu estadía y, al volver, finaliza y simula el pago. Puedes recargar saldo prepago para tu patente y usarlo al pagar.</p><h3>Sobre esta prueba</h3><p>Los estacionamientos son ficticios. No necesitas datos bancarios y no habrá cobros reales. Tus datos quedan en este navegador y dispositivo; al borrarlos, se perderán tus comprobantes y saldos.</p><button className="primary" onClick={() => setHelp(false)}>Entendido<Check size={18}/></button></Modal>}
  </div>;
}

function RecentPlates({ plates, plate, onSelect }) {
  if (plates.length === 0) return null;
  return <fieldset className="recent-plates">
    <legend>Patentes recientes</legend>
    <div className="recent-plate-options">{plates.map(previous => <label key={previous} className={plate === previous ? 'selected' : ''}>
      <input type="radio" name="recent-plate" value={previous} checked={plate === previous} onChange={() => onSelect(previous)}/>
      <span>{previous}</span>
    </label>)}</div>
  </fieldset>;
}

function WelcomePanel() {
  return <div className="welcome-panel"><span className="welcome-kicker"><Sparkles size={15}/> UN RESPIRO EN TU DÍA</span><h2>Estacionar es<br/>solo una pausa.</h2><p>Que nada te quite tiempo<br/>de lo que viniste a hacer.</p><div className="parking-art" aria-hidden="true"><div className="art-road"/><div className="art-space space-one"/><div className="art-space space-two"/><div className="art-space space-three"/><div className="art-car"><span className="car-glass"/><span className="car-roof"/><span className="car-back"/></div><span className="art-p">P</span><span className="art-plant plant-one"/><span className="art-plant plant-two"/><span className="art-check"><Check size={24}/></span></div><div className="welcome-bottom"><span><Clock3 size={15}/>A tu ritmo</span><span><Ticket size={15}/>Sin papel</span></div></div>;
}
function ParkingSummary({ parking }) {
  return <div className="parking-summary"><div className="parking-visual"><img src="/parking.svg" alt="Ilustración de un estacionamiento señalizado"/><span><ParkingCircle size={15}/>{parking.code}</span></div><div className="parking-summary-body"><span className="eyebrow">ESTÁS ESTACIONANDO EN</span><h2>{parking.name}</h2><p><MapPin size={16}/>{parking.address}</p><p className="parking-area">{parking.area}, Santiago</p><div className="parking-tags"><span>{parking.tag}</span><span>Abierto 24 h</span></div></div></div>;
}

function ReceiptView({ receipt: r, heading, onDownload, onBack, onNew }) {
  const parking = PARKINGS.find(p => p.id === r.parkingId);
  return <div className="receipt-view">
    <button className="back-button" onClick={onBack}><ArrowLeft size={16}/>Todos los comprobantes</button>
    <div className="success-heading"><div className="success-icon"><Check size={33}/></div><span className="eyebrow">TODO EN ORDEN</span><h1 ref={heading} tabIndex={-1}>{r.kind === 'fine' ? 'Tu multa está pagada.' : 'Pagado. Sigue tu camino.'}</h1><p>Tu comprobante quedó guardado en Comprobantes.</p></div>
    <article className="receipt-ticket">
      <div className="ticket-heading"><span className="footer-brand">pausa.</span><span className="paid-label"><CheckCircle2 size={15}/>Pagado</span></div>
      <h2>{r.kind === 'fine' ? `Multa · ${parking.name}` : parking.name}</h2><p>{r.kind === 'fine' ? r.reason : parking.address}</p>
      <div className="ticket-total"><span>Total pagado</span><strong>{money(r.total)}<small> CLP</small></strong></div>
      <dl>
        <div><dt>Patente</dt><dd className="ticket-plate">{r.plate}</dd></div>
        {r.kind === 'fine' ? <><div><dt>N.º de multa</dt><dd>{r.fineId}</dd></div><div><dt>Fecha de emisión</dt><dd>{dateTime(r.issuedAt)}</dd></div><div><dt>Fecha de pago</dt><dd>{dateTime(r.paidAt)}</dd></div></> : <><div><dt>Ingreso</dt><dd>{dateTime(r.startedAt)}</dd></div>
        <div><dt>Finalización</dt><dd>{dateTime(r.endedAt)}</dd></div>
        <div><dt>Tiempo estacionado</dt><dd>{clock(r.seconds)}</dd></div>
        <div><dt>Minutos cobrados</dt><dd>{r.minutes}</dd></div>
        <div><dt>Tarifa</dt><dd>{money(r.rate)} / min iniciado</dd></div></>}
        <div><dt>Medio de pago</dt><dd>{paymentLabel(r)}</dd></div>
        {r.paymentMethod === 'balance' && <div><dt>Saldo después del pago</dt><dd>{money(r.balanceAfter)}</dd></div>}
      </dl>
      <div className="receipt-id"><span>N.º de comprobante</span><strong>{r.id}</strong></div><p className="receipt-disclaimer">Pago de prueba. Sin cobro real ni validez tributaria.</p>
    </article>
    <div className="receipt-actions"><button className="primary" onClick={() => onDownload(r)}><Download size={18}/>Descargar comprobante</button><button className="text-button" onClick={onNew}>{r.kind === 'fine' ? 'Volver a mis multas' : 'Volver a mi estacionamiento'}<ArrowRight size={17}/></button></div>
  </div>;
}
