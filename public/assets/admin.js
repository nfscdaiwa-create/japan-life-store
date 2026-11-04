/** 中文后台的只读结构预览；不读取或写入浏览器购物袋与收藏。 */
const dataElement = document.getElementById('shop-data');
const { products, categories, adminSections } = JSON.parse(dataElement.textContent);
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
if ($('#admin-content')) {
  renderAdmin(location.hash.slice(1));
  $$('[data-admin-section]').forEach(button=>button.addEventListener('click',()=>{location.hash=button.dataset.adminSection;}));
  window.addEventListener('hashchange',()=>renderAdmin(location.hash.slice(1)));
}
