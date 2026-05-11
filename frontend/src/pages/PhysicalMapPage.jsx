import { API_URL, SOCKET_URL } from '../api_config';
import { useState, useMemo, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Car, Clock, User, MapPin, Filter } from 'lucide-react';
import io from 'socket.io-client';
import useAuthStore from '../store/authStore';
import useSettingsStore from '../store/settingsStore';

// Realistic top-down car SVG
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
            <rect x="12" y="26" width="24" height="14" rx="4" fill={glassColor} opacity="0.7" />
            <rect x="11" y="40" width="26" height="16" rx="3" fill={bodyColor} />
            <rect x="13" y="56" width="22" height="12" rx="4" fill={glassColor} opacity="0.6" />
            <rect x="10" y="12" width="8" height="4" rx="2" fill="#FFF9C4" opacity="0.9" />
            <rect x="30" y="12" width="8" height="4" rx="2" fill="#FFF9C4" opacity="0.9" />
            <rect x="10" y="76" width="7" height="3" rx="1.5" fill="#EF5350" opacity="0.9" />
            <rect x="31" y="76" width="7" height="3" rx="1.5" fill="#EF5350" opacity="0.9" />
            <ellipse cx="6" cy="30" rx="2.5" ry="1.5" fill={bodyColor} />
            <ellipse cx="42" cy="30" rx="2.5" ry="1.5" fill={bodyColor} />
        </svg>
    );
}

function ParkingSpot({ spot, onClick, facing }) {
    const maxParkDays = useSettingsStore(state => state.maxParkDays);
    const isEmpty = spot.status === 'empty';
    const isReserved = spot.status === 'reserved';
    const isAlert = spot.daysParked >= maxParkDays || spot.status === 'alert';
    const carColor = isAlert ? '#E53935' : (isReserved ? '#FF9800' : '#2196F3');

    return (
        <motion.div
            onClick={() => onClick(spot)}
            className="parking-spot"
            whileHover={{ scale: 1.05 }}
            style={{
                width: '46px', height: '90px',
                border: `1.5px solid ${isEmpty ? 'rgba(247, 201, 72, 0.3)' : isReserved ? 'var(--yellow)' : isAlert ? 'var(--red)' : 'var(--yellow)'}`,
                background: isEmpty ? 'rgba(255, 255, 255, 0.02)' : isReserved ? 'var(--yellow-dim)' : isAlert ? 'var(--red-dim)' : 'var(--yellow-dim)',
                borderRadius: '6px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                position: 'relative',
            }}
        >
            {isEmpty ? (
                <span style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.4)', fontWeight: 600 }}>{spot.id}</span>
            ) : (
                <div style={{ transform: facing === 'down' ? 'rotate(180deg)' : 'none' }}>
                    <TopDownCar color={carColor} width={42} isReserved={isReserved} />
                </div>
            )}
            {!isEmpty && (
                <div style={{ position: 'absolute', bottom: '2px', fontSize: '0.55rem', color: 'rgba(255,255,255,0.5)', fontWeight: 700, transform: facing === 'down' ? 'rotate(180deg)' : 'none' }}>
                    {spot.id}
                </div>
            )}
        </motion.div>
    );
}

function BlockRow({ block, spots, onSpotClick }) {
    const leftSpots = spots.filter(s => s.block === block && (s.side === 'left' || !s.side));
    const rightSpots = spots.filter(s => s.block === block && s.side === 'right');
    
    const occupied = spots.filter(s => s.block === block && s.status !== 'empty').length;
    const total = spots.filter(s => s.block === block).length;
    const pct = total > 0 ? Math.round((occupied / total) * 100) : 0;

    return (
        <div style={{ marginBottom: '28px' }}>
            {block && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                    <div style={{ background: 'var(--yellow-dim)', color: 'var(--yellow)', padding: '4px 12px', borderRadius: '6px', fontSize: '0.9rem', fontWeight: 700 }}>Block {block}</div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{occupied}/{total} · {pct}% Occupancy</span>
                </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', flexWrap: 'wrap', width: '100%', padding: '10px' }}>
                    {leftSpots.map(spot => <ParkingSpot key={spot.id} spot={spot} onClick={onSpotClick} facing="up" />)}
                </div>
                {rightSpots.length > 0 && (
                    <>
                        <div style={{ width: '100%', height: '20px', margin: '4px 0', borderTop: '1px dashed rgba(255,255,255,0.1)', borderBottom: '1px dashed rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ fontSize: '0.5rem', color: 'var(--text-muted)', letterSpacing: '2px' }}>DRIVE LANE</span>
                        </div>
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', flexWrap: 'wrap', width: '100%', padding: '10px' }}>
                            {rightSpots.map(spot => <ParkingSpot key={spot.id} spot={spot} onClick={onSpotClick} facing="down" />)}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

function SpotDetailModal({ spot, onClose, onRelease, onReserve }) {
    if (!spot) return null;
    return (
        <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
            <motion.div className="modal" initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <div className="modal-title" style={{ color: 'var(--yellow)' }}>Spot {spot.id}</div>
                    <button className="btn-icon header-btn" onClick={onClose}><X size={18} /></button>
                </div>
                {spot.status !== 'empty' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div><div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Status</div><div className="badge badge-occupied">{spot.status.toUpperCase()}</div></div>
                        <div><div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>VIN</div><div style={{ fontWeight: 700, color: 'var(--blue)' }}>{spot.vin || 'N/A'}</div></div>
                        <div><div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Days Parked</div><div style={{ fontSize: '1.2rem', color: 'var(--yellow)' }}>{spot.daysParked} Days</div></div>
                        <button className="btn btn-primary" onClick={() => onRelease(spot.id)}>Release Spot</button>
                    </div>
                ) : (
                    <div>
                        <div className="form-group"><label className="form-label">VIN (Optional)</label><input id="res-vin" type="text" className="form-input" placeholder="VF1..." /></div>
                        <div className="form-group"><label className="form-label">Full Name</label><input id="res-name" type="text" className="form-input" placeholder="Abdellah Elberkaoui" /></div>
                        <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => onReserve(spot.id, document.getElementById('res-vin').value, document.getElementById('res-name').value)}>Reserve Spot</button>
                    </div>
                )}
            </motion.div>
        </motion.div>
    );
}

export default function PhysicalMapPage({ id: propId }) {
    const { id: paramId } = useParams();
    const id = propId || paramId;
    const [spots, setSpots] = useState([]);
    const [lotName, setLotName] = useState('Loading...');
    const [selectedSpot, setSelectedSpot] = useState(null);
    const [loading, setLoading] = useState(true);
    const { token } = useAuthStore();

    useEffect(() => {
        let socket;
        const fetchState = async () => {
            try {
                const res = await fetch(`${API_URL}/lots/${id}/state`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setSpots(data.spots || []);
                    setLotName(data.name || 'Parking Map');
                } else {
                    console.error('Fetch failed with status:', res.status);
                    setLotName('Map Unavailable');
                }
            } catch (err) { 
                console.error('Fetch error:', err); 
                setLotName('Connection Error');
            } finally { 
                setLoading(false); 
            }
        };

        if (token && id) {
            fetchState();
            socket = io(SOCKET_URL);
            socket.on('spot:updated', () => fetchState());
        } else if (!token) {
            setLoading(false);
            setLotName('Authentication Required');
        } else {
            setLoading(false);
            setLotName('No Sector Selected');
        }
        return () => socket?.disconnect();
    }, [id, token]);

    const blocks = useMemo(() => [...new Set(spots.map(s => s.block))].sort(), [spots]);

    return (
        <div className="parking-container">
            {loading ? (
                <div style={{ padding: '60px', textAlign: 'center', color: 'var(--yellow)' }}>Loading...</div>
            ) : (
                <>
                    <div className="parking-grid" style={{ background: 'var(--bg-card)', padding: '24px' }}>
                        <h3 style={{ textAlign: 'center', color: 'var(--yellow)', marginBottom: '24px' }}>{lotName}</h3>
                        {blocks.map(b => <BlockRow key={b} block={b} spots={spots} onSpotClick={setSelectedSpot} />)}
                    </div>
                    <AnimatePresence>
                        {selectedSpot && (
                            <SpotDetailModal 
                                spot={selectedSpot} 
                                onClose={() => setSelectedSpot(null)} 
                                onRelease={async (sid) => {
                                    await fetch(`${API_URL}/spots/${sid}/release`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
                                    setSelectedSpot(null);
                                }}
                                onReserve={async (sid, vin, fullName) => {
                                    await fetch(`${API_URL}/spots/${sid}/reserve`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                        body: JSON.stringify({ vin, fullName })
                                    });
                                    setSelectedSpot(null);
                                }}
                            />
                        )}
                    </AnimatePresence>
                </>
            )}
        </div>
    );
}
