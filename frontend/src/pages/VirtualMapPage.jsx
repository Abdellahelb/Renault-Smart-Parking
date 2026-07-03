import { API_URL, SOCKET_URL } from '../api_config';
import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Map, ArrowLeft, Car, Clock, User, X, MapPin, Zap } from 'lucide-react';
import io from 'socket.io-client';
import useAuthStore from '../store/authStore';
import useVirtualStore from '../store/virtualStore';
import useSettingsStore from '../store/settingsStore';

// Reuse TopDownCar logic
function TopDownCar({ color = '#2D3436', width = 56, isReserved = false }) {
    const bodyColor = isReserved ? '#FF9800' : color;
    const glassColor = isReserved ? '#FFB74D' : (color === '#F5F5F5' || color === '#E0E0E0') ? '#B0BEC5' : '#1a1a1a';
    const highlightOpacity = (color === '#F5F5F5' || color === '#E0E0E0') ? '0.15' : '0.2';
    const h = width * 2;

    return (
        <svg width={width} height={h} viewBox="0 0 48 96" fill="none" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="24" cy="88" rx="20" ry="5" fill="black" opacity="0.15" />
            <rect x="8" y="10" width="32" height="72" rx="12" fill={bodyColor} />
            <rect x="9" y="11" width="30" height="70" rx="11" fill="none" stroke="white" strokeWidth="0.5" opacity={highlightOpacity} />
            <path d="M12 14 Q24 8 36 14 L36 28 Q24 24 12 28 Z" fill={bodyColor} stroke="white" strokeWidth="0.3" opacity="0.1" />
            <rect x="12" y="26" width="24" height="14" rx="4" fill={glassColor} opacity="0.7" />
            <rect x="13" y="27" width="10" height="12" rx="3" fill="white" opacity="0.08" />
            <rect x="11" y="40" width="26" height="16" rx="3" fill={bodyColor} />
            <rect x="13" y="42" width="22" height="12" rx="2" fill="white" opacity="0.06" />
            <rect x="13" y="56" width="22" height="12" rx="4" fill={glassColor} opacity="0.6" />
            <path d="M12 68 Q24 74 36 68 L36 76 Q24 80 12 76 Z" fill={bodyColor} />
            <rect x="10" y="12" width="8" height="4" rx="2" fill="#FFF9C4" opacity="0.9" />
            <rect x="30" y="12" width="8" height="4" rx="2" fill="#FFF9C4" opacity="0.9" />
            <rect x="10" y="76" width="7" height="3" rx="1.5" fill="#EF5350" opacity="0.9" />
            <rect x="31" y="76" width="7" height="3" rx="1.5" fill="#EF5350" opacity="0.9" />
            <ellipse cx="6" cy="30" rx="2.5" ry="1.5" fill={bodyColor} />
            <ellipse cx="42" cy="30" rx="2.5" ry="1.5" fill={bodyColor} />
        </svg>
    );
}

function ParkingSpot({ spot, onClick }) {
    const maxParkDays = useSettingsStore(state => state.maxParkDays);
    const isEmpty = spot.status === 'empty';
    const isReserved = spot.status === 'reserved';
    const daysParked = spot.occupied_at ? Math.floor((Date.now() - new Date(spot.occupied_at)) / 86400000) : 0;
    const isAlert = daysParked >= maxParkDays || spot.status === 'alert';
    // User request: Red for >6 days, Blue for assigned/occupied
    const carColor = isAlert ? '#E53935' : (isReserved ? '#FF9800' : '#2196F3');

    return (
        <motion.div
            onClick={() => onClick(spot)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
                width: '64px', height: '120px',
                border: `1.5px solid ${isEmpty ? 'rgba(247, 201, 72, 0.3)' : isReserved ? 'var(--yellow)' : isAlert ? 'var(--red)' : 'var(--yellow)'}`,
                background: isEmpty ? 'rgba(255, 255, 255, 0.02)' : isReserved ? 'var(--yellow-dim)' : isAlert ? 'var(--red-dim)' : 'var(--yellow-dim)',
                borderRadius: '8px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                position: 'relative',
                boxShadow: isAlert ? '0 0 15px rgba(229,57,53,0.4)' : 'none',
                animation: isAlert ? 'pulse-alert 2s infinite' : 'none',
            }}
        >
            {isEmpty ? (
                <span style={{ fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.4)', fontFamily: 'var(--font-display)', fontWeight: 600 }}>
                    {spot.spot_label}
                </span>
            ) : (
                <TopDownCar color={carColor} width={56} isReserved={isReserved} />
            )}
            {!isEmpty && (
                <div style={{
                    position: 'absolute',
                    bottom: '2px',
                    fontSize: '0.65rem',
                    color: isAlert ? 'var(--red)' : 'rgba(255,255,255,0.8)',
                    fontWeight: 800,
                    textShadow: isAlert ? '0 0 4px rgba(0,0,0,0.5)' : 'none'
                }}>
                    {spot.spot_label} {isAlert && `(${daysParked}d)`}
                </div>
            )}
        </motion.div>
    );
}

const JOGGER = { length: 5.2, width: 2.4 }; // meters
const DRIVE_LANE = 6.0; // meters

export default function VirtualMapPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { virtualLots } = useVirtualStore();
    const { token } = useAuthStore();
    const maxParkDays = useSettingsStore(state => state.maxParkDays);

    const [spots, setSpots] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedSpot, setSelectedSpot] = useState(null);

    const lot = virtualLots.find(v => v.id === id);

    const fetchSpots = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/virtual/${id}/spots`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            setSpots(data.vehicles || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        let socket;
        if (token && id) {
            fetchSpots();

            socket = io(SOCKET_URL);
            socket.on('spot:updated', (data) => {
                if (data.lot_id && data.lot_id !== id) return; // Ignore updates for other lots
                setSpots(prev => {
                    return prev.map(s => {
                        if (s.spot_label === data.spot_id) {
                            return {
                                ...s,
                                status: data.status,
                                vin: data.vin || null,
                                car_color: data.car_color || s.car_color
                            };
                        }
                        return s;
                    });
                });
            });
        }

        return () => {
            if (socket) socket.disconnect();
        };
    }, [id, token]);

    const onRelease = async (spotId) => {
        try {
            await fetch(`${API_URL}/spots/${spotId}/release`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            });
            setSelectedSpot(null);
            alert('Place released successfully');
            fetchSpots();
        } catch (err) {
            console.error(err);
        }
    };

    const onReserve = async (spotId, fullName, subject) => {
        if (!fullName) return alert('Full Name is required');
        try {
            await fetch(`${API_URL}/spots/${spotId}/reserve`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ fullName, subject })
            });
            setSelectedSpot(null);
            alert('Place reserved successfully');
            fetchSpots();
        } catch (err) {
            console.error(err);
        }
    };

    if (!lot) {
        return <div style={{ padding: '40px', textAlign: 'center' }}>Virtual Park not found.</div>;
    }

    // Reconstruct layout based on dimensions
    const widthM = lot.width || 30;
    const lengthM = lot.length || 50;
    const spotW = JOGGER.width;
    const rowDepth = JOGGER.length;
    const laneWidth = DRIVE_LANE;

    const numLanes = Math.floor(lengthM / (2 * rowDepth + laneWidth));
    const spotsPerRow = Math.floor(widthM / spotW);

    // Group spots into lanes
    const lanes = [];
    for (let l = 0; l < numLanes; l++) {
        const laneStart = l * spotsPerRow * 2;
        const row1 = spots.slice(laneStart, laneStart + spotsPerRow);
        const row2 = spots.slice(laneStart + spotsPerRow, laneStart + spotsPerRow * 2);
        lanes.push({ row1, row2 });
    }
    // Handle remaining spots if any
    const remainingStart = numLanes * spotsPerRow * 2;
    const remainingSpots = spots.slice(remainingStart);
    if (remainingSpots.length > 0) {
        lanes.push({ row1: remainingSpots, row2: [] });
    }

    const occupied = spots.filter(s => s.status !== 'empty').length;
    const pct = spots.length > 0 ? Math.round((occupied / spots.length) * 100) : 0;

    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '24px' }}>
                <div>
                    <button onClick={() => navigate('/admin/virtual')} className="btn btn-secondary" style={{ marginBottom: '16px', padding: '6px 12px', height: 'auto', fontSize: '0.8rem' }}>
                        <ArrowLeft size={14} /> Back to Generator
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="kpi-icon yellow"><Map size={24} /></div>
                        <div>
                            <h2 className="page-title" style={{ margin: 0 }}>{lot.name}</h2>
                            <div className="text-muted">Virtual Zone Map · Dynamic Layout</div>
                        </div>
                    </div>
                </div>

                {/* Stats */}
                <div style={{ display: 'flex', gap: '16px' }}>
                    <div className="card" style={{ padding: '16px', minWidth: '150px' }}>
                        <div className="card-subtitle">Occupancy</div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                            <div style={{ fontSize: '1.8rem', fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--yellow)' }}>
                                {pct}%
                            </div>
                            <div className="text-muted">{occupied} / {spots.length}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Map Grid */}
            <div className="card" style={{ overflowX: 'auto', padding: '40px' }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '100px 0', color: 'var(--yellow)' }}>
                        <span className="login-spinner" style={{ display: 'inline-block', marginBottom: '16px' }}></span>
                        <div>Loading physical states...</div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '40px', alignItems: 'center', minWidth: 'min-content' }}>
                        {lanes.map((lane, lIdx) => (
                            <div key={lIdx} style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                                {/* Row 1 (Facing Lane) */}
                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                    {lane.row1.map(spot => (
                                        <ParkingSpot key={spot.spot_label} spot={spot} onClick={setSelectedSpot} />
                                    ))}
                                </div>
                                {/* Lane separator */}
                                {lane.row1.length > 0 && (
                                    <div style={{
                                        fontSize: '0.9rem',
                                        color: 'var(--text-muted)',
                                        padding: '4px 0',
                                        letterSpacing: '4px',
                                        opacity: 0.5,
                                        fontFamily: 'var(--font-display)'
                                    }}>
                                        — DRIVE LANE —
                                    </div>
                                )}
                                {/* Row 2 (Facing Lane) */}
                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                    {lane.row2.map(spot => (
                                        <ParkingSpot key={spot.spot_label} spot={spot} onClick={setSelectedSpot} />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Selected Spot Modal */}
            <AnimatePresence>
                {selectedSpot && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.7)', zIndex: 1000,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <motion.div
                            initial={{ opacity: 0, y: 30, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 20, scale: 0.95 }}
                            className="card"
                            style={{ width: '400px', maxWidth: '90%' }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div className="kpi-icon yellow" style={{ width: '40px', height: '40px' }}><Car size={20} /></div>
                                    <div>
                                        <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 700 }}>
                                            Spot {selectedSpot.spot_label}
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: selectedSpot.status === 'empty' ? 'var(--green)' : 'var(--red)', fontWeight: 600, textTransform: 'uppercase' }}>
                                            {selectedSpot.status}
                                        </div>
                                    </div>
                                </div>
                                <button className="btn-icon" onClick={() => setSelectedSpot(null)}><X size={20} /></button>
                            </div>

                            {selectedSpot.status !== 'empty' ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <div style={{ background: 'var(--bg-surface)', padding: '12px', borderRadius: '8px', display: 'flex', gap: '12px' }}>
                                        <Car size={16} style={{ color: 'var(--text-muted)' }} />
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>VIN</div>
                                            <div style={{ fontFamily: 'monospace', fontSize: '1.1rem', color: 'var(--yellow)' }}>{selectedSpot.vin}</div>
                                        </div>
                                    </div>
                                    <div style={{ background: 'var(--bg-surface)', padding: '12px', borderRadius: '8px', display: 'flex', gap: '12px' }}>
                                        <Clock size={16} style={{ color: 'var(--text-muted)' }} />
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Entry Time</div>
                                            <div style={{ fontSize: '0.9rem' }}>{new Date(selectedSpot.occupied_at).toLocaleString()}</div>
                                        </div>
                                    </div>
                                    <div style={{
                                        background: (selectedSpot.occupied_at && Math.floor((Date.now() - new Date(selectedSpot.occupied_at)) / 86400000) >= maxParkDays) ? 'rgba(229,57,53,0.1)' : 'var(--bg-surface)',
                                        padding: '12px',
                                        borderRadius: '8px',
                                        display: 'flex',
                                        gap: '12px',
                                        border: (selectedSpot.occupied_at && Math.floor((Date.now() - new Date(selectedSpot.occupied_at)) / 86400000) >= maxParkDays) ? '1px solid rgba(229,57,53,0.3)' : 'none'
                                    }}>
                                        <Zap size={16} style={{ color: (selectedSpot.occupied_at && Math.floor((Date.now() - new Date(selectedSpot.occupied_at)) / 86400000) >= maxParkDays) ? 'var(--red)' : 'var(--text-muted)' }} />
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Retention Cycle</div>
                                            <div style={{
                                                fontSize: '1.2rem',
                                                fontWeight: 800,
                                                color: (selectedSpot.occupied_at && Math.floor((Date.now() - new Date(selectedSpot.occupied_at)) / 86400000) >= maxParkDays) ? 'var(--red)' : 'var(--yellow)'
                                            }}>
                                                {selectedSpot.occupied_at ? Math.floor((Date.now() - new Date(selectedSpot.occupied_at)) / 86400000) : 0} <span style={{ fontSize: '0.8rem' }}>{(selectedSpot.occupied_at && Math.floor((Date.now() - new Date(selectedSpot.occupied_at)) / 86400000) >= maxParkDays) ? 'DAYS (EXCEEDED)' : 'DAYS'}</span>
                                            </div>
                                        </div>
                                    </div>
                                    {(selectedSpot.status === 'occupied' || selectedSpot.status === 'alert') ? (
                                        <div style={{ 
                                            marginTop: '16px', 
                                            padding: '12px', 
                                            background: 'rgba(33,150,243,0.1)', 
                                            border: '1px solid rgba(33,150,243,0.3)', 
                                            borderRadius: '8px',
                                            textAlign: 'center',
                                            color: selectedSpot.status === 'alert' ? 'var(--red)' : 'var(--blue)',
                                            fontWeight: 600,
                                            fontSize: '0.85rem'
                                        }}>
                                            🛡️ PROTECTED VIN
                                            <div style={{ fontSize: '0.7rem', fontWeight: 400, marginTop: '4px', color: 'var(--text-muted)' }}>
                                                This vehicle is active ({selectedSpot.status.toUpperCase()}). 
                                                Manual release is disabled. Please use Scan Checkout.
                                            </div>
                                        </div>
                                    ) : (
                                        <button className="btn btn-primary" onClick={() => onRelease(selectedSpot.id)}>
                                            Release Place
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                        Spot is available for assignment. Enter identity details to reserve.
                                    </p>
                                    <div className="form-group" style={{ marginBottom: '8px' }}>
                                        <label className="form-label">Full Name</label>
                                        <input id="reserve-fullName" type="text" className="form-input" placeholder="Abdellah Elberkaoui" />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: '8px' }}>
                                        <label className="form-label">Subject / Project</label>
                                        <input id="reserve-subject" type="text" className="form-input" placeholder="e.g. Maintenance B" />
                                    </div>
                                    <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => {
                                        const fullName = document.getElementById('reserve-fullName').value;
                                        const subject = document.getElementById('reserve-subject').value;
                                        onReserve(selectedSpot.id, fullName, subject);
                                    }}>
                                        Reserve Place
                                    </button>
                                </div>
                            )}

                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
