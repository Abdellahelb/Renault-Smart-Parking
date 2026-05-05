import { API_URL, SOCKET_URL } from '../api_config';
import { create } from 'zustand';

const useSettingsStore = create((set) => ({
    maxParkDays: 15,
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
