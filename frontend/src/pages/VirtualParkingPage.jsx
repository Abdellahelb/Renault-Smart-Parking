import { API_URL, SOCKET_URL } from '../api_config';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Zap, Ruler, Grid, Trash2, Eye, Settings, Map as MapIcon, ArrowRight, ParkingSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import useVirtualStore from '../store/virtualStore';

const JOGGER = { length: 5.2, width: 2.4 }; // meters
const DRIVE_LANE = 6.0; // meters

function calculateLayout(widthM, lengthM, angle = 90) {
    const spotW = JOGGER.width;
    const spotL = JOGGER.length;
    const lane = DRIVE_LANE;
    const rowDepth = spotL; 
    const numLanes = Math.floor(lengthM / (2 * rowDepth + lane));
    const spotsPerRow = Math.floor(widthM / spotW);
    const totalSpots = numLanes * spotsPerRow * 2;
    return {
        rows: numLanes * 2,
        cols: spotsPerRow,
        totalSpots,
        numLanes,
        spotsPerRow,
    };
}

export default function VirtualParkingPage() {
    const navigate = useNavigate();
    const { virtualLots, loading, createVirtualLot, deleteVirtualLot } = useVirtualStore();
    
    // Virtual Generator State
    const [width, setWidth] = useState('');
    const [length, setLength] = useState('');
    const [name, setName] = useState('');
    const [layout, setLayout] = useState(null);

    const generate = () => {
        const w = parseFloat(width);
        const l = parseFloat(length);
        if (!w || !l || w < 10 || l < 15) return;
        setLayout(calculateLayout(w, l));
    };

    const confirm = async () => {
        if (!layout || !name || loading) return;
        const result = await createVirtualLot({
            name,
            totalSpots: layout.totalSpots,
            width: parseFloat(width),
            length: parseFloat(length)
        });
        if (result && result.id) {
            setLayout(null);
            setWidth('');
            setLength('');
            setName('');
            if (window.confirm('Virtual Park created successfully! Would you like to view the interactive map now?')) {
                navigate(`/map/virtual/${result.id}`);
            }
        }
    };

    const deleteLot = async (id) => {
        if (window.confirm('Are you sure you want to delete this sector?')) await deleteVirtualLot(id);
    };

    return (
        <div className="parking-lots-container">

            {/* AI Virtual Generator */}
            <motion.div className="card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <div className="card-header">
                    <div className="card-title">AI Virtual Parking Generator</div>
                </div>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div className="form-group" style={{ flex: 2 }}><label className="form-label">Lot Name</label><input type="text" className="form-input" value={name} onChange={e => setName(e.target.value)} /></div>
                    <div className="form-group" style={{ flex: 1 }}><label className="form-label">Width (m)</label><input type="number" className="form-input" value={width} onChange={e => setWidth(e.target.value)} /></div>
                    <div className="form-group" style={{ flex: 1 }}><label className="form-label">Length (m)</label><input type="number" className="form-input" value={length} onChange={e => setLength(e.target.value)} /></div>
                    <button className="btn btn-primary" onClick={generate} style={{ height: '42px' }}>Calculate</button>
                </div>
                {layout && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginTop: '20px', padding: '16px', background: 'var(--bg-surface)', borderRadius: '12px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '20px' }}>
                            <div className="stat-card"><strong>{layout.totalSpots}</strong> <span>Spots</span></div>
                            <div className="stat-card"><strong>{layout.rows}</strong> <span>Rows</span></div>
                            <div className="stat-card"><strong>{layout.spotsPerRow}</strong> <span>S/Row</span></div>
                            <div className="stat-card"><strong>{layout.numLanes}</strong> <span>Lanes</span></div>
                        </div>
                        
                        <div style={{ marginBottom: '24px' }}>
                            <div className="form-label" style={{ fontSize: '1rem', marginBottom: '12px', color: 'var(--yellow)' }}>Layout Preview (Interactive Simulation)</div>
                            <div style={{ 
                                background: '#111', 
                                padding: '24px', 
                                borderRadius: '12px', 
                                maxHeight: '600px', 
                                overflowY: 'auto',
                                border: '1px solid var(--bg-surface)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '16px',
                                boxShadow: 'inset 0 0 40px rgba(0,0,0,0.5)'
                            }}>
                                {[...Array(layout.numLanes)].map((_, laneIdx) => (
                                    <div key={laneIdx} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {/* Row A */}
                                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                            {[...Array(layout.spotsPerRow)].map((_, i) => {
                                                const spotNum = (laneIdx * 2 * layout.spotsPerRow) + i + 1;
                                                return (
                                                    <div key={i} style={{ 
                                                        width: '64px', 
                                                        height: '110px', 
                                                        background: 'rgba(255,255,255,0.02)', 
                                                        border: '1px solid var(--green)', 
                                                        borderRadius: '8px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 600,
                                                        color: 'rgba(255,255,255,0.4)',
                                                        fontFamily: 'var(--font-display)'
                                                    }}>
                                                        V{spotNum}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        {/* Road / Lane */}
                                        <div style={{ 
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '12px',
                                            padding: '4px 0'
                                        }}>
                                            <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(247,201,72,0.1), transparent)' }} />
                                            <span style={{ fontSize: '0.65rem', color: 'rgba(247,201,72,0.3)', letterSpacing: '4px', textTransform: 'uppercase', fontWeight: 600 }}>— DRIVE LANE —</span>
                                            <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(247,201,72,0.1), transparent)' }} />
                                        </div>
                                        {/* Row B */}
                                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                            {[...Array(layout.spotsPerRow)].map((_, i) => {
                                                const spotNum = (laneIdx * 2 * layout.spotsPerRow) + layout.spotsPerRow + i + 1;
                                                return (
                                                    <div key={i} style={{ 
                                                        width: '64px', 
                                                        height: '110px', 
                                                        background: 'rgba(255,255,255,0.02)', 
                                                        border: '1px solid rgba(247,201,72,0.3)', 
                                                        borderRadius: '8px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 600,
                                                        color: 'rgba(255,255,255,0.4)',
                                                        fontFamily: 'var(--font-display)'
                                                    }}>
                                                        V{spotNum}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <button className="btn btn-primary" onClick={confirm} style={{ width: '100%' }}>Confirm & Create Sector</button>
                    </motion.div>
                )}
            </motion.div>

            {/* Existing Sectors List (Moved below generator) */}
            <motion.div className="card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginTop: '24px' }}>
                <div className="card-header">
                    <div className="card-title">Active Storage Sectors</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {virtualLots?.map(v => (
                        <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'var(--bg-surface)', borderRadius: '8px' }}>
                            <div className={`kpi-icon ${v.type === 'virtual' ? 'yellow' : 'blue'}`} style={{ width: '32px', height: '32px' }}>
                                {v.type === 'virtual' ? <Zap size={16} /> : <Grid size={16} />}
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{v.name}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{v.type?.toUpperCase() || 'VIRTUAL'} · {v.total_spots_actual || v.total_spots || 0} spots</div>
                            </div>
                            <div style={{ display: 'flex', gap: '4px' }}>
                                <button className="btn btn-sm btn-primary" onClick={() => navigate(v.type === 'virtual' ? `/map/virtual/${v.id}` : (v.name.includes('RHL') ? '/map/rhl' : v.name.includes('Contine') ? '/map/contine' : `/map/physical/${v.id}`))}><MapIcon size={12} /></button>
                                <button className="btn btn-sm btn-danger" onClick={() => deleteLot(v.id)}><Trash2 size={12} /></button>
                            </div>
                        </div>
                    ))}
                </div>
            </motion.div>
        </div>
    );
}
