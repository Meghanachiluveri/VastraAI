import { create } from 'zustand';
import type { Product } from '../types/product';

interface UIState {
  isSearchOpen: boolean;
  openSearch: () => void;
  closeSearch: () => void;

  isMobileNavOpen: boolean;
  openMobileNav: () => void;
  closeMobileNav: () => void;

  isAIModalOpen: boolean;
  openAIModal: () => void;
  closeAIModal: () => void;

  quickViewProduct: Product | null;
  openQuickView: (product: Product) => void;
  closeQuickView: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  isSearchOpen: false,
  openSearch: () => set({ isSearchOpen: true }),
  closeSearch: () => set({ isSearchOpen: false }),

  isMobileNavOpen: false,
  openMobileNav: () => set({ isMobileNavOpen: true }),
  closeMobileNav: () => set({ isMobileNavOpen: false }),

  isAIModalOpen: false,
  openAIModal: () => set({ isAIModalOpen: true }),
  closeAIModal: () => set({ isAIModalOpen: false }),

  quickViewProduct: null,
  openQuickView: (product) => set({ quickViewProduct: product }),
  closeQuickView: () => set({ quickViewProduct: null }),
}));
