'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export default function Modal({ title, onClose, children, busy = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    ref.current.showModal();
    const dialog = ref.current;
    return () => { dialog.close(); previous?.focus(); };
  }, []);
  return <dialog className="modal" ref={ref} aria-label={title} onCancel={e => { if (busy) e.preventDefault(); else onClose(); }} onClick={e => {
    if (busy || e.target !== ref.current) return;
    const r = ref.current.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose();
  }}><button className="icon-button modal-close" disabled={busy} aria-label="Cerrar" onClick={onClose}><X size={21}/></button>{children}</dialog>;
}
