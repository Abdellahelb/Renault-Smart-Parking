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

export default function VirtualParkingPage({ defaultType = 'virtual' }) {
    const navigate = useNavigate();
    const { virtualLots, loading, createVirtualLot, createPhysicalLot, toggleVirtualLot, deleteVirtualLot } = useVirtualStore();
    
    const [creationType, setCreationType] = useState(defaultType);
    
    // Virtual Generator State
    const [width, setWidth] = useState('');
    const [length, setLength] = useState('');
    const [name, setName] = useState('');
    const [layout, setLayout] = useState(null);

    // Physical Builder State
    const [physName, setPhysName] = useState('');
    const [blocks, setBlocks] = useState([{ name: 'A', total: 20, hasSides: true }]);

    useEffect(() => {
        setCreationType(defaultType);
    }, [defaultType]);

    const addBlock = () => setBlocks([...blocks, { name: String.fromCharCode(65 + blocks.length), total: 20, hasSides: true }]);
    const removeBlock = (index) => setBlocks(blocks.filter((_, i) => i !== index));
    const updateBlock = (index, field, value) => {
        const newBlocks = [...blocks];
        newBlocks[index][field] = value;
        setBlocks(newBlocks);
    };

    const handleCreatePhysical = async () => {
        if (!physName || loading) return;
        const res = await createPhysicalLot({ name: physName, blocks });
        if (res.success) {
            setPhysName('');
            setBlocks([{ name: 'A', total: 20, hasSides: true }]);
            alert('Physical Parking created successfully!');
        }
    };

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

    const toggleVirtual = (id) => toggleVirtualLot(id);
    const deleteVirtual = async (id) => {
        if (window.confirm('Are you sure?')) await deleteVirtualLot(id);
    };

    return (
        <div className="parking-lots-container">
            <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                <button 
                    className={`btn ${creationType === 'virtual' ? 'btn-primary' : 'btn-secondary'}`} 
                    onClick={() => setCreationType('virtual')}
                    style={{ flex: 1, height: '48px' }}
                >
                    <Zap size={18} /> Virtual Sector AI
                </button>
                <button 
                    className={`btn ${creationType === 'physical' ? 'btn-primary' : 'btn-secondary'}`} 
                    onClick={() => setCreationType('physical')}
                    style={{ flex: 1, height: '48px' }}
                >
                    <ParkingSquare size={18} /> Physical Sector Build
                </button>
            </div>

            {creationType === 'virtual' ? (
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
                            
                            <div style={{ marginBottom: '20px' }}>
                                <div className="form-label">Layout Preview</div>
                                <div style={{ 
                                    background: 'var(--bg-card)', 
                                    padding: '12px', 
                                    borderRadius: '8px', 
                                    maxHeight: '150px', 
                                    overflowY: 'auto',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '8px'
                                }}>
                                    {[...Array(layout.numLanes)].map((_, laneIdx) => (
                                        <div key={laneIdx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <div style={{ display: 'flex', gap: '2px', justifyContent: 'center' }}>
                                                {[...Array(layout.spotsPerRow)].map((_, i) => <div key={i} style={{ width: '8px', height: '16px', background: 'var(--green-dim)', border: '1px solid var(--green)', borderRadius: '1px' }} />)}
                                            </div>
                                            <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderTop: '1px dashed rgba(255,255,255,0.1)', borderBottom: '1px dashed rgba(255,255,255,0.1)' }} />
                                            <div style={{ display: 'flex', gap: '2px', justifyContent: 'center' }}>
                                                {[...Array(layout.spotsPerRow)].map((_, i) => <div key={i} style={{ width: '8px', height: '16px', background: 'var(--green-dim)', border: '1px solid var(--green)', borderRadius: '1px' }} />)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <button className="btn btn-primary" onClick={confirm} style={{ width: '100%' }}>Confirm & Create Sector</button>
                        </motion.div>
                    )}
                </motion.div>
            ) : (
                <motion.div className="card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <div className="card-header"><div className="card-title">Physical Parking Builder</div></div>
                    <div className="form-group"><label className="form-label">Parking Name</label><input type="text" className="form-input" value={physName} onChange={e => setPhysName(e.target.value)} /></div>
                    <div style={{ marginTop: '16px' }}>
                        {blocks.map((block, i) => (
                            <div key={i} style={{ display: 'flex', gap: '10px', background: 'var(--bg-surface)', padding: '10px', borderRadius: '8px', marginBottom: '8px', alignItems: 'center' }}>
                                <input type="text" className="form-input" style={{ width: '80px' }} value={block.name} onChange={e => updateBlock(i, 'name', e.target.value)} />
                                <input type="number" className="form-input" style={{ flex: 1 }} value={block.total} onChange={e => updateBlock(i, 'total', e.target.value)} />
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><input type="checkbox" checked={block.hasSides} onChange={e => updateBlock(i, 'hasSides', e.target.checked)} /><span style={{ fontSize: '0.7rem' }}>Sides</span></div>
                                <button className="btn btn-icon btn-danger" onClick={() => removeBlock(i)}><Trash2 size={14} /></button>
                            </div>
                        ))}
                        <button className="btn btn-sm btn-secondary" onClick={addBlock} style={{ marginTop: '8px' }}><Plus size={14} /> Add Block</button>
                    </div>

                    {/* Physical Preview */}
                    {physName && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginTop: '20px', padding: '16px', background: 'var(--bg-surface)', borderRadius: '12px', border: '1px solid var(--blue-border)' }}>
                            <div className="form-label">Structure Preview</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                                {blocks.map((b, idx) => (
                                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ background: 'var(--blue)', color: 'white', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem' }}>{b.name}</div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{b.total} Spots</div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{b.hasSides ? 'Dual facing rows with drive lane' : 'Single row structure'}</div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '2px' }}>
                                            {[...Array(Math.min(5, b.total))].map((_, i) => <div key={i} style={{ width: '6px', height: '12px', background: 'var(--blue-dim)', border: '1px solid var(--blue)', borderRadius: '1px' }} />)}
                                            {b.total > 5 && <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>...</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleCreatePhysical}>Confirm & Create Physical Parking</button>
                        </motion.div>
                    )}
                </motion.div>
            )}

            <motion.div className="card" style={{ marginTop: '24px' }}>
                <div className="card-header">
                    <div className="card-title">
                        {creationType === 'virtual' ? 'Virtual AI Sectors' : 'Physical Storage Sectors'}
                    </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {virtualLots?.filter(v => v.type === creationType).map(v => (
                        <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'var(--bg-surface)', borderRadius: '8px' }}>
                            <div className={`kpi-icon ${v.type === 'virtual' ? 'yellow' : 'blue'}`} style={{ width: '32px', height: '32px' }}>
                                {v.type === 'virtual' ? <Zap size={16} /> : <Grid size={16} />}
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{v.name}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{v.type.toUpperCase()} · {v.spots} spots</div>
                            </div>
                            <div style={{ display: 'flex', gap: '4px' }}>
                                <button className="btn btn-sm btn-primary" onClick={() => navigate(v.type === 'virtual' ? `/map/virtual/${v.id}` : `/map/physical/${v.id}`)}><MapIcon size={12} /></button>
                                <button className="btn btn-sm btn-secondary" onClick={() => toggleVirtual(v.id)}>{v.active ? 'Off' : 'On'}</button>
                                {v.name !== 'Park RHL' && v.name !== 'Park Cantine' && (
                                    <button className="btn btn-sm btn-danger" onClick={() => deleteVirtual(v.id)}><Trash2 size={12} /></button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </motion.div>
        </div>
    );
}
