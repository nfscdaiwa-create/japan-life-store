import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCart, normalizeFavorites, cartTotal, filterProducts } from '../public/assets/store-core.mjs';
import { products,categories } from '../src/catalog.mjs';

test('篡改本地金额不会影响示例计价；金额使用日元整数',()=>{
  const cart = [{id:'demo-cup',quantity:2,priceMinor:1},{id:'demo-tea',quantity:1,priceMinor:0}];
  assert.equal(cartTotal(cart,products),7200);
  assert.deepEqual(normalizeCart(cart,products),[{id:'demo-cup',quantity:2},{id:'demo-tea',quantity:1}]);
});
test('忽略未知条目与非法数量，合并重复项并限制演示数量',()=>{
  const raw=[{id:'demo-cup',quantity:7},{id:'demo-cup',quantity:9},{id:'unknown',quantity:1},{id:'demo-tea',quantity:-5},{id:'demo-bag',quantity:Infinity},{id:'demo-towel',quantity:1.9}];
  assert.deepEqual(normalizeCart(raw,products),[{id:'demo-cup',quantity:10},{id:'demo-towel',quantity:1}]);
  assert.deepEqual(normalizeCart({items:raw},products),[]);
  assert.deepEqual(normalizeFavorites(['demo-cup','demo-cup','unknown',null],products),['demo-cup']);
});
test('组合筛选同时尊重关键词、分类、价格、收藏和排序',()=>{
  assert.deepEqual(filterProducts(products,categories,{category:'kitchen',sort:'price-asc'}).map(p=>p.id),['demo-bowl','demo-cup']);
  assert.deepEqual(filterProducts(products,categories,{q:'毛巾',min:1000,max:2000}).map(p=>p.id),['demo-towel']);
  assert.deepEqual(filterProducts(products,categories,{ids:[]}),[]);
  assert.equal(filterProducts(products,categories,{q:'<script>alert(1)</script>'}).length,0);
  assert.equal(filterProducts(products,categories,{category:'kitchen',min:3000}).length,0);
});
