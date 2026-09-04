import apiClient from '../lib/axios';

export interface SimulationTopProduct {
  productId: string;
  name: string;
  price: number;
  imageUrl?: string;
  recommendedCount: number;
  addedToCartCount: number;
  purchasedCount: number;
}

export interface SimulationResult {
  simulationId: string;
  numberOfShoppers: number;
  sessions: number;
  searches: number;
  recommendations: number;
  cartAdditions: number;
  upsellSuggestions: number;
  upsellAccepted: number;
  checkoutAttempts: number;
  successfulOrders: number;
  failedPayments: number;
  conversionRate: number;
  upsellAcceptanceRate: number;
  revenue: number;
  averageOrderValue: number;
  topProducts: SimulationTopProduct[];
  createdAt: string;
}

export interface SimulationRunSummary {
  id: string;
  numberOfShoppers: number;
  conversionRate: number;
  revenue: number;
  successfulOrders: number;
  upsellAcceptanceRate: number;
  createdAt: string;
}

/**
 * Executes a simulated AI shopping campaign with N shoppers.
 */
export async function runSimulation(numberOfShoppers: number = 50, seed?: number): Promise<SimulationResult> {
  const response = await apiClient.post('/merchant/simulations', {
    numberOfShoppers,
    seed,
  });
  return response.data;
}

/**
 * Retrieves historical simulation runs for the merchant dashboard.
 */
export async function getSimulationRuns(limit: number = 20): Promise<{ simulations: SimulationRunSummary[]; count: number }> {
  const response = await apiClient.get('/merchant/simulations', {
    params: { limit },
  });
  return response.data;
}

/**
 * Retrieves full details of a past simulation run.
 */
export async function getSimulationRunById(simulationId: string): Promise<SimulationResult> {
  const response = await apiClient.get(`/merchant/simulations/${encodeURIComponent(simulationId)}`);
  return response.data;
}

export const simulationService = {
  runSimulation,
  getSimulationRuns,
  getSimulationRunById,
};

export default simulationService;
