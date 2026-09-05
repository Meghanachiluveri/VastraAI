import React from 'react';
import { motion } from 'framer-motion';
import { formatCurrency } from '../../lib/utils';
import { Sparkles, ShoppingBag, Eye, CheckCircle2, Clock, XCircle, AlertTriangle } from 'lucide-react';

interface OrderItem {
  id: string;
  productId: string;
  name: string;
  quantity: number;
  price: number;
  size?: string;
  color?: string;
  imageUrl?: string;
}

export interface MerchantOrder {
  id: string;
  channel: 'human' | 'agent';
  status: string;
  totalAmount: number;
  currency: string;
  itemCount: number;
  items: OrderItem[];
  customerInfo?: {
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
  };
  sessionId?: string | null;
  paymentId?: string | null;
  createdAt: string;
}

interface OrdersTableProps {
  orders: MerchantOrder[];
  onSelectOrder: (order: MerchantOrder) => void;
  selectedChannel: string;
  onChannelChange: (channel: string) => void;
}

export const OrdersTable: React.FC<OrdersTableProps> = ({
  orders,
  onSelectOrder,
  selectedChannel,
  onChannelChange,
}) => {
  const getStatusBadge = (status: string) => {
    const s = status.toUpperCase();
    if (s === 'PAID' || s === 'COMPLETED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#8AA48A]/20 text-[#3B4E3B] dark:text-[#8AA48A] border border-[#8AA48A]/30">
          <CheckCircle2 className="w-3 h-3" />
          Paid
        </span>
      );
    }
    if (s === 'PENDING') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
          <Clock className="w-3 h-3" />
          Pending
        </span>
      );
    }
    if (s === 'PAYMENT_CANCELLED' || s === 'CANCELLED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-stone-500/15 text-stone-600 dark:text-stone-300 border border-stone-500/30">
          <XCircle className="w-3 h-3" />
          Cancelled
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">
        <AlertTriangle className="w-3 h-3" />
        Failed
      </span>
    );
  };

  const getChannelBadge = (channel: 'human' | 'agent') => {
    if (channel === 'agent') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#CFD8CF]/40 dark:bg-[#343833] text-[#4A5B4A] dark:text-[#8AA48A] border border-[#8AA48A]/40">
          <Sparkles className="w-3 h-3" />
          AI Agent
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-background-primary text-text-secondary border border-[#E6E2DA] dark:border-[#3E443D]">
        <ShoppingBag className="w-3 h-3" />
        Human Web
      </span>
    );
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.3 }}
      className="p-6 sm:p-7 rounded-2xl bg-background-elevated border border-[#E6E2DA] dark:border-[#3E443D] space-y-5"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-text-primary font-display">
            Recent Orders
          </h2>
          <p className="text-xs text-text-secondary">
            Inspect customer orders across AI concierge and web storefront channels.
          </p>
        </div>

        {/* Channel Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-background-primary rounded-xl border border-[#E6E2DA] dark:border-[#3E443D] self-start sm:self-auto">
          {[
            { id: 'all', label: 'All' },
            { id: 'agent', label: 'AI Concierge' },
            { id: 'human', label: 'Storefront' },
          ].map((pill) => (
            <button
              key={pill.id}
              onClick={() => onChannelChange(pill.id)}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-all ${
                selectedChannel === pill.id
                  ? 'bg-background-elevated text-text-primary shadow-xs font-semibold border border-[#E6E2DA] dark:border-[#3E443D]'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="p-10 text-center rounded-xl bg-background-primary/30 border border-dashed border-[#E6E2DA] dark:border-[#3E443D]">
          <ShoppingBag className="w-8 h-8 mx-auto text-text-secondary mb-2 opacity-50" />
          <p className="text-sm font-medium text-text-primary">No sales yet</p>
          <p className="text-xs text-text-secondary mt-1">
            Once customers start shopping, your commerce activity will appear here.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#E6E2DA] dark:border-[#3E443D] text-text-secondary">
                <th className="pb-3 font-medium">Order ID</th>
                <th className="pb-3 font-medium">Channel</th>
                <th className="pb-3 font-medium">Garments & Items</th>
                <th className="pb-3 font-medium">Amount</th>
                <th className="pb-3 font-medium">Payment Status</th>
                <th className="pb-3 font-medium">Date</th>
                <th className="pb-3 font-medium text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E2DA]/60 dark:divide-[#3E443D]/60">
              {orders.map((order) => (
                <tr
                  key={order.id}
                  onClick={() => onSelectOrder(order)}
                  className="hover:bg-background-primary/50 cursor-pointer transition-colors group"
                >
                  <td className="py-3.5 font-mono text-[11px] text-text-primary font-medium">
                    {order.id}
                  </td>
                  <td className="py-3.5">
                    {getChannelBadge(order.channel)}
                  </td>
                  <td className="py-3.5 text-text-secondary max-w-[220px] truncate">
                    <span className="font-medium text-text-primary">
                      {order.itemCount} piece{order.itemCount === 1 ? '' : 's'}:
                    </span>{' '}
                    {order.items.map((i) => i.name).join(', ') || 'Custom Garment'}
                  </td>
                  <td className="py-3.5 font-semibold text-text-primary font-display text-sm">
                    {formatCurrency(order.totalAmount)}
                  </td>
                  <td className="py-3.5">
                    {getStatusBadge(order.status)}
                  </td>
                  <td className="py-3.5 text-text-secondary whitespace-nowrap">
                    {formatDate(order.createdAt)}
                  </td>
                  <td className="py-3.5 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectOrder(order);
                      }}
                      className="p-1.5 rounded-lg border border-transparent group-hover:border-[#E6E2DA] dark:group-hover:border-[#3E443D] text-text-secondary group-hover:text-text-primary transition-all"
                      title="Inspect order details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  );
};
