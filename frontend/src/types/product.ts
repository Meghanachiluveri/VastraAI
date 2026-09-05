export type { Product, ProductGender } from './types';

export type ProductCategory = 'men' | 'women' | 'accessories' | 'new-arrivals' | 'sale' | 'all';

export interface FilterState {
  category: string;
  categories: string[];
  gender: 'men' | 'women' | 'unisex' | 'all';
  sizes: string[];
  colors: string[];
  priceRange: [number, number];
  sortBy: 'popular' | 'price-low' | 'price-high' | 'newest' | 'rating';
  searchQuery?: string;
}
