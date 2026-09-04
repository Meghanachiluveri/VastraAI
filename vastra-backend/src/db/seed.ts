import { db } from './db';
import { SEED_PRODUCTS } from './seedData';

interface CountResult {
  count: number;
}

/**
 * Seeds the products table with the catalog from frontend if the table is empty.
 * Uses parameterized queries and an atomic transaction.
 * Safe to run repeatedly across server restarts.
 */
export function seedProducts(): { seeded: boolean; count: number } {
  try {
    console.log(`[DB Seed] Syncing ${SEED_PRODUCTS.length} products into database...`);

    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO products (
        id, name, price, stock, gender, category, subcategory,
        sizes, colors, rating, review_count, image_url, description,
        material, occasion, style_tags, is_new, is_archived
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?
      )
    `);

    const seedTransaction = db.transaction((products) => {
      for (const p of products) {
        insertStmt.run(
          p.id,
          p.name,
          p.price,
          p.stock,
          p.gender,
          p.category,
          p.subcategory || '',
          JSON.stringify(p.sizes),
          JSON.stringify(p.colors),
          p.rating,
          p.reviewCount,
          p.imageUrl,
          p.description,
          p.material || '',
          p.occasion || '',
          JSON.stringify(p.styleTags || []),
          p.isNew ? 1 : 0,
          p.isArchived ? 1 : 0
        );
      }
    });

    seedTransaction(SEED_PRODUCTS);
    console.log(`[DB Seed] Successfully seeded ${SEED_PRODUCTS.length} products.`);
    return { seeded: true, count: SEED_PRODUCTS.length };
  } catch (error) {
    console.error('[DB Seed] Failed to seed products:', error);
    throw error;
  }
}

export default seedProducts;

if (require.main === module || process.argv[1]?.includes('seed')) {
  seedProducts();
}
