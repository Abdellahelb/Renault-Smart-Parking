import { useState, useEffect } from 'react';
import { API_URL } from '../api_config';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { motion, AnimatePresence } from 'framer-motion';
import { ScanBarcode, CheckCircle2, XCircle, Zap } from 'lucide-react';
import useAuthStore from '../store/authStore';

export default function ScanExitPage() {
    const [scanning, setScanning] = useState(false);
    const [result, setResult] = useState(null);
    const { token } = useAuthStore.getState();

    useEffect(() => {
        const scanner = new Html5QrcodeScanner("reader", { 
            fps: 10, 
            qrbox: { width: 250, height: 250 },
            supportedScanTypes: [0] // Camera scan only
        });

        const onScanSuccess = async (decodedText) => {
            scanner.clear();
            setScanning(true);
            
            try {
                const res = await fetch(`${API_URL}/esp/scan-exit`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ vin: decodedText })
                });
                
                const data = await res.json();
                
                if (res.ok) {
                    setResult({ success: true, place: data.place, vin: decodedText });
                } else {
                    setResult({ success: false, error: data.error || 'Erreur lors de la libération' });
                }
            } catch (err) {
                setResult({ success: false, error: 'Erreur réseau' });
            } finally {
                setScanning(false);
            }
        };

        scanner.render(onScanSuccess, (error) => {});

        return () => {
            scanner.clear().catch(error => {
                console.error("Failed to clear html5QrcodeScanner. ", error);
            });
        };
    }, []);

    const reset = () => {
        window.location.reload();
    };

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '16px' }}>
            <motion.div className="card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <div className="card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className="kpi-icon blue" style={{ width: '40px', height: '40px' }}>
                            <ScanBarcode size={20} />
                        </div>
                        <div>
                            <div className="card-title">Scanner de Sortie</div>
                            <div className="card-subtitle">Scannez le VIN pour libérer la place</div>
                        </div>
                    </div>
                </div>

                {!result && !scanning && (
                    <div id="reader" style={{ width: '100%', marginTop: '20px' }}></div>
                )}

                <AnimatePresence>
                    {scanning && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            style={{
                                marginTop: '16px', padding: '20px', textAlign: 'center',
                                background: 'var(--bg-surface)', borderRadius: '8px',
                                border: '1px solid var(--blue-border)',
                            }}
                        >
                            <motion.div
                                animate={{ opacity: [0.3, 1, 0.3] }}
                                transition={{ duration: 1.5, repeat: Infinity }}
                                style={{ color: 'var(--blue)', fontSize: '0.85rem', fontWeight: 600 }}
                            >
                                <Zap size={20} style={{ display: 'inline', marginRight: '8px' }} />
                                Traitement en cours...
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <AnimatePresence>
                    {result && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            style={{
                                marginTop: '16px', padding: '20px', borderRadius: '12px',
                                background: result.success ? 'var(--blue-dim)' : 'var(--red-dim)',
                                border: \`1px solid \${result.success ? 'rgba(33,150,243,0.3)' : 'rgba(229,57,53,0.3)'}\`,
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                {result.success ? (
                                    <CheckCircle2 size={24} style={{ color: 'var(--blue)', flexShrink: 0 }} />
                                ) : (
                                    <XCircle size={24} style={{ color: 'var(--red)', flexShrink: 0 }} />
                                )}
                                <div>
                                    <div style={{
                                        fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 700, marginBottom: '8px',
                                        color: result.success ? 'var(--blue)' : 'var(--red)',
                                    }}>
                                        {result.success ? 'PLACE LIBÉRÉE' : 'ERREUR'}
                                    </div>
                                    <div style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>
                                        {result.success ? \`La place \${result.place} a bien été libérée.\` : result.error}
                                    </div>
                                </div>
                            </div>
                            <button className="btn btn-secondary" onClick={reset} style={{ marginTop: '20px', width: '100%' }}>
                                Scanner un autre véhicule
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
}
