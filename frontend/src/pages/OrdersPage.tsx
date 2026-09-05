import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PageContainer } from '../components/common/PageContainer';
import { Button } from '../components/common/Button';
import { useAuthStore } from '../stores/authStore';
import { api } from '../services/api';
import { formatCurrency } from '../lib/utils';
import { getSessionId } from '../lib/session';
import { AuthModal } from '../components/auth/AuthModal';
import {
  Package,
  Sparkles,
  ShoppingBag,
  Truck,
  CheckCircle2,
  Clock,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  Copy,
  Check,
} from 'lucide-react';

interface OrderItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  size?: string;
  color?: string;
  imageUrl: string;
}

interface CustomerOrder {
  id: string;
  channel: 'human' | 'agent';
  status: string;
  totalAmount: number;
  currency: string;
  paymentProvider?: string;
  paymentOrderId?: string;
  paymentId?: string;
  createdAt: string;
  updatedAt: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  shippingAddress?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingPostalCode?: string;
  items: OrderItem[];
}

export const OrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const { isLoggedIn, user } = useAuthStore();

  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);

  const fetchOrders = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const sessionId = getSessionId();
      const params = {
        sessionId,
        customerId: user?.id,
        userId: user?.id,
        email: user?.email,
      };

      console.log('[OrdersPage] Calling GET /api/orders with params:', params, 'isLoggedIn:', isLoggedIn);
      const res = await api.getCustomerOrders(params);
      console.log('[OrdersPage] Raw API response from /api/orders:', res);

      if (res.success && Array.isArray(res.orders)) {
        setOrders(res.orders);
      } else {
        setOrders([]);
      }
    } catch (err: any) {
      console.error('[OrdersPage] Failed to fetch customer orders:', err);
      // If unauthorized and unauthenticated, set empty orders without error banner
      if (!isLoggedIn) {
        setOrders([]);
      } else {
        setError(err?.response?.data?.message || 'Unable to retrieve your order archive. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [isLoggedIn, user?.id]);

  const handleCopyOrderId = (orderId: string) => {
    navigator.clipboard.writeText(orderId);
    setCopiedOrderId(orderId);
    setTimeout(() => setCopiedOrderId(null), 2000);
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <PageContainer>
      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12 space-y-8">
        
        {/* Editorial Header */}
        <div className="space-y-3 border-b border-[#E6E2DA] dark:border-[#3E443D] pb-6">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-[#8AA48A] font-semibold">
            <Package className="w-4 h-4" />
            <span>Customer Provenance Archive</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-serif text-text-primary font-normal tracking-tight">
            Your Orders & Acquisitions
          </h1>
          <p className="text-sm text-text-secondary max-w-2xl font-light leading-relaxed">
            Every garment ordered through Vastra.AI is authenticated and documented with its handcrafted artisan provenance, white-glove dispatch status, and lifetime care guarantee.
          </p>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="py-20 flex flex-col items-center justify-center space-y-4 text-text-secondary">
            <RefreshCw className="w-7 h-7 text-[#8AA48A] animate-spin" />
            <p className="text-xs tracking-wider uppercase font-light">Loading your couture acquisition records...</p>
          </div>
        )}

        {/* Error State */}
        {!isLoading && error && (
          <div className="p-6 rounded-2xl bg-amber-500/10 dark:bg-amber-950/30 border border-amber-500/30 text-xs space-y-3">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-medium">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
            <button
              onClick={fetchOrders}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#8AA48A] text-[#2A2A2A] text-xs font-semibold hover:bg-[#758E75] transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Unauthenticated State when NO orders found */}
        {!isLoggedIn && !isLoading && !error && orders.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-8 sm:p-10 rounded-3xl bg-[#FCFCF9] dark:bg-[#343833] border border-[#E6E2DA] dark:border-[#3E443D] text-center space-y-5 shadow-soft"
          >
            <div className="w-14 h-14 rounded-full bg-[#8AA48A]/15 text-[#7B876F] dark:text-[#8AA48A] flex items-center justify-center mx-auto">
              <Package className="w-7 h-7" />
            </div>
            <div className="space-y-1.5 max-w-md mx-auto">
              <h3 className="text-lg font-serif font-medium text-text-primary">
                Sign In to View Orders
              </h3>
              <p className="text-xs text-text-secondary leading-relaxed font-light">
                Please sign in with your customer account to review active dispatches, verified payment IDs, and artisanal certificates.
              </p>
            </div>
            <div className="pt-2 flex justify-center gap-3">
              <Button
                variant="primary"
                onClick={() => setIsAuthModalOpen(true)}
                className="px-6 py-2.5 text-xs font-semibold uppercase tracking-wider"
              >
                Sign In / Register
              </Button>
            </div>
          </motion.div>
        )}

        {/* Empty Orders State for Logged-in Customer */}
        {isLoggedIn && !isLoading && !error && orders.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-12 rounded-3xl bg-[#FCFCF9] dark:bg-[#343833] border border-[#E6E2DA] dark:border-[#3E443D] text-center space-y-5 shadow-soft"
          >
            <div className="w-14 h-14 rounded-full bg-[#8AA48A]/15 text-[#7B876F] dark:text-[#8AA48A] flex items-center justify-center mx-auto">
              <ShoppingBag className="w-7 h-7" />
            </div>
            <div className="space-y-1.5 max-w-sm mx-auto">
              <h3 className="text-lg font-serif font-medium text-text-primary">
                No Acquisitions Yet
              </h3>
              <p className="text-xs text-text-secondary leading-relaxed font-light">
                You have not placed any orders yet. Discover our latest seasonal drops or design a custom look with our AI Stylist.
              </p>
            </div>
            <div className="pt-2 flex flex-wrap justify-center gap-3">
              <Button
                variant="primary"
                onClick={() => navigate('/shop')}
                className="px-6 py-2.5 text-xs font-semibold uppercase tracking-wider"
              >
                Explore Collection
              </Button>
              <Button
                variant="secondary"
                onClick={() => navigate('/agent')}
                className="px-6 py-2.5 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#8AA48A]" />
                <span>Shop with AI</span>
              </Button>
            </div>
          </motion.div>
        )}

        {/* Active Session Notice when unauthenticated user has orders in current session */}
        {!isLoggedIn && !isLoading && !error && orders.length > 0 && (
          <div className="p-4 rounded-2xl bg-[#8AA48A]/15 border border-[#8AA48A]/30 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-subtle">
            <div className="flex items-center gap-2.5 text-text-primary">
              <ShieldCheck className="w-4 h-4 text-[#8AA48A] flex-shrink-0" />
              <span>Showing acquisitions from your active shopping session. Sign in to link them permanently to your verified customer provenance archive.</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAuthModalOpen(true)}
              className="text-[11px] font-semibold uppercase tracking-wider py-1.5 px-3 self-start sm:self-auto flex-shrink-0"
            >
              Sign In / Register
            </Button>
          </div>
        )}

        {/* Orders List */}
        {!isLoading && !error && orders.length > 0 && (
          <div className="space-y-6">
            {orders.map((order) => {
              const isPaid = order.status.toUpperCase() === 'PAID';
              const isAgent = order.channel === 'agent';

              return (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="rounded-3xl bg-[#FCFCF9] dark:bg-[#343833] border border-[#E6E2DA] dark:border-[#3E443D] p-6 sm:p-8 space-y-6 shadow-soft hover:shadow-subtle transition-shadow"
                >
                  {/* Order Top Bar */}
                  <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-[#E6E2DA] dark:border-[#3E443D]">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-text-primary">
                          #{order.id}
                        </span>
                        <button
                          onClick={() => handleCopyOrderId(order.id)}
                          title="Copy Order ID"
                          className="text-text-secondary hover:text-text-primary transition-colors p-1"
                        >
                          {copiedOrderId === order.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                      <p className="text-[11px] text-text-secondary font-light">
                        Placed on {formatDate(order.createdAt)}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Channel Badge */}
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wider uppercase ${
                          isAgent
                            ? 'bg-[#8AA48A]/20 text-[#5E6854] dark:text-[#A0B092] border border-[#8AA48A]/40'
                            : 'bg-stone-200/60 dark:bg-stone-800 text-text-secondary border border-stone-300 dark:border-stone-700'
                        }`}
                      >
                        {isAgent ? (
                          <>
                            <Sparkles className="w-3 h-3 text-[#7B876F] dark:text-[#8AA48A]" />
                            <span>AI Shopping</span>
                          </>
                        ) : (
                          <>
                            <ShoppingBag className="w-3 h-3" />
                            <span>Storefront</span>
                          </>
                        )}
                      </span>

                      {/* Status Badge */}
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase ${
                          isPaid
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {isPaid ? (
                          <>
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Paid</span>
                          </>
                        ) : (
                          <>
                            <Clock className="w-3 h-3" />
                            <span>Pending</span>
                          </>
                        )}
                      </span>

                      {/* Total Amount */}
                      <div className="text-right pl-3 border-l border-[#E6E2DA] dark:border-[#3E443D]">
                        <span className="text-base font-serif font-bold text-text-primary">
                          {formatCurrency(order.totalAmount)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Delivery Address Banner */}
                  <div className="p-3.5 rounded-2xl bg-surface border border-[#E6E2DA] dark:border-[#3E443D] text-xs space-y-1">
                    <div className="flex items-center gap-1.5 text-text-primary font-medium">
                      <Truck className="w-4 h-4 text-[#8AA48A]" />
                      <span>
                        Delivery to: <strong>{order.customerName || user?.name || 'Customer'}</strong>
                        {order.customerPhone && <span> • {order.customerPhone}</span>}
                      </span>
                    </div>
                    <p className="text-text-secondary font-light text-[11px] pl-5">
                      {order.shippingAddress || '42 Atelier Lane, Indiranagar, Bangalore, Karnataka - 560038'}
                      {order.shippingCity && `, ${order.shippingCity}`}
                      {order.shippingState && `, ${order.shippingState}`}
                      {order.shippingPostalCode && ` - ${order.shippingPostalCode}`}
                    </p>
                  </div>

                  {/* Purchased Items List */}
                  <div className="space-y-3">
                    <h4 className="text-[11px] uppercase tracking-wider font-semibold text-text-secondary">
                      Purchased Garments ({order.items?.length || 0})
                    </h4>
                    <div className="divide-y divide-[#E6E2DA]/60 dark:divide-[#3E443D]">
                      {order.items?.map((item) => (
                        <div key={item.id} className="py-3 flex items-center justify-between gap-4 first:pt-0">
                          <div className="flex items-center gap-3.5">
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="w-14 aspect-[3/4] object-cover rounded-xl border border-[#E6E2DA] dark:border-[#3E443D]"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src =
                                  'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80';
                              }}
                            />
                            <div className="space-y-0.5 text-xs">
                              <p className="font-serif font-medium text-text-primary">{item.name}</p>
                              <p className="text-[11px] text-text-secondary font-light">
                                Size: <strong className="text-text-primary font-medium">{item.size || 'M'}</strong>
                                {item.color && (
                                  <span>
                                    {' '}• Color: <strong className="text-text-primary font-medium">{item.color}</strong>
                                  </span>
                                )}
                                {' '}• Qty: {item.quantity}
                              </p>
                            </div>
                          </div>

                          <div className="text-right">
                            <p className="font-semibold text-xs text-text-primary">
                              {formatCurrency(item.price * item.quantity)}
                            </p>
                            {item.quantity > 1 && (
                              <p className="text-[10px] text-text-secondary">
                                {formatCurrency(item.price)} each
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Artisan Seal & Provenance Footer */}
                  <div className="pt-3 border-t border-[#E6E2DA] dark:border-[#3E443D] flex flex-wrap items-center justify-between gap-2 text-[11px] text-text-secondary font-light">
                    <div className="flex items-center gap-1.5 text-[#7B876F] dark:text-[#8AA48A]">
                      <ShieldCheck className="w-4 h-4" />
                      <span>Certified Master Artisan Provenance • White-Glove Dispatch</span>
                    </div>
                    {order.paymentId && (
                      <div className="font-mono text-[10px]">
                        Payment Ref: {order.paymentId}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

      </div>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => {
          setIsAuthModalOpen(false);
          fetchOrders();
        }}
      />
    </PageContainer>
  );
};

export default OrdersPage;
