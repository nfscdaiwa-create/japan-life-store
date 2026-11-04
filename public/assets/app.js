import { normalizeCart, normalizeFavorites, cartTotal, filterProducts, cartItemKey, clampDemoQuantity, MAX_DEMO_QUANTITY } from './store-core.mjs';

const dataElement = document.getElementById('shop-data');
const { products, categories, page, adminSections } = JSON.parse(dataElement.textContent);
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const esc = (v) => String(v).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const money = v => new Intl.NumberFormat('zh-CN', { style:'currency', currency:'JPY', currencyDisplay:'narrowSymbol', maximumFractionDigits:0 }).format(v);
const symbols = {
  heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  arrow:'<path d="M4 12h15m-5-5 5 5-5 5"/>',
  plus:'<path d="M5 12h14M12 5v14"/>', minus:'<path d="M5 12h14"/>',
  bag:'<path d="M5 7h14l1 14H4L5 7Z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/>',
  box:'<path d="m3 7 9-4 9 4v11l-9 4-9-4V7ZM3 7l9 4 9-4M12 11v11"/>',
  chart:'<path d="M4 3v18h17M8 17v-5M13 17V8M18 17V4"/>',
};
const icon = name => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${symbols[name] || symbols.box}</svg>`;
const CART_KEY = 'japan-life.preview-cart.v1';
const FAV_KEY = 'japan-life.preview-favorites.v1';
let storageAvailable = true;
function read(key, fallback = null) {
  let raw;
  try { raw = localStorage.getItem(key); }
  catch { storageAvailable = false; return fallback; }
  // 单条损坏的 JSON 不等于浏览器禁用了存储。
  try { return JSON.parse(raw); } catch { return null; }
}
let cart = normalizeCart(read(CART_KEY), products);
let favorites = normalizeFavorites(read(FAV_KEY), products);
let toastTimer;
function toast(message) {
  const el = $('#toast');
  if (!el) return;
  clearTimeout(toastTimer);
  el.textContent = message;
  el.classList.add('visible');
  toastTimer = setTimeout(() => el.classList.remove('visible'), 3200);
}
function persist(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); storageAvailable = true; return true; }
  catch { storageAvailable = false; toast('浏览器限制了本地保存，本次选择仅在当前页面保留'); return false; }
}
function isSavedCatalog() {
  return page === 'catalog' && Object.fromEntries(new URLSearchParams(location.search)).saved === '1';
}
function syncBadges() {
  const qty = cart.reduce((sum,item) => sum + item.quantity, 0);
  $$('[data-cart-count]').forEach(el => { el.textContent = String(qty); el.hidden = qty === 0; });
  $$('[data-favorite]').forEach(el => {
    const id = el.dataset.favorite;
    const isFavorite = favorites.includes(id);
    const product = products.find(p => p.id === id);
    el.setAttribute('aria-pressed', String(isFavorite));
    el.setAttribute('aria-label', `${isFavorite ? '取消收藏' : '收藏'}${product?.name || ''}`);
  });
}
function addToCart(id, amount = 1, color) {
  if (!products.some(p => p.id === id)) return;
  const addition = normalizeCart([{ id, color, quantity:clampDemoQuantity(amount) }], products)[0];
  if (!addition) { toast('该展示颜色已变更，请重新选择'); return; }
  const key = cartItemKey(addition);
  const previous = cart.find(item => cartItemKey(item) === key)?.quantity || 0;
  const next = normalizeCart([...cart, addition], products);
  const added = next.find(item => cartItemKey(item) === key).quantity - previous;
  if (added === 0) { toast(`每种展示颜色最多保留 ${MAX_DEMO_QUANTITY} 件，此数值不代表真实库存`); return; }
  cart = next;
  const saved = persist(CART_KEY, cart);
  syncBadges();
  if (page === 'cart') renderCart();
  if (saved) toast(added < addition.quantity
    ? `已加入 ${added} 件，该展示颜色已达到 ${MAX_DEMO_QUANTITY} 件演示上限`
    : `已加入购物袋：${addition.color ? addition.color + ' × ' : ''}${added} 件`);
}

document.addEventListener('click', event => {
  if (!(event.target instanceof Element)) return;
  const add = event.target.closest('[data-add]');
  if (add) {
    event.preventDefault();
    const detail = add.hasAttribute('data-detail-add') ? add.closest('[data-detail-id]') : null;
    addToCart(add.dataset.add, detail ? $('#detail-qty', detail)?.value : 1, detail ? $('input[name="variant"]:checked', detail)?.value : undefined);
    return;
  }
  const favorite = event.target.closest('[data-favorite]');
  if (favorite) {
    event.preventDefault();
    const id = favorite.dataset.favorite;
    if (!products.some(p => p.id === id)) return;
    const savedView = isSavedCatalog();
    const index = savedView ? $$('[data-favorite]', $('#catalog-grid')).indexOf(favorite) : -1;
    const selected = favorites.includes(id);
    favorites = selected ? favorites.filter(value => value !== id) : [...favorites,id];
    const saved = persist(FAV_KEY,favorites);
    syncBadges();
    if (saved) toast(selected ? '已取消收藏' : '已收藏');
    if (savedView) {
      renderCatalog({ syncForm:false });
      const buttons = $$('[data-favorite]', $('#catalog-grid'));
      const next = buttons[Math.min(Math.max(index, 0), buttons.length - 1)] || $('#catalog-empty a');
      next?.focus({ preventScroll:true });
    }
  }
});

$$('dialog').forEach(dialog => {
  $$('[data-close-dialog]',dialog).forEach(button => button.addEventListener('click',()=>dialog.close()));
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
});
$$('[data-open-search]').forEach(button => button.addEventListener('click',()=>{
  renderSearch($('#global-search').value);
  $('#search-dialog').showModal();
  $('#global-search').focus();
}));
$$('[data-open-menu]').forEach(button => button.addEventListener('click',()=>$('#menu-dialog').showModal()));
$('#global-search')?.addEventListener('input',event=>renderSearch(event.target.value));
function renderSearch(query) {
  const found = filterProducts(products,categories,{q:query}).slice(0,6);
  $('#search-results').innerHTML = found.length ? found.map(p=>`<a class="search-result" href="/products/${p.slug}/"><img src="/assets/${p.image}" alt="" width="54" height="54"><span><strong>${esc(p.name)}</strong><small>演示价 ${money(p.priceMinor)} · 选品示意</small></span>${icon('arrow')}</a>`).join('') : '<p class="search-no-results">没有找到匹配商品，试试“茶饮”或“毛巾”</p>';
}

function card(p) {
  const category = categories.find(c=>c.id===p.category);
  return `<article class="product-card" data-product-id="${p.id}"><div class="product-visual"><a href="/products/${p.slug}/" class="product-image-link" tabindex="-1" aria-hidden="true"><img src="/assets/${p.image}" alt="" width="640" height="640" loading="lazy"></a><button class="favorite-button icon-button" data-favorite="${p.id}" aria-label="收藏${esc(p.name)}" aria-pressed="false">${icon('heart')}</button><button class="quick-add" data-add="${p.id}" aria-label="将${esc(p.name)}加入购物袋">${icon('plus')}加入购物袋</button></div><div class="product-meta"><span>${esc(category.name)}</span><span>选品示意</span></div><h3><a href="/products/${p.slug}/">${esc(p.name)}</a></h3><p class="product-subtitle">${esc(p.subtitle)}</p><p class="product-price"><span>演示价</span> ${money(p.priceMinor)}</p></article>`;
}
function renderCatalog({ syncForm = true } = {}) {
  const params = new URLSearchParams(location.search);
  const options = Object.fromEntries(params);
  if (options.saved === '1') options.ids = favorites;
  const found = filterProducts(products,categories,options);
  const category = categories.find(c=>c.id===options.category);
  const sceneNames = {table:'餐桌日常',home:'舒适居家',tea:'午后时光',outdoor:'随身好物'};
  const sceneName = Object.hasOwn(sceneNames,options.scene) ? sceneNames[options.scene] : '';
  $('#catalog-title').textContent = options.saved === '1' ? '我的收藏' : category?.name || sceneName || '全部选物';
  $('#result-count').textContent = `${found.length} 件示例商品`;
  $('#catalog-grid').innerHTML = found.map(card).join('');
  $('#catalog-empty').hidden = found.length > 0;
  if (syncForm) {
    $('#catalog-q').value = options.q || '';
    $('#sort-products').value = ['price-asc','price-desc','name'].includes(options.sort) ? options.sort : 'featured';
  }
  $$('[data-category]').forEach(el=>{
    if (el.dataset.category === (category?.id || 'all')) el.setAttribute('aria-current','page'); else el.removeAttribute('aria-current');
    const url = new URL(location.href);
    if (el.dataset.category === 'all') url.searchParams.delete('category'); else url.searchParams.set('category',el.dataset.category);
    el.href = url.pathname + url.search;
  });
  const chips = [];
  if (options.q) chips.push(`搜索：${options.q}`);
  if (sceneName) chips.push(sceneName);
  if (options.saved === '1') chips.push('仅显示本机收藏');
  for (const name of ['min','max']) {
    const value = Number(options[name]);
    const valid = options[name] !== undefined && options[name] !== '' && Number.isFinite(value) && value >= 0;
    if (syncForm) {
      const input = $(`#price-form [name="${name}"]`);
      input.value = valid ? String(value) : '';
      input.setCustomValidity('');
    }
    if (valid) chips.push(`${name === 'min' ? '最低' : '最高'}演示价：${money(value)}`);
  }
  $('#active-filters').innerHTML = chips.length ? chips.map(c=>`<span class="filter-chip">${esc(c)}</span>`).join('') + '<a href="/catalog/">清除筛选</a>' : '';
  syncBadges();
}
function setFilters(changes) {
  const url = new URL(location.href);
  Object.entries(changes).forEach(([key,value])=>value === '' ? url.searchParams.delete(key) : url.searchParams.set(key,value));
  if (url.pathname + url.search !== location.pathname + location.search) history.pushState(null,'',url.pathname + url.search);
  renderCatalog();
}
if (page === 'catalog') {
  renderCatalog();
  $('#catalog-search').addEventListener('submit',event=>{ event.preventDefault(); setFilters({q:$('#catalog-q').value.trim()}); });
  $('#sort-products').addEventListener('change',event=>setFilters({sort:event.target.value}));
  $('#price-form').addEventListener('submit',event=>{
    event.preventDefault();
    const min = $('#price-form [name="min"]');
    const max = $('#price-form [name="max"]');
    max.setCustomValidity(min.value !== '' && max.value !== '' && Number(max.value) < Number(min.value) ? '最高价格不能低于最低价格' : '');
    if (!max.reportValidity()) return;
    setFilters({min:min.value,max:max.value});
  });
  $('#price-form').addEventListener('input',()=>$('#price-form [name="max"]').setCustomValidity(''));
  // 浏览器可能在 popstate 之后恢复旧表单值，以 URL 为准在该轮恢复完成后同步。
  window.addEventListener('popstate',()=>setTimeout(renderCatalog,0));
}

function updateQuantityControls(input, minus, plus, quantity) {
  const focused = document.activeElement;
  input.value = String(quantity);
  minus.disabled = quantity <= 1;
  plus.disabled = quantity >= MAX_DEMO_QUANTITY;
  if ((focused === minus || focused === plus) && focused.disabled) input.focus({ preventScroll:true });
}

let detailQuantity = 1;
function updateDetailQuantity(value) {
  const input = $('#detail-qty');
  if (!input) return;
  detailQuantity = clampDemoQuantity(value, detailQuantity);
  updateQuantityControls(input, $('[data-detail-minus]'), $('[data-detail-plus]'), detailQuantity);
}
if (page === 'product') {
  const qty = $('#detail-qty');
  updateDetailQuantity(qty.value);
  $('[data-detail-minus]').addEventListener('click',()=>updateDetailQuantity(clampDemoQuantity(qty.value, detailQuantity)-1));
  $('[data-detail-plus]').addEventListener('click',()=>updateDetailQuantity(clampDemoQuantity(qty.value, detailQuantity)+1));
  qty.addEventListener('change',()=>updateDetailQuantity(qty.value));
}

function renderCart() {
  const content = $('#cart-content');
  if (!content) return;
  const warning = `<p class="cart-warning" data-cart-storage-warning ${storageAvailable ? 'hidden' : ''}>浏览器限制了本地存储，当前选择可能无法在离开页面后保留。</p>`;
  if (!cart.length) {
    content.innerHTML = `${warning}<div class="empty-state cart-empty">${icon('bag')}<h2>购物袋里，留一个喜欢的位置</h2><p>购物袋还是空的，先从日常选物逛起吧</p><a class="button button-dark" href="/catalog/">浏览全部选物 ${icon('arrow')}</a></div>`;
    return;
  }
  const total = cartTotal(cart,products);
  content.innerHTML = `${warning}<div class="cart-layout"><section class="cart-items" aria-label="购物袋中的示例商品">${cart.map(item=>{
    const p = products.find(p=>p.id===item.id);
    const key = cartItemKey(item);
    const label = `${p.name}${item.color ? '（' + item.color + '）' : ''}`;
    return `<article class="cart-item" data-cart-key="${esc(key)}" data-cart-color="${esc(item.color)}"><a href="/products/${p.slug}/" tabindex="-1" aria-hidden="true"><img src="/assets/${p.image}" alt="" width="110" height="110"></a><div><h2><a href="/products/${p.slug}/">${esc(p.name)}</a></h2>${item.color ? `<p class="cart-variant">展示颜色：${esc(item.color)}</p>` : ''}<p>选品示意 · 演示单价 ${money(p.priceMinor)}</p><div class="quantity-control"><button type="button" data-cart-minus="${p.id}" aria-label="减少${esc(label)}数量">${icon('minus')}</button><label class="sr-only" for="qty-${esc(key)}">${esc(label)}示例数量</label><input id="qty-${esc(key)}" data-cart-qty="${p.id}" type="number" min="1" max="${MAX_DEMO_QUANTITY}" step="1" value="${item.quantity}" inputmode="numeric"><button type="button" data-cart-plus="${p.id}" aria-label="增加${esc(label)}数量">${icon('plus')}</button></div></div><div class="cart-item-right"><strong data-cart-item-total>${money(p.priceMinor*item.quantity)}</strong><button type="button" class="remove-item" data-cart-remove="${p.id}" aria-label="移除${esc(label)}">移除</button></div></article>`;
  }).join('')}</section><aside class="cart-summary"><h2>示例金额明细</h2><div class="summary-line"><span data-cart-quantity-total>${cart.reduce((s,x)=>s+x.quantity,0)} 件示例商品</span><span data-cart-subtotal>${money(total)}</span></div><div class="summary-line"><span>配送与税费</span><span>待配置</span></div><div class="summary-line summary-total"><span>商品演示小计</span><strong data-cart-subtotal>${money(total)}</strong></div><button class="button button-dark" type="button" disabled aria-describedby="checkout-note">结算暂未开放</button><p id="checkout-note">商品、图片与价格仅作结构示意。此金额不包含配送与税费，不构成正式报价；当前不会创建真实订单或收取款项。</p><a class="text-link" href="/guide/">了解筹备进度 ${icon('arrow')}</a></aside></div>`;
  syncCartAmounts();
}

function cartRow(key) {
  return $$('[data-cart-key]', $('#cart-content')).find(row=>row.dataset.cartKey===key);
}
function syncCartAmounts() {
  const content = $('#cart-content');
  if (!content) return;
  cart.forEach(item=>{
    const row = cartRow(cartItemKey(item));
    if (!row) return;
    const product = products.find(p=>p.id===item.id);
    updateQuantityControls($('[data-cart-qty]', row), $('[data-cart-minus]', row), $('[data-cart-plus]', row), item.quantity);
    $('[data-cart-item-total]', row).textContent = money(product.priceMinor * item.quantity);
  });
  $$('[data-cart-subtotal]', content).forEach(node=>{ node.textContent = money(cartTotal(cart,products)); });
  const count = $('[data-cart-quantity-total]', content);
  if (count) count.textContent = `${cart.reduce((sum,item)=>sum+item.quantity,0)} 件示例商品`;
  const warning = $('[data-cart-storage-warning]', content);
  if (warning) warning.hidden = storageAvailable;
}
function changeQuantity(key,value) {
  const item = cart.find(x=>cartItemKey(x)===key);
  if (!item) return;
  const quantity = clampDemoQuantity(value, item.quantity);
  const changed = quantity !== item.quantity;
  item.quantity = quantity;
  const saved = changed ? persist(CART_KEY,cart) : storageAvailable;
  // 原位更新，避免输入框失焦的 change 事件替换按钮，吞掉随后发生的加减点击。
  syncBadges(); syncCartAmounts();
  if (saved && (String(value).trim() === '' || Number(value) !== quantity)) {
    toast(`演示数量已调整为 ${quantity} 件，每种展示颜色可保留 1–${MAX_DEMO_QUANTITY} 件`);
  }
}
if (page === 'cart') {
  renderCart();
  $('#cart-content').addEventListener('click',event=>{
    if (!(event.target instanceof Element)) return;
    const control = event.target.closest('[data-cart-plus], [data-cart-minus], [data-cart-remove]');
    const key = control?.closest('[data-cart-key]')?.dataset.cartKey;
    if (!control || control.disabled || !key) return;
    const index = cart.findIndex(item=>cartItemKey(item)===key);
    if (index < 0) return;
    event.preventDefault();
    if (control.hasAttribute('data-cart-remove')) {
      cart.splice(index,1);
      const saved = persist(CART_KEY,cart);
      syncBadges(); renderCart();
      if (saved) toast('已从购物袋移除');
      const next = cart[Math.min(index,cart.length-1)];
      const target = next ? $('[data-cart-remove]', cartRow(cartItemKey(next))) : $('#cart-content a');
      target?.focus({preventScroll:true});
    } else {
      // 直接使用可见输入值，不依赖 blur/change 已先把输入同步到内存。
      const input = $('[data-cart-qty]', control.closest('[data-cart-key]'));
      const current = clampDemoQuantity(input?.value, cart[index].quantity);
      changeQuantity(key,current+(control.hasAttribute('data-cart-plus') ? 1 : -1));
    }
  });
  $('#cart-content').addEventListener('change',event=>{
    if (!(event.target instanceof Element)) return;
    const input = event.target.closest('[data-cart-qty]');
    const key = input?.closest('[data-cart-key]')?.dataset.cartKey;
    if (key) changeQuantity(key,input.value);
  });
}
$$('[data-clear-local]').forEach(button=>button.addEventListener('click',()=>{
  cart=[];favorites=[];
  const cartSaved = persist(CART_KEY,[]);
  const favoritesSaved = persist(FAV_KEY,[]);
  syncBadges();
  if (page === 'cart') renderCart();
  if (page === 'catalog') renderCatalog();
  if (cartSaved && favoritesSaved) toast('已清空本机购物袋与收藏');
}));
window.addEventListener('storage',event=>{
  const cartChanged = event.key === CART_KEY || event.key === null;
  const favoritesChanged = event.key === FAV_KEY || event.key === null;
  if (!cartChanged && !favoritesChanged) return;
  if (cartChanged) cart = normalizeCart(read(CART_KEY,cart),products);
  if (favoritesChanged) favorites = normalizeFavorites(read(FAV_KEY,favorites),products);
  syncBadges();
  if (page === 'cart' && cartChanged) renderCart();
  if (favoritesChanged && isSavedCatalog()) renderCatalog({ syncForm:false });
});
window.addEventListener('pageshow',event=>{
  if (!event.persisted) return;
  // 缓存页面恢复后重新读本机状态，并等浏览器完成表单恢复再同步控件。
  setTimeout(()=>{
    cart = normalizeCart(read(CART_KEY,cart),products);
    favorites = normalizeFavorites(read(FAV_KEY,favorites),products);
    syncBadges();
    if (page === 'cart') renderCart();
    if (page === 'catalog') renderCatalog();
    if (page === 'product') updateDetailQuantity($('#detail-qty')?.value);
  },0);
});

const metric = (label,note) => `<article class="metric-card"><span>${label}</span><strong>—</strong><small>${note}</small></article>`;
const adminHeading = (title,description,action='') => `<div class="admin-heading"><div><h1>${title}</h1><p>${description}</p></div>${action}</div>`;
const emptyAdmin = (title,description,ico='box') => `<section class="admin-empty">${icon(ico)}<h2>${title}</h2><p>${description}</p></section>`;
const usageRows = () => `<div class="usage-item"><div><span>Workers 动态请求</span><span>未连接</span></div><div class="usage-unknown"></div><p>尚未读取账户用量</p></div><div class="usage-item"><div><span>D1 数据读写与存储</span><span>未连接</span></div><div class="usage-unknown"></div><p>尚未读取数据库用量</p></div><div class="usage-item"><div><span>R2 图片存储与操作</span><span>未连接</span></div><div class="usage-unknown"></div><p>尚未读取存储用量</p></div>`;
const productTable = () => `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>示例商品</th><th>分类</th><th>演示价格</th><th>真实库存</th><th>状态</th></tr></thead><tbody>${products.map(p=>`<tr><td><div class="table-product"><img src="/assets/${p.image}" alt="" width="46" height="46"><span><strong>${esc(p.name)}</strong><small>${p.id}</small></span></div></td><td>${categories.find(c=>c.id===p.category).name}</td><td>${money(p.priceMinor)}</td><td>未连接</td><td><span class="status-pill">界面示例</span></td></tr>`).join('')}</tbody></table></div>`;
const adminViews = {
  overview: () => `${adminHeading('店铺概览','从选品到订单，让每一步都清楚可见','<span class="status-pill">筹备中</span>')}<div class="metric-grid">${metric('今日销售额','支付与订单未接入')}${metric('待处理订单','真实订单未接入')}${metric('在售商品','正式商品库未接入')}${metric('库存提醒','真实库存未接入')}</div><div class="admin-grid"><section class="admin-panel"><h2>开店准备</h2><div class="readiness-list"><div><span>店铺页面与分类结构</span><span class="ready-mark">已有预览</span></div><div><span>示例搜索与购物袋</span><span class="ready-mark">可体验</span></div><div><span>正式商品与规格</span><small>待录入</small></div><div><span>后台登录与权限</span><small>待接入</small></div><div><span>配送与售后规则</span><small>待确认</small></div><div><span>支付与订单处理</span><small>待接入</small></div></div></section><section class="admin-panel"><h2>用量与提醒</h2>${usageRows()}</section></div><section class="admin-panel"><h2>商品结构预览</h2><p>以下条目来自独立的演示目录，用于确认管理列表的字段和布局，不代表实际在售商品。</p></section>${productTable()}`,
  products: () => `${adminHeading('商品管理','名称、分类、图片、规格、价格与上架状态统一管理','<button class="button button-dark" disabled>新增商品待接入</button>')}${productTable()}<p class="admin-subtle">此页面只读。正式商品将使用独立数据库；当前不允许新增、修改或上架。</p>`,
  categories: () => `${adminHeading('分类管理','五大商品分类，生活场景作为独立专题')}<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>分类</th><th>分类标识</th><th>示例数量</th><th>选品方向</th></tr></thead><tbody>${categories.map(c=>`<tr><td>${c.name}</td><td>${c.id}</td><td>${products.filter(p=>p.category===c.id).length}</td><td>${c.subtitle}</td></tr>`).join('')}</tbody></table></div><p class="admin-subtle">示例数量用于确认页面结构，并非真实在售数量。</p>`,
  inventory: () => `${adminHeading('库存管理','按商品规格与 SKU 管理库存，展示可售和预留数量')}${emptyAdmin('真实库存尚未连接','库存字段与约束已预留。接入商品和仓储数据后，再展示可售数量、预留数量与补货提醒；当前不以零库存代替未知状态。')}`,
  orders: () => `${adminHeading('订单管理','订单、支付、发货与售后状态集中查看')}${emptyAdmin('真实订单尚未连接','示例购物袋不会创建订单。支付、服务端计价、库存校验与订单处理完成后，才开放购买。','bag')}`,
  media: () => `${adminHeading('商品素材','当前素材是可替换的 AI 选品示意图')}<div class="media-grid">${products.map(p=>`<figure><img src="/assets/${p.image}" alt="${esc(p.name)}示意图" width="640" height="640"><figcaption>${esc(p.name)} · AI 示意</figcaption></figure>`).join('')}</div><p class="admin-subtle">真实商品图上传、图片管理和 R2 存储尚未接入。</p>`,
  shipping: () => `${adminHeading('配送与售后','在开放购买前明确服务地区、费用、时效和退换规则')}<section class="admin-panel"><h2>服务配置</h2><dl class="settings-list"><div><dt>销售与配送地区</dt><dd>待确认</dd></div><div><dt>配送费与税费规则</dt><dd>待确认</dd></div><div><dt>发货及预计到货时间</dt><dd>待确认</dd></div><div><dt>退换货条件</dt><dd>待确认</dd></div><div><dt>客服联系方式</dt><dd>待确认</dd></div></dl></section>`,
  usage: () => `${adminHeading('用量与提醒','免费优先，先把真实用量和通知渠道接通')}<div class="admin-grid"><section class="admin-panel"><h2>账户资源</h2>${usageRows()}</section><section class="admin-panel"><h2>通知配置</h2><dl class="settings-list"><div><dt>账户监控连接</dt><dd>未配置</dd></div><div><dt>提醒接收地址</dt><dd>未配置</dd></div><div><dt>预算邮件</dt><dd>未核实 / 未配置</dd></div><div><dt>提前预警</dt><dd>未启用</dd></div></dl><p>此页面没有实时采集数据。通知能力取决于实际账户、产品与配置；预算邮件有处理延迟，也不等于自动停止服务或封顶费用。</p></section></div>`,
  settings: () => `${adminHeading('店铺设置','将品牌信息和经营配置集中管理')}<section class="admin-panel"><h2>基本信息</h2><dl class="settings-list"><div><dt>当前项目名</dt><dd>日本精品生活馆</dd></div><div><dt>正式品牌名称</dt><dd>待确认</dd></div><div><dt>展示语言</dt><dd>简体中文；预留繁中、日文与英文</dd></div><div><dt>演示币种</dt><dd>JPY 日元；实际结算币种待确认</dd></div><div><dt>店铺状态</dt><dd>筹备预览，暂未开放购买</dd></div><div><dt>管理认证</dt><dd>未接入，管理 API 保持关闭</dd></div><div><dt>营业主体与域名</dt><dd>待确认</dd></div></dl></section>`,
};
function renderAdmin(id) {
  if (!Object.hasOwn(adminViews,id)) id = 'overview';
  $('#admin-content').innerHTML = adminViews[id]();
  $('#admin-breadcrumb').textContent = adminSections.find(x=>x[0]===id)[1];
  $$('[data-admin-section]').forEach(button=>{
    if (button.dataset.adminSection === id) button.setAttribute('aria-current','page'); else button.removeAttribute('aria-current');
  });
}
if (page === 'admin') {
  renderAdmin(location.hash.slice(1));
  $$('[data-admin-section]').forEach(button=>button.addEventListener('click',()=>{location.hash=button.dataset.adminSection;}));
  window.addEventListener('hashchange',()=>renderAdmin(location.hash.slice(1)));
}
syncBadges();
