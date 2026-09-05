import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import type { AIMessage, CuratedLook, AISelectedItem } from '../types/ai';
import type { Product } from '../types/types';
import { INITIAL_AI_MESSAGES } from '../data/mockAIResponses';
import { api } from '../services/api';
import { useCartStore } from '../stores/cartStore';
import { formatCurrency } from '../lib/utils';
import { getSessionId } from '../lib/session';
import { CartDrawer } from '../components/layout/CartDrawer';
import {
  Sparkles,
  ArrowRight,
  ShoppingBag,
  CheckCircle2,
  CreditCard,
  AlertTriangle,
  Send,
  Layers,
  X,
  ShieldCheck,
  Lock,
  RefreshCw,
  Package,
  Truck,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { AuthModal } from '../components/auth/AuthModal';
import { ProductCard } from '../components/product/ProductCard';
import { SelectionTray } from '../components/ai/SelectionTray';
import { MultiProductConfigCard } from '../components/ai/MultiProductConfigCard';

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1000&q=85';

export const AgentPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const navigate = useNavigate();

  const [sessionId] = useState(() => getSessionId());

  // Shared Cart Store
  const { addItem, getTotal, getItemCount, openCart, clearCart, setCartFromBackend, syncWithBackend } = useCartStore();
  const total = getTotal();
  const itemCount = getItemCount();

  const [messages, setMessages] = useState<AIMessage[]>(INITIAL_AI_MESSAGES);
  const [inputValue, setInputValue] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingStep, setThinkingStep] = useState(0);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [agentStatus, setAgentStatus] = useState<'ready' | 'curating' | 'searching' | 'updating_bag'>('ready');

  // Multi-Product Visual Selection State
  const [selectedItems, setSelectedItems] = useState<AISelectedItem[]>(() => {
    try {
      const stored = sessionStorage.getItem('vastra_ai_selected_items');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [isConfiguringMulti, setIsConfiguringMulti] = useState(false);

  // Persist AI selection across in-session reloads or auth transitions
  useEffect(() => {
    try {
      sessionStorage.setItem('vastra_ai_selected_items', JSON.stringify(selectedItems));
    } catch {}
  }, [selectedItems]);

  // Selected variant state per product card (map of productId -> chosenSize)
  const [selectedSizes, setSelectedSizes] = useState<Record<string, string>>({});

  // Toast feedback
  const [toastNotice, setToastNotice] = useState<string | null>(null);

  // In-App Razorpay Gateway Modal State
  const [isTestModeModalOpen, setIsTestModeModalOpen] = useState(false);
  const [activePaymentOrder, setActivePaymentOrder] = useState<{
    localOrderId: string;
    razorpayOrderId: string;
    amount: number;
    currency: string;
    keyId: string;
    items: any[];
    totalAmount: number;
  } | null>(null);
  const [selectedTestMethod, setSelectedTestMethod] = useState<'card' | 'upi' | 'netbanking'>('card');
  const [isAuthorizingTestPayment, setIsAuthorizingTestPayment] = useState(false);

  // Customer Auth & Delivery Address Gating
  const { isLoggedIn, user } = useAuthStore();
  const [customerAddress, setCustomerAddress] = useState<any>(null);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Address form inputs
  const [addressForm, setAddressForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    addressLine: '',
    city: 'Bangalore',
    state: 'Karnataka',
    postalCode: '560038',
  });
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);

  // Load customer address on login
  useEffect(() => {
    if (isLoggedIn) {
      api.getCustomerAddresses().then((res) => {
        if (res.success && Array.isArray(res.addresses) && res.addresses.length > 0) {
          const def = res.addresses.find((a: any) => a.isDefault) || res.addresses[0];
          setCustomerAddress(def);
          setAddressForm({
            name: def.name || user?.name || '',
            phone: def.phone || user?.phone || '',
            addressLine: def.addressLine || '',
            city: def.city || 'Bangalore',
            state: def.state || 'Karnataka',
            postalCode: def.postalCode || '560038',
          });
        }
      }).catch(() => {});
    } else {
      setCustomerAddress(null);
    }
  }, [isLoggedIn, user]);

  // Customer account isolation: clear selection if an authenticated user logs out or switches accounts
  const prevUserIdRef = useRef<string | undefined>(user?.id);
  useEffect(() => {
    if (prevUserIdRef.current && prevUserIdRef.current !== user?.id) {
      setSelectedItems([]);
      try {
        sessionStorage.removeItem('vastra_ai_selected_items');
      } catch {}
    }
    prevUserIdRef.current = user?.id;
  }, [user?.id]);

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddressError(null);
    if (!addressForm.name.trim() || !addressForm.phone.trim() || !addressForm.addressLine.trim() || !addressForm.city.trim() || !addressForm.postalCode.trim()) {
      setAddressError('Please fill in all address fields (Name, Phone, Address, City, State, PIN).');
      return;
    }
    setIsSavingAddress(true);
    try {
      const res = await api.addCustomerAddress({
        name: addressForm.name,
        phone: addressForm.phone,
        addressLine: addressForm.addressLine,
        city: addressForm.city,
        state: addressForm.state,
        postalCode: addressForm.postalCode,
        isDefault: true,
      });
      if (res.success && res.address) {
        setCustomerAddress(res.address);
        setIsAddressModalOpen(false);
        showToast('Delivery address confirmed.');
      }
    } catch (err: any) {
      setAddressError(err?.response?.data?.message || 'Failed to save address.');
    } finally {
      setIsSavingAddress(false);
    }
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const thinkingPhrases = [
    'Exploring our handloom ateliers...',
    'Analyzing occasion, silhouette & fabrics...',
    'Checking artisan stock & sizes...',
    'Curating your personalized look...',
  ];

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking, scrollToBottom]);

  useEffect(() => {
    syncWithBackend(sessionId);
  }, [sessionId, syncWithBackend]);

  // Cycle thinking phrases during reasoning
  useEffect(() => {
    if (!isThinking) {
      setAgentStatus('ready');
      return;
    }
    setAgentStatus('curating');
    const interval = setInterval(() => {
      setThinkingStep((prev) => (prev + 1) % thinkingPhrases.length);
    }, 550);
    return () => clearInterval(interval);
  }, [isThinking, thinkingPhrases.length]);

  const showToast = (message: string) => {
    setToastNotice(message);
    setTimeout(() => setToastNotice(null), 3200);
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

  const handleSendMessage = useCallback(async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isThinking) return;

    // Check for explicit customer action to transition from AI to manual storefront
    const lower = text.toLowerCase();
    if (
      lower.includes('shop manually') ||
      lower.includes('continue without ai') ||
      lower.includes('switch to manual') ||
      lower.includes('manual shopping') ||
      lower.includes('take me to the product page') ||
      lower.includes('take me to the shop')
    ) {
      showToast('Switching to manual storefront...');
      setTimeout(() => {
        navigate('/shop');
      }, 400);
      return;
    }

    const userMsg: AIMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setIsThinking(true);
    setThinkingStep(0);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      const responseData = await api.sendAgentMessage(text, sessionId, {
        customerId: user?.id,
        customerInfo: user
          ? {
              customerId: user.id,
              name: user.name,
              email: user.email,
              phone: user.phone,
            }
          : undefined,
        shippingAddress: customerAddress,
        selectedProductIds: selectedItems.map((i) => i.productId),
        selectedItems: selectedItems.map((i) => ({
          productId: i.productId,
          size: i.size,
          color: i.color,
          quantity: i.quantity,
        })),
      });

      // Synchronize shared cart store immediately if agent executed cart actions
      if (responseData.cart) {
        setCartFromBackend(responseData.cart);
      }

      // Synchronize selected items if agent updated selection
      if (Array.isArray(responseData.selectedProductIds)) {
        const pool = [
          ...(responseData.products || []),
          ...messages.flatMap((m) => m.recommendedProducts || []),
        ];
        setSelectedItems((prev) => {
          const updated: AISelectedItem[] = [];
          for (const pid of responseData.selectedProductIds!) {
            const existing = prev.find((it) => it.productId === pid);
            if (existing) {
              updated.push(existing);
            } else {
              const found = pool.find((p) => p.id === pid);
              if (found) {
                updated.push({
                  productId: found.id,
                  product: found,
                  size: selectedSizes[found.id] || found.sizes[0] || 'M',
                  color: found.colors[0] || 'Default',
                  quantity: 1,
                });
              }
            }
          }
          return updated;
        });
      }

      // If backend guardrail indicates login is required, trigger AuthModal
      if (responseData.requireLogin || responseData.requiresAuth || responseData.actions?.includes('require_login')) {
        setIsAuthModalOpen(true);
      }

      // If backend guardrail indicates delivery address is required, trigger AddressModal
      if (responseData.requireAddress || responseData.actions?.includes('require_address')) {
        setIsAddressModalOpen(true);
      }

      // If backend indicates manual transition, switch to /shop
      if (responseData.actions?.includes('switch_to_manual')) {
        showToast('Switching to manual storefront...');
        setTimeout(() => {
          navigate('/shop');
        }, 500);
      }

      // If address was extracted and saved from chat, update local state
      if (responseData.shippingAddress && !customerAddress) {
        setCustomerAddress(responseData.shippingAddress);
      }

      let completeTheLookProduct: Product | undefined = undefined;
      if (responseData.upsell && responseData.upsell.productId) {
        completeTheLookProduct = responseData.products?.find((p: Product) => p.id === responseData.upsell.productId);
      }

      const agentMsg: AIMessage = {
        id: `agent-${Date.now()}`,
        sender: 'agent',
        content: responseData.message,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        recommendedProducts: responseData.products || [],
        matchReasons: responseData.matchReasons,
        curatedLook: responseData.curatedLook,
        selectedProductIds: responseData.selectedProductIds,
        clarificationOptions: responseData.clarificationOptions,
        completeTheLook: completeTheLookProduct
          ? {
              product: completeTheLookProduct,
              note: responseData.upsell?.message || 'This handcrafted piece complements your silhouette.',
            }
          : undefined,
        checkout: responseData.checkout,
        suggestedPrompts: responseData.checkout?.ready
          ? ['What is in my bag?', 'Cancel order review']
          : responseData.curatedLook
          ? ['Add look to my bag', 'Something more formal', 'Show me under ₹5,000']
          : ['Show me size M', 'Which one do you recommend?', 'Buy the item in my bag'],
      };

      setMessages((prev) => [...prev, agentMsg]);
    } catch (err: any) {
      console.error('[AgentPage] Error calling agent message API:', err);
      const fallbackMsg: AIMessage = {
        id: `agent-${Date.now()}`,
        sender: 'agent',
        content: "I'm having trouble reaching the collection right now. Please try again in a moment.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsThinking(false);
    }
  }, [inputValue, isThinking, sessionId, setCartFromBackend, user, customerAddress, selectedItems, messages, selectedSizes]);

  // Handle initial query from URL
  useEffect(() => {
    if (initialQuery && messages.length === 1) {
      handleSendMessage(initialQuery);
    }
  }, [initialQuery, handleSendMessage, messages.length]);

  const handlePromptClick = (prompt: string) => {
    handleSendMessage(prompt);
  };

  const handleSelectSize = (productId: string, size: string) => {
    setSelectedSizes((prev) => ({ ...prev, [productId]: size }));
  };

  const handleAddIndividualItem = (product: Product, size?: string, color?: string) => {
    const chosenSize = size || selectedSizes[product.id] || product.sizes[0] || 'M';
    const chosenColor = color || product.colors[0] || 'Default';
    addItem(product, chosenColor, chosenSize, 1, { openDrawer: false, channel: 'agent' });
    showToast(`Added "${product.name}" (${chosenSize}) to your bag.`);
    const confirmMsg: AIMessage = {
      id: `agent-${Date.now()}`,
      sender: 'agent',
      content: `I've added the ${product.name} (${chosenSize} / ${chosenColor}) to your shopping bag. Would you like to continue shopping or proceed to checkout?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      suggestedPrompts: ['Proceed to checkout', 'Continue shopping', 'What is in my bag?'],
    };
    setMessages((prev) => [...prev, confirmMsg]);
  };

  const handleAddCuratedLook = (look: CuratedLook) => {
    handleSendMessage(`Add the look "${look.title}" to my bag`);
    showToast(`Added both pieces from "${look.title}" to your bag.`);
  };

  const handleToggleSelectProduct = (product: Product) => {
    setSelectedItems((prev) => {
      const exists = prev.some((item) => item.productId === product.id);
      if (exists) {
        return prev.filter((item) => item.productId !== product.id);
      } else {
        const defaultSize = selectedSizes[product.id] || product.sizes[0] || 'M';
        const defaultColor = product.colors[0] || 'Default';
        return [
          ...prev,
          {
            productId: product.id,
            product,
            size: defaultSize,
            color: defaultColor,
            quantity: 1,
          },
        ];
      }
    });
  };

  const handleRemoveSelectedItem = (productId: string) => {
    setSelectedItems((prev) => prev.filter((item) => item.productId !== productId));
  };

  const handleClearSelection = () => {
    setSelectedItems([]);
    setIsConfiguringMulti(false);
  };

  const handleAddSelectedToBag = () => {
    if (selectedItems.length === 0) return;
    for (const item of selectedItems) {
      const chosenSize = item.size || selectedSizes[item.productId] || item.product.sizes[0] || 'M';
      const chosenColor = item.color || item.product.colors[0] || 'Default';
      addItem(item.product, chosenColor, chosenSize, item.quantity || 1, { openDrawer: false, channel: 'agent' });
    }
    const count = selectedItems.length;
    showToast(`Added ${count} piece(s) to your bag.`);
    const confirmMsg: AIMessage = {
      id: `agent-${Date.now()}`,
      sender: 'agent',
      content: `Added the ${count} selected item${count > 1 ? 's' : ''} to your bag. Would you like to continue shopping or proceed to checkout?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      suggestedPrompts: ['Proceed to checkout', 'Continue shopping', 'What is in my bag?'],
    };
    setMessages((prev) => [...prev, confirmMsg]);
    handleClearSelection();
  };

  const handleBuySelected = () => {
    if (selectedItems.length === 0) return;
    // Always open in-chat configuration card so size, color, quantity can be chosen/verified inside AI chat
    setIsConfiguringMulti(true);
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleUpdateItemOption = (productId: string, updates: { size?: string; color?: string; quantity?: number }) => {
    setSelectedItems((prev) =>
      prev.map((it) => (it.productId === productId ? { ...it, ...updates } : it))
    );
  };

  const handleProceedMultiToCheckout = () => {
    const totalAmount = selectedItems.reduce((sum, item) => sum + (item.product.price * (item.quantity || 1)), 0);
    if (totalAmount > 10000) {
      showToast("Your AI-assisted purchase is above Vastra.AI's ₹10,000 limit.");
      const limitMsg: AIMessage = {
        id: `agent-${Date.now()}`,
        sender: 'agent',
        content: `Your AI-assisted purchase is above Vastra.AI's ₹10,000 AI purchase limit. You can remove an item or continue shopping manually.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestedPrompts: ['Shop manually', 'What is in my bag?'],
      };
      setMessages((prev) => [...prev, limitMsg]);
      return;
    }

    setIsConfiguringMulti(false);
    for (const item of selectedItems) {
      const chosenSize = item.size || selectedSizes[item.productId] || item.product.sizes[0] || 'M';
      const chosenColor = item.color || item.product.colors[0] || 'Default';
      addItem(item.product, chosenColor, chosenSize, item.quantity || 1, { openDrawer: false, channel: 'agent' });
    }
    handleSendMessage('Proceed to checkout');
  };

  const handleConfirmAndPay = async (_checkoutData?: any) => {
    if (isProcessingPayment) return;

    // Strict Gate 1: Check Customer Login
    if (!isLoggedIn) {
      setIsAuthModalOpen(true);
      showToast('Please sign in or register before confirming your order.');
      return;
    }

    // Strict Gate 2: Check Delivery Address
    if (!customerAddress) {
      setIsAddressModalOpen(true);
      showToast('Please add and confirm your delivery address to proceed.');
      return;
    }

    setIsProcessingPayment(true);

    try {
      const confirmRes = await api.confirmAgentCheckout({
        sessionId,
        confirmed: true,
        customerId: user?.id,
        customerInfo: {
          customerId: user?.id,
          name: customerAddress.name || user?.name,
          email: user?.email,
          phone: customerAddress.phone,
          address: customerAddress.addressLine,
          city: customerAddress.city,
          state: customerAddress.state,
          postalCode: customerAddress.postalCode,
        },
      });

      if (!confirmRes.success || !confirmRes.orderId) {
        throw new Error('Failed to prepare confirmed order.');
      }

      const rzpKey = confirmRes.keyId || 'rzp_test_vastra_dev';

      // If dev key or standalone simulation mode, use the In-App Luxury Razorpay Modal
      if (rzpKey.includes('vastra_dev') || !rzpKey.startsWith('rzp_test_')) {
        setActivePaymentOrder({
          localOrderId: confirmRes.orderId,
          razorpayOrderId: confirmRes.razorpayOrderId,
          amount: confirmRes.amount,
          currency: confirmRes.currency || 'INR',
          keyId: rzpKey,
          items: confirmRes.items || [],
          totalAmount: confirmRes.totalAmount,
        });
        setIsTestModeModalOpen(true);
        setIsProcessingPayment(false);
        return;
      }

      // If live test credentials exist, load Razorpay script
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        // Fallback to In-App modal
        setActivePaymentOrder({
          localOrderId: confirmRes.orderId,
          razorpayOrderId: confirmRes.razorpayOrderId,
          amount: confirmRes.amount,
          currency: confirmRes.currency || 'INR',
          keyId: rzpKey,
          items: confirmRes.items || [],
          totalAmount: confirmRes.totalAmount,
        });
        setIsTestModeModalOpen(true);
        setIsProcessingPayment(false);
        return;
      }

      const options = {
        key: rzpKey,
        amount: confirmRes.amount,
        currency: confirmRes.currency || 'INR',
        name: 'Vastra.AI',
        description: `Order ${confirmRes.orderId} • Artisanal Luxury`,
        image: FALLBACK_IMAGE,
        order_id: confirmRes.razorpayOrderId,
        handler: async (response: any) => {
          try {
            const verifyRes = await api.verifyPayment({
              orderId: confirmRes.orderId,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              sessionId,
            });

            if (verifyRes.success) {
              clearCart();
              const successMsg: AIMessage = {
                id: `agent-success-${Date.now()}`,
                sender: 'agent',
                content: `Your order **${confirmRes.orderId}** is confirmed and secured.`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                orderConfirmation: {
                  orderId: confirmRes.orderId,
                  paymentId: response.razorpay_payment_id,
                  totalAmount: confirmRes.totalAmount,
                  currency: confirmRes.currency || 'INR',
                  items: confirmRes.items || [],
                },
              };
              setMessages((prev) => [...prev, successMsg]);
            } else {
              const failMsg: AIMessage = {
                id: `agent-fail-${Date.now()}`,
                sender: 'agent',
                content: `Payment could not be completed. Your items are still in your bag. You can try again.`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                paymentErrorNotice: {
                  message: verifyRes.message || 'Payment signature verification was declined by the server.',
                  canRetry: true,
                },
              };
              setMessages((prev) => [...prev, failMsg]);
            }
          } catch (e: any) {
            console.error('Payment verification error:', e);
            const failMsg: AIMessage = {
              id: `agent-fail-${Date.now()}`,
              sender: 'agent',
              content: `Payment could not be completed. Your items are still in your bag. You can try again.`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              paymentErrorNotice: {
                message: e?.response?.data?.message || 'Payment verification could not be completed.',
                canRetry: true,
              },
            };
            setMessages((prev) => [...prev, failMsg]);
          }
        },
        modal: {
          ondismiss: async () => {
            try {
              await api.cancelPayment({ orderId: confirmRes.orderId, sessionId, reason: 'User dismissed modal' });
            } catch (e) {
              console.warn('Payment cancel notification error:', e);
            }
            const cancelMsg: AIMessage = {
              id: `agent-cancel-${Date.now()}`,
              sender: 'agent',
              content: "Payment checkout was paused. Your items are still in your bag. You can try again.",
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              paymentErrorNotice: {
                message: 'Payment checkout was paused. Your garments remain safe in your bag.',
                canRetry: true,
              },
            };
            setMessages((prev) => [...prev, cancelMsg]);
          },
        },
        theme: {
          color: '#8AA48A',
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err: any) {
      console.error('Agent checkout confirm error:', err);
      const errMsg: AIMessage = {
        id: `agent-err-${Date.now()}`,
        sender: 'agent',
        content: `I couldn't proceed with payment: ${err?.response?.data?.message || err?.message || 'Please review your cart.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        paymentErrorNotice: {
          message: err?.response?.data?.message || err?.message || 'Please review your cart before continuing.',
          canRetry: true,
        },
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleExecuteInAppPayment = async () => {
    if (!activePaymentOrder || isAuthorizingTestPayment) return;
    setIsAuthorizingTestPayment(true);

    const testPayId = `pay_test_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const testSig = `mock_sig_${Date.now()}_vastra_test`;

    try {
      const verifyRes = await api.verifyPayment({
        orderId: activePaymentOrder.localOrderId,
        razorpay_order_id: activePaymentOrder.razorpayOrderId,
        razorpay_payment_id: testPayId,
        razorpay_signature: testSig,
        sessionId,
      });

      if (verifyRes.success) {
        clearCart();
        setIsTestModeModalOpen(false);
        const successMsg: AIMessage = {
          id: `agent-success-${Date.now()}`,
          sender: 'agent',
          content: `Your order **${activePaymentOrder.localOrderId}** is confirmed and secured! Our master artisans have begun tailoring your pieces.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          orderConfirmation: {
            orderId: activePaymentOrder.localOrderId,
            paymentId: testPayId,
            totalAmount: activePaymentOrder.totalAmount,
            currency: activePaymentOrder.currency || 'INR',
            items: activePaymentOrder.items || [],
          },
        };
        setMessages((prev) => [...prev, successMsg]);
      } else {
        setIsTestModeModalOpen(false);
        const failMsg: AIMessage = {
          id: `agent-fail-${Date.now()}`,
          sender: 'agent',
          content: `Payment could not be completed. Your items are still in your bag. You can try again.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          paymentErrorNotice: {
            message: verifyRes.message || 'Payment signature verification was declined by the server.',
            canRetry: true,
          },
        };
        setMessages((prev) => [...prev, failMsg]);
      }
    } catch (verifyErr: any) {
      setIsTestModeModalOpen(false);
      const failMsg: AIMessage = {
        id: `agent-fail-${Date.now()}`,
        sender: 'agent',
        content: `Payment could not be completed. Your items are still in your bag. You can try again.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        paymentErrorNotice: {
          message: verifyErr?.response?.data?.message || 'Payment verification could not be completed.',
          canRetry: true,
        },
      };
      setMessages((prev) => [...prev, failMsg]);
    } finally {
      setIsAuthorizingTestPayment(false);
      setIsProcessingPayment(false);
    }
  };

  const handleCancelTestModal = async () => {
    if (activePaymentOrder?.localOrderId) {
      try {
        await api.cancelPayment({
          orderId: activePaymentOrder.localOrderId,
          sessionId,
          reason: 'User dismissed test payment modal',
        });
      } catch (err) {
        console.warn('[AgentPage] Cancel payment logged:', err);
      }
    }
    setIsTestModeModalOpen(false);
    setIsProcessingPayment(false);
    const cancelMsg: AIMessage = {
      id: `agent-cancel-${Date.now()}`,
      sender: 'agent',
      content: "Payment checkout was paused. Your items are still in your bag. You can try again.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      paymentErrorNotice: {
        message: 'Payment checkout was paused. Your garments remain safe in your bag.',
        canRetry: true,
      },
    };
    setMessages((prev) => [...prev, cancelMsg]);
  };

  const handleCancelCheckout = () => {
    const cancelMsg: AIMessage = {
      id: `agent-cancel-${Date.now()}`,
      sender: 'agent',
      content: 'Checkout review paused. What else may I curate for you?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, cancelMsg]);
  };

  // Dynamic Time-of-Day Greeting
  const getTimeGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const isInitialState = messages.length <= 1;

  // 5 Prescribed Suggestion Chips
  const conciergeSuggestions = [
    {
      title: 'Black dresses under ₹5,000',
      subtitle: 'Artisanal organic poplin midi dresses & Chanderi shift dresses',
      prompt: 'Show me black dresses under ₹5000',
    },
    {
      title: 'Wedding guest look under ₹8,000',
      subtitle: 'Raw silk bandhgalas, Tussar co-ords & handwoven accessories',
      prompt: 'Wedding guest look under ₹8,000',
    },
    {
      title: 'Minimal linen outfit for summer',
      subtitle: 'Hand-spun organic Khadi cotton & Belgian stonewashed shirts',
      prompt: 'Minimal linen outfit for summer',
    },
    {
      title: 'Black formal outfit',
      subtitle: 'Obsidian silk tailoring & structured double-breasted blazers',
      prompt: 'Black formal outfit',
    },
    {
      title: 'Build me a complete look',
      subtitle: 'Curated 2-piece outfit strictly within our ₹10,000 guardrail',
      prompt: 'Build me a complete look',
    },
  ];

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-[#FDFBF7] dark:bg-[#1A1E1A] overflow-hidden">
      
      {/* 1. EDITORIAL STYLIST CONCIERGE HEADER */}
      <header className="shrink-0 px-4 sm:px-8 py-3.5 border-b border-[#E6E2DA] dark:border-[#3E443D] bg-[#FDFBF7]/95 dark:bg-[#1A1E1A]/95 backdrop-blur-md z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center group mr-1">
              <span className="text-xl font-serif tracking-tight text-[#2A2A2A] dark:text-[#F6F7F2] font-medium">
                Vastra
              </span>
              <span className="text-xs font-sans tracking-widest font-bold text-[#8AA48A] uppercase ml-0.5 relative top-[-1px]">
                .AI
              </span>
            </Link>
            <div className="hidden sm:block h-5 w-[1px] bg-[#E6E2DA] dark:border-[#3E443D]" />
            <div className="w-9 h-9 rounded-full bg-[#8AA48A]/15 dark:bg-[#3E443D] border border-[#8AA48A]/40 flex items-center justify-center text-[#5E6854] dark:text-[#8AA48A] shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-sans tracking-[0.16em] font-bold text-[#6D856D] dark:text-[#8AA48A] uppercase block">
                VASTRA AI STYLIST CONCIERGE
              </span>
              <h1 className="text-xs sm:text-sm font-serif font-medium text-[#2A2A2A] dark:text-[#F6F7F2]">
                Your wardrobe, intelligently curated.
              </h1>
            </div>
          </div>

          {/* Right Header Status & Cart Pill */}
          <div className="flex items-center gap-2.5 sm:gap-3.5">
            <Link
              to="/shop"
              className="text-xs text-text-secondary hover:text-[#2A2A2A] dark:hover:text-[#F6F7F2] tracking-wider uppercase hidden sm:inline-flex items-center gap-1 font-medium transition-colors"
            >
              <span>Storefront</span>
              <ArrowRight className="w-3 h-3" />
            </Link>

            {itemCount > 0 && (
              <button
                onClick={openCart}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#CFD8CF]/50 dark:bg-[#343833] text-xs font-medium text-text-primary border border-[#8AA48A]/30 hover:border-[#8AA48A] transition-colors"
                title="View your shopping bag"
              >
                <ShoppingBag className="w-3.5 h-3.5 text-[#6D856D] dark:text-[#8AA48A]" />
                <span className="hidden sm:inline">Bag:</span>
                <span className="font-semibold">{formatCurrency(total)}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#8AA48A]/20 font-bold">{itemCount}</span>
              </button>
            )}

            {/* Live Vastra Intelligence Status Badge */}
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#CFD8CF]/40 dark:bg-[#3E443D] border border-[#8AA48A]/25">
              <span
                className={`w-2 h-2 rounded-full ${
                  agentStatus === 'curating'
                    ? 'bg-amber-500 animate-ping'
                    : agentStatus === 'updating_bag'
                    ? 'bg-[#8AA48A] animate-bounce'
                    : 'bg-[#8AA48A] animate-pulse'
                }`}
              />
              <span className="text-[11px] text-[#2A2A2A] dark:text-[#F6F7F2] font-medium tracking-wide">
                {agentStatus === 'curating'
                  ? 'Curating...'
                  : agentStatus === 'searching'
                  ? 'Searching catalog...'
                  : agentStatus === 'updating_bag'
                  ? 'Updating bag...'
                  : 'Vastra Intelligence'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Global Toast Notification */}
      <AnimatePresence>
        {toastNotice && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="fixed top-20 right-6 z-50 bg-[#2A2A2A] text-[#F6F7F2] dark:bg-[#F6F7F2] dark:text-[#2A2A2A] text-xs py-2.5 px-4 rounded-full shadow-lg flex items-center gap-2 border border-[#8AA48A]/40"
          >
            <CheckCircle2 className="w-4 h-4 text-[#8AA48A]" />
            <span>{toastNotice}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. CONVERSATION THREAD CONTAINER */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-6">
        <div className="max-w-3xl mx-auto space-y-6">
          
          {isInitialState ? (
            /* 3. INITIAL WELCOME EXPERIENCE */
            <div className="space-y-8 py-6 sm:py-10">
              <div className="text-center max-w-xl mx-auto space-y-3">
                <span className="text-[11px] font-sans font-semibold tracking-[0.18em] text-[#6D856D] dark:text-[#8AA48A] uppercase">
                  Atelier Concierge
                </span>
                <h2 className="font-serif text-2xl sm:text-4xl text-[#2A2A2A] dark:text-[#F6F7F2] leading-tight">
                  {getTimeGreeting()}. I&apos;m your Vastra.AI stylist.
                </h2>
                <p className="text-text-secondary dark:text-[#C8CDC5] text-xs sm:text-sm font-light leading-relaxed">
                  Tell me the occasion, aesthetic, silhouette, fabric, color or budget you&apos;re working with. I&apos;ll curate from the real Vastra.AI collection.
                </p>
              </div>

              {/* 5 Suggestion Chips */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto">
                {conciergeSuggestions.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(item.prompt)}
                    className="p-4 rounded-2xl bg-[#FCFCF9] dark:bg-[#1F231F] border border-[#E6E2DA] dark:border-[#3E443D] hover:border-[#8AA48A] dark:hover:border-[#8AA48A] text-left transition-all duration-200 group shadow-subtle hover:shadow-sage"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-[#2A2A2A] dark:text-[#F6F7F2] group-hover:text-[#6D856D] dark:group-hover:text-[#8AA48A] transition-colors">
                        {item.title}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-text-secondary opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                    </div>
                    <p className="text-[11px] text-text-secondary dark:text-[#C8CDC5] font-light leading-snug">
                      {item.subtitle}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className={`flex flex-col ${message.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-2 mb-1.5 px-1">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-text-secondary">
                      {message.sender === 'user' ? 'You' : 'Vastra Stylist'}
                    </span>
                    <span className="text-[10px] text-text-secondary/60">{message.timestamp}</span>
                  </div>

                  <div
                    className={`max-w-2xl p-4 sm:p-6 rounded-3xl ${
                      message.sender === 'user'
                        ? 'bg-[#8AA48A]/20 dark:bg-[#343833] text-[#2A2A2A] dark:text-[#F6F7F2] rounded-tr-xs border border-[#8AA48A]/30'
                        : 'bg-[#FCFCF9] dark:bg-[#252A25] text-[#2A2A2A] dark:text-[#F6F7F2] rounded-tl-xs border border-[#E6E2DA] dark:border-[#3E443D] shadow-subtle'
                    }`}
                  >
                    <p className="font-light text-sm sm:text-base leading-relaxed whitespace-pre-line">
                      {message.content}
                    </p>

                    {/* ORDER CONFIRMATION SUCCESS CARD */}
                    {message.orderConfirmation && (
                      <div className="mt-5 p-5 rounded-2xl bg-emerald-500/10 dark:bg-emerald-950/30 border border-emerald-500/30 space-y-4 shadow-subtle">
                        <div className="flex items-center justify-between border-b border-emerald-500/20 pb-3">
                          <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                            <span className="text-xs uppercase tracking-widest font-bold">
                              ORDER CONFIRMED
                            </span>
                          </div>
                          <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-semibold font-mono">
                            PAID
                          </span>
                        </div>

                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between text-text-secondary dark:text-stone-300">
                            <span>Order ID:</span>
                            <span className="font-mono font-semibold text-text-primary dark:text-stone-100">{message.orderConfirmation.orderId}</span>
                          </div>
                          <div className="flex justify-between text-text-secondary dark:text-stone-300">
                            <span>Payment ID:</span>
                            <span className="font-mono text-text-primary dark:text-stone-100">{message.orderConfirmation.paymentId}</span>
                          </div>
                          <div className="flex justify-between text-text-secondary dark:text-stone-300 pt-1 border-t border-emerald-500/20">
                            <span className="font-medium text-text-primary dark:text-stone-100">Total Paid:</span>
                            <span className="font-serif font-bold text-sm text-emerald-700 dark:text-emerald-300">{formatCurrency(message.orderConfirmation.totalAmount)}</span>
                          </div>
                        </div>

                        {message.orderConfirmation.items && message.orderConfirmation.items.length > 0 && (
                          <div className="pt-2 border-t border-emerald-500/20 space-y-2">
                            <span className="text-[10px] uppercase tracking-wider text-text-secondary font-semibold block">Purchased Garments:</span>
                            {message.orderConfirmation.items.map((item, idx) => (
                              <div key={idx} className="flex justify-between items-center text-xs">
                                <div>
                                  <p className="font-medium text-text-primary dark:text-stone-100">{item.name}</p>
                                  <p className="text-[11px] text-text-secondary">Size: {item.size || 'M'} • Qty: {item.quantity}</p>
                                </div>
                                <span className="font-semibold">{formatCurrency(item.price * item.quantity)}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center gap-3 pt-2">
                          <button
                            onClick={() => navigate('/shop')}
                            className="flex-1 py-2 px-4 rounded-full bg-[#8AA48A] hover:bg-[#758E75] text-[#2A2A2A] text-xs font-semibold transition-colors text-center shadow-sage"
                          >
                            Continue Shopping
                          </button>
                          <button
                            onClick={() => navigate('/orders')}
                            className="py-2 px-4 rounded-full border border-emerald-500/30 hover:bg-emerald-500/10 text-xs font-medium text-text-primary transition-colors flex items-center gap-1.5"
                          >
                            <Package className="w-3.5 h-3.5" />
                            <span>View Orders</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* PAYMENT ERROR / CANCEL NOTICE */}
                    {message.paymentErrorNotice && (
                      <div className="mt-5 p-4 rounded-2xl bg-amber-500/10 dark:bg-amber-950/30 border border-amber-500/30 space-y-3 shadow-subtle">
                        <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 text-xs font-semibold">
                          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          <span>{message.paymentErrorNotice.message}</span>
                        </div>
                        <div className="flex items-center gap-3 pt-1">
                          <button
                            onClick={() => handleSendMessage('Proceed to checkout')}
                            className="py-2 px-4 rounded-full bg-[#8AA48A] hover:bg-[#758E75] text-[#2A2A2A] text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sage"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>Try Again</span>
                          </button>
                          <button
                            onClick={openCart}
                            className="py-2 px-4 rounded-full border border-[#E6E2DA] dark:border-[#3E443D] text-xs font-medium text-text-secondary transition-colors"
                          >
                            Back to Bag
                          </button>
                        </div>
                      </div>
                    )}

                    {/* PRICE CHANGE NOTIFICATION */}
                    {message.checkout?.priceChange?.priceChanged && (
                      <div className="mt-5 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2.5 shadow-subtle">
                        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-xs font-semibold uppercase tracking-wider">
                          <AlertTriangle className="w-4 h-4" />
                          <span>Price Update Notification</span>
                        </div>
                        <p className="text-xs text-[#2A2A2A] dark:text-[#F6F7F2]">
                          The price for <strong>{message.checkout.priceChange.productName}</strong> has updated from <span className="line-through text-text-secondary">{formatCurrency(message.checkout.priceChange.previousPrice)}</span> to <strong>{formatCurrency(message.checkout.priceChange.currentPrice)}</strong>.
                        </p>
                        <div className="flex items-center gap-3 pt-1">
                          <button
                            onClick={() => handleSendMessage('Buy it')}
                            className="py-2 px-4 rounded-full bg-[#8AA48A] hover:bg-[#758E75] text-[#2A2A2A] text-xs font-semibold transition-colors"
                          >
                            Continue with updated price ({formatCurrency(message.checkout.priceChange.currentPrice)})
                          </button>
                          <button
                            onClick={() => handleCancelCheckout()}
                            className="py-2 px-4 rounded-full border border-[#E6E2DA] dark:border-[#3E443D] text-xs font-medium text-text-secondary dark:text-[#C8CDC5]"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* READY TO ORDER PURCHASE SUMMARY */}
                    {message.checkout?.ready && !message.orderConfirmation && (
                      <div className="mt-5 p-5 rounded-2xl bg-[#F6F7F2] dark:bg-[#1F231F] border border-[#8AA48A]/40 dark:border-[#8AA48A]/30 space-y-4 shadow-subtle">
                        <div className="flex items-center justify-between border-b border-[#E6E2DA] dark:border-[#3E443D] pb-3">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-[#8AA48A]" />
                            <span className="text-xs uppercase tracking-widest font-bold text-[#2A2A2A] dark:text-[#F6F7F2]">
                              Ready to order
                            </span>
                          </div>
                          <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#8AA48A]/20 text-[#4A5B4A] dark:text-[#8AA48A] font-semibold">
                            Human confirmation required
                          </span>
                        </div>

                        {/* Order Items Breakdown */}
                        <div className="space-y-2.5">
                          {message.checkout.items?.map((item: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center text-xs">
                              <div>
                                <p className="font-medium text-[#2A2A2A] dark:text-[#F6F7F2]">{item.name}</p>
                                <p className="text-[11px] text-text-secondary dark:text-[#C8CDC5]">
                                  Size {item.size || 'M'} • Qty {item.quantity}
                                </p>
                              </div>
                              <p className="font-semibold text-[#2A2A2A] dark:text-[#F6F7F2]">
                                {formatCurrency(item.price * item.quantity)}
                              </p>
                            </div>
                          ))}
                        </div>

                        <div className="border-t border-[#E6E2DA] dark:border-[#3E443D] pt-3 flex justify-between items-baseline">
                          <div>
                            <span className="text-xs font-semibold text-[#2A2A2A] dark:text-[#F6F7F2]">Total Order</span>
                            <p className="text-[10px] text-text-secondary dark:text-[#C8CDC5]">Inclusive of all artisan craft duties</p>
                          </div>
                          <span className="text-base font-serif font-bold text-[#2A2A2A] dark:text-[#F6F7F2]">
                            {formatCurrency(message.checkout.totalAmount || 0)}
                          </span>
                        </div>

                        {/* Delivery Address Section */}
                        <div className="p-3.5 rounded-2xl bg-stone-100/70 dark:bg-stone-800/60 border border-[#E6E2DA] dark:border-[#3E443D] text-xs space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-text-primary flex items-center gap-1.5">
                              <Truck className="w-3.5 h-3.5 text-[#8AA48A]" />
                              Delivery Address
                            </span>
                            {isLoggedIn ? (
                              <button
                                onClick={() => setIsAddressModalOpen(true)}
                                className="text-[11px] text-[#5E6854] dark:text-[#8AA48A] hover:underline font-semibold cursor-pointer"
                              >
                                {customerAddress ? 'Change' : '+ Add Address'}
                              </button>
                            ) : (
                              <button
                                onClick={() => setIsAuthModalOpen(true)}
                                className="text-[11px] text-[#5E6854] dark:text-[#8AA48A] hover:underline font-semibold cursor-pointer"
                              >
                                Sign In / Register
                              </button>
                            )}
                          </div>
                          {isLoggedIn && customerAddress ? (
                            <p className="text-[11px] text-text-secondary leading-snug">
                              <strong>{customerAddress.name}</strong> • {customerAddress.phone}<br />
                              {customerAddress.addressLine}, {customerAddress.city}, {customerAddress.state} - {customerAddress.postalCode}
                            </p>
                          ) : isLoggedIn ? (
                            <p className="text-[11px] text-amber-700 dark:text-amber-400">
                              Please add and confirm your delivery address before proceeding to payment.
                            </p>
                          ) : (
                            <p className="text-[11px] text-amber-700 dark:text-amber-400">
                              Please sign in or register to confirm delivery address before payment.
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-3 pt-2">
                          <button
                            onClick={() => handleConfirmAndPay(message.checkout!)}
                            disabled={isProcessingPayment}
                            className="flex-1 py-2.5 px-4 rounded-full bg-[#8AA48A] hover:bg-[#758E75] disabled:opacity-50 text-[#2A2A2A] text-xs font-semibold shadow-sage transition-colors flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <CreditCard className="w-4 h-4" />
                            <span>{isProcessingPayment ? 'Connecting Gateway...' : 'Confirm & Pay'}</span>
                          </button>
                          <button
                            onClick={() => handleCancelCheckout()}
                            disabled={isProcessingPayment}
                            className="py-2.5 px-4 rounded-full border border-[#E6E2DA] dark:border-[#3E443D] hover:bg-stone-100 dark:hover:bg-stone-800 text-xs font-medium text-text-secondary dark:text-[#C8CDC5] transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* CURATED COMPLETE LOOK OUTFIT CARD */}
                    {message.curatedLook && !message.checkout?.ready && !message.orderConfirmation && (
                      <div className="mt-6 p-5 rounded-2xl bg-[#CFD8CF]/35 dark:bg-[#2F342E] border border-[#8AA48A]/40 dark:border-[#8AA48A]/30 space-y-4 shadow-subtle">
                        <div className="flex items-center justify-between border-b border-[#8AA48A]/20 pb-2.5">
                          <div className="flex items-center gap-2 text-[#5E6854] dark:text-[#8AA48A] text-xs font-semibold uppercase tracking-wider">
                            <Layers className="w-4 h-4 text-[#8AA48A]" />
                            <span>{message.curatedLook.title}</span>
                          </div>
                          <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#8AA48A]/20 text-[#5E6854] dark:text-[#8AA48A] font-semibold">
                            Complete Look
                          </span>
                        </div>

                        <p className="text-xs text-[#2A2A2A] dark:text-[#F6F7F2] leading-relaxed">
                          {message.curatedLook.description}
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          {/* Main Piece */}
                          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-[#FCFCF9] dark:bg-[#1F231F] border border-[#E6E2DA] dark:border-[#3E443D]">
                            <img
                              src={message.curatedLook.mainItem.imageUrl}
                              alt={message.curatedLook.mainItem.name}
                              onError={(e) => {
                                const target = e.currentTarget;
                                if (target.src !== FALLBACK_IMAGE) target.src = FALLBACK_IMAGE;
                              }}
                              className="w-14 h-16 rounded-lg object-cover bg-stone-200 dark:bg-stone-800"
                            />
                            <div className="flex-1 min-w-0 text-xs space-y-0.5">
                              <span className="text-[9px] uppercase tracking-wider text-text-secondary font-semibold">Main Piece</span>
                              <h5 className="font-medium text-[#2A2A2A] dark:text-[#F6F7F2] truncate">
                                {message.curatedLook.mainItem.name}
                              </h5>
                              <p className="font-semibold text-[#2A2A2A] dark:text-[#F6F7F2]">
                                {formatCurrency(message.curatedLook.mainItem.price)}
                              </p>
                            </div>
                          </div>

                          {/* Complementary Piece */}
                          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-[#FCFCF9] dark:bg-[#1F231F] border border-[#E6E2DA] dark:border-[#3E443D]">
                            <img
                              src={message.curatedLook.complementaryItem.imageUrl}
                              alt={message.curatedLook.complementaryItem.name}
                              onError={(e) => {
                                const target = e.currentTarget;
                                if (target.src !== FALLBACK_IMAGE) target.src = FALLBACK_IMAGE;
                              }}
                              className="w-14 h-16 rounded-lg object-cover bg-stone-200 dark:bg-stone-800"
                            />
                            <div className="flex-1 min-w-0 text-xs space-y-0.5">
                              <span className="text-[9px] uppercase tracking-wider text-text-secondary font-semibold">Complementary Accent</span>
                              <h5 className="font-medium text-[#2A2A2A] dark:text-[#F6F7F2] truncate">
                                {message.curatedLook.complementaryItem.name}
                              </h5>
                              <p className="font-semibold text-[#2A2A2A] dark:text-[#F6F7F2]">
                                {formatCurrency(message.curatedLook.complementaryItem.price)}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Combined Look Total & CTA */}
                        <div className="flex items-center justify-between pt-2 border-t border-[#8AA48A]/20">
                          <div>
                            <span className="text-[11px] text-text-secondary dark:text-[#C8CDC5]">Look Total</span>
                            <p className="text-sm sm:text-base font-serif font-bold text-[#2A2A2A] dark:text-[#F6F7F2]">
                              {formatCurrency(message.curatedLook.totalPrice)}
                            </p>
                          </div>
                          <button
                            onClick={() => handleAddCuratedLook(message.curatedLook!)}
                            className="py-2 px-4 rounded-full bg-[#8AA48A] hover:bg-[#758E75] text-[#2A2A2A] text-xs font-semibold flex items-center gap-1.5 shadow-sage transition-all cursor-pointer"
                          >
                            <ShoppingBag className="w-3.5 h-3.5" />
                            <span>Add look to bag</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* EMBEDDED PRODUCT RECOMMENDATION CARDS */}
                    {message.recommendedProducts && message.recommendedProducts.length > 0 && !message.checkout?.ready && !message.curatedLook && !message.orderConfirmation && (
                      <div className="mt-6 pt-5 border-t border-[#E6E2DA] dark:border-[#3E443D] space-y-4">
                        <span className="text-xs uppercase tracking-widest font-semibold text-[#2A2A2A] dark:text-[#F6F7F2]">
                          Curated Pieces ({message.recommendedProducts.length})
                        </span>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
                          {message.recommendedProducts.map((product) => {
                            const matchReason = message.matchReasons?.[product.id];
                            const currentChosenSize = selectedSizes[product.id] || product.sizes[0] || 'M';
                            const isSelected = selectedItems.some((item) => item.productId === product.id);

                            return (
                              <ProductCard
                                key={product.id}
                                product={product}
                                matchReason={matchReason}
                                selectedSize={currentChosenSize}
                                onSelectSize={(sz) => handleSelectSize(product.id, sz)}
                                onAddToCart={(prod, sz, col) => handleAddIndividualItem(prod, sz, col)}
                                showDirectButtons={false}
                                isSelectable={true}
                                isSelected={isSelected}
                                onToggleSelect={() => handleToggleSelectProduct(product)}
                              />
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Suggestion Quick Chips */}
                  <div className="mt-3 flex flex-wrap gap-2 max-w-2xl">
                    {itemCount > 0 && !message.checkout?.ready && !message.orderConfirmation && (
                      <button
                        onClick={() => handleSendMessage('Proceed to checkout')}
                        className="text-xs px-4 py-2 rounded-full bg-[#8AA48A] text-[#2A2A2A] font-semibold hover:bg-[#758E75] transition-colors text-left flex items-center gap-1.5 shadow-sage select-none cursor-pointer"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>Proceed to checkout ({formatCurrency(total)})</span>
                      </button>
                    )}

                    {message.suggestedPrompts?.map((prompt, idx) => (
                      <button
                        key={idx}
                        onClick={() => handlePromptClick(prompt)}
                        className="text-xs px-4 py-2 rounded-full bg-[#FCFCF9] dark:bg-[#343833] border border-[#E6E2DA] dark:border-[#3E443D] hover:border-[#8AA48A] hover:text-[#8AA48A] text-text-secondary dark:text-[#C8CDC5] transition-colors text-left flex items-center gap-1.5 shadow-subtle select-none cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3 text-[#8AA48A]" />
                        <span>{prompt}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}

          {/* Dynamic AI Reasoning Animation */}
          {isThinking && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 p-4 bg-[#FCFCF9] dark:bg-[#343833] border border-[#E6E2DA] dark:border-[#3E443D] rounded-2xl max-w-md shadow-subtle"
            >
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#8AA48A] animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-[#8AA48A] animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-[#8AA48A] animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-[#5E6854] dark:text-[#8AA48A]">
                  {thinkingPhrases[thinkingStep]}
                </span>
              </div>
            </motion.div>
          )}

          {/* Interactive Multi-Product Configuration Card */}
          {isConfiguringMulti && selectedItems.length > 0 && (
            <div className="pt-4">
              <MultiProductConfigCard
                items={selectedItems}
                onUpdateItemOption={handleUpdateItemOption}
                onProceedToCheckout={handleProceedMultiToCheckout}
                onCancel={() => setIsConfiguringMulti(false)}
              />
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 4. PINNED BOTTOM COMPOSER DOCK */}
      <div className="shrink-0 px-4 py-3 sm:py-4 bg-[#FCFCF9]/95 dark:bg-[#2A2A2A]/95 border-t border-[#E6E2DA] dark:border-[#3E443D] backdrop-blur-md z-20">
        <div className="max-w-3xl mx-auto">
          {/* Visual Multi-Product Selection Tray */}
          <SelectionTray
            selectedItems={selectedItems}
            onRemoveItem={handleRemoveSelectedItem}
            onClear={handleClearSelection}
            onAddToBag={handleAddSelectedToBag}
            onBuySelected={handleBuySelected}
          />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="relative flex items-center rounded-2xl bg-surface border border-[#E6E2DA] dark:border-[#3E443D] shadow-subtle p-1.5 focus-within:border-[#8AA48A] focus-within:ring-1 focus-within:ring-[#8AA48A]/40 transition-all"
          >
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 110)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Describe your occasion, style, fabric or budget..."
              className="w-full px-4 py-2 text-xs sm:text-sm bg-transparent border-none text-[#2A2A2A] dark:text-[#F6F7F2] placeholder:text-text-secondary/60 focus:outline-none resize-none max-h-28"
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isThinking}
              className="h-9 px-4 rounded-xl bg-[#8AA48A] hover:bg-[#758E75] disabled:opacity-40 text-[#2A2A2A] text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors shadow-xs cursor-pointer"
              title="Send message (Enter)"
            >
              <span className="hidden sm:inline">Send</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>

      {/* 5. LUXURY IN-APP RAZORPAY GATEWAY MODAL */}
      <AnimatePresence>
        {isTestModeModalOpen && activePaymentOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-lg bg-[#FCFCF9] dark:bg-[#252A25] border border-[#8AA48A]/40 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-[#2A2A2A] dark:text-[#F6F7F2]"
            >
              <div className="flex items-center justify-between border-b border-[#E6E2DA] dark:border-[#3E443D] pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#8AA48A]/20 flex items-center justify-center text-[#5E6854] dark:text-[#8AA48A]">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-serif text-base sm:text-lg font-medium">Razorpay Secure Checkout</h3>
                    <p className="text-[11px] text-text-secondary">256-Bit Encrypted Payment Channel</p>
                  </div>
                </div>
                <button
                  onClick={handleCancelTestModal}
                  disabled={isAuthorizingTestPayment}
                  className="p-2 rounded-full hover:bg-stone-200 dark:hover:bg-stone-800 transition-colors"
                >
                  <X className="w-4 h-4 text-text-secondary" />
                </button>
              </div>

              {/* Order Info Bar */}
              <div className="p-4 rounded-2xl bg-[#F6F7F2] dark:bg-[#1F231F] border border-[#E6E2DA] dark:border-[#3E443D] space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-text-secondary">Order Reference:</span>
                  <span className="font-mono font-semibold">{activePaymentOrder.localOrderId}</span>
                </div>
                <div className="flex justify-between items-baseline border-t border-[#E6E2DA] dark:border-[#3E443D] pt-2">
                  <span className="text-xs font-semibold">Total Payable:</span>
                  <span className="font-serif text-lg font-bold text-[#2A2A2A] dark:text-[#F6F7F2]">
                    {formatCurrency(activePaymentOrder.totalAmount)}
                  </span>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className="space-y-3">
                <span className="text-xs uppercase tracking-wider font-semibold text-text-secondary block">
                  Select Payment Method:
                </span>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { id: 'card', label: 'Card', icon: CreditCard },
                    { id: 'upi', label: 'UPI / QR', icon: Sparkles },
                    { id: 'netbanking', label: 'NetBanking', icon: Lock },
                  ].map((m) => {
                    const Icon = m.icon;
                    const isSelected = selectedTestMethod === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setSelectedTestMethod(m.id as any)}
                        className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-1.5 cursor-pointer ${
                          isSelected
                            ? 'bg-[#8AA48A]/15 border-[#8AA48A] text-[#2A2A2A] dark:text-[#F6F7F2] font-semibold'
                            : 'border-[#E6E2DA] dark:border-[#3E443D] text-text-secondary hover:border-[#8AA48A]'
                        }`}
                      >
                        <Icon className="w-4 h-4 text-[#8AA48A]" />
                        <span className="text-xs">{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleExecuteInAppPayment}
                  disabled={isAuthorizingTestPayment}
                  className="flex-1 py-3 px-6 rounded-full bg-[#8AA48A] hover:bg-[#758E75] disabled:opacity-50 text-[#2A2A2A] text-xs font-semibold shadow-sage transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isAuthorizingTestPayment ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Verifying Signature...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>Authorize Payment ({formatCurrency(activePaymentOrder.totalAmount)})</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleCancelTestModal}
                  disabled={isAuthorizingTestPayment}
                  className="py-3 px-5 rounded-full border border-[#E6E2DA] dark:border-[#3E443D] text-xs font-medium text-text-secondary hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Customer Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />

      {/* Customer Delivery Address Modal */}
      <AnimatePresence>
        {isAddressModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              className="w-full max-w-md rounded-3xl bg-[#FCFCF9] dark:bg-[#343833] border border-[#E6E2DA] dark:border-[#3E443D] p-6 sm:p-8 space-y-5 shadow-soft"
            >
              <div className="flex items-center justify-between border-b border-[#E6E2DA] dark:border-[#3E443D] pb-3">
                <div className="flex items-center gap-2 text-text-primary">
                  <Truck className="w-5 h-5 text-[#8AA48A]" />
                  <h3 className="font-serif text-lg font-medium">Delivery Address</h3>
                </div>
                <button
                  onClick={() => setIsAddressModalOpen(false)}
                  className="p-1 rounded-full text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {addressError && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs">
                  {addressError}
                </div>
              )}

              <form onSubmit={handleSaveAddress} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-text-secondary mb-1">Full Name</label>
                  <input
                    type="text"
                    value={addressForm.name}
                    onChange={(e) => setAddressForm({ ...addressForm, name: e.target.value })}
                    required
                    className="w-full p-2.5 rounded-xl border border-[#E6E2DA] dark:border-[#3E443D] bg-surface text-text-primary focus:outline-none focus:border-[#8AA48A]"
                    placeholder="Recipient name"
                  />
                </div>
                <div>
                  <label className="block text-text-secondary mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={addressForm.phone}
                    onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })}
                    required
                    className="w-full p-2.5 rounded-xl border border-[#E6E2DA] dark:border-[#3E443D] bg-surface text-text-primary focus:outline-none focus:border-[#8AA48A]"
                    placeholder="+91 98765 43210"
                  />
                </div>
                <div>
                  <label className="block text-text-secondary mb-1">Street Address</label>
                  <input
                    type="text"
                    value={addressForm.addressLine}
                    onChange={(e) => setAddressForm({ ...addressForm, addressLine: e.target.value })}
                    required
                    className="w-full p-2.5 rounded-xl border border-[#E6E2DA] dark:border-[#3E443D] bg-surface text-text-primary focus:outline-none focus:border-[#8AA48A]"
                    placeholder="Flat / House no, Street, Landmark"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-text-secondary mb-1">City</label>
                    <input
                      type="text"
                      value={addressForm.city}
                      onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                      required
                      className="w-full p-2.5 rounded-xl border border-[#E6E2DA] dark:border-[#3E443D] bg-surface text-text-primary focus:outline-none focus:border-[#8AA48A]"
                      placeholder="City"
                    />
                  </div>
                  <div>
                    <label className="block text-text-secondary mb-1">State</label>
                    <input
                      type="text"
                      value={addressForm.state}
                      onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })}
                      required
                      className="w-full p-2.5 rounded-xl border border-[#E6E2DA] dark:border-[#3E443D] bg-surface text-text-primary focus:outline-none focus:border-[#8AA48A]"
                      placeholder="State"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-text-secondary mb-1">Postal Code (PIN)</label>
                  <input
                    type="text"
                    value={addressForm.postalCode}
                    onChange={(e) => setAddressForm({ ...addressForm, postalCode: e.target.value })}
                    required
                    className="w-full p-2.5 rounded-xl border border-[#E6E2DA] dark:border-[#3E443D] bg-surface text-text-primary focus:outline-none focus:border-[#8AA48A]"
                    placeholder="560038"
                  />
                </div>

                <div className="flex items-center gap-2.5 pt-2">
                  <button
                    type="submit"
                    disabled={isSavingAddress}
                    className="flex-1 py-2.5 rounded-full bg-[#8AA48A] hover:bg-[#758E75] text-[#2A2A2A] font-semibold transition-colors cursor-pointer shadow-sage"
                  >
                    {isSavingAddress ? 'Saving...' : 'Confirm & Save Address'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddressModalOpen(false)}
                    className="py-2.5 px-4 rounded-full border border-[#E6E2DA] dark:border-[#3E443D] text-text-secondary hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Cart Drawer for seamless bag management inside Agent */}
      <CartDrawer />
    </div>
  );
};

export default AgentPage;
