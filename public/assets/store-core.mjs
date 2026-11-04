/** 纯函数只操作示例目录；正式支付必须由服务端重新计价和校验。 */
export const MAX_DEMO_QUANTITY = 10;

/** 输入控件允许字符串；存储资料仍由 normalizeCart 严格检查数值类型。 */
export function clampDemoQuantity(value, fallback = 1) {
  const number = typeof value === 'string' && value.trim() === '' ? NaN : Number(value);
  const safeFallback = Number.isFinite(fallback) ? fallback : 1;
  return Math.max(1, Math.min(MAX_DEMO_QUANTITY, Math.trunc(Number.isFinite(number) ? number : safeFallback)));
}

/** 颜色属于示例选项，不代表已接入真实 SKU 或库存。 */
export function cartItemKey(item) {
  return `${encodeURIComponent(item.id)}:${encodeURIComponent(item.color || '')}`;
}

export function normalizeCart(value, products) {
  if (!Array.isArray(value)) return [];
  const catalog = new Map(products.map(p=>[p.id,p]));
  const items = new Map();
  for (const item of value.slice(0,100)) {
    if (!item || typeof item !== 'object' || !catalog.has(item.id) || !Number.isFinite(item.quantity) || item.quantity < 1) continue;
    const product = catalog.get(item.id);
    const colors = Array.isArray(product.colors) ? product.colors.filter(color=>typeof color === 'string' && color.length) : [];
    // 旧版条目没有颜色，迁移到当前首个展示颜色；明确无效的颜色不偷偷替换。
    const color = item.color === undefined ? (colors[0] || '') : item.color;
    if (colors.length ? !colors.includes(color) : color !== '') continue;
    const normalized = { id:item.id, color, quantity:clampDemoQuantity(item.quantity) };
    const key = cartItemKey(normalized);
    const existing = items.get(key);
    if (existing) existing.quantity = Math.min(MAX_DEMO_QUANTITY, existing.quantity + normalized.quantity);
    else items.set(key, normalized);
  }
  return [...items.values()];
}
export function normalizeFavorites(value,products) {
  if (!Array.isArray(value)) return [];
  const known = new Set(products.map(p=>p.id));
  return [...new Set(value.filter(id=>typeof id === 'string' && known.has(id)))];
}
export function cartTotal(items,products) {
  const catalog = new Map(products.map(p=>[p.id,p]));
  return normalizeCart(items,products).reduce((sum,item)=>sum+catalog.get(item.id).priceMinor*item.quantity,0);
}
export function filterProducts(products,categories,options={}) {
  const normalized = String(options.q || '').normalize('NFKC').trim().toLocaleLowerCase('zh-CN');
  let found = products.filter(p=>{
    if (categories.some(c=>c.id===options.category) && p.category !== options.category) return false;
    if (['table','home','tea','outdoor'].includes(options.scene) && p.scene !== options.scene) return false;
    if (Array.isArray(options.ids) && !options.ids.includes(p.id)) return false;
    const category = categories.find(c=>c.id===p.category)?.name || '';
    const haystack = `${p.name} ${p.subtitle} ${p.description} ${p.tag} ${category}`.normalize('NFKC').toLocaleLowerCase('zh-CN');
    if (normalized && !haystack.includes(normalized)) return false;
    const min = options.min === '' || options.min == null ? null : Number(options.min);
    const max = options.max === '' || options.max == null ? null : Number(options.max);
    if (Number.isFinite(min) && min >= 0 && p.priceMinor < min) return false;
    if (Number.isFinite(max) && max >= 0 && p.priceMinor > max) return false;
    return true;
  });
  if (options.sort==='price-asc') found.sort((a,b)=>a.priceMinor-b.priceMinor);
  if (options.sort==='price-desc') found.sort((a,b)=>b.priceMinor-a.priceMinor);
  if (options.sort==='name') found.sort((a,b)=>a.name.localeCompare(b.name,'zh-CN'));
  return found;
}
