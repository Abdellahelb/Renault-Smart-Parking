import { API_URL, SOCKET_URL } from '../api_config';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Lock, Shield, Save, Eye, EyeOff } from 'lucide-react';
import useAuthStore from '../store/authStore';

export default function ProfilePage() {
    const { user } = useAuthStore();
    const [name, setName] = useState(user?.name || 'Admin User');
    const [email, setEmail] = useState(user?.email || 'admin@renault.com');
    const [currentPw, setCurrentPw] = useState('');
    const [newPw, setNewPw] = useState('');
    const [confirmPw, setConfirmPw] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [twoFA, setTwoFA] = useState(false);
    const [saved, setSaved] = useState(false);

    const handleSave = () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    return (
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
            {/* Profile Info */}
            <motion.div className="card" style={{ marginBottom: '16px' }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <div className="card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <User size={18} style={{ color: 'var(--yellow)' }} />
                        <div className="card-title">Profile Information</div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                    <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--yellow-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 700, color: 'var(--yellow)', fontFamily: 'var(--font-display)', flexShrink: 0 }}>
                        {name.charAt(0)}
                    </div>
                    <div style={{ flex: 1 }}>
                        <div className="form-group">
                            <label className="form-label">Full Name</label>
                            <input type="text" className="form-input" value={name} onChange={e => setName(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Email</label>
                            <input type="email" className="form-input" value={email} onChange={e => setEmail(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Operator ID</label>
                            <input type="text" className="form-input" value={user?.operator_id || 'ADMIN001'} disabled style={{ opacity: 0.6 }} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Role</label>
                            <span className={`badge badge-${user?.role || 'admin'}`} style={{ display: 'inline-flex' }}>
                                {user?.role || 'admin'}
                            </span>
                        </div>
                    </div>
                </div>
                <button className="btn btn-primary" onClick={handleSave} style={{ marginTop: '8px' }}>
                    <Save size={16} /> {saved ? '✓ Saved!' : 'Save Changes'}
                </button>
            </motion.div>

            {/* Change Password */}
            <motion.div className="card" style={{ marginBottom: '16px' }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <div className="card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Lock size={18} style={{ color: 'var(--yellow)' }} />
                        <div className="card-title">Change Password</div>
                    </div>
                </div>
                <div className="form-group">
                    <label className="form-label">Current Password</label>
                    <div style={{ position: 'relative' }}>
                        <input type={showPw ? 'text' : 'password'} className="form-input" value={currentPw} onChange={e => setCurrentPw(e.target.value)} placeholder="Enter current password" />
                        <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                            {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>
                </div>
                <div className="form-group">
                    <label className="form-label">New Password</label>
                    <input type="password" className="form-input" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Min 8 characters" />
                </div>
                <div className="form-group">
                    <label className="form-label">Confirm New Password</label>
                    <input type="password" className="form-input" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="Repeat new password" />
                </div>
                <button className="btn btn-primary"><Lock size={16} /> Update Password</button>
            </motion.div>

            {/* 2FA */}
            <motion.div className="card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <div className="card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Shield size={18} style={{ color: 'var(--yellow)' }} />
                        <div className="card-title">Two-Factor Authentication</div>
                    </div>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                    Add an extra layer of security by enabling TOTP-based 2FA with Google Authenticator or Authy.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button className={`btn ${twoFA ? 'btn-danger' : 'btn-primary'}`} onClick={() => setTwoFA(!twoFA)}>
                        {twoFA ? 'Disable 2FA' : 'Enable 2FA'}
                    </button>
                    {twoFA && <span className="badge badge-available">✓ 2FA is active</span>}
                </div>
            </motion.div>
        </div>
    );
}
