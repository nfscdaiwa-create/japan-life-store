import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCart, normalizeFavorites, cartTotal, filterProducts, cartItemKey, clampDemoQuantity, restoreCartItem, createSelectionStore } from '../public/assets/store-core.mjs';
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

test('撤销只恢复被删颜色，保留当前其他颜色与其他标签页新增的商品',()=>{
  const towel = { ...products.find(p=>p.id==='demo-towel'), colors:['米白','浅灰'] };
  const catalog = products.map(p=>p.id===towel.id ? towel : p);
  const current = [{id:towel.id,color:'米白',quantity:7},{id:'demo-cup',color:'米白',quantity:2}];
  const restored = restoreCartItem(current,{id:towel.id,color:'浅灰',quantity:3},catalog);
  assert.deepEqual(restored,[...current,{id:towel.id,color:'浅灰',quantity:3}]);
  assert.equal(current.length,2);
  assert.deepEqual(restoreCartItem([],{id:towel.id,color:'浅灰',quantity:3},catalog),[{id:towel.id,color:'浅灰',quantity:3}]);
});

test('撤销与当前同色合并仍不超过10件，失效颜色不被偷偷改成首色',()=>{
  const towel = { ...products.find(p=>p.id==='demo-towel'), colors:['米白','浅灰'] };
  const current = [{id:towel.id,color:'浅灰',quantity:8},{id:towel.id,color:'米白',quantity:2}];
  assert.deepEqual(restoreCartItem(current,{id:towel.id,color:'浅灰',quantity:4},[towel]),[
    {id:towel.id,color:'浅灰',quantity:10},{id:towel.id,color:'米白',quantity:2},
  ]);
  assert.deepEqual(restoreCartItem(current,{id:towel.id,color:'不存在的颜色',quantity:4},[towel]),current);
});

function storedSelection(initial, normalize = value=>normalizeCart(value,products)) {
  let raw = JSON.stringify(initial);
  const blocked = { read:false, write:false };
  let writes = 0;
  const open = () => createSelectionStore({
    read:() => {
      if (blocked.read) throw new Error('SecurityError');
      return JSON.parse(raw);
    },
    write:value => {
      if (blocked.write) throw new Error('QuotaExceededError');
      raw = JSON.stringify(value);
      writes += 1;
    },
    normalize,
  });
  return { open, blocked, read:()=>JSON.parse(raw), replace:value=>{ raw = JSON.stringify(value); }, get writes() { return writes; } };
}

test('两个已加载页面未收到同步事件时，写前合入最新条目与当前增量',()=>{
  const towel = { id:'demo-towel',color:'米白',quantity:2 };
  const memory = storedSelection([towel]);
  const first = memory.open();
  const second = memory.open();
  first.update(current=>[...current,{id:'demo-cup',quantity:1}]);
  second.update(current=>[...current,{id:'demo-tea',quantity:1}]);
  assert.deepEqual(memory.read().map(item=>item.id),['demo-towel','demo-cup','demo-tea']);
  first.update(current=>current.map(item=>cartItemKey(item)===cartItemKey(towel) ? {...item,quantity:item.quantity+1} : item));
  second.update(current=>current.map(item=>cartItemKey(item)===cartItemKey(towel) ? {...item,quantity:item.quantity+1} : item));
  assert.equal(memory.read()[0].quantity,4);
  assert.equal(memory.read().length,3);
  assert.deepEqual(first.refresh(),second.refresh());
});

test('写入失败后数量、移除与撤销留在本页，恢复写入保留其他页面新增项',()=>{
  const towel = { id:'demo-towel',color:'米白',quantity:2 };
  const cup = { id:'demo-cup',color:'米白',quantity:1 };
  const memory = storedSelection([towel,cup]);
  const store = memory.open();
  memory.blocked.write = true;
  store.update(current=>current.map(item=>cartItemKey(item)===cartItemKey(towel) ? {...item,quantity:3} : item));
  const removed = store.update(current=>current.filter(item=>cartItemKey(item)!==cartItemKey(cup)));
  assert.equal(removed.saved,false);
  assert.deepEqual(store.value,[{...towel,quantity:3}]);
  assert.deepEqual(store.refresh(),[{...towel,quantity:3}]);
  assert.deepEqual(memory.read(),[towel,cup]);
  store.update(current=>restoreCartItem(current,cup,products));
  assert.deepEqual(store.value,[{...towel,quantity:3},cup]);
  memory.replace([towel,cup,{id:'demo-tea',color:'原色',quantity:2}]);
  memory.blocked.write = false;
  const result = store.update(current=>[...current,{id:'demo-bowl',color:'深蓝',quantity:1}]);
  assert.equal(result.saved,true);
  assert.deepEqual(memory.read(),[
    {...towel,quantity:3},{id:'demo-tea',color:'原色',quantity:2},cup,{id:'demo-bowl',color:'深蓝',quantity:1},
  ]);
  assert.deepEqual(store.refresh(),memory.read());
});

test('读取失败不覆盖存储；重复刷新不会重复累加，读写恢复后重新合并',()=>{
  const towel = {id:'demo-towel',color:'米白',quantity:2};
  const memory = storedSelection([towel]);
  const store = memory.open();
  memory.blocked.read = true;
  const result = store.update(current=>[...current,{id:'demo-tea',color:'原色',quantity:2}]);
  assert.equal(result.saved,false);
  assert.equal(memory.writes,0);
  assert.deepEqual(store.refresh(),store.refresh());
  assert.equal(store.value.find(item=>item.id==='demo-tea').quantity,2);
  memory.replace([towel,{id:'demo-cup',color:'米白',quantity:1}]);
  memory.blocked.read = false;
  store.refresh();
  assert.equal(store.saved,false);
  assert.equal(memory.writes,0);
  const recovered = store.update(current=>[...current,{id:'demo-bowl',color:'深蓝',quantity:1}]);
  assert.equal(recovered.saved,true);
  assert.deepEqual(memory.read().map(item=>item.id),['demo-towel','demo-cup','demo-tea','demo-bowl']);
  assert.equal(store.refresh().find(item=>item.id==='demo-tea').quantity,2);
  assert.equal(memory.writes,1);
});

test('收藏按明确的加入或取消动作合并，购物袋保存成功不会清除收藏的失败状态',()=>{
  const memory = storedSelection([],value=>normalizeFavorites(value,products));
  const first = memory.open();
  const second = memory.open();
  first.update(current=>[...current,'demo-cup']);
  second.update(current=>[...current,'demo-tea']);
  assert.deepEqual(memory.read(),['demo-cup','demo-tea']);
  memory.blocked.write = true;
  second.update(current=>current.filter(id=>id!=='demo-cup'));
  assert.deepEqual(second.refresh(),['demo-tea']);
  const cartMemory = storedSelection([]);
  assert.equal(cartMemory.open().update(()=>[{id:'demo-towel',quantity:2}]).saved,true);
  assert.equal(second.saved,false);
  memory.replace(['demo-cup','demo-tea','demo-bag']);
  assert.deepEqual(second.refresh(),['demo-tea','demo-bag']);
  memory.blocked.write = false;
  second.update(current=>[...current,'demo-towel']);
  assert.deepEqual(memory.read(),['demo-tea','demo-bag','demo-towel']);
  assert.equal(second.saved,true);
});
