import { create } from 'zustand';
import axios from 'axios';

const useUserStore = create((set, get) => ({
  profile: {
    nama: '',
    role: 'User',
    nrp: '',
    distrik: '',
    isAuthenticated: false,
  },
  isLoading: false,
  isLoaded: false,
  error: null,

  fetchProfile: async () => {
    if (get().isLoading || get().isLoaded) return get().profile;
    set({ isLoading: true, error: null });
    try {
      const response = await axios.get('/Monitoring/api/User/profile');
      // Di dev tanpa backend, SPA-fallback balikin HTML (200) → jangan racuni profile.
      const data = response.data;
      const valid = data && typeof data === 'object' && !Array.isArray(data) && 'nama' in data;
      if (valid) {
        set({ profile: data, isLoading: false, isLoaded: true });
        return data;
      }
      set({ isLoading: false, isLoaded: true });
      return get().profile;
    } catch (err) {
      console.error('Failed to fetch user profile:', err);
      set({ error: 'Failed to fetch user profile', isLoading: false });
      return get().profile;
    }
  },

  getDistrik: () => get().profile?.distrik ?? '',
}));

export default useUserStore;
