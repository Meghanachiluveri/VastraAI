import { Router } from 'express';
import catalogRouter from './catalog.routes';
import orderRouter from './order.routes';
import paymentRouter from './payment.routes';
import agentRouter from './agent.routes';
import cartRouter from './cart.routes';
import authRouter from './auth.routes';
import customerRouter from './customer.routes';

const apiRouter = Router();

apiRouter.use('/products', catalogRouter);
apiRouter.use('/orders', orderRouter);
apiRouter.use('/payments', paymentRouter);
apiRouter.use('/agent', agentRouter);
apiRouter.use('/cart', cartRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/customer', customerRouter);

export { catalogRouter, orderRouter, paymentRouter, agentRouter, cartRouter, authRouter, customerRouter };
export default apiRouter;

