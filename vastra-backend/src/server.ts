import dotenv from 'dotenv';
// Load environment variables before other imports that might use them
dotenv.config();

import express, { Request, Response } from 'express';
import cors from 'cors';
import { initDatabase, db } from './db/db';
import { seedProducts } from './db/seed';
import catalogRouter from './routes/catalog.routes';
import orderRouter from './routes/order.routes';
import paymentRouter from './routes/payment.routes';
import agentRouter from './routes/agent.routes';
import cartRouter from './routes/cart.routes';
import authRouter from './routes/auth.routes';
import customerRouter from './routes/customer.routes';
import merchantRouter from './routes/merchant.routes';
import simulationRouter from './routes/simulation.routes';
import explainabilityRouter from './routes/explainability.routes';
import { HealthResponse } from './types';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/products', catalogRouter);
app.use('/api/orders', orderRouter);
app.use('/api/payments', paymentRouter);
app.use('/api/agent', agentRouter);
app.use('/api/cart', cartRouter);
app.use('/api/auth', authRouter);
app.use('/api/customer', customerRouter);
app.use('/api/merchant', merchantRouter);
app.use('/api/merchant/simulations', simulationRouter);
app.use('/api/merchant/ai-sessions', explainabilityRouter);

// Initialize SQLite database and seed catalog
try {
  initDatabase();
  seedProducts();
} catch (error) {
  console.error('Fatal: Database initialization failed:', error);
  process.exit(1);
}

// Health Check Endpoint
app.get('/api/health', (_req: Request, res: Response<HealthResponse>) => {
  res.status(200).json({
    status: 'ok',
    service: 'vastra-backend'
  });
});

// Start Server
const server = app.listen(PORT, () => {
  console.log(`[Vastra.AI Backend] Server running on http://localhost:${PORT}`);
  console.log(`[Vastra.AI Backend] Health check: http://localhost:${PORT}/api/health`);
});

// Graceful Shutdown
function handleShutdown(signal: string) {
  console.log(`\n[Vastra.AI Backend] Received ${signal}. Closing server and database...`);
  server.close(() => {
    try {
      db.close();
      console.log('[Vastra.AI Backend] Database connection closed.');
    } catch (err) {
      console.error('[Vastra.AI Backend] Error closing database:', err);
    }
    process.exit(0);
  });
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

export default app;
