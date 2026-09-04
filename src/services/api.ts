import apiClient from '../lib/axios';
import type { Product, ProductGender } from '../types/types';

export interface SearchParams {
  q?: string;
  gender?: ProductGender | string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  size?: string;
  color?: string;
  sort?: 'popular' | 'price_low_high' | 'price_high_low' | 'newest' | 'rating';
}

interface ProductListApiResponse {
  products: Product[];
  count: number;
}

interface ProductDetailApiResponse {
  product: Product;
}

export interface OrderItemInput {
  productId: string;
  quantity: number;
  size?: string;
  color?: string;
}

export interface CreateOrderPayload {
  channel: 'human' | 'agent';
  items: OrderItemInput[];
  confirmed?: boolean;
  sessionId?: string | null;
  customerInfo?: {
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
  };
}

export interface RazorpayOrderResponse {
  razorpayOrderId: string;
  amount: number;
  currency: string;
  key: string;
}

export interface VerifyPaymentPayload {
  orderId: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  sessionId?: string | null;
}

let cachedProducts: Product[] | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 20000; // 20-second cache

/**
 * Get all fashion products from the real backend catalog with high-performance caching.
 */
export async function getProducts(forceRefresh = false): Promise<Product[]> {
  const now = Date.now();
  if (!forceRefresh && cachedProducts && now - lastFetchTime < CACHE_TTL_MS) {
    return cachedProducts;
  }
  try {
    const response = await apiClient.get<ProductListApiResponse>('/products');
    cachedProducts = response.data.products || [];
    lastFetchTime = now;
    return cachedProducts;
  } catch (error) {
    if (cachedProducts) return cachedProducts;
    console.error('[API] Failed to fetch products:', error);
    throw error;
  }
}

/**
 * Get a specific product by its ID from the backend.
 * Returns null if the product is not found (404).
 */
export async function getProductById(id: string): Promise<Product | null> {
  if (!id || id.trim().length === 0) return null;
  try {
    const response = await apiClient.get<ProductDetailApiResponse>(`/products/${encodeURIComponent(id.trim())}`);
    return response.data.product || null;
  } catch (error: any) {
    if (error?.response?.status === 404) {
      return null;
    }
    console.error(`[API] Failed to fetch product ${id}:`, error);
    throw error;
  }
}

/**
 * Search and filter products using the backend search service.
 * Accepts a search query string or structured SearchParams.
 */
export async function searchProducts(params: string | SearchParams): Promise<Product[]> {
  try {
    const queryParams = typeof params === 'string' ? { q: params } : params;
    const response = await apiClient.get<ProductListApiResponse>('/products/search', {
      params: queryParams,
    });
    return response.data.products || [];
  } catch (error) {
    console.error('[API] Failed to search products:', error);
    throw error;
  }
}

/**
 * Filter products by category (e.g. 'jackets', 'kurtas', 'dresses', 'sarees', 'tote bags', etc.)
 */
export async function getProductsByCategory(category: string): Promise<Product[]> {
  if (!category || category.trim().length === 0) return [];
  try {
    const response = await apiClient.get<ProductListApiResponse>(`/products/category/${encodeURIComponent(category.trim())}`);
    return response.data.products || [];
  } catch (error) {
    console.error(`[API] Failed to fetch category ${category}:`, error);
    throw error;
  }
}

/**
 * Filter products by gender ('men', 'women', or 'unisex').
 */
export async function getProductsByGender(gender: ProductGender | string): Promise<Product[]> {
  if (!gender || gender.trim().length === 0) return [];
  try {
    const response = await apiClient.get<ProductListApiResponse>(`/products/gender/${encodeURIComponent(gender.trim().toLowerCase())}`);
    return response.data.products || [];
  } catch (error) {
    console.error(`[API] Failed to fetch products for gender ${gender}:`, error);
    throw error;
  }
}

/**
 * Get newly released seasonal fashion pieces.
 */
export async function getNewArrivals(): Promise<Product[]> {
  try {
    const response = await apiClient.get<ProductListApiResponse>('/products/new-arrivals');
    return response.data.products || [];
  } catch (error) {
    console.error('[API] Failed to fetch new arrivals:', error);
    throw error;
  }
}

/**
 * Get archive/sale collection products.
 */
export async function getArchivedProducts(): Promise<Product[]> {
  try {
    const response = await apiClient.get<ProductListApiResponse>('/products/archive');
    return response.data.products || [];
  } catch (error) {
    console.error('[API] Failed to fetch archived products:', error);
    throw error;
  }
}

/**
 * Get complementary/similar products from the backend recommendation service.
 */
export async function getSimilarProducts(id: string): Promise<Product[]> {
  if (!id || id.trim().length === 0) return [];
  try {
    const response = await apiClient.get<ProductListApiResponse>(`/products/${encodeURIComponent(id.trim())}/similar`);
    return response.data.products || [];
  } catch (error: any) {
    if (error?.response?.status === 404) {
      return [];
    }
    console.error(`[API] Failed to fetch similar products for ${id}:`, error);
    throw error;
  }
}

/**
 * Validate an order before creation against commerce guardrails.
 */
export async function validateOrder(channel: 'human' | 'agent', items: OrderItemInput[]) {
  const response = await apiClient.post('/orders/validate', { channel, items });
  return response.data;
}

/**
 * Create a new pending order on the backend.
 */
export async function createOrder(payload: CreateOrderPayload) {
  const response = await apiClient.post('/orders/create', payload);
  return response.data;
}

/**
 * Create a Razorpay order in paise for an existing pending order.
 */
export async function createPaymentOrder(orderId: string, sessionId?: string | null): Promise<RazorpayOrderResponse> {
  const response = await apiClient.post<RazorpayOrderResponse>('/payments/create-order', { orderId, sessionId });
  return response.data;
}

/**
 * Cryptographically verify Razorpay payment signature on the backend.
 */
export async function verifyPayment(payload: VerifyPaymentPayload) {
  const response = await apiClient.post('/payments/verify', payload);
  return response.data;
}

/**
 * Send a message to the Vastra.AI Agent API.
 */
export async function sendAgentMessage(
  message: string,
  sessionId?: string | null,
  options?: {
    customerId?: string;
    customerInfo?: any;
    shippingAddress?: any;
    selectedProductIds?: string[];
    selectedItems?: Array<{ productId: string; size?: string | null; color?: string | null; quantity?: number }>;
  }
) {
  const response = await apiClient.post('/agent/message', {
    message,
    sessionId,
    ...(options || {}),
  });
  return response.data;
}

/**
 * Prepare checkout summary for the current session.
 */
export async function prepareAgentCheckout(sessionId: string) {
  const response = await apiClient.post('/agent/checkout/prepare', { sessionId });
  return response.data;
}

/**
 * Confirm agent checkout and receive Razorpay checkout details.
 */
export async function confirmAgentCheckout(payload: { sessionId: string; confirmed: boolean; customerId?: string; customerInfo?: any }) {
  const response = await apiClient.post('/agent/checkout/confirm', payload);
  return response.data;
}

export const create_and_confirm_order = confirmAgentCheckout;

/**
 * Cancel a pending payment.
 */
export async function cancelPayment(payload: { orderId: string; sessionId?: string | null; reason?: string }) {
  const response = await apiClient.post('/payments/cancel', payload);
  return response.data;
}

/**
 * Retrieve the current cart from the backend.
 */
export async function getBackendCart(sessionId: string, channel: string = 'human') {
  const response = await apiClient.get('/cart', {
    params: { sessionId, channel },
  });
  return response.data;
}

/**
 * Add an item to the backend cart.
 */
export async function addToBackendCart(payload: {
  sessionId: string;
  productId: string;
  quantity?: number;
  size?: string;
  color?: string;
  channel?: string;
}) {
  const response = await apiClient.post('/cart/items', payload);
  return response.data;
}

/**
 * Update the quantity of an item in the backend cart.
 */
export async function updateBackendCartQuantity(
  productIdOrItemId: string,
  quantity: number,
  sessionId: string,
  channel: string = 'human',
  size?: string,
  color?: string
) {
  const response = await apiClient.patch(`/cart/items/${encodeURIComponent(productIdOrItemId)}`, {
    sessionId,
    quantity,
    size,
    color,
    channel,
  });
  return response.data;
}

/**
 * Remove an item from the backend cart.
 */
export async function removeFromBackendCart(
  productIdOrItemId: string,
  sessionId: string,
  channel: string = 'human',
  size?: string,
  color?: string
) {
  const response = await apiClient.delete(`/cart/items/${encodeURIComponent(productIdOrItemId)}`, {
    data: { sessionId, channel, size, color },
    params: { sessionId, channel, size, color },
  });
  return response.data;
}

/**
 * Clear all items from the backend cart.
 */
export async function clearBackendCart(sessionId: string, channel: string = 'human') {
  const response = await apiClient.delete('/cart', {
    data: { sessionId, channel },
    params: { sessionId, channel },
  });
  return response.data;
}

/**
 * Retrieve aggregated store overview and AI commerce analytics.
 */
export async function getMerchantOverview(range: string = 'all') {
  const response = await apiClient.get('/merchant/overview', {
    params: { range },
  });
  return response.data;
}

/**
 * Retrieve recent store orders for merchant portal.
 */
export async function getMerchantOrders(range: string = 'all', channel?: string, limit: number = 50) {
  const response = await apiClient.get('/merchant/orders', {
    params: { range, channel, limit },
  });
  return response.data;
}

/**
 * Retrieve complete order details with line items.
 */
export async function getMerchantOrderById(orderId: string) {
  const response = await apiClient.get(`/merchant/orders/${encodeURIComponent(orderId)}`);
  return response.data;
}

/**
 * Retrieve merchant activity timeline from audit logs.
 */
export async function getMerchantActivity(range: string = 'all', limit: number = 50) {
  const response = await apiClient.get('/merchant/activity', {
    params: { range, limit },
  });
  return response.data;
}

/**
 * Customer Authentication & Account APIs
 */
export async function loginCustomer(email: string, password?: string) {
  const response = await apiClient.post('/auth/login', { email, password });
  return response.data;
}

export async function registerCustomer(name: string, email: string, password: string, phone?: string) {
  const response = await apiClient.post('/auth/register', { name, email, password, phone });
  return response.data;
}

export async function getCustomerProfile() {
  const response = await apiClient.get('/auth/me');
  return response.data;
}

export async function getCustomerAddresses() {
  const response = await apiClient.get('/customer/addresses');
  return response.data;
}

export async function addCustomerAddress(address: {
  name: string;
  phone: string;
  addressLine: string;
  city: string;
  state: string;
  postalCode: string;
  isDefault?: boolean;
}) {
  const response = await apiClient.post('/customer/addresses', address);
  return response.data;
}

export async function getCustomerOrders(params?: { customerId?: string; sessionId?: string; userId?: string; email?: string }) {
  try {
    const response = await apiClient.get('/orders', { params });
    return response.data;
  } catch (err: any) {
    if (err?.response?.status === 401 || err?.response?.status === 404) {
      const response = await apiClient.get('/customer/orders', { params });
      return response.data;
    }
    throw err;
  }
}

export async function getCustomerOrderById(orderId: string, params?: { customerId?: string; sessionId?: string; userId?: string }) {
  try {
    const response = await apiClient.get(`/orders/${encodeURIComponent(orderId)}`, { params });
    return response.data;
  } catch (err: any) {
    if (err?.response?.status === 401 || err?.response?.status === 404) {
      const response = await apiClient.get(`/customer/orders/${encodeURIComponent(orderId)}`, { params });
      return response.data;
    }
    throw err;
  }
}

// Export API service object for convenience
export const api = {
  getProducts,
  getProductById,
  searchProducts,
  getProductsByCategory,
  getProductsByGender,
  getNewArrivals,
  getArchivedProducts,
  getSimilarProducts,
  validateOrder,
  createOrder,
  createPaymentOrder,
  verifyPayment,
  cancelPayment,
  sendAgentMessage,
  prepareAgentCheckout,
  confirmAgentCheckout,
  getBackendCart,
  addToBackendCart,
  updateBackendCartQuantity,
  removeFromBackendCart,
  clearBackendCart,
  getMerchantOverview,
  getMerchantOrders,
  getMerchantOrderById,
  getMerchantActivity,
  loginCustomer,
  registerCustomer,
  getCustomerProfile,
  getCustomerAddresses,
  addCustomerAddress,
  getCustomerOrders,
  getCustomerOrderById,
};

export default api;

