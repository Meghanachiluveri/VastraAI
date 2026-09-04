import type { Product } from './product';

export interface CartItem {
  id: string; // unique item instance id (productId + color + size)
  product: Product;
  selectedColor: string;
  selectedSize: string;
  quantity: number;
  unitPrice: number;
}

export interface CartState {
  items: CartItem[];
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  addItem: (product: Product, selectedColor: string, selectedSize: string, quantity?: number) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  getItemCount: () => number;
  getSubtotal: () => number;
  getShipping: () => number;
  getTotal: () => number;
}
