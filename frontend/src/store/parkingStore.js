import { API_URL, SOCKET_URL } from '../api_config';
import { create } from 'zustand';

const useParkingStore = create((set, get) => ({
    rhlSpots: [],
    contineSpots: [],
    alerts: [],
    dashboardStats: null,
    vehicles: [],
    searchResults: [],
    loading: false,
    selectedSpot: null,

    getAuthHeaders: () => {
        const token = localStorage.getItem('spm_token');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    },

    fetchRHLState: async () => {
        try {
            const res = await fetch(`${API_URL}/parking/rhl/state`, {
                headers: get().getAuthHeaders()
            });
            const data = await res.json();
            if (res.ok) set({ rhlSpots: data.spots || data });
        } catch (err) {
            console.error('Failed to fetch RHL state:', err);
        }
    },

    fetchContineState: async () => {
        try {
            const res = await fetch(`${API_URL}/parking/contine/state`, {
                headers: get().getAuthHeaders()
            });
            const data = await res.json();
            if (res.ok) set({ contineSpots: data.spots || data });
        } catch (err) {
            console.error('Failed to fetch Contine state:', err);
        }
    },

    fetchDashboardStats: async () => {
        try {
            const res = await fetch(`${API_URL}/dashboard/stats`, {
                headers: get().getAuthHeaders()
            });
            const data = await res.json();
            if (res.ok) set({ dashboardStats: data });
        } catch (err) {
            console.error('Failed to fetch dashboard stats:', err);
        }
    },

    fetchAlerts: async () => {
        try {
            const res = await fetch(`${API_URL}/alerts`, {
                headers: get().getAuthHeaders()
            });
            const data = await res.json();
            if (res.ok) set({ alerts: data.alerts || data });
        } catch (err) {
            console.error('Failed to fetch alerts:', err);
        }
    },

    checkinVehicle: async (vin) => {
        try {
            const res = await fetch(`${API_URL}/vehicles/checkin`, {
                method: 'POST',
                headers: get().getAuthHeaders(),
                body: JSON.stringify({ vin }),
            });
            const data = await res.json();
            return data;
        } catch (err) {
            return { error: err.message };
        }
    },

    checkoutVehicle: async (vin) => {
        try {
            const res = await fetch(`${API_URL}/vehicles/checkout`, {
                method: 'POST',
                headers: get().getAuthHeaders(),
                body: JSON.stringify({ vin }),
            });
            const data = await res.json();
            return data;
        } catch (err) {
            return { error: err.message };
        }
    },

    reserveSpot: async (spotId, vin) => {
        try {
            const res = await fetch(`${API_URL}/spots/${spotId}/reserve`, {
                method: 'POST',
                headers: get().getAuthHeaders(),
                body: JSON.stringify({ vin }),
            });
            const data = await res.json();
            return data;
        } catch (err) {
            return { error: err.message };
        }
    },

    searchVehicles: async (query) => {
        try {
            const params = new URLSearchParams(query);
            const res = await fetch(`${API_URL}/vehicles/search?${params}`, {
                headers: get().getAuthHeaders()
            });
            const data = await res.json();
            if (res.ok) set({ searchResults: data.vehicles || data });
            return data;
        } catch (err) {
            return { error: err.message };
        }
    },

    setSelectedSpot: (spot) => set({ selectedSpot: spot }),
    clearSelectedSpot: () => set({ selectedSpot: null }),
}));

export default useParkingStore;
