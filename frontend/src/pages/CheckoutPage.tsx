import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PageContainer } from '../components/common/PageContainer';
import { Button } from '../components/common/Button';
import { useCartStore } from '../stores/cartStore';
import { useAuthStore } from '../stores/authStore';
import { formatCurrency } from '../lib/utils';
import { api } from '../services/api';
import { getSessionId } from '../lib/session';
import {
  CheckCircle2,
  ShieldCheck,
  Lock,
  ArrowRight,
  Sparkles,
  ShoppingBag,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Truck,
  User,
  AlertCircle,
  RefreshCw,
  X,
  Package,
} from 'lucide-react';
import { AuthModal } from '../components/auth/AuthModal';

export const CheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const { user: authUser, isLoggedIn } = useAuthStore();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const { items, getSubtotal, getShipping, getTotal, clearCart, syncWithBackend } = useCartStore();

  React.useEffect(() => {
    syncWithBackend();
  }, []);

  const subtotal = getSubtotal();
  const shipping = getShipping();
  const total = getTotal();

  // Form State - Derived from authenticated user if available, otherwise empty
  const [formData, setFormData] = useState({
    fullName: authUser?.name || '',
    email: authUser?.email || '',
    phone: authUser?.phone || '',
    address: '',
    city: '',
    state: '',
    postalCode: '',
    paymentMethod: 'card',
  });

  // Sync with auth user and load saved delivery address if available
  React.useEffect(() => {
    if (authUser && isLoggedIn) {
      setFormData((prev) => ({
        ...prev,
        fullName: authUser.name || '',
        email: authUser.email || '',
        phone: authUser.phone || '',
      }));

      // Load saved customer addresses strictly for this authenticated customer
      api.getCustomerAddresses().then((res) => {
        if (res.success && Array.isArray(res.addresses) && res.addresses.length > 0) {
          const defaultAddr = res.addresses.find((a: any) => a.isDefault) || res.addresses[0];
          setFormData((prev) => ({
            ...prev,
            fullName: defaultAddr.name || authUser.name || '',
            phone: defaultAddr.phone || authUser.phone || '',
            address: defaultAddr.addressLine || '',
            city: defaultAddr.city || '',
            state: defaultAddr.state || '',
            postalCode: defaultAddr.postalCode || '',
          }));
        }
      }).catch(() => {});
    } else {
      // Clear all customer details when logged out or switching accounts
      setFormData({
        fullName: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        postalCode: '',
        paymentMethod: 'card',
      });
    }
  }, [authUser, isLoggedIn]);

  // UI States
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [paymentId, setPaymentId] = useState('');
  const [completedOrderItems, setCompletedOrderItems] = useState<typeof items>([]);
  const [completedTotal, setCompletedTotal] = useState(0);
  const [completedAddress, setCompletedAddress] = useState('');

  // Payment Error State (In-App, No browser alerts)
  const [paymentError, setPaymentError] = useState<{ title: string; message: string } | null>(null);

  // In-App Razorpay Test Mode Modal State
  const [isTestModeModalOpen, setIsTestModeModalOpen] = useState(false);
  const [activePaymentOrder, setActivePaymentOrder] = useState<{
    localOrderId: string;
    razorpayOrderId: string;
    amount: number;
    currency: string;
    key: string;
  } | null>(null);
  const [selectedTestMethod, setSelectedTestMethod] = useState<'card' | 'upi' | 'netbanking'>('card');
  const [isAuthorizingTestPayment, setIsAuthorizingTestPayment] = useState(false);

  // Mobile Order Summary Collapsible State
  const [isMobileSummaryOpen, setIsMobileSummaryOpen] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [shakeForm, setShakeForm] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (formErrors[e.target.name]) {
      setFormErrors({ ...formErrors, [e.target.name]: '' });
    }
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.fullName.trim()) errors.fullName = 'Full name is required';
    if (!formData.email.trim() || !/\S+@\S+\.\S+/.test(formData.email)) errors.email = 'Valid email is required';
    if (!formData.phone.trim()) errors.phone = 'Phone number is required';
    if (!formData.address.trim()) errors.address = 'Street address is required';
    if (!formData.city.trim()) errors.city = 'City is required';
    if (!formData.state.trim()) errors.state = 'State is required';
    if (!formData.postalCode.trim()) errors.postalCode = 'Postal code is required';

    return errors;
  };

  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if ((window as any).Razorpay) return resolve(true);
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleExecuteTestAuthorization = async () => {
    if (!activePaymentOrder || isAuthorizingTestPayment) return;
    setIsAuthorizingTestPayment(true);
    setPaymentError(null);

    const sid = getSessionId();
    const testPayId = `pay_test_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const testSig = `mock_sig_${Date.now()}_vastra_test`;

    try {
      const verifyRes = await api.verifyPayment({
        orderId: activePaymentOrder.localOrderId,
        razorpay_order_id: activePaymentOrder.razorpayOrderId,
        razorpay_payment_id: testPayId,
        razorpay_signature: testSig,
        sessionId: sid,
      });

      if (verifyRes.success) {
        setOrderId(activePaymentOrder.localOrderId);
        setPaymentId(testPayId);
        setCompletedOrderItems([...items]);
        setCompletedTotal(total);
        setCompletedAddress(`${formData.address}, ${formData.city}, ${formData.state} - ${formData.postalCode}`);
        setIsTestModeModalOpen(false);
        setIsCompleted(true);
        clearCart();
      } else {
        setIsTestModeModalOpen(false);
        setPaymentError({
          title: "Payment wasn't completed.",
          message: verifyRes.message || 'Payment signature verification was declined by the server.',
        });
      }
    } catch (verifyErr: any) {
      setIsTestModeModalOpen(false);
      setPaymentError({
        title: "Payment wasn't completed.",
        message: verifyErr?.response?.data?.message || 'Payment verification could not be completed.',
      });
    } finally {
      setIsAuthorizingTestPayment(false);
      setIsProcessing(false);
    }
  };

  const handleCancelTestModal = async () => {
    if (activePaymentOrder?.localOrderId) {
      try {
        await api.cancelPayment({
          orderId: activePaymentOrder.localOrderId,
          reason: 'User dismissed test payment modal',
        });
      } catch (err) {
        console.warn('[Checkout] Cancel payment logged:', err);
      }
    }
    setIsTestModeModalOpen(false);
    setIsProcessing(false);
    setPaymentError({
      title: "Payment wasn't completed.",
      message: 'Checkout was cancelled before completion. Your garments remain safe in your bag.',
    });
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentError(null);

    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      setShakeForm(true);
      setTimeout(() => setShakeForm(false), 500);
      return;
    }

    if (isProcessing) return; // Prevent duplicate submissions
    setIsProcessing(true);

    try {
      const sid = getSessionId();
      // 1. Create Local Order on Backend
      const orderPayload = {
        channel: 'human' as const,
        sessionId: sid,
        customerId: authUser?.id || undefined,
        items: items.map((i) => ({
          productId: i.product.id,
          quantity: i.quantity,
          size: i.selectedSize,
          color: i.selectedColor,
        })),
        confirmed: true,
        customerInfo: {
          customerId: authUser?.id || undefined,
          name: formData.fullName,
          email: formData.email,
          phone: formData.phone,
          address: `${formData.address}, ${formData.city}, ${formData.state} - ${formData.postalCode}`,
          city: formData.city,
          state: formData.state,
          postalCode: formData.postalCode,
        },
      };

      const createOrderRes = await api.createOrder(orderPayload);
      if (!createOrderRes.success || !createOrderRes.order?.id) {
        throw new Error(createOrderRes.message || 'Failed to create order on server');
      }

      const localOrderId = createOrderRes.order.id;

      // 2. Create Razorpay Order in Paise on Backend
      const paymentOrder = await api.createPaymentOrder(localOrderId, sid);

      const rzpKey = paymentOrder.key || import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_vastra_dev';

      // 3. If dev/test key or standalone mode, open the In-App Razorpay Test Modal
      if (rzpKey.includes('vastra_dev') || !rzpKey.startsWith('rzp_test_')) {
        setActivePaymentOrder({
          localOrderId,
          razorpayOrderId: paymentOrder.razorpayOrderId,
          amount: paymentOrder.amount,
          currency: paymentOrder.currency || 'INR',
          key: rzpKey,
        });
        setIsTestModeModalOpen(true);
        return;
      }

      // 4. If live test credentials exist, load Razorpay Script
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        // Fallback to In-App Test Mode Modal
        setActivePaymentOrder({
          localOrderId,
          razorpayOrderId: paymentOrder.razorpayOrderId,
          amount: paymentOrder.amount,
          currency: paymentOrder.currency || 'INR',
          key: rzpKey,
        });
        setIsTestModeModalOpen(true);
        return;
      }

      const options = {
        key: rzpKey,
        amount: paymentOrder.amount,
        currency: paymentOrder.currency || 'INR',
        name: 'Vastra.AI',
        description: 'Luxury Handcrafted Fashion Order',
        image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=128&q=80',
        order_id: paymentOrder.razorpayOrderId,
        handler: async function (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) {
          try {
            const verifyRes = await api.verifyPayment({
              orderId: localOrderId,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              sessionId: sid,
            });

            if (verifyRes.success) {
              setOrderId(localOrderId);
              setPaymentId(response.razorpay_payment_id);
              setCompletedOrderItems([...items]);
              setCompletedTotal(total);
              setCompletedAddress(`${formData.address}, ${formData.city}, ${formData.state} - ${formData.postalCode}`);
              setIsCompleted(true);
              clearCart();
            } else {
              setPaymentError({
                title: "Payment wasn't completed.",
                message: verifyRes.message || 'Payment signature verification was declined by the server.',
              });
            }
          } catch (verifyErr: any) {
            setPaymentError({
              title: "Payment wasn't completed.",
              message: verifyErr?.response?.data?.message || 'Payment verification could not be completed.',
            });
          } finally {
            setIsProcessing(false);
          }
        },
        prefill: {
          name: formData.fullName,
          email: formData.email,
          contact: formData.phone,
        },
        theme: {
          color: '#343833',
        },
        modal: {
          ondismiss: function () {
            setIsProcessing(false);
            setPaymentError({
              title: "Payment wasn't completed.",
              message: 'Checkout was cancelled before completion. Your garments remain safe in your bag.',
            });
          },
        },
      };

      try {
        const rzp = new (window as any).Razorpay(options);
        rzp.on('payment.failed', function () {
          setIsProcessing(false);
          // Offer in-app test mode fallback
          setActivePaymentOrder({
            localOrderId,
            razorpayOrderId: paymentOrder.razorpayOrderId,
            amount: paymentOrder.amount,
            currency: paymentOrder.currency || 'INR',
            key: rzpKey,
          });
          setIsTestModeModalOpen(true);
        });

        rzp.open();
      } catch (sdkErr) {
        console.warn('[Checkout] Razorpay SDK open fallback to test modal:', sdkErr);
        setActivePaymentOrder({
          localOrderId,
          razorpayOrderId: paymentOrder.razorpayOrderId,
          amount: paymentOrder.amount,
          currency: paymentOrder.currency || 'INR',
          key: rzpKey,
        });
        setIsTestModeModalOpen(true);
      }
    } catch (err: any) {
      console.error('[Checkout] Payment initialization error:', err);
      setIsProcessing(false);
      setPaymentError({
        title: "Payment wasn't completed.",
        message: err?.response?.data?.message || err?.message || 'An unexpected error occurred while initiating checkout.',
      });
    }
  };

  // 1. ORDER CONFIRMATION SCREEN
  if (isCompleted) {
    return (
      <PageContainer size="md" className="py-16 md:py-24">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="max-w-2xl mx-auto p-8 sm:p-12 rounded-3xl bg-[#FCFCF9] dark:bg-[#343833] border border-[#E6E2DA] dark:border-[#3E443D] shadow-soft space-y-8"
        >
          {/* Success Checkmark in Sage Green */}
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-[#7B876F]/20 text-[#7B876F] flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div className="space-y-1">
              <span className="text-xs uppercase tracking-widest text-[#7B876F] font-semibold">
                Order Confirmed & Payment Verified
              </span>
              <h1 className="text-2xl sm:text-3xl font-serif text-text-primary font-normal">
                Your order is confirmed.
              </h1>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2 text-xs font-mono text-text-secondary">
                <span>Order ID: <strong className="text-text-primary">{orderId}</strong></span>
                {paymentId && <span>• Payment ID: <strong className="text-text-primary">{paymentId}</strong></span>}
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-surface border border-[#E6E2DA] dark:border-[#3E443D] text-xs space-y-2 text-text-secondary font-light leading-relaxed">
            <p>
              A confirmation and master artisan provenance certificate has been dispatched to <strong>{formData.email}</strong>.
            </p>
            <p className="flex items-center gap-1.5 text-text-primary font-medium">
              <Truck className="w-3.5 h-3.5 text-[#8AA48A]" />
              <span>Estimated Delivery: 3–5 business days • Signature white-glove dispatch to {completedAddress}</span>
            </p>
          </div>

          {/* Ordered Items Summary */}
          <div className="space-y-3">
            <h3 className="text-xs uppercase tracking-widest font-semibold text-text-primary pb-2 border-b border-[#E6E2DA] dark:border-[#3E443D]">
              Purchased Garments ({completedOrderItems.length})
            </h3>
            <div className="divide-y divide-[#E6E2DA]/60 dark:divide-[#3E443D] max-h-60 overflow-y-auto pr-1">
              {completedOrderItems.map((item) => (
                <div key={item.id} className="py-3 flex gap-3 first:pt-0 items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src={item.product.imageUrl}
                      alt={item.product.name}
                      className="w-12 aspect-[3/4] object-cover rounded-lg border border-[#E6E2DA] dark:border-[#3E443D]"
                    />
                    <div className="text-xs space-y-0.5">
                      <p className="font-medium text-text-primary">{item.product.name}</p>
                      <p className="text-text-secondary">{item.selectedColor} • Size: {item.selectedSize} • Qty: {item.quantity}</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-text-primary">
                    {formatCurrency(item.unitPrice * item.quantity)}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex justify-between text-sm font-semibold text-text-primary pt-3 border-t border-[#E6E2DA] dark:border-[#3E443D]">
              <span>Total Paid</span>
              <span className="text-base">{formatCurrency(completedTotal)}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              variant="primary"
              size="md"
              className="w-full sm:w-auto"
              onClick={() => navigate('/shop')}
            >
              Continue shopping
            </Button>
            <Button
              variant="secondary"
              size="md"
              className="w-full sm:w-auto flex items-center gap-1.5"
              onClick={() => navigate('/orders')}
            >
              <Package className="w-4 h-4 text-[#8AA48A]" />
              <span>View Orders</span>
            </Button>
            <Button
              variant="outline"
              size="md"
              className="w-full sm:w-auto"
              leftIcon={<Sparkles className="w-4 h-4 text-[#8AA48A]" />}
              onClick={() => navigate('/agent')}
            >
              Styling Notes
            </Button>
          </div>
        </motion.div>
      </PageContainer>
    );
  }

  // 1b. CHECKOUT AUTHENTICATION GATE SCREEN
  if (!isLoggedIn || !authUser) {
    return (
      <PageContainer size="md" className="py-20 md:py-28">
        <div className="max-w-md mx-auto p-8 sm:p-10 rounded-3xl bg-[#FCFCF9] dark:bg-[#343833] border border-[#E6E2DA] dark:border-[#3E443D] shadow-soft text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-[#8AA48A]/15 text-[#8AA48A] flex items-center justify-center mx-auto">
            <Lock className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <span className="text-xs uppercase tracking-widest text-[#8AA48A] font-semibold">
              Authenticated Checkout
            </span>
            <h1 className="text-2xl sm:text-3xl font-serif text-text-primary font-normal">
              Please sign in to continue to checkout.
            </h1>
            <p className="text-xs text-text-secondary leading-relaxed font-light">
              Sign in to your Vastra.AI customer account to complete your purchase, access your saved delivery addresses, and securely track your bespoke artisan garments.
            </p>
          </div>
          <div className="pt-2">
            <Button
              variant="primary"
              size="lg"
              className="w-full justify-center"
              onClick={() => setIsAuthModalOpen(true)}
            >
              Sign In to Continue
            </Button>
          </div>
        </div>
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
        />
      </PageContainer>
    );
  }

  // 2. EMPTY BAG SCREEN
  if (items.length === 0) {
    return (
      <PageContainer size="sm" className="py-20 text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-[#CFD8CF]/60 dark:bg-[#3E443D] flex items-center justify-center text-[#8AA48A] mx-auto">
          <ShoppingBag className="w-7 h-7" />
        </div>
        <h2 className="text-2xl font-serif text-text-primary font-normal">
          Your bag is waiting.
        </h2>
        <p className="text-xs sm:text-sm text-text-secondary leading-relaxed font-light">
          Discover pieces you'll want to live in.
        </p>
        <Button variant="primary" size="md" onClick={() => navigate('/shop')}>
          Explore collection
        </Button>
      </PageContainer>
    );
  }

  // 3. MAIN CHECKOUT WORKFLOW
  return (
    <div className="py-10 md:py-16 space-y-10">
      <PageContainer>
        
        {/* Header */}
        <div className="text-center pb-8 border-b border-[#E6E2DA] dark:border-[#3E443D]">
          <h1 className="text-3xl font-serif text-text-primary font-normal">
            Atelier Checkout
          </h1>
          <p className="text-xs uppercase tracking-widest text-[#8AA48A] mt-1 font-medium">
            Secure 256-Bit Encrypted Razorpay Gateway
          </p>
        </div>

        {/* Premium Payment Error Card */}
        <AnimatePresence>
          {paymentError && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-4xl mx-auto p-5 rounded-2xl bg-[#FCF7F7] dark:bg-[#3D3030] border border-[#E8C5C5] dark:border-[#6B4747] space-y-3"
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-[#B85D5D] shrink-0 mt-0.5" />
                <div className="space-y-1 flex-1">
                  <h3 className="text-sm font-semibold text-[#8B2D2D] dark:text-[#E8A5A5]">
                    {paymentError.title}
                  </h3>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    {paymentError.message}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 pt-2 pl-8">
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                  onClick={(e) => handlePayment(e as any)}
                >
                  Try Again
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate('/shop')}
                >
                  Return to Cart
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mobile Collapsible Order Summary Bar */}
        <div className="lg:hidden p-4 bg-[#FCFCF9] dark:bg-[#343833] border border-[#E6E2DA] dark:border-[#3E443D] rounded-2xl shadow-subtle space-y-3">
          <button
            type="button"
            className="w-full flex items-center justify-between text-left"
            onClick={() => setIsMobileSummaryOpen(!isMobileSummaryOpen)}
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-text-primary">
              <ShoppingBag className="w-4 h-4 text-[#8AA48A]" />
              <span>{isMobileSummaryOpen ? 'Hide Order Summary' : 'Show Order Summary'}</span>
              <span className="text-text-secondary font-normal">({items.length} items)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-text-primary">{formatCurrency(total)}</span>
              {isMobileSummaryOpen ? <ChevronUp className="w-4 h-4 text-text-secondary" /> : <ChevronDown className="w-4 h-4 text-text-secondary" />}
            </div>
          </button>

          <AnimatePresence>
            {isMobileSummaryOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden space-y-3 pt-3 border-t border-[#E6E2DA] dark:border-[#3E443D]"
              >
                <div className="divide-y divide-[#E6E2DA]/60 dark:divide-[#3E443D] max-h-60 overflow-y-auto">
                  {items.map((item) => (
                    <div key={item.id} className="py-2.5 flex gap-3 first:pt-0">
                      <img
                        src={item.product.imageUrl}
                        alt={item.product.name}
                        className="w-12 aspect-[3/4] object-cover rounded-lg border border-[#E6E2DA]"
                      />
                      <div className="flex-1 text-xs space-y-0.5">
                        <p className="font-medium text-text-primary line-clamp-1">{item.product.name}</p>
                        <p className="text-text-secondary">{item.selectedColor} • Size: {item.selectedSize} • Qty: {item.quantity}</p>
                      </div>
                      <span className="text-xs font-medium text-text-primary">
                        {formatCurrency(item.unitPrice * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="space-y-1.5 pt-2 border-t border-[#E6E2DA] dark:border-[#3E443D] text-xs">
                  <div className="flex justify-between text-text-secondary">
                    <span>Subtotal</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-text-secondary">
                    <span>Shipping</span>
                    <span>{shipping === 0 ? 'Complimentary' : formatCurrency(shipping)}</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 2-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Form & Payment Gateway Info */}
          <motion.form
            animate={shakeForm ? { x: [-10, 10, -10, 10, 0] } : {}}
            transition={{ duration: 0.4 }}
            onSubmit={handlePayment}
            className="lg:col-span-7 space-y-8"
          >
            {/* Section 1: Customer Contact & Dispatch Address */}
            <div className="p-6 bg-[#FCFCF9] dark:bg-[#343833] border border-[#E6E2DA] dark:border-[#3E443D] rounded-3xl space-y-5 shadow-subtle">
              <div className="flex items-center justify-between pb-3 border-b border-[#E6E2DA] dark:border-[#3E443D]">
                <h2 className="text-xs uppercase tracking-widest font-semibold text-text-primary flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-[#8AA48A]" />
                  <span>1. Contact & White-Glove Dispatch</span>
                </h2>
                <span className="text-[10px] text-text-secondary">Dispatched within 24 hours</span>
              </div>

              <div className="space-y-4 text-xs">
                {/* Full Name */}
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest text-text-secondary font-medium">Full Name</label>
                  <div className="relative">
                    <input
                      type="text"
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleChange}
                      placeholder="e.g. Aarav Mehta"
                      className={`w-full bg-surface border rounded-full px-4 py-2.5 text-xs text-text-primary focus:outline-none transition-colors ${
                        formErrors.fullName ? 'border-red-500' : 'border-[#E6E2DA] dark:border-[#3E443D] focus:border-[#8AA48A]'
                      }`}
                    />
                  </div>
                  {formErrors.fullName && <p className="text-[10px] text-red-500 pl-3">{formErrors.fullName}</p>}
                </div>

                {/* Email & Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-widest text-text-secondary font-medium">Email Address</label>
                    <div className="relative">
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="client@domain.com"
                        className={`w-full bg-surface border rounded-full px-4 py-2.5 text-xs text-text-primary focus:outline-none transition-colors ${
                          formErrors.email ? 'border-red-500' : 'border-[#E6E2DA] dark:border-[#3E443D] focus:border-[#8AA48A]'
                        }`}
                      />
                    </div>
                    {formErrors.email && <p className="text-[10px] text-red-500 pl-3">{formErrors.email}</p>}
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-widest text-text-secondary font-medium">Phone Number</label>
                    <div className="relative">
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        placeholder="+91 98200 12345"
                        className={`w-full bg-surface border rounded-full px-4 py-2.5 text-xs text-text-primary focus:outline-none transition-colors ${
                          formErrors.phone ? 'border-red-500' : 'border-[#E6E2DA] dark:border-[#3E443D] focus:border-[#8AA48A]'
                        }`}
                      />
                    </div>
                    {formErrors.phone && <p className="text-[10px] text-red-500 pl-3">{formErrors.phone}</p>}
                  </div>
                </div>

                {/* Street Address */}
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest text-text-secondary font-medium">Street Address</label>
                  <div className="relative">
                    <input
                      type="text"
                      name="address"
                      value={formData.address}
                      onChange={handleChange}
                      placeholder="Suite, apartment, street address"
                      className={`w-full bg-surface border rounded-full px-4 py-2.5 text-xs text-text-primary focus:outline-none transition-colors ${
                        formErrors.address ? 'border-red-500' : 'border-[#E6E2DA] dark:border-[#3E443D] focus:border-[#8AA48A]'
                      }`}
                    />
                  </div>
                  {formErrors.address && <p className="text-[10px] text-red-500 pl-3">{formErrors.address}</p>}
                </div>

                {/* City, State, Postal Code */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-widest text-text-secondary font-medium">City</label>
                    <input
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      placeholder="Mumbai"
                      className={`w-full bg-surface border rounded-full px-3.5 py-2 text-xs text-text-primary focus:outline-none ${
                        formErrors.city ? 'border-red-500' : 'border-[#E6E2DA] dark:border-[#3E443D]'
                      }`}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-widest text-text-secondary font-medium">State</label>
                    <input
                      type="text"
                      name="state"
                      value={formData.state}
                      onChange={handleChange}
                      placeholder="Maharashtra"
                      className={`w-full bg-surface border rounded-full px-3.5 py-2 text-xs text-text-primary focus:outline-none ${
                        formErrors.state ? 'border-red-500' : 'border-[#E6E2DA] dark:border-[#3E443D]'
                      }`}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-widest text-text-secondary font-medium">Postal Code</label>
                    <input
                      type="text"
                      name="postalCode"
                      value={formData.postalCode}
                      onChange={handleChange}
                      placeholder="400001"
                      className={`w-full bg-surface border rounded-full px-3.5 py-2 text-xs text-text-primary focus:outline-none ${
                        formErrors.postalCode ? 'border-red-500' : 'border-[#E6E2DA] dark:border-[#3E443D]'
                      }`}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Razorpay Payment Gateway Information */}
            <div className="p-6 bg-[#FCFCF9] dark:bg-[#343833] border border-[#E6E2DA] dark:border-[#3E443D] rounded-3xl space-y-4 shadow-subtle">
              <div className="flex items-center justify-between pb-3 border-b border-[#E6E2DA] dark:border-[#3E443D]">
                <h2 className="text-xs uppercase tracking-widest font-semibold text-text-primary flex items-center gap-2">
                  <CreditCard className="w-3.5 h-3.5 text-[#8AA48A]" />
                  <span>2. Payment Method</span>
                </h2>
                <div className="flex items-center gap-1 text-[11px] text-[#8AA48A]">
                  <Lock className="w-3 h-3" />
                  <span>Razorpay Test Mode</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-surface border border-[#E6E2DA] dark:border-[#3E443D] space-y-2 text-xs text-text-secondary">
                <div className="flex items-center justify-between text-text-primary font-medium">
                  <span>Razorpay Secure Test Checkout</span>
                  <span className="text-[10px] bg-[#8AA48A]/10 text-[#8AA48A] px-2 py-0.5 rounded-full font-mono uppercase">
                    Test Mode
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  Upon clicking <strong>Authorize & Place Order</strong>, the Razorpay Checkout popup will open to securely collect your test card, UPI, or NetBanking details. No real money will be charged.
                </p>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                isLoading={isProcessing}
                disabled={isProcessing}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                {isProcessing ? 'Initializing Razorpay...' : `Authorize & Place Order (${formatCurrency(total)})`}
              </Button>
            </div>
          </motion.form>

          {/* Right Column: Desktop Order Summary */}
          <div className="hidden lg:block lg:col-span-5 space-y-6 sticky top-28 self-start">
            <div className="p-6 bg-[#FCFCF9] dark:bg-[#343833] border border-[#E6E2DA] dark:border-[#3E443D] rounded-3xl space-y-6 shadow-subtle">
              <h2 className="text-xs uppercase tracking-widest font-semibold text-text-primary pb-3 border-b border-[#E6E2DA] dark:border-[#3E443D]">
                Order Summary ({items.length} {items.length === 1 ? 'Garment' : 'Garments'})
              </h2>

              {/* Items List */}
              <div className="divide-y divide-[#E6E2DA]/60 dark:divide-[#3E443D] max-h-80 overflow-y-auto pr-1">
                {items.map((item) => (
                  <div key={item.id} className="py-3 flex gap-3 first:pt-0">
                    <img
                      src={item.product.imageUrl}
                      alt={item.product.name}
                      className="w-14 aspect-[3/4] object-cover rounded-xl border border-[#E6E2DA]"
                    />
                    <div className="flex-1 text-xs space-y-0.5">
                      <h4 className="font-medium text-text-primary line-clamp-1">{item.product.name}</h4>
                      <p className="text-text-secondary">{item.selectedColor} • Size {item.selectedSize}</p>
                      <p className="text-text-secondary">Qty: {item.quantity}</p>
                    </div>
                    <span className="text-xs font-semibold text-text-primary">
                      {formatCurrency(item.unitPrice * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Price Calculation */}
              <div className="space-y-2 pt-4 border-t border-[#E6E2DA] dark:border-[#3E443D] text-xs">
                <div className="flex justify-between text-text-secondary">
                  <span>Subtotal</span>
                  <span className="text-text-primary font-medium">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-text-secondary">
                  <span>Express White-Glove Delivery</span>
                  <span>{shipping === 0 ? <span className="text-[#8AA48A] font-medium">Complimentary</span> : formatCurrency(shipping)}</span>
                </div>
                <div className="flex justify-between text-base font-semibold text-text-primary pt-3 border-t border-[#E6E2DA] dark:border-[#3E443D]">
                  <span>Total Due</span>
                  <span className="text-lg font-semibold">{formatCurrency(total)}</span>
                </div>
              </div>

              <div className="pt-2 text-[11px] text-text-secondary space-y-1 leading-relaxed border-t border-[#E6E2DA]/60 dark:border-[#3E443D]">
                <div className="flex items-center gap-1.5 text-[#8AA48A] font-medium">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Artisanal Authenticity & Traceability Guarantee</span>
                </div>
                <p>Includes bespoke cedar preservation box and personalized garment hanger.</p>
              </div>

            </div>
          </div>

        </div>

        {/* Razorpay In-App Test Mode Simulation Modal */}
        <AnimatePresence>
          {isTestModeModalOpen && activePaymentOrder && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                transition={{ duration: 0.2 }}
                className="w-full max-w-md bg-[#FCFCF9] dark:bg-[#2A2A2A] border border-[#E6E2DA] dark:border-[#3E443D] rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5"
              >
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-[#E6E2DA] dark:border-[#3E443D]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-[#8AA48A]/15 flex items-center justify-center text-[#8AA48A]">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-text-primary">Razorpay Checkout</span>
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px] font-mono font-bold">
                          TEST MODE
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-text-secondary">
                        {activePaymentOrder.razorpayOrderId}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={handleCancelTestModal}
                    className="p-1.5 rounded-full text-text-secondary hover:text-text-primary hover:bg-[#CFD8CF]/40 dark:hover:bg-[#3E443D] transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Amount Display */}
                <div className="p-4 rounded-2xl bg-[#CFD8CF]/20 dark:bg-[#343833] border border-[#8AA48A]/30 flex items-center justify-between">
                  <span className="text-xs text-text-secondary font-medium">Amount Due:</span>
                  <span className="text-xl font-bold font-display text-text-primary">
                    {formatCurrency(total)}
                  </span>
                </div>

                {/* Test Payment Method Selector */}
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-text-primary uppercase tracking-wider block">
                    Select Test Instrument:
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedTestMethod('card')}
                      className={`p-3 rounded-2xl border text-left transition-all ${
                        selectedTestMethod === 'card'
                          ? 'border-[#8AA48A] bg-[#8AA48A]/10 text-text-primary font-semibold'
                          : 'border-[#E6E2DA] dark:border-[#3E443D] text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      <div className="text-xs">💳 Test Card</div>
                      <div className="text-[10px] text-text-secondary font-mono mt-0.5">4111...1111</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedTestMethod('upi')}
                      className={`p-3 rounded-2xl border text-left transition-all ${
                        selectedTestMethod === 'upi'
                          ? 'border-[#8AA48A] bg-[#8AA48A]/10 text-text-primary font-semibold'
                          : 'border-[#E6E2DA] dark:border-[#3E443D] text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      <div className="text-xs">⚡ Test UPI</div>
                      <div className="text-[10px] text-text-secondary font-mono mt-0.5">vastra@upi</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedTestMethod('netbanking')}
                      className={`p-3 rounded-2xl border text-left transition-all ${
                        selectedTestMethod === 'netbanking'
                          ? 'border-[#8AA48A] bg-[#8AA48A]/10 text-text-primary font-semibold'
                          : 'border-[#E6E2DA] dark:border-[#3E443D] text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      <div className="text-xs">🏦 NetBanking</div>
                      <div className="text-[10px] text-text-secondary font-mono mt-0.5">HDFC Test</div>
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-text-secondary leading-relaxed">
                  This is a simulated Razorpay Test Mode checkout. No real money will be charged. Cryptographic signature will be verified by the backend server.
                </p>

                {/* Actions */}
                <div className="space-y-2 pt-1">
                  <Button
                    onClick={handleExecuteTestAuthorization}
                    variant="primary"
                    size="lg"
                    className="w-full justify-center bg-[#8AA48A] hover:bg-[#758E75] text-[#2A2A2A] font-semibold"
                    isLoading={isAuthorizingTestPayment}
                    disabled={isAuthorizingTestPayment}
                  >
                    {isAuthorizingTestPayment ? 'Verifying with Backend...' : `Authorize ${formatCurrency(total)} (Test Mode)`}
                  </Button>

                  <button
                    type="button"
                    onClick={handleCancelTestModal}
                    className="w-full py-2 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors text-center"
                  >
                    Cancel & Return to Bag
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </PageContainer>
    </div>
  );
};
