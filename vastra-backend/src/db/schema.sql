-- Products Table
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    gender TEXT NOT NULL,
    category TEXT NOT NULL,
    subcategory TEXT DEFAULT '',
    sizes TEXT NOT NULL,
    colors TEXT NOT NULL,
    rating REAL DEFAULT 0.0,
    review_count INTEGER DEFAULT 0,
    image_url TEXT NOT NULL,
    description TEXT,
    material TEXT DEFAULT '',
    occasion TEXT DEFAULT '',
    style_tags TEXT DEFAULT '[]',
    is_new INTEGER DEFAULT 0,
    is_archived INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Customers Table
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    phone TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Customer Addresses Table
CREATE TABLE IF NOT EXISTS customer_addresses (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    address_line TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    postal_code TEXT NOT NULL,
    is_default INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

-- Orders Table
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    session_id TEXT,
    customer_id TEXT,
    customer_name TEXT,
    customer_email TEXT,
    customer_phone TEXT,
    shipping_address TEXT,
    shipping_city TEXT,
    shipping_state TEXT,
    shipping_postal_code TEXT,
    channel TEXT NOT NULL CHECK (channel IN ('human', 'agent')),
    status TEXT NOT NULL DEFAULT 'pending',
    total_amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    payment_provider TEXT DEFAULT 'razorpay',
    payment_order_id TEXT,
    payment_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
);

-- Order Items Table
CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    price REAL NOT NULL,
    size TEXT,
    color TEXT,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Audit Log Table
CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    order_id TEXT,
    session_id TEXT,
    channel TEXT NOT NULL CHECK (channel IN ('human', 'agent')),
    action TEXT NOT NULL,
    details TEXT,
    outcome TEXT CHECK (outcome IN ('success', 'failure', 'user_declined')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
);

-- Carts Table (session-keyed)
CREATE TABLE IF NOT EXISTS carts (
    id TEXT PRIMARY KEY,
    session_id TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Cart Items Table
CREATE TABLE IF NOT EXISTS cart_items (
    id TEXT PRIMARY KEY,
    cart_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    size TEXT,
    color TEXT,
    unit_price REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Simulation Runs Table
CREATE TABLE IF NOT EXISTS simulation_runs (
    id TEXT PRIMARY KEY,
    number_of_shoppers INTEGER NOT NULL,
    sessions INTEGER NOT NULL,
    searches INTEGER NOT NULL,
    recommendations INTEGER NOT NULL,
    cart_additions INTEGER NOT NULL,
    upsell_suggestions INTEGER NOT NULL,
    upsell_accepted INTEGER NOT NULL,
    checkout_attempts INTEGER NOT NULL,
    successful_orders INTEGER NOT NULL,
    failed_payments INTEGER NOT NULL,
    conversion_rate REAL NOT NULL,
    upsell_acceptance_rate REAL NOT NULL,
    revenue REAL NOT NULL,
    average_order_value REAL NOT NULL,
    top_products TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Simulation Events Table
CREATE TABLE IF NOT EXISTS simulation_events (
    id TEXT PRIMARY KEY,
    simulation_id TEXT NOT NULL,
    simulation_session_id TEXT NOT NULL,
    channel TEXT NOT NULL DEFAULT 'simulation',
    event_type TEXT NOT NULL,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (simulation_id) REFERENCES simulation_runs(id) ON DELETE CASCADE
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_gender ON products(gender);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customer_addresses_customer_id ON customer_addresses(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_session_id ON orders(session_id);
CREATE INDEX IF NOT EXISTS idx_orders_channel ON orders(channel);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_order_id ON audit_log(order_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_channel ON audit_log(channel);
CREATE INDEX IF NOT EXISTS idx_carts_session_id ON carts(session_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_simulation_runs_created_at ON simulation_runs(created_at);
CREATE INDEX IF NOT EXISTS idx_simulation_events_simulation_id ON simulation_events(simulation_id);
