import { db } from '../db/db';
import { getAllProducts, getSimilarProducts, recommendProducts } from './catalogService';
import {
  Product,
  SimulationConfig,
  SimulationEventRecord,
  SimulationResult,
  SimulationRunSummary,
  SimulationTopProduct
} from '../types';

/**
 * Standard baseline simulation probabilities representing realistic consumer behaviour.
 */
export const defaultSimulationConfig: SimulationConfig = {
  searchProbability: 0.96,
  recommendationProbability: 0.92,
  cartAdditionProbability: 0.54,
  upsellSuggestionProbability: 0.70,
  upsellAcceptanceProbability: 0.38,
  checkoutAttemptProbability: 0.76,
  paymentSuccessProbability: 0.89,
};

/**
 * Seedable pseudo-random number generator for deterministic simulations.
 */
class SeededRandom {
  private seed: number;

  constructor(seed?: number) {
    this.seed = seed !== undefined ? seed : Math.floor(Math.random() * 1000000);
  }

  next(): number {
    let t = (this.seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

/**
 * Realistic shopping intent templates that match actual catalog items.
 */
const SIMULATED_INTENTS = [
  { query: 'dresses under 5000', gender: 'women', category: 'dresses', maxPrice: 5000 },
  { query: 'silk bandhgala jacket', gender: 'men', category: 'jackets', maxPrice: 20000 },
  { query: 'formal shirts for work', gender: 'men', category: 'formal shirts', maxPrice: 4000 },
  { query: 'linen summer shirts', gender: 'unisex', category: 'shirts', maxPrice: 5000 },
  { query: 'casual denim jeans', gender: 'men', category: 'jeans', maxPrice: 7000 },
  { query: 'tote bag and accessories', gender: 'unisex', category: 'tote bags', maxPrice: 8000 },
  { query: 'chanderi silk dress', gender: 'women', category: 'dresses', maxPrice: 18000 },
  { query: 'handloom kurta', gender: 'men', category: 'kurtas', maxPrice: 6000 },
  { query: 'handcrafted leather belt', gender: 'unisex', category: 'accessories', maxPrice: 3000 },
  { query: 'heavyweight supima cotton t-shirt', gender: 'men', category: 't-shirts', maxPrice: 2500 }
];

/**
 * Executes a simulated AI shopping campaign with N shoppers without affecting real store data.
 */
export function runSimulation(params: {
  numberOfShoppers: number;
  seed?: number;
  config?: Partial<SimulationConfig>;
}): SimulationResult {
  const shoppersCount = Math.max(1, Math.min(params.numberOfShoppers || 50, 500));
  const rng = new SeededRandom(params.seed);
  const cfg: SimulationConfig = { ...defaultSimulationConfig, ...(params.config || {}) };

  const simulationId = `sim_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const createdAt = new Date().toISOString();

  // Metrics counters
  let sessions = 0;
  let searches = 0;
  let recommendations = 0;
  let cartAdditions = 0;
  let upsellSuggestions = 0;
  let upsellAccepted = 0;
  let checkoutAttempts = 0;
  let successfulOrders = 0;
  let failedPayments = 0;
  let revenue = 0;

  // Top products tracking map: productId -> counts
  const productStats = new Map<string, {
    product: Product;
    recommended: number;
    cart: number;
    purchased: number;
  }>();

  // Helper to ensure product is tracked
  const trackProduct = (prod: Product) => {
    if (!productStats.has(prod.id)) {
      productStats.set(prod.id, {
        product: prod,
        recommended: 0,
        cart: 0,
        purchased: 0
      });
    }
    return productStats.get(prod.id)!;
  };

  const events: {
    id: string;
    simulationId: string;
    simulationSessionId: string;
    channel: 'simulation';
    eventType: string;
    details: string;
  }[] = [];

  // Log simulation started
  events.push({
    id: `simevt_${Date.now()}_start`,
    simulationId,
    simulationSessionId: 'SIM-GLOBAL',
    channel: 'simulation',
    eventType: 'simulation_started',
    details: JSON.stringify({ numberOfShoppers: shoppersCount, seed: params.seed })
  });

  const catalogProducts = getAllProducts();
  const fallbackProduct = catalogProducts[0];

  // =========================================================================
  // SIMULATION LOOP OVER EACH SHOPPER
  // =========================================================================
  for (let i = 1; i <= shoppersCount; i++) {
    const shopperId = `SIM-${String(i).padStart(3, '0')}`;
    sessions++;

    events.push({
      id: `simevt_${Date.now()}_${i}_sess`,
      simulationId,
      simulationSessionId: shopperId,
      channel: 'simulation',
      eventType: 'simulation_session_created',
      details: JSON.stringify({ shopperId })
    });

    // 1. Catalog Search
    if (rng.next() <= cfg.searchProbability) {
      searches++;
      const intentIdx = Math.floor(rng.next() * SIMULATED_INTENTS.length);
      const intent = SIMULATED_INTENTS[intentIdx];

      events.push({
        id: `simevt_${Date.now()}_${i}_srch`,
        simulationId,
        simulationSessionId: shopperId,
        channel: 'simulation',
        eventType: 'simulation_search',
        details: JSON.stringify({ query: intent.query, category: intent.category })
      });

      // 2. Product Recommendations
      const searchRes = recommendProducts({
        query: intent.query,
        category: intent.category,
        gender: intent.gender,
        maxPrice: intent.maxPrice
      });

      const matchedProducts = searchRes.products && searchRes.products.length > 0
        ? searchRes.products
        : [fallbackProduct];

      if (rng.next() <= cfg.recommendationProbability) {
        recommendations++;
        // Shopper inspects the recommended product
        const selectedProd = matchedProducts[0];
        const stat = trackProduct(selectedProd);
        stat.recommended++;

        events.push({
          id: `simevt_${Date.now()}_${i}_rec`,
          simulationId,
          simulationSessionId: shopperId,
          channel: 'simulation',
          eventType: 'simulation_recommendation',
          details: JSON.stringify({
            productId: selectedProd.id,
            productName: selectedProd.name,
            price: selectedProd.price
          })
        });

        // 3. Add to Cart
        if (rng.next() <= cfg.cartAdditionProbability) {
          cartAdditions++;
          stat.cart++;

          events.push({
            id: `simevt_${Date.now()}_${i}_add`,
            simulationId,
            simulationSessionId: shopperId,
            channel: 'simulation',
            eventType: 'simulation_cart_add',
            details: JSON.stringify({
              productId: selectedProd.id,
              productName: selectedProd.name,
              price: selectedProd.price
            })
          });

          // 4. Bounded 1-Item Upsell
          let acceptedUpsellProd: Product | null = null;
          if (rng.next() <= cfg.upsellSuggestionProbability) {
            upsellSuggestions++;

            // Find complementary piece
            const similar = getSimilarProducts(selectedProd.id, 2);
            const upsellProd = similar.length > 0 ? similar[0] : catalogProducts[1] || fallbackProduct;

            events.push({
              id: `simevt_${Date.now()}_${i}_upsell_sug`,
              simulationId,
              simulationSessionId: shopperId,
              channel: 'simulation',
              eventType: 'simulation_upsell_suggested',
              details: JSON.stringify({
                upsellProductId: upsellProd.id,
                upsellProductName: upsellProd.name,
                upsellPrice: upsellProd.price
              })
            });

            if (rng.next() <= cfg.upsellAcceptanceProbability) {
              upsellAccepted++;
              acceptedUpsellProd = upsellProd;
              const upsellStat = trackProduct(upsellProd);
              upsellStat.cart++;

              events.push({
                id: `simevt_${Date.now()}_${i}_upsell_acc`,
                simulationId,
                simulationSessionId: shopperId,
                channel: 'simulation',
                eventType: 'simulation_upsell_accepted',
                details: JSON.stringify({
                  upsellProductId: upsellProd.id,
                  upsellProductName: upsellProd.name,
                  upsellPrice: upsellProd.price
                })
              });
            }
          }

          // 5. Checkout Attempt
          if (rng.next() <= cfg.checkoutAttemptProbability) {
            checkoutAttempts++;

            const orderTotal = selectedProd.price + (acceptedUpsellProd ? acceptedUpsellProd.price : 0);

            events.push({
              id: `simevt_${Date.now()}_${i}_chk`,
              simulationId,
              simulationSessionId: shopperId,
              channel: 'simulation',
              eventType: 'simulation_checkout',
              details: JSON.stringify({ totalAmount: orderTotal })
            });

            // 6. Simulated Payment Settlement (No real Razorpay gateway call)
            if (rng.next() <= cfg.paymentSuccessProbability) {
              successfulOrders++;
              revenue += orderTotal;
              stat.purchased++;
              if (acceptedUpsellProd) {
                const upsellStat = trackProduct(acceptedUpsellProd);
                upsellStat.purchased++;
              }

              events.push({
                id: `simevt_${Date.now()}_${i}_pay_ok`,
                simulationId,
                simulationSessionId: shopperId,
                channel: 'simulation',
                eventType: 'simulation_payment_success',
                details: JSON.stringify({ totalAmount: orderTotal, shopperId })
              });
            } else {
              failedPayments++;
              events.push({
                id: `simevt_${Date.now()}_${i}_pay_fail`,
                simulationId,
                simulationSessionId: shopperId,
                channel: 'simulation',
                eventType: 'simulation_payment_failed',
                details: JSON.stringify({ totalAmount: orderTotal, reason: 'Simulated card decline' })
              });
            }
          }
        }
      }
    }
  }

  // Calculate conversion rates & AOV
  const conversionRate = sessions > 0
    ? Number(((successfulOrders / sessions) * 100).toFixed(1))
    : 0;

  const upsellAcceptanceRate = upsellSuggestions > 0
    ? Number(((upsellAccepted / upsellSuggestions) * 100).toFixed(1))
    : 0;

  const averageOrderValue = successfulOrders > 0
    ? Math.round(revenue / successfulOrders)
    : 0;

  // Format Top Products sorted by purchased and cart additions
  const topProducts: SimulationTopProduct[] = Array.from(productStats.values())
    .map((s) => ({
      productId: s.product.id,
      name: s.product.name,
      price: s.product.price,
      imageUrl: s.product.imageUrl,
      recommendedCount: s.recommended,
      addedToCartCount: s.cart,
      purchasedCount: s.purchased
    }))
    .sort((a, b) => b.purchasedCount - a.purchasedCount || b.addedToCartCount - a.addedToCartCount)
    .slice(0, 8);

  const result: SimulationResult = {
    simulationId,
    numberOfShoppers: shoppersCount,
    sessions,
    searches,
    recommendations,
    cartAdditions,
    upsellSuggestions,
    upsellAccepted,
    checkoutAttempts,
    successfulOrders,
    failedPayments,
    conversionRate,
    upsellAcceptanceRate,
    revenue,
    averageOrderValue,
    topProducts,
    createdAt
  };

  // =========================================================================
  // PERSISTENCE: Save into simulation_runs and simulation_events tables
  // =========================================================================
  try {
    db.prepare(`
      INSERT INTO simulation_runs (
        id, number_of_shoppers, sessions, searches, recommendations,
        cart_additions, upsell_suggestions, upsell_accepted,
        checkout_attempts, successful_orders, failed_payments,
        conversion_rate, upsell_acceptance_rate, revenue,
        average_order_value, top_products, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      result.simulationId,
      result.numberOfShoppers,
      result.sessions,
      result.searches,
      result.recommendations,
      result.cartAdditions,
      result.upsellSuggestions,
      result.upsellAccepted,
      result.checkoutAttempts,
      result.successfulOrders,
      result.failedPayments,
      result.conversionRate,
      result.upsellAcceptanceRate,
      result.revenue,
      result.averageOrderValue,
      JSON.stringify(result.topProducts),
      result.createdAt
    );

    // Save recent events in batch
    const insertEvent = db.prepare(`
      INSERT INTO simulation_events (id, simulation_id, simulation_session_id, channel, event_type, details)
      VALUES (?, ?, ?, 'simulation', ?, ?)
    `);

    const insertMany = db.transaction((evts) => {
      for (const e of evts) {
        insertEvent.run(e.id, e.simulationId, e.simulationSessionId, e.eventType, e.details);
      }
    });

    insertMany(events.slice(0, 200)); // persist top 200 granular events
  } catch (err) {
    console.error('[SimulationService] Error persisting simulation run:', err);
  }

  return result;
}

/**
 * Retrieves historical simulation runs.
 */
export function getSimulationRuns(limit: number = 20): SimulationRunSummary[] {
  try {
    const rows = db.prepare(`
      SELECT
        id,
        number_of_shoppers as numberOfShoppers,
        conversion_rate as conversionRate,
        revenue,
        successful_orders as successfulOrders,
        upsell_acceptance_rate as upsellAcceptanceRate,
        created_at as createdAt
      FROM simulation_runs
      ORDER BY created_at DESC
      LIMIT ?
    `).all(limit) as SimulationRunSummary[];

    return rows;
  } catch (err) {
    console.error('[SimulationService] Error fetching simulation runs:', err);
    return [];
  }
}

/**
 * Retrieves details of a specific simulation run by ID.
 */
export function getSimulationRunById(id: string): SimulationResult | null {
  try {
    const row = db.prepare(`
      SELECT
        id as simulationId,
        number_of_shoppers as numberOfShoppers,
        sessions,
        searches,
        recommendations,
        cart_additions as cartAdditions,
        upsell_suggestions as upsellSuggestions,
        upsell_accepted as upsellAccepted,
        checkout_attempts as checkoutAttempts,
        successful_orders as successfulOrders,
        failed_payments as failedPayments,
        conversion_rate as conversionRate,
        upsell_acceptance_rate as upsellAcceptanceRate,
        revenue,
        average_order_value as averageOrderValue,
        top_products as topProducts,
        created_at as createdAt
      FROM simulation_runs
      WHERE id = ?
    `).get(id) as any;

    if (!row) return null;

    let parsedTopProducts: SimulationTopProduct[] = [];
    if (row.topProducts) {
      try {
        parsedTopProducts = JSON.parse(row.topProducts);
      } catch {
        parsedTopProducts = [];
      }
    }

    return {
      ...row,
      topProducts: parsedTopProducts
    };
  } catch (err) {
    console.error('[SimulationService] Error fetching simulation by id:', err);
    return null;
  }
}
