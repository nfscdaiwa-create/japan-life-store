import { categories, products, shop } from './catalog.mjs';

export const escape = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (amount) => new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }).format(amount);
const paths = {
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  bag: '<path d="M5 7h14l1 14H4L5 7Z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  arrow: '<path d="M4 12h15m-5-5 5 5-5 5"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  cup: '<path d="M4 5h12v8a6 6 0 0 1-12 0V5Z"/><path d="M16 6h2a3 3 0 0 1 0 6h-2M3 21h15"/>',
  home: '<path d="m3 10 9-7 9 7v11H3V10Z"/><path d="M9 21v-8h6v8"/>',
  leaf: '<path d="M20 3C9 2 3 6 4 13s12 10 16-10Z"/><path d="m3 22 12-13"/>',
  sparkles: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3ZM20 2v4M18 4h4"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
  box: '<path d="m3 7 9-4 9 4v11l-9 4-9-4V7ZM3 7l9 4 9-4M12 11v11M7.5 5l9 4"/>',
  chart: '<path d="M4 3v18h17M8 17v-5M13 17V8M18 17V4"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="m9 3-1 3-3 1-2 3 2 2-1 3 3 2 1 3h4l2-3 3-1 2-3-2-2 1-3-3-2-1-3H9Z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v1"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  minus: '<path d="M5 12h14"/>',
  plus: '<path d="M5 12h14M12 5v14"/>',
};
export const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.grid}</svg>`;
const mark = `<svg class="brand-mark" viewBox="0 0 36 40" aria-hidden="true"><rect x="1" y="1" width="34" height="38" rx="2" fill="#9f493b"/><path d="M10 10h16M10 20h16M10 30h16M12 10v20M24 10v20" fill="none" stroke="#fffaf2" stroke-width="1.7"/></svg>`;

function header(active = '') {
  return `<a class="skip-link" href="#main">跳到主要内容</a>
  <div class="preview-strip"><span class="preview-dot"></span>${shop.previewNotice}</div>
  <header class="site-header"><div class="container header-inner">
    <a class="brand" href="/" aria-label="日本精品生活馆首页">${mark}<span><strong>${shop.name}</strong><small>${shop.englishName}</small></span></a>
    <nav class="desktop-nav" aria-label="主要导航"><a href="/catalog/" ${active === 'catalog' ? 'aria-current="page"' : ''}>全部商品</a><a href="/catalog/?category=kitchen">餐厨</a><a href="/catalog/?category=home">家居</a><a href="/catalog/?category=care">个护</a><a href="/catalog/?category=food">茶食</a><a href="/catalog/?category=accessories">配件</a></nav>
    <div class="header-actions"><button class="icon-button" data-open-search aria-label="搜索商品">${icon('search')}</button><a class="icon-button" href="/catalog/?saved=1" aria-label="查看本机收藏">${icon('heart')}</a><a class="icon-button bag-button" href="/cart/" aria-label="示例购物车">${icon('bag')}<span class="cart-count" data-cart-count hidden>0</span></a><button class="icon-button mobile-menu-button" data-open-menu aria-label="打开商品分类">${icon('menu')}</button></div>
  </div></header>`;
}

function footer() {
  return `<footer class="site-footer"><div class="container footer-top"><div><a class="brand footer-brand" href="/">${mark}<span><strong>${shop.name}</strong><small>${shop.englishName}</small></span></a><p>用心挑选，陪伴日常。</p></div><div class="footer-column"><h2>逛逛好物</h2><a href="/catalog/">全部商品</a><a href="/catalog/?category=kitchen">餐厨与日用</a><a href="/catalog/?category=food">午后茶饮</a></div><div class="footer-column"><h2>关于我们</h2><a href="/about/">选品理念</a><a href="/guide/#shipping">配送说明</a><a href="/guide/#after-sales">售后与联系</a></div><div class="footer-note"><span class="eyebrow">SIMPLE THINGS, BETTER DAYS</span><p>从生活出发<br>发现值得留下的好物</p></div></div><div class="container footer-bottom"><span>© ${new Date().getUTCFullYear()} 日本精品生活馆</span><span>筹备中 · 选品方向与页面结构预览</span><a href="/guide/#privacy">隐私说明</a></div></footer>`;
}

function dialogs() {
  return `<dialog id="search-dialog" class="search-dialog"><div class="dialog-heading"><h2>找一件喜欢的好物</h2><button class="icon-button" data-close-dialog aria-label="关闭搜索">${icon('close')}</button></div><form action="/catalog/" class="search-field">${icon('search')}<label class="sr-only" for="global-search">搜索商品、分类或生活场景</label><input id="global-search" name="q" type="search" placeholder="搜索商品、分类或生活场景" autocomplete="off"><button type="submit">搜索</button></form><p class="search-hint">试试：陶瓷、茶饮、毛巾</p><div id="search-results" class="search-results" aria-live="polite"></div></dialog>
  <dialog id="menu-dialog" class="menu-dialog"><div class="dialog-heading"><h2>逛逛好物</h2><button class="icon-button" data-close-dialog aria-label="关闭分类菜单">${icon('close')}</button></div><nav aria-label="移动端商品分类"><a href="/catalog/">全部商品 ${icon('arrow')}</a>${categories.map(c => `<a href="/catalog/?category=${c.id}">${c.name} ${icon('arrow')}</a>`).join('')}<a href="/about/">选品理念 ${icon('arrow')}</a></nav></dialog>
  <div id="toast" class="toast" role="status" aria-live="polite"></div>`;
}

export function productCard(p) {
  return `<article class="product-card" data-product-id="${p.id}"><div class="product-visual"><a href="/products/${p.slug}/" class="product-image-link" tabindex="-1" aria-hidden="true"><img src="/assets/${p.image}" alt="" width="640" height="640" loading="lazy"></a><span class="product-tag">${p.tag}</span><button class="favorite-button icon-button" data-favorite="${p.id}" aria-label="收藏${p.name}" aria-pressed="false">${icon('heart')}</button><button class="quick-add" data-add="${p.id}" aria-label="将${p.name}加入示例购物车">${icon('plus')}加入示例购物车</button></div><div class="product-meta"><span>${categories.find(c => c.id === p.category).name}</span><span>选品示意</span></div><h3><a href="/products/${p.slug}/">${p.name}</a></h3><p class="product-subtitle">${p.subtitle}</p><p class="product-price"><span>演示价</span> ${money(p.priceMinor)}</p></article>`;
}

function home() {
  return `<section class="container hero"><div class="hero-copy"><span class="eyebrow"><span></span>日常之中，自有好物</span><h1>把喜欢的日常<br>慢慢带回家</h1><p>从一只杯子、一条毛巾开始<br>发现简单、舒适、有质感的生活</p><a class="button button-dark" href="/catalog/">发现全部好物 ${icon('arrow')}</a></div><div class="hero-image"><img src="/assets/hero-stilllife.svg" alt="陶瓷茶器与木托盘的生活场景插画" width="1200" height="540" fetchpriority="high"><span class="hero-caption">A LITTLE GOOD IN EVERY DAY</span></div></section>
  <section class="container category-band" aria-label="按分类挑选">${categories.map(c => `<a href="/catalog/?category=${c.id}">${icon(c.icon)}<span>${c.name}</span>${icon('chevron')}</a>`).join('')}</section>
  <section class="container section featured"><div class="section-heading"><div><span class="eyebrow">EVERYDAY PICKS</span><h2>日常精选</h2></div><a class="text-link" href="/catalog/">查看全部 ${icon('arrow')}</a></div><div class="product-grid">${products.slice(0, 4).map(productCard).join('')}</div></section>
  <section class="container section scenes"><div class="section-heading"><div><span class="eyebrow">FIND YOUR MOMENT</span><h2>按喜欢的生活挑选</h2></div><p>给每一个平凡日常，一点小小的心意</p></div><div class="scene-grid"><a class="scene-card scene-table" href="/catalog/?scene=table"><div><small>THE EVERYDAY TABLE</small><h3>好好吃一餐</h3><span>发现餐桌好物 ${icon('arrow')}</span></div><img src="/assets/bowl.svg" alt="深蓝色餐碗插画" width="640" height="640" loading="lazy"></a><a class="scene-card scene-home" href="/catalog/?scene=home"><div><small>AT HOME, AT EASE</small><h3>自在地居家</h3><span>把舒适留在家 ${icon('arrow')}</span></div><img src="/assets/towel.svg" alt="柔软毛巾插画" width="640" height="640" loading="lazy"></a><a class="scene-card scene-tea" href="/catalog/?scene=tea"><div><small>A QUIET AFTERNOON</small><h3>慢慢喝杯茶</h3><span>享受午后片刻 ${icon('arrow')}</span></div><img src="/assets/tea.svg" alt="茶罐与木匙插画" width="640" height="640" loading="lazy"></a></div></section>
  <section class="container selection-note"><span class="note-seal">日常<br>选物</span><div><h2>喜欢的东西，不必复杂</h2><p>我们希望把实用、耐看、让人愿意反复使用的好物带到你身边。<br class="desktop-only">从日常出发，让每一次选择都更简单。</p></div><a class="text-link" href="/about/">我们的选品理念 ${icon('arrow')}</a></section>`;
}

function catalog() {
  return `<div class="container"><nav class="breadcrumb" aria-label="面包屑"><a href="/">首页</a><span>/</span><span>全部商品</span></nav><div class="page-heading"><div><span class="eyebrow">THE COLLECTION</span><h1 id="catalog-title">发现日常好物</h1><p>从需要出发，慢慢挑选喜欢的东西</p></div><span class="count-label" id="result-count" aria-live="polite">${products.length} 件示例商品</span></div><div class="catalog-layout"><aside class="catalog-sidebar"><h2>商品分类</h2><nav aria-label="筛选商品分类"><a data-category="all" href="/catalog/" aria-current="page">全部商品 <span>${products.length}</span></a>${categories.map(c => `<a data-category="${c.id}" href="/catalog/?category=${c.id}">${c.name}<span>${products.filter(p => p.category === c.id).length}</span></a>`).join('')}</nav><div class="sidebar-price"><h2>示例价格区间</h2><form id="price-form"><div class="price-inputs"><label><span class="sr-only">最低演示价格，日元</span><input type="number" inputmode="numeric" name="min" min="0" step="1" placeholder="最低"></label><span>—</span><label><span class="sr-only">最高演示价格，日元</span><input type="number" inputmode="numeric" name="max" min="0" step="1" placeholder="最高"></label></div><button class="button button-outline" type="submit">应用价格</button><p class="field-note">JPY 日元 · 仅用于展示筛选功能</p></form></div><a class="sidebar-story" href="/about/"><span>选品理念</span><strong>实用，耐看<br>也值得喜欢</strong>${icon('arrow')}</a></aside><section class="catalog-results" aria-label="商品列表"><div class="catalog-toolbar"><form id="catalog-search" class="inline-search">${icon('search')}<label class="sr-only" for="catalog-q">搜索示例商品</label><input id="catalog-q" name="q" type="search" placeholder="搜索想找的好物"><button type="submit" aria-label="搜索">${icon('arrow')}</button></form><label class="sort-control"><span class="sr-only">商品排序</span><select id="sort-products"><option value="featured">精选推荐</option><option value="price-asc">价格从低到高</option><option value="price-desc">价格从高到低</option><option value="name">名称排序</option></select></label></div><div id="active-filters" class="active-filters"></div><div class="product-grid catalog-grid" id="catalog-grid">${products.map(productCard).join('')}</div><div class="empty-state" id="catalog-empty" hidden>${icon('search')}<h2>暂时没有找到这件好物</h2><p>试试其他关键词，或清除筛选后继续逛逛</p><a href="/catalog/" class="button button-dark">查看全部商品</a></div></section></div></div>`;
}

function product(p) {
  const category = categories.find(c => c.id === p.category);
  return `<div class="container"><nav class="breadcrumb" aria-label="面包屑"><a href="/">首页</a><span>/</span><a href="/catalog/?category=${p.category}">${category.name}</a><span>/</span><span>${p.name}</span></nav><section class="product-detail" data-detail-id="${p.id}"><div class="detail-image"><img src="/assets/${p.image}" alt="${p.name}选品方向插画" width="640" height="640" fetchpriority="high"><span class="image-caption">选品方向示意 · 非真实商品实拍</span></div><div class="detail-content"><span class="eyebrow">${category.name} / ${p.tag}</span><h1>${p.name}</h1><p class="detail-subtitle">${p.subtitle}</p><p class="detail-price"><small>演示价</small>${money(p.priceMinor)}<span>JPY</span></p><p class="detail-intro">${p.description}</p><fieldset class="variant-options"><legend>展示颜色</legend>${p.colors.map((c,i) => `<label><input type="radio" name="variant" value="${c}" ${i === 0 ? 'checked' : ''}><span><i class="color-dot ${p.category === 'kitchen' && p.image === 'bowl.svg' ? 'color-blue' : 'color-natural'}"></i>${c}</span></label>`).join('')}</fieldset><div class="purchase-row"><div class="quantity-control"><button data-detail-minus aria-label="减少示例数量">${icon('minus')}</button><label class="sr-only" for="detail-qty">示例数量</label><input id="detail-qty" type="number" value="1" min="1" max="10" inputmode="numeric"><button data-detail-plus aria-label="增加示例数量">${icon('plus')}</button></div><button class="button button-dark" data-add="${p.id}" data-detail-add>${icon('bag')}加入示例购物车</button><button class="favorite-button icon-button" data-favorite="${p.id}" aria-label="收藏${p.name}" aria-pressed="false">${icon('heart')}</button></div><p class="demo-notice">${icon('info')}当前为结构预览，暂未上架或开放购买</p><div class="detail-accordions"><details open><summary>商品信息</summary><dl>${p.details.map(d => `<div><dt>${d[0]}</dt><dd>${d[1]}</dd></div>`).join('')}</dl></details><details><summary>配送与售后</summary><p>配送地区、运费、时效及退换规则将在开店前公布。目前不接受付款或收集收货地址。</p><a class="text-link" href="/guide/">查看准备进度 ${icon('arrow')}</a></details></div></div></section><section class="section"><div class="section-heading"><div><span class="eyebrow">YOU MAY ALSO LIKE</span><h2>继续发现好物</h2></div><a class="text-link" href="/catalog/">查看全部 ${icon('arrow')}</a></div><div class="product-grid">${products.filter(x => x.id !== p.id).slice(0,4).map(productCard).join('')}</div></section></div>`;
}

function cart() {
  return `<div class="container cart-page"><nav class="breadcrumb" aria-label="面包屑"><a href="/">首页</a><span>/</span><span>示例购物车</span></nav><div class="page-heading"><div><span class="eyebrow">YOUR EVERYDAY FINDS</span><h1>把喜欢的，放在一起</h1><p>这是结构预览的示例购物车，不会产生真实订单</p></div><a href="/catalog/" class="text-link">继续逛逛 ${icon('arrow')}</a></div><div id="cart-content" aria-live="polite"></div><noscript><p>购物车需要启用 JavaScript。您仍可<a href="/catalog/">浏览全部商品</a>。</p></noscript></div>`;
}

function about() {
  return `<div class="container about-page"><nav class="breadcrumb" aria-label="面包屑"><a href="/">首页</a><span>/</span><span>选品理念</span></nav><section class="about-intro"><div><span class="eyebrow">OUR EVERYDAY PHILOSOPHY</span><h1>好物，是日常的陪伴</h1><p class="lead">不追求堆满生活<br>只希望每一件，都刚刚好</p><p>日本精品生活馆正在筹备中。我们从餐厨、家居、个人护理、茶食与随身配件出发，围绕真实的日常需要，建立清楚、好找、让人舒服的选物空间。</p></div><img src="/assets/hero-stilllife.svg" alt="简单自然的茶器生活场景插画" width="1200" height="540"></section><div class="principle-grid"><article><span>01</span><h2>从实用出发</h2><p>先理解一件物品如何进入日常，再决定是否值得推荐。</p></article><article><span>02</span><h2>让信息清楚</h2><p>材质、尺寸、制造地与使用说明分开呈现，让选择有据可依。</p></article><article><span>03</span><h2>留下舒适的空间</h2><p>减少不必要的干扰，让商品和你的需要成为浏览的重点。</p></article></div><div class="about-status"><h2>我们正在准备</h2><p>当前展示的是选品方向和页面结构。正式品牌、实物商品、价格、库存与配送规则会在确认后逐项补全。“日本选品”与“日本制造”将分别说明，制造地以真实商品资料为准。</p><a class="button button-dark" href="/catalog/">看看选品方向 ${icon('arrow')}</a></div></div>`;
}

function guide() {
  return `<div class="container guide-page"><nav class="breadcrumb" aria-label="面包屑"><a href="/">首页</a><span>/</span><span>购物说明</span></nav><div class="page-heading"><div><span class="eyebrow">SHOPPING GUIDE</span><h1>把购物信息，说清楚</h1><p>我们正在筹备开店，以下信息会在正式营业前完整公布</p></div><span class="status-pill">筹备中</span></div><div class="guide-grid"><aside><a href="#preview">当前预览</a><a href="#shipping">配送与运费</a><a href="#after-sales">售后与联系</a><a href="#privacy">隐私说明</a></aside><div class="guide-sections"><section id="preview"><h2>当前可以体验什么</h2><p>您可以浏览示例商品、使用搜索与筛选、查看详情，并将商品放入保存在当前浏览器中的示例购物车。演示价格仅用于检查页面和计算功能，不是正式报价。</p><p>目前没有开放购买、付款或真实订单提交。</p></section><section id="shipping"><h2>配送与运费</h2><dl class="status-list"><div><dt>配送地区</dt><dd>待确认</dd></div><div><dt>运费与税费</dt><dd>待确认</dd></div><div><dt>发货与预计时效</dt><dd>待确认</dd></div></dl><p>正式开放购买前，商品页和结算页将展示适用地区、配送费用及相关说明。</p></section><section id="after-sales"><h2>售后与联系</h2><p>退换条件、处理流程、营业主体与客服联系方式将在正式营业前公布。当前预览不收集地址、电话号码或付款信息。</p></section><section id="privacy"><h2>预览版隐私说明</h2><p>示例购物车与收藏仅使用当前浏览器的本地存储，保存商品标识和数量，不上传至订单系统；您可以随时清空。如果浏览器禁用本地存储，页面会提示无法跨次保留。</p><p>正式运营的隐私政策、用户权利和必要的服务说明，需要结合真实业务与服务配置另行完善。</p><button class="button button-outline" data-clear-local>清空本机示例购物车与收藏</button></section></div></div></div>`;
}

const adminSections = [
  ['overview','概览','grid'], ['products','商品管理','box'], ['categories','分类管理','grid'], ['inventory','库存管理','box'], ['orders','订单管理','bag'], ['media','商品素材','grid'], ['shipping','配送与售后','home'], ['usage','用量与提醒','chart'], ['settings','店铺设置','settings'],
];

function adminBody() {
  return `<div class="admin-shell"><aside class="admin-sidebar"><a class="brand" href="/">${mark}<span><strong>生活馆管理</strong><small>ADMIN PREVIEW</small></span></a><span class="admin-nav-label">店铺管理</span><nav aria-label="后台模块">${adminSections.map(([id,label,ico],i) => `<button data-admin-section="${id}" ${i === 0 ? 'aria-current="page"' : ''}>${icon(ico)}${label}</button>`).join('')}</nav><div class="admin-side-bottom"><span class="status-pill">结构演示</span><a href="/">${icon('arrow')}返回店铺预览</a></div></aside><div class="admin-workspace"><header class="admin-topbar"><span>日本精品生活馆 <span class="admin-divider">/</span> <strong id="admin-breadcrumb">概览</strong></span><a class="text-link" href="/">查看店铺 ${icon('arrow')}</a></header><main id="main" class="admin-main"><div class="admin-notice">${icon('info')}中文后台结构演示 · 未连接真实商品、订单或账户用量</div><div id="admin-content"></div></main></div></div>`;
}

function notFound() {
  return `<div class="container empty-state not-found"><span class="eyebrow">404</span><h1>这件好物，还没到这里</h1><p>页面可能不存在，回到商品列表继续逛逛吧</p><a class="button button-dark" href="/catalog/">浏览全部商品 ${icon('arrow')}</a></div>`;
}

export function renderPage(kind, item) {
  const titles = { home: '日本精品生活馆 · 用心挑选，陪伴日常', catalog: '全部商品 · 日本精品生活馆', product: `${item?.name ?? ''} · 日本精品生活馆`, cart: '示例购物车 · 日本精品生活馆', about: '选品理念 · 日本精品生活馆', guide: '购物说明 · 日本精品生活馆', admin: '中文后台结构演示 · 日本精品生活馆', notFound: '页面未找到 · 日本精品生活馆' };
  const bodies = { home, catalog, product: () => product(item), cart, about, guide, notFound };
  const data = JSON.stringify({ shop, categories, products, page: kind, adminSections }).replaceAll('<','\\u003c');
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(titles[kind])}</title><meta name="description" content="日本精品生活馆筹备预览：餐厨器具、家居日用、美妆个护、食品茶饮与服饰配件。商品和价格仅作结构示意，暂未开放购买。"><meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="#ffffff"><link rel="icon" type="image/svg+xml" href="/assets/favicon.svg"><link rel="stylesheet" href="/assets/styles.css"><script type="module" src="/assets/app.js"></script></head><body data-page="${kind}">${kind === 'admin' ? adminBody() : `${header(kind)}<main id="main">${bodies[kind]()}</main>${footer()}${dialogs()}`}<script id="shop-data" type="application/json">${data}</script></body></html>`;
}
