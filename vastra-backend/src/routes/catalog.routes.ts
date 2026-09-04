import { Router, Request, Response } from 'express';
import {
  getAllProducts,
  getProductById,
  getProductsByCategory,
  getProductsByGender,
  getNewArrivalProducts,
  getArchivedProducts,
  searchProducts,
  getSimilarProducts
} from '../services/catalogService';
import {
  ProductFilters,
  ProductGender,
  ProductSortOption,
  ProductListResponse,
  ProductDetailResponse,
  ErrorResponse
} from '../types';

const router = Router();

const VALID_GENDERS: ProductGender[] = ['men', 'women', 'unisex'];
const VALID_SORTS: ProductSortOption[] = [
  'popular',
  'price_low_high',
  'price_high_low',
  'newest',
  'rating'
];

/**
 * Extracts a single string from a route parameter or query parameter.
 */
function extractString(val: unknown): string {
  if (Array.isArray(val)) {
    return typeof val[0] === 'string' ? val[0] : '';
  }
  return typeof val === 'string' ? val : '';
}

/**
 * GET /api/products
 * Retrieves all products from the catalog.
 */
router.get('/', (_req: Request, res: Response<ProductListResponse | ErrorResponse>) => {
  try {
    const products = getAllProducts();
    res.status(200).json({
      products,
      count: products.length
    });
  } catch (error) {
    console.error('[CatalogRoutes] Error in GET /api/products:', error);
    res.status(500).json({ error: 'Failed to retrieve products' });
  }
});

/**
 * GET /api/products/new-arrivals
 * Retrieves newly arrived products (is_new = 1).
 */
router.get('/new-arrivals', (_req: Request, res: Response<ProductListResponse | ErrorResponse>) => {
  try {
    const products = getNewArrivalProducts();
    res.status(200).json({
      products,
      count: products.length
    });
  } catch (error) {
    console.error('[CatalogRoutes] Error in GET /api/products/new-arrivals:', error);
    res.status(500).json({ error: 'Failed to retrieve new arrival products' });
  }
});

/**
 * GET /api/products/archive
 * Retrieves archived products (is_archived = 1).
 */
router.get('/archive', (_req: Request, res: Response<ProductListResponse | ErrorResponse>) => {
  try {
    const products = getArchivedProducts();
    res.status(200).json({
      products,
      count: products.length
    });
  } catch (error) {
    console.error('[CatalogRoutes] Error in GET /api/products/archive:', error);
    res.status(500).json({ error: 'Failed to retrieve archived products' });
  }
});

/**
 * GET /api/products/search
 * Searches and filters products based on query parameters.
 */
router.get('/search', (req: Request, res: Response<ProductListResponse | ErrorResponse>) => {
  try {
    const { q, gender, category, minPrice, maxPrice, size, color, sort } = req.query;

    const filters: ProductFilters = {};

    // Validate and set gender
    if (gender !== undefined) {
      const genderStr = extractString(gender).toLowerCase();
      if (!VALID_GENDERS.includes(genderStr as ProductGender)) {
        res.status(400).json({ error: 'Invalid gender. Supported: men, women, unisex' });
        return;
      }
      filters.gender = genderStr as ProductGender;
    }

    // Set category
    if (category !== undefined) {
      const catStr = extractString(category).trim();
      if (catStr.length === 0) {
        res.status(400).json({ error: 'Invalid category' });
        return;
      }
      filters.category = catStr;
    }

    // Validate and set minPrice
    if (minPrice !== undefined) {
      const minStr = extractString(minPrice);
      const parsedMin = parseFloat(minStr);
      if (isNaN(parsedMin) || parsedMin < 0) {
        res.status(400).json({ error: 'Invalid minPrice. Must be a positive number' });
        return;
      }
      filters.minPrice = parsedMin;
    }

    // Validate and set maxPrice
    if (maxPrice !== undefined) {
      const maxStr = extractString(maxPrice);
      const parsedMax = parseFloat(maxStr);
      if (isNaN(parsedMax) || parsedMax < 0) {
        res.status(400).json({ error: 'Invalid maxPrice. Must be a positive number' });
        return;
      }
      filters.maxPrice = parsedMax;
    }

    // Set size
    if (size !== undefined) {
      const sizeStr = extractString(size).trim();
      if (sizeStr.length === 0) {
        res.status(400).json({ error: 'Invalid size' });
        return;
      }
      filters.size = sizeStr;
    }

    // Set color
    if (color !== undefined) {
      const colorStr = extractString(color).trim();
      if (colorStr.length === 0) {
        res.status(400).json({ error: 'Invalid color' });
        return;
      }
      filters.color = colorStr;
    }

    // Validate and set sort
    if (sort !== undefined) {
      const sortStr = extractString(sort);
      if (!VALID_SORTS.includes(sortStr as ProductSortOption)) {
        res.status(400).json({
          error: `Invalid sort option. Supported: ${VALID_SORTS.join(', ')}`
        });
        return;
      }
      filters.sort = sortStr as ProductSortOption;
    }

    const queryString = q !== undefined ? extractString(q).trim() : undefined;
    const products = searchProducts(queryString, filters);

    res.status(200).json({
      products,
      count: products.length
    });
  } catch (error) {
    console.error('[CatalogRoutes] Error in GET /api/products/search:', error);
    res.status(500).json({ error: 'Failed to search products' });
  }
});

/**
 * GET /api/products/category/:category
 * Retrieves products filtered by category (case-insensitive).
 */
router.get('/category/:category', (req: Request, res: Response<ProductListResponse | ErrorResponse>) => {
  try {
    const category = extractString(req.params.category).trim();
    if (category.length === 0) {
      res.status(400).json({ error: 'Category parameter is required' });
      return;
    }

    const products = getProductsByCategory(category);
    res.status(200).json({
      products,
      count: products.length
    });
  } catch (error) {
    console.error(`[CatalogRoutes] Error in GET /api/products/category/${req.params.category}:`, error);
    res.status(500).json({ error: 'Failed to retrieve products by category' });
  }
});

/**
 * GET /api/products/gender/:gender
 * Retrieves products filtered by gender (men, women, unisex).
 */
router.get('/gender/:gender', (req: Request, res: Response<ProductListResponse | ErrorResponse>) => {
  try {
    const gender = extractString(req.params.gender).trim().toLowerCase();

    if (!VALID_GENDERS.includes(gender as ProductGender)) {
      res.status(400).json({ error: 'Invalid gender. Supported: men, women, unisex' });
      return;
    }

    const products = getProductsByGender(gender as ProductGender);
    res.status(200).json({
      products,
      count: products.length
    });
  } catch (error) {
    console.error(`[CatalogRoutes] Error in GET /api/products/gender/${req.params.gender}:`, error);
    res.status(500).json({ error: 'Failed to retrieve products by gender' });
  }
});

/**
 * GET /api/products/:id/similar
 * Retrieves similar products for a given product ID.
 * Returns 404 if target product does not exist.
 */
router.get('/:id/similar', (req: Request, res: Response<ProductListResponse | ErrorResponse>) => {
  try {
    const id = extractString(req.params.id).trim();
    const targetProduct = getProductById(id);

    if (!targetProduct) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const products = getSimilarProducts(id);
    res.status(200).json({
      products,
      count: products.length
    });
  } catch (error) {
    console.error(`[CatalogRoutes] Error in GET /api/products/${req.params.id}/similar:`, error);
    res.status(500).json({ error: 'Failed to retrieve similar products' });
  }
});

/**
 * GET /api/products/:id
 * Retrieves a single product by its unique identifier.
 * Returns 404 if not found.
 */
router.get('/:id', (req: Request, res: Response<ProductDetailResponse | ErrorResponse>) => {
  try {
    const id = extractString(req.params.id).trim();
    const product = getProductById(id);

    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    res.status(200).json({ product });
  } catch (error) {
    console.error(`[CatalogRoutes] Error in GET /api/products/${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to retrieve product' });
  }
});

export default router;
