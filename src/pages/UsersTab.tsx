import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, Loader, Plus, RefreshCw, Save, Shield, Trash2, User, UserRoundCog } from 'lucide-react';
import Modal from '../components/Modal';
import Toast from '../components/Toast';
import type { User as AppUser } from '../types';
import { fetchAllUsers, insertUser, updateUserById, deleteUserById } from '../services/userService';

type UserForm = {
  id?: string | number;
  username: string;
  name: string;
  email: string;
  password: string;
  isActive: boolean;
};

const EMPTY_FORM: UserForm = {
  username: '',
  name: '',
  email: '',
  password: '',
  isActive: true,
};

interface ToastState {
  msg: string;
  type: string;
}

export default function UsersTab() {
  const { user, syncSessionUser } = useAuth();
  const isAdmin = user?.userRole === 'admin';
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | number | null>(null);
  const [deletingId, setDeletingId] = useState<string | number | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [form, setForm] = useState<UserForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [showModal, setShowModal] = useState(false);

  const showToast = (msg: string, type = 'success') => setToast({ msg, type });

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await fetchAllUsers();
      setUsers(data);
    } catch {
      showToast('Failed to load users.', 'error');
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const adminBlockedIds = useMemo(() => new Set(users.filter(u => u.userRole === 'admin').map(u => u.id)), [users]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowModal(false);
  };

  const startEdit = (u: AppUser) => {
    setEditingId(u.id);
    setForm({
      id: u.id,
      username: u.username || '',
      name: u.name || '',
      email: u.email || '',
      password: '',
      isActive: u.isActive !== false,
    });
    setShowModal(true);
  };

  const startCreate = () => {
    resetForm();
    setShowModal(true);
  };

  const saveUser = async () => {
    if (!form.email.trim()) return showToast('Email is required.', 'error');
    if (!editingId && !form.password.trim()) return showToast('Password is required for new users.', 'error');
    if (!editingId && users.some(u => u.username === form.email.trim())) return showToast('Email is already used.', 'error');

    const existingUser = editingId ? users.find(u => u.id === editingId) : undefined;
    if (editingId && !existingUser) {
      return showToast('User not found.', 'error');
    }

    const userRole = editingId ? (existingUser?.userRole || 'user') : 'user';
    const isActive = editingId ? form.isActive : true;
    const password = editingId
      ? (form.password.trim() ? form.password.trim() : (existingUser?.password || ''))
      : form.password.trim();

    if (editingId && adminBlockedIds.has(editingId) && form.isActive === false) {
      return showToast('Admin accounts cannot be made inactive.', 'error');
    }

    setSavingId(editingId || 'new');
    try {
      if (editingId) {
        const updatePayload = {
          username: form.email.trim(),
          name: form.name.trim(),
          email: form.email.trim(),
          userRole,
          isActive,
          password,
        };
        await updateUserById(editingId, updatePayload);
        const updated: AppUser = { ...(existingUser!), ...updatePayload, id: editingId };
        setUsers(prev => prev.map(u => (u.id === editingId ? updated : u)));
        if (user?.id === editingId) {
          syncSessionUser({ ...user, ...updatePayload, userRole: updatePayload.userRole || 'user', isActive: updatePayload.isActive !== false });
        }
        showToast('User updated.');
      } else {
        const insertPayload = {
          username: form.email.trim(),
          name: form.name.trim(),
          email: form.email.trim(),
          userRole: 'user' as const,
          isActive: true,
          password,
        };
        const created = await insertUser(insertPayload);
        setUsers(prev => [...prev, created]);
        showToast('User created.');
      }
      resetForm();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not save user.', 'error');
    }
    setSavingId(null);
  };

  const toggleActive = async (target: AppUser) => {
    if (target.userRole === 'admin') {
      return showToast('Admin accounts cannot be made inactive.', 'error');
    }

    const nextActive = target.isActive === false;
    setSavingId(target.id);
    try {
      await updateUserById(target.id, { isActive: nextActive });
      const next = { ...target, isActive: nextActive };
      setUsers(prev => prev.map(u => (u.id === target.id ? next : u)));
      if (user?.id === target.id && !nextActive) {
        syncSessionUser(null);
      }
      showToast(`User ${nextActive ? 'activated' : 'inactivated'}.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not update status.', 'error');
    }
    setSavingId(null);
  };

  const removeUser = async (target: AppUser) => {
    if (target.userRole === 'admin') {
      return showToast('Admin accounts cannot be deleted.', 'error');
    }

    const ok = window.confirm(`Delete ${target.username}? This cannot be undone.`);
    if (!ok) return;

    setDeletingId(target.id);
    try {
      await deleteUserById(target.id);
      setUsers(prev => prev.filter(u => u.id !== target.id));
      if (user?.id === target.id) {
        syncSessionUser(null);
      }
      showToast('User deleted.');
      if (editingId === target.id) resetForm();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not delete user.', 'error');
    }
    setDeletingId(null);
  };

  if (!isAdmin) {
    return (
      <div className="max-w-[700px] mx-auto mt-16 text-center px-4">
        <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <AlertCircle size={28} className="text-amber-600" />
        </div>
        <h2 className="font-serif text-2xl text-gray-900 mb-2">Admins only</h2>
        <p className="text-gray-400 text-sm max-w-[420px] mx-auto">
          You do not have permission to manage users.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-[1100px] mx-auto">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-serif text-2xl sm:text-[26px] text-gray-900 mb-1">Users</h1>
          <p className="text-gray-400 text-sm">Create, update, activate, inactivate, or delete user accounts.</p>
        </div>
        <div className="flex w-full sm:w-auto flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <button className="btn-secondary justify-center" onClick={() => void loadUsers()} disabled={loading}>
            {loading ? <Loader size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Refresh
          </button>
          <button className="btn-primary justify-center" onClick={startCreate}>
            <Plus size={14} />
            Create User
          </button>
        </div>
      </div>

      <div className="section-card overflow-hidden">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="section-heading mb-0">
            <UserRoundCog size={18} /> User List
          </h2>
          <span className="text-xs text-gray-500">{users.length} total</span>
        </div>

        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-200">
                <th className="py-3 pr-3 font-medium">Username</th>
                <th className="py-3 pr-3 font-medium">Name</th>
                <th className="py-3 pr-3 font-medium">Email</th>
                <th className="py-3 pr-3 font-medium">Role</th>
                <th className="py-3 pr-3 font-medium">Status</th>
                <th className="py-3 pr-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const isAdminUser = u.userRole === 'admin';
                const isCurrent = user?.id === u.id;
                const active = u.isActive !== false;

                return (
                  <tr key={u.id} className="border-b border-gray-100 last:border-b-0 align-top">
                    <td className="py-3 pr-3 font-medium text-gray-900">
                      <div className="flex items-center gap-2">
                        <User size={14} className="text-gray-400 shrink-0" />
                        <span>{u.username}</span>
                        {isCurrent && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700">you</span>}
                      </div>
                    </td>
                    <td className="py-3 pr-3 text-gray-700">{u.name || '-'}</td>
                    <td className="py-3 pr-3 text-gray-700">{u.email || '-'}</td>
                    <td className="py-3 pr-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${isAdminUser ? 'bg-slate-100 text-slate-700' : 'bg-emerald-50 text-emerald-700'}`}>
                        {u.userRole || 'user'}
                      </span>
                    </td>
                    <td className="py-3 pr-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${active ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                        {active ? 'active' : 'inactive'}
                      </span>
                    </td>
                    <td className="py-3 pr-3">
                      <div className="flex flex-wrap gap-2">
                        <button className="btn-secondary btn-sm" onClick={() => startEdit(u)}>
                          Edit
                        </button>
                        <button
                          className="btn-secondary btn-sm"
                          onClick={() => void toggleActive(u)}
                          disabled={u.userRole === 'admin' || savingId === u.id}
                        >
                          {active ? 'Inactivate' : 'Activate'}
                        </button>
                        <button
                          className="btn-danger btn-sm"
                          onClick={() => void removeUser(u)}
                          disabled={u.userRole === 'admin' || deletingId === u.id}
                        >
                          {deletingId === u.id ? <Loader size={12} className="animate-spin" /> : <Trash2 size={12} />}
                          Delete
                        </button>
                      </div>
                      {u.userRole === 'admin' && (
                        <p className="text-[11px] text-gray-400 mt-1">Admin accounts are protected.</p>
                      )}
                    </td>
                  </tr>
                );
              })}
              </tbody>
            </table>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:hidden">
          {users.map(u => (
            <UserCard
              key={u.id}
              user={u}
              currentUserId={user?.id}
              onEdit={startEdit}
              onToggle={toggleActive}
              onDelete={removeUser}
              isSaving={savingId === u.id}
              isDeleting={deletingId === u.id}
            />
          ))}
        </div>
      </div>

      <Modal
        open={showModal}
        onClose={resetForm}
        title={<><Plus size={18} /> {editingId ? 'Edit User' : 'Create User'}</>}
      >
        <div className="p-5 space-y-3.5">
          <TextField label="Username" value={form.email} disabled placeholder="email@example.com" helper="Username is always saved from the email value." />
          <TextField label="Name" value={form.name} onChange={value => setForm(f => ({ ...f, name: value }))} placeholder="Full name" />
          <TextField
            label="Email"
            value={form.email}
            onChange={value => setForm(f => ({ ...f, email: value, username: value }))}
            placeholder="user@example.com"
          />
          <TextField
            label={editingId ? 'New Password' : 'Password'}
            value={form.password}
            onChange={value => setForm(f => ({ ...f, password: value }))}
            placeholder={editingId ? 'Leave blank to keep current password' : 'Set password'}
            type="password"
          />

          <div className="flex items-center justify-between gap-3 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
            <div>
              <p className="text-sm font-medium text-gray-700">Active</p>
              <p className="text-[11px] text-gray-400">Inactive users cannot log in.</p>
            </div>
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
              disabled={!editingId || adminBlockedIds.has(editingId)}
              className="accent-violet-600 h-4 w-4"
            />
          </div>

          {editingId && adminBlockedIds.has(editingId) && (
            <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              <Shield size={14} />
              Admin accounts cannot be deleted or made inactive.
            </div>
          )}

          <button className="btn-primary w-full justify-center" onClick={() => void saveUser()} disabled={savingId !== null}>
            {savingId ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
            {editingId ? 'Save Changes' : 'Create User'}
          </button>
        </div>
      </Modal>

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  helper,
  type = 'text',
  disabled = false,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  helper?: string;
  type?: 'text' | 'password';
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="field-label">{label}</label>
      <input
        className={`field-input ${disabled ? 'bg-gray-50' : ''}`}
        type={type}
        value={value}
        disabled={disabled}
        onChange={onChange ? e => onChange(e.target.value) : undefined}
        placeholder={placeholder}
      />
      {helper && <p className="text-[11px] text-gray-400 mt-1">{helper}</p>}
    </div>
  );
}

function UserCard({
  user,
  currentUserId,
  onEdit,
  onToggle,
  onDelete,
  isSaving,
  isDeleting,
}: {
  user: AppUser;
  currentUserId: string | number | null | undefined;
  onEdit: (user: AppUser) => void;
  onToggle: (user: AppUser) => void;
  onDelete: (user: AppUser) => void;
  isSaving: boolean;
  isDeleting: boolean;
}) {
  const isAdminUser = user.userRole === 'admin';
  const active = user.isActive !== false;
  const canModify = !isAdminUser;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-gray-900 break-all">{user.username}</span>
            {currentUserId === user.id && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700">you</span>}
          </div>
          <p className="text-sm text-gray-600 mt-1">{user.name || 'No name'}</p>
          <p className="text-xs text-gray-400 break-all">{user.email || '-'}</p>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <Pill tone={isAdminUser ? 'slate' : 'emerald'}>{user.userRole || 'user'}</Pill>
          <Pill tone={active ? 'emerald' : 'rose'}>{active ? 'active' : 'inactive'}</Pill>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <ActionButton onClick={() => onEdit(user)}>Edit</ActionButton>
        <ActionButton onClick={() => onToggle(user)} disabled={!canModify || isSaving}>
          {active ? 'Inactivate' : 'Activate'}
        </ActionButton>
        <ActionButton variant="danger" onClick={() => onDelete(user)} disabled={!canModify || isDeleting}>
          {isDeleting ? <Loader size={12} className="animate-spin" /> : <Trash2 size={12} />}
          Delete
        </ActionButton>
      </div>

      {isAdminUser && <p className="text-[11px] text-gray-400 mt-2">Admin accounts are protected.</p>}
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  variant = 'secondary',
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'secondary' | 'danger';
}) {
  return (
    <button
      className={variant === 'danger' ? 'btn-danger btn-sm justify-center' : 'btn-secondary btn-sm justify-center'}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function Pill({ tone, children }: { tone: 'emerald' | 'rose' | 'slate'; children: ReactNode }) {
  const toneClass = tone === 'emerald'
    ? 'bg-emerald-50 text-emerald-700'
    : tone === 'rose'
      ? 'bg-rose-50 text-rose-700'
      : 'bg-slate-100 text-slate-700';

  return <span className={`text-xs px-2 py-1 rounded-full ${toneClass}`}>{children}</span>;
}
