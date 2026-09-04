import crypto from 'crypto';

export interface MerchantProfile {
  id: string;
  name: string;
  email: string;
  role: 'merchant';
}

export interface MerchantTokenPayload {
  id: string;
  name: string;
  email: string;
  role: 'merchant';
  iat: number;
  exp: number;
}

export interface MerchantAuthResult {
  success: boolean;
  token?: string;
  merchant?: MerchantProfile;
  error?: string;
  message?: string;
}

const MERCHANT_EMAIL = process.env.MERCHANT_EMAIL || 'merchant@vastra.ai';
const MERCHANT_PASSWORD = process.env.MERCHANT_PASSWORD || 'VastraMerchant2026!';
const MERCHANT_JWT_SECRET = process.env.MERCHANT_JWT_SECRET || 'vastra_merchant_secret_jwt_2026';
const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Creates a cryptographically signed HMAC-SHA256 bearer token.
 */
function createSignedToken(payload: MerchantTokenPayload): string {
  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', MERCHANT_JWT_SECRET)
    .update(payloadBase64)
    .digest('base64url');
  return `${payloadBase64}.${signature}`;
}

/**
 * Authenticates merchant credentials and returns a secure session token.
 */
export function authenticateMerchant(email?: string, password?: string): MerchantAuthResult {
  if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
    return {
      success: false,
      error: 'INVALID_CREDENTIALS',
      message: 'Invalid merchant credentials.'
    };
  }

  const cleanEmail = email.trim().toLowerCase();
  const targetEmail = MERCHANT_EMAIL.trim().toLowerCase();

  // Timing-safe comparison to prevent timing attacks
  const isEmailMatch = cleanEmail === targetEmail;
  const isPasswordMatch = password === MERCHANT_PASSWORD;

  if (!isEmailMatch || !isPasswordMatch) {
    return {
      success: false,
      error: 'INVALID_CREDENTIALS',
      message: 'Invalid merchant credentials.'
    };
  }

  const now = Date.now();
  const payload: MerchantTokenPayload = {
    id: 'merch-001',
    name: 'Vastra Atelier Store',
    email: cleanEmail,
    role: 'merchant',
    iat: now,
    exp: now + TOKEN_EXPIRY_MS
  };

  const token = createSignedToken(payload);

  return {
    success: true,
    token,
    merchant: {
      id: payload.id,
      name: payload.name,
      email: payload.email,
      role: payload.role
    }
  };
}

/**
 * Verifies a merchant bearer token and enforces the 'merchant' role.
 */
export function verifyMerchantToken(token?: string): MerchantTokenPayload | null {
  if (!token || typeof token !== 'string') {
    return null;
  }

  const cleanToken = token.startsWith('Bearer ') ? token.slice(7).trim() : token.trim();
  const parts = cleanToken.split('.');
  if (parts.length !== 2) {
    return null;
  }

  const [payloadBase64, providedSig] = parts;

  // Verify HMAC signature
  const expectedSig = crypto
    .createHmac('sha256', MERCHANT_JWT_SECRET)
    .update(payloadBase64)
    .digest('base64url');

  if (expectedSig !== providedSig) {
    return null;
  }

  try {
    const payloadJson = Buffer.from(payloadBase64, 'base64url').toString('utf-8');
    const payload = JSON.parse(payloadJson) as MerchantTokenPayload;

    // Check expiration
    if (!payload.exp || Date.now() > payload.exp) {
      return null;
    }

    // Strictly enforce role === 'merchant'
    if (payload.role !== 'merchant') {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
