import type { Product } from '../types/types';
import type { FilterState } from '../types/product';
import { api } from './api';

// Normalized category mapping
export const CATEGORY_MAPPINGS: Record<string, string[]> = {
  'Shirts': ['formal shirts', 'linen shirts', 'casual shirts', 'shirts', 'overshirts', 'tops'],
  'T-Shirts': ['t-shirts'],
  'Jeans': ['jeans', 'chinos'],
  'Dresses': ['dresses'],
  'Jackets': ['jackets'],
  'Ethnic Wear': ['kurtas', 'contemporary ethnic wear', 'sarees'],
  'Footwear': ['loafers', 'sneakers', 'minimal sneakers', 'sandals'],
  'Accessories': ['tote bags', 'accessories'],
};

export const COLOR_SWATCHES = [
  { name: 'White', label: 'White / Ecru', hex: '#FDFBF7', border: '#DCDDD3' },
  { name: 'Sage', label: 'Sage Green', hex: '#8AA48A', border: '#758E75' },
  { name: 'Black', label: 'Obsidian Black', hex: '#2A2A2A', border: '#1F231F' },
  { name: 'Indigo', label: 'Indigo / Navy', hex: '#2C3E50', border: '#1E2B37' },
  { name: 'Tan', label: 'Terracotta / Tan', hex: '#C9A46A', border: '#B59157' },
  { name: 'Olive', label: 'Olive Leaf', hex: '#6B7A60', border: '#57634E' },
  { name: 'Rose', label: 'Dusty Rose', hex: '#D4A5A5', border: '#C08E8E' },
];

export const FILTER_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

export const productService = {
  // Get all products
  async getAllProducts(): Promise<Product[]> {
    return api.getProducts();
  },

  // Get product by ID
  async getProductById(id: string): Promise<Product | null> {
    return api.getProductById(id);
  },

  // Get products by category or gender
  async getProductsByCategory(category: string): Promise<Product[]> {
    if (category === 'all' || category === 'shop') {
      return api.getProducts();
    }
    if (category === 'men' || category === 'women' || category === 'unisex') {
      return api.getProductsByGender(category);
    }
    return api.getProductsByCategory(category);
  },

  // Filter and sort products dynamically
  async filterProducts(products: Product[], filters: FilterState): Promise<Product[]> {
    let result = [...products];

    // Gender Filter - strict matching so Men contains only men and Women contains only women
    if (filters.gender && filters.gender !== 'all') {
      result = result.filter((p) => p.gender === filters.gender);
    }

    // High-level Categories filter
    if (filters.categories && filters.categories.length > 0) {
      const allowedSubCats = filters.categories.flatMap((cat) => CATEGORY_MAPPINGS[cat] || [cat.toLowerCase()]);
      result = result.filter((p) =>
        allowedSubCats.some((sub) => p.category.toLowerCase().includes(sub.toLowerCase()))
      );
    }

    // Sizes Filter
    if (filters.sizes && filters.sizes.length > 0) {
      result = result.filter((p) => {
        // Direct match or numeric equivalence
        return filters.sizes.some((sz) => {
          if (p.sizes.includes(sz)) return true;
          if (p.sizes.includes('Free Size') || p.sizes.includes('One Size')) return true;
          if (sz === 'S' && p.sizes.includes('38')) return true;
          if (sz === 'M' && p.sizes.includes('40')) return true;
          if (sz === 'L' && p.sizes.includes('42')) return true;
          if (sz === 'XL' && p.sizes.includes('44')) return true;
          if (sz === 'M' && (p.sizes.includes('30') || p.sizes.includes('32'))) return true;
          if (sz === 'L' && (p.sizes.includes('34') || p.sizes.includes('36'))) return true;
          if (sz === 'M' && (p.sizes.includes('39') || p.sizes.includes('40') || p.sizes.includes('41'))) return true;
          return false;
        });
      });
    }

    // Colors Filter
    if (filters.colors && filters.colors.length > 0) {
      result = result.filter((p) =>
        filters.colors.some((colorKeyword) =>
          p.colors.some((c) => c.toLowerCase().includes(colorKeyword.toLowerCase()))
        )
      );
    }

    // Price Range Filter
    if (filters.priceRange) {
      const [min, max] = filters.priceRange;
      result = result.filter((p) => p.price >= min && p.price <= max);
    }

    // Search Query Filter
    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.colors.some((c) => c.toLowerCase().includes(q))
      );
    }

    // Sorting
    if (filters.sortBy) {
      switch (filters.sortBy) {
        case 'price-low':
          result.sort((a, b) => a.price - b.price);
          break;
        case 'price-high':
          result.sort((a, b) => b.price - a.price);
          break;
        case 'rating':
          result.sort((a, b) => b.rating - a.rating);
          break;
        case 'newest':
          result.reverse();
          break;
        case 'popular':
        default:
          result.sort((a, b) => b.reviewCount - a.reviewCount);
          break;
      }
    }

    return Promise.resolve(result);
  },

  // Get complementary products for "Complete the Look" using the backend similarity service
  async getCompleteTheLook(product: Product): Promise<Product[]> {
    try {
      const similar = await api.getSimilarProducts(product.id);
      if (similar && similar.length > 0) {
        return similar.slice(0, 3);
      }
    } catch (err) {
      console.error('[ProductService] Error getting similar products:', err);
    }

    try {
      const all = await api.getProducts();
      return all.filter((p) => p.id !== product.id).slice(0, 3);
    } catch {
      return [];
    }
  },
};

export default productService;
