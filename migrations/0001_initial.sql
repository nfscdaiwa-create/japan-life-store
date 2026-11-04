-- 日本精品生活馆：首版 D1 结构。
-- D1 默认启用外键；迁移不插入商品、库存、订单或虚构经营数据。

CREATE TABLE categories (
  id TEXT PRIMARY KEY NOT NULL CHECK(length(id) BETWEEN 1 AND 64),
  parent_id TEXT REFERENCES categories(id) ON DELETE RESTRICT,
  slug TEXT NOT NULL UNIQUE CHECK(length(slug) BETWEEN 1 AND 120),
  name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 100),
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK(typeof(sort_order) = 'integer' AND sort_order >= 0),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK(parent_id IS NULL OR parent_id <> id)
);

CREATE TABLE products (
  id TEXT PRIMARY KEY NOT NULL CHECK(length(id) BETWEEN 1 AND 64),
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  slug TEXT NOT NULL UNIQUE CHECK(length(slug) BETWEEN 1 AND 120),
  name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 200),
  description TEXT NOT NULL DEFAULT '' CHECK(length(description) <= 20000),
  brand TEXT NOT NULL DEFAULT '' CHECK(length(brand) <= 120),
  -- 日本采购不等于日本制造；未经核实的国家字段留空。
  origin_country TEXT CHECK(origin_country IS NULL OR origin_country GLOB '[A-Z][A-Z]'),
  sourcing_country TEXT CHECK(sourcing_country IS NULL OR sourcing_country GLOB '[A-Z][A-Z]'),
  currency TEXT NOT NULL DEFAULT 'JPY' CHECK(currency GLOB '[A-Z][A-Z][A-Z]'),
  currency_minor_unit INTEGER NOT NULL DEFAULT 0 CHECK(typeof(currency_minor_unit) = 'integer' AND currency_minor_unit BETWEEN 0 AND 4),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'active', 'archived')),
  is_featured INTEGER NOT NULL DEFAULT 0 CHECK(is_featured IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE(id, currency)
);

CREATE TABLE product_variants (
  id TEXT PRIMARY KEY NOT NULL CHECK(length(id) BETWEEN 1 AND 64),
  product_id TEXT NOT NULL,
  sku TEXT NOT NULL UNIQUE CHECK(length(trim(sku)) BETWEEN 1 AND 100),
  name TEXT NOT NULL DEFAULT '标准规格' CHECK(length(trim(name)) BETWEEN 1 AND 100),
  attributes_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(attributes_json) AND json_type(attributes_json) = 'object'),
  -- 金额使用币种的最小单位；JPY 的 1200 代表 1200 日元。
  price_minor INTEGER NOT NULL CHECK(typeof(price_minor) = 'integer' AND price_minor BETWEEN 0 AND 9007199254740991),
  currency TEXT NOT NULL DEFAULT 'JPY' CHECK(currency GLOB '[A-Z][A-Z][A-Z]'),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'active', 'archived')),
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK(typeof(sort_order) = 'integer' AND sort_order >= 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY(product_id, currency) REFERENCES products(id, currency) ON DELETE CASCADE,
  UNIQUE(id, product_id)
);

CREATE TABLE product_images (
  id TEXT PRIMARY KEY NOT NULL CHECK(length(id) BETWEEN 1 AND 64),
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id TEXT,
  object_key TEXT NOT NULL CHECK(length(object_key) BETWEEN 1 AND 512),
  alt_text TEXT NOT NULL DEFAULT '' CHECK(length(alt_text) <= 300),
  width INTEGER CHECK(width IS NULL OR (typeof(width) = 'integer' AND width > 0)),
  height INTEGER CHECK(height IS NULL OR (typeof(height) = 'integer' AND height > 0)),
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK(typeof(sort_order) = 'integer' AND sort_order >= 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY(variant_id, product_id) REFERENCES product_variants(id, product_id) ON DELETE RESTRICT,
  UNIQUE(product_id, object_key)
);

CREATE TABLE inventory (
  variant_id TEXT PRIMARY KEY NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  on_hand INTEGER NOT NULL DEFAULT 0 CHECK(typeof(on_hand) = 'integer' AND on_hand BETWEEN 0 AND 1000000000),
  reserved INTEGER NOT NULL DEFAULT 0 CHECK(typeof(reserved) = 'integer' AND reserved BETWEEN 0 AND on_hand),
  low_stock_threshold INTEGER NOT NULL DEFAULT 5 CHECK(typeof(low_stock_threshold) = 'integer' AND low_stock_threshold >= 0),
  revision INTEGER NOT NULL DEFAULT 0 CHECK(typeof(revision) = 'integer' AND revision >= 0),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE orders (
  id TEXT PRIMARY KEY NOT NULL CHECK(length(id) BETWEEN 1 AND 64),
  order_number TEXT NOT NULL UNIQUE CHECK(length(order_number) BETWEEN 1 AND 64),
  checkout_idempotency_key TEXT NOT NULL UNIQUE CHECK(length(checkout_idempotency_key) BETWEEN 1 AND 200),
  -- 仅保留未来身份/配送服务的引用，不在此版接受姓名、电话或地址。
  customer_reference TEXT,
  shipping_reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'shipped', 'completed', 'cancelled')),
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK(payment_status IN ('unpaid', 'pending', 'paid', 'failed', 'partially_refunded', 'refunded')),
  currency TEXT NOT NULL CHECK(currency GLOB '[A-Z][A-Z][A-Z]'),
  currency_minor_unit INTEGER NOT NULL CHECK(typeof(currency_minor_unit) = 'integer' AND currency_minor_unit BETWEEN 0 AND 4),
  subtotal_minor INTEGER NOT NULL CHECK(typeof(subtotal_minor) = 'integer' AND subtotal_minor BETWEEN 0 AND 9007199254740991),
  shipping_minor INTEGER NOT NULL DEFAULT 0 CHECK(typeof(shipping_minor) = 'integer' AND shipping_minor BETWEEN 0 AND 9007199254740991),
  tax_minor INTEGER NOT NULL DEFAULT 0 CHECK(typeof(tax_minor) = 'integer' AND tax_minor BETWEEN 0 AND 9007199254740991),
  discount_minor INTEGER NOT NULL DEFAULT 0 CHECK(typeof(discount_minor) = 'integer' AND discount_minor BETWEEN 0 AND 9007199254740991),
  total_minor INTEGER NOT NULL CHECK(typeof(total_minor) = 'integer' AND total_minor BETWEEN 0 AND 9007199254740991),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  paid_at TEXT,
  CHECK(total_minor = subtotal_minor + shipping_minor + tax_minor - discount_minor),
  UNIQUE(id, currency)
);

CREATE TABLE order_items (
  id TEXT PRIMARY KEY NOT NULL CHECK(length(id) BETWEEN 1 AND 64),
  order_id TEXT NOT NULL,
  product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  variant_id TEXT REFERENCES product_variants(id) ON DELETE SET NULL,
  -- 商品改名或下架后，订单仍保留成交时的名称、SKU 与单价。
  product_name TEXT NOT NULL CHECK(length(trim(product_name)) BETWEEN 1 AND 200),
  variant_name TEXT NOT NULL DEFAULT '',
  sku TEXT NOT NULL CHECK(length(trim(sku)) BETWEEN 1 AND 100),
  quantity INTEGER NOT NULL CHECK(typeof(quantity) = 'integer' AND quantity BETWEEN 1 AND 1000000),
  unit_price_minor INTEGER NOT NULL CHECK(typeof(unit_price_minor) = 'integer' AND unit_price_minor BETWEEN 0 AND 9007199254740991),
  currency TEXT NOT NULL CHECK(currency GLOB '[A-Z][A-Z][A-Z]'),
  line_total_minor INTEGER NOT NULL CHECK(typeof(line_total_minor) = 'integer' AND line_total_minor BETWEEN 0 AND 9007199254740991),
  CHECK(line_total_minor = quantity * unit_price_minor),
  FOREIGN KEY(order_id, currency) REFERENCES orders(id, currency) ON DELETE RESTRICT
);

CREATE TABLE payment_events (
  id TEXT PRIMARY KEY NOT NULL CHECK(length(id) BETWEEN 1 AND 64),
  provider TEXT NOT NULL CHECK(length(provider) BETWEEN 1 AND 50),
  event_id TEXT NOT NULL CHECK(length(event_id) BETWEEN 1 AND 255),
  order_id TEXT REFERENCES orders(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL CHECK(length(event_type) BETWEEN 1 AND 120),
  processing_status TEXT NOT NULL DEFAULT 'received' CHECK(processing_status IN ('received', 'processed', 'ignored', 'failed')),
  -- 未来实现须先验证支付方签名；仅存摘要，不能把支付原文或个人信息写入日志。
  payload_sha256 TEXT NOT NULL CHECK(length(payload_sha256) = 64 AND payload_sha256 NOT GLOB '*[^0-9a-f]*'),
  verified_at TEXT NOT NULL,
  received_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  processed_at TEXT,
  UNIQUE(provider, event_id)
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY NOT NULL CHECK(length(key) BETWEEN 1 AND 100),
  value_json TEXT NOT NULL CHECK(json_valid(value_json)),
  visibility TEXT NOT NULL DEFAULT 'internal' CHECK(visibility IN ('public', 'internal')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_categories_parent ON categories(parent_id, sort_order);
CREATE INDEX idx_products_listing ON products(status, is_featured DESC, created_at DESC, id);
CREATE INDEX idx_products_category ON products(category_id, status, is_featured DESC, created_at DESC, id);
CREATE INDEX idx_variants_product ON product_variants(product_id, status, price_minor);
CREATE INDEX idx_images_product ON product_images(product_id, sort_order, id);
CREATE INDEX idx_orders_status ON orders(status, created_at);
CREATE INDEX idx_orders_payment ON orders(payment_status, created_at);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_payment_events_order ON payment_events(order_id, received_at);
