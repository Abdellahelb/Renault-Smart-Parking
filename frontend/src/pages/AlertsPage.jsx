import { API_URL, SOCKET_URL } from '../api_config';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bell, AlertTriangle, CheckCircle2, Clock, Eye, Filter } from 'lucide-react';
import io from 'socket.io-client';
import useAuthStore from '../store/authStore';

export default function AlertsPage() {
    const [alerts, setAlerts] = useState([]);
    const [filter, setFilter] = useState('all');
    const { token } = useAuthStore();

    const fetchAlerts = async () => {
        if (!token) return;
        try {
            const res = await fetch(`${API_URL}/alerts`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            // Retain acknowledged/resolved state matching alerts since backend only gives 'active' state
            setAlerts(prev => {
                const existingState = new Map(prev.map(a => [a.id, a]));
                return data.alerts.map(newAlert => {
                    const existing = existingState.get(newAlert.id);
                    if (existing && existing.status !== 'active') {
                        return { ...newAlert, status: existing.status, acknowledgedBy: existing.acknowledgedBy, resolvedAt: existing.resolvedAt };
                    }
                    return newAlert;
                });
            });
        } catch (err) {
            console.error('Failed to fetch live alerts:', err);
        }
    };

    useEffect(() => {
        fetchAlerts();
        let socket;
        if (token) {
            socket = io(SOCKET_URL);
            socket.on('spot:updated', fetchAlerts);
            socket.on('vehicle:departed', fetchAlerts);
            socket.on('vehicle:arrived', fetchAlerts);
        }
        return () => {
            if (socket) socket.disconnect();
        };
    }, [token]);

    const filtered = alerts.filter(a => filter === 'all' || a.status === filter);

    const acknowledge = (id) => {
        setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'acknowledged', acknowledgedBy: 'Admin' } : a));
    };

    const resolve = (id) => {
        setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'resolved', resolvedAt: new Date().toISOString() } : a));
    };

    const severityColors = { critical: 'var(--red)', high: 'var(--orange)', medium: 'var(--yellow)' };
    const statusIcons = {
        active: <AlertTriangle size={16} />,
        acknowledged: <Eye size={16} />,
        resolved: <CheckCircle2 size={16} />,
    };

    const activeCount = alerts.filter(a => a.status === 'active').length;
    const criticalCount = alerts.filter(a => a.severity === 'critical' && a.status !== 'resolved').length;

    return (
        <div>
            {/* Summary */}
            <div className="kpi-grid" style={{ marginBottom: '16px' }}>
                <motion.div className="kpi-card red" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <div className="kpi-icon red"><AlertTriangle size={22} /></div>
                    <div className="kpi-value">{activeCount}</div>
                    <div className="kpi-label">Active Alerts</div>
                </motion.div>
                <motion.div className="kpi-card orange" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                    <div className="kpi-icon orange"><Bell size={22} /></div>
                    <div className="kpi-value">{criticalCount}</div>
                    <div className="kpi-label">Critical (≥8 days)</div>
                </motion.div>
                <motion.div className="kpi-card green" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                    <div className="kpi-icon green"><CheckCircle2 size={22} /></div>
                    <div className="kpi-value">{alerts.filter(a => a.status === 'resolved').length}</div>
                    <div className="kpi-label">Resolved This Week</div>
                </motion.div>
            </div>

            {/* Filters */}
            <div className="parking-filters" style={{ marginBottom: '16px' }}>
                <Filter size={16} style={{ color: 'var(--text-muted)' }} />
                {['all', 'active', 'acknowledged', 'resolved'].map(f => (
                    <button key={f} className={`parking-filter-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                        {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                ))}
            </div>

            {/* Alert List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {filtered.map((alert, i) => (
                    <motion.div
                        key={alert.id}
                        className="card"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        style={{
                            borderLeftWidth: '4px',
                            borderLeftColor: severityColors[alert.severity],
                            animation: alert.status === 'active' && alert.severity === 'critical' ? 'pulse-badge 2s infinite' : 'none',
                        }}
                    >
                        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                            <div style={{
                                width: '44px', height: '44px', borderRadius: '10px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: alert.status === 'resolved' ? 'var(--green-dim)' : alert.severity === 'critical' ? 'var(--red-dim)' : 'var(--orange-dim)',
                                color: alert.status === 'resolved' ? 'var(--green)' : severityColors[alert.severity],
                                flexShrink: 0,
                            }}>
                                {statusIcons[alert.status]}
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--yellow)' }}>{alert.spot}</span>
                                        <span className={`badge ${alert.severity === 'critical' ? 'badge-alert' : 'badge-reserved'}`}>{alert.days} DAYS</span>
                                        <span className={`badge ${alert.status === 'resolved' ? 'badge-available' : alert.status === 'acknowledged' ? 'badge-reserved' : 'badge-occupied'}`}>{alert.status}</span>
                                    </div>
                                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                        Triggered: {new Date(alert.triggeredAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                                    </span>
                                </div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                    <span style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{alert.vin}</span>
                                    <span style={{ color: 'var(--text-muted)' }}> · {alert.model} · Block {alert.block} · {alert.parking}</span>
                                </div>
                                {alert.status === 'active' && (
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button className="btn btn-sm btn-secondary" onClick={() => acknowledge(alert.id)}>
                                            <Eye size={14} /> Acknowledge (Snooze 24h)
                                        </button>
                                        <button className="btn btn-sm btn-danger" onClick={() => resolve(alert.id)}>
                                            <CheckCircle2 size={14} /> Mark Resolved
                                        </button>
                                    </div>
                                )}
                                {alert.status === 'acknowledged' && (
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Acknowledged by {alert.acknowledgedBy}</span>
                                        <button className="btn btn-sm btn-danger" onClick={() => resolve(alert.id)}>
                                            <CheckCircle2 size={14} /> Resolve
                                        </button>
                                    </div>
                                )}
                                {alert.status === 'resolved' && alert.resolvedAt && (
                                    <span style={{ fontSize: '0.75rem', color: 'var(--green)' }}>
                                        ✓ Resolved on {new Date(alert.resolvedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                )}
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
