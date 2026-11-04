/** 纯函数只操作示例目录；正式支付必须由服务端重新计价和校验。 */
export function normalizeCart(value, products) {
  if (!Array.isArray(value)) return [];
  const known = new Set(products.map(p=>p.id));
  const items = new Map();
  for (const item of value.slice(0,100)) {
    if (!item || typeof item !== 'object' || !known.has(item.id) || !Number.isFinite(item.quantity) || item.quantity < 1) continue;
    const quantity = Math.min(10,Math.trunc(item.quantity));
    items.set(item.id,Math.min(10,(items.get(item.id) || 0)+quantity));
  }
  return [...items].map(([id,quantity])=>({id,quantity}));
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
