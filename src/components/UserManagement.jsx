import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';

const ROLE_OPTIONS = ['viewer', 'editor', 'admin', 'super_admin'];
const STATUS_OPTIONS = ['active', 'pending', 'disabled'];

function labelRole(role) {
  return role === 'super_admin' ? 'Super Admin' : role.charAt(0).toUpperCase() + role.slice(1);
}

export default function UserManagement({ open, onClose, currentProfile }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState('');

  async function loadUsers() {
    setLoading(true);
    setError('');
    const { data, error: err } = await supabase
      .from('user_profiles')
      .select('user_id, full_name, email, employee_id, account_type, role, status, created_at')
      .order('created_at', { ascending: false });
    if (err) setError(err.message);
    else setUsers(data || []);
    setLoading(false);
  }

  useEffect(() => {
    if (open) loadUsers();
  }, [open]);

  async function updateUser(user, patch) {
    setSavingId(user.user_id);
    setError('');
    const { data, error: err } = await supabase
      .from('user_profiles')
      .update(patch)
      .eq('user_id', user.user_id)
      .select('user_id, full_name, email, employee_id, account_type, role, status, created_at')
      .single();
    if (err) {
      setError(err.message);
    } else {
      setUsers(prev => prev.map(x => x.user_id === user.user_id ? data : x));
    }
    setSavingId(null);
  }

  if (!open) return null;

  return (
    <div className="um-overlay" role="dialog" aria-modal="true" aria-label="User management" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="um-modal">
        <header className="um-header">
          <div>
            <p className="um-eyebrow">Administration</p>
            <h2>User Management</h2>
            <p>Control who can view, edit and manage the internal Article Ledger.</p>
          </div>
          <button className="um-close" onClick={onClose} aria-label="Close">✕</button>
        </header>

        {error && <div className="um-error">{error}</div>}
        {loading ? <div className="um-empty">Loading users…</div> : (
          <div className="um-table-wrap">
            <table className="um-table">
              <thead><tr><th>User</th><th>Account</th><th>Role</th><th>Status</th><th>Permissions</th></tr></thead>
              <tbody>
                {users.map(user => {
                  const locked = user.user_id === currentProfile?.user_id;
                  return (
                    <tr key={user.user_id}>
                      <td>
                        <strong>{user.full_name || 'Unnamed user'}</strong>
                        <span>{user.email}</span>
                        {user.employee_id && <small>ID: {user.employee_id}</small>}
                      </td>
                      <td><span className={`um-chip ${user.account_type}`}>{user.account_type === 'employee' ? 'Employee' : 'Guest'}</span></td>
                      <td>
                        <select value={user.role} disabled={locked || savingId === user.user_id} onChange={e => updateUser(user, { role: e.target.value })}>
                          {user.account_type === 'guest' ? <option value="guest">Guest</option> : ROLE_OPTIONS.map(r => <option key={r} value={r}>{labelRole(r)}</option>)}
                        </select>
                      </td>
                      <td>
                        <select value={user.status} disabled={locked || savingId === user.user_id} onChange={e => updateUser(user, { status: e.target.value })}>
                          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{labelRole(s)}</option>)}
                        </select>
                      </td>
                      <td>
                        {user.account_type === 'guest' ? <span className="um-muted">Showroom only</span> : <span className="um-muted">{labelRole(user.role)} permissions</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="um-footer">
          <div><strong>New employee:</strong> starts as <b>Viewer + Pending</b> until an administrator activates the account.</div>
          <button className="btn" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
