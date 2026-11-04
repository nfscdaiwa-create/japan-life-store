import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../worker/index.mjs';

const schema = readFileSync(new URL('../migrations/0001_initial.sql', import.meta.url), 'utf8');
const request = (path, options) => new Request(`https://store.test${path}`, options);

// 用真实 SQLite 执行迁移和查询；只把 D1 的异步调用形状适配到本地。
function database() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON');
  sqlite.exec(schema);
  const DB = {
    prepare(sql) {
      const statement = sqlite.prepare(sql);
      let values = [];
      const prepared = {
        bind(...args) { values = args; return prepared; },
        async all() { return { success: true, results: statement.all(...values) }; },
        async first() { return statement.get(...values) ?? null; },
      };
      return prepared;
    },
  };
  return { sqlite, DB };
}

function seed(sqlite) {
  sqlite.exec(`
    INSERT INTO categories (id, slug, name) VALUES ('c1', 'kitchen', '餐厨器具');
    INSERT INTO categories (id, slug, name, is_active) VALUES ('c2', 'hidden', '未开放分类', 0);
    INSERT INTO products (id, category_id, slug, name, sourcing_country, status, is_featured)
      VALUES ('p1', 'c1', 'white-cup', '白色陶杯', 'JP', 'active', 1);
    INSERT INTO products (id, category_id, slug, name, status)
      VALUES ('p2', 'c1', 'cotton-cloth', '棉布 100%', 'active'),
             ('p3', 'c1', 'draft-cup', '草稿陶杯', 'draft'),
             ('p4', 'c2', 'hidden-cup', '隐藏陶杯', 'active'),
             ('p5', 'c1', 'no-variant', '缺少规格的陶杯', 'active');
    INSERT INTO product_variants (id, product_id, sku, name, price_minor, attributes_json, status)
      VALUES ('v1', 'p1', 'CUP-W', '白色', 2500, '{"color":"白色"}', 'active'),
             ('v2', 'p1', 'CUP-D', '草稿规格', 1, '{}', 'draft'),
             ('v3', 'p2', 'CLOTH', '标准规格', 1200, '{}', 'active'),
             ('v4', 'p3', 'DRAFT', '标准规格', 1200, '{}', 'active'),
             ('v5', 'p4', 'HIDDEN', '标准规格', 1200, '{}', 'active');
    INSERT INTO inventory (variant_id, on_hand, reserved)
      VALUES ('v1', 5, 2), ('v2', 999, 0), ('v3', 0, 0);
    INSERT INTO product_images (id, product_id, variant_id, object_key, alt_text)
      VALUES ('im1', 'p1', 'v1', 'products/white-cup.webp', '白色陶杯正面');
  `);
}

test('未配置的健康状态明确关闭交易和管理，API 不缓存且禁止索引', async () => {
  const response = await worker.fetch(request('/api/health'), {});
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
  assert.deepEqual(body.data.catalog, { configured: false });
  assert.deepEqual(body.data.storage, { configured: false });
  assert.deepEqual(body.data.checkout, { enabled: false });
  assert.deepEqual(body.data.admin, { enabled: false });
});

test('无 D1 时目录与商品详情均返回 503，不返回演示库存', async () => {
  for (const path of ['/api/catalog', '/api/products/white-cup']) {
    const response = await worker.fetch(request(path), {});
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      ok: false, error: { code: 'CATALOG_NOT_CONFIGURED', message: '正式商品目录尚未接入' },
    });
  }
});

test('管理接口不能被伪造的认证请求头开启', async () => {
  for (const path of ['/api/admin', '/api/admin/products', '/api/admin/orders']) {
    const incoming = request(path, {
      method: 'POST', headers: { authorization: 'Bearer pretend-admin', 'CF-Access-Jwt-Assertion': 'unverified' },
      body: '{"name":"should-not-be-read"}',
    });
    const response = await worker.fetch(incoming, { ADMIN_ENABLED: true });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error.code, 'ADMIN_NOT_CONFIGURED');
    assert.equal(incoming.bodyUsed, false);
  }
});

test('结算不读取个人信息、不操作数据库，也不伪造付款成功', async () => {
  let databaseTouched = false;
  const incoming = request('/api/checkout', {
    method: 'POST', body: '{"name":"private-person","address":"private-address"}',
  });
  const response = await worker.fetch(incoming, {
    CHECKOUT_ENABLED: true,
    DB: { prepare() { databaseTouched = true; throw new Error('must not run'); } },
  });
  const body = await response.text();
  assert.equal(response.status, 503);
  assert.match(body, /CHECKOUT_NOT_CONFIGURED/);
  assert.doesNotMatch(body, /private-person|private-address|orderId|paymentUrl/);
  assert.equal(incoming.bodyUsed, false);
  assert.equal(databaseTouched, false);
});

test('API 的错误方法和未知路径不会回退成成功的网页', async () => {
  let assetsTouched = false;
  const env = { ASSETS: { async fetch() { assetsTouched = true; return new Response('website'); } } };
  const wrongMethod = await worker.fetch(request('/api/catalog', { method: 'POST' }), env);
  assert.equal(wrongMethod.status, 405);
  assert.equal(wrongMethod.headers.get('allow'), 'GET, HEAD');
  const wrongCheckoutMethod = await worker.fetch(request('/api/checkout'), env);
  assert.equal(wrongCheckoutMethod.status, 405);
  const missing = await worker.fetch(request('/api/does-not-exist'), env);
  assert.equal(missing.status, 404);
  assert.equal(assetsTouched, false);
});

test('目录只显示已开放商品，库存扣除预留且排除草稿规格', async (t) => {
  const { sqlite, DB } = database();
  t.after(() => sqlite.close());
  seed(sqlite);
  const first = await (await worker.fetch(request('/api/catalog?limit=1'), { DB })).json();
  assert.equal(first.ok, true);
  assert.equal(first.data.products.length, 1);
  assert.equal(first.data.products[0].slug, 'white-cup');
  assert.equal(first.data.products[0].priceMinor, 2500);
  assert.equal(first.data.products[0].currencyMinorUnit, 0);
  assert.equal(first.data.products[0].availableQuantity, 3);
  assert.equal(first.data.products[0].originCountry, null);
  assert.equal(first.data.products[0].sourcingCountry, 'JP');
  assert.deepEqual(first.data.pagination, { limit: 1, offset: 0, hasMore: true });
  assert.equal(first.data.categories.length, 1);
  const second = await (await worker.fetch(request('/api/catalog?limit=1&offset=1'), { DB })).json();
  assert.equal(second.data.products[0].slug, 'cotton-cloth');
  assert.equal(second.data.pagination.hasMore, false);
});

test('搜索参数绑定，百分号为普通文字，分页与搜索长度有上限', async (t) => {
  const { sqlite, DB } = database();
  t.after(() => sqlite.close());
  seed(sqlite);
  for (const query of ['%', '100%']) {
    const body = await (await worker.fetch(request(`/api/catalog?q=${encodeURIComponent(query)}`), { DB })).json();
    assert.deepEqual(body.data.products.map((p) => p.slug), ['cotton-cloth']);
  }
  const injection = await (await worker.fetch(request(`/api/catalog?q=${encodeURIComponent("' OR 1=1 --")}`), { DB })).json();
  assert.deepEqual(injection.data.products, []);
  for (const path of [
    '/api/catalog?limit=49', '/api/catalog?limit=-1', '/api/catalog?offset=10001',
    '/api/catalog?limit=1.5', '/api/catalog?category=bad%2Fslug', `/api/catalog?q=${'a'.repeat(81)}`,
  ]) {
    assert.equal((await worker.fetch(request(path), { DB })).status, 400);
  }
});

test('商品详情返回真实规格和图片引用，草稿与隐藏商品不能直接访问', async (t) => {
  const { sqlite, DB } = database();
  t.after(() => sqlite.close());
  seed(sqlite);
  const result = await (await worker.fetch(request('/api/products/white-cup'), { DB })).json();
  assert.equal(result.data.product.variants.length, 1);
  assert.deepEqual(result.data.product.variants[0].attributes, { color: '白色' });
  assert.equal(result.data.product.images[0].objectKey, 'products/white-cup.webp');
  for (const slug of ['draft-cup', 'hidden-cup', 'no-variant', 'missing']) {
    assert.equal((await worker.fetch(request(`/api/products/${slug}`), { DB })).status, 404);
  }
});

test('公开封面与图片列表排除未开放规格图片，保留商品级和活跃规格图片', async (t) => {
  const { sqlite, DB } = database();
  t.after(() => sqlite.close());
  seed(sqlite);
  sqlite.exec(`
    UPDATE product_images SET sort_order = 30 WHERE id = 'im1';
    INSERT INTO product_variants (id, product_id, sku, price_minor, status)
      VALUES ('v-archived', 'p1', 'CUP-ARCHIVED', 2500, 'archived');
    INSERT INTO product_images (id, product_id, variant_id, object_key, alt_text, sort_order)
      VALUES ('im-draft', 'p1', 'v2', 'draft/unreleased.webp', '未开放规格图片', 0),
             ('im-archived', 'p1', 'v-archived', 'archived/old.webp', '已下架规格图片', 1),
             ('im-shared', 'p1', NULL, 'products/cup-overview.webp', '商品整体图片', 20);
  `);

  const inspect = async (expectedImages, expectedAlt) => {
    const catalog = await (await worker.fetch(request('/api/catalog'), { DB })).json();
    const listing = catalog.data.products.find(item => item.id === 'p1');
    const detail = await (await worker.fetch(request('/api/products/white-cup'), { DB })).json();
    assert.equal(listing.imageKey, expectedImages[0] ?? null);
    assert.equal(listing.imageAlt, expectedAlt);
    assert.equal(detail.data.product.imageKey, expectedImages[0] ?? null);
    assert.equal(detail.data.product.imageAlt, expectedAlt);
    assert.deepEqual(detail.data.product.images.map(item => item.objectKey), expectedImages);
    assert.deepEqual(detail.data.product.variants.map(item => item.id), ['v1']);
  };

  await inspect(['products/cup-overview.webp', 'products/white-cup.webp'], '商品整体图片');
  sqlite.exec("DELETE FROM product_images WHERE id = 'im-shared'");
  await inspect(['products/white-cup.webp'], '白色陶杯正面');
  sqlite.exec("DELETE FROM product_images WHERE id = 'im1'");
  await inspect([], null);
});

test('数据库失败统一为 503，SQL 和异常内容不会泄露', async () => {
  const DB = { prepare() { throw new Error('SELECT private_email FROM secrets; token=do-not-leak'); } };
  for (const path of ['/api/catalog', '/api/products/white-cup']) {
    const response = await worker.fetch(request(path), { DB });
    const body = await response.text();
    assert.equal(response.status, 503);
    assert.match(body, /CATALOG_UNAVAILABLE/);
    assert.doesNotMatch(body, /private_email|secrets|token|SELECT/);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
});

test('迁移不植入经营数据，并约束库存、金额、币种和支付事件幂等', (t) => {
  const { sqlite } = database();
  t.after(() => sqlite.close());
  for (const table of ['products', 'inventory', 'orders', 'payment_events']) {
    assert.equal(sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n, 0);
  }
  seed(sqlite);
  assert.throws(() => sqlite.prepare('UPDATE inventory SET on_hand = -1 WHERE variant_id = ?').run('v1'), /CHECK/);
  assert.throws(() => sqlite.prepare('UPDATE inventory SET reserved = 6 WHERE variant_id = ?').run('v1'), /CHECK/);
  assert.throws(() => sqlite.prepare('UPDATE product_variants SET price_minor = 1.5 WHERE id = ?').run('v1'), /CHECK/);
  assert.throws(() => sqlite.prepare('UPDATE product_variants SET currency = ? WHERE id = ?').run('USD', 'v1'), /FOREIGN KEY/);
  const insertEvent = sqlite.prepare(`INSERT INTO payment_events
    (id, provider, event_id, event_type, payload_sha256, verified_at) VALUES (?, ?, ?, ?, ?, ?)`);
  const args = ['provider-a', 'event-1', 'payment.test', 'a'.repeat(64), '2026-11-04T00:00:00Z'];
  insertEvent.run('e1', ...args);
  assert.throws(() => insertEvent.run('e2', ...args), /UNIQUE/);
  insertEvent.run('e3', 'provider-b', ...args.slice(1));
  assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(), []);
});

test('订单明细保存成交快照，错误总价不能写入', (t) => {
  const { sqlite } = database();
  t.after(() => sqlite.close());
  seed(sqlite);
  sqlite.exec(`INSERT INTO orders
    (id, order_number, checkout_idempotency_key, currency, currency_minor_unit, subtotal_minor, total_minor)
    VALUES ('o1', 'TEST-1', 'idempotency-1', 'JPY', 0, 5000, 5000)`);
  sqlite.exec(`INSERT INTO order_items
    (id, order_id, product_id, variant_id, product_name, variant_name, sku, quantity, unit_price_minor, currency, line_total_minor)
    VALUES ('oi1', 'o1', 'p1', 'v1', '成交时的白色陶杯', '白色', 'CUP-W', 2, 2500, 'JPY', 5000)`);
  sqlite.exec("UPDATE products SET name = '修改后的商品名称' WHERE id = 'p1'");
  assert.equal(sqlite.prepare("SELECT product_name FROM order_items WHERE id = 'oi1'").get().product_name, '成交时的白色陶杯');
  assert.throws(() => sqlite.exec("UPDATE order_items SET line_total_minor = 4999 WHERE id = 'oi1'"), /CHECK/);
  assert.throws(() => sqlite.exec("UPDATE orders SET total_minor = 4999 WHERE id = 'o1'"), /CHECK/);
});

test('静态页面委托 ASSETS，HEAD 响应没有正文', async () => {
  let fetchedPath;
  const env = { ASSETS: { async fetch(incoming) { fetchedPath = new URL(incoming.url).pathname; return new Response('page'); } } };
  assert.equal(await (await worker.fetch(request('/products/white-cup/'), env)).text(), 'page');
  assert.equal(fetchedPath, '/products/white-cup/');
  const head = await worker.fetch(request('/api/health', { method: 'HEAD' }), {});
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
});
