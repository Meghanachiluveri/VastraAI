export type Channel = 'human' | 'agent';

export type Outcome = 'success' | 'failure' | 'user_declined' | 'user_cancelled';

export type ProductGender = 'men' | 'women' | 'unisex';

export type ProductSortOption =
  | 'popular'
  | 'price_low_high'
  | 'price_high_low'
  | 'newest'
  | 'rating';

export interface ProductFilters {
  gender?: ProductGender | string;
  category?: string;
  subcategory?: string;
  minPrice?: number;
  maxPrice?: number;
  size?: string;
  color?: string;
  material?: string;
  occasion?: string;
  sort?: ProductSortOption;
  isNew?: boolean;
  isArchived?: boolean;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  gender: ProductGender;
  category: string;
  subcategory?: string;
  sizes: string[];
  colors: string[];
  rating: number;
  reviewCount: number;
  imageUrl: string;
  description: string;
  material?: string;
  occasion?: string;
  styleTags?: string[];
  isNew?: boolean;
  isArchived?: boolean;
  createdAt?: string;
}

export interface DbProduct {
  id: string;
  name: string;
  price: number;
  stock: number;
  gender: string;
  category: string;
  subcategory?: string | null;
  sizes: string;
  colors: string;
  rating: number;
  review_count: number;
  image_url: string;
  description: string | null;
  material?: string | null;
  occasion?: string | null;
  style_tags?: string | null;
  is_new?: number | null;
  is_archived?: number | null;
  created_at?: string | null;
}

export interface ProductListResponse {
  products: Product[];
  count: number;
}

export interface ProductDetailResponse {
  product: Product;
}

export interface ErrorResponse {
  error: string;
  message?: string;
  details?: unknown;
}

// ==================== ORDER & VALIDATION TYPES ====================

export type OrderValidationFailureReason =
  | 'PRODUCT_NOT_FOUND'
  | 'INVALID_QUANTITY'
  | 'INSUFFICIENT_STOCK'
  | 'INVALID_SIZE'
  | 'INVALID_COLOR'
  | 'ORDER_VALUE_LIMIT_EXCEEDED'
  | 'INVALID_CHANNEL'
  | 'EMPTY_ORDER'
  | 'CONFIRMATION_REQUIRED'
  | 'ORDER_NOT_FOUND'
  | 'ORDER_ALREADY_PAID'
  | 'INVALID_ORDER_STATE'
  | 'INVALID_SIGNATURE';

export interface OrderItemInput {
  productId: string;
  quantity: number;
  size?: string;
  color?: string;
  price?: number; // Intentionally ignored for calculation; database price is always used
}

export interface OrderValidationRequest {
  channel: Channel | string;
  items: OrderItemInput[];
  sessionId?: string | null;
}

export interface ValidatedOrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  size?: string;
  color?: string;
  total: number;
  imageUrl: string;
}

export interface OrderValidationSuccess {
  valid: true;
  channel: Channel;
  requiresConfirmation: boolean;
  subtotal: number;
  totalQuantity: number;
  total: number;
  currency: string;
  items: ValidatedOrderItem[];
}

export interface OrderValidationFailure {
  valid: false;
  reason: OrderValidationFailureReason;
  error: string;
  details?: {
    productId?: string;
    requested?: number;
    available?: number;
    total?: number;
    limit?: number;
  };
}

export type OrderValidationResult = OrderValidationSuccess | OrderValidationFailure;

export interface CreateOrderRequest {
  channel: Channel | string;
  items: OrderItemInput[];
  confirmed?: boolean;
  sessionId?: string | null;
  customerId?: string | null;
  customerInfo?: {
    customerId?: string;
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    postalCode?: string;
  };
}

export interface OrderResponsePayload {
  id: string;
  status: string;
  channel: Channel;
  totalAmount: number;
  currency: string;
  customerId?: string | null;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  shippingAddress?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingPostalCode?: string;
  items?: ValidatedOrderItem[];
  createdAt?: string;
}

export interface CreateOrderSuccess {
  success: true;
  order: OrderResponsePayload;
}

export interface CreateOrderFailure {
  success: false;
  error: OrderValidationFailureReason;
  message: string;
  details?: unknown;
}

export type CreateOrderResult = CreateOrderSuccess | CreateOrderFailure;

// ==================== ORDER CONFIRMATION TYPES ====================

export type PaymentStatus = 'success' | 'failed';

export interface ConfirmOrderRequest {
  paymentStatus: PaymentStatus;
  sessionId?: string | null;
}

export interface ConfirmOrderSuccess {
  success: true;
  order: {
    id: string;
    status: 'PAID';
    totalAmount: number;
    currency: string;
  };
}

export interface ConfirmOrderPaymentFailed {
  success: false;
  order: {
    id: string;
    status: 'PAYMENT_FAILED';
  };
}

export interface ConfirmOrderError {
  success: false;
  error: string;
  message?: string;
}

export type ConfirmOrderResult =
  | ConfirmOrderSuccess
  | ConfirmOrderPaymentFailed
  | ConfirmOrderError;

export interface Order {
  id: string;
  channel: Channel;
  status: string;
  total_amount: number;
  currency: string;
  payment_provider: string | null;
  payment_order_id: string | null;
  payment_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItemRow {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  price: number;
  size: string | null;
  color: string | null;
}

// ==================== RAZORPAY PAYMENT TYPES ====================

export interface CreatePaymentOrderRequest {
  orderId: string;
  sessionId?: string | null;
}

export interface CreatePaymentOrderResponse {
  razorpayOrderId: string;
  amount: number;
  currency: string;
  key: string;
}

export interface VerifyPaymentRequest {
  orderId: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  sessionId?: string | null;
}

export interface VerifyPaymentSuccess {
  success: true;
  order: {
    id: string;
    status: 'PAID';
    totalAmount: number;
    currency: string;
    paymentId: string;
  };
}

export interface VerifyPaymentFailure {
  success: false;
  error: string;
  message: string;
}

export type VerifyPaymentResult = VerifyPaymentSuccess | VerifyPaymentFailure;

// ==================== AUDIT LOGGING TYPES ====================

export type AuditAction =
  | 'search'
  | 'propose'
  | 'refine'
  | 'recommendation'
  | 'upsell_suggested'
  | 'upsell_declined'
  | 'upsell_accepted'
  | 'guardrail_check'
  | 'gating_check'
  | 'add_to_bag'
  | 'order_created'
  | 'order_confirmed'
  | 'stock_failure'
  | 'payment_attempt'
  | 'payment_result'
  | 'payment_verified'
  | 'payment_failed'
  | 'payment_cancelled'
  | 'checkout_invalidated'
  | 'price_changed'
  | 'tool_failure';

export interface LogAuditEventParams {
  sessionId?: string | null;
  orderId?: string | null;
  channel: Channel | string;
  action: AuditAction | string;
  details?: Record<string, unknown> | string | null;
  outcome?: Outcome | null;
}

export interface AuditLog {
  id: string;
  order_id: string | null;
  session_id: string | null;
  channel: Channel;
  action: string;
  details: string | null;
  outcome: Outcome | null;
  created_at: string;
}

// ==================== AGENT, RECOMMENDATION & UPSELL TYPES ====================

export interface PriceChangeInfo {
  priceChanged: boolean;
  productId: string;
  productName: string;
  previousPrice: number;
  currentPrice: number;
}

export interface ProductRecommendation {
  productId: string;
  productName: string;
  price: number;
  rating: number;
  reason: string;
  score?: number;
}

export interface UpsellSuggestion {
  productId: string;
  productName: string;
  price: number;
  targetProductId?: string;
  message: string;
  requiresConfirmation: boolean;
  status?: 'suggested' | 'accepted' | 'declined';
}

export interface PendingVariantSelection {
  productId: string;
  productName: string;
  requestedQuantity?: number;
  availableSizes: string[];
  availableColors: string[];
  chosenColor?: string;
  chosenSize?: string;
}

export interface CartItemPayload {
  id: string; // unique item id e.g. `${productId}-${color}-${size}`
  productId: string;
  name: string;
  price: number;
  quantity: number;
  size: string;
  color: string;
  total: number;
  imageUrl: string;
  stock: number;
}

export interface CartPayload {
  sessionId: string;
  customerId?: string | null;
  items: CartItemPayload[];
  itemCount: number;
  subtotal: number;
  total: number;
  currency: string;
  priceChange?: PriceChangeInfo;
}

export interface PendingCheckoutState {
  sessionId: string;
  items: ValidatedOrderItem[];
  totalAmount: number;
  currency: string;
  requiresConfirmation: boolean;
  createdAt: number;
  itemsHash: string;
  orderId?: string;
  razorpayOrderId?: string;
  razorpayAmount?: number;
  razorpayKeyId?: string;
  priceConfirmed?: boolean;
}

export interface PrepareCheckoutResult {
  ready: boolean;
  requiresConfirmation?: boolean;
  currency?: string;
  totalAmount?: number;
  items?: ValidatedOrderItem[];
  error?: string;
  message?: string;
  priceChange?: PriceChangeInfo;
  outOfStockProduct?: { id: string; name: string };
}

export interface ConfirmCheckoutRequest {
  sessionId: string;
  confirmed: boolean;
  customerId?: string;
  customerInfo?: {
    customerId?: string;
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    postalCode?: string;
  };
}

export interface ConfirmCheckoutResponse {
  success: boolean;
  orderId: string;
  razorpayOrderId: string;
  amount: number;
  currency: string;
  keyId: string;
  items: ValidatedOrderItem[];
  totalAmount: number;
}

export interface CancelPaymentRequest {
  orderId: string;
  sessionId?: string | null;
  reason?: string;
}

export interface CancelPaymentResponse {
  success: boolean;
  orderId: string;
  status: string;
  message: string;
}

export interface CuratedLookItem {
  productId: string;
  name: string;
  price: number;
  category: string;
  imageUrl: string;
  size?: string;
  color?: string;
}

export interface CuratedLook {
  title: string;
  description: string;
  occasion?: string;
  mainItem: CuratedLookItem;
  complementaryItem: CuratedLookItem;
  totalPrice: number;
  guardrailCompliant: boolean;
}

export interface ShoppingContext {
  query?: string;
  category?: string;
  subcategory?: string;
  gender?: ProductGender | string;
  minPrice?: number;
  maxPrice?: number;
  size?: string;
  color?: string;
  style?: string;
  fabric?: string;
  occasion?: string;
  lastIntent?: string;
  recentProductIds?: string[];
  lastSearchResults?: Product[];
  activeProductId?: string;
  activeRecommendation?: ProductRecommendation;
  upsellSuggestion?: UpsellSuggestion;
  curatedLook?: CuratedLook;
  matchReasons?: Record<string, string>;
  upsellDeclined?: boolean;
  upsellAccepted?: boolean;
  pendingVariantSelection?: PendingVariantSelection;
  pendingClearCartConfirmation?: boolean;
  pendingCheckoutState?: PendingCheckoutState;
  isAiCheckout?: boolean;
  selectedProductIds?: string[];
  selectedItems?: AISelectedItem[];
  lastUpdated?: number;
}

export interface AISelectedItem {
  productId: string;
  size?: string | null;
  color?: string | null;
  quantity?: number;
}

export interface AgentMessageRequest {
  message: string;
  sessionId?: string | null;
  customerId?: string | null;
  customerInfo?: any;
  shippingAddress?: any;
  selectedProductIds?: string[];
  selectedItems?: AISelectedItem[];
}

export interface AgentMessageResponse {
  sessionId: string;
  message: string;
  products: Product[];
  actions: string[];
  context?: ShoppingContext;
  recommendation?: ProductRecommendation;
  upsell?: UpsellSuggestion;
  curatedLook?: CuratedLook;
  matchReasons?: Record<string, string>;
  cart?: CartPayload;
  checkout?: PrepareCheckoutResult;
  validation?: OrderValidationResult;
  statusIndicator?: 'ready' | 'curating' | 'searching' | 'updating_bag';
  requireLogin?: boolean;
  requiresAuth?: boolean;
  requireAddress?: boolean;
  shippingAddress?: any;
  selectedProductIds?: string[];
  selectedItems?: AISelectedItem[];
  clarificationOptions?: Product[];
}

export interface HealthResponse {
  status: 'ok';
  service: 'vastra-backend';
}

// ==================== MERCHANT ANALYTICS TYPES ====================

export type DateRange = 'today' | '7d' | '30d' | 'all';

export interface AiFunnelData {
  sessions: number;
  recommendations: number;
  cartAdditions: number;
  checkoutAttempts: number;
  confirmedOrders: number;
  conversionRate: number; // percentage
}

export interface UpsellAnalyticsData {
  upsellsSuggested: number;
  upsellsAccepted: number;
  upsellsDeclined: number;
  upsellAcceptanceRate: number; // percentage
  upsellRevenue: number;
}

export interface MerchantOverviewData {
  totalRevenue: number;
  aiRevenue: number;
  humanRevenue: number;
  totalOrders: number;
  aiOrders: number;
  humanOrders: number;
  aiSessions: number;
  aiConversionRate: number;
  avgAiOrderValue: number;
  avgHumanOrderValue: number;
  upsell: UpsellAnalyticsData;
  funnel: AiFunnelData;
  range: DateRange;
}

export interface MerchantOrderItem {
  id: string;
  productId: string;
  name: string;
  quantity: number;
  price: number;
  size?: string;
  color?: string;
  imageUrl?: string;
}

export interface MerchantOrderRecord {
  id: string;
  channel: Channel;
  status: string;
  totalAmount: number;
  currency: string;
  itemCount: number;
  items: MerchantOrderItem[];
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

export interface MerchantActivityRecord {
  id: string;
  orderId?: string | null;
  sessionId?: string | null;
  channel: Channel;
  action: string;
  description: string;
  details?: any;
  outcome?: Outcome;
  createdAt: string;
}

// ==================== SIMULATION TYPES ====================

export interface SimulationConfig {
  searchProbability: number;
  recommendationProbability: number;
  cartAdditionProbability: number;
  upsellSuggestionProbability: number;
  upsellAcceptanceProbability: number;
  checkoutAttemptProbability: number;
  paymentSuccessProbability: number;
}

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

export interface SimulationEventRecord {
  id: string;
  simulationId: string;
  simulationSessionId: string;
  channel: 'simulation';
  eventType: string;
  details?: any;
  createdAt: string;
}

// ==================== EXPLAINABILITY & AI AUDIT TRAIL TYPES ====================

export type ExplainabilityStatus = 'success' | 'pending' | 'failed' | 'declined' | 'informational';

export interface GuardrailCheckDetail {
  label: string;
  passed: boolean;
  message?: string;
}

export interface AiTimelineEvent {
  id: string;
  sessionId: string;
  orderId?: string | null;
  eventType: string;
  title: string;
  description: string;
  explanation?: string;
  status: ExplainabilityStatus;
  timestamp: string;
  product?: {
    id: string;
    name: string;
    price: number;
    size?: string;
    color?: string;
    quantity?: number;
    imageUrl?: string;
  };
  guardrails?: GuardrailCheckDetail[];
  priceChange?: {
    previousPrice: number;
    currentPrice: number;
    requiresReconfirmation: boolean;
  };
  paymentInfo?: {
    status: string;
    amount: number;
    currency: string;
    orderId?: string;
  };
  failureDetails?: {
    reason: string;
    recoveryAction?: string;
  };
}

export interface AiSessionSummary {
  sessionId: string;
  startedAt: string;
  lastActiveAt: string;
  totalActions: number;
  hasOrder: boolean;
  orderId?: string | null;
  orderStatus?: string | null;
  orderAmount?: number | null;
  primaryIntent?: string;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'FAILED' | 'DROPPED';
  actionTypes: string[];
}

export interface AiSessionDetail {
  sessionId: string;
  summary: AiSessionSummary;
  timeline: AiTimelineEvent[];
}







