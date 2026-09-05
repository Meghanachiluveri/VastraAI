import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import apiClient from '../lib/axios';

export interface MerchantProfile {
  id: string;
  name: string;
  email: string;
  role: 'merchant';
}

export interface MerchantAuthState {
  isMerchantLoggedIn: boolean;
  merchant: MerchantProfile | null;
  token: string | null;

  // Actions
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
}

export const useMerchantAuthStore = create<MerchantAuthState>()(
  persist(
    (set) => ({
      isMerchantLoggedIn: false,
      merchant: null,
      token: null,

      login: async (email: string, password: string) => {
        try {
          const response = await apiClient.post<{
            success: boolean;
            token: string;
            merchant: MerchantProfile;
            message?: string;
          }>('/merchant/login', {
            email,
            password,
          });

          if (response.data.success && response.data.token) {
            set({
              isMerchantLoggedIn: true,
              merchant: response.data.merchant,
              token: response.data.token,
            });
            return { success: true };
          }

          return {
            success: false,
            message: response.data.message || 'Invalid merchant credentials.',
          };
        } catch (err: any) {
          const errMsg = err.response?.data?.message || 'Invalid merchant credentials.';
          return {
            success: false,
            message: errMsg,
          };
        }
      },

      logout: () => {
        set({
          isMerchantLoggedIn: false,
          merchant: null,
          token: null,
        });
      },
    }),
    {
      name: 'vastra-merchant-auth',
    }
  )
);
