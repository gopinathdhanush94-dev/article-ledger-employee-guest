import React, { useState } from 'react';
import { useAuth } from '../lib/useAuth.js';

function RoleChoice({ onSelect }) {
  return (
    <div className="access-shell">
      <div className="access-card access-choice-card">
        <div className="access-brand-icon" aria-hidden="true">G</div>
        <p className="access-eyebrow">G-Records</p>
        <h1>Article Ledger</h1>
        <p className="access-subtitle">Choose how you want to continue</p>

        <div className="access-role-grid">
          <button className="access-role employee" onClick={() => onSelect('employee')}>
            <span className="access-role-icon">👨‍💼</span>
            <span className="access-role-title">Employee</span>
            <span className="access-role-copy">Access the internal Article Ledger</span>
          </button>
          <button className="access-role guest" onClick={() => onSelect('guest')}>
            <span className="access-role-icon">👤</span>
            <span className="access-role-title">Guest</span>
            <span className="access-role-copy">Continue to the showroom experience</span>
          </button>
        </div>
        <p className="access-private-note">Internal product information is protected.</p>
      </div>
    </div>
  );
}

function AuthCard({ role, onBack }) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const isEmployee = role === 'employee';

  async function submit(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    if (!email || !password) return setError('Email and password are required.');
    if (mode === 'signup') {
      if (!name.trim()) return setError('Please enter your name.');
      if (isEmployee && !employeeId.trim()) return setError('Please enter your Employee ID.');
      if (password !== confirm) return setError('Passwords do not match.');
    }

    setBusy(true);
    if (mode === 'login') {
      const err = await signIn(email.trim(), password);
      if (err) setError(err.message || 'Sign-in failed.');
    } else {
      const result = await signUp(email.trim(), password, {
        account_type: isEmployee ? 'employee' : 'guest',
        full_name: name.trim(),
        employee_id: isEmployee ? employeeId.trim() : '',
      });
      if (result.error) setError(result.error.message || 'Could not create account.');
      else if (!result.session) setMessage('Account created. You can sign in now.');
    }
    setBusy(false);
  }

  return (
    <div className="access-shell">
      <div className="access-card access-auth-card">
        <button className="access-back" type="button" onClick={onBack}>← Back</button>
        <div className={`access-auth-badge ${isEmployee ? 'employee' : 'guest'}`}>
          {isEmployee ? '👨‍💼' : '👤'}
        </div>
        <p className="access-eyebrow">Article Ledger</p>
        <h1>{isEmployee ? 'Employee Access' : 'Guest Access'}</h1>
        <p className="access-subtitle">
          {isEmployee ? 'Sign in or create your employee account' : 'Sign in or create your guest account'}
        </p>

        <div className="access-mode-tabs">
          <button className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError(''); setMessage(''); }}>Sign in</button>
          <button className={mode === 'signup' ? 'active' : ''} onClick={() => { setMode('signup'); setError(''); setMessage(''); }}>Create account</button>
        </div>

        <form className="access-form" onSubmit={submit}>
          {mode === 'signup' && (
            <>
              <label>Full name<input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" autoComplete="name" /></label>
              {isEmployee && <label>Employee ID<input value={employeeId} onChange={e => setEmployeeId(e.target.value)} placeholder="Employee ID" autoComplete="organization-title" /></label>}
            </>
          )}
          <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@company.com" autoComplete="email" /></label>
          <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></label>
          {mode === 'signup' && <label>Confirm password<input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Confirm password" autoComplete="new-password" /></label>}
          {error && <div className="access-error">{error}</div>}
          {message && <div className="access-success">{message}</div>}
          <button className="access-submit" disabled={busy} type="submit">
            {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        {isEmployee && mode === 'login' && <p className="access-footnote">Employee access is for internal Article Ledger data.</p>}
        {!isEmployee && mode === 'signup' && <p className="access-footnote">Guest accounts will only receive showroom access.</p>}
      </div>
    </div>
  );
}

function GuestLanding() {
  const { signOut } = useAuth();
  return (
    <div className="access-shell">
      <div className="access-card access-ready-card">
        <div className="access-auth-badge guest">👤</div>
        <p className="access-eyebrow">Guest account</p>
        <h1>Welcome to the Showroom</h1>
        <p className="access-subtitle">Your guest account is ready. The showroom product experience will be added here.</p>
        <div className="access-ready-note">Guest access is intentionally separated from the internal Article Ledger.</div>
        <button className="access-submit" onClick={signOut}>Sign out</button>
      </div>
    </div>
  );
}

export default function AccessGate({ children }) {
  const { session, profile, loading, isGuest, isEmployee, isPending, isDisabled, signOut } = useAuth();
  const [role, setRole] = useState(null);

  if (loading) {
    return <div className="access-shell"><div className="access-card"><div className="access-spinner" /><p>Checking your access…</p></div></div>;
  }

  if (!session) {
    if (!role) return <RoleChoice onSelect={setRole} />;
    return <AuthCard role={role} onBack={() => setRole(null)} />;
  }

  if (!profile) {
    return <div className="access-shell"><div className="access-card"><p className="access-error">Your account profile is not ready yet. Please contact an administrator.</p><button className="access-submit" onClick={signOut}>Sign out</button></div></div>;
  }

  if (isGuest) return <GuestLanding />;

  if (isEmployee && isPending) {
    return (
      <div className="access-shell">
        <div className="access-card access-ready-card">
          <div className="access-auth-badge employee">👨‍💼</div>
          <p className="access-eyebrow">Employee account</p>
          <h1>Awaiting approval</h1>
          <p className="access-subtitle">Your employee account was created as Viewer/Pending. An administrator must activate it before internal Article Ledger data becomes available.</p>
          <div className="access-ready-note"><strong>{profile.full_name || profile.email}</strong><br/>Employee ID: {profile.employee_id || 'Not provided'}</div>
          <button className="access-submit" onClick={signOut}>Sign out</button>
        </div>
      </div>
    );
  }

  if (isEmployee && isDisabled) {
    return (
      <div className="access-shell">
        <div className="access-card access-ready-card">
          <div className="access-auth-badge employee">⛔</div>
          <p className="access-eyebrow">Employee account</p>
          <h1>Account disabled</h1>
          <p className="access-subtitle">This employee account is currently disabled. Please contact an administrator.</p>
          <button className="access-submit" onClick={signOut}>Sign out</button>
        </div>
      </div>
    );
  }

  return children;
}
