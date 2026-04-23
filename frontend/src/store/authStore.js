import { create } from 'zustand';

const API_URL = `${import.meta.env.VITE_API_URL}/api/v1`;

const useAuthStore = create((set, get) => ({
  user: JSON.parse(localStorage.getItem('spm_user') || 'null'),
  token: localStorage.getItem('spm_token') || null,
  isAuthenticated: !!localStorage.getItem('spm_token'),
  loading: false,
  error: null,

  login: async (operatorId, password) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operator_id: operatorId, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');

      localStorage.setItem('spm_token', data.token);
      localStorage.setItem('spm_user', JSON.stringify(data.user));
      set({ user: data.user, token: data.token, isAuthenticated: true, loading: false });
      return true;
    } catch (err) {
      set({ error: err.message, loading: false });
      return false;
    }
  },

  register: async (name, operatorId, password, inviteCode) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, operator_id: operatorId, password, invite_code: inviteCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');

      localStorage.setItem('spm_token', data.token);
      localStorage.setItem('spm_user', JSON.stringify(data.user));
      set({ user: data.user, token: data.token, isAuthenticated: true, loading: false });
      return true;
    } catch (err) {
      set({ error: err.message, loading: false });
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem('spm_token');
    localStorage.removeItem('spm_user');
    set({ user: null, token: null, isAuthenticated: false });
  },

  clearError: () => set({ error: null }),

  hasRole: (role) => {
    const user = get().user;
    if (!user) return false;
    const hierarchy = { admin: 3, supervisor: 2, operator: 1 };
    return (hierarchy[user.role] || 0) >= (hierarchy[role] || 0);
  },
}));

export default useAuthStore;
