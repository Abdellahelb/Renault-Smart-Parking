import { API_URL, SOCKET_URL } from '../api_config';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Zap, Ruler, Grid, Trash2, Eye, Settings, Map as MapIcon, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const JOGGER = { length: 5.2, width: 2.4 }; // meters
const DRIVE_LANE = 6.0; // meters

function calculateLayout(widthM, lengthM, angle = 90) {
    const spotW = JOGGER.width;
    const spotL = JOGGER.length;
    const lane = DRIVE_LANE;

    // For 90° parking: rows of spots on each side of a drive lane
    const rowDepth = spotL; // depth of one parking row
    const numLanes = Math.floor(lengthM / (2 * rowDepth + lane));
    const spotsPerRow = Math.floor(widthM / spotW);
    const totalSpots = numLanes * spotsPerRow * 2; // two sides per lane

    return {
        rows: numLanes * 2,
        cols: spotsPerRow,
        totalSpots,
        numLanes,
        spotsPerRow,
        usedWidth: spotsPerRow * spotW,
        usedLength: numLanes * (2 * rowDepth + lane),
        wastedWidth: widthM - (spotsPerRow * spotW),
        wastedLength: lengthM - (numLanes * (2 * rowDepth + lane)),
    };
}

import useVirtualStore from '../store/virtualStore';

export default function VirtualParkingPage() {
    const [width, setWidth] = useState('');
    const [length, setLength] = useState('');
    const [name, setName] = useState('');
    const [layout, setLayout] = useState(null);
    const navigate = useNavigate();
    const { virtualLots, loading, createVirtualLot, toggleVirtualLot, deleteVirtualLot } = useVirtualStore();

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

        setLayout(null);
        setWidth('');
        setLength('');
        setName('');

        if (result && result.id) {
            if (window.confirm('Virtual Park created successfully! Would you like to view the interactive map now?')) {
                navigate(`/map/virtual/${result.id}`);
            }
        }
    };

    const toggleVirtual = (id) => {
        toggleVirtualLot(id);
    };

    const deleteVirtual = async (id) => {
        if (window.confirm('Are you sure you want to delete this virtual parking lot? This action cannot be undone.')) {
            await deleteVirtualLot(id);
        }
    };

    return (
        <div>
            {/* Generator */}
            <motion.div className="card" style={{ marginBottom: '24px', borderColor: 'var(--yellow-border)' }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <div className="card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className="kpi-icon yellow"><Zap size={20} /></div>
                        <div>
                            <div className="card-title">AI Virtual Parking Generator</div>
                            <div className="card-subtitle">Generate optimal parking layout using Dacia Jogger dimensions (5.2m × 2.4m)</div>
                        </div>
                    </div>
                    <span className="badge badge-admin">AI</span>
                </div>

                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: '150px' }}>
                        <label className="form-label">Lot Name</label>
                        <input type="text" className="form-input" placeholder="e.g. Overflow Zone C" value={name} onChange={e => setName(e.target.value)} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: '120px' }}>
                        <label className="form-label">Width (meters)</label>
                        <input type="number" className="form-input" placeholder="e.g. 30" value={width} onChange={e => setWidth(e.target.value)} min="10" />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: '120px' }}>
                        <label className="form-label">Length (meters)</label>
                        <input type="number" className="form-input" placeholder="e.g. 50" value={length} onChange={e => setLength(e.target.value)} min="15" />
                    </div>
                    <button className="btn btn-primary" onClick={generate} style={{ height: '42px' }}>
                        <Zap size={16} /> Calculate Layout
                    </button>
                </div>

                {/* Result */}
                {layout && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ marginTop: '20px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                            {[
                                { label: 'Total Spots', value: layout.totalSpots, color: 'var(--yellow)' },
                                { label: 'Rows', value: layout.rows, color: 'var(--blue)' },
                                { label: 'Spots/Row', value: layout.spotsPerRow, color: 'var(--green)' },
                                { label: 'Drive Lanes', value: layout.numLanes, color: 'var(--orange)' },
                            ].map(item => (
                                <div key={item.label} style={{ background: 'var(--bg-surface)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700, color: item.color }}>{item.value}</div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{item.label}</div>
                                </div>
                            ))}
                        </div>

                        {/* Mini Preview */}
                        <div style={{ background: 'var(--bg-surface)', borderRadius: '8px', padding: '16px', marginBottom: '12px' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Layout Preview</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                                {Array(Math.min(layout.numLanes, 4)).fill(0).map((_, lane) => (
                                    <div key={lane} style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', gap: '2px' }}>
                                            {Array(Math.min(layout.spotsPerRow, 12)).fill(0).map((_, s) => (
                                                <div key={s} style={{ width: '20px', height: '28px', background: 'var(--green-dim)', border: '1px solid var(--green)', borderRadius: '3px', fontSize: '0.45rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--green)' }}>
                                                    V{lane * layout.spotsPerRow * 2 + s + 1}
                                                </div>
                                            ))}
                                        </div>
                                        <div style={{ fontSize: '0.5rem', color: 'var(--text-muted)', padding: '1px 0' }}>— lane —</div>
                                        <div style={{ display: 'flex', gap: '2px' }}>
                                            {Array(Math.min(layout.spotsPerRow, 12)).fill(0).map((_, s) => (
                                                <div key={s} style={{ width: '20px', height: '28px', background: 'var(--green-dim)', border: '1px solid var(--green)', borderRadius: '3px', fontSize: '0.45rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--green)' }}>
                                                    V{lane * layout.spotsPerRow * 2 + layout.spotsPerRow + s + 1}
                                                </div>
                                            ))}
                                        </div>
                                        {lane < Math.min(layout.numLanes, 4) - 1 && <div style={{ height: '4px' }} />}
                                    </div>
                                ))}
                            </div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'center' }}>
                                Spot size: {JOGGER.length}m × {JOGGER.width}m · Drive lane: {DRIVE_LANE}m · Angle: 90°
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn btn-primary" onClick={confirm} disabled={!name}><Plus size={16} /> Confirm & Create</button>
                            <button className="btn btn-secondary" onClick={() => setLayout(null)}>Cancel</button>
                        </div>
                    </motion.div>
                )}
            </motion.div>

            {/* Existing Virtual Parkings */}
            <motion.div className="card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <div className="card-header">
                    <div className="card-title">Virtual Parking Lots</div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{virtualLots?.length || 0} lots configured</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {virtualLots?.map(v => (
                        <div key={v.id} style={{
                            display: 'flex', alignItems: 'center', gap: '16px', padding: '16px',
                            background: 'var(--bg-surface)', borderRadius: '8px',
                            opacity: v.active ? 1 : 0.5,
                            border: `1px solid ${v.active ? 'var(--border-color)' : 'transparent'}`,
                        }}>
                            <div className="kpi-icon green" style={{ width: '40px', height: '40px' }}>
                                <Grid size={18} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{v.name}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    {v.width}m × {v.length}m · {v.spots} spots · Created {v.created}
                                </div>
                            </div>
                            <span className={`badge ${v.active ? 'badge-available' : 'badge-occupied'}`}>
                                {v.active ? 'Active' : 'Inactive'}
                            </span>
                            <div style={{ display: 'flex', gap: '6px' }}>
                                <button className="btn btn-sm btn-primary" onClick={() => navigate(`/map/virtual/${v.id}`)}>
                                    <MapIcon size={14} /> View Map
                                </button>
                                <button className="btn btn-sm btn-secondary" onClick={() => toggleVirtual(v.id)}>
                                    {v.active ? 'Deactivate' : 'Activate'}
                                </button>
                                <button className="btn btn-sm btn-danger" onClick={() => deleteVirtual(v.id)}>
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </motion.div>
        </div>
    );
}
