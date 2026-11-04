import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCart, normalizeFavorites, cartTotal, filterProducts, cartItemKey, clampDemoQuantity } from '../public/assets/store-core.mjs';
import { products,categories } from '../src/catalog.mjs';

test('篡改本地金额不会影响示例计价；金额使用日元整数',()=>{
  const cart = [{id:'demo-cup',quantity:2,priceMinor:1},{id:'demo-tea',quantity:1,priceMinor:0}];
  assert.equal(cartTotal(cart,products),7200);
  assert.deepEqual(normalizeCart(cart,products),[{id:'demo-cup',color:'米白',quantity:2},{id:'demo-tea',color:'原色',quantity:1}]);
});
test('忽略未知条目与非法数量，合并重复项并限制演示数量',()=>{
  const raw=[{id:'demo-cup',quantity:7},{id:'demo-cup',quantity:9},{id:'unknown',quantity:1},{id:'demo-tea',quantity:-5},{id:'demo-bag',quantity:Infinity},{id:'demo-towel',quantity:1.9}];
  assert.deepEqual(normalizeCart(raw,products),[{id:'demo-cup',color:'米白',quantity:10},{id:'demo-towel',color:'米白',quantity:1}]);
  assert.deepEqual(normalizeCart({items:raw},products),[]);
  assert.deepEqual(normalizeFavorites(['demo-cup','demo-cup','unknown',null],products),['demo-cup']);
});
test('旧购物袋迁移首色，同色合并、异色分行，存储往返不丢颜色与数量',()=>{
  const towel = { ...products.find(p=>p.id==='demo-towel'), colors:['米白','浅灰'] };
  const raw = [
    {id:towel.id,quantity:2},
    {id:towel.id,color:'米白',quantity:3},
    {id:towel.id,color:'浅灰',quantity:4,priceMinor:1},
    {id:towel.id,color:'不存在的颜色',quantity:9},
    {id:towel.id,color:null,quantity:9},
  ];
  const result = normalizeCart(raw,[towel]);
  assert.deepEqual(result,[
    {id:towel.id,color:'米白',quantity:5},
    {id:towel.id,color:'浅灰',quantity:4},
  ]);
  assert.deepEqual(normalizeCart(JSON.parse(JSON.stringify(result)),[towel]),result);
  assert.equal(new Set(result.map(cartItemKey)).size,2);
  assert.equal(cartTotal(result,[towel]),9*towel.priceMinor);
  assert.equal(raw[0].quantity,2);
});
test('每个展示颜色独立限制10件；非法输入不会绕过边界或变成无限数量',()=>{
  const towel = { ...products.find(p=>p.id==='demo-towel'), colors:['米白','浅灰'] };
  assert.deepEqual(normalizeCart([
    {id:towel.id,color:'米白',quantity:9},
    {id:towel.id,color:'米白',quantity:6},
    {id:towel.id,color:'浅灰',quantity:12},
    {id:towel.id,color:'浅灰',quantity:'2'},
    {id:towel.id,color:'浅灰',quantity:NaN},
  ],[towel]),[
    {id:towel.id,color:'米白',quantity:10},
    {id:towel.id,color:'浅灰',quantity:10},
  ]);
  assert.equal(clampDemoQuantity('99'),10);
  assert.equal(clampDemoQuantity('-2'),1);
  assert.equal(clampDemoQuantity('3.8'),3);
  assert.equal(clampDemoQuantity('',4),4);
  assert.equal(clampDemoQuantity('invalid',4),4);
  assert.equal(clampDemoQuantity(Infinity,4),4);
});
test('组合筛选同时尊重关键词、分类、价格、收藏和排序',()=>{
  assert.deepEqual(filterProducts(products,categories,{category:'kitchen',sort:'price-asc'}).map(p=>p.id),['demo-bowl','demo-cup']);
  assert.deepEqual(filterProducts(products,categories,{q:'毛巾',min:1000,max:2000}).map(p=>p.id),['demo-towel']);
  assert.deepEqual(filterProducts(products,categories,{ids:[]}),[]);
  assert.equal(filterProducts(products,categories,{q:'<script>alert(1)</script>'}).length,0);
  assert.equal(filterProducts(products,categories,{category:'kitchen',min:3000}).length,0);
});
