import React, { createContext, useContext, useState, useRef, useEffect } from 'react';

const DialogContext = createContext(null);

export function useDialogs() {
  return useContext(DialogContext);
}

export function DialogProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  // dialog = { type: 'prompt'|'confirm'|'alert'|'choice', title, message, placeholder, isPassword, confirmLabel, danger, onConfirm, options }

  const promptDialog = (opts) => setDialog({ type: 'prompt', ...opts });
  const confirmDialog = (opts) => setDialog({ type: 'confirm', ...opts });
  const alertDialog = (opts) => setDialog({ type: 'alert', ...opts });
  const choiceDialog = (opts) => setDialog({ type: 'choice', ...opts });
  const close = () => setDialog(null);

  return (
    <DialogContext.Provider value={{ promptDialog, confirmDialog, alertDialog, choiceDialog, close }}>
      {children}
      {dialog && <DialogBox dialog={dialog} close={close} />}
    </DialogContext.Provider>
  );
}

function DialogBox({ dialog, close }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  function submit() {
    if (dialog.type === 'confirm') {
      close();
      dialog.onConfirm?.();
      return;
    }
    if (dialog.type === 'alert') {
      close();
      return;
    }
    // prompt
    dialog.onConfirm?.(value, { setError });
  }

  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="dialog-box" onMouseDown={(e) => e.stopPropagation()}>
        <h4>{dialog.title}</h4>
        {dialog.message && <p>{dialog.message}</p>}
        {dialog.type === 'prompt' && (
          <input
            ref={inputRef}
            type={dialog.isPassword ? 'password' : 'text'}
            placeholder={dialog.placeholder || ''}
            value={value}
            autoComplete="off"
            onChange={(e) => { setValue(e.target.value); setError(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
          />
        )}
        {dialog.type === 'choice' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 6 }}>
            {dialog.options.map((opt) => (
              <button
                key={opt.label}
                type="button"
                className="btn choice-btn"
                onClick={() => { close(); opt.onClick(); }}
              >
                {opt.icon && <span style={{ marginRight: 8 }}>{opt.icon}</span>}
                {opt.label}
              </button>
            ))}
          </div>
        )}
        {error && <div className="dialog-error">{error}</div>}
        {dialog.type !== 'choice' && (
          <div className="dialog-actions">
            {dialog.type !== 'alert' && <button type="button" className="btn" onClick={close}>Cancel</button>}
            <button
              type="button"
              className={`btn ${dialog.danger ? 'btn-danger' : 'btn-primary'}`}
              onClick={submit}
            >
              {dialog.confirmLabel || 'OK'}
            </button>
          </div>
        )}
        {dialog.type === 'choice' && (
          <div className="dialog-actions">
            <button type="button" className="btn" onClick={close}>Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}
