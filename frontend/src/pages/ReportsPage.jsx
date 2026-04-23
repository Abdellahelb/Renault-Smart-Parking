import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileText, Download, Calendar, BarChart3, PieChart, TrendingUp, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfQuarter, endOfQuarter, format } from 'date-fns';
import io from 'socket.io-client';
import useAuthStore from '../store/authStore';




const blockUtilization = [
    { block: 'A', utilization: 60 }, { block: 'B', utilization: 73 },
    { block: 'C', utilization: 83 }, { block: 'D', utilization: 50 },
    { block: 'E', utilization: 78 }, { block: 'F', utilization: 94 },
    { block: 'G', utilization: 42 }, { block: 'H', utilization: 69 },
    { block: 'I', utilization: 56 },
];

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div style={{ background: '#1E1E1E', border: '1px solid #2A2A2A', borderRadius: '8px', padding: '10px 14px' }}>
                <p style={{ color: '#B0B0B0', fontSize: '0.75rem', marginBottom: '4px' }}>{label}</p>
                {payload.map((e, i) => (
                    <p key={i} style={{ color: e.color, fontSize: '0.85rem', fontWeight: 600 }}>{e.name}: {e.value}</p>
                ))}
            </div>
        );
    }
    return null;
};

export default function ReportsPage() {
    const { token } = useAuthStore();
    const [period, setPeriod] = useState('month');
    const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
    const [dateTo, setDateTo] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            setLoading(true);
            try {
                const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/stats?from=${dateFrom}&to=${dateTo}&period=${period}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                setStats(data);
            } catch (err) {
                console.error('Failed to fetch stats:', err);
            } finally {
                setLoading(false);
            }
        };

        if (token) {
            fetchStats();

            const socket = io(import.meta.env.VITE_API_URL);

            const refresh = () => {
                // Silently refresh without full loading state for real-time feel
                fetch(`${import.meta.env.VITE_API_URL}/api/v1/stats?from=${dateFrom}&to=${dateTo}&period=${period}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
                    .then(res => res.json())
                    .then(data => setStats(data))
                    .catch(err => console.error('Real-time update failed:', err));
            };

            socket.on('vehicle:arrived', refresh);
            socket.on('vehicle:departed', refresh);
            socket.on('spot:updated', refresh);

            return () => socket.disconnect();
        }
    }, [token, dateFrom, dateTo, period]);

    const handlePeriodChange = (p) => {
        setPeriod(p);
        const now = new Date();
        let from, to;
        switch (p) {
            case 'week':
                from = startOfWeek(now);
                to = endOfWeek(now);
                break;
            case 'month':
                from = startOfMonth(now);
                to = endOfMonth(now);
                break;
            case 'quarter':
                from = startOfQuarter(now);
                to = endOfQuarter(now);
                break;
            case 'custom':
                return;
            default:
                return;
        }
        setDateFrom(format(from, 'yyyy-MM-dd'));
        setDateTo(format(to, 'yyyy-MM-dd'));
    };

    const exportCSV = () => {
        if (!stats) return;
        const headers = ['Metric', 'Value'];
        const rows = [
            ['Total Entries', stats.entries],
            ['Total Exits', stats.exits],
            ['Avg Occupancy', stats.saturation + '%'],
            ['Critical Alerts', stats.criticalAlerts]
        ];
        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `SPM_Report_${period}_${dateFrom}_to_${dateTo}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };



    return (
        <div>
            {/* Controls */}
            <motion.div className="card" style={{ marginBottom: '16px' }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Period</label>
                        <select className="form-input" value={period} onChange={e => handlePeriodChange(e.target.value)} style={{ width: '150px' }}>
                            <option value="week">This Week</option>
                            <option value="month">This Month</option>
                            <option value="quarter">This Quarter</option>
                            <option value="custom">Custom Range</option>
                        </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">From</label>
                        <input type="date" className="form-input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ width: '160px' }} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">To</label>
                        <input type="date" className="form-input" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ width: '160px' }} />
                    </div>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                        <button className="btn btn-secondary" onClick={exportCSV}><Download size={14} /> Export CSV</button>
                    </div>
                </div>
            </motion.div>

            {/* KPIs */}
            <div className="kpi-grid" style={{ marginBottom: '16px', position: 'relative' }}>
                {loading && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.2)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', backdropFilter: 'blur(2px)' }}>
                        <Loader2 className="animate-spin" size={24} style={{ color: 'var(--yellow)' }} />
                    </div>
                )}
                {[
                    { icon: BarChart3, label: 'Total Entries', value: stats?.entries || 0, color: 'yellow', trend: `In period` },
                    { icon: Download, label: 'Total Exits', value: stats?.exits || 0, color: 'orange', trend: `In period` },
                    { icon: TrendingUp, label: 'Avg Occupancy', value: (stats?.saturation || 0) + '%', color: 'green', trend: `In period` },
                    { icon: PieChart, label: 'Avg Dwell Time', value: (stats?.avgDwellDays || 3.2) + ' days', color: 'blue', trend: `Avg Estimate` },
                ].map((kpi, i) => (
                    <motion.div key={kpi.label} className={`kpi-card ${kpi.color}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                        <div className={`kpi-icon ${kpi.color}`}><kpi.icon size={22} /></div>
                        <div className="kpi-value">{kpi.value}</div>
                        <div className="kpi-label">{kpi.label}</div>
                        <div className="kpi-trend up" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{kpi.trend}</div>
                    </motion.div>
                ))}
            </div>

            {/* Charts */}
            <div className="grid-2" style={{ gap: '16px' }}>
                <motion.div className="card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                    <div className="card-header">
                        <div className="card-title">Monthly Vehicle Flow</div>
                    </div>
                    <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={stats?.flowData || []}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                            <XAxis dataKey="month" stroke="#666" fontSize={12} />
                            <YAxis stroke="#666" fontSize={12} />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar dataKey="entries" name="Entries" fill="#F7C948" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="exits" name="Exits" fill="#2D2D2D" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </motion.div>

                <motion.div className="card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                    <div className="card-header">
                        <div className="card-title">Block Utilization (%)</div>
                    </div>
                    <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={stats?.blockStats || []} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                            <XAxis type="number" domain={[0, 100]} stroke="#666" fontSize={12} />
                            <YAxis dataKey="name" type="category" stroke="#666" fontSize={12} width={30} />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar dataKey="pct" name="Utilization %" fill="#F7C948" radius={[0, 4, 4, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </motion.div>
            </div>
        </div>
    );
}
