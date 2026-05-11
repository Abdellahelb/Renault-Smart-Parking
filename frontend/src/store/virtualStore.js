import { API_URL, SOCKET_URL } from '../api_config';
import { create } from 'zustand';
import useAuthStore from './authStore';

const useVirtualStore = create((set, get) => ({
    virtualLots: [],
    loading: false,
    error: null,

    fetchVirtualLots: async () => {
        set({ loading: true, error: null });
        try {
            const { token } = useAuthStore.getState();
            const res = await fetch(`${API_URL}/lots`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to fetch lots');

            set({ virtualLots: data.lots, loading: false });
        } catch (err) {
            set({ error: err.message, loading: false });
        }
    },

    createPhysicalLot: async (lotData) => {
        set({ loading: true, error: null });
        try {
            const { token } = useAuthStore.getState();
            const res = await fetch(`${API_URL}/lots/physical`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(lotData)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to create physical lot');

            await get().fetchVirtualLots();
            return { success: true, id: data.id };
        } catch (err) {
            set({ error: err.message, loading: false });
            return { success: false, error: err.message };
        }
    },

    createVirtualLot: async (lotData) => {
        set({ loading: true, error: null });
        try {
            const { token } = useAuthStore.getState();
            const res = await fetch(`${API_URL}/virtual`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(lotData)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to create lot');

            // Re-fetch lots after creation
            await get().fetchVirtualLots();
            return { success: true, id: data.id };
        } catch (err) {
            set({ error: err.message, loading: false });
            return { success: false, error: err.message };
        }
    },

    toggleVirtualLot: async (id) => {
        set({ loading: true });
        try {
            await fetch(`${API_URL}/virtual/${id}/toggle`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${useAuthStore.getState().token}` }
            });
            await get().fetchVirtualLots();
        } catch (err) {
            console.error(err);
        } finally {
            set({ loading: false });
        }
    },

    deleteVirtualLot: async (id) => {
        set({ loading: true });
        try {
            await fetch(`${API_URL}/lots/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${useAuthStore.getState().token}` }
            });
            await get().fetchVirtualLots();
        } catch (err) {
            console.error(err);
        } finally {
            set({ loading: false });
        }
    }
}));

export default useVirtualStore;
