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
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/virtual`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to fetch virtual lots');

            set({ virtualLots: data.virtualLots, loading: false });
        } catch (err) {
            set({ error: err.message, loading: false });
        }
    },

    createVirtualLot: async (lotData) => {
        set({ loading: true, error: null });
        try {
            const { token } = useAuthStore.getState();
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/virtual`, {
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
            await fetch(`${import.meta.env.VITE_API_URL}/api/v1/virtual/${id}/toggle`, {
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
            await fetch(`${import.meta.env.VITE_API_URL}/api/v1/virtual/${id}`, {
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
