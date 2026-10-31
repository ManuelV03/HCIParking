'use client';

import { useRef, useState } from 'react';
import { Check, CheckCircle2, Plus, Wallet } from 'lucide-react';
import { balanceFor, money, normalizePlate, validPlate } from '../../lib/parking.mjs';
import Modal from './modal';

export default function WalletDialog({ data, defaultPlate, lockedPlate, onClose, onTopUp, plateHint = 'Patente de tu estadía actual.' }) {
  const [targetPlate, setTargetPlate] = useState(defaultPlate || '');
  const [amount, setAmount] = useState('5000');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);
  const submitted = useRef(false);
  const balance = balanceFor(data, targetPlate);

  function submit(e) {
    e.preventDefault();
    if (submitted.current) return;
    submitted.current = true;
    try {
      if (!onTopUp(targetPlate, Number(amount))) {
        setError('No se guardó la recarga. Revisa el aviso de almacenamiento y vuelve a intentarlo.');
        submitted.current = false;
        return;
      }
      setSuccess({ amount: Number(amount), plate: targetPlate, balance: balance + Number(amount) });
    } catch (error) { setError(error.message); submitted.current = false; }
  }

  return <Modal title={success ? 'Recarga realizada' : 'Tu saldo prepago'} onClose={onClose}>
    <div className="modal-icon">{success ? <CheckCircle2 size={27}/> : <Wallet size={27}/>}</div>
    {success ? <><h2>Recarga realizada</h2><p role="status">Agregaste {money(success.amount)} a la patente <strong>{success.plate}</strong>.</p><div className="wallet-amount"><span>Nuevo saldo disponible</span><strong>{money(success.balance)}<small> CLP</small></strong></div><p>Tu saldo está listo para usar.</p><button className="primary" onClick={onClose}>Listo<Check size={18}/></button></> : <>
      <h2>Tu saldo prepago</h2><p>Recarga una vez y paga con el saldo de tu patente.</p>
      <form onSubmit={submit} noValidate className="wallet-form">
        <label className="field-label" htmlFor="wallet-plate">Patente que recibe el saldo</label>
        <input className="wallet-input wallet-plate" id="wallet-plate" value={targetPlate} readOnly={Boolean(lockedPlate)} autoCapitalize="characters" autoComplete="off" spellCheck={false} maxLength={8} placeholder="BCDF12" onChange={e => { setTargetPlate(normalizePlate(e.target.value)); setError(''); }}/>
        {lockedPlate && <span className="field-hint">{plateHint}</span>}
        <div className="wallet-amount"><span>Saldo disponible{validPlate(targetPlate) ? ` · ${targetPlate}` : ''}</span><strong>{money(balance)}<small> CLP</small></strong></div>
        <fieldset className="topup-options"><legend>Monto a recargar</legend>{[2000, 5000, 10000].map(value => <label key={value} className={amount === String(value) ? 'selected' : ''}><input type="radio" name="topup" checked={amount === String(value)} onChange={() => { setAmount(String(value)); setError(''); }}/>{money(value)}</label>)}</fieldset>
        <label className="field-label" htmlFor="topup-amount">Monto en pesos chilenos</label>
        <input className="wallet-input" id="topup-amount" type="number" inputMode="numeric" min="1" max="100000" step="1" value={amount} onChange={e => { setAmount(e.target.value); setError(''); }} aria-describedby="topup-hint"/>
        <p className="field-hint" id="topup-hint">De $1 a $100.000 por recarga.</p>
        {error && <p className="field-error" role="alert">{error}</p>}
        <button className="primary" type="submit">Simular recarga{Number.isSafeInteger(Number(amount)) && Number(amount) > 0 ? ` de ${money(Number(amount))}` : ''}<Plus size={18}/></button>
        <p className="microcopy">Saldo de prueba. No se realizará ningún cobro real.</p>
      </form>
    </>}
  </Modal>;
}

