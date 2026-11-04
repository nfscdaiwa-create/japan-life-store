import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assetReferences, listFiles, localFile } from './build.mjs';
const root = fileURLToPath(new URL('../dist/', import.meta.url));
const allFiles = await listFiles(root);
const available = new Set(allFiles);
const pages = allFiles.filter(filename => filename.endsWith('.html'));
if (!pages.length) throw new Error('dist/ 中没有构建页面；请先运行 npm run build。');
for (const required of ['_headers', 'robots.txt']) {
  if (!available.has(required)) throw new Error('dist/ 缺少托管所需文件：' + required);
}
let checked = 0;
for (const relative of allFiles.filter(filename => /\.(?:html|css|js|mjs|svg)$/i.test(filename))) {
  const source = await readFile(path.join(root, relative), 'utf8');
  if (relative.endsWith('.html') && !source.includes('content="noindex,nofollow"')) throw new Error(relative + ' 缺少预览 noindex');
  for (const reference of assetReferences(source, relative)) {
    if (localFile(reference, relative, available)) checked++;
  }
}
const worker = await readFile(fileURLToPath(new URL('../worker/index.mjs',import.meta.url)),'utf8');
if (!worker.includes('CHECKOUT_NOT_CONFIGURED') || !worker.includes('ADMIN_NOT_CONFIGURED')) throw new Error('缺少未配置交易/管理保护');
console.log('检查通过：' + pages.length + ' 页面，' + checked + ' 个本地链接与资源（含 CSS/ESM/SVG 依赖）；预览索引限制与 API 关闭状态存在。');
