import { Router, Request, Response } from 'express';
import {
  getSimulationRunById,
  getSimulationRuns,
  runSimulation
} from '../services/simulationService';
import { requireMerchantAuth } from '../middleware/authMiddleware';
import { ErrorResponse, SimulationResult, SimulationRunSummary } from '../types';

const router = Router();

// Apply requireMerchantAuth to all simulation endpoints
router.use(requireMerchantAuth);

/**
 * POST /api/merchant/simulations
 * Executes a simulated AI shopping campaign with N shoppers without touching real inventory or payments.
 */
router.post('/', (req: Request, res: Response<SimulationResult | ErrorResponse>) => {
  try {
    const { numberOfShoppers, seed, config } = req.body;
    const shoppers = numberOfShoppers ? parseInt(String(numberOfShoppers), 10) : 50;

    const result = runSimulation({
      numberOfShoppers: shoppers,
      seed: seed !== undefined ? Number(seed) : undefined,
      config
    });

    res.status(200).json(result);
  } catch (error: any) {
    console.error('[SimulationRoutes] Error executing simulation:', error);
    res.status(500).json({ error: 'SIMULATION_FAILED', message: 'Failed to execute AI shopping simulation' });
  }
});

/**
 * GET /api/merchant/simulations
 * Returns list of historical simulation runs.
 */
router.get('/', (req: Request, res: Response<{ simulations: SimulationRunSummary[]; count: number } | ErrorResponse>) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const simulations = getSimulationRuns(limit);
    res.status(200).json({ simulations, count: simulations.length });
  } catch (error: any) {
    console.error('[SimulationRoutes] Error retrieving simulation runs:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to retrieve simulation history' });
  }
});

/**
 * GET /api/merchant/simulations/:id
 * Returns complete funnel metrics and top products for a specific simulation run.
 */
router.get('/:id', (req: Request, res: Response<SimulationResult | ErrorResponse>) => {
  try {
    const simulationId = String(req.params.id || '');
    if (!simulationId) {
      res.status(400).json({ error: 'ID_REQUIRED', message: 'Simulation ID is required' });
      return;
    }

    const simulation = getSimulationRunById(simulationId);
    if (!simulation) {
      res.status(404).json({ error: 'SIMULATION_NOT_FOUND', message: `Simulation ${simulationId} not found` });
      return;
    }

    res.status(200).json(simulation);
  } catch (error: any) {
    console.error('[SimulationRoutes] Error retrieving simulation by id:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to retrieve simulation details' });
  }
});

export default router;
