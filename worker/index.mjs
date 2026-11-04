/**
 * 日本精品生活馆：Cloudflare Worker 基础层。
 * 本阶段只开放真实商品的读取；付款和管理写入保持关闭。
 * 不读取、记录或转发结算请求中的姓名、地址、支付资料。
 */

const API_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

const PRODUCT_SELECT = `
  SELECT p.id, p.slug, p.name, p.description, p.brand,
    p.origin_country AS originCountry, p.sourcing_country AS sourcingCountry,
    p.currency, p.currency_minor_unit AS currencyMinorUnit,
    p.is_featured AS isFeatured, p.created_at AS createdAt,
    c.id AS categoryId, c.slug AS categorySlug, c.name AS categoryName,
    (SELECT MIN(v.price_minor) FROM product_variants v
      WHERE v.product_id = p.id AND v.status = 'active') AS priceMinor,
    (SELECT im.object_key FROM product_images im
      WHERE im.product_id = p.id ORDER BY im.sort_order, im.id LIMIT 1) AS imageKey,
    (SELECT im.alt_text FROM product_images im
      WHERE im.product_id = p.id ORDER BY im.sort_order, im.id LIMIT 1) AS imageAlt,
    COALESCE((SELECT SUM(i.on_hand - i.reserved)
      FROM product_variants v JOIN inventory i ON i.variant_id = v.id
      WHERE v.product_id = p.id AND v.status = 'active'), 0) AS availableQuantity
  FROM products p
  JOIN categories c ON c.id = p.category_id AND c.is_active = 1
  WHERE p.status = 'active'
    AND EXISTS (SELECT 1 FROM product_variants v
      WHERE v.product_id = p.id AND v.status = 'active')
`;

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...API_HEADERS, ...headers },
  });
}

function error(status, code, message, headers = {}) {
  return json({ ok: false, error: { code, message } }, status, headers);
}

function methodNotAllowed(allow) {
  return error(405, 'METHOD_NOT_ALLOWED', '此接口不支持该请求方式', { Allow: allow });
}

function isReadMethod(request) {
  return request.method === 'GET' || request.method === 'HEAD';
}

function hasDatabase(env) {
  return typeof env.DB?.prepare === 'function';
}

function unavailableDatabase() {
  return error(503, 'CATALOG_NOT_CONFIGURED', '正式商品目录尚未接入');
}

function validSlug(value) {
  return value.length <= 120 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function readInteger(value, fallback, min, max) {
  if (value === null) return fallback;
  if (!/^\d+$/.test(value)) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= min && number <= max ? number : null;
}

function normalizeProduct(row) {
  return { ...row, isFeatured: row.isFeatured === 1 };
}

async function catalog(request, env, url) {
  if (!isReadMethod(request)) return methodNotAllowed('GET, HEAD');
  const limit = readInteger(url.searchParams.get('limit'), 24, 1, 48);
  const offset = readInteger(url.searchParams.get('offset'), 0, 0, 10000);
  const category = url.searchParams.get('category') || '';
  const query = (url.searchParams.get('q') || '').trim();
  if (limit === null || offset === null || query.length > 80 || (category && !validSlug(category))) {
    return error(400, 'INVALID_QUERY', '请检查分类、搜索词和分页参数');
  }
  if (!hasDatabase(env)) return unavailableDatabase();

  const parameters = [];
  let sql = PRODUCT_SELECT;
  if (category) {
    sql += ' AND c.slug = ?';
    parameters.push(category);
  }
  if (query) {
    // 把通配符作为普通搜索文字；所有用户输入仅通过 bind 传入。
    const escaped = query.replace(/[\\%_]/g, '\\$&');
    sql += " AND (p.name LIKE ? ESCAPE '\\' OR p.brand LIKE ? ESCAPE '\\')";
    parameters.push(`%${escaped}%`, `%${escaped}%`);
  }
  sql += ' ORDER BY p.is_featured DESC, p.created_at DESC, p.id LIMIT ? OFFSET ?';
  parameters.push(limit + 1, offset);

  try {
    const [productResult, categoryResult] = await Promise.all([
      env.DB.prepare(sql).bind(...parameters).all(),
      env.DB.prepare(`SELECT id, slug, name, sort_order AS sortOrder
        FROM categories WHERE is_active = 1 ORDER BY sort_order, id LIMIT 100`).all(),
    ]);
    if (!productResult.success || !categoryResult.success) throw new Error('catalog-read-failed');
    return json({
      ok: true,
      data: {
        products: productResult.results.slice(0, limit).map(normalizeProduct),
        categories: categoryResult.results,
        pagination: { limit, offset, hasMore: productResult.results.length > limit },
      },
    });
  } catch {
    // 配额、迁移和连接异常统一返回可处理的状态，不泄露 SQL 或请求内容。
    return error(503, 'CATALOG_UNAVAILABLE', '商品目录暂时无法读取，请稍后再试');
  }
}

async function product(request, env, encodedSlug) {
  if (!isReadMethod(request)) return methodNotAllowed('GET, HEAD');
  let slug;
  try {
    slug = decodeURIComponent(encodedSlug);
  } catch {
    return error(400, 'INVALID_SLUG', '商品地址格式不正确');
  }
  if (!validSlug(slug)) return error(404, 'PRODUCT_NOT_FOUND', '未找到该商品');
  if (!hasDatabase(env)) return unavailableDatabase();
  try {
    const row = await env.DB.prepare(`${PRODUCT_SELECT} AND p.slug = ? LIMIT 1`).bind(slug).first();
    if (!row) return error(404, 'PRODUCT_NOT_FOUND', '未找到该商品');
    const [variantResult, imageResult] = await Promise.all([
      env.DB.prepare(`SELECT v.id, v.sku, v.name, v.price_minor AS priceMinor,
          v.currency, v.attributes_json AS attributesJson,
          COALESCE(i.on_hand - i.reserved, 0) AS availableQuantity
        FROM product_variants v LEFT JOIN inventory i ON i.variant_id = v.id
        WHERE v.product_id = ? AND v.status = 'active' ORDER BY v.sort_order, v.id`).bind(row.id).all(),
      env.DB.prepare(`SELECT id, variant_id AS variantId, object_key AS objectKey,
          alt_text AS alt, width, height, sort_order AS sortOrder
        FROM product_images WHERE product_id = ? ORDER BY sort_order, id`).bind(row.id).all(),
    ]);
    if (!variantResult.success || !imageResult.success) throw new Error('product-read-failed');
    const variants = variantResult.results.map(({ attributesJson, ...variant }) => ({
      ...variant,
      currencyMinorUnit: row.currencyMinorUnit,
      attributes: JSON.parse(attributesJson),
    }));
    return json({ ok: true, data: { product: { ...normalizeProduct(row), variants, images: imageResult.results } } });
  } catch {
    return error(503, 'CATALOG_UNAVAILABLE', '商品目录暂时无法读取，请稍后再试');
  }
}

async function route(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === '/api/admin' || path.startsWith('/api/admin/')) {
    // 未接入并验证真正的管理身份前，任何请求头都不能开启管理接口。
    return error(503, 'ADMIN_NOT_CONFIGURED', '正式管理后台尚未开放');
  }

  if (path === '/api/checkout') {
    if (request.method !== 'POST') return methodNotAllowed('POST');
    // 不解析请求体，不创建订单，不生成付款成功或付款链接。
    return error(503, 'CHECKOUT_NOT_CONFIGURED', '商店筹备中，暂未开放下单与支付');
  }

  if (path === '/api/health') {
    if (!isReadMethod(request)) return methodNotAllowed('GET, HEAD');
    return json({
      ok: true,
      data: {
        service: 'japan-life-store',
        stage: 'framework',
        catalog: { configured: hasDatabase(env) },
        storage: { configured: typeof env.MEDIA?.get === 'function' },
        checkout: { enabled: false },
        admin: { enabled: false },
      },
    });
  }

  if (path === '/api/catalog') return catalog(request, env, url);
  if (path.startsWith('/api/products/')) return product(request, env, path.slice('/api/products/'.length));
  if (path === '/api' || path.startsWith('/api/')) return error(404, 'API_NOT_FOUND', '未找到该接口');

  if (!isReadMethod(request)) return methodNotAllowed('GET, HEAD');
  if (typeof env.ASSETS?.fetch !== 'function') {
    return error(503, 'STATIC_NOT_CONFIGURED', '网站资源尚未配置');
  }
  try {
    return await env.ASSETS.fetch(request);
  } catch {
    return error(503, 'STATIC_UNAVAILABLE', '网站资源暂时无法读取');
  }
}

export default {
  async fetch(request, env = {}) {
    const response = await route(request, env);
    if (request.method === 'HEAD') return new Response(null, { status: response.status, headers: response.headers });
    return response;
  },
};
