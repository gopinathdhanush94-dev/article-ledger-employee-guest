import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient.js';

const ROLE_OPTIONS = [
  'viewer',
  'editor',
  'quotation_manager',
  'guest_manager',
  'admin',
  'super_admin',
];
const STATUS_OPTIONS = ['active', 'pending', 'disabled'];

const ROLE_LABELS = {
  viewer: 'Viewer',
  editor: 'Editor',
  quotation_manager: 'Quotation Manager',
  guest_manager: 'Guest Manager',
  admin: 'Admin',
  super_admin: 'Super Admin',
  guest: 'Guest',
};

const ROLE_ACCESS = {
  viewer: 'Home · General · Garments (view)',
  editor: 'Home · General · Garments · Add Product',
  quotation_manager: 'Home · General · Garments (view) · Add Product (view) · Showroom · Quotations',
  guest_manager: 'Home · General · Garments (view) · Add Product (view) · Showroom',
  admin: 'Full access · Users · Data Quality',
  super_admin: 'Full access · Users · Role administration',
  guest: 'Guest showroom only',
};

function labelRole(role) {
  return ROLE_LABELS[role] || String(role || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function UserManagement({ open, onClose, currentProfile }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const currentRole = currentProfile?.role || 'viewer';
  const isSuperAdmin = currentRole === 'super_admin';

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
    if (err) setError(err.message);
    else setUsers(prev => prev.map(x => x.user_id === user.user_id ? data : x));
    setSavingId(null);
  }

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(user => [user.full_name, user.email, user.employee_id, user.role, user.account_type]
      .filter(Boolean)
      .some(v => String(v).toLowerCase().includes(q)));
  }, [users, search]);

  if (!open) return null;

  return (
    <div className="um-overlay" role="dialog" aria-modal="true" aria-label="User management" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="um-modal">
        <header className="um-header">
          <div>
            <p className="um-eyebrow">Administration</p>
            <h2>User Management</h2>
            <p>Assign roles and activate employee accounts. Admins and Super Admins can manage users.</p>
          </div>
          <button className="um-close" onClick={onClose} aria-label="Close">✕</button>
        </header>

        <div className="um-toolbar">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email, employee ID…" aria-label="Search users" />
          <button type="button" className="btn" onClick={loadUsers} disabled={loading}>↻ Refresh</button>
        </div>

        {error && <div className="um-error">{error}</div>}
        {loading ? <div className="um-empty">Loading users…</div> : (
          <div className="um-table-wrap">
            <table className="um-table">
              <thead><tr><th>User</th><th>Account</th><th>Role</th><th>Status</th><th>Access</th></tr></thead>
              <tbody>
                {filteredUsers.map(user => {
                  const locked = user.user_id === currentProfile?.user_id;
                  const targetIsSuperAdmin = user.role === 'super_admin';
                  const roleDisabled = locked || savingId === user.user_id || (currentRole === 'admin' && targetIsSuperAdmin);
                  const statusDisabled = locked || savingId === user.user_id || (currentRole === 'admin' && targetIsSuperAdmin);
                  const options = user.account_type === 'guest' ? ['guest'] : ROLE_OPTIONS.filter(r => isSuperAdmin || r !== 'super_admin');
                  return (
                    <tr key={user.user_id}>
                      <td>
                        <strong>{user.full_name || 'Unnamed user'}</strong>
                        <span>{user.email}</span>
                        {user.employee_id && <small>ID: {user.employee_id}</small>}
                      </td>
                      <td><span className={`um-chip ${user.account_type}`}>{user.account_type === 'employee' ? 'Employee' : 'Guest'}</span></td>
                      <td>
                        <select value={user.role} disabled={roleDisabled} onChange={e => updateUser(user, { role: e.target.value })}>
                          {options.map(r => <option key={r} value={r}>{labelRole(r)}</option>)}
                        </select>
                      </td>
                      <td>
                        <select value={user.status} disabled={statusDisabled} onChange={e => updateUser(user, { status: e.target.value })}>
                          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{labelRole(s)}</option>)}
                        </select>
                      </td>
                      <td><span className="um-muted">{ROLE_ACCESS[user.role] || '—'}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!filteredUsers.length && <div className="um-empty">No matching users.</div>}
          </div>
        )}

        <div className="um-footer">
          <div>
            <strong>Role assignment:</strong> Admin can assign Viewer, Editor, Quotation Manager, Guest Manager or Admin. Super Admin can also assign Super Admin.
          </div>
          <button className="btn" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
