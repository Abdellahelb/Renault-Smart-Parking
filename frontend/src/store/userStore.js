import { create } from 'zustand';

const API_URL = `${import.meta.env.VITE_API_URL}/api/v1`;

const useUserStore = create((set) => ({
    users: [],
    loading: false,
    error: null,

    fetchUsers: async (token) => {
        set({ loading: true, error: null });
        try {
            const res = await fetch(`${API_URL}/users`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to fetch users');
            set({ users: data.users, loading: false });
        } catch (err) {
            set({ error: err.message, loading: false });
        }
    },

    addUser: async (userData, token) => {
        set({ loading: true, error: null });
        try {
            const res = await fetch(`${API_URL}/users`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(userData)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to add user');

            set(state => ({
                users: [data, ...state.users],
                loading: false
            }));
            return true;
        } catch (err) {
            set({ error: err.message, loading: false });
            return false;
        }
    },

    deleteUser: async (userId, token) => {
        set({ loading: true, error: null });
        try {
            const res = await fetch(`${API_URL}/users/${userId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to delete user');

            set(state => ({
                users: state.users.filter(u => u.id !== userId),
                loading: false
            }));
            return true;
        } catch (err) {
            set({ error: err.message, loading: false });
            return false;
        }
    }
}));

export default useUserStore;
