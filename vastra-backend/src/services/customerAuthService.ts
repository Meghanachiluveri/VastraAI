import crypto from 'crypto';
import { db } from '../db/db';

export interface CustomerProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'customer';
  memberSince?: string;
}

export interface CustomerTokenPayload {
  id: string;
  name: string;
  email: string;
  role: 'customer';
  iat: number;
  exp: number;
}

export interface CustomerAddress {
  id: string;
  customerId: string;
  name: string;
  phone: string;
  addressLine: string;
  city: string;
  state: string;
  postalCode: string;
  isDefault: boolean;
  createdAt?: string;
}

export interface CustomerAuthResult {
  success: boolean;
  token?: string;
  customer?: CustomerProfile;
  error?: string;
  message?: string;
}

const CUSTOMER_JWT_SECRET = process.env.CUSTOMER_JWT_SECRET || 'vastra_customer_secret_jwt_2026';
const TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Creates a salted password hash using PBKDF2.
 */
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verifies password against stored salt:hash string.
 */
function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;
  const computedHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(computedHash, 'hex'));
}

/**
 * Creates a cryptographically signed HMAC-SHA256 bearer token for customer.
 */
function createCustomerSignedToken(payload: CustomerTokenPayload): string {
  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', CUSTOMER_JWT_SECRET)
    .update(payloadBase64)
    .digest('base64url');
  return `${payloadBase64}.${signature}`;
}

/**
 * Verifies a customer bearer token and enforces the 'customer' role.
 */
export function verifyCustomerToken(token?: string): CustomerTokenPayload | null {
  if (!token || typeof token !== 'string') {
    return null;
  }

  const parts = token.trim().split('.');
  if (parts.length !== 2) {
    return null;
  }

  const [payloadBase64, signature] = parts;

  try {
    const expectedSignature = crypto
      .createHmac('sha256', CUSTOMER_JWT_SECRET)
      .update(payloadBase64)
      .digest('base64url');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null;
    }

    const payloadJson = Buffer.from(payloadBase64, 'base64url').toString('utf-8');
    const payload: CustomerTokenPayload = JSON.parse(payloadJson);

    if (payload.role !== 'customer') {
      return null;
    }

    if (Date.now() > payload.exp) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Registers a new customer into the SQLite database.
 */
export function registerCustomer(params: {
  name: string;
  email: string;
  password: string;
  phone?: string;
}): CustomerAuthResult {
  const { name, email, password, phone } = params;

  if (!email || !password || !name) {
    return {
      success: false,
      error: 'MISSING_FIELDS',
      message: 'Name, email, and password are required.'
    };
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanName = name.trim();

  if (password.length < 6) {
    return {
      success: false,
      error: 'PASSWORD_TOO_SHORT',
      message: 'Password must be at least 6 characters long.'
    };
  }

  // Check if customer already exists
  const existing = db.prepare('SELECT id FROM customers WHERE email = ?').get(cleanEmail);
  if (existing) {
    return {
      success: false,
      error: 'EMAIL_EXISTS',
      message: 'An account with this email address already exists.'
    };
  }

  const customerId = `cust_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const passwordHash = hashPassword(password);
  const cleanPhone = phone ? phone.trim() : null;

  db.prepare(`
    INSERT INTO customers (id, name, email, password_hash, phone, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run(customerId, cleanName, cleanEmail, passwordHash, cleanPhone);

  const now = Date.now();
  const payload: CustomerTokenPayload = {
    id: customerId,
    name: cleanName,
    email: cleanEmail,
    role: 'customer',
    iat: now,
    exp: now + TOKEN_EXPIRY_MS
  };

  const token = createCustomerSignedToken(payload);

  return {
    success: true,
    token,
    customer: {
      id: customerId,
      name: cleanName,
      email: cleanEmail,
      phone: cleanPhone || undefined,
      role: 'customer',
      memberSince: new Date().getFullYear().toString()
    }
  };
}

/**
 * Authenticates a customer with email and password against SQLite.
 */
export function loginCustomer(email?: string, password?: string): CustomerAuthResult {
  if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
    return {
      success: false,
      error: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password.'
    };
  }

  const cleanEmail = email.trim().toLowerCase();

  const row = db.prepare(`
    SELECT id, name, email, password_hash, phone, created_at
    FROM customers
    WHERE email = ?
  `).get(cleanEmail) as { id: string; name: string; email: string; password_hash: string; phone?: string; created_at: string } | undefined;

  if (!row) {
    return {
      success: false,
      error: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password.'
    };
  }

  const isMatch = verifyPassword(password, row.password_hash);
  if (!isMatch) {
    return {
      success: false,
      error: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password.'
    };
  }

  const now = Date.now();
  const payload: CustomerTokenPayload = {
    id: row.id,
    name: row.name,
    email: row.email,
    role: 'customer',
    iat: now,
    exp: now + TOKEN_EXPIRY_MS
  };

  const token = createCustomerSignedToken(payload);

  return {
    success: true,
    token,
    customer: {
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone || undefined,
      role: 'customer',
      memberSince: row.created_at ? new Date(row.created_at).getFullYear().toString() : '2026'
    }
  };
}

/**
 * Retrieves a customer profile by ID.
 */
export function getCustomerById(customerId: string): CustomerProfile | null {
  const row = db.prepare(`
    SELECT id, name, email, phone, created_at
    FROM customers
    WHERE id = ?
  `).get(customerId) as { id: string; name: string; email: string; phone?: string; created_at: string } | undefined;

  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone || undefined,
    role: 'customer',
    memberSince: row.created_at ? new Date(row.created_at).getFullYear().toString() : '2026'
  };
}

/**
 * Retrieves all saved delivery addresses for a customer.
 */
export function getCustomerAddresses(customerId: string): CustomerAddress[] {
  const rows = db.prepare(`
    SELECT id, customer_id, name, phone, address_line, city, state, postal_code, is_default, created_at
    FROM customer_addresses
    WHERE customer_id = ?
    ORDER BY is_default DESC, created_at DESC
  `).all(customerId) as any[];

  return rows.map((r) => ({
    id: r.id,
    customerId: r.customer_id,
    name: r.name,
    phone: r.phone,
    addressLine: r.address_line,
    city: r.city,
    state: r.state,
    postalCode: r.postal_code,
    isDefault: Boolean(r.is_default),
    createdAt: r.created_at
  }));
}

/**
 * Adds a new delivery address for a customer.
 */
export function addCustomerAddress(customerId: string, address: {
  name: string;
  phone: string;
  addressLine: string;
  city: string;
  state: string;
  postalCode: string;
  isDefault?: boolean;
}): CustomerAddress {
  const { name, phone, addressLine, city, state, postalCode } = address;

  if (!name || !phone || !addressLine || !city || !state || !postalCode) {
    throw new Error('All address fields (name, phone, addressLine, city, state, postalCode) are required.');
  }

  const addressId = `addr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const isDefault = address.isDefault !== false ? 1 : 0;

  if (isDefault === 1) {
    // Unset existing defaults
    db.prepare('UPDATE customer_addresses SET is_default = 0 WHERE customer_id = ?').run(customerId);
  }

  db.prepare(`
    INSERT INTO customer_addresses (
      id, customer_id, name, phone, address_line, city, state, postal_code, is_default, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run(addressId, customerId, name.trim(), phone.trim(), addressLine.trim(), city.trim(), state.trim(), postalCode.trim(), isDefault);

  return {
    id: addressId,
    customerId,
    name: name.trim(),
    phone: phone.trim(),
    addressLine: addressLine.trim(),
    city: city.trim(),
    state: state.trim(),
    postalCode: postalCode.trim(),
    isDefault: Boolean(isDefault)
  };
}

/**
 * Seeds a default test customer with default address so demo and testing work immediately.
 */
export function seedDefaultCustomer(): void {
  const defaultEmail = 'customer@vastra.ai';
  const defaultCustomer = db.prepare('SELECT id FROM customers WHERE email = ?').get(defaultEmail) as { id: string } | undefined;

  let customerId = '';
  if (!defaultCustomer) {
    customerId = 'cust_default_meghana';
    const passwordHash = hashPassword('VastraCustomer2026!');
    db.prepare(`
      INSERT INTO customers (id, name, email, password_hash, phone, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(customerId, 'Meghana Rao', defaultEmail, passwordHash, '+91 98765 43210');
  } else {
    customerId = defaultCustomer.id;
  }

  // Ensure default address exists
  const existingAddr = db.prepare('SELECT id FROM customer_addresses WHERE customer_id = ?').get(customerId);
  if (!existingAddr) {
    const addrId = 'addr_default_meghana';
    db.prepare(`
      INSERT INTO customer_addresses (
        id, customer_id, name, phone, address_line, city, state, postal_code, is_default, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(
      addrId,
      customerId,
      'Meghana Rao',
      '+91 98765 43210',
      '42 Atelier Lane, Indiranagar',
      'Bangalore',
      'Karnataka',
      '560038'
    );
  }
}
