import React, { useState } from 'react';

export default function LoginModal({ onClose, onSubmit }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const err = await onSubmit(email, password);
    setBusy(false);
    if (err) setError(err.message || 'Sign-in failed.');
  }

  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dialog-box" onMouseDown={(e) => e.stopPropagation()}>
        <h4>Admin sign-in required</h4>
        <p>Sign in to add, edit, or delete articles.</p>
        <form onSubmit={handleSubmit}>
          <input
            type="email" placeholder="Email" value={email} autoFocus
            onChange={(e) => setEmail(e.target.value)} style={{ marginBottom: 10 }}
          />
          <input
            type="password" placeholder="Password" value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <div className="dialog-error" style={{ marginTop: 10 }}>{error}</div>}
          <div className="dialog-actions" style={{ marginTop: 16 }}>
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
