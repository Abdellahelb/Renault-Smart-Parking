import { API_URL, SOCKET_URL } from '../api_config';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
    Car, TrendingUp, TrendingDown, Clock, AlertTriangle,
    BarChart3, Activity, Zap, Users, ArrowUpRight, ArrowDownRight,
    CheckCircle2, XCircle, Bell
} from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import io from 'socket.io-client';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';

const fadeIn = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4 }
};

const occupancyData = [
    { time: '06:00', count: 25 },
    { time: '08:00', count: 85 },
    { time: '10:00', count: 142 },
    { time: '12:00', count: 178 },
    { time: '14:00', count: 195 },
    { time: '16:00', count: 210 },
    { time: '18:00', count: 165 },
    { time: '20:00', count: 120 },
    { time: '22:00', count: 95 },
];

const blockData = [
    { name: 'A', vehicles: 12, capacity: 20, pct: 60 },
    { name: 'B', vehicles: 22, capacity: 30, pct: 73 },
    { name: 'C', vehicles: 30, capacity: 36, pct: 83 },
    { name: 'D', vehicles: 18, capacity: 36, pct: 50 },
    { name: 'E', vehicles: 28, capacity: 36, pct: 77 },
    { name: 'F', vehicles: 34, capacity: 36, pct: 94 },
    { name: 'G', vehicles: 15, capacity: 36, pct: 41 },
    { name: 'H', vehicles: 25, capacity: 36, pct: 69 },
    { name: 'I', vehicles: 20, capacity: 36, pct: 55 },
];

const weeklyData = [
    { day: 'Mon', entries: 45, exits: 38 },
    { day: 'Tue', entries: 52, exits: 48 },
    { day: 'Wed', entries: 49, exits: 44 },
    { day: 'Thu', entries: 63, exits: 55 },
    { day: 'Fri', entries: 58, exits: 62 },
    { day: 'Sat', entries: 22, exits: 30 },
    { day: 'Sun', entries: 15, exits: 20 },
];
const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div style={{ background: '#111', border: '1px solid #333', padding: '8px 12px', borderRadius: '4px' }}>
                <p style={{ margin: 0, fontSize: '12px', color: '#888' }}>{label}</p>
                {payload.map((entry, index) => (
                    <p key={index} style={{ margin: '4px 0 0', fontSize: '13px', color: entry.color, fontWeight: 'bold' }}>
                        {entry.name}: {entry.value}
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

export default function DashboardPage() {
    const { token } = useAuthStore();
    const navigate = useNavigate();
    const [stats, setStats] = useState({
        dailyVolume: 204,
        saturation: 68.5,
        avgDwell: 3.2,
        criticalAlerts: 3,
        blockStats: blockData
    });
    const [activity, setActivity] = useState([]);
    const [alerts, setAlerts] = useState([
        { id: '1', spot: 'F3', days: 9, severity: 'critical', desc: 'VF1BZ000458' },
        { id: '2', spot: 'A12', days: 7, severity: 'high', desc: 'VF1CL020199' },
    ]);
    const [loading, setLoading] = useState(true);

    const fetchStats = async () => {
        try {
            const res = await fetch(`${API_URL}/stats`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            setStats(prev => ({ ...prev, ...data }));
        } catch (err) {
            console.error('Failed to fetch stats:', err);
        }
    };

    const fetchActivity = async () => {
        try {
            const res = await fetch(`${API_URL}/recent-activity`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            setActivity(data.activity || []);
        } catch (err) {
            console.error('Failed to fetch activity:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (token) {
            fetchStats();
            fetchActivity();
            const socket = io(SOCKET_URL);
            const refresh = () => {
                fetchStats();
                fetchActivity();
            };

            socket.on('vehicle:arrived', refresh);
            socket.on('vehicle:departed', refresh);
            socket.on('spot:updated', refresh);

            return () => socket.disconnect();
        }
    }, [token]);

    const formatRelativeTime = (timestamp) => {
        if (!timestamp) return '...';
        const diff = Date.now() - new Date(timestamp).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        return new Date(timestamp).toLocaleDateString();
    };

    return (
        <div className="dashboard">
            {/* KPI Cards */}
            <motion.div className="kpi-grid" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <div className="kpi-card yellow">
                    <div className="kpi-icon yellow"><Car size={22} /></div>
                    <div className="kpi-value">{stats.dailyVolume}</div>
                    <div className="kpi-label">Daily Processing Volume</div>
                    <div className="kpi-trend up"><ArrowUpRight size={14} /> LIVE UPDATE</div>
                </div>

                <div className="kpi-card green">
                    <div className="kpi-icon green"><BarChart3 size={22} /></div>
                    <div className="kpi-value">{stats.saturation}%</div>
                    <div className="kpi-label">Parking Saturation Level</div>
                    <div className="kpi-trend up"><ArrowUpRight size={14} /> Global Capacity</div>
                </div>

                <div className="kpi-card blue">
                    <div className="kpi-icon blue"><Clock size={22} /></div>
                    <div className="kpi-value">3.2d</div>
                    <div className="kpi-label">Mean Storage Duration</div>
                    <div className="kpi-trend down"><ArrowDownRight size={14} /> Historical Avg</div>
                </div>

                <div className="kpi-card red">
                    <div className="kpi-icon red"><AlertTriangle size={22} /></div>
                    <div className="kpi-value">{stats.criticalAlerts}</div>
                    <div className="kpi-label">Critical SLA Alerts</div>
                    <div className="kpi-trend down"><Bell size={14} /> VINs &gt; 8 days</div>
                </div>
            </motion.div>

            {/* Charts Row */}
            <div className="grid-2 mb-4" style={{ gap: '16px' }}>
                {/* Occupancy Trend */}
                <motion.div className="card" {...fadeIn} transition={{ delay: 0.1 }}>
                    <div className="card-header">
                        <div>
                            <div className="card-title">Occupancy Trend</div>
                            <div className="card-subtitle">Today's vehicle count by hour</div>
                        </div>
                        <span className="badge badge-available">LIVE</span>
                    </div>
                    <ResponsiveContainer width="100%" height={250}>
                        <AreaChart data={occupancyData}>
                            <defs>
                                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#F7C948" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#F7C948" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                            <XAxis dataKey="time" stroke="#666" fontSize={12} />
                            <YAxis stroke="#666" fontSize={12} />
                            <Tooltip />
                            <Area type="monotone" dataKey="count" name="Vehicles" stroke="#F7C948" fillOpacity={1} fill="url(#colorCount)" strokeWidth={2} />
                        </AreaChart>
                    </ResponsiveContainer>
                </motion.div>

                {/* Weekly Flow */}
                <motion.div className="card" {...fadeIn} transition={{ delay: 0.15 }}>
                    <div className="card-header">
                        <div>
                            <div className="card-title">Weekly Vehicle Flow</div>
                            <div className="card-subtitle">Entries vs Exits this week</div>
                        </div>
                    </div>
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={weeklyData} barGap={4}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                            <XAxis dataKey="day" stroke="#666" fontSize={12} />
                            <YAxis stroke="#666" fontSize={12} />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar dataKey="entries" name="Entries" fill="#F7C948" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="exits" name="Exits" fill="#2D2D2D" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </motion.div>
            </div>

            {/* Block Heatmap + AI Insight + Alerts */}
            <div className="grid-3 mb-4" style={{ gap: '16px' }}>
                {/* Block Heatmap */}
                <motion.div className="card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                    <div className="card-header">
                        <div>
                            <div className="card-title">Sector Saturation Metrics</div>
                            <div className="card-subtitle">Global Facility blocks</div>
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                        {(stats.blockStats.length > 0 ? stats.blockStats : blockData).map(block => {
                            const pct = block.pct || Math.round((block.vehicles / block.capacity) * 100);
                            const color = pct > 85 ? '#E53935' : pct > 60 ? '#FF9800' : '#43A047';
                            return (
                                <div key={block.name} style={{
                                    background: 'var(--bg-card)',
                                    borderRadius: '16px',
                                    padding: '16px',
                                    textAlign: 'center',
                                    border: `1px solid ${color}30`,
                                    position: 'relative',
                                    overflow: 'hidden',
                                    boxShadow: `0 4px 16px ${color}10`,
                                }}
                                >
                                    <div style={{
                                        position: 'absolute', bottom: 0, left: 0, right: 0,
                                        height: `${pct}%`, background: `linear-gradient(180deg, ${color}20 0%, ${color}05 100%)`,
                                        transition: 'height 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                                    }} />
                                    <div style={{ position: 'relative', zIndex: 1 }}>
                                        <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 700, color }}>{block.name}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{block.vehicles}/{block.capacity}</div>
                                        <div style={{ fontSize: '0.7rem', fontWeight: 600, color, marginTop: '2px' }}>{pct}%</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </motion.div>

                {/* AI Insight Card */}
                <motion.div className="card" {...fadeIn} transition={{ delay: 0.25 }} style={{ borderColor: 'rgba(247,201,72,0.2)' }}>
                    <div className="card-header">
                        <div>
                            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Zap size={16} style={{ color: 'var(--yellow)' }} /> Predictive Diagnostics
                            </div>
                            <div className="card-subtitle">Live system analysis</div>
                        </div>
                        <span className="badge badge-admin">AI</span>
                    </div>
                    <div style={{ fontSize: '0.85rem', lineHeight: '1.8', color: 'var(--text-secondary)' }}>
                        <p style={{ marginBottom: '12px' }}>
                            📊 <strong style={{ color: 'var(--yellow)' }}>Occupancy is trending 12% higher</strong> than last week. Block F is consistently overloaded — consider redistributing incoming vehicles to blocks D and G.
                        </p>
                        <p style={{ marginBottom: '12px' }}>
                            ⚠️ <strong style={{ color: 'var(--orange)' }}>3 vehicles exceed 6-day threshold.</strong> Vehicle VF1BZ000458 in F3 has been parked for 9 days and requires immediate attention.
                        </p>
                        <p style={{ marginBottom: '12px' }}>
                            ⏰ <strong style={{ color: 'var(--text-primary)' }}>Peak hour prediction:</strong> Parking will reach 85% capacity by 14:00 today based on historical Monday patterns.
                        </p>
                        <p>
                            👤 <strong style={{ color: 'var(--green)' }}>Operator efficiency:</strong> Average check-in time improved by 18% this week. J. Dupont leads with 2.1min avg.
                        </p>
                    </div>
                </motion.div>

                {/* Alert Center */}
                <motion.div className="card" {...fadeIn} transition={{ delay: 0.3 }}>
                    <div className="card-header">
                        <div>
                            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <AlertTriangle size={16} style={{ color: 'var(--red)' }} /> Alert Center
                            </div>
                            <div className="card-subtitle">VINs violating storage SLAs</div>
                        </div>
                        <span className="badge badge-alert">{alerts.length}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {alerts.map(alert => (
                            <div key={alert.id} style={{
                                background: 'var(--bg-surface)',
                                borderRadius: '8px',
                                padding: '12px',
                                borderLeft: `3px solid ${alert.severity === 'critical' ? 'var(--red)' : alert.severity === 'high' ? 'var(--orange)' : 'var(--yellow)'}`,
                                animation: alert.severity === 'critical' ? 'pulse-badge 2s infinite' : 'none',
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.9rem' }}>
                                        {alert.spot}
                                    </span>
                                    <span className={`badge ${alert.severity === 'critical' ? 'badge-alert' : 'badge-reserved'}`}>
                                        {alert.days} DAYS
                                    </span>
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    VIN: {alert.vin} · Block {alert.block}
                                </div>
                                <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                                    <button className="btn btn-sm btn-secondary">Acknowledge</button>
                                    <button className="btn btn-sm btn-danger">Resolve</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </motion.div>
            </div>

            {/* Activity Feed */}
            <motion.div className="card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
                <div className="card-header">
                    <div>
                        <div className="card-title">Live System Telemetry</div>
                        <div className="card-subtitle">Real-time platform operations</div>
                    </div>
                    <button className="btn btn-sm btn-secondary" onClick={() => navigate('/history')}>View All</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                    {activity.map(item => (
                        <div key={item.id} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '12px 0',
                            borderBottom: '1px solid var(--border-color)',
                        }}>
                            <div style={{
                                width: '32px', height: '32px', borderRadius: '8px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: item.action === 'CHECK_IN' ? 'var(--green-dim)' : 'var(--blue-dim)',
                                color: item.action === 'CHECK_IN' ? 'var(--green)' : 'var(--blue)',
                            }}>
                                {item.action === 'CHECK_IN' ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                                    <span style={{ textTransform: 'capitalize', color: 'var(--text-primary)' }}>{item.action === 'CHECK_IN' ? 'Check-In' : 'Release'}</span>
                                    <span style={{ color: 'var(--text-muted)' }}> · </span>
                                    <span style={{ color: 'var(--yellow)', fontFamily: 'var(--font-display)' }}>{item.spot}</span>
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    {item.vin}
                                </div>
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                {formatRelativeTime(item.timestamp)}
                            </div>
                        </div>
                    ))}
                    {activity.length === 0 && (
                        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            Waiting for telemetry data...
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
