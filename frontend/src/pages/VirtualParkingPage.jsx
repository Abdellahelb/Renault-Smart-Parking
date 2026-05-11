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

    const { virtualLots, loading, createVirtualLot, createPhysicalLot, toggleVirtualLot, deleteVirtualLot } = useVirtualStore();
    const [creationType, setCreationType] = useState(defaultType); // 'virtual' or 'physical'

    useEffect(() => {
        setCreationType(defaultType);
    }, [defaultType]);

    // Physical Builder State
    const [physName, setPhysName] = useState('');
    const [blocks, setBlocks] = useState([{ name: 'A', total: 20, hasSides: true }]);

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
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                <button 
                    className={`btn ${creationType === 'virtual' ? 'btn-primary' : 'btn-secondary'}`} 
                    onClick={() => setCreationType('virtual')}
                    style={{ flex: 1 }}
                >
                    <Zap size={16} /> Virtual AI Generator
                </button>
                <button 
                    className={`btn ${creationType === 'physical' ? 'btn-primary' : 'btn-secondary'}`} 
                    onClick={() => setCreationType('physical')}
                    style={{ flex: 1 }}
                >
                    <Grid size={16} /> Real Parking Builder
                </button>
            </div>

            {/* Generator */}
            {creationType === 'virtual' ? (
                <motion.div className="card" style={{ marginBottom: '24px', borderColor: 'var(--yellow-border)' }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <div className="card-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div className="kpi-icon yellow"><Zap size={20} /></div>
                            <div>
                                <div className="card-title">AI Virtual Parking Generator</div>
                                <div className="card-subtitle">Generate optimal parking layout for temporary sectors</div>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: '150px' }}>
                            <label className="form-label">Lot Name</label>
                            <input type="text" className="form-input" placeholder="e.g. Overflow Zone C" value={name} onChange={e => setName(e.target.value)} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: '120px' }}>
                            <label className="form-label">Width (m)</label>
                            <input type="number" className="form-input" value={width} onChange={e => setWidth(e.target.value)} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: '120px' }}>
                            <label className="form-label">Length (m)</label>
                            <input type="number" className="form-input" value={length} onChange={e => setLength(e.target.value)} />
                        </div>
                        <button className="btn btn-primary" onClick={generate}>Calculate</button>
                    </div>

                    {layout && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginTop: '20px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
                                <div className="stat-card"><strong>{layout.totalSpots}</strong> <span>Spots</span></div>
                                <div className="stat-card"><strong>{layout.rows}</strong> <span>Rows</span></div>
                                <div className="stat-card"><strong>{layout.spotsPerRow}</strong> <span>Spots/Row</span></div>
                                <div className="stat-card"><strong>{layout.numLanes}</strong> <span>Lanes</span></div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button className="btn btn-primary" onClick={confirm}>Confirm & Create</button>
                                <button className="btn btn-secondary" onClick={() => setLayout(null)}>Cancel</button>
                            </div>
                        </motion.div>
                    )}
                </motion.div>
            ) : (
                <motion.div className="card" style={{ marginBottom: '24px', borderColor: 'var(--blue-border)' }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <div className="card-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div className="kpi-icon blue"><Grid size={20} /></div>
                            <div>
                                <div className="card-title">Physical Parking Builder</div>
                                <div className="card-subtitle">Create permanent storage sectors with custom blocks</div>
                            </div>
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Parking Name</label>
                        <input type="text" className="form-input" placeholder="e.g. Park North Extension" value={physName} onChange={e => setPhysName(e.target.value)} />
                    </div>

                    <div style={{ marginTop: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                            <label className="form-label">Blocks Configuration</label>
                            <button className="btn btn-sm btn-primary" onClick={addBlock}><Plus size={14} /> Add Block</button>
                        </div>
                        
                        {blocks.map((block, i) => (
                            <div key={i} style={{ display: 'flex', gap: '12px', background: 'var(--bg-surface)', padding: '12px', borderRadius: '8px', marginBottom: '8px', alignItems: 'flex-end' }}>
                                <div className="form-group" style={{ marginBottom: 0, width: '80px' }}>
                                    <label className="form-label" style={{ fontSize: '0.65rem' }}>Block</label>
                                    <input type="text" className="form-input" value={block.name} onChange={e => updateBlock(i, 'name', e.target.value)} />
                                </div>
                                <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                                    <label className="form-label" style={{ fontSize: '0.65rem' }}>Total Spots</label>
                                    <input type="number" className="form-input" value={block.total} onChange={e => updateBlock(i, 'total', e.target.value)} />
                                </div>
                                <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input type="checkbox" checked={block.hasSides} onChange={e => updateBlock(i, 'hasSides', e.target.checked)} />
                                    <span style={{ fontSize: '0.75rem' }}>Facing Rows</span>
                                </div>
                                <button className="btn btn-icon btn-danger" onClick={() => removeBlock(i)} disabled={blocks.length === 1}><Trash2 size={14} /></button>
                            </div>
                        ))}
                    </div>

                    <button className="btn btn-primary" style={{ width: '100%', marginTop: '20px' }} onClick={handleCreatePhysical} disabled={!physName}>
                        <Plus size={16} /> Create Physical Parking
                    </button>
                </motion.div>
            )}

            {/* Existing Parkings */}
            <motion.div className="card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <div className="card-header">
                    <div className="card-title">All Storage Sectors</div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{virtualLots?.length || 0} configured</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {virtualLots?.map(v => (
                        <div key={v.id} style={{
                            display: 'flex', alignItems: 'center', gap: '16px', padding: '16px',
                            background: 'var(--bg-surface)', borderRadius: '8px',
                            opacity: v.active ? 1 : 0.5,
                            border: `1px solid ${v.active ? (v.type === 'virtual' ? 'var(--yellow-border)' : 'var(--blue-border)') : 'transparent'}`,
                        }}>
                            <div className={`kpi-icon ${v.type === 'virtual' ? 'yellow' : 'blue'}`} style={{ width: '40px', height: '40px' }}>
                                {v.type === 'virtual' ? <Zap size={18} /> : <Grid size={18} />}
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{v.name} <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 400 }}>({v.type.toUpperCase()})</span></div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    {v.spots} spots · Created {new Date(v.created_at).toLocaleDateString()}
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '6px' }}>
                                <button className="btn btn-sm btn-primary" onClick={() => navigate(v.type === 'virtual' ? `/map/virtual/${v.id}` : `/map/physical/${v.id}`)}>
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
