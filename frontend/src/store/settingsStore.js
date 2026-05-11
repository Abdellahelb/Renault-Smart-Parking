import { API_URL, SOCKET_URL } from '../api_config';
import { create } from 'zustand';

const useSettingsStore = create((set) => ({
    maxParkDays: 15,
    theme: localStorage.getItem('spm-theme') || 'dark',
    setTheme: (theme) => {
        localStorage.setItem('spm-theme', theme);
        set({ theme });
    },
    fetchSettings: async (token) => {
        if (!token) return;
        try {
            const res = await fetch(`${API_URL}/settings`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                if (data.max_park_days) {
                    set({ maxParkDays: parseInt(data.max_park_days, 10) });
                }
            }
        } catch (err) {
            console.error('Failed to fetch settings', err);
        }
    }
}));

export default useSettingsStore;
