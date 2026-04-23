import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Car, Clock, User, MapPin, Filter } from 'lucide-react';
import io from 'socket.io-client';
import useAuthStore from '../store/authStore';
import useSettingsStore from '../store/settingsStore';

// Contine layout: updating from 6x7 to 6x8 (4 left, 4 right) per user request -> 48 capacity.
function generateContineSpots() {
    const spots = {};
    const vins = [
        'VF1RFE00X67123456', 'VF1KA0F09Z1234567', 'VF1BZ000458901234',
        'VF1AB000012345678', 'VF1DJ000567890123', 'VF1GNEF0A58234567',
    ];
    const operators = ['J. Dupont', 'M. Bernard', 'L. Martin', 'S. Petit'];
    const carColors = ['#2D3436', '#E53935', '#1565C0', '#F5F5F5', '#424242', '#B71C1C', '#1A237E'];

    for (let i = 1; i <= 42; i++) {
        const rand = Math.random();
        let status = 'empty';
        if (rand < 0.4) status = 'occupied';
        else if (rand < 0.5) status = 'reserved';
        else if (rand < 0.53) status = 'alert';

        spots[`CT${i}`] = {
            id: `CT${i}`,
            block: 'Contine',
            number: i,
            row: Math.ceil(i / 7),
            col: ((i - 1) % 7) + 1,
            status,
            vin: status !== 'empty' ? vins[Math.floor(Math.random() * vins.length)] : null,
            operator: status !== 'empty' ? operators[Math.floor(Math.random() * operators.length)] : null,
            entryDate: status !== 'empty' ? new Date(Date.now() - Math.random() * 10 * 86400000).toISOString() : null,
            daysParked: status === 'alert' ? Math.floor(Math.random() * 5) + 6 :
                status !== 'empty' ? Math.floor(Math.random() * 5) + 1 : 0,
            carColor: status === 'occupied' ? '#E53935' : (status === 'reserved' ? '#FF9800' : carColors[Math.floor(Math.random() * carColors.length)]),
        };
    }
    return spots;
}

// Same Realistic top-down car SVG inspired by reference image
function TopDownCar({ color = '#2D3436', width = 48, isReserved = false }) {
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
            <line x1="10" y1="36" x2="10" y2="66" stroke="black" strokeWidth="0.4" opacity="0.15" />
            <line x1="38" y1="36" x2="38" y2="66" stroke="black" strokeWidth="0.4" opacity="0.15" />
            {isReserved && <rect x="20" y="20" width="8" height="56" rx="4" fill="#FFE0B2" opacity="0.15" />}
        </svg>
    );
}

// Parking Spot Component (Same as RHL)
function ParkingSpot({ spot, onClick, facing }) {
    const maxParkDays = useSettingsStore(state => state.maxParkDays);
    const isEmpty = spot.status === 'empty';
    const isAlert = spot.status === 'alert' || spot.daysParked >= maxParkDays;
    const isReserved = spot.status === 'reserved';

    return (
        <motion.div
            onClick={() => onClick(spot)}
            whileHover={{ scale: 1.06, boxShadow: '0 0 12px rgba(247,201,72,0.2)' }}
            whileTap={{ scale: 0.97 }}
            style={{
                width: '58px',
                height: '100px',
                background: isEmpty ? 'rgba(240,245,240,0.03)' : 'rgba(30,30,30,0.6)',
                border: isEmpty
                    ? '1.5px dashed rgba(67,160,71,0.3)'
                    : isAlert
                        ? '2px solid var(--red)'
                        : '1px solid rgba(255,255,255,0.06)',
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                position: 'relative',
                transition: 'all 0.2s ease',
                animation: isAlert ? 'pulse-border 2s infinite' : 'none',
                overflow: 'hidden',
            }}
        >
            {isEmpty ? (
                <>
                    <span style={{
                        fontSize: '0.72rem',
                        color: 'rgba(67,160,71,0.6)',
                        fontFamily: 'var(--font-display)',
                        fontWeight: 600,
                        letterSpacing: '0.5px',
                    }}>{spot.id}</span>
                </>
            ) : (
                <div style={{ transform: facing === 'down' ? 'rotate(180deg)' : 'none' }}>
                    <TopDownCar
                        color={spot.status === 'alert' ? '#E53935' : spot.status === 'occupied' ? '#2196F3' : (isReserved ? '#FF9800' : spot.carColor)}
                        width={42}
                        isReserved={isReserved}
                    />
                </div>
            )}

            {/* Spot label for occupied */}
            {!isEmpty && (
                <div style={{
                    position: 'absolute',
                    bottom: '2px',
                    fontSize: '0.5rem',
                    color: 'rgba(255,255,255,0.4)',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 600,
                    transform: facing === 'down' ? 'rotate(180deg)' : 'none',
                }}>
                    {spot.id}
                </div>
            )}
        </motion.div>
    );
}
// Modal
function SpotDetailModal({ spot, onClose, onRelease, onReserve }) {
    const maxParkDays = useSettingsStore(state => state.maxParkDays);
    if (!spot) return null;

    return (
        <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
            <motion.div className="modal" initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <div className="modal-title" style={{ color: 'var(--yellow)', fontSize: '1.5rem' }}>Spot {spot.id}</div>
                        <span className={`badge badge-${spot.status === 'empty' ? 'available' : spot.status === 'alert' ? 'alert' : spot.status}`}>
                            {spot.status.toUpperCase()}
                        </span>
                    </div>
                    <button className="btn-icon header-btn" onClick={onClose}><X size={18} /></button>
                </div>

                {spot.status !== 'empty' && (
                    <div style={{ display: 'flex', justifyContent: 'center', margin: '16px 0', padding: '16px', background: 'var(--bg-surface)', borderRadius: '8px' }}>
                        <TopDownCar color={spot.daysParked >= maxParkDays ? '#E53935' : (spot.status === 'reserved' ? '#FF9800' : (spot.status === 'occupied' ? '#2196F3' : spot.carColor))} width={60} isReserved={spot.status === 'reserved'} />
                    </div>
                )}

                {spot.status !== 'empty' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Car size={16} style={{ color: 'var(--text-muted)' }} />
                            <div><div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>VIN</div><div style={{ fontSize: '0.9rem', fontFamily: 'var(--font-display)', fontWeight: 600 }}>{spot.vin}</div></div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Clock size={16} style={{ color: 'var(--text-muted)' }} />
                            <div><div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Inbound Timestamp</div><div style={{ fontSize: '0.9rem' }}>{new Date(spot.entryDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div></div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <MapPin size={16} style={{ color: 'var(--text-muted)' }} />
                            <div><div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Retention Cycle</div><div style={{ fontSize: '1.1rem', color: spot.daysParked >= maxParkDays ? 'var(--red)' : 'var(--yellow)', fontWeight: 800 }}>{spot.daysParked} <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{spot.daysParked >= maxParkDays ? 'DAYS (EXCEEDED)' : 'DAYS'}</span></div></div>
                        </div>
                        <button className="btn btn-primary" style={{ marginTop: '8px' }} onClick={() => onRelease(spot.id)}>Release Place</button>
                    </div>
                ) : (
                    <div style={{ marginTop: '16px' }}>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '16px', fontSize: '0.85rem' }}>Capacity module is available. Enter a VIN to reserve it.</p>
                        <div className="form-group">
                            <label className="form-label">VIN Number</label>
                            <input type="text" className="form-input" placeholder="Enter 17-character VIN" maxLength={17} style={{ fontFamily: 'monospace', letterSpacing: '1px' }} />
                        </div>
                        <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => onReserve(spot.id)}>Reserve Place</button>
                    </div>
                )}
            </motion.div>
        </motion.div>
    );
}

export default function ParkingMapContine() {
    const [spots, setSpots] = useState({});
    const [selectedSpot, setSelectedSpot] = useState(null);
    const [loading, setLoading] = useState(true);
    const { token } = useAuthStore();
    const maxParkDays = useSettingsStore(state => state.maxParkDays);

    useEffect(() => {
        let socket;

        const fetchSpots = async () => {
            try {
                const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/parking/contine/state`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();

                const spotsMap = {};
                if (data.spots) {
                    data.spots.forEach(s => {
                        const daysParked = s.daysParked || 0;
                        const actualStatus = (daysParked >= maxParkDays && s.status === 'occupied') ? 'alert' : s.status;
                        spotsMap[s.id] = {
                            id: s.id,
                            block: 'Contine',
                            number: s.position || parseInt(s.id.replace(/[A-Z]/g, '')),
                            status: actualStatus,
                            vin: s.vin,
                            operator: s.operator_id,
                            entryDate: s.occupied_at,
                            carColor: s.car_color || '#E53935',
                            daysParked: daysParked
                        };
                    });
                }
                setSpots(spotsMap);
            } catch (err) {
                console.error('Failed to fetch Contine spots:', err);
            } finally {
                setLoading(false);
            }
        };

        if (token) {
            fetchSpots();

            socket = io(import.meta.env.VITE_API_URL);
            socket.on('spot:updated', (data) => {
                setSpots(prev => {
                    if (!prev[data.spot_id]) return prev;
                    const prevSpot = prev[data.spot_id];
                    const newDaysParked = data.status === 'occupied' && prevSpot.status !== 'occupied' ? 0 : data.status === 'empty' ? 0 : prevSpot.daysParked;
                    const actualStatus = (newDaysParked >= maxParkDays && data.status === 'occupied') ? 'alert' : data.status;

                    return {
                        ...prev,
                        [data.spot_id]: {
                            ...prevSpot,
                            status: actualStatus,
                            vin: data.vin || null,
                            carColor: data.car_color || (data.status === 'occupied' ? '#E53935' : prevSpot.carColor),
                            daysParked: newDaysParked,
                            entryDate: data.status === 'occupied' && prevSpot.status !== 'occupied' ? new Date().toISOString() : data.status === 'empty' ? null : prevSpot.entryDate
                        }
                    };
                });
            });
        }

        return () => {
            if (socket) socket.disconnect();
        };
    }, [token]);

    const stats = useMemo(() => {
        const all = Object.values(spots);
        return {
            total: all.length,
            occupied: all.filter(s => s.status === 'occupied').length,
            reserved: all.filter(s => s.status === 'reserved').length,
            empty: all.filter(s => s.status === 'empty').length,
            alert: all.filter(s => s.status === 'alert').length,
        };
    }, [spots]);

    const rows = [1, 2, 3, 4, 5, 6];

    return (
        <div className="parking-container">
            {loading && (
                <div style={{ padding: '60px', textAlign: 'center', color: 'var(--yellow)' }}>
                    <span className="login-spinner" style={{ display: 'inline-block', marginBottom: '16px', borderColor: 'var(--yellow) transparent transparent transparent' }}></span>
                    <div>Loading Map Data...</div>
                </div>
            )}

            {/* Stats Bar */}
            <div className="parking-stats-bar">
                <div className="parking-stat"><div className="stat-dot" style={{ background: 'var(--yellow)' }} /><span className="stat-label">Total</span><span className="stat-value">{stats.total}</span></div>
                <div className="parking-stat"><div className="stat-dot" style={{ background: 'var(--red)' }} /><span className="stat-label">Stored VINs</span><span className="stat-value text-red">{stats.occupied}</span></div>
                <div className="parking-stat"><div className="stat-dot" style={{ background: 'var(--orange)' }} /><span className="stat-label">Reserved</span><span className="stat-value text-orange">{stats.reserved}</span></div>
                <div className="parking-stat"><div className="stat-dot" style={{ background: 'var(--green)' }} /><span className="stat-label">Available</span><span className="stat-value text-green">{stats.empty}</span></div>
                <div className="parking-stat"><div className="stat-dot" style={{ background: 'var(--red)', animation: 'pulse-badge 2s infinite' }} /><span className="stat-label">Alerts</span><span className="stat-value text-red">{stats.alert}</span></div>
            </div>

            <div className="parking-grid" style={{ background: 'var(--bg-card)', padding: '24px 16px' }}>
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--yellow)', fontSize: '1.2rem', fontWeight: 700 }}>Park Cantine</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>6 rows × 7 spots (3 left, 4 right) · 42 capacity</p>
                </div>

                {/* Entry */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
                    <div style={{ padding: '4px 14px', borderRadius: '4px', background: 'var(--green-dim)', color: 'var(--green)', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '1px' }}>▶ ENTRY</div>
                </div>

                {/* Rows wrapper */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                    {rows.map(row => {
                        const leftCols = [7, 6, 5];
                        const rightCols = [4, 3, 2, 1];
                        return (
                            <div key={row} style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                {/* Left side, face upward -> down=false */}
                                {leftCols.map(col => {
                                    const num = (row - 1) * 7 + col;
                                    const spot = spots[`CT${num}`];
                                    return spot && <ParkingSpot key={spot.id} spot={spot} onClick={setSelectedSpot} facing="up" />;
                                })}

                                {/* Center aisle */}
                                <div style={{ width: '48px', height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <div style={{ width: '1px', height: '100%', borderLeft: '2px dashed rgba(247,201,72,0.15)' }} />
                                </div>

                                {/* Right side, face downward -> down=true */}
                                {rightCols.map(col => {
                                    const num = (row - 1) * 7 + col;
                                    const spot = spots[`CT${num}`];
                                    return spot && <ParkingSpot key={spot.id} spot={spot} onClick={setSelectedSpot} facing="down" />;
                                })}
                            </div>
                        );
                    })}
                </div>

                {/* Exit */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                    <div style={{ padding: '4px 14px', borderRadius: '4px', background: 'var(--red-dim)', color: 'var(--red)', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '1px' }}>◀ EXIT</div>
                </div>
            </div>

            <AnimatePresence>
                {selectedSpot && (
                    <SpotDetailModal
                        spot={selectedSpot}
                        onClose={() => setSelectedSpot(null)}
                        onRelease={async (id) => {
                            try {
                                await fetch(`${import.meta.env.VITE_API_URL}/api/v1/spots/${id}/release`, {
                                    method: 'POST',
                                    headers: { Authorization: `Bearer ${token}` }
                                });
                                setSelectedSpot(null);
                                alert('Place released successfully');
                                window.location.reload();
                            } catch (err) { console.error(err); }
                        }}
                        onReserve={async (id) => {
                            const vin = document.querySelector('input[placeholder*="VIN"]').value;
                            if (!vin) return alert('VIN required');
                            try {
                                await fetch(`${import.meta.env.VITE_API_URL}/api/v1/spots/${id}/reserve`, {
                                    method: 'POST',
                                    headers: {
                                        'Authorization': `Bearer ${token}`,
                                        'Content-Type': 'application/json'
                                    },
                                    body: JSON.stringify({ vin })
                                });
                                setSelectedSpot(null);
                                alert('Place reserved successfully');
                                window.location.reload();
                            } catch (err) { console.error(err); }
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
