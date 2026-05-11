import { API_URL, SOCKET_URL } from '../api_config';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings, Key, Globe, Bell, Database, Shield, Save, RefreshCw } from 'lucide-react';
import useAuthStore from '../store/authStore';
import useSettingsStore from '../store/settingsStore';

export default function SettingsPage() {
    const { token } = useAuthStore();
    const { theme, setTheme, fetchSettings } = useSettingsStore();
    const [apiKey, setApiKey] = useState('ESP32-HW-KEY-••••••••••');
    const [frontendUrl, setFrontendUrl] = useState('https://parking.renault-internal.com');
    const [alertEmail, setAlertEmail] = useState('supervisor@renault.com');
    const [alertDays, setAlertDays] = useState(6);
    const [smtpHost, setSmtpHost] = useState('smtp.renault.com');
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (!token) return;
        fetch(`${API_URL}/settings`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(data => {
                if (data.max_park_days) setAlertDays(parseInt(data.max_park_days, 10));
            })
            .catch(err => console.error('Failed to fetch settings', err));
    }, [token]);

    const handleSave = async (specificDays = null) => {
        try {
            const daysToSave = specificDays !== null ? specificDays : alertDays;
            console.log('Saving alertDays:', daysToSave);
            const res = await fetch(`${API_URL}/settings`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ max_park_days: daysToSave })
            });

            if (!res.ok) {
                console.error('Failed to save:', await res.text());
                if (specificDays === null) alert('Setting save failed!');
                return;
            }

            // Broadcast the fix globally
            await fetchSettings(token);

            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (err) {
            console.error('Failed to save settings', err);
            if (specificDays === null) alert('Error saving settings.');
        }
    };

    const handleAlertDaysChange = (e) => {
        const val = parseInt(e.target.value);
        if (!isNaN(val) && val > 0) {
            setAlertDays(val);
            handleSave(val); // Auto-save on change
        } else {
            setAlertDays('');
        }
    };

    const regenerateKey = () => {
        const newKey = 'ESP32-' + Math.random().toString(36).substring(2, 14).toUpperCase();
        setApiKey(newKey);
    };

    return (
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
            {/* Hardware API Keys */}
            <motion.div className="card" style={{ marginBottom: '16px' }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <div className="card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Key size={18} style={{ color: 'var(--yellow)' }} />
                        <div className="card-title">Hardware API Keys</div>
                    </div>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                    API key for ESP32 device authentication. Rotate monthly for security.
                </p>
                <div className="form-group">
                    <label className="form-label">ESP32 Hardware Key</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <input type="text" className="form-input" value={apiKey} onChange={e => setApiKey(e.target.value)} style={{ fontFamily: 'monospace' }} />
                        <button className="btn btn-secondary" onClick={regenerateKey} title="Regenerate"><RefreshCw size={16} /></button>
                    </div>
                </div>
            </motion.div>

            {/* CORS & Network */}
            <motion.div className="card" style={{ marginBottom: '16px' }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                <div className="card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Globe size={18} style={{ color: 'var(--yellow)' }} />
                        <div className="card-title">Network & CORS</div>
                    </div>
                </div>
                <div className="form-group">
                    <label className="form-label">Frontend URL (CORS Whitelist)</label>
                    <input type="url" className="form-input" value={frontendUrl} onChange={e => setFrontendUrl(e.target.value)} />
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <span className="badge badge-available">HTTPS Enforced</span>
                    <span className="badge badge-available">Helmet.js Active</span>
                    <span className="badge badge-available">Rate Limiting: 100/min</span>
                    <span className="badge badge-available">CSRF Protection</span>
                </div>
            </motion.div>

            {/* Alert Configuration */}
            <motion.div className="card" style={{ marginBottom: '16px' }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <div className="card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Bell size={18} style={{ color: 'var(--yellow)' }} />
                        <div className="card-title">Alert & Notification Settings</div>
                    </div>
                </div>
                <div className="form-group">
                    <label className="form-label">Alert Threshold (days)</label>
                    <input type="number" className="form-input" value={alertDays} onChange={handleAlertDaysChange} min="1" max="30" style={{ width: '100px' }} />
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>Trigger alert when vehicle parked ≥ this many days (Auto-saves instantly)</span>
                </div>
                <div className="form-group">
                    <label className="form-label">Alert Email Recipient</label>
                    <input type="email" className="form-input" value={alertEmail} onChange={e => setAlertEmail(e.target.value)} />
                </div>
                <div className="form-group">
                    <label className="form-label">SMTP Host</label>
                    <input type="text" className="form-input" value={smtpHost} onChange={e => setSmtpHost(e.target.value)} />
                </div>
            </motion.div>

            {/* Appearance & Theme */}
            <motion.div className="card" style={{ marginBottom: '16px' }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                <div className="card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Globe size={18} style={{ color: 'var(--yellow)' }} />
                        <div className="card-title">Appearance & Theme</div>
                    </div>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                    Choose your preferred interface style.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <button 
                        className={`btn ${theme === 'dark' ? 'btn-primary' : 'btn-secondary'}`} 
                        onClick={() => setTheme('dark')}
                        style={{ justifyContent: 'center' }}
                    >
                        Black Mode (Dark)
                    </button>
                    <button 
                        className={`btn ${theme === 'light' ? 'btn-primary' : 'btn-secondary'}`} 
                        onClick={() => setTheme('light')}
                        style={{ justifyContent: 'center' }}
                    >
                        White Mode (Light)
                    </button>
                </div>
            </motion.div>

            {/* Save */}
            <button className="btn btn-primary" onClick={handleSave} style={{ width: '100%' }}>
                <Save size={16} /> {saved ? '✓ Settings Saved!' : 'Save All Settings'}
            </button>
        </div>
    );
}
