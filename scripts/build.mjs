import { mkdir, cp, writeFile, rm, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { products } from '../src/catalog.mjs';
import { renderPage } from '../src/render.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = path.join(root,'dist');
await rm(dist,{recursive:true,force:true});
await mkdir(dist,{recursive:true});
await cp(path.join(root,'public'),dist,{recursive:true});
const pages = [
  ['index.html','home'], ['catalog/index.html','catalog'], ['cart/index.html','cart'],
  ['about/index.html','about'], ['guide/index.html','guide'], ['admin/index.html','admin'], ['404.html','notFound'],
  ...products.map(p=>[`products/${p.slug}/index.html`,'product',p]),
];
for (const [relative,kind,product] of pages) {
  const destination = path.join(dist,relative);
  await mkdir(path.dirname(destination),{recursive:true});
  await writeFile(destination,renderPage(kind,product),'utf8');
}
const files = await readdir(dist,{recursive:true});
console.log(`已构建 ${pages.length} 个静态页面；资源目录 dist/；无需安装运行时依赖。`);
console.log(`选品示例 ${products.length} 件；所有页面保持 noindex；真实结算未开放。`);
