import { readdir,readFile,stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../dist/',import.meta.url));
const files = (await readdir(root,{recursive:true})).filter(p=>p.endsWith('.html'));
let checked = 0;
for (const relative of files) {
  const html = await readFile(path.join(root,relative),'utf8');
  if (!html.includes('content="noindex,nofollow"')) throw new Error(`${relative} 缺少预览 noindex`);
  for (const match of html.matchAll(/(?:href|src)="([^"#][^"]*)"/g)) {
    if (!match[1].startsWith('/')) continue;
    const pathname = new URL(match[1],'https://preview.invalid').pathname;
    const asset = path.join(root,pathname.endsWith('/') ? `${pathname}index.html` : pathname);
    await stat(asset).catch(()=>{throw new Error(`${relative} 的本地链接不存在：${match[1]}`);});
    checked++;
  }
}
const worker = await readFile(fileURLToPath(new URL('../worker/index.mjs',import.meta.url)),'utf8');
if (!worker.includes('CHECKOUT_NOT_CONFIGURED') || !worker.includes('ADMIN_NOT_CONFIGURED')) throw new Error('缺少未配置交易/管理保护');
console.log(`检查通过：${files.length} 页面，${checked} 个本地链接与资源；预览索引限制与 API 关闭状态存在。`);
