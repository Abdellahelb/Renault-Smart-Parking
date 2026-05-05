import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform, useMotionValueEvent, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Lock, User, Zap } from 'lucide-react';
import useAuthStore from '../store/authStore';
import './LoginPage.css';

const TOTAL_FRAMES = 181;

export default function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [role, setRole] = useState('operator');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Scrollytelling State
    const [framesLoaded, setFramesLoaded] = useState(0);
    const [images, setImages] = useState([]);
    const containerRef = useRef(null);
    const canvasRef = useRef(null);

    const login = useAuthStore(state => state.login);
    const navigate = useNavigate();

    const [pageReady, setPageReady] = useState(false);

    // Force scroll to top on mount
    useEffect(() => {
        if ('scrollRestoration' in history) {
            history.scrollRestoration = 'manual';
        }
        window.scrollTo(0, 0);
        const timer = setTimeout(() => setPageReady(true), 150);
        return () => clearTimeout(timer);
    }, []);

    // Preload Images
    useEffect(() => {
        const loadedImages = [];
        let loadedCount = 0;

        for (let i = 1; i <= TOTAL_FRAMES; i++) {
            const img = new Image();
            // Format number to 4 digits: 0001, 0002...
            const numStr = i.toString().padStart(4, '0');
            img.src = `/sequence/${numStr}.jpg`;
            img.onload = () => {
                loadedCount++;
                setFramesLoaded(loadedCount);
            };
            loadedImages.push(img);
        }
        setImages(loadedImages);
    }, []);

    // Framer Motion Scroll Tracking
    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start start", "end end"]
    });

    const currentIndex = useTransform(scrollYProgress, [0, 1], [0, TOTAL_FRAMES - 1]);

    // Draw frame to canvas
    const drawFrame = (index) => {
        if (!canvasRef.current || !images[index] || !images[index].complete) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const img = images[index];

        // Match canvas coordinate space to logical size
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        // Calculate object-fit: contain/cover logic
        const canvasRatio = canvas.width / canvas.height;
        const imgRatio = img.width / img.height;

        let drawWidth, drawHeight, offsetX, offsetY;

        // Cover logic to ensure no borders if possible, or contain if preferred
        // We use contain-like behavior scaled up to cover the center part, or just cover
        if (canvasRatio > imgRatio) {
            drawWidth = canvas.width;
            drawHeight = canvas.width / imgRatio;
            offsetX = 0;
            offsetY = (canvas.height - drawHeight) / 2;
        } else {
            drawWidth = canvas.height * imgRatio;
            drawHeight = canvas.height;
            offsetX = (canvas.width - drawWidth) / 2;
            offsetY = 0;
        }

        ctx.fillStyle = '#0B0B0B';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        // Turn off image smoothing for sharper renders if preferred, but usually leaves it on
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
    };

    useMotionValueEvent(currentIndex, "change", (latest) => {
        const index = Math.min(Math.floor(latest), TOTAL_FRAMES - 1);
        requestAnimationFrame(() => drawFrame(index));
    });

    // Initial Draw once first image is loaded
    useEffect(() => {
        if (framesLoaded > 0 && images[0] && images[0].complete) {
            drawFrame(0);
        }
    }, [framesLoaded, images]);

    // Handle Resize
    useEffect(() => {
        const handleResize = () => drawFrame(Math.floor(currentIndex.get()));
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [currentIndex, images]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        setTimeout(async () => {
            const success = await login(username, password);
            if (success) {
                navigate('/dashboard', { replace: true });
            } else {
                setError(useAuthStore.getState().error || 'Invalid credentials');
                setIsLoading(false);
            }
        }, 800);
    };

    // Calculate Opacities for Text Overlays based on scrollYProgress
    // Form disappears instantly from 0% to 5%
    const formOpacity = useTransform(scrollYProgress, [0, 0.01, 0.05], [1, 1, 0]);
    const formScale = useTransform(scrollYProgress, [0, 0.05], [1, 0.95]);

    // Text 1 appears 15% to 35%
    const text1Opacity = useTransform(scrollYProgress, [0.15, 0.2, 0.3, 0.35], [0, 1, 1, 0]);
    const text1Y = useTransform(scrollYProgress, [0.15, 0.2], [20, 0]);

    // Text 2 appears 40% to 60%
    const text2Opacity = useTransform(scrollYProgress, [0.4, 0.45, 0.55, 0.6], [0, 1, 1, 0]);
    const text2Y = useTransform(scrollYProgress, [0.4, 0.45], [20, 0]);

    // Text 3 appears 65% to 85%
    const text3Opacity = useTransform(scrollYProgress, [0.65, 0.7, 0.8, 0.85], [0, 1, 1, 0]);
    const text3Y = useTransform(scrollYProgress, [0.65, 0.7], [20, 0]);

    // Text 4 appears exclusively at the very end when fully assembled (98% to 100%)
    const text4Opacity = useTransform(scrollYProgress, [0.98, 1], [0, 1]);
    const text4Y = useTransform(scrollYProgress, [0.98, 1], [20, 0]);

    // Pointer events for the form so it's clickable only when visible
    const [formActive, setFormActive] = useState(true);
    const [showText4, setShowText4] = useState(false);

    useMotionValueEvent(scrollYProgress, "change", (latest) => {
        setFormActive(latest < 0.05);
        if (latest > 0.85 && !showText4) setShowText4(true);
        if (latest <= 0.85 && showText4) setShowText4(false);
    });

    // Loading State
    if (framesLoaded < 10) {
        return (
            <div className="sequence-loading">
                <div className="sequence-spinner"></div>
                <div>Loading Sequence ({Math.round((framesLoaded / TOTAL_FRAMES) * 100)}%)</div>
            </div>
        );
    }

    return (
        <div className="login-page" style={{ opacity: pageReady ? 1 : 0, transition: 'opacity 0.4s ease' }}>
            <div ref={containerRef} className="scroll-container">

                {/* Sticky Canvas */}
                <div className="sticky-canvas-container">
                    <canvas ref={canvasRef} />
                </div>

                {/* Text 1: 0% */}
                <motion.div className="overlay-section overlay-center" style={{ opacity: text1Opacity, y: text1Y }}>
                    <h1 className="overlay-title">Dacia Sandero.</h1>
                    <p className="overlay-subtitle">Engineered clarity.</p>
                </motion.div>

                {/* Text 2: 25% */}
                <motion.div className="overlay-section overlay-left" style={{ opacity: text2Opacity, y: text2Y }}>
                    <h1 className="overlay-title">Built for Precision.</h1>
                    <p className="overlay-subtitle">Every detail, measured.</p>
                </motion.div>

                {/* Text 3: 60% */}
                <motion.div className="overlay-section overlay-right" style={{ opacity: text3Opacity, y: text3Y }}>
                    <h1 className="overlay-title">Layered Engineering.</h1>
                    <p className="overlay-subtitle">See what's inside.</p>
                </motion.div>

                {/* Login Form: 0% */}
                <motion.div
                    className="login-overlay"
                    transition={{ ease: "easeInOut", duration: 0.5 }}
                    style={{
                        opacity: formOpacity,
                        scale: formScale,
                        pointerEvents: formActive ? 'auto' : 'none'
                    }}
                >
                    <div className="login-card">
                        <div className="login-header">
                            <div className="login-logo">
                                <Zap size={32} />
                            </div>
                            <h2 className="login-title">RENAULT SPM</h2>
                            <div className="login-subtitle">Core VIN Tracking Engine</div>
                        </div>

                        <form onSubmit={handleSubmit} className="login-form">
                            <AnimatePresence mode="wait">
                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, height: 'auto', scale: 1 }}
                                        exit={{ opacity: 0, height: 0, scale: 0.9 }}
                                    >
                                        <div className="login-error">{error}</div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <div style={{ position: 'relative' }}>
                                <input
                                    type="text"
                                    className="login-input"
                                    placeholder="Username"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    required
                                    style={{ width: '100%' }}
                                />
                            </div>

                            <div className="password-wrapper">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    className="login-input"
                                    placeholder="Password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    style={{ width: '100%' }}
                                />
                                <button
                                    type="button"
                                    className="password-toggle"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                            </div>

                            <button
                                type="submit"
                                className="login-submit"
                                disabled={isLoading || !username || !password}
                            >
                                {isLoading ? (
                                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                        <div className="login-spinner" />
                                        AUTHENTICATING...
                                    </span>
                                ) : (
                                    'LOGIN'
                                )}
                            </button>
                        </form>

                        <div className="login-status" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '16px', marginBottom: '16px' }}>
                            <div className="status-dot-container">
                                <div className="status-dot"></div>
                                <span>SECURE UPLINK ACTIVE</span>
                            </div>
                            <span style={{ fontWeight: 600 }}>v4.0.2</span>
                        </div>

                        <div style={{ textAlign: 'center', fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', letterSpacing: '1px', textTransform: 'uppercase' }}>
                            Created by <a href="https://www.linkedin.com/in/abdellah-elberkaoui-1a3493195/" target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(255,255,255,0.8)', textDecoration: 'none', borderBottom: '1px solid rgba(255,255,255,0.3)', paddingBottom: '2px', marginLeft: '4px' }}>Abdellah Elberkaoui</a>
                        </div>
                    </div>
                </motion.div>

                {/* Text 4: 90% */}
                <AnimatePresence>
                    {showText4 && (
                        <motion.div
                            className="overlay-section overlay-center"
                            initial={{ opacity: 0, y: 20 }}
                            style={{ opacity: text4Opacity, y: text4Y }}
                        >
                            <h1 className="overlay-title">Assembled. Ready.</h1>
                            <p className="overlay-subtitle">Scroll back up to login.</p>
                        </motion.div>
                    )}
                </AnimatePresence>

            </div>

            <div className="login-footer">
                <div style={{ marginBottom: '8px' }}>Scroll down to view vehicle sequence</div>
                <div>
                    &copy; {new Date().getFullYear()} Renault Group. Internal system.
                </div>
            </div>
        </div>
    );
}
