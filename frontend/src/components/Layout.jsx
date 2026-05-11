import { API_URL, SOCKET_URL } from '../api_config';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import useAuthStore from '../store/authStore';
import useVirtualStore from '../store/virtualStore';
import useSettingsStore from '../store/settingsStore';
import useParkingStore from '../store/parkingStore';
import {
    LayoutDashboard, Map, ScanBarcode, Search, Bell,
    Users, Settings, FileText, User, LogOut, Zap,
    ParkingSquare, ShieldAlert, Plus
} from 'lucide-react';

const RenaultLogo = ({ size = 22 }) => (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M50 5 L15 50 L50 95 L85 50 L50 5 Z M50 22 L70 50 L50 78 L30 50 L50 22 Z" fill="currentColor" />
        <path d="M50 36 L40 50 L50 64 L60 50 L50 36 Z M50 46 L47 50 L50 54 L53 50 L50 46 Z" fill="currentColor" />
    </svg>
);

const baseNavItems = [
    {
        section: 'Main', items: [
            { path: '/dashboard', icon: LayoutDashboard, label: 'Command Center', role: 'operator' },
            { path: '/scan', icon: ScanBarcode, label: 'VIN Scanner', role: 'operator' },
            { path: '/search', icon: Search, label: 'VIN Search', role: 'operator' },
        ]
    },
    {
        section: 'Storage Sectors', items: [
            { path: '/map/rhl', icon: Map, label: 'Park RHL', role: 'operator' },
            { path: '/map/contine', icon: ParkingSquare, label: 'Park Cantine', role: 'operator' },
        ]
    },
    {
        section: 'Operations', items: [
            { path: '/alerts', icon: ShieldAlert, label: 'Alerts', role: 'supervisor' },
            { path: '/history', icon: FileText, label: 'Operations Audit', role: 'operator' },
            { path: '/reports', icon: FileText, label: 'Reports', role: 'supervisor' },
        ]
    },
    {
        section: 'Administration', items: [
            { path: '/admin/users', icon: Users, label: 'Personnel Access', role: 'supervisor' },
            { path: '/admin/virtual', icon: Plus, label: 'Virtual Parking', role: 'supervisor' },
            { path: '/admin/settings', icon: Settings, label: 'Settings', role: 'supervisor' },
        ]
    },
];

export default function Layout() {
    const { user, logout, hasRole } = useAuthStore();
    const { virtualLots, fetchVirtualLots } = useVirtualStore();
    const location = useLocation();
    const navigate = useNavigate();
    const [headerSearch, setHeaderSearch] = useState('');

    const handleSearchSubmit = (e) => {
        if (e.key === 'Enter' && headerSearch.trim()) {
            navigate(`/search?q=${encodeURIComponent(headerSearch.trim())}`);
            setHeaderSearch('');
        }
    };

    useEffect(() => {
        fetchVirtualLots();
    }, [fetchVirtualLots]);

    const { token } = useAuthStore();
    const fetchSettings = useSettingsStore(state => state.fetchSettings);
    const { alerts, fetchAlerts } = useParkingStore();

    useEffect(() => {
        fetchSettings(token);
        if (token) fetchAlerts();
    }, [token, fetchSettings, fetchAlerts]);

    // Build nav items dynamically
    const navItems = baseNavItems.map(section => {
        if (section.section === 'Storage Sectors') {
            const dynamicMaps = (virtualLots || []).filter(v => v.active === 1).map(v => ({
                path: `/map/virtual/${v.id}`,
                icon: Map,
                label: v.name,
                role: 'operator'
            }));
            return { ...section, items: [...section.items, ...dynamicMaps] };
        }
        return section;
    });

    const getPageTitle = () => {
        if (location.pathname.startsWith('/map/virtual/')) return 'Virtual Sector Map';
        const titles = {
            '/dashboard': 'Command Center',
            '/history': 'Operations Audit',
            '/map/rhl': 'Park RHL',
            '/map/contine': 'Park Cantine',
            '/scan': 'VIN Scanner',
            '/search': 'VIN Search',
            '/alerts': 'Alerts',
            '/reports': 'Reports',
            '/admin/users': 'Personnel Access',
            '/admin/virtual': 'Virtual Parking',
            '/admin/settings': 'System Settings',
            '/profile': 'Profile',
        };
        return titles[location.pathname] || 'Intelligent Parking Management';
    };

    return (
        <div className="app-layout">
            {/* Sidebar */}
            <aside className="sidebar">
                <div className="sidebar-brand">
                    <div className="brand-icon">
                        <RenaultLogo size={24} />
                    </div>
                    <div className="brand-text">
                        <h1 style={{ fontSize: '0.95rem', whiteSpace: 'nowrap' }}>Smart Parking Manager</h1>
                        <span>RTMA</span>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    {navItems.map(section => {
                        const visibleItems = section.items.filter(item => hasRole(item.role));
                        if (visibleItems.length === 0) return null;
                        return (
                            <div key={section.section} className="nav-section">
                                <div className="nav-section-title">{section.section}</div>
                                {visibleItems.map(item => (
                                    <NavLink
                                        key={item.path}
                                        to={item.path}
                                        className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                                    >
                                        <item.icon size={18} />
                                        {item.label}
                                        {item.path === '/alerts' && alerts.length > 0 && <span className="badge">{alerts.length}</span>}
                                    </NavLink>
                                ))}
                            </div>
                        );
                    })}
                </nav>

                <div className="sidebar-footer">
                    <div className="sidebar-user">
                        <div className="user-avatar">
                            {user?.name?.charAt(0)?.toUpperCase() || 'A'}
                        </div>
                        <div className="user-info">
                            <div className="user-name">{user?.name || 'Admin'}</div>
                            <div className="user-role">{user?.role || 'admin'}</div>
                        </div>
                        <button
                            className="btn-icon header-btn"
                            onClick={logout}
                            title="Logout"
                            style={{ marginLeft: 'auto' }}
                        >
                            <LogOut size={16} />
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <div className="main-content">
                {/* Header */}
                <header className="top-header">
                    <div className="header-left">
                        <h2 className="page-title">{getPageTitle()}</h2>
                    </div>
                    <div className="header-right">
                        <div className="header-search">
                            <Search size={16} className="search-icon" />
                            <input
                                type="text"
                                placeholder="Search vehicles, spots..."
                                value={headerSearch}
                                onChange={(e) => setHeaderSearch(e.target.value)}
                                onKeyDown={handleSearchSubmit}
                            />
                        </div>
                        <button className="header-btn" onClick={() => navigate('/alerts')} title="View Alerts">
                            <Bell size={18} />
                            <span className="notification-dot"></span>
                        </button>
                        <NavLink to="/profile" className="header-btn" style={{ display: 'flex' }} title="User Profile">
                            <User size={18} />
                        </NavLink>
                    </div>
                </header>

                {/* Page Content */}
                <motion.div
                    className="page-content"
                    key={location.pathname}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                >
                    <Outlet />
                </motion.div>

                {/* Footer */}
                <footer className="app-footer">
                    Created by Abdellah Elberkaoui | <a href="https://linkedin.com/in/abdellah-elberkaoui-1a3493195" target="_blank" rel="noopener noreferrer">LinkedIn</a>
                    &nbsp;&nbsp;•&nbsp;&nbsp;Intelligent Parking Management v1.0 — CONFIDENTIAL
                </footer>
            </div>
        </div>
    );
}
