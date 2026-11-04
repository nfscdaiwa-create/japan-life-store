import { normalizeCart, normalizeFavorites, cartTotal, filterProducts, cartItemKey, clampDemoQuantity, MAX_DEMO_QUANTITY, restoreCartItem, createSelectionStore } from './store-core.mjs';

const dataElement = document.getElementById('shop-data');
const { products, categories, page } = JSON.parse(dataElement.textContent);
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const esc = (v) => String(v).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const money = v => new Intl.NumberFormat('zh-CN', { style:'currency', currency:'JPY', currencyDisplay:'narrowSymbol', maximumFractionDigits:0 }).format(v);
const symbols = {
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  arrow:'<path d="M4 12h15m-5-5 5 5-5 5"/>',
  plus:'<path d="M5 12h14M12 5v14"/>', minus:'<path d="M5 12h14"/>',
  close:'<path d="m6 6 12 12M18 6 6 18"/>',
  bag:'<path d="M5 7h14l1 14H4L5 7Z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/>',
  box:'<path d="m3 7 9-4 9 4v11l-9 4-9-4V7ZM3 7l9 4 9-4M12 11v11"/>',
  chart:'<path d="M4 3v18h17M8 17v-5M13 17V8M18 17V4"/>',
};
const icon = name => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${symbols[name] || symbols.box}</svg>`;
const CART_KEY = 'japan-life.preview-cart.v1';
const FAV_KEY = 'japan-life.preview-favorites.v1';
const storageWarning = '浏览器限制了本地保存，本次选择仅在当前页面保留';
function selectionStore(key, normalize) {
  return createSelectionStore({
    read:() => {
      const raw = localStorage.getItem(key);
      // 单条损坏的 JSON 不等于浏览器禁用了存储。
      try { return JSON.parse(raw); } catch { return null; }
    },
    write:value => localStorage.setItem(key, JSON.stringify(value)),
    normalize,
  });
}
const cartStore = selectionStore(CART_KEY,value=>normalizeCart(value,products));
const favoriteStore = selectionStore(FAV_KEY,value=>normalizeFavorites(value,products));
let cart = cartStore.value;
let favorites = favoriteStore.value;
function updateCart(operation) {
  const result = cartStore.update(operation);
  cart = result.value;
  return result;
}
function canFocus(element) {
  return element?.isConnected && !element.disabled
    && !element.closest('[hidden], [inert], [aria-hidden="true"]')
    && element.matches('a[href], button, input, select, textarea, [tabindex]')
    && element.getClientRects().length;
}
function focusFirst(...elements) {
  elements.find(canFocus)?.focus({ preventScroll:true });
}
let toastTimer;
let toastAction;
let toastSticky = false;
let toastReturnFocus;
const toastElement = $('#toast');
const toastMessage = $('#toast-message') || toastElement;
const toastActionButton = $('#toast-action');
const toastLink = $('#toast-link');
const toastClose = $('#toast-close');
function dismissToast() {
  clearTimeout(toastTimer);
  if (!toastElement) return;
  const returnFocus = toastElement.contains(document.activeElement);
  toastElement.hidden = true;
  toastElement.classList.remove('visible');
  toastAction = null;
  if (returnFocus) {
    const key = toastReturnFocus?.closest('[data-cart-key]')?.dataset.cartKey;
    const row = key ? cartRow(key) : null;
    focusFirst(toastReturnFocus, row ? $('h2 a',row) : null,
      $('#cart-content h2 a'), $('#cart-content .cart-empty a'),
      $('#catalog-grid h3 a'), $('#catalog-empty a'), $('#catalog-q'), $('[data-open-search]'));
  }
}
function scheduleToastDismiss() {
  clearTimeout(toastTimer);
  if (!toastElement || toastElement.hidden || toastSticky || toastElement.matches(':hover') || toastElement.contains(document.activeElement)) return;
  toastTimer = setTimeout(dismissToast,5000);
}
function toast(message, { action, link, sticky = false } = {}) {
  if (!toastElement || !toastMessage) return;
  clearTimeout(toastTimer);
  const focused = document.activeElement;
  const focusWasInside = toastElement.contains(focused);
  if (!focusWasInside) toastReturnFocus = focused;
  toastAction = action?.run || null;
  toastSticky = Boolean(sticky || action || link);
  if (toastActionButton) {
    toastActionButton.hidden = !action;
    toastActionButton.textContent = action?.label || '';
  }
  if (toastLink) {
    toastLink.hidden = !link;
    toastLink.textContent = link?.label || '';
    if (link) toastLink.href = link.href; else toastLink.removeAttribute('href');
  }
  toastElement.hidden = false;
  toastElement.classList.add('visible');
  toastMessage.textContent = message;
  // 显示提示不移焦；用户正在操作提示时，只避免焦点落在被隐藏的旧操作上。
  if (focusWasInside && focused.hidden) toastClose?.focus({ preventScroll:true });
  scheduleToastDismiss();
}
toastClose?.addEventListener('click',dismissToast);
toastActionButton?.addEventListener('click',()=>{ const action = toastAction; toastAction = null; action?.(); });
toastElement?.addEventListener('pointerenter',()=>clearTimeout(toastTimer));
toastElement?.addEventListener('pointerleave',scheduleToastDismiss);
toastElement?.addEventListener('focusin',()=>clearTimeout(toastTimer));
toastElement?.addEventListener('focusout',()=>setTimeout(scheduleToastDismiss,0));
function isSavedCatalog() {
  return page === 'catalog' && Object.fromEntries(new URLSearchParams(location.search)).saved === '1';
}
function syncBadges() {
  const qty = cart.reduce((sum,item) => sum + item.quantity, 0);
  $$('[data-cart-count]').forEach(el => {
    el.textContent = String(qty);
    el.hidden = qty === 0;
    el.closest('a[href="/cart/"]')?.setAttribute('aria-label', qty ? `示例购物袋，共 ${qty} 件` : '示例购物袋，当前为空');
  });
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
  const { before, saved } = updateCart(current=>[...current,addition]);
  const previous = before.find(item => cartItemKey(item) === key)?.quantity || 0;
  const added = cart.find(item => cartItemKey(item) === key).quantity - previous;
  syncBadges();
  if (page === 'cart') renderCart();
  if (!saved) { toast(storageWarning,{ sticky:true }); return; }
  if (added === 0) { toast(`每种展示颜色最多保留 ${MAX_DEMO_QUANTITY} 件，此数值不代表真实库存`); return; }
  if (saved) toast(added < addition.quantity
    ? `已加入 ${added} 件，该展示颜色已达到 ${MAX_DEMO_QUANTITY} 件演示上限`
    : `已加入购物袋：${addition.color ? addition.color + ' × ' : ''}${added} 件`,
    { link:{ href:'/cart/', label:'查看购物袋' } });
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
    const selected = favorites.includes(id);
    const result = favoriteStore.update(current=>selected ? current.filter(value=>value!==id) : [...current,id]);
    favorites = result.value;
    syncBadges();
    if (savedView) renderCatalog({ syncForm:false });
    toast(result.saved ? (selected ? '已取消收藏' : '已收藏') : storageWarning,{ sticky:!result.saved });
  }
});

const dialogOpeners = new WeakMap();
function openDialog(dialog, opener, initialFocus) {
  if (!dialog || dialog.open) return;
  dialogOpeners.set(dialog,opener || document.activeElement);
  dialog.showModal();
  initialFocus?.focus({ preventScroll:true });
}
$$('dialog').forEach(dialog => {
  $$('[data-close-dialog]',dialog).forEach(button => button.addEventListener('click',()=>dialog.close()));
  dialog.addEventListener('keydown',event=>{
    if (event.key === 'Escape' && !event.isComposing) {
      event.preventDefault();
      dialog.close();
    }
  });
  dialog.addEventListener('close',()=>{
    const opener = dialogOpeners.get(dialog);
    if (opener?.isConnected && !opener.disabled) opener.focus({ preventScroll:true });
    dialogOpeners.delete(dialog);
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
});
$$('[data-open-search]').forEach(button => button.addEventListener('click',()=>{
  renderSearch($('#global-search').value);
  openDialog($('#search-dialog'),button,$('#global-search'));
}));
$$('[data-open-menu]').forEach(button => button.addEventListener('click',()=>openDialog($('#menu-dialog'),button)));
$$('[data-open-image]').forEach(button => button.addEventListener('click',()=>openDialog($('#image-dialog'),button)));
$('#global-search')?.addEventListener('input',event=>renderSearch(event.target.value));
function renderSearch(query) {
  const found = filterProducts(products,categories,{q:query}).slice(0,6);
  $('#search-results').innerHTML = found.length ? found.map(p=>`<a class="search-result" href="/products/${p.slug}/"><img src="/assets/${p.image}" alt="" width="54" height="54"><span><strong>${esc(p.name)}</strong><small><span>演示价 ${money(p.priceMinor)}</span><span>选品示意</span></small></span>${icon('arrow')}</a>`).join('') : '<p class="search-no-results">没有找到匹配商品，试试“茶饮”或“毛巾”</p>';
}

function card(p) {
  const category = categories.find(c=>c.id===p.category);
  const multipleColors = Array.isArray(p.colors) && p.colors.length > 1;
  const action = multipleColors
    ? `<a class="quick-add" href="/products/${p.slug}/#options" aria-label="为${esc(p.name)}选择颜色">选择颜色 ${icon('arrow')}</a>`
    : `<button type="button" class="quick-add" data-add="${p.id}" aria-label="将${esc(p.name)}加入购物袋">${icon('plus')}加入购物袋</button>`;
  return `<article class="product-card" data-product-id="${p.id}"><div class="product-visual"><a href="/products/${p.slug}/" class="product-image-link" tabindex="-1" aria-hidden="true"><img src="/assets/${p.image}" alt="" width="640" height="640" loading="lazy"></a><button class="favorite-button icon-button" data-favorite="${p.id}" aria-label="收藏${esc(p.name)}" aria-pressed="false">${icon('heart')}</button>${action}</div><div class="product-meta"><span>${esc(category.name)}</span><span>${multipleColors ? p.colors.length + ' 种展示颜色' : '选品示意'}</span></div><h3><a href="/products/${p.slug}/">${esc(p.name)}</a></h3><p class="product-subtitle">${esc(p.subtitle)}</p><p class="product-price"><span>演示价</span> ${money(p.priceMinor)}<small class="currency-code">JPY</small></p></article>`;
}
function renderCatalog({ syncForm = true } = {}) {
  const grid = $('#catalog-grid');
  const focused = document.activeElement;
  const focusedCard = grid.contains(focused) ? focused.closest('[data-product-id]') : null;
  const cardFocus = focusedCard ? {
    id:focusedCard.dataset.productId,
    index:$$('[data-product-id]',grid).indexOf(focusedCard),
    selector:focused.matches('[data-favorite]') ? '[data-favorite]' : focused.matches('.quick-add') ? '.quick-add' : 'h3 a',
  } : $('#catalog-empty').contains(focused) ? { index:0 } : null;
  const params = new URLSearchParams(location.search);
  const options = Object.fromEntries(params);
  const savedView = options.saved === '1';
  if (savedView) options.ids = favorites;
  const filterArea = $('#active-filters');
  const focusedChip = document.activeElement?.closest('[data-remove-filter]');
  const focusKey = focusedChip && filterArea.contains(focusedChip) ? focusedChip.dataset.removeFilter : null;
  const focusIndex = focusKey ? $$('[data-remove-filter]',filterArea).indexOf(focusedChip) : -1;
  const found = filterProducts(products,categories,options);
  const category = categories.find(c=>c.id===options.category);
  const sceneNames = {table:'餐桌日常',home:'舒适居家',tea:'午后时光',outdoor:'随身好物'};
  const sceneName = Object.hasOwn(sceneNames,options.scene) ? sceneNames[options.scene] : '';
  const title = savedView ? '我的收藏' : category?.name || sceneName || '全部选物';
  $('#catalog-title').textContent = title;
  document.title = `${title} · 日本精品生活馆`;
  const breadcrumb = $('#catalog-breadcrumb');
  if (breadcrumb) breadcrumb.textContent = title;
  const description = $('#catalog-description');
  if (description) description.textContent = savedView ? '在这里查看当前浏览器收藏的物件。' : `按分类、关键词或价格，找到适合日常的${category ? category.name : '物件'}。`;
  $('#result-count').textContent = `${found.length} 件示例商品`;
  grid.innerHTML = found.map(card).join('');
  const empty = $('#catalog-empty');
  empty.hidden = found.length > 0;
  if (!found.length) {
    const noFavorites = savedView && !favorites.length;
    $('.icon',empty).innerHTML = symbols[savedView ? 'heart' : 'search'];
    $('h2',empty).textContent = noFavorites ? '还没有收藏的物件' : savedView ? '当前条件下没有收藏的物件' : '没有找到符合条件的物件';
    $('p',empty).textContent = noFavorites ? '点击商品旁的爱心，把喜欢的物件留在这里。' : savedView ? '调整筛选条件，或回到全部收藏继续挑选。' : '试试其他关键词，或清除筛选后继续挑选。';
    const action = $('a',empty);
    action.href = savedView && !noFavorites ? '/catalog/?saved=1' : '/catalog/';
    action.textContent = savedView && !noFavorites ? '查看全部收藏' : '浏览全部选物';
  }
  if (syncForm) {
    $('#catalog-q').value = options.q || '';
    $('#sort-products').value = ['price-asc','price-desc','name'].includes(options.sort) ? options.sort : 'featured';
  }
  const categoryProducts = savedView ? products.filter(product=>favorites.includes(product.id)) : products;
  $$('[data-category]').forEach(el=>{
    if (el.dataset.category === (category?.id || 'all')) el.setAttribute('aria-current','page'); else el.removeAttribute('aria-current');
    const url = new URL(location.href);
    if (el.dataset.category === 'all') url.searchParams.delete('category'); else url.searchParams.set('category',el.dataset.category);
    el.href = url.pathname + url.search;
    const count = $('.category-count',el);
    if (count) count.textContent = String(el.dataset.category === 'all' ? categoryProducts.length : categoryProducts.filter(product=>product.category===el.dataset.category).length).padStart(2,'0');
  });
  const chips = [];
  if (category) chips.push({ key:'category', label:category.name });
  if (options.q) chips.push({ key:'q', label:`搜索：${options.q}` });
  if (sceneName) chips.push({ key:'scene', label:sceneName });
  for (const name of ['min','max']) {
    const value = Number(options[name]);
    const valid = options[name] !== undefined && options[name] !== '' && Number.isFinite(value) && value >= 0;
    if (syncForm) {
      const input = $(`#price-form [name="${name}"]`);
      input.value = valid ? String(value) : '';
      input.setCustomValidity('');
    }
    if (valid) chips.push({ key:name, label:`${name === 'min' ? '最低' : '最高'}演示价：${money(value)}` });
  }
  const sortNames = { 'price-asc':'价格从低到高', 'price-desc':'价格从高到低', name:'名称排序' };
  if (Object.hasOwn(sortNames,options.sort)) chips.push({ key:'sort', label:sortNames[options.sort] });
  filterArea.innerHTML = (savedView ? '<span class="filter-chip">本机收藏</span>' : '')
    + chips.map(chip=>`<button type="button" class="filter-chip" data-remove-filter="${chip.key}" aria-label="移除${esc(chip.label)}筛选"><span>${esc(chip.label)}</span>${icon('close')}</button>`).join('')
    + (chips.length ? `<a href="${savedView ? '/catalog/?saved=1' : '/catalog/'}" data-clear-filters>清除筛选</a>` : '')
    + (savedView ? '<a href="/catalog/">查看全部选物</a>' : '');
  syncBadges();
  if (focusKey) {
    const buttons = $$('[data-remove-filter]',filterArea);
    const next = buttons.find(button=>button.dataset.removeFilter===focusKey) || buttons[Math.min(focusIndex,buttons.length-1)] || $('[data-clear-filters]',filterArea) || $('#catalog-q');
    next?.focus({ preventScroll:true });
  } else if (cardFocus) {
    const cards = $$('[data-product-id]',grid);
    const same = cards.find(card=>card.dataset.productId===cardFocus.id);
    const neighbor = cards[Math.min(cardFocus.index,cards.length-1)];
    focusFirst(same ? $(cardFocus.selector,same) : null,
      neighbor ? $('h3 a',neighbor) : null, $('#catalog-empty a'), $('#catalog-q'));
  }
}
function setFilters(changes) {
  const url = new URL(location.href);
  Object.entries(changes).forEach(([key,value])=>value === '' ? url.searchParams.delete(key) : url.searchParams.set(key,value));
  if (url.pathname + url.search !== location.pathname + location.search) history.pushState(null,'',url.pathname + url.search);
  renderCatalog();
}
if (page === 'catalog') {
  renderCatalog();
  $('#active-filters').addEventListener('click',event=>{
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest('[data-remove-filter]');
    if (button) {
      event.preventDefault();
      setFilters({ [button.dataset.removeFilter]:'' });
      return;
    }
    const clear = event.target.closest('[data-clear-filters]');
    if (!clear || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    setFilters({ category:'', q:'', scene:'', min:'', max:'', sort:'' });
    $('#catalog-q').focus({ preventScroll:true });
  });
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
  input.defaultValue = String(quantity);
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
  const focusOptions = () => {
    if (location.hash !== '#options') return;
    const options = $('#options');
    const target = options && ($('input[name="variant"]:checked',options) || $('input[name="variant"]',options) || options);
    target?.focus({ preventScroll:true });
  };
  // 交给浏览器执行一次原生锚点跳转，随后仅移动键盘焦点，不再次滚动。
  if (document.readyState === 'complete') setTimeout(focusOptions,0);
  else window.addEventListener('load',()=>setTimeout(focusOptions,0),{ once:true });
  window.addEventListener('hashchange',()=>setTimeout(focusOptions,0));
}

function cartItemHTML(item) {
  const p = products.find(p=>p.id===item.id);
  const key = cartItemKey(item);
  const label = `${p.name}${item.color ? '（' + item.color + '）' : ''}`;
  return `<article class="cart-item" data-cart-key="${esc(key)}" data-cart-color="${esc(item.color)}"><a href="/products/${p.slug}/" tabindex="-1" aria-hidden="true"><img src="/assets/${p.image}" alt="" width="110" height="110"></a><div><h2><a href="/products/${p.slug}/">${esc(p.name)}</a></h2>${item.color ? `<p class="cart-variant">展示颜色：${esc(item.color)}</p>` : ''}<p>选品示意 · 演示单价 ${money(p.priceMinor)}</p><div class="quantity-control"><button type="button" data-cart-minus="${p.id}" aria-label="减少${esc(label)}数量">${icon('minus')}</button><label class="sr-only" for="qty-${esc(key)}">${esc(label)}示例数量</label><input id="qty-${esc(key)}" data-cart-qty="${p.id}" type="number" min="1" max="${MAX_DEMO_QUANTITY}" step="1" value="${item.quantity}" inputmode="numeric"><button type="button" data-cart-plus="${p.id}" aria-label="增加${esc(label)}数量">${icon('plus')}</button></div></div><div class="cart-item-right"><strong data-cart-item-total>${money(p.priceMinor*item.quantity)}</strong><button type="button" class="remove-item" data-cart-remove="${p.id}" aria-label="移除${esc(label)}">移除</button></div></article>`;
}
function captureCartFocus() {
  const content = $('#cart-content');
  const element = document.activeElement;
  if (!content?.contains(element)) return null;
  const row = element.closest('[data-cart-key]');
  const selector = ['[data-cart-qty]','[data-cart-minus]','[data-cart-plus]','[data-cart-remove]'].find(selector=>element.matches(selector)) || 'h2 a';
  return {
    element, key:row?.dataset.cartKey,
    index:row ? $$('[data-cart-key]',content).indexOf(row) : 0,
    selector,
    href:!row && element.matches('a[href]') ? element.getAttribute('href') : null,
    draft:selector === '[data-cart-qty]' && element.value !== element.defaultValue ? element.value : null,
  };
}
function restoreCartFocus(focus) {
  if (!focus) return;
  const content = $('#cart-content');
  const rows = $$('[data-cart-key]',content);
  const same = rows.find(row=>row.dataset.cartKey===focus.key);
  const control = same ? $(focus.selector,same) : null;
  const neighbor = rows[Math.min(focus.index,rows.length-1)];
  if (control && focus.draft !== null) control.value = focus.draft;
  const link = focus.href ? $$('a[href]',content).find(link=>link.getAttribute('href')===focus.href && canFocus(link)) : null;
  focusFirst(control, same ? $('[data-cart-qty]',same) : null, link,
    neighbor ? $('h2 a',neighbor) : null, $('.cart-empty a',content));
}
function renderCart() {
  const content = $('#cart-content');
  if (!content) return;
  const focus = captureCartFocus();
  const warning = `<p class="cart-warning" data-cart-storage-warning ${cartStore.saved ? 'hidden' : ''}>浏览器限制了本地存储，当前选择可能无法在离开页面后保留。</p>`;
  if (!cart.length) {
    content.innerHTML = `${warning}<div class="empty-state cart-empty">${icon('bag')}<h2>购物袋里，留一个喜欢的位置</h2><p>购物袋还是空的，先从日常选物逛起吧</p><a class="button button-dark" href="/catalog/">浏览全部选物 ${icon('arrow')}</a></div>`;
    restoreCartFocus(focus);
    return;
  }
  const total = cartTotal(cart,products);
  content.innerHTML = `${warning}<div class="cart-layout"><section class="cart-items" aria-label="购物袋中的示例商品">${cart.map(cartItemHTML).join('')}</section><aside class="cart-summary"><h2>示例金额明细 <small class="currency-code">JPY</small></h2><div class="summary-line"><span data-cart-quantity-total>${cart.reduce((s,x)=>s+x.quantity,0)} 件示例商品</span><span data-cart-subtotal>${money(total)}</span></div><div class="summary-line"><span>配送与税费</span><span>待配置</span></div><div class="summary-line summary-total"><span>商品演示小计</span><strong data-cart-subtotal>${money(total)}</strong></div><button class="button button-dark" type="button" disabled aria-describedby="checkout-note">结算暂未开放</button><p id="checkout-note">商品、图片与价格仅作结构示意。此金额不包含配送与税费，不构成正式报价；当前不会创建真实订单或收取款项。</p><a class="text-link" href="/guide/">了解筹备进度 ${icon('arrow')}</a></aside></div>`;
  syncCartAmounts();
  restoreCartFocus(focus);
}

function cartRow(key) {
  return $$('[data-cart-key]', $('#cart-content')).find(row=>row.dataset.cartKey===key);
}
function announceCart(message) {
  const status = $('#cart-status');
  if (status) status.textContent = message;
}
function undoCartRemoval(removed) {
  // 只把这一条颜色记录合入最新状态，不回滚其他标签页或其他颜色的改动。
  const result = updateCart(current=>restoreCartItem(current,removed,products));
  const key = cartItemKey(removed);
  const before = result.before.find(item=>cartItemKey(item)===key)?.quantity || 0;
  const restored = (cart.find(item=>cartItemKey(item)===key)?.quantity || 0) - before;
  syncBadges(); renderCart();
  announceCart('');
  if (!result.saved) {
    toast(storageWarning,{ sticky:true });
  } else if (restored === 0) {
    toast(before >= MAX_DEMO_QUANTITY ? '该展示颜色已达 10 件上限，未重复增加' : '该展示颜色已变更，暂时无法恢复');
  } else {
    toast(restored < removed.quantity ? `已恢复 ${restored} 件，该展示颜色已达 10 件演示上限` : `已恢复${removed.color ? ' ' + removed.color : ''} × ${restored} 件`);
  }
}
function syncCartAmounts() {
  const content = $('#cart-content');
  if (!content) return;
  const list = $('.cart-items',content);
  if (Boolean(cart.length) !== Boolean(list)) { renderCart(); return; }
  const focus = captureCartFocus();
  // 合入其他页面新增或删除的行时，保留仍存在的输入与按钮节点。
  $$('[data-cart-key]',content).forEach(row=>{
    if (!cart.some(item=>cartItemKey(item)===row.dataset.cartKey)) row.remove();
  });
  cart.forEach(item=>{
    if (!cartRow(cartItemKey(item))) list.insertAdjacentHTML('beforeend',cartItemHTML(item));
    const row = cartRow(cartItemKey(item));
    const product = products.find(p=>p.id===item.id);
    updateQuantityControls($('[data-cart-qty]', row), $('[data-cart-minus]', row), $('[data-cart-plus]', row), item.quantity);
    $('[data-cart-item-total]', row).textContent = money(product.priceMinor * item.quantity);
  });
  $$('[data-cart-subtotal]', content).forEach(node=>{ node.textContent = money(cartTotal(cart,products)); });
  const count = $('[data-cart-quantity-total]', content);
  if (count) count.textContent = `${cart.reduce((sum,item)=>sum+item.quantity,0)} 件示例商品`;
  const warning = $('[data-cart-storage-warning]', content);
  if (warning) warning.hidden = cartStore.saved;
  if (focus && !focus.element.isConnected) restoreCartFocus(focus);
}
function changeQuantity(key,value,delta = null) {
  const { before, saved } = updateCart(current=>current.map(item=>cartItemKey(item)===key
    ? { ...item, quantity:clampDemoQuantity(delta === null ? value : item.quantity + delta,item.quantity) }
    : item));
  const item = cart.find(x=>cartItemKey(x)===key);
  const previous = before.find(x=>cartItemKey(x)===key);
  // 原位更新，避免输入框失焦的 change 事件替换按钮，吞掉随后发生的加减点击。
  syncBadges(); syncCartAmounts();
  if (!saved) { toast(storageWarning,{ sticky:true }); return; }
  if (!item) { toast('这件物件已从购物袋移除'); return; }
  const quantity = item.quantity;
  const changed = quantity !== previous?.quantity;
  const requested = delta === null ? value : previous.quantity + delta;
  const adjusted = String(requested).trim() === '' || Number(requested) !== quantity;
  if (changed && saved && !adjusted) announceCart(`${item.color || '该物件'}数量已改为 ${quantity} 件，购物袋共 ${cart.reduce((sum,line)=>sum+line.quantity,0)} 件，演示小计 ${money(cartTotal(cart,products))}。`);
  if (saved && adjusted) {
    announceCart('');
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
      const { before, saved } = updateCart(current=>current.filter(item=>cartItemKey(item)!==key));
      const currentIndex = before.findIndex(item=>cartItemKey(item)===key);
      syncBadges(); renderCart();
      if (currentIndex < 0) {
        focusFirst($('#cart-content h2 a'), $('#cart-content .cart-empty a'));
        toast(saved ? '这件物件已从购物袋移除' : storageWarning,{ sticky:!saved });
        return;
      }
      const removed = { ...before[currentIndex] };
      announceCart('');
      const next = cart[Math.min(currentIndex,cart.length-1)];
      focusFirst(next ? $('h2 a', cartRow(cartItemKey(next))) : null, $('#cart-content .cart-empty a'));
      const product = products.find(p=>p.id===removed.id);
      toast(saved ? `已移除${product.name}${removed.color ? '（' + removed.color + '）' : ''}` : '已在当前页面移除；浏览器限制了本地保存，离开页面后可能无法保留', {
        action:{ label:'撤销', run:()=>undoCartRemoval(removed) },
      });
    } else {
      // 直接使用可见输入值，不依赖 blur/change 已先把输入同步到内存。
      const input = $('[data-cart-qty]', control.closest('[data-cart-key]'));
      const current = clampDemoQuantity(input?.value, cart[index].quantity);
      const delta = control.hasAttribute('data-cart-plus') ? 1 : -1;
      // 未提交的手输值优先；否则把本次增减应用于刚读到的最新数量。
      changeQuantity(key,current+delta,current === cart[index].quantity ? delta : null);
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
  const { saved:cartSaved } = updateCart(()=>[]);
  const result = favoriteStore.update(()=>[]);
  favorites = result.value;
  syncBadges();
  if (page === 'cart') renderCart();
  if (page === 'catalog') renderCatalog();
  toast(cartSaved && result.saved ? '已清空本机购物袋与收藏' : storageWarning,{ sticky:!cartSaved || !result.saved });
}));
window.addEventListener('storage',event=>{
  const cartChanged = event.key === CART_KEY || event.key === null;
  const favoritesChanged = event.key === FAV_KEY || event.key === null;
  if (!cartChanged && !favoritesChanged) return;
  if (cartChanged) cart = cartStore.refresh();
  if (favoritesChanged) favorites = favoriteStore.refresh();
  syncBadges();
  if (page === 'cart' && cartChanged) renderCart();
  if (favoritesChanged && isSavedCatalog()) renderCatalog({ syncForm:false });
});
window.addEventListener('pageshow',event=>{
  if (!event.persisted) return;
  // 缓存页面恢复后重新读本机状态，并等浏览器完成表单恢复再同步控件。
  setTimeout(()=>{
    cart = cartStore.refresh();
    favorites = favoriteStore.refresh();
    syncBadges();
    if (page === 'cart') renderCart();
    if (page === 'catalog') renderCatalog();
    if (page === 'product') updateDetailQuantity($('#detail-qty')?.value);
  },0);
});

syncBadges();
