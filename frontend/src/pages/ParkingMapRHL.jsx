import { API_URL, SOCKET_URL } from '../api_config';
import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Car, Clock, User, MapPin, Filter } from 'lucide-react';
import io from 'socket.io-client';
import useAuthStore from '../store/authStore';
import useSettingsStore from '../store/settingsStore';

// Block definitions per spec
const BLOCKS = {
    A: { total: 20, left: [1, 20], right: [0, -1] },
    B: { total: 30, left: [1, 15], right: [16, 30] },
    C: { total: 36, left: [1, 18], right: [19, 36] },
    D: { total: 36, left: [1, 18], right: [19, 36] },
    E: { total: 36, left: [1, 18], right: [19, 36] },
    F: { total: 36, left: [1, 18], right: [19, 36] },
    G: { total: 36, left: [1, 18], right: [19, 36] },
    H: { total: 36, left: [1, 18], right: [19, 36] },
    I: { total: 36, left: [1, 18], right: [19, 36] },
};

// Generate mock data
function generateSpots() {
    const spots = {};
    const vins = [
        'VF1RFE00X67123456', 'VF1KA0F09Z1234567', 'VF1BZ000458901234',
        'VF1AB000012345678', 'VF1DJ000567890123', 'VF1GNEF0A58234567',
        'VF1HG000234567890', 'VF1JK000345678901', 'VF1LM000456789012',
    ];
    const operators = ['J. Dupont', 'M. Bernard', 'L. Martin', 'S. Petit', 'A. Moreau'];
    const carColors = ['#2D3436', '#E53935', '#1565C0', '#F5F5F5', '#424242', '#B71C1C', '#1A237E'];

    Object.entries(BLOCKS).forEach(([block, def]) => {
        for (let i = 1; i <= def.total; i++) {
            const rand = Math.random();
            let status = 'empty';
            if (rand < 0.42) status = 'occupied';
            else if (rand < 0.52) status = 'reserved';
            else if (rand < 0.56) status = 'alert';

            const spotId = `${block}${i}`;
            spots[spotId] = {
                id: spotId,
                block,
                number: i,
                status,
                vin: status !== 'empty' ? vins[Math.floor(Math.random() * vins.length)] : null,
                operator: status !== 'empty' ? operators[Math.floor(Math.random() * operators.length)] : null,
                entryDate: status !== 'empty' ? new Date(Date.now() - Math.random() * 10 * 86400000).toISOString() : null,
                daysParked: status === 'alert' ? Math.floor(Math.random() * 5) + 6 :
                    status !== 'empty' ? Math.floor(Math.random() * 5) + 1 : 0,
                carColor: status === 'occupied' ? '#E53935' : (status === 'reserved' ? '#FF9800' : carColors[Math.floor(Math.random() * carColors.length)]),
            };
        }
    });
    return spots;
}

// Realistic top-down car SVG inspired by reference image
function TopDownCar({ color = '#2D3436', width = 48, isReserved = false }) {
    const bodyColor = isReserved ? '#FF9800' : color;
    const glassColor = isReserved ? '#FFB74D' : (color === '#F5F5F5' || color === '#E0E0E0') ? '#B0BEC5' : '#1a1a1a';
    const highlightOpacity = (color === '#F5F5F5' || color === '#E0E0E0') ? '0.15' : '0.2';
    const h = width * 2;

    return (
        <svg width={width} height={h} viewBox="0 0 48 96" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Shadow */}
            <ellipse cx="24" cy="88" rx="20" ry="5" fill="black" opacity="0.15" />

            {/* Car body */}
            <rect x="8" y="10" width="32" height="72" rx="12" fill={bodyColor} />

            {/* Body contour highlight */}
            <rect x="9" y="11" width="30" height="70" rx="11" fill="none" stroke="white" strokeWidth="0.5" opacity={highlightOpacity} />

            {/* Hood */}
            <path d="M12 14 Q24 8 36 14 L36 28 Q24 24 12 28 Z" fill={bodyColor} stroke="white" strokeWidth="0.3" opacity="0.1" />

            {/* Windshield */}
            <rect x="12" y="26" width="24" height="14" rx="4" fill={glassColor} opacity="0.7" />
            <rect x="13" y="27" width="10" height="12" rx="3" fill="white" opacity="0.08" />

            {/* Roof */}
            <rect x="11" y="40" width="26" height="16" rx="3" fill={bodyColor} />
            <rect x="13" y="42" width="22" height="12" rx="2" fill="white" opacity="0.06" />

            {/* Rear window */}
            <rect x="13" y="56" width="22" height="12" rx="4" fill={glassColor} opacity="0.6" />

            {/* Trunk */}
            <path d="M12 68 Q24 74 36 68 L36 76 Q24 80 12 76 Z" fill={bodyColor} />

            {/* Headlights */}
            <rect x="10" y="12" width="8" height="4" rx="2" fill="#FFF9C4" opacity="0.9" />
            <rect x="30" y="12" width="8" height="4" rx="2" fill="#FFF9C4" opacity="0.9" />

            {/* Tail lights */}
            <rect x="10" y="76" width="7" height="3" rx="1.5" fill="#EF5350" opacity="0.9" />
            <rect x="31" y="76" width="7" height="3" rx="1.5" fill="#EF5350" opacity="0.9" />

            {/* Side mirrors */}
            <ellipse cx="6" cy="30" rx="2.5" ry="1.5" fill={bodyColor} />
            <ellipse cx="42" cy="30" rx="2.5" ry="1.5" fill={bodyColor} />

            {/* Door lines */}
            <line x1="10" y1="36" x2="10" y2="66" stroke="black" strokeWidth="0.4" opacity="0.15" />
            <line x1="38" y1="36" x2="38" y2="66" stroke="black" strokeWidth="0.4" opacity="0.15" />

            {/* Center line for reserved (orange glow) */}
            {isReserved && (
                <rect x="20" y="20" width="8" height="56" rx="4" fill="#FFE0B2" opacity="0.15" />
            )}
        </svg>
    );
}

// Parking Spot Component
function ParkingSpot({ spot, onClick, facing }) {
    const maxParkDays = useSettingsStore(state => state.maxParkDays);
    const isEmpty = spot.status === 'empty';
    const isReserved = spot.status === 'reserved';
    const isAlert = spot.daysParked >= maxParkDays || spot.status === 'alert';
    // User request: Red for >6 days, Blue for assigned/occupied
    const carColor = isAlert ? '#E53935' : (isReserved ? '#FF9800' : '#2196F3');

    return (
        <motion.div
            onClick={() => onClick(spot)}
            className="parking-spot"
            whileHover={{ scale: 1.05 }}
            style={{
                width: '46px', height: '90px',
                border: `2px solid ${isEmpty ? 'var(--green)' : isReserved ? 'var(--orange)' : isAlert ? 'var(--red)' : 'transparent'}`,
                background: isEmpty ? 'var(--green-dim)' : isReserved ? 'var(--orange-dim)' : isAlert ? 'var(--red-dim)' : 'transparent',
                borderRadius: '6px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                position: 'relative',
                boxShadow: isAlert ? '0 0 12px rgba(229,57,53,0.3)' : 'none',
            }}
        >
            {isEmpty ? (
                <>
                    <div style={{ width: '4px', height: '14px', background: 'var(--green)', borderRadius: '2px', position: 'absolute', left: '4px' }} />
                    <span style={{
                        fontSize: '0.72rem',
                        color: 'rgba(67,160,71,0.6)',
                        fontFamily: 'var(--font-display)',
                        fontWeight: 600,
                        letterSpacing: '0.5px',
                    }}>
                        {spot.id}
                    </span>
                </>
            ) : (
                <div style={{ transform: facing === 'down' ? 'rotate(180deg)' : 'none' }}>
                    <TopDownCar
                        color={carColor}
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
                    fontSize: '0.55rem',
                    color: isAlert ? 'var(--red)' : 'rgba(255,255,255,0.5)',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    transform: facing === 'down' ? 'rotate(180deg)' : 'none',
                    textShadow: isAlert ? '0 0 4px rgba(0,0,0,0.5)' : 'none'
                }}>
                    {spot.id}
                </div>
            )}
        </motion.div>
    );
}

// Block Row - Two facing rows with drive lane
function BlockRow({ block, spots, onSpotClick }) {
    const def = BLOCKS[block];
    const leftSpots = [];
    const rightSpots = [];

    for (let i = def.left[0]; i <= def.left[1]; i++) {
        if (spots[`${block}${i}`]) leftSpots.push(spots[`${block}${i}`]);
    }
    for (let i = def.right[0]; i <= def.right[1]; i++) {
        if (spots[`${block}${i}`]) rightSpots.push(spots[`${block}${i}`]);
    }
    rightSpots.reverse();

    const allBlockSpots = [...leftSpots, ...rightSpots];
    const occupied = allBlockSpots.filter(s => s.status !== 'empty').length;
    const pct = Math.round((occupied / def.total) * 100);

    const isSingleLine = def.right[0] > def.right[1];

    return (
        <div style={{ marginBottom: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                <div style={{
                    background: pct > 85 ? 'var(--red-dim)' : pct > 60 ? 'var(--orange-dim)' : 'var(--green-dim)',
                    color: pct > 85 ? 'var(--red)' : pct > 60 ? 'var(--orange)' : 'var(--green)',
                    padding: '4px 12px', borderRadius: '6px', fontFamily: 'var(--font-display)', fontSize: '0.9rem', fontWeight: 700,
                }}>
                    Block {block}
                </div>
                <div style={{ height: '4px', flex: 1, maxWidth: '150px', background: 'var(--bg-surface)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: pct > 85 ? 'var(--red)' : pct > 60 ? 'var(--orange)' : 'var(--green)', transition: 'width 0.5s ease' }} />
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{occupied}/{def.total} · {pct}%</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0', alignItems: 'center' }}>
                <div style={{
                    display: 'flex',
                    gap: '4px',
                    justifyContent: 'center',
                    flexWrap: 'nowrap',
                    width: '100%',
                    overflowX: 'auto',
                    padding: '10px 20px 10px 20px',
                    scrollbarWidth: 'thin',
                    msOverflowStyle: 'auto'
                }}>
                    {leftSpots.map(spot => (
                        <ParkingSpot key={spot.id} spot={spot} onClick={onSpotClick} facing="up" />
                    ))}
                </div>

                {!isSingleLine && (
                    <>
                        <div style={{
                            width: '100%', height: '24px', margin: '4px 0', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'rgba(247,201,72,0.03)', borderTop: '1px dashed rgba(247,201,72,0.15)', borderBottom: '1px dashed rgba(247,201,72,0.15)', borderRadius: '4px',
                        }}>
                            <span style={{ fontSize: '0.55rem', color: 'rgba(247,201,72,0.3)', letterSpacing: '4px', textTransform: 'uppercase', fontWeight: 600 }}>← DRIVE LANE →</span>
                        </div>
                        <div style={{
                            display: 'flex',
                            gap: '4px',
                            justifyContent: 'center',
                            flexWrap: 'nowrap',
                            width: '100%',
                            overflowX: 'auto',
                            padding: '10px 20px 10px 20px',
                            scrollbarWidth: 'thin',
                            msOverflowStyle: 'auto'
                        }}>
                            {rightSpots.map(spot => (
                                <ParkingSpot key={spot.id} spot={spot} onClick={onSpotClick} facing="down" />
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

// Spot Detail Modal
function SpotDetailModal({ spot, onClose, onRelease, onReserve }) {
    const maxParkDays = useSettingsStore(state => state.maxParkDays);
    if (!spot) return null;

    return (
        <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
        >
            <motion.div
                className="modal"
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                onClick={e => e.stopPropagation()}
                style={{ maxWidth: '420px' }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <div className="modal-title" style={{ color: 'var(--yellow)', fontSize: '1.5rem' }}>
                            Spot {spot.id}
                        </div>
                        <span className={`badge badge-${spot.status === 'empty' ? 'available' : spot.status === 'alert' ? 'alert' : spot.status}`} style={spot.reservation_method === 'scan' ? { background: 'var(--blue-dim)', color: 'var(--blue)', border: '1px solid var(--blue)' } : {}}>
                            {spot.reservation_method === 'scan' ? 'SCAN RESERVED' : spot.status.toUpperCase()}
                        </span>
                    </div>
                    <button className="btn-icon header-btn" onClick={onClose}><X size={18} /></button>
                </div>

                {/* Car preview */}
                {spot.status !== 'empty' && (
                    <div style={{ display: 'flex', justifyContent: 'center', margin: '16px 0', padding: '16px', background: 'var(--bg-surface)', borderRadius: '8px' }}>
                        <TopDownCar color={spot.daysParked >= maxParkDays ? '#E53935' : (spot.status === 'reserved' ? '#FF9800' : (spot.status === 'occupied' ? '#2196F3' : spot.carColor))} width={60} isReserved={spot.status === 'reserved'} />
                    </div>
                )}

                {spot.status !== 'empty' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                        {spot.status === 'reserved' ? (
                            <>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Reserved by</div>
                                <div style={{ fontSize: '0.9rem', fontFamily: 'var(--font-display)', fontWeight: 600 }}>{spot.reserved_by || spot.vin || 'Unknown'}</div>
                            </>
                        ) : (
                            <>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>VIN</div>
                                <div style={{ fontSize: '0.9rem', fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--blue)' }}>{spot.vin}</div>
                            </>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Clock size={16} style={{ color: 'var(--text-muted)' }} />
                            <div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Inbound Timestamp</div>
                                <div style={{ fontSize: '0.9rem' }}>{spot.entryDate ? new Date(spot.entryDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}</div>
                            </div>
                        </div>
                        {spot.status !== 'reserved' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Car size={16} style={{ color: 'var(--text-muted)' }} />
                                <div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>VIN</div>
                                    <div style={{ fontSize: '0.9rem', fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--blue)' }}>{spot.vin}</div>
                                </div>
                            </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <MapPin size={16} style={{ color: 'var(--text-muted)' }} />
                            <div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Retention Cycle</div>
                                <div style={{ fontSize: '1.2rem', color: spot.daysParked >= maxParkDays ? 'var(--red)' : 'var(--yellow)', fontWeight: 800 }}>
                                    {spot.daysParked} <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{spot.daysParked >= maxParkDays ? 'DAYS (EXCEEDED)' : 'DAYS'}</span>
                                </div>
                            </div>
                        </div>
                        {spot.reservation_method === 'scan' ? (
                            <div style={{ 
                                marginTop: '16px', 
                                padding: '12px', 
                                background: 'var(--blue-dim)', 
                                border: '1px solid rgba(33,150,243,0.3)', 
                                borderRadius: '8px',
                                textAlign: 'center',
                                color: 'var(--blue)',
                                fontWeight: 600,
                                fontSize: '0.85rem'
                            }}>
                                🛡️ SCAN PROTECTED
                                <div style={{ fontSize: '0.7rem', fontWeight: 400, marginTop: '4px', color: 'var(--text-muted)' }}>
                                    This spot was reserved via scan. Manual release is disabled. 
                                    Please use a scan checkout to clear this spot.
                                </div>
                            </div>
                        ) : (
                            <button className="btn btn-primary" style={{ marginTop: '8px' }} onClick={() => onRelease(spot.id)}>
                                Release Place
                            </button>
                        )}
                    </div>
                ) : (
                    <div style={{ marginTop: '16px' }}>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '16px', fontSize: '0.85rem' }}>
                            Enter Last Name and First Name to reserve this spot.
                        </p>
                        <div className="form-group" style={{ marginBottom: '8px' }}>
                            <label className="form-label">Last Name</label>
                            <input id="reserve-nom" type="text" className="form-input" placeholder="e.g. Smith" />
                        </div>
                        <div className="form-group" style={{ marginBottom: '16px' }}>
                            <label className="form-label">First Name</label>
                            <input id="reserve-prenom" type="text" className="form-input" placeholder="e.g. John" />
                        </div>
                        <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => {
                            const nom = document.getElementById('reserve-nom').value;
                            const prenom = document.getElementById('reserve-prenom').value;
                            onReserve(spot.id, nom, prenom);
                        }}>
                            Reserve Spot
                        </button>
                    </div>
                )}
            </motion.div>
        </motion.div>
    );
}

// Multiple Reserve Modal
function MultipleReserveModal({ onClose, onMultipleReserve, blocks }) {
    const [block, setBlock] = useState(blocks[0]);
    const [fromNum, setFromNum] = useState('');
    const [toNum, setToNum] = useState('');
    const [nom, setNom] = useState('');
    const [prenom, setPrenom] = useState('');

    const handleReserve = () => {
        if (!nom || !prenom) return alert('Last Name and First Name required');
        const start = parseInt(fromNum);
        const end = parseInt(toNum);
        if (isNaN(start) || isNaN(end) || start > end) return alert('Invalid spot range');
        
        const spotIds = [];
        for (let i = start; i <= end; i++) {
            spotIds.push(`${block}${i}`);
        }
        onMultipleReserve(spotIds, nom, prenom);
    };

    return (
        <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
            <motion.div className="modal" initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <div className="modal-title" style={{ color: 'var(--yellow)', fontSize: '1.5rem' }}>Multiple Reservation</div>
                    <button className="btn-icon header-btn" onClick={onClose}><X size={18} /></button>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <div className="form-group" style={{ flex: 1 }}>
                        <label className="form-label">Block</label>
                        <select className="form-input" value={block} onChange={e => setBlock(e.target.value)}>
                            {blocks.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                        <label className="form-label">From spot</label>
                        <input type="number" className="form-input" placeholder="e.g. 1" value={fromNum} onChange={e => setFromNum(e.target.value)} />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                        <label className="form-label">To spot</label>
                        <input type="number" className="form-input" placeholder="e.g. 10" value={toNum} onChange={e => setToNum(e.target.value)} />
                    </div>
                </div>
                <div className="form-group" style={{ marginBottom: '8px' }}>
                    <label className="form-label">Last Name</label>
                    <input type="text" className="form-input" placeholder="e.g. Smith" value={nom} onChange={e => setNom(e.target.value)} />
                </div>
                <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label className="form-label">First Name</label>
                    <input type="text" className="form-input" placeholder="e.g. John" value={prenom} onChange={e => setPrenom(e.target.value)} />
                </div>
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleReserve}>
                    Reserve Range
                </button>
            </motion.div>
        </motion.div>
    );
}

// Multiple Release Modal
function MultipleReleaseModal({ onClose, onMultipleRelease, blocks }) {
    const [block, setBlock] = useState(blocks[0]);
    const [fromNum, setFromNum] = useState('');
    const [toNum, setToNum] = useState('');

    const handleRelease = () => {
        const start = parseInt(fromNum);
        const end = parseInt(toNum);
        if (isNaN(start) || isNaN(end) || start > end) return alert('Invalid spot range');
        
        const spotIds = [];
        for (let i = start; i <= end; i++) {
            spotIds.push(`${block}${i}`);
        }
        if (window.confirm(`Are you sure you want to release ${spotIds.length} spots in Block ${block}?`)) {
            onMultipleRelease(spotIds);
        }
    };

    return (
        <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
            <motion.div className="modal" initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <div className="modal-title" style={{ color: 'var(--red)', fontSize: '1.5rem' }}>Multiple Release</div>
                    <button className="btn-icon header-btn" onClick={onClose}><X size={18} /></button>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                    <div className="form-group" style={{ flex: 1 }}>
                        <label className="form-label">Block</label>
                        <select className="form-input" value={block} onChange={e => setBlock(e.target.value)}>
                            {blocks.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                        <label className="form-label">From spot</label>
                        <input type="number" className="form-input" placeholder="e.g. 1" value={fromNum} onChange={e => setFromNum(e.target.value)} />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                        <label className="form-label">To spot</label>
                        <input type="number" className="form-input" placeholder="e.g. 10" value={toNum} onChange={e => setToNum(e.target.value)} />
                    </div>
                </div>
                <button className="btn btn-danger" style={{ width: '100%' }} onClick={handleRelease}>
                    Release Range
                </button>
            </motion.div>
        </motion.div>
    );
}

export default function ParkingMapRHL() {
    const [spots, setSpots] = useState({});
    const [selectedSpot, setSelectedSpot] = useState(null);
    const [showMultipleReserve, setShowMultipleReserve] = useState(false);
    const [showMultipleRelease, setShowMultipleRelease] = useState(false);
    const [activeBlock, setActiveBlock] = useState('all');
    const [loading, setLoading] = useState(true);
    const { token } = useAuthStore();
    const maxParkDays = useSettingsStore(state => state.maxParkDays);

    useEffect(() => {
        let socket;

        const fetchSpots = async () => {
            try {
                const res = await fetch(`${API_URL}/parking/rhl/state`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();

                const spotsMap = {};
                if (data.spots && Array.isArray(data.spots)) {
                    data.spots.forEach(s => {
                        const spotKey = s.spot_label || s.id;
                        if (!spotKey) return;

                        const daysParked = s.daysParked || 0;
                        const actualStatus = (daysParked >= maxParkDays && s.status === 'occupied') ? 'alert' : s.status;
                        spotsMap[spotKey] = {
                            id: spotKey,
                            block: s.block,
                            number: s.position || (typeof spotKey === 'string' ? parseInt(spotKey.replace(/[A-Z]/g, '')) : 0) || 0,
                            status: actualStatus,
                            vin: s.vin,
                            reserved_by: s.reserved_by,
                            reservation_method: s.reservation_method,
                            operator: s.operator_id,
                            entryDate: s.occupied_at,
                            carColor: s.car_color || '#E53935',
                            daysParked: daysParked
                        };
                    });
                } else {
                    console.warn('No spots found in RHL state response:', data);
                }
                setSpots(spotsMap);
            } catch (err) {
                console.error('Failed to fetch RHL spots:', err);
            } finally {
                setLoading(false);
            }
        };

        if (token) {
            fetchSpots();

            socket = io(SOCKET_URL);
            socket.on('spot:updated', (data) => {
                setSpots(prev => {
                    if (!prev[data.spot_id]) return prev;
                    return {
                        ...prev,
                        [data.spot_id]: {
                            ...prev[data.spot_id],
                            status: data.status,
                            vin: data.vin || null,
                            reserved_by: data.reserved_by || null,
                            reservation_method: data.reservation_method || prev[data.spot_id].reservation_method,
                            carColor: data.car_color || (data.status === 'occupied' ? '#E53935' : prev[data.spot_id].carColor)
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

    const blockKeys = Object.keys(BLOCKS);

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
                <div className="parking-stat">
                    <div className="stat-dot" style={{ background: 'var(--yellow)' }} />
                    <span className="stat-label">Total</span>
                    <span className="stat-value">{stats.total}</span>
                </div>
                <div className="parking-stat">
                    <div className="stat-dot" style={{ background: 'var(--blue)' }} />
                    <span className="stat-label">Stored VINs</span>
                    <span className="stat-value text-blue">{stats.occupied}</span>
                </div>
                <div className="parking-stat">
                    <div className="stat-dot" style={{ background: 'var(--orange)' }} />
                    <span className="stat-label">Reserved</span>
                    <span className="stat-value text-orange">{stats.reserved}</span>
                </div>
                <div className="parking-stat">
                    <div className="stat-dot" style={{ background: 'var(--green)' }} />
                    <span className="stat-label">Available</span>
                    <span className="stat-value text-green">{stats.empty}</span>
                </div>
                <div className="parking-stat">
                    <div className="stat-dot" style={{ background: 'var(--red)', animation: 'pulse-badge 2s infinite' }} />
                    <span className="stat-label">Alerts</span>
                    <span className="stat-value text-red">{stats.alert}</span>
                </div>
            </div>

            {/* Block Filters */}
            <div className="parking-filters" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <Filter size={16} style={{ color: 'var(--text-muted)' }} />
                    <button className={`parking-filter-btn ${activeBlock === 'all' ? 'active' : ''}`} onClick={() => setActiveBlock('all')}>
                        All Blocks
                    </button>
                    {blockKeys.map(b => (
                        <button key={b} className={`parking-filter-btn ${activeBlock === b ? 'active' : ''}`} onClick={() => setActiveBlock(b)}>
                            {b}
                        </button>
                    ))}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-secondary" onClick={() => setShowMultipleReserve(true)} style={{ fontSize: '0.8rem', padding: '6px 12px', border: '1px solid var(--yellow)', color: 'var(--yellow)' }}>
                        Multiple Reservation
                    </button>
                    <button className="btn btn-secondary" onClick={() => setShowMultipleRelease(true)} style={{ fontSize: '0.8rem', padding: '6px 12px', border: '1px solid var(--red)', color: 'var(--red)' }}>
                        Multiple Release
                    </button>
                </div>
            </div>

            {/* Entry */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 8px' }}>
                <div style={{ padding: '4px 14px', borderRadius: '4px', background: 'var(--green-dim)', color: 'var(--green)', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: '8px', height: '16px', background: 'var(--green)', borderRadius: '2px' }} />
                    ENTRY
                </div>
            </div>

            {/* Parking Grid */}
            <div className="parking-grid" style={{ background: 'var(--bg-card)', padding: '24px 16px' }}>
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--yellow)', fontSize: '1.2rem', fontWeight: 700 }}>Park RHL</h3>
                </div>
                {blockKeys
                    .filter(b => activeBlock === 'all' || activeBlock === b)
                    .map(block => (
                        <BlockRow key={block} block={block} spots={spots} onSpotClick={setSelectedSpot} />
                    ))
                }
            </div>

            {/* Exit */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 8px' }}>
                <div style={{ padding: '4px 14px', borderRadius: '4px', background: 'var(--red-dim)', color: 'var(--red)', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: '8px', height: '16px', background: 'var(--red)', borderRadius: '2px' }} />
                    EXIT
                </div>
            </div>

            {/* Modal */}
            <AnimatePresence>
                {selectedSpot && (
                    <SpotDetailModal
                        spot={selectedSpot}
                        onClose={() => setSelectedSpot(null)}
                        onRelease={async (id) => {
                            try {
                                await fetch(`${API_URL}/spots/${id}/release`, {
                                    method: 'POST',
                                    headers: { Authorization: `Bearer ${token}` }
                                });
                                setSelectedSpot(null);
                                alert('Place released successfully');
                                window.location.reload();
                            } catch (err) { console.error(err); }
                        }}
                        onReserve={async (id, nom, prenom) => {
                            if (!nom || !prenom) return alert('Last Name and First Name required');
                            try {
                                await fetch(`${API_URL}/spots/${id}/reserve`, {
                                    method: 'POST',
                                    headers: {
                                        'Authorization': `Bearer ${token}`,
                                        'Content-Type': 'application/json'
                                    },
                                    body: JSON.stringify({ nom, prenom })
                                });
                                setSelectedSpot(null);
                                alert('Place reserved successfully');
                                window.location.reload();
                            } catch (err) { console.error(err); }
                        }}
                    />
                )}
                {showMultipleReserve && (
                    <MultipleReserveModal
                        blocks={blockKeys}
                        onClose={() => setShowMultipleReserve(false)}
                        onMultipleReserve={async (spotIds, nom, prenom) => {
                            try {
                                await fetch(`${API_URL}/spots/bulk-reserve`, {
                                    method: 'POST',
                                    headers: {
                                        'Authorization': `Bearer ${token}`,
                                        'Content-Type': 'application/json'
                                    },
                                    body: JSON.stringify({ spotIds, nom, prenom })
                                });
                                setShowMultipleReserve(false);
                                alert('Places réservées avec succès');
                                window.location.reload();
                            } catch (err) { console.error(err); }
                        }}
                    />
                )}
                {showMultipleRelease && (
                    <MultipleReleaseModal
                        blocks={blockKeys}
                        onClose={() => setShowMultipleRelease(false)}
                        onMultipleRelease={async (spotIds) => {
                            try {
                                await fetch(`${API_URL}/spots/bulk-release`, {
                                    method: 'POST',
                                    headers: {
                                        'Authorization': `Bearer ${token}`,
                                        'Content-Type': 'application/json'
                                    },
                                    body: JSON.stringify({ spotIds })
                                });
                                setShowMultipleRelease(false);
                                alert('Spots released successfully');
                                window.location.reload();
                            } catch (err) { console.error(err); }
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
