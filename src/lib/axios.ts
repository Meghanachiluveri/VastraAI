import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Attach customer or merchant auth token with strict role isolation
apiClient.interceptors.request.use((config) => {
  try {
    const isMerchantRequest = Boolean(config.url?.startsWith('/merchant'));

    if (isMerchantRequest) {
      const rawMerchant = localStorage.getItem('vastra-merchant-auth');
      if (rawMerchant) {
        const parsed = JSON.parse(rawMerchant);
        const token = parsed?.state?.token;
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
      // Strictly return config for merchant requests - never leak customer bearer token
      return config;
    }

    // Attach customer bearer token for customer/storefront endpoints
    const rawCustomer = localStorage.getItem('vastra-auth-storage');
    if (rawCustomer) {
      const parsed = JSON.parse(rawCustomer);
      const token = parsed?.state?.token;
      if (token && config.headers && !config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
  } catch {
    // Ignore localStorage parse errors
  }
  return config;
});

export default apiClient;
