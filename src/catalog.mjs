/** 仅用于界面结构验收的示例目录，禁止导入生产数据库。 */
export const categories = [
  { id: 'kitchen', name: '餐桌器物', glyph: '器', subtitle: '一餐一器，认真生活', icon: 'cup' },
  { id: 'home', name: '起居织物', glyph: '布', subtitle: '让家，多一份舒适', icon: 'home' },
  { id: 'care', name: '日常洗护', glyph: '净', subtitle: '留一点时间给自己', icon: 'sparkles' },
  { id: 'food', name: '茶与食', glyph: '茶', subtitle: '一杯一口的小满足', icon: 'leaf' },
  { id: 'accessories', name: '随身好物', glyph: '行', subtitle: '轻轻松松，出门去', icon: 'bag' },
];

export const products = [
  { id: 'demo-cup', slug: 'everyday-ceramic-cup', name: '日常陶瓷杯碟', category: 'kitchen', subtitle: '把片刻留给一杯热茶', image: 'cup-editorial.webp', priceMinor: 2800, currency: 'JPY', tag: '餐桌日常', scene: 'table', colors: ['米白'], details: [['设计方向', '温润陶瓷 · 简洁线条'], ['规格', '容量与尺寸待实物确认'], ['制造地', '待供应商资料确认'], ['采购地', '待采购资料确认']], description: '一只喜欢的杯子，让喝水、喝茶与早餐都成为值得期待的日常。此商品用于展示页面结构，材质、容量和供货信息将在正式选品后完善。' },
  { id: 'demo-bowl', slug: 'indigo-dining-bowl', name: '深蓝釉色餐碗', category: 'kitchen', subtitle: '盛下每一餐的简单美好', image: 'bowl-editorial.webp', priceMinor: 2200, currency: 'JPY', tag: '餐桌日常', scene: 'table', colors: ['深蓝'], details: [['设计方向', '深蓝釉色 · 日用器型'], ['规格', '口径与容量待实物确认'], ['制造地', '待供应商资料确认'], ['采购地', '待采购资料确认']], description: '沉静的深蓝，为简单的一餐添一点层次。当前图片为AI 生成的选品示意图，正式商品将补充实拍、尺寸、材质以及适用说明。' },
  { id: 'demo-towel', slug: 'soft-everyday-towels', name: '柔软日用毛巾', category: 'home', subtitle: '让舒适，成为每天的习惯', image: 'towel-editorial.webp', priceMinor: 1800, currency: 'JPY', tag: '舒适居家', scene: 'home', colors: ['米白', '浅灰'], details: [['设计方向', '柔和配色 · 日常织物'], ['规格', '尺寸与纤维成分待确认'], ['制造地', '待供应商资料确认'], ['采购地', '待采购资料确认']], description: '从清晨洗漱到一天结束，用柔和的触感照顾日常。此处展示商品信息的组织方式，正式销售前将核对纤维成分、尺寸与洗护要求。' },
  { id: 'demo-tea', slug: 'quiet-afternoon-tea', name: '午后茶饮选品', category: 'food', subtitle: '给忙碌按下片刻暂停', image: 'tea-editorial.webp', priceMinor: 1600, currency: 'JPY', tag: '午后时光', scene: 'tea', colors: ['原色'], details: [['选品方向', '茶饮与日常茶点'], ['规格', '配料、净含量与保质期待确认'], ['制造地', '待供应商资料确认'], ['采购地', '待采购资料确认']], description: '给自己泡一杯茶，慢慢享受一段安静的时间。当前包装为无品牌示意；正式上架前需补全真实品牌、配料、过敏原、保存方式与保质期。' },
  { id: 'demo-bottle', slug: 'daily-care-essentials', name: '日常洗护选品', category: 'care', subtitle: '从细小的日常照顾自己', image: 'bottle-editorial.webp', priceMinor: 2400, currency: 'JPY', tag: '舒适居家', scene: 'home', colors: ['米白'], details: [['选品方向', '日常清洁与基础护理'], ['规格', '成分、容量与使用方法待确认'], ['制造地', '待供应商资料确认'], ['采购地', '待采购资料确认']], description: '简洁的日常护理，留给自己一点从容。瓶身示意图由 AI 生成，仅用于版式展示，不代表具体品牌或配方，也不构成任何功效承诺。' },
  { id: 'demo-bag', slug: 'everyday-canvas-bag', name: '轻便日常托特包', category: 'accessories', subtitle: '装下出门需要的刚刚好', image: 'bag-editorial.webp', priceMinor: 3200, currency: 'JPY', tag: '随身好物', scene: 'outdoor', colors: ['原色'], details: [['设计方向', '自然色调 · 轻便收纳'], ['规格', '尺寸、成分与承重待确认'], ['制造地', '待供应商资料确认'], ['采购地', '待采购资料确认']], description: '买一本书、带一把伞，装下平凡一天的小小收获。此图展示配件分类的视觉方向，实际材质、尺寸与供货状态待确认。' },
];

export const shop = {
  name: '日本精品生活馆',
  englishName: 'JAPAN LIFE STORE',
  mode: 'preview',
  currency: 'JPY',
  previewNotice: '筹备预览 · 图片为 AI 生成示意，商品与价格仅作演示',
};
