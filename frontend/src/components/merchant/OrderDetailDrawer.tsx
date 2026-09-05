import React from 'react';
import { Drawer } from '../common/Drawer';
import { formatCurrency } from '../../lib/utils';
import type { MerchantOrder } from './OrdersTable';
import { Sparkles, ShoppingBag, User, MapPin, Phone, Mail, ShieldCheck } from 'lucide-react';

interface OrderDetailDrawerProps {
  order: MerchantOrder | null;
  isOpen: boolean;
  onClose: () => void;
}

export const OrderDetailDrawer: React.FC<OrderDetailDrawerProps> = ({
  order,
  isOpen,
  onClose,
}) => {
  if (!order) return null;

  const subtotal = order.items.reduce((sum, i) => sum + i.price * (i.quantity || 1), 0);
  const shipping = order.totalAmount > subtotal ? order.totalAmount - subtotal : 0;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      side="right"
      width="md"
      title={`Order ${order.id}`}
    >
      <div className="space-y-6">
        {/* Order Meta Header */}
        <div className="p-4 rounded-xl bg-background-primary border border-[#E6E2DA] dark:border-[#3E443D] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-secondary">Channel</span>
            {order.channel === 'agent' ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#CFD8CF]/40 dark:bg-[#343833] text-[#4A5B4A] dark:text-[#8AA48A] border border-[#8AA48A]/40">
                <Sparkles className="w-3 h-3" />
                AI Concierge
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-background-elevated text-text-secondary border border-[#E6E2DA] dark:border-[#3E443D]">
                <ShoppingBag className="w-3 h-3" />
                Storefront Web
              </span>
            )}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-text-secondary">Payment Status</span>
            <span className="text-xs font-semibold text-text-primary uppercase tracking-wider">
              {order.status}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-text-secondary">Order Placed</span>
            <span className="text-xs text-text-primary">
              {new Date(order.createdAt).toLocaleString('en-IN')}
            </span>
          </div>

          {order.sessionId && (
            <div className="flex items-center justify-between pt-2 border-t border-[#E6E2DA]/60 dark:border-[#3E443D]/60 text-[11px]">
              <span className="text-text-secondary">AI Session ID</span>
              <span className="font-mono text-text-primary truncate max-w-[180px]">
                {order.sessionId}
              </span>
            </div>
          )}
        </div>

        {/* Ordered Line Items */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
            Garments & Ordered Pieces ({order.items.length})
          </h3>

          <div className="space-y-2.5">
            {order.items.map((item) => (
              <div
                key={item.id || item.productId}
                className="p-3.5 rounded-xl bg-background-elevated border border-[#E6E2DA] dark:border-[#3E443D] flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-12 h-14 object-cover rounded-lg border border-[#E6E2DA] dark:border-[#3E443D] shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-14 bg-background-primary rounded-lg flex items-center justify-center shrink-0 border border-[#E6E2DA] dark:border-[#3E443D]">
                      <ShoppingBag className="w-5 h-5 text-text-secondary opacity-50" />
                    </div>
                  )}

                  <div className="min-w-0">
                    <h4 className="text-xs font-semibold text-text-primary truncate">
                      {item.name}
                    </h4>
                    <div className="flex items-center gap-2 text-[11px] text-text-secondary mt-0.5">
                      {item.size && <span>Size: <strong className="text-text-primary">{item.size}</strong></span>}
                      {item.color && <span>• {item.color}</span>}
                      <span>• Qty: {item.quantity || 1}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-xs font-semibold text-text-primary font-display">
                    {formatCurrency(item.price * (item.quantity || 1))}
                  </div>
                  <div className="text-[10px] text-text-secondary">
                    {formatCurrency(item.price)} each
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Customer Information if available */}
        {order.customerInfo && (
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Patron & Delivery Information
            </h3>

            <div className="p-4 rounded-xl bg-background-primary border border-[#E6E2DA] dark:border-[#3E443D] space-y-2.5 text-xs">
              {order.customerInfo.name && (
                <div className="flex items-center gap-2 text-text-primary font-medium">
                  <User className="w-3.5 h-3.5 text-text-secondary" />
                  <span>{order.customerInfo.name}</span>
                </div>
              )}
              {order.customerInfo.email && (
                <div className="flex items-center gap-2 text-text-secondary">
                  <Mail className="w-3.5 h-3.5 text-text-secondary" />
                  <span>{order.customerInfo.email}</span>
                </div>
              )}
              {order.customerInfo.phone && (
                <div className="flex items-center gap-2 text-text-secondary">
                  <Phone className="w-3.5 h-3.5 text-text-secondary" />
                  <span>{order.customerInfo.phone}</span>
                </div>
              )}
              {order.customerInfo.address && (
                <div className="flex items-start gap-2 text-text-secondary pt-1 border-t border-[#E6E2DA]/60 dark:border-[#3E443D]/60">
                  <MapPin className="w-3.5 h-3.5 text-text-secondary shrink-0 mt-0.5" />
                  <span>{order.customerInfo.address}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Financial Summary */}
        <div className="p-4 rounded-xl bg-[#CFD8CF]/20 dark:bg-[#343833]/40 border border-[#8AA48A]/30 space-y-2 text-xs">
          <div className="flex justify-between text-text-secondary">
            <span>Garment Subtotal</span>
            <span className="text-text-primary font-medium">{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between text-text-secondary">
            <span>Express Delivery</span>
            <span>{shipping === 0 ? <strong className="text-[#8AA48A]">Complimentary</strong> : formatCurrency(shipping)}</span>
          </div>
          <div className="flex justify-between text-sm font-semibold text-text-primary pt-2 border-t border-[#E6E2DA] dark:border-[#3E443D]">
            <span>Total Paid Amount</span>
            <span className="font-display text-base">{formatCurrency(order.totalAmount)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[10px] text-text-secondary justify-center">
          <ShieldCheck className="w-3.5 h-3.5 text-[#8AA48A]" />
          <span>Cryptographically verified Razorpay settlement</span>
        </div>
      </div>
    </Drawer>
  );
};
