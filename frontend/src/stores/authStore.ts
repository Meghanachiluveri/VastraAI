import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../services/api';
import { useCartStore } from './cartStore';

export interface UserProfile {
  id?: string;
  name: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  memberSince?: string;
}

export interface AuthState {
  isLoggedIn: boolean;
  user: UserProfile | null;
  token: string | null;

  // Actions
  login: (email: string, password?: string) => Promise<boolean>;
  signup: (name: string, email: string, password?: string, phone?: string) => Promise<boolean>;
  logout: () => void;
  syncProfile: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isLoggedIn: false,
      user: null,
      token: null,

      login: async (email: string, password?: string) => {
        try {
          const res = await api.loginCustomer(email, password);
          if (res.success && res.token) {
            set({
              isLoggedIn: true,
              token: res.token,
              user: {
                id: res.customer?.id,
                name: res.customer?.name || 'Customer',
                email: res.customer?.email || email,
                phone: res.customer?.phone,
                memberSince: res.customer?.memberSince || '2026',
              },
            });
            // Automatically restore customer-specific cart from server
            useCartStore.getState().syncWithBackend();
            return true;
          }
          throw new Error(res.message || 'Authentication failed');
        } catch (err: any) {
          console.error('[AuthStore] Login failed:', err);
          throw err;
        }
      },

      signup: async (name: string, email: string, password?: string, phone?: string) => {
        try {
          const res = await api.registerCustomer(name, email, password || 'VastraCustomer2026!', phone);
          if (res.success && res.token) {
            set({
              isLoggedIn: true,
              token: res.token,
              user: {
                id: res.customer?.id,
                name: res.customer?.name || name,
                email: res.customer?.email || email,
                phone: res.customer?.phone || phone,
                memberSince: res.customer?.memberSince || '2026',
              },
            });
            // Automatically sync customer cart
            useCartStore.getState().syncWithBackend();
            return true;
          }
          throw new Error(res.message || 'Registration failed');
        } catch (err: any) {
          console.error('[AuthStore] Signup failed:', err);
          throw err;
        }
      },

      logout: () => {
        set({ isLoggedIn: false, user: null, token: null });
        // Clear client-side customer cart state without deleting the database cart
        useCartStore.setState({ items: [], lastSyncedAt: 0 });
        try {
          localStorage.removeItem('vastra-cart-storage');
          sessionStorage.removeItem('vastra_ai_selected_items');
        } catch {}
      },

      syncProfile: async () => {
        const currentToken = get().token;
        if (!currentToken) return;
        try {
          const res = await api.getCustomerProfile();
          if (res.success && res.customer) {
            set({
              isLoggedIn: true,
              user: {
                id: res.customer.id,
                name: res.customer.name,
                email: res.customer.email,
                phone: res.customer.phone,
                memberSince: res.customer.memberSince,
              },
            });
          }
        } catch {
          // Keep existing local state on transient network failures
        }
      },
    }),
    {
      name: 'vastra-auth-storage',
    }
  )
);

export const authStore = useAuthStore;
export default useAuthStore;
