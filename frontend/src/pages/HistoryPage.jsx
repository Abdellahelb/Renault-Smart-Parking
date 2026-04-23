import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Filter, History, Car, ArrowRight, User, Download } from 'lucide-react';
import io from 'socket.io-client';
import useAuthStore from '../store/authStore';

export default function HistoryPage() {
    const { token } = useAuthStore();
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/history`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const data = await res.json();
                setHistory(data.history || []);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        if (token) {
            fetchHistory();

            const socket = io(import.meta.env.VITE_API_URL);
            const handleRefresh = () => {
                // Slight delay to ensure SQLite has finished transaction
                setTimeout(fetchHistory, 200);
            };

            socket.on('vehicle:arrived', handleRefresh);
            socket.on('vehicle:departed', handleRefresh);

            return () => socket.disconnect();
        }
    }, [token]);

    const filtered = history.filter(h => {
        const query = filter.toLowerCase();
        const v = (h.vin || '').toLowerCase();
        const opName = (h.operator_name || '').toLowerCase();
        const opId = (h.operator_id || '').toLowerCase();
        const sp = (h.spot || '').toLowerCase();
        return v.includes(query) || opName.includes(query) || opId.includes(query) || sp.includes(query);
    });

    const downloadCSV = () => {
        if (!filtered || filtered.length === 0) return;

        const headers = ['Timestamp', 'Action', 'VIN', 'Spot', 'Parking', 'Operator'];
        const csvRows = [headers.join(',')];

        filtered.forEach(log => {
            const row = [
                new Date(log.timestamp).toLocaleString().replace(/,/g, ''),
                (log.action || '').toUpperCase().replace(/,/g, ''),
                (log.vin || '').replace(/,/g, ''),
                (log.spot || '').replace(/,/g, ''),
                (log.parking || '').replace(/,/g, ''),
                (log.operator_name || log.operator_id || 'System').replace(/,/g, '')
            ];
            csvRows.push(row.join(','));
        });

        const csvString = csvRows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('hidden', '');
        a.setAttribute('href', url);
        a.setAttribute('download', `SPM_Audit_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const getActionBadge = (action) => {
        if (action === 'CHECK_IN' || action === 'checkin' || action === 'ARRIVED') return <span className="badge badge-occupied" style={{ minWidth: '100px', justifyContent: 'center' }}>CHECK-IN</span>;
        if (action === 'CHECK_OUT' || action === 'checkout' || action === 'DEPARTED' || action === 'RELEASED') return <span className="badge badge-available" style={{ minWidth: '100px', justifyContent: 'center' }}>RELEASED</span>;
        if (action === 'CREATE_VIRTUAL_PARK') return <span className="badge badge-available" style={{ minWidth: '100px', justifyContent: 'center', background: 'var(--blue)', color: 'white' }}>PARK CREATED</span>;
        if (action === 'DELETE_VIRTUAL_PARK') return <span className="badge badge-alert" style={{ minWidth: '100px', justifyContent: 'center' }}>PARK DELETED</span>;
        if (action === 'TOGGLE_VIRTUAL_PARK') return <span className="badge badge-admin" style={{ minWidth: '100px', justifyContent: 'center', background: 'var(--orange)', color: 'white' }}>PARK TOGGLE</span>;
        return <span className="badge badge-admin" style={{ minWidth: '100px', justifyContent: 'center' }}>{action}</span>;
    };

    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="kpi-icon blue"><History size={24} /></div>
                    <div>
                        <h2 className="page-title" style={{ margin: 0 }}>Action History</h2>
                        <div className="text-muted">Global chronological log of all vehicle and user actions</div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ position: 'relative', width: '280px' }}>
                        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Search VIN or Operator..."
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            style={{ paddingLeft: '36px', width: '100%', borderRadius: '20px', background: 'var(--bg-card)' }}
                        />
                    </div>
                    <button className="btn btn-secondary" onClick={downloadCSV} title="Export to CSV">
                        <Download size={16} /> Export CSV
                    </button>
                    <button className="btn btn-secondary">
                        <Filter size={16} /> Filters
                    </button>
                </div>
            </div>

            {/* History Table */}
            <motion.div className="card" style={{ padding: 0, overflow: 'hidden' }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                {loading ? (
                    <div style={{ padding: '80px', textAlign: 'center', color: 'var(--blue)' }}>
                        <span className="login-spinner" style={{ display: 'inline-block', marginBottom: '16px', borderColor: 'var(--blue) transparent transparent transparent' }}></span>
                        <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>Loading Activity Logs...</div>
                    </div>
                ) : filtered.length === 0 ? (
                    <div style={{ padding: '80px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <History size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
                        <div style={{ fontSize: '1.1rem' }}>No history records found.</div>
                        <div style={{ fontSize: '0.85rem', marginTop: '8px' }}>Try adjusting your search filters.</div>
                    </div>
                ) : (
                    <div className="table-responsive">
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                                <tr style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                    <th style={{ padding: '20px 24px', fontWeight: 600 }}>Timestamp</th>
                                    <th style={{ padding: '20px 24px', fontWeight: 600 }}>Action Taken</th>
                                    <th style={{ padding: '20px 24px', fontWeight: 600 }}>Vehicle / VIN</th>
                                    <th style={{ padding: '20px 24px', fontWeight: 600 }}>Location</th>
                                    <th style={{ padding: '20px 24px', fontWeight: 600 }}>Operator ID</th>
                                </tr>
                            </thead>
                            <tbody>
                                <AnimatePresence>
                                    {filtered.map((log, i) => (
                                        <motion.tr
                                            key={log.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: i * 0.02 }}
                                            style={{
                                                borderBottom: '1px solid var(--border-color)',
                                                fontSize: '0.95rem',
                                                transition: 'background 0.2s',
                                                cursor: 'default'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <td style={{ padding: '20px 24px', color: 'var(--text-secondary)' }}>
                                                {new Date(log.timestamp).toLocaleString()}
                                            </td>
                                            <td style={{ padding: '20px 24px' }}>
                                                {getActionBadge(log.action)}
                                            </td>
                                            <td style={{ padding: '20px 24px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <div className="kpi-icon blue" style={{ width: '32px', height: '32px', marginBottom: 0 }}>
                                                        <Car size={16} />
                                                    </div>
                                                    <span style={{ fontFamily: 'monospace', color: 'var(--text-primary)', fontWeight: 600, letterSpacing: '1px' }}>{log.vin}</span>
                                                </div>
                                            </td>
                                            <td style={{ padding: '20px 24px' }}>
                                                {log.spot ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                        <span style={{ fontWeight: 600, color: 'var(--yellow)' }}>Spot {log.spot}</span>
                                                        <span className="text-muted" style={{ fontSize: '0.8rem' }}>{log.parking}</span>
                                                    </div>
                                                ) : <span className="text-muted">-</span>}
                                            </td>
                                            <td style={{ padding: '20px 24px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)' }}>
                                                        <User size={14} className="text-muted" />
                                                    </div>
                                                    <span style={{ fontWeight: 500 }}>{log.operator_name || log.operator_id || 'System'}</span>
                                                </div>
                                            </td>
                                        </motion.tr>
                                    ))}
                                </AnimatePresence>
                            </tbody>
                        </table>
                    </div>
                )}
            </motion.div>
        </div>
    );
}
