import { db } from '../db/db';
import {
  DbProduct,
  Product,
  ProductFilters,
  ProductGender,
  ProductSortOption,
  ShoppingContext
} from '../types';

/**
 * Converts a database row representation into the application-level Product type.
 */
export function mapDbProductToProduct(row: DbProduct): Product {
  let sizes: string[] = [];
  let colors: string[] = [];
  let styleTags: string[] = [];

  try {
    sizes = JSON.parse(row.sizes);
    if (!Array.isArray(sizes)) {
      sizes = [row.sizes];
    }
  } catch {
    sizes = row.sizes ? [row.sizes] : [];
  }

  try {
    colors = JSON.parse(row.colors);
    if (!Array.isArray(colors)) {
      colors = [row.colors];
    }
  } catch {
    colors = row.colors ? [row.colors] : [];
  }

  try {
    if (row.style_tags) {
      styleTags = JSON.parse(row.style_tags);
      if (!Array.isArray(styleTags)) {
        styleTags = [row.style_tags];
      }
    }
  } catch {
    styleTags = [];
  }

  return {
    id: row.id,
    name: row.name,
    price: Number(row.price),
    stock: Number(row.stock),
    gender: row.gender as ProductGender,
    category: row.category,
    subcategory: row.subcategory || '',
    sizes,
    colors,
    rating: Number(row.rating),
    reviewCount: Number(row.review_count),
    imageUrl: row.image_url,
    description: row.description || '',
    material: row.material || '',
    occasion: row.occasion || '',
    styleTags,
    isNew: Boolean(row.is_new),
    isArchived: Boolean(row.is_archived),
    createdAt: row.created_at || ''
  };
}

/**
 * Retrieves all non-archived products from the SQLite database by default.
 */
export function getAllProducts(includeArchived = false): Product[] {
  try {
    const sql = includeArchived
      ? 'SELECT * FROM products ORDER BY id ASC'
      : 'SELECT * FROM products WHERE is_archived = 0 ORDER BY id ASC';
    const rows = db.prepare(sql).all() as DbProduct[];
    return rows.map(mapDbProductToProduct);
  } catch (error) {
    console.error('[CatalogService] Error in getAllProducts:', error);
    throw new Error('Failed to retrieve products from database');
  }
}

/**
 * Retrieves a single product by its unique identifier.
 */
export function getProductById(id: string): Product | null {
  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    return null;
  }

  try {
    const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id.trim()) as DbProduct | undefined;
    if (!row) {
      return null;
    }
    return mapDbProductToProduct(row);
  } catch (error) {
    console.error(`[CatalogService] Error in getProductById for id "${id}":`, error);
    throw new Error('Failed to retrieve product by ID');
  }
}

/**
 * Retrieves products filtered by category (case-insensitive).
 */
export function getProductsByCategory(category: string): Product[] {
  if (!category || typeof category !== 'string' || category.trim().length === 0) {
    return [];
  }

  try {
    const rows = db.prepare(`
      SELECT * FROM products
      WHERE is_archived = 0
        AND (LOWER(category) = LOWER(?) OR LOWER(subcategory) = LOWER(?))
      ORDER BY id ASC
    `).all(category.trim(), category.trim()) as DbProduct[];
    return rows.map(mapDbProductToProduct);
  } catch (error) {
    console.error(`[CatalogService] Error in getProductsByCategory for category "${category}":`, error);
    throw new Error('Failed to retrieve products by category');
  }
}

/**
 * Retrieves products filtered by gender (case-insensitive).
 * Strict matching: 'men' returns only men's products, 'women' returns only women's products.
 */
export function getProductsByGender(gender: ProductGender | string): Product[] {
  if (!gender || typeof gender !== 'string') {
    return [];
  }

  const normalized = gender.trim().toLowerCase();
  if (normalized !== 'men' && normalized !== 'women' && normalized !== 'unisex') {
    return [];
  }

  try {
    const rows = db.prepare(`
      SELECT * FROM products
      WHERE is_archived = 0 AND LOWER(gender) = LOWER(?)
      ORDER BY id ASC
    `).all(normalized) as DbProduct[];
    return rows.map(mapDbProductToProduct);
  } catch (error) {
    console.error(`[CatalogService] Error in getProductsByGender for gender "${gender}":`, error);
    throw new Error('Failed to retrieve products by gender');
  }
}

/**
 * Retrieves New Arrival products (is_new = 1).
 */
export function getNewArrivalProducts(): Product[] {
  try {
    const rows = db.prepare(`
      SELECT * FROM products
      WHERE is_archived = 0 AND is_new = 1
      ORDER BY id ASC
    `).all() as DbProduct[];
    return rows.map(mapDbProductToProduct);
  } catch (error) {
    console.error('[CatalogService] Error in getNewArrivalProducts:', error);
    throw new Error('Failed to retrieve new arrival products');
  }
}

/**
 * Retrieves Archived / Discontinued products (is_archived = 1).
 */
export function getArchivedProducts(): Product[] {
  try {
    const rows = db.prepare(`
      SELECT * FROM products
      WHERE is_archived = 1
      ORDER BY id ASC
    `).all() as DbProduct[];
    return rows.map(mapDbProductToProduct);
  } catch (error) {
    console.error('[CatalogService] Error in getArchivedProducts:', error);
    throw new Error('Failed to retrieve archived products');
  }
}

const SEARCH_STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
  'has', 'he', 'in', 'is', 'it', 'its', 'not', 'of', 'on', 'or',
  'our', 'that', 'the', 'to', 'was', 'were', 'will', 'with', 'you',
  'your', 'show', 'find', 'me', 'i', 'need', 'want', 'looking', 'catalog',
  'please', 'them', 'these', 'those', 'something', 'piece', 'pieces', 'outfit', 'item', 'items',
  'under', 'below', 'less', 'than', 'between', 'above', 'more', 'within', 'budget',
  'price', 'cost', 'rs', 'inr', 'rupees', 'give', 'instead', 'also', 'like'
]);

/**
 * Normalizes color strings for flexible natural language matching.
 */
export function normalizeColor(colorStr: string): string[] {
  const lower = colorStr.toLowerCase().trim();
  if (lower.includes('black') || lower.includes('obsidian') || lower.includes('midnight') || lower.includes('onyx') || lower.includes('charcoal')) {
    return ['black', 'obsidian', 'midnight', 'onyx', 'charcoal'];
  }
  if (lower.includes('white') || lower.includes('ecru') || lower.includes('ivory') || lower.includes('chalk') || lower.includes('bone') || lower.includes('alabaster') || lower.includes('cream')) {
    return ['white', 'ecru', 'ivory', 'chalk', 'bone', 'alabaster', 'cream'];
  }
  if (lower.includes('sage') || lower.includes('green') || lower.includes('olive') || lower.includes('emerald') || lower.includes('mint') || lower.includes('forest')) {
    return ['sage', 'green', 'olive', 'emerald', 'mint', 'forest'];
  }
  if (lower.includes('blue') || lower.includes('indigo') || lower.includes('navy') || lower.includes('cornflower') || lower.includes('sky')) {
    return ['blue', 'indigo', 'navy', 'cornflower', 'sky'];
  }
  if (lower.includes('tan') || lower.includes('brown') || lower.includes('terracotta') || lower.includes('caramel') || lower.includes('espresso') || lower.includes('sand') || lower.includes('khaki') || lower.includes('oatmeal') || lower.includes('camel')) {
    return ['tan', 'brown', 'terracotta', 'caramel', 'espresso', 'sand', 'khaki', 'oatmeal', 'camel'];
  }
  if (lower.includes('rose') || lower.includes('pink') || lower.includes('blush') || lower.includes('peach')) {
    return ['rose', 'pink', 'blush', 'peach'];
  }
  if (lower.includes('red') || lower.includes('crimson') || lower.includes('ruby') || lower.includes('madder')) {
    return ['red', 'crimson', 'ruby', 'madder'];
  }
  if (lower.includes('gold') || lower.includes('zari') || lower.includes('metallic')) {
    return ['gold', 'zari', 'metallic'];
  }
  return [lower];
}

/**
 * Searches and filters products using parameterized queries.
 */
export function searchProducts(query?: string, filters?: ProductFilters): Product[] {
  try {
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    // By default, exclude archived items unless explicitly asked
    if (filters?.isArchived) {
      conditions.push('is_archived = 1');
    } else {
      conditions.push('is_archived = 0');
    }

    if (filters?.isNew !== undefined) {
      conditions.push('is_new = ?');
      params.push(filters.isNew ? 1 : 0);
    }

    // Keyword search terms across multiple searchable fields with intelligent price & category stripping
    if (query && typeof query === 'string' && query.trim().length > 0) {
      let cleanQuery = query.toLowerCase();
      // Remove price specifications from raw search terms so they don't break LIKE matching
      cleanQuery = cleanQuery.replace(/(?:under|below|less than|above|more than|between|within|budget|around|max|min|₹|inr|rs\.?)\s*\d+/gi, ' ');
      cleanQuery = cleanQuery.replace(/\b\d{3,6}\b/g, ' ');

      // If structured filters are already provided, clean those filter words from free-text query
      if (filters?.category) {
        cleanQuery = cleanQuery.replace(new RegExp(`\\b${filters.category}\\b`, 'gi'), ' ');
        cleanQuery = cleanQuery.replace(/dresses|shirts|jackets|kurtas|sarees|totes|jeans|t-shirts|chinos/gi, ' ');
      }
      if (filters?.color) {
        const colorSyns = normalizeColor(filters.color);
        for (const c of colorSyns) {
          cleanQuery = cleanQuery.replace(new RegExp(`\\b${c}\\b`, 'gi'), ' ');
        }
      }
      if (filters?.gender) {
        cleanQuery = cleanQuery.replace(/\b(men|women|unisex|man|woman|for him|for her)\b/gi, ' ');
      }

      const rawTerms = cleanQuery.trim().split(/\s+/).filter(Boolean);
      const terms = rawTerms.filter((t) => !SEARCH_STOP_WORDS.has(t) && t.length >= 2);
      const searchTerms = terms;

      for (const term of searchTerms) {
        const pattern = `%${term}%`;
        conditions.push(`(
          LOWER(name) LIKE ?
          OR LOWER(description) LIKE ?
          OR LOWER(category) LIKE ?
          OR LOWER(subcategory) LIKE ?
          OR LOWER(material) LIKE ?
          OR LOWER(occasion) LIKE ?
          OR LOWER(gender) LIKE ?
          OR LOWER(colors) LIKE ?
        )`);
        params.push(pattern, pattern, pattern, pattern, pattern, pattern, pattern, pattern);
      }
    }

    // Gender Filter
    if (filters?.gender && typeof filters.gender === 'string' && filters.gender.trim().length > 0) {
      const normalizedGender = filters.gender.trim().toLowerCase();
      if (normalizedGender === 'men') {
        conditions.push("LOWER(gender) IN ('men', 'unisex')");
      } else if (normalizedGender === 'women') {
        conditions.push("LOWER(gender) IN ('women', 'unisex')");
      } else {
        conditions.push('LOWER(gender) = LOWER(?)');
        params.push(normalizedGender);
      }
    }

    // Category Filter
    if (filters?.category && typeof filters.category === 'string' && filters.category.trim().length > 0) {
      const cat = filters.category.trim().toLowerCase();
      const baseCat = cat.endsWith('s') && cat.length > 3 ? cat.slice(0, -1) : cat;
      conditions.push('(LOWER(category) = LOWER(?) OR LOWER(category) LIKE ? OR LOWER(subcategory) LIKE ?)');
      params.push(cat, `%${baseCat}%`, `%${baseCat}%`);
    }

    // Minimum Price Filter
    if (filters?.minPrice !== undefined && typeof filters.minPrice === 'number' && !isNaN(filters.minPrice)) {
      conditions.push('price >= ?');
      params.push(filters.minPrice);
    }

    // Maximum Price Filter
    if (filters?.maxPrice !== undefined && typeof filters.maxPrice === 'number' && !isNaN(filters.maxPrice)) {
      conditions.push('price <= ?');
      params.push(filters.maxPrice);
    }

    // Size Filter
    if (filters?.size && typeof filters.size === 'string' && filters.size.trim().length > 0) {
      const sizePattern = `%"${filters.size.trim().toUpperCase()}"%`;
      const sizePatternLower = `%"${filters.size.trim().toLowerCase()}"%`;
      conditions.push('(LOWER(sizes) LIKE ? OR LOWER(sizes) LIKE ? OR sizes LIKE "%Free Size%" OR sizes LIKE "%One Size%")');
      params.push(sizePattern, sizePatternLower);
    }

    // Color Filter with normalization (case-insensitive match against JSON array and name)
    if (filters?.color && typeof filters.color === 'string' && filters.color.trim().length > 0) {
      const colorSynonyms = normalizeColor(filters.color);
      const colorConditions = colorSynonyms.map(() => '(LOWER(colors) LIKE ? OR LOWER(name) LIKE ?)').join(' OR ');
      conditions.push(`(${colorConditions})`);
      colorSynonyms.forEach((syn) => params.push(`%${syn}%`, `%${syn}%`));
    }

    // Occasion Filter
    if (filters?.occasion && typeof filters.occasion === 'string' && filters.occasion.trim().length > 0) {
      const occ = filters.occasion.trim().toLowerCase();
      conditions.push('(LOWER(occasion) LIKE ? OR LOWER(description) LIKE ?)');
      params.push(`%${occ}%`, `%${occ}%`);
    }

    // Material Filter
    if (filters?.material && typeof filters.material === 'string' && filters.material.trim().length > 0) {
      const mat = filters.material.trim().toLowerCase();
      conditions.push('(LOWER(material) LIKE ? OR LOWER(description) LIKE ?)');
      params.push(`%${mat}%`, `%${mat}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Sorting order
    let orderByClause = 'ORDER BY rating DESC, review_count DESC';
    if (filters?.sort) {
      switch (filters.sort as ProductSortOption) {
        case 'popular':
          orderByClause = 'ORDER BY review_count DESC, rating DESC';
          break;
        case 'price_low_high':
          orderByClause = 'ORDER BY price ASC';
          break;
        case 'price_high_low':
          orderByClause = 'ORDER BY price DESC';
          break;
        case 'rating':
          orderByClause = 'ORDER BY rating DESC, review_count DESC';
          break;
        case 'newest':
          orderByClause = 'ORDER BY created_at DESC, id ASC';
          break;
        default:
          orderByClause = 'ORDER BY rating DESC, review_count DESC';
      }
    }

    const sql = `SELECT * FROM products ${whereClause} ${orderByClause}`;
    const rows = db.prepare(sql).all(...params) as DbProduct[];

    return rows.map(mapDbProductToProduct);
  } catch (error) {
    console.error('[CatalogService] Error in searchProducts:', error);
    throw new Error('Failed to search products');
  }
}

/**
 * Structured Natural Language Intent Extractor.
 * Extracts category, gender, color, fabric, occasion, style, budget, size, and ordinals.
 */
export interface ExtractedIntent {
  category?: string;
  subcategory?: string;
  productKeyword?: string;
  gender?: 'men' | 'women' | 'unisex';
  color?: string;
  material?: string;
  occasion?: string;
  style?: string;
  minPrice?: number;
  maxPrice?: number;
  size?: string;
  ordinalIndex?: number;
  ordinalKeyword?: string;
  action: 'search' | 'refine_search' | 'add_to_bag' | 'view_cart' | 'remove_from_cart' | 'update_quantity' | 'clear_cart' | 'prepare_checkout' | 'cancel' | 'complete_look' | 'check_size' | 'explain_why' | 'impossible_item' | 'vague';
  isImpossibleItem?: boolean;
  isBuyAndCheckout?: boolean;
}

export function extractShoppingIntent(message: string, currentContext?: ShoppingContext): ExtractedIntent {
  const lower = message.toLowerCase().trim();

  // 1. Impossible / Non-existent catalog items
  const impossiblePatterns = [
    'astronaut', 'spacesuit', 'space suit', 'jetpack', 'hoverboard',
    'purple leather', 'red leather trench', 'gucci', 'prada', 'louis vuitton',
    'rolex', 'cyberpunk', 'alien'
  ];
  if (impossiblePatterns.some((pattern) => lower.includes(pattern))) {
    return {
      action: 'impossible_item',
      isImpossibleItem: true
    };
  }

  // 2. Action Intent Detection
  let action: ExtractedIntent['action'] = 'search';
  let isBuyAndCheckout = false;

  if (lower === 'cancel' || lower.includes('cancel checkout') || lower.includes('cancel order') || lower.includes('nevermind') || lower.includes('never mind')) {
    action = 'cancel';
  } else if (
    lower.includes('what is in my bag') || lower.includes("what's in my bag") ||
    lower.includes('what is in my cart') || lower.includes("what's in my cart") ||
    lower.includes('show my cart') || lower.includes('view cart') ||
    lower.includes('show my bag') || lower.includes('view my bag') ||
    lower === 'cart' || lower === 'bag'
  ) {
    action = 'view_cart';
  } else if (
    lower.startsWith('remove ') || lower.startsWith('delete ') || lower.startsWith('drop ') ||
    lower.includes('remove from cart') || lower.includes('remove from bag') || lower.includes('take out')
  ) {
    action = 'remove_from_cart';
  } else if (lower.includes('clear my cart') || lower.includes('empty my cart') || lower.includes('clear the cart') || lower.includes('empty my bag') || lower.includes('remove everything')) {
    action = 'clear_cart';
  } else if (lower.includes('quantity') || lower.includes('qty')) {
    action = 'update_quantity';
  } else if (
    lower.includes('complete look') || lower.includes('wedding guest look') ||
    lower.includes('build me a complete look') || lower.includes('build me a look') ||
    lower.includes('build an outfit') || lower.includes('coordinate a look')
  ) {
    action = 'complete_look';
  } else if (
    lower === 'buy it' || lower === 'buy it.' || lower.startsWith('buy ') ||
    lower.includes('checkout') || lower.includes('proceed to checkout') ||
    lower.includes('place order') || lower.includes('ready to order') ||
    lower.includes('confirm and proceed')
  ) {
    action = 'prepare_checkout';
  } else if (
    lower.startsWith('add ') || lower.includes('add it to my bag') ||
    lower.includes('add to bag') || lower.includes('add to cart') ||
    lower.includes('add into cart') || lower.includes('into cart') ||
    lower.includes('add into bag') || lower.includes('into bag') ||
    lower.includes('add this') || lower.includes('add look') || lower.includes('add both')
  ) {
    action = 'add_to_bag';
    if (lower.includes('& buy') || lower.includes('and buy') || lower.includes('and checkout') || lower.includes('& checkout')) {
      isBuyAndCheckout = true;
    }
  } else if (
    lower === 'why' || lower === 'why?' || lower.includes('why do you recommend') ||
    lower.includes('why that one') || lower.includes('why this')
  ) {
    action = 'explain_why';
  } else if (
    lower.includes('available') || lower.includes('have size') || lower.includes('in size') ||
    lower.includes('do you have size') || lower.includes('do you have them in') ||
    lower.includes('show me size') ||
    Boolean(lower.match(/\b(is|have|got|in)\s+(?:size\s+)?(xs|s|m|l|xl|xxl|\d{2})\b/i) && (lower.includes('available') || lower.includes('stock') || lower.includes('size') || lower.includes('have')))
  ) {
    action = 'check_size';
  } else if (
    lower === 'show me something nice' || lower === 'show me something' ||
    lower === 'surprise me' || lower === 'anything cool' || lower === 'recommend something'
  ) {
    action = 'vague';
  }

  // 3. Category & Product Keyword Detection
  let category: string | undefined = undefined;
  let subcategory: string | undefined = undefined;
  let productKeyword: string | undefined = undefined;

  if (lower.includes('dress') || lower.includes('dresses') || lower.includes('gown') || lower.includes('sundress') || lower.includes('kaftan')) {
    category = 'dresses';
    productKeyword = 'dress';
  } else if (lower.includes('saree') || lower.includes('sarees') || lower.includes('sari') || lower.includes('saris')) {
    category = 'sarees';
    productKeyword = 'saree';
  } else if (lower.includes('kurta') || lower.includes('kurtas') || lower.includes('anarkali')) {
    category = 'kurtas';
    productKeyword = 'kurta';
  } else if (lower.includes('bandhgala') || lower.includes('nehru jacket') || lower.includes('blazer') || lower.includes('jacket') || lower.includes('jackets') || lower.includes('bomber')) {
    category = 'jackets';
    productKeyword = lower.includes('bandhgala') ? 'bandhgala' : 'jacket';
    if (lower.includes('bandhgala')) subcategory = 'bandhgala';
    if (lower.includes('nehru')) subcategory = 'nehru jacket';
    if (lower.includes('blazer')) subcategory = 'blazer';
  } else if (lower.includes('co-ord') || lower.includes('coord') || lower.includes('co ord') || lower.includes('skirt')) {
    category = 'contemporary ethnic wear';
    productKeyword = 'co-ord';
  } else if (lower.includes('formal shirt') || lower.includes('linen shirt') || lower.includes('casual shirt') || lower.includes('shirt') || lower.includes('shirts')) {
    category = 'shirts';
    productKeyword = 'shirt';
    if (lower.includes('formal')) category = 'formal shirts';
    if (lower.includes('linen')) category = 'linen shirts';
  } else if (lower.includes('t-shirt') || lower.includes('tshirt') || lower.includes('t-shirts') || lower.includes('tee') || lower.includes('tees')) {
    category = 't-shirts';
    productKeyword = 't-shirt';
  } else if (lower.includes('jean') || lower.includes('jeans') || lower.includes('denim')) {
    category = 'jeans';
    productKeyword = 'jeans';
  } else if (lower.includes('chino') || lower.includes('chinos') || lower.includes('trouser') || lower.includes('trousers') || lower.includes('pant') || lower.includes('pants')) {
    category = 'chinos';
  } else if (
    lower.includes('tote') || lower.includes('totes') || lower.includes('weekender') ||
    lower.includes('handbag') || lower.includes('shoulder bag') ||
    (Boolean(lower.match(/\bbags?\b/i)) && !lower.includes('my bag') && !lower.includes('to bag') && !lower.includes('in bag') && !lower.includes('into bag') && !lower.includes('the bag') && !lower.includes('shopping bag'))
  ) {
    category = 'tote bags';
    productKeyword = 'tote';
  } else if (
    lower.includes('belt') || lower.includes('belts') ||
    lower.includes('stole') || lower.includes('stoles') ||
    lower.includes('shawl') || lower.includes('shawls') ||
    lower.includes('scarf') || lower.includes('scarves') ||
    lower.includes('wallet') || lower.includes('wallets') ||
    lower.includes('cardholder') || lower.includes('cardholders') || lower.includes('card holder') ||
    lower.includes('accessory') || lower.includes('accessories')
  ) {
    category = 'accessories';
  } else if (lower.includes('loafer') || lower.includes('loafers') || lower.includes('sneaker') || lower.includes('sneakers') || lower.includes('sandal') || lower.includes('sandals') || lower.includes('mojari') || lower.includes('juttis') || lower.includes('shoe') || lower.includes('shoes')) {
    category = 'footwear';
  }

  // 4. Gender Detection
  let gender: 'men' | 'women' | 'unisex' | undefined = undefined;
  if (
    lower.includes("men's") || lower.includes('mens') || lower.includes('men') ||
    lower.includes('for him') || lower.includes('for my husband') || lower.includes('for my boyfriend') ||
    lower.includes('for brother') || lower.includes('for father') || lower.includes('groom') ||
    lower.includes('bandhgala')
  ) {
    gender = 'men';
  } else if (
    lower.includes("women's") || lower.includes('womens') || lower.includes('women') ||
    lower.includes('for her') || lower.includes('for my wife') || lower.includes('for my girlfriend') ||
    lower.includes('for sister') || lower.includes('for mother') || lower.includes('bride') ||
    category === 'dresses' || category === 'sarees' || category === 'tops'
  ) {
    gender = 'women';
  } else if (lower.includes('unisex')) {
    gender = 'unisex';
  }

  // 5. Color Detection with strict word boundaries
  let color: string | undefined = undefined;
  if (Boolean(lower.match(/\b(black|obsidian|midnight black|midnight|onyx|charcoal)\b/i))) {
    color = 'Black';
  } else if (Boolean(lower.match(/\b(white|ecru|ivory|chalk|bone|cream|alabaster)\b/i))) {
    color = 'White';
  } else if (Boolean(lower.match(/\b(sage|green|olive|emerald|mint|forest)\b/i))) {
    color = 'Green';
  } else if (Boolean(lower.match(/\b(blue|indigo|navy|cornflower|sky blue)\b/i))) {
    color = 'Blue';
  } else if (Boolean(lower.match(/\b(tan|brown|terracotta|caramel|espresso|sand|khaki|oatmeal|camel)\b/i))) {
    color = 'Tan';
  } else if (Boolean(lower.match(/\b(rose|pink|blush|peach)\b/i))) {
    color = 'Rose';
  } else if (Boolean(lower.match(/\b(red|crimson|ruby|madder|cherry|scarlet)\b/i))) {
    color = 'Crimson';
  } else if (Boolean(lower.match(/\b(gold|zari|metallic)\b/i))) {
    color = 'Gold';
  }

  // 6. Fabric / Material Detection
  let material: string | undefined = undefined;
  const fabrics = [
    'chanderi', 'tussar', 'mulberry silk', 'raw silk', 'silk', 'linen', 'khadi',
    'cotton', 'cashmere', 'pashmina', 'wool', 'poplin', 'leather', 'denim', 'organza', 'canvas'
  ];
  for (const f of fabrics) {
    if (lower.includes(f)) {
      material = f;
      break;
    }
  }

  // 7. Occasion Detection
  let occasion: string | undefined = undefined;
  const occasions = [
    'wedding guest', 'destination wedding', 'wedding', 'sangeet', 'mehendi', 'reception', 'diwali', 'eid',
    'office', 'formal', 'interview', 'dinner', 'date night', 'cocktail', 'party',
    'vacation', 'resort', 'summer', 'casual', 'brunch', 'everyday'
  ];
  for (const occ of occasions) {
    if (lower.includes(occ)) {
      occasion = occ;
      break;
    }
  }

  // 8. Style Detection
  let style: string | undefined = undefined;
  if (lower.includes('more formal') || lower.includes('formal') || lower.includes('black tie')) {
    style = 'formal';
  } else if (lower.includes('casual') || lower.includes('relaxed') || lower.includes('everyday')) {
    style = 'casual';
  } else if (lower.includes('minimal') || lower.includes('clean') || lower.includes('quiet luxury')) {
    style = 'minimal';
  } else if (lower.includes('traditional') || lower.includes('ethnic') || lower.includes('festive')) {
    style = 'traditional';
  }

  // 9. Budget / Price Range
  let maxPrice: number | undefined = undefined;
  let minPrice: number | undefined = undefined;

  const noCommas = lower.replace(/,/g, '');
  const maxPriceMatch = noCommas.match(/(?:under|below|less than|within|max|budget\s*(?:of|is)?|capped at)\s*(?:₹|inr|rs\.?)?\s*(\d{3,6})\b/i) ||
                       noCommas.match(/(?:under|below)\s*(\d+)k\b/i);

  if (maxPriceMatch) {
    if (maxPriceMatch[0].includes('k')) {
      maxPrice = parseInt(maxPriceMatch[1], 10) * 1000;
    } else {
      maxPrice = parseInt(maxPriceMatch[1], 10);
    }
  }

  const minPriceMatch = noCommas.match(/(?:above|more than|at least|from|min)\s*(?:₹|inr|rs\.?)?\s*(\d{3,6})\b/i);
  if (minPriceMatch) {
    minPrice = parseInt(minPriceMatch[1], 10);
  }

  const betweenMatch = noCommas.match(/between\s*(?:₹|inr|rs\.?)?\s*(\d{3,6})\s*and\s*(?:₹|inr|rs\.?)?\s*(\d{3,6})/i);
  if (betweenMatch) {
    minPrice = parseInt(betweenMatch[1], 10);
    maxPrice = parseInt(betweenMatch[2], 10);
  }

  // 10. Size Detection
  let size: string | undefined = undefined;
  const sizeMatch = lower.match(/(?:in\s+size|size|in|is|have|got)\s+(xs|s|m|l|xl|xxl|38|39|40|41|42|43|44|30|32|34|36|free size|one size)\b/i) ||
                    lower.match(/^(?:size\s+)?(xs|s|m|l|xl|xxl|38|39|40|41|42|43|44|30|32|34|36)$/i);
  if (sizeMatch) {
    size = sizeMatch[1].toUpperCase();
  }

  // 11. Ordinal References
  let ordinalIndex: number | undefined = undefined;
  let ordinalKeyword: string | undefined = undefined;

  if (lower.includes('first one') || lower.includes('1st one') || lower.includes('first option') || lower.includes('the first') || lower === 'first') {
    ordinalIndex = 0;
    ordinalKeyword = 'first';
  } else if (lower.includes('second one') || lower.includes('2nd one') || lower.includes('second option') || lower.includes('the second') || lower === 'second') {
    ordinalIndex = 1;
    ordinalKeyword = 'second';
  } else if (lower.includes('third one') || lower.includes('3rd one') || lower.includes('third option') || lower.includes('the third') || lower === 'third') {
    ordinalIndex = 2;
    ordinalKeyword = 'third';
  } else if (lower.includes('last one') || lower.includes('last option') || lower.includes('the last')) {
    ordinalIndex = currentContext?.lastSearchResults ? Math.max(0, currentContext.lastSearchResults.length - 1) : 0;
    ordinalKeyword = 'last';
  } else if (lower.includes('cheaper one') || lower.includes('cheapest one') || lower.includes('less expensive one')) {
    ordinalKeyword = 'cheaper';
  } else if (lower.includes('expensive one') || lower.includes('priciest one')) {
    ordinalKeyword = 'expensive';
  } else if (
    lower === 'that one' || lower === 'this one' || lower === 'this' || lower === 'it' ||
    lower === 'add it' || lower === 'add this' || lower.startsWith('add it') || lower.startsWith('add this')
  ) {
    ordinalIndex = 0;
    ordinalKeyword = 'active';
  }

  return {
    category,
    subcategory,
    gender,
    color,
    material,
    occasion,
    style,
    minPrice,
    maxPrice,
    size,
    productKeyword,
    ordinalIndex,
    ordinalKeyword,
    action,
    isBuyAndCheckout
  };
}

export interface RecommendationCriteria extends ProductFilters {
  query?: string;
  material?: string;
  occasion?: string;
  style?: string;
  limit?: number;
}

export interface RecommendationResult {
  products: Product[];
  totalMatches: number;
  topRecommendation?: {
    productId: string;
    productName: string;
    price: number;
    rating: number;
    reason: string;
    score: number;
  };
}

/**
 * Intelligent recommendation and search engine with strict category, gender, color, and budget filtering.
 */
export function recommendProducts(criteria: RecommendationCriteria): RecommendationResult {
  const allProducts = getAllProducts();
  const limit = Math.max(1, Math.min(criteria.limit || 4, 8));

  // 1. Initial filter: exclude completely out-of-stock
  let candidates = allProducts.filter((p) => p.stock > 0);

  // Auto-detect category from query if not already set to prevent category leakage
  if (!criteria.category && criteria.query) {
    const qLower = criteria.query.toLowerCase();
    if (qLower.includes('jean') || qLower.includes('jeans') || qLower.includes('denim')) {
      criteria.category = 'jeans';
    } else if (qLower.includes('dress') || qLower.includes('dresses') || qLower.includes('gown')) {
      criteria.category = 'dresses';
    } else if (qLower.includes('saree') || qLower.includes('saris')) {
      criteria.category = 'sarees';
    }
  }

  // 2. Strict Category Matching: If a category is requested, strictly filter candidates
  if (criteria.category && criteria.category.trim().length > 0) {
    const targetCat = criteria.category.trim().toLowerCase();
    candidates = candidates.filter((p) => {
      const pCat = p.category.toLowerCase();
      const pSub = (p.subcategory || '').toLowerCase();
      const pName = p.name.toLowerCase();

      if (targetCat === 'dresses') {
        return pCat === 'dresses' || pSub === 'dress' || pSub === 'gown' || pSub === 'sundress' || pSub === 'kaftan' || (pName.includes('dress') && pCat !== 'accessories' && pCat !== 'footwear');
      }
      if (targetCat === 'sarees') {
        return pCat === 'sarees' || pSub === 'saree';
      }
      if (targetCat === 'kurtas') {
        return pCat === 'kurtas' || pSub === 'kurta' || pSub === 'anarkali';
      }
      if (targetCat === 'jackets') {
        return pCat === 'jackets' || pSub === 'jacket' || pSub === 'bandhgala' || pSub === 'nehru jacket' || pSub === 'blazer';
      }
      if (targetCat === 'shirts' || targetCat === 'formal shirts' || targetCat === 'linen shirts' || targetCat === 'casual shirts') {
        return pCat === 'shirts' || pCat === 'formal shirts' || pCat === 'linen shirts' || pSub === 'shirt';
      }
      if (targetCat === 't-shirts') {
        return pCat === 't-shirts';
      }
      if (targetCat === 'jeans') {
        return pCat === 'jeans';
      }
      if (targetCat === 'chinos') {
        return pCat === 'chinos';
      }
      if (targetCat === 'contemporary ethnic wear') {
        return pCat === 'contemporary ethnic wear' || pSub === 'co-ord' || pSub === 'skirt';
      }
      if (targetCat === 'tops') {
        return pCat === 'tops' || pSub === 'blouse' || pSub === 'top';
      }
      if (targetCat === 'tote bags') {
        return pCat === 'tote bags' || pCat === 'bags';
      }
      if (targetCat === 'accessories') {
        return pCat === 'accessories';
      }
      if (targetCat === 'footwear') {
        return pCat === 'footwear';
      }

      return pCat === targetCat || pCat.includes(targetCat) || targetCat.includes(pCat);
    });
  }

  // 3. Strict Gender Matching:
  if (criteria.gender && typeof criteria.gender === 'string' && criteria.gender.trim().length > 0) {
    const targetGender = criteria.gender.trim().toLowerCase();
    if (targetGender === 'men') {
      candidates = candidates.filter((p) => p.gender === 'men' || p.gender === 'unisex');
    } else if (targetGender === 'women') {
      candidates = candidates.filter((p) => p.gender === 'women' || p.gender === 'unisex');
    }
  }

  // 4. Strict Color Matching:
  if (criteria.color && criteria.color.trim().length > 0) {
    const colorSynonyms = normalizeColor(criteria.color);
    const colorMatches = candidates.filter((p) => {
      return colorSynonyms.some((syn) =>
        p.colors.some((c) => c.toLowerCase().includes(syn)) ||
        p.name.toLowerCase().includes(syn) ||
        p.description.toLowerCase().includes(syn)
      );
    });
    if (colorMatches.length > 0) {
      candidates = colorMatches;
    } else {
      // If zero exact color matches found within category, return empty candidates for exact honesty
      candidates = [];
    }
  }

  // 5. Strict Budget Capping:
  if (criteria.maxPrice !== undefined && criteria.maxPrice > 0) {
    candidates = candidates.filter((p) => p.price <= criteria.maxPrice!);
  }

  if (criteria.minPrice !== undefined && criteria.minPrice > 0) {
    candidates = candidates.filter((p) => p.price >= criteria.minPrice!);
  }

  // 6. Size filtering if requested:
  if (criteria.size && criteria.size.trim().length > 0) {
    const sz = criteria.size.trim().toUpperCase();
    const sizeMatches = candidates.filter((p) =>
      p.sizes.some((s) => s.toUpperCase() === sz) ||
      p.sizes.includes('Free Size') ||
      p.sizes.includes('One Size')
    );
    if (sizeMatches.length > 0) {
      candidates = sizeMatches;
    }
  }

  // 7. Score & Rank Remaining Valid Candidates
  const scored = candidates.map((prod) => {
    let score = 100;
    const reasons: string[] = [];

    // Base score from rating and review count
    score += (prod.rating || 4.5) * 10; // e.g. 48 pts
    score += Math.min(prod.reviewCount || 0, 50) * 0.2; // up to 10 pts

    // Fabric / Material match bonus
    if (criteria.material && criteria.material.trim().length > 0) {
      const mat = criteria.material.trim().toLowerCase();
      if (
        (prod.material && prod.material.toLowerCase().includes(mat)) ||
        prod.name.toLowerCase().includes(mat) ||
        prod.description.toLowerCase().includes(mat)
      ) {
        score += 40;
        reasons.push(`handcrafted in ${criteria.material}`);
      }
    }

    // Occasion match bonus
    if (criteria.occasion && criteria.occasion.trim().length > 0) {
      const occ = criteria.occasion.trim().toLowerCase();
      if (
        (prod.occasion && prod.occasion.toLowerCase().includes(occ)) ||
        prod.description.toLowerCase().includes(occ)
      ) {
        score += 30;
        reasons.push(`tailored for ${criteria.occasion}`);
      }
    }

    // Style match bonus
    if (criteria.style && criteria.style.trim().length > 0) {
      const st = criteria.style.trim().toLowerCase();
      if (
        (prod.styleTags && prod.styleTags.some((tag) => tag.toLowerCase().includes(st))) ||
        prod.description.toLowerCase().includes(st)
      ) {
        score += 25;
        reasons.push(`${criteria.style} silhouette`);
      }
    }

    // Budget proximity bonus (good value)
    if (criteria.maxPrice) {
      reasons.push(`within budget of ₹${criteria.maxPrice.toLocaleString('en-IN')}`);
    }

    return {
      product: prod,
      score,
      reasons
    };
  });

  // Sort candidates by score descending, then rating descending, then price ascending
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.product.rating !== a.product.rating) return b.product.rating - a.product.rating;
    return a.product.price - b.product.price;
  });

  const selectedScored = scored.slice(0, limit);
  const products = selectedScored.map((s) => s.product);

  let topRecommendation: RecommendationResult['topRecommendation'] = undefined;
  if (selectedScored.length > 0) {
    const top = selectedScored[0];
    const topProd = top.product;
    const matchingColor = criteria.color
      ? (topProd.colors.find((c) => normalizeColor(criteria.color!).some((syn) => c.toLowerCase().includes(syn))) || topProd.colors[0])
      : topProd.colors[0];
    const reasonText = `I'd recommend the **${topProd.name}**. The **${matchingColor}** silhouette keeps the look refined while the handcrafted ${topProd.material || 'textile'} gives it an understated elegance. At ₹${topProd.price.toLocaleString('en-IN')}, it stays comfortably within your budget (${topProd.rating}★ rating, ${topProd.stock} pieces in stock).`;

    topRecommendation = {
      productId: topProd.id,
      productName: topProd.name,
      price: topProd.price,
      rating: topProd.rating,
      reason: reasonText,
      score: Math.round(top.score)
    };
  }

  return {
    products,
    totalMatches: candidates.length,
    topRecommendation
  };
}

/**
 * Finds exactly ONE complementary product for a bounded upsell or Complete The Look ensemble.
 */
export function getComplementaryProduct(productId: string): Product | null {
  if (!productId || typeof productId !== 'string' || productId.trim().length === 0) {
    return null;
  }

  const target = getProductById(productId.trim());
  if (!target) {
    return null;
  }

  const allProducts = getAllProducts().filter((p) => p.id !== target.id && p.stock > 0);
  const targetCategory = target.category.toLowerCase();
  const targetGender = target.gender.toLowerCase();

  let preferredSubcategories: string[] = [];

  if (targetCategory.includes('dress') || targetCategory.includes('saree')) {
    preferredSubcategories = ['stole', 'shawl', 'sandals', 'leather bag'];
  } else if (targetCategory.includes('bandhgala') || targetCategory.includes('jacket') || targetCategory.includes('kurta')) {
    preferredSubcategories = ['stole', 'shawl', 'loafers', 'belt', 'footwear'];
  } else if (targetCategory.includes('shirt')) {
    preferredSubcategories = ['trousers', 'belt', 'loafers', 'sneakers'];
  } else if (targetCategory.includes('chino') || targetCategory.includes('jean')) {
    preferredSubcategories = ['belt', 'loafers', 'sneakers', 'linen shirt'];
  } else {
    preferredSubcategories = ['stole', 'belt', 'wallet'];
  }

  const scoredCandidates = allProducts.map((p) => {
    let score = 0;
    const pSub = (p.subcategory || '').toLowerCase();
    const pCat = p.category.toLowerCase();
    const pGender = p.gender.toLowerCase();

    // Preferred subcategory priority
    const subIdx = preferredSubcategories.findIndex((s) => pSub.includes(s) || pCat.includes(s));
    if (subIdx !== -1) {
      score += (preferredSubcategories.length - subIdx) * 25;
    }

    // Gender suitability
    if (pGender === targetGender || pGender === 'unisex') {
      score += 15;
    }

    // Proportional price (accessory/upsell ideally 20% to 70% of main piece)
    if (p.price < target.price) {
      score += 15;
    }
    if (p.price <= 5000) {
      score += 10;
    }

    score += (p.rating || 4.5) * 5;

    return { product: p, score };
  });

  scoredCandidates.sort((a, b) => b.score - a.score);

  return scoredCandidates.length > 0 && scoredCandidates[0].score > 20
    ? scoredCandidates[0].product
    : null;
}

/**
 * Finds similar / alternative products for recommendations or substitutions.
 */
export function getSimilarProducts(productId: string, limit = 4): Product[] {
  if (!productId || typeof productId !== 'string' || productId.trim().length === 0) {
    return [];
  }

  const target = getProductById(productId.trim());
  if (!target) {
    return [];
  }

  try {
    const candidateRows = db.prepare(`
      SELECT * FROM products
      WHERE is_archived = 0 AND id != ? AND stock > 0
    `).all(target.id) as DbProduct[];
    const candidates = candidateRows.map(mapDbProductToProduct);

    const scored = candidates.map((c) => {
      let score = 0;
      if (c.category.toLowerCase() === target.category.toLowerCase()) score += 30;
      if (c.gender.toLowerCase() === target.gender.toLowerCase() || c.gender === 'unisex') score += 15;
      const targetColors = new Set(target.colors.map((col) => col.toLowerCase()));
      const sharedColors = c.colors.filter((col) => targetColors.has(col.toLowerCase())).length;
      score += sharedColors * 10;
      score += (c.rating || 4.5) * 5;
      return { product: c, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map((s) => s.product);
  } catch (error) {
    console.error(`[CatalogService] Error in getSimilarProducts for id "${productId}":`, error);
    throw new Error('Failed to retrieve similar products');
  }
}

export default {
  getAllProducts,
  getProductById,
  getProductsByCategory,
  getProductsByGender,
  getNewArrivalProducts,
  getArchivedProducts,
  searchProducts,
  extractShoppingIntent,
  recommendProducts,
  getComplementaryProduct,
  getSimilarProducts
};
