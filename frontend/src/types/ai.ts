import type { Product } from './types';

export interface CompleteTheLookData {
  product: Product;
  note: string;
}

export interface CuratedLookItem {
  productId: string;
  name: string;
  price: number;
  category: string;
  imageUrl: string;
  size?: string;
  color?: string;
}

export interface CuratedLook {
  title: string;
  description: string;
  occasion?: string;
  mainItem: CuratedLookItem;
  complementaryItem: CuratedLookItem;
  totalPrice: number;
  guardrailCompliant: boolean;
}

export interface AISelectedItem {
  productId: string;
  product: Product;
  size?: string;
  color?: string;
  quantity: number;
}

export interface AIMessage {
  id: string;
  sender: 'user' | 'agent' | 'system';
  content: string;
  timestamp: string;
  recommendedProducts?: Product[];
  matchReasons?: Record<string, string>;
  whyItFits?: string[];
  stylingTips?: string[];
  suggestedPrompts?: string[];
  completeTheLook?: CompleteTheLookData;
  curatedLook?: CuratedLook;
  statusIndicator?: 'ready' | 'curating' | 'searching' | 'updating_bag';
  selectedProductIds?: string[];
  clarificationOptions?: Product[];
  checkout?: {
    ready: boolean;
    requiresConfirmation?: boolean;
    items?: Array<{
      productId: string;
      name: string;
      price: number;
      quantity: number;
      size?: string;
      color?: string;
      total: number;
    }>;
    totalAmount?: number;
    currency?: string;
    orderId?: string;
    priceChange?: {
      priceChanged: boolean;
      productId?: string;
      productName?: string;
      previousPrice: number;
      currentPrice: number;
      difference: number;
    };
  };
  orderConfirmation?: {
    orderId: string;
    paymentId: string;
    totalAmount: number;
    currency: string;
    items: Array<{
      productId: string;
      name: string;
      size?: string;
      color?: string;
      quantity: number;
      price: number;
    }>;
  };
  paymentErrorNotice?: {
    message: string;
    canRetry: boolean;
  };
}

export interface AIStylistContext {
  preferences: {
    occasion?: string;
    gender?: 'men' | 'women' | 'unisex';
    palette?: string[];
    fit?: string;
    budget?: string;
  };
  messages: AIMessage[];
  isThinking: boolean;
}
