import { API_URL, SOCKET_URL } from '../api_config';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, UserPlus, Shield, Trash2, ToggleLeft, ToggleRight, Mail, Key, User, Plus, X } from 'lucide-react';
import useAuthStore from '../store/authStore';
import useUserStore from '../store/userStore';
import toast from 'react-hot-toast';

export default function UserManagementPage() {
    const { user, token, hasRole } = useAuthStore();
    const { users, fetchUsers, addUser, deleteUser, loading } = useUserStore();

    const [showAddForm, setShowAddForm] = useState(false);
    const [newUser, setNewUser] = useState({
        name: '',
        operator_id: '',
        email: '',
        role: 'operator',
        password: ''
    });

    useEffect(() => {
        if (token) fetchUsers(token);
    }, [token, fetchUsers]);

    const handleAddUser = async (e) => {
        e.preventDefault();
        const success = await addUser(newUser, token);
        if (success) {
            toast.success('User added successfully');
            setShowAddForm(false);
            setNewUser({ name: '', operator_id: '', email: '', role: 'operator', password: '' });
        } else {
            toast.error('Failed to add user');
        }
    };

    const handleDeleteUser = async (id, name) => {
        if (window.confirm(`Are you sure you want to delete ${name}?`)) {
            const success = await deleteUser(id, token);
            if (success) toast.success('User deleted successfully');
            else toast.error('Failed to delete user');
        }
    };

    const roleBadge = { admin: 'badge-admin', supervisor: 'badge-supervisor', operator: 'badge-operator' };

    const canManageUsers = hasRole('supervisor');

    return (
        <div>
            {/* Stats */}
            <div className="kpi-grid" style={{ marginBottom: '16px' }}>
                <motion.div className="kpi-card yellow" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <div className="kpi-icon yellow"><Users size={22} /></div>
                    <div className="kpi-value">{users.length}</div>
                    <div className="kpi-label">Total Users</div>
                </motion.div>
                <motion.div className="kpi-card green" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                    <div className="kpi-icon green"><Shield size={22} /></div>
                    <div className="kpi-value">{users.filter(u => u.active).length}</div>
                    <div className="kpi-label">Active Users</div>
                </motion.div>
                <motion.div className="kpi-card blue" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                    <div className="kpi-icon blue"><Key size={22} /></div>
                    <div className="kpi-value">{users.filter(u => u.role === 'admin' || u.role === 'supervisor').length}</div>
                    <div className="kpi-label">Privileged</div>
                </motion.div>
            </div>

            {/* Actions */}
            {canManageUsers && (
                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                    <button className="btn btn-primary" onClick={() => setShowAddForm(!showAddForm)}>
                        <UserPlus size={16} /> {showAddForm ? 'Cancel' : 'Add New Account'}
                    </button>
                </div>
            )}

            {/* Add User Form */}
            {showAddForm && (
                <motion.div className="card" style={{ marginBottom: '16px', borderColor: 'var(--yellow-border)' }} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                    <div className="card-header" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between' }}>
                        <div className="card-title">Create New User Account</div>
                        <button className="btn btn-sm btn-secondary" onClick={() => setShowAddForm(false)}><X size={14} /></button>
                    </div>
                    <form onSubmit={handleAddUser} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                        <div className="form-group">
                            <label className="form-label">Full Name</label>
                            <input type="text" className="form-input" required value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} placeholder="e.g. Jean Dupont" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Operator ID</label>
                            <input type="text" className="form-input" required value={newUser.operator_id} onChange={e => setNewUser({ ...newUser, operator_id: e.target.value })} placeholder="e.g. OP001" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Email (Optional)</label>
                            <input type="email" className="form-input" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} placeholder="email@renault.com" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Role</label>
                            <select className="form-input" value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}>
                                <option value="operator">Operator</option>
                                <option value="supervisor">Supervisor</option>
                                <option value="admin">Admin</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Temporary Password</label>
                            <input type="password" className="form-input" required value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} placeholder="********" />
                        </div>
                        <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
                            <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%' }}>
                                <Plus size={16} /> Create Account
                            </button>
                        </div>
                    </form>
                </motion.div>
            )}

            {/* User Table */}
            <motion.div className="card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <div className="card-header">
                    <div className="card-title">System Personnel</div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>User</th>
                                <th>ID</th>
                                <th>Role</th>
                                <th>Status</th>
                                <th>Last Activity</th>
                                {canManageUsers && <th>Actions</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(u => (
                                <tr key={u.id} style={{ opacity: u.active ? 1 : 0.5 }}>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--yellow-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--yellow)', fontWeight: 600, fontSize: '0.8rem' }}>
                                                {u.name.charAt(0)}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 500, fontSize: '0.85rem' }}>{u.name}</div>
                                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{u.email || 'No email set'}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{u.operator_id}</td>
                                    <td><span className={`badge ${roleBadge[u.role]}`}>{u.role}</span></td>
                                    <td>
                                        <span className={`badge ${u.active ? 'badge-available' : 'badge-occupied'}`}>
                                            {u.active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                        {u.last_login ? new Date(u.last_login).toLocaleDateString('en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Never'}
                                    </td>
                                    {canManageUsers && (
                                        <td>
                                            <div style={{ display: 'flex', gap: '6px' }}>
                                                {u.id !== user.id && (
                                                    <button className="btn btn-sm btn-secondary" onClick={() => handleDeleteUser(u.id, u.name)} title="Remove account" style={{ color: 'var(--red)' }}>
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                                <button className="btn btn-sm btn-secondary" title="System detail"><User size={14} /></button>
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </motion.div>
        </div>
    );
}
