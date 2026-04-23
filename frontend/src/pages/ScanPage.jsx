import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScanBarcode, CheckCircle2, XCircle, MapPin, Car, ArrowRight, RotateCcw, Zap } from 'lucide-react';
import io from 'socket.io-client';
import useParkingStore from '../store/parkingStore';
import useAuthStore from '../store/authStore';

export default function ScanPage() {
    const [vin, setVin] = useState('');
    const [scanning, setScanning] = useState(false);
    const [result, setResult] = useState(null);
    const [history, setHistory] = useState([]);
    const inputRef = useRef(null);

    useEffect(() => {
        inputRef.current?.focus();

        const fetchHistory = async () => {
            try {
                const { token } = useAuthStore.getState();
                const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/history`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const data = await res.json();
                // We only want the vehicle-related history for this page
                const scans = (data.history || [])
                    .filter(h => h.vin)
                    .slice(0, 10)
                    .map(h => ({
                        vin: h.vin,
                        action: h.action.toLowerCase().includes('in') || h.action === 'ARRIVED' ? 'checkin' : 'checkout',
                        spot: h.spot,
                        parking: h.parking,
                        time: new Date(h.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                    }));
                setHistory(scans);
            } catch (err) {
                console.error('Failed to fetch scan history:', err);
            }
        };

        fetchHistory();

        const socket = io(import.meta.env.VITE_API_URL);
        socket.on('vehicle:arrived', fetchHistory);
        socket.on('vehicle:departed', fetchHistory);

        return () => socket.disconnect();
    }, []);

    const validateVIN = (v) => {
        if (v.length !== 17) return 'VIN must be exactly 17 characters';
        if (/[IOQ]/i.test(v)) return 'VIN cannot contain I, O, or Q';
        if (!/^[A-HJ-NPR-Z0-9]{17}$/i.test(v)) return 'Invalid VIN format';
        return null;
    };

    const handleScan = async () => {
        const error = validateVIN(vin);
        if (error) {
            setResult({ success: false, error });
            return;
        }

        setScanning(true);
        setResult(null);

        try {
            const { token } = useAuthStore.getState();
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/vehicles/checkin`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ vin })
            });
            const data = await res.json();

            if (!res.ok) {
                setResult({ success: false, error: data.error || 'Server connection failed' });
            } else {
                setResult({
                    success: true,
                    action: data.action,     // 'checkin' or 'checkout'
                    vin: data.vin,
                    spot: data.spot,
                    block: data.block || '-',
                    parking: data.parking,
                    message: data.message    // "Vehicle assigned..." or "Vehicle sorted..."
                });
                setHistory(prev => [{
                    vin: data.vin,
                    action: data.action,
                    spot: data.spot,
                    time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                    parking: data.parking,
                }, ...prev]);
            }
        } catch (err) {
            setResult({ success: false, error: 'Network error connecting to scanner API' });
        } finally {
            setScanning(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleScan();
    };

    const reset = () => {
        setVin('');
        setResult(null);
        inputRef.current?.focus();
    };

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            {/* Scanner Card */}
            <motion.div
                className="card"
                style={{ marginBottom: '24px', borderColor: scanning ? 'var(--yellow-border)' : undefined }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <div className="card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className="kpi-icon yellow" style={{ width: '40px', height: '40px' }}>
                            <ScanBarcode size={20} />
                        </div>
                        <div>
                            <div className="card-title">VIN Scanner</div>
                            <div className="card-subtitle">Scan or enter VIN · First scan = Check In · Second scan = Check Out</div>
                        </div>
                    </div>
                </div>

                {/* VIN Input */}
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                    <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                        <label className="form-label">Vehicle Identification Number</label>
                        <input
                            ref={inputRef}
                            type="text"
                            className="form-input"
                            placeholder="Scan barcode or type 17-character VIN..."
                            value={vin}
                            onChange={e => setVin(e.target.value.toUpperCase())}
                            onKeyDown={handleKeyDown}
                            maxLength={17}
                            style={{
                                fontSize: '1.1rem',
                                fontFamily: 'var(--font-display)',
                                letterSpacing: '2px',
                                padding: '14px',
                            }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                Format: 17 alphanumeric characters (no I, O, Q)
                            </span>
                            <span style={{ fontSize: '0.7rem', color: vin.length === 17 ? 'var(--green)' : 'var(--text-muted)', fontWeight: 600 }}>
                                {vin.length}/17
                            </span>
                        </div>
                    </div>
                    <button
                        className="btn btn-primary"
                        onClick={handleScan}
                        disabled={scanning || vin.length === 0}
                        style={{ height: '48px', padding: '0 24px', marginBottom: '20px' }}
                    >
                        {scanning ? (
                            <span className="login-spinner" style={{ borderColor: 'rgba(13,13,13,0.3)', borderTopColor: '#0D0D0D' }}></span>
                        ) : (
                            <><ScanBarcode size={18} /> SCAN</>
                        )}
                    </button>
                </div>

                {/* Scan Animation */}
                <AnimatePresence>
                    {scanning && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            style={{
                                marginTop: '16px', padding: '20px', textAlign: 'center',
                                background: 'var(--bg-surface)', borderRadius: '8px',
                                border: '1px solid var(--yellow-border)',
                            }}
                        >
                            <motion.div
                                animate={{ opacity: [0.3, 1, 0.3] }}
                                transition={{ duration: 1.5, repeat: Infinity }}
                                style={{ color: 'var(--yellow)', fontSize: '0.85rem', fontWeight: 600 }}
                            >
                                <Zap size={20} style={{ display: 'inline', marginRight: '8px' }} />
                                Processing VIN... Assigning optimal spot...
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Result */}
                <AnimatePresence>
                    {result && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            style={{
                                marginTop: '16px', padding: '20px', borderRadius: '12px',
                                background: result.success ?
                                    (result.action === 'checkout' ? 'var(--blue-dim)' : 'var(--green-dim)') :
                                    'var(--red-dim)',
                                border: `1px solid ${result.success ?
                                    (result.action === 'checkout' ? 'rgba(33,150,243,0.3)' : 'rgba(67,160,71,0.3)') :
                                    'rgba(229,57,53,0.3)'}`,
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                {result.success ? (
                                    <CheckCircle2 size={24} style={{ color: result.action === 'checkout' ? 'var(--blue)' : 'var(--green)', flexShrink: 0, marginTop: '2px' }} />
                                ) : (
                                    <XCircle size={24} style={{ color: 'var(--red)', flexShrink: 0, marginTop: '2px' }} />
                                )}
                                <div style={{ flex: 1 }}>
                                    <div style={{
                                        fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, marginBottom: '4px',
                                        color: result.success ? (result.action === 'checkout' ? 'var(--blue)' : 'var(--green)') : 'var(--red)',
                                    }}>
                                        {result.success ?
                                            (result.action === 'checkout' ? '✓ VEHICLE CHECKED OUT' : '✓ SPOT ASSIGNED') :
                                            '✗ SCAN FAILED'}
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                        {result.message || result.error}
                                    </div>
                                    {result.success && (
                                        <div style={{
                                            display: 'flex', gap: '16px', padding: '12px',
                                            background: 'rgba(0,0,0,0.2)', borderRadius: '8px',
                                        }}>
                                            <div>
                                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Spot</div>
                                                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 700, color: 'var(--yellow)' }}>
                                                    {result.spot}
                                                </div>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Parking</div>
                                                <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{result.parking}</div>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Action</div>
                                                <div style={{ fontSize: '0.9rem', fontWeight: 600, textTransform: 'capitalize' }}>{result.action}</div>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>VIN</div>
                                                <div style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>{result.vin}</div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <button className="btn btn-secondary" onClick={reset} style={{ marginTop: '12px' }}>
                                <RotateCcw size={14} /> Scan Next Vehicle
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>

            {/* Scan History */}
            <motion.div className="card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <div className="card-header">
                    <div className="card-title">Recent Scans</div>
                    <div className="card-subtitle">Today's scan history</div>
                </div>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>VIN</th>
                            <th>Action</th>
                            <th>Spot</th>
                            <th>Parking</th>
                            <th>Time</th>
                        </tr>
                    </thead>
                    <tbody>
                        {history.map((item, i) => (
                            <tr key={i}>
                                <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{item.vin}</td>
                                <td>
                                    <span className={`badge ${item.action === 'checkin' ? 'badge-available' : 'badge-occupied'}`}>
                                        {item.action === 'checkin' ? '↓ CHECK IN' : '↑ CHECK OUT'}
                                    </span>
                                </td>
                                <td style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--yellow)' }}>{item.spot}</td>
                                <td>{item.parking}</td>
                                <td style={{ color: 'var(--text-muted)' }}>{item.time}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </motion.div>
        </div>
    );
}
