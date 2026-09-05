import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Drawer } from '../common/Drawer';
import { Button } from '../common/Button';
import { useCartStore } from '../../stores/cartStore';
import { formatCurrency } from '../../lib/utils';
import { Plus, Minus, Trash2, ArrowRight, ShoppingBag, Sparkles, CheckCircle2 } from 'lucide-react';

export const CartDrawer: React.FC = () => {
  const {
    items,
    isOpen,
    closeCart,
    updateQuantity,
    removeItem,
    getSubtotal,
    getShipping,
    getTotal,
    getItemCount,
    syncWithBackend,
  } = useCartStore();

  React.useEffect(() => {
    if (isOpen) {
      syncWithBackend();
    }
  }, [isOpen]);

  const navigate = useNavigate();

  const subtotal = getSubtotal();
  const shipping = getShipping();
  const total = getTotal();
  const itemCount = getItemCount();

  const freeShippingThreshold = 5000;
  const progressPercent = Math.min(100, Math.round((subtotal / freeShippingThreshold) * 100));
  const remainingForFreeShipping = Math.max(0, freeShippingThreshold - subtotal);

  const handleCheckoutClick = () => {
    closeCart();
    navigate('/checkout');
  };

  const footerContent = items.length > 0 ? (
    <div className="space-y-4">
      {/* Price breakdown */}
      <div className="space-y-2 text-xs">
        <div className="flex justify-between text-text-secondary">
          <span>Subtotal</span>
          <span className="text-text-primary font-medium">{formatCurrency(subtotal)}</span>
        </div>
        <div className="flex justify-between text-text-secondary">
          <span>Express Delivery</span>
          <span>{shipping === 0 ? <span className="text-[#8AA48A] font-medium">Complimentary</span> : formatCurrency(shipping)}</span>
        </div>
        <div className="flex justify-between text-base font-semibold text-text-primary pt-2 border-t border-[#E6E2DA] dark:border-[#3E443D]">
          <span>Total</span>
          <span>{formatCurrency(total)}</span>
        </div>
      </div>

      {/* Checkout Button */}
      <Button
        variant="primary"
        size="md"
        className="w-full"
        onClick={handleCheckoutClick}
        rightIcon={<ArrowRight className="w-4 h-4" />}
      >
        Proceed to checkout
      </Button>

      <p className="text-[10px] text-center text-text-secondary">
        All taxes included. Complimentary returns and size exchanges within 15 days.
      </p>
    </div>
  ) : null;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={closeCart}
      side="right"
      width="md"
      title={`Your Shopping Bag (${itemCount})`}
      footer={footerContent}
    >
      <div className="space-y-6">
        
        {/* Free Shipping Progress Indicator */}
        {items.length > 0 && (
          <div className="p-3.5 bg-[#CFD8CF]/30 dark:bg-[#343833] rounded-2xl border border-[#8AA48A]/30 space-y-2">
            <div className="flex items-center justify-between text-xs">
              {remainingForFreeShipping > 0 ? (
                <span className="text-text-secondary">
                  Add <strong className="text-text-primary font-medium">{formatCurrency(remainingForFreeShipping)}</strong> more for complimentary delivery.
                </span>
              ) : (
                <span className="text-[#4A5B4A] dark:text-[#8AA48A] font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#8AA48A]" />
                  Unlocked complimentary express delivery
                </span>
              )}
              <span className="text-[11px] text-text-secondary font-medium">{progressPercent}%</span>
            </div>
            
            {/* Progress bar */}
            <div className="w-full h-1.5 bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#8AA48A] transition-all duration-500 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Item List */}
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-[#CFD8CF]/60 dark:bg-[#3E443D] flex items-center justify-center text-[#8AA48A]">
              <ShoppingBag className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xl font-serif text-text-primary font-normal">
                Your bag is waiting.
              </h4>
              <p className="text-xs sm:text-sm text-text-secondary font-light max-w-xs leading-relaxed">
                Discover pieces you'll want to live in.
              </p>
            </div>
            <div className="pt-3 flex flex-col gap-2.5 w-full max-w-xs">
              <Button
                variant="primary"
                size="md"
                className="w-full"
                onClick={() => {
                  closeCart();
                  navigate('/shop');
                }}
              >
                Explore collection
              </Button>
              <Button
                variant="secondary"
                size="md"
                className="w-full"
                leftIcon={<Sparkles className="w-3.5 h-3.5 text-[#8AA48A]" />}
                onClick={() => {
                  closeCart();
                  navigate('/agent');
                }}
              >
                Consult AI Stylist
              </Button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-[#E6E2DA]/80 dark:divide-[#3E443D]">
            {items.map((item) => (
              <div key={item.id} className="py-4 flex gap-4 first:pt-0">
                {/* Thumbnail */}
                <div className="w-20 aspect-[3/4] bg-stone-100 dark:bg-stone-800 rounded-xl overflow-hidden flex-shrink-0 border border-[#E6E2DA] dark:border-[#3E443D]">
                  <img
                    src={item.product.imageUrl}
                    alt={item.product.name}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Details */}
                <div className="flex-1 flex flex-col justify-between">
                  <div className="space-y-1">
                    <div className="flex justify-between items-start gap-2">
                      <Link
                        to={`/product/${item.product.id}`}
                        onClick={closeCart}
                        className="text-xs font-medium text-text-primary hover:text-[#8AA48A] transition-colors line-clamp-1"
                      >
                        {item.product.name}
                      </Link>
                      <button
                        onClick={() => removeItem(item.id)}
                        aria-label="Remove item"
                        className="text-text-secondary hover:text-red-500 transition-colors p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-text-secondary">
                      <span>{item.selectedColor}</span>
                      <span>•</span>
                      <span>Size: {item.selectedSize}</span>
                    </div>

                    <p className="text-xs font-semibold text-text-primary">
                      {formatCurrency(item.unitPrice)}
                    </p>
                  </div>

                  {/* Quantity Stepper */}
                  <div className="flex items-center gap-3 pt-2">
                    <div className="flex items-center border border-[#E6E2DA] dark:border-[#3E443D] rounded-full bg-surface">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="p-1.5 text-text-secondary hover:text-text-primary transition-colors"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="px-2 text-xs font-medium text-text-primary select-none">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="p-1.5 text-text-secondary hover:text-text-primary transition-colors"
                        aria-label="Increase quantity"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </Drawer>
  );
};
