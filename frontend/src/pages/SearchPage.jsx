import { API_URL, SOCKET_URL } from '../api_config';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, Filter, Download, Calendar, MapPin, Car, ChevronDown, FileSpreadsheet, X as CloseIcon } from 'lucide-react';
import { read, utils } from 'xlsx';

import useAuthStore from '../store/authStore';
import useSettingsStore from '../store/settingsStore';

export default function SearchPage() {
    const { token } = useAuthStore();
    const maxParkDays = useSettingsStore(state => state.maxParkDays);
    const [searchParams] = useSearchParams();
    const [query, setQuery] = useState(searchParams.get('q') || '');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [blockFilter, setBlockFilter] = useState('all');
    const [parkingFilter, setParkingFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [bulkVins, setBulkVins] = useState([]);

    useEffect(() => {
        const fetchVehicles = async () => {
            try {
                const res = await fetch(`${API_URL}/vehicles/search`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                if (data.vehicles) {
                    // Only show spots that have vehicles in them
                    setResults(data.vehicles.filter(v => v.status !== 'empty'));
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchVehicles();
    }, [token]);

    const filteredResults = (() => {
        const searchInput = query.toLowerCase();

        // Single Search Mode
        if (bulkVins.length === 0) {
            return results.filter(v => {
                if (query && !(v.vin && v.vin.toLowerCase().includes(searchInput))) return false;
                if (blockFilter !== 'all' && v.block !== blockFilter) return false;
                if (parkingFilter !== 'all' && v.parking !== parkingFilter) return false;
                if (statusFilter !== 'all' && v.status !== statusFilter) return false;
                return true;
            });
        }

        // Bulk Search Mode: Show all VINs from Excel
        const uniqueBulkVins = [...new Set(bulkVins.map(v => v.toUpperCase()))];
        return uniqueBulkVins.map(bv => {
            const found = results.find(v => v.vin?.toUpperCase() === bv);
            if (found) {
                // Apply filters to found results if they are active
                if (blockFilter !== 'all' && found.block !== blockFilter) return null;
                if (parkingFilter !== 'all' && found.parking !== parkingFilter) return null;
                if (statusFilter !== 'all' && found.status !== statusFilter) return null;
                return found;
            }
            // If not found, only show if no location-based filters are active
            if (blockFilter !== 'all' || parkingFilter !== 'all' || statusFilter !== 'all') return null;
            return { vin: bv, status: 'not_found', spot_label: '-', parking: '-', occupied_at: null, operator_id: '-' };
        }).filter(Boolean);
    })();

    const handleExcelUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target.result;
            const wb = read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = utils.sheet_to_json(ws, { header: 1 });

            // Filter for valid 17-character VINs (alphanumeric, no I, O, Q)
            const vinRegex = /^[A-HJ-NPR-Z0-9]{17}$/i;
            const extractedVins = data.flat()
                .filter(cell => typeof cell === 'string' && vinRegex.test(cell.trim()))
                .map(cell => cell.trim().toUpperCase());

            if (extractedVins.length === 0) {
                // If no 17-char VINs found, maybe it's partials or a different format, 
                // but let's at least filter out very short strings/headers
                const partials = data.flat()
                    .filter(cell => typeof cell === 'string' && cell.trim().length >= 8)
                    .map(cell => cell.trim().toUpperCase());
                setBulkVins(partials);
            } else {
                setBulkVins(extractedVins);
            }
            setQuery(''); // Clear single search when bulk is active
        };
        reader.readAsBinaryString(file);
    };

    const downloadCSV = () => {
        if (!filteredResults || filteredResults.length === 0) return;

        const headers = ['VIN', 'Spot', 'Parking', 'Status', 'Entry Date & Time', 'Days Parked'];
        const csvRows = [headers.join(',')];

        filteredResults.forEach(v => {
            const row = [
                (v.vin || '').replace(/,/g, ''),
                (v.spot_label || '').replace(/,/g, ''),
                (v.parking || '').replace(/,/g, ''),
                (v.status || '').toUpperCase().replace(/,/g, ''),
                v.occupied_at ? new Date(v.occupied_at).toLocaleString('en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).replace(/,/g, '') : '-',
                Math.floor((new Date() - new Date(v.occupied_at)) / (1000 * 60 * 60 * 24))
            ];
            csvRows.push(row.join(','));
        });

        const csvString = csvRows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('hidden', '');
        a.setAttribute('href', url);
        a.setAttribute('download', `SPM_Search_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    return (
        <div>
            {/* Search Bar */}
            <motion.div className="card" style={{ marginBottom: '16px' }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div className="form-group" style={{ flex: 2, minWidth: '200px', marginBottom: 0 }}>
                        <label className="form-label">Search VIN or Model</label>
                        <div style={{ position: 'relative' }}>
                            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input type="text" className="form-input" placeholder="Enter VIN, vehicle model..." value={query} onChange={e => setQuery(e.target.value)} style={{ paddingLeft: '36px' }} />
                        </div>
                    </div>
                    <div className="form-group" style={{ flex: 1, minWidth: '140px', marginBottom: 0 }}>
                        <label className="form-label">From</label>
                        <input type="date" className="form-input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                    </div>
                    <div className="form-group" style={{ flex: 1, minWidth: '140px', marginBottom: 0 }}>
                        <label className="form-label">To</label>
                        <input type="date" className="form-input" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                            type="file"
                            id="excel-upload"
                            hidden
                            accept=".xlsx, .xls, .csv"
                            onChange={handleExcelUpload}
                        />
                        <button
                            className="btn btn-secondary"
                            style={{ height: '42px', border: bulkVins.length > 0 ? '1px solid var(--blue)' : '1px solid var(--border-color)' }}
                            onClick={() => document.getElementById('excel-upload').click()}
                        >
                            <FileSpreadsheet size={16} /> {bulkVins.length > 0 ? `Imported (${bulkVins.length})` : 'Import Excel'}
                        </button>
                        {bulkVins.length > 0 && (
                            <button className="btn btn-icon" onClick={() => setBulkVins([])} title="Clear bulk search">
                                <CloseIcon size={16} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Filters */}
                <div style={{ display: 'flex', gap: '12px', marginTop: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <Filter size={14} style={{ color: 'var(--text-muted)' }} />
                    <select className="form-input" style={{ width: 'auto', padding: '6px 12px', fontSize: '0.8rem' }} value={parkingFilter} onChange={e => setParkingFilter(e.target.value)}>
                        <option value="all">All Parkings</option>
                        <option value="RHL">RHL</option>
                        <option value="Contine">Contine</option>
                    </select>
                    <select className="form-input" style={{ width: 'auto', padding: '6px 12px', fontSize: '0.8rem' }} value={blockFilter} onChange={e => setBlockFilter(e.target.value)}>
                        <option value="all">All Blocks</option>
                        {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'].map(b => <option key={b} value={b}>Block {b}</option>)}
                    </select>
                    <select className="form-input" style={{ width: 'auto', padding: '6px 12px', fontSize: '0.8rem' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                        <option value="all">All Status</option>
                        <option value="occupied">Occupied</option>
                        <option value="reserved">Reserved</option>
                        <option value="alert">Alert</option>
                    </select>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                        <button className="btn btn-sm btn-secondary" onClick={downloadCSV}><Download size={14} /> CSV</button>
                    </div>
                </div>
            </motion.div>

            {/* Results */}
            <motion.div className="card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <div className="card-header">
                    <div className="card-title">Search Results</div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{filteredResults.length} vehicles found</span>
                        {bulkVins.length > 0 && (
                            <>
                                <span style={{ fontSize: '0.74rem', color: 'var(--blue)', fontWeight: 600 }}>
                                    Displaying {filteredResults.length} of {new Set(bulkVins.map(v => v.toUpperCase())).size} VINs from Excel
                                </span>
                            </>
                        )}
                    </div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>VIN</th>
                                <th>Spot</th>
                                <th>Parking</th>
                                <th>Status</th>
                                <th>Entry Date & Time</th>
                                <th>Days</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredResults.map((v, i) => (
                                <tr key={i}>
                                    <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--blue)', fontWeight: 600 }}>{v.vin}</td>
                                    <td style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: v.status === 'not_found' ? 'var(--text-muted)' : 'var(--yellow)' }}>{v.spot_label}</td>
                                    <td>{v.parking}</td>
                                    <td>
                                        <span className={`badge badge-${v.status === 'alert' ? 'alert' : v.status === 'not_found' ? 'secondary' : v.status}`}>
                                            {v.status === 'not_found' ? 'NOT IN SYSTEM' : v.status}
                                        </span>
                                    </td>
                                    <td style={{ fontSize: '0.8rem' }}>
                                        {v.occupied_at ? new Date(v.occupied_at).toLocaleString('en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'}
                                    </td>
                                    <td style={{ color: v.daysParked >= maxParkDays ? 'var(--red)' : 'inherit', fontWeight: v.daysParked >= maxParkDays ? 700 : 400 }}>
                                        {v.occupied_at ? `${Math.floor((new Date() - new Date(v.occupied_at)) / (1000 * 60 * 60 * 24))}d` : '-'}
                                    </td>
                                    <td>
                                        {v.status !== 'not_found' && (
                                            v.reservation_method === 'scan' ? (
                                                <span style={{ fontSize: '0.65rem', color: 'var(--blue)', fontWeight: 600 }}>🛡️ SCAN PROTECTED</span>
                                            ) : (
                                                <button 
                                                    className="btn btn-sm btn-secondary" 
                                                    style={{ fontSize: '0.7rem', padding: '4px 8px' }}
                                                    onClick={async () => {
                                                        if (!window.confirm(`Are you sure you want to release spot ${v.spot_label}?`)) return;
                                                        try {
                                                            await fetch(`${API_URL}/spots/${v.spot_label}/release`, {
                                                                method: 'POST',
                                                                headers: { Authorization: `Bearer ${token}` }
                                                            });
                                                            alert('Spot released successfully');
                                                            window.location.reload();
                                                        } catch (err) { console.error(err); }
                                                    }}
                                                >
                                                    Release
                                                </button>
                                            )
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </motion.div>
        </div>
    );
}
