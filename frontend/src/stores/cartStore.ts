import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Product } from '../types/types';
import { api } from '../services/api';
import { getSessionId } from '../lib/session';

export interface CartItem {
  id: string; // unique item instance id: backend id or `${productId}-${color}-${size}`
  product: Product;
  selectedColor: string;
  selectedSize: string;
  quantity: number;
  unitPrice: number;
}

export interface CartStoreState {
  items: CartItem[];
  isOpen: boolean;
  isLoading: boolean;
  lastSyncedAt: number;

  // Actions
  addItem: (
    product: Product,
    selectedColor?: string,
    selectedSize?: string,
    quantity?: number,
    options?: { openDrawer?: boolean; channel?: 'human' | 'agent' }
  ) => Promise<boolean>;
  removeItem: (itemIdOrProductId: string, size?: string, color?: string) => Promise<void>;
  updateQuantity: (itemIdOrProductId: string, quantity: number, size?: string, color?: string) => Promise<void>;
  clearCart: () => Promise<void>;
  syncWithBackend: (forcedSessionId?: string) => Promise<void>;
  setCartFromBackend: (backendCart: any) => void;

  // Selectors & Calculations
  totalPrice: () => number;
  getTotal: () => number;
  getSubtotal: () => number;
  getShipping: () => number;
  getItemCount: () => number;

  // Drawer controls
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
}

/**
 * Maps raw backend cart items into rich frontend CartItem structures.
 */
function mapBackendItemsToCartItems(backendItems: any[] = []): CartItem[] {
  return backendItems.map((bi) => {
    const color = bi.color || 'Default';
    const size = bi.size || 'M';
    const unitPrice = Number(bi.price !== undefined ? bi.price : (bi.unitPrice || 0));

    const productObj: Product = {
      id: bi.productId || bi.id,
      name: bi.name || 'Artisanal Piece',
      price: unitPrice,
      stock: bi.stock !== undefined ? bi.stock : 50,
      gender: bi.gender || 'unisex',
      category: bi.category || 'Luxury Apparel',
      sizes: [size],
      colors: [color],
      rating: bi.rating || 4.8,
      reviewCount: bi.reviewCount || 42,
      imageUrl: bi.imageUrl || 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&q=80&w=800',
      description: bi.description || '',
    };

    return {
      id: bi.id || `${bi.productId}-${color}-${size}`,
      product: productObj,
      selectedColor: color,
      selectedSize: size,
      quantity: Number(bi.quantity || 1),
      unitPrice,
    };
  });
}

export const useCartStore = create<CartStoreState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      isLoading: false,
      lastSyncedAt: 0,

      openCart: () => {
        set({ isOpen: true });
        // Background sync on drawer open
        get().syncWithBackend();
      },
      closeCart: () => set({ isOpen: false }),
      toggleCart: () => {
        const nextState = !get().isOpen;
        set({ isOpen: nextState });
        if (nextState) get().syncWithBackend();
      },

      setCartFromBackend: (backendCart: any) => {
        if (!backendCart || !Array.isArray(backendCart.items)) return;
        const mapped = mapBackendItemsToCartItems(backendCart.items);
        set({ items: mapped, lastSyncedAt: Date.now() });
      },

      syncWithBackend: async (forcedSessionId?: string) => {
        try {
          const sid = forcedSessionId || getSessionId();
          const backendCart = await api.getBackendCart(sid, 'human');
          if (backendCart && Array.isArray(backendCart.items)) {
            get().setCartFromBackend(backendCart);
          }
        } catch (err) {
          console.warn('[CartStore] syncWithBackend warning:', err);
        }
      },

      addItem: async (
        product: Product,
        selectedColor?: string,
        selectedSize?: string,
        quantity = 1,
        options?: { openDrawer?: boolean; channel?: 'human' | 'agent' }
      ): Promise<boolean> => {
        const color = selectedColor || product.colors[0] || 'Default';
        const size = selectedSize || product.sizes[0] || 'M';
        const sid = getSessionId();
        const shouldOpenDrawer = options?.openDrawer !== false;
        const channel = options?.channel || 'human';

        // Optimistic UI state
        const existingItems = get().items;
        const id = `${product.id}-${color}-${size}`;
        const existingIndex = existingItems.findIndex((item) => item.id === id || (item.product.id === product.id && item.selectedSize === size && item.selectedColor === color));

        let optimisticItems = [...existingItems];
        if (existingIndex > -1) {
          optimisticItems[existingIndex] = {
            ...optimisticItems[existingIndex],
            quantity: Math.min(product.stock, optimisticItems[existingIndex].quantity + quantity),
          };
        } else {
          optimisticItems.push({
            id,
            product,
            selectedColor: color,
            selectedSize: size,
            quantity: Math.min(product.stock, quantity),
            unitPrice: product.price,
          });
        }
        set({ items: optimisticItems, isOpen: shouldOpenDrawer });

        // Backend authoritative update
        try {
          const res = await api.addToBackendCart({
            sessionId: sid,
            productId: product.id,
            quantity,
            size,
            color,
            channel,
          });

          if (res.success && res.cart) {
            get().setCartFromBackend(res.cart);
            return true;
          }
        } catch (err) {
          console.error('[CartStore] Error adding item to backend cart:', err);
        }
        return true;
      },

      removeItem: async (itemIdOrProductId: string, size?: string, color?: string) => {
        // Optimistic UI update
        set((state) => ({
          items: state.items.filter((item) => item.id !== itemIdOrProductId && item.product.id !== itemIdOrProductId),
        }));

        try {
          const sid = getSessionId();
          const res = await api.removeFromBackendCart(itemIdOrProductId, sid, 'human', size, color);
          if (res.success && res.cart) {
            get().setCartFromBackend(res.cart);
          }
        } catch (err) {
          console.error('[CartStore] Error removing item from backend cart:', err);
        }
      },

      updateQuantity: async (itemIdOrProductId: string, quantity: number, size?: string, color?: string) => {
        if (quantity <= 0) {
          await get().removeItem(itemIdOrProductId, size, color);
          return;
        }

        // Optimistic UI update
        set((state) => ({
          items: state.items.map((item) => {
            if (item.id === itemIdOrProductId || item.product.id === itemIdOrProductId) {
              return { ...item, quantity };
            }
            return item;
          }),
        }));

        try {
          const sid = getSessionId();
          const res = await api.updateBackendCartQuantity(itemIdOrProductId, quantity, sid, 'human', size, color);
          if (res.success && res.cart) {
            get().setCartFromBackend(res.cart);
          }
        } catch (err) {
          console.error('[CartStore] Error updating quantity in backend cart:', err);
        }
      },

      clearCart: async () => {
        set({ items: [] });
        try {
          const sid = getSessionId();
          await api.clearBackendCart(sid, 'human');
        } catch (err) {
          console.error('[CartStore] Error clearing backend cart:', err);
        }
      },

      getItemCount: () => {
        return get().items.reduce((total, item) => total + item.quantity, 0);
      },

      getSubtotal: () => {
        return get().items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
      },

      getShipping: () => {
        const subtotal = get().getSubtotal();
        if (subtotal === 0) return 0;
        // Free luxury express shipping above ₹5,000, otherwise ₹350
        return subtotal >= 5000 ? 0 : 350;
      },

      totalPrice: () => {
        return get().getSubtotal() + get().getShipping();
      },

      getTotal: () => {
        return get().totalPrice();
      },
    }),
    {
      name: 'vastra-cart-storage',
      partialize: (state) => ({ items: state.items }),
    }
  )
);

export const cartStore = useCartStore;
export default useCartStore;
