import { mkdir, copyFile, writeFile, rm, readdir, readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { products } from '../src/catalog.mjs';
import { renderPage } from '../src/render.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const publicRoot = path.join(root, 'public');
const dist = path.join(root, 'dist');
const localOrigin = 'https://preview.invalid';
const textAssets = /\.(?:html|css|js|mjs|svg)$/i;

export async function listFiles(directory) {
  return (await readdir(directory, { recursive: true, withFileTypes: true }))
    .filter(entry => entry.isFile())
    .map(entry => path.relative(directory, path.join(entry.parentPath, entry.name)).split(path.sep).join('/'))
    .sort();
}

// Literal references used by this static site, not a JavaScript bundler.
// Computed product images are registered separately in createBuildPlan.
export function assetReferences(source, filename) {
  const references = [];
  const add = value => { if (value) references.push(value.replaceAll('&amp;', '&')); };
  if (/\.(?:html|svg)$/i.test(filename)) {
    const markup = source.replace(/<!--[\s\S]*?-->/g, '').replace(/(<script\b[^>]*>)[\s\S]*?<\/script>/gi, '$1</script>');
    for (const match of markup.matchAll(/\b(?:href|src|xlink:href|poster)\s*=\s*(["'])(.*?)\1/g)) add(match[2]);
    for (const match of markup.matchAll(/\b(?:srcset|imagesrcset)\s*=\s*(["'])(.*?)\1/g)) {
      if (/\bdata:/i.test(match[2])) throw new Error(filename + ' 的 srcset 使用了内联 data URL；请改用独立资源。');
      for (const candidate of match[2].split(',')) add(candidate.trim().split(/\s+/)[0]);
    }
    source = markup;
  }
  if (/\.(?:html|svg|css)$/i.test(filename)) {
    const css = source.replace(/\/\*[\s\S]*?\*\//g, '');
    for (const match of css.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s)]+))\s*\)/gi)) add(match[1] ?? match[2] ?? match[3]);
    for (const match of css.matchAll(/@import\s+(["'])(.*?)\1/gi)) add(match[2]);
  }
  if (/\.(?:js|mjs)$/i.test(filename)) {
    const moduleReferences = [];
    for (const match of source.matchAll(/\b(?:import|export)\s+(?:[\w$*{},\s]+?\s+from\s*)?(["'])([^"'\r\n]+)\1/g)) moduleReferences.push(match[2]);
    for (const match of source.matchAll(/\bimport\s*\(\s*(["'])([^"'\r\n]+)\1\s*\)/g)) moduleReferences.push(match[2]);
    for (const reference of moduleReferences) {
      if (!/^(?:\.{1,2}\/|\/|[a-z][a-z\d+.-]*:)/i.test(reference)) throw new Error(filename + ' 包含不支持的裸模块引用：' + reference);
      add(reference);
    }
    for (const match of source.matchAll(/(["'])(\/assets\/[^"'\s<>]+)\1/g)) {
      if (!match[2].includes('$' + '{')) add(match[2]);
    }
  }
  return references;
}

export function localFile(reference, fromFile, available) {
  if (!reference || reference.startsWith('#')) return null;
  const url = new URL(reference, new URL(fromFile, localOrigin + '/'));
  if (url.origin !== localOrigin) return null;
  let relative = decodeURIComponent(url.pathname).replace(/^\//, '');
  if (!relative || relative.endsWith('/')) relative += 'index.html';
  if (available.has(relative)) return relative;
  if (available.has(relative + '/index.html')) return relative + '/index.html';
  throw new Error(fromFile + ' 的本地链接或资源不存在：' + reference);
}

export async function createBuildPlan() {
  const definitions = [
    ['index.html', 'home'], ['catalog/index.html', 'catalog'], ['cart/index.html', 'cart'],
    ['about/index.html', 'about'], ['guide/index.html', 'guide'], ['admin/index.html', 'admin'], ['404.html', 'notFound'],
    ...products.map(product => ['products/' + product.slug + '/index.html', 'product', product]),
  ];
  const pages = new Map(definitions.map(([filename, kind, product]) => [filename, renderPage(kind, product)]));
  const publicFiles = await listFiles(publicRoot);
  const available = new Set([...pages.keys(), ...publicFiles]);
  const visited = new Set();
  const assets = new Set();
  // Consumed by hosting or by runtime-generated search/cart/admin interfaces.
  const pending = [...pages.keys(), '_headers', 'robots.txt', ...products.map(product => 'assets/' + product.image)];
  if (available.has('_redirects')) pending.push('_redirects');
  while (pending.length) {
    const filename = pending.pop();
    if (visited.has(filename)) continue;
    if (!available.has(filename)) throw new Error('构建所需文件不存在：' + filename);
    visited.add(filename);
    if (!pages.has(filename)) assets.add(filename);
    if (/\.(?:woff2?|ttf|otf)$/i.test(filename)) {
      const directory = path.posix.dirname(filename);
      pending.push(...publicFiles.filter(file => path.posix.dirname(file) === directory && /^(?:OFL|LICENSE|COPYING)(?:[._-]|$)/i.test(path.posix.basename(file))));
    }
    if (!textAssets.test(filename)) continue;
    const source = pages.get(filename) ?? await readFile(path.join(publicRoot, filename), 'utf8');
    for (const reference of assetReferences(source, filename)) {
      const dependency = localFile(reference, filename, available);
      if (dependency) pending.push(dependency);
    }
  }
  const omitted = publicFiles.filter(filename => !assets.has(filename));
  const omittedBytes = (await Promise.all(omitted.map(filename => stat(path.join(publicRoot, filename))))).reduce((total, entry) => total + entry.size, 0);
  return { pages, assets: [...assets].sort(), omitted, omittedBytes };
}

async function build() {
  // Validate before replacing dist; missing references preserve the old build.
  const plan = await createBuildPlan();
  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });
  for (const [relative, html] of plan.pages) {
    const destination = path.join(dist, relative);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, html, 'utf8');
  }
  for (const relative of plan.assets) {
    const destination = path.join(dist, relative);
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(path.join(publicRoot, relative), destination);
  }
  console.log('已构建 ' + plan.pages.size + ' 个静态页面，复制 ' + plan.assets.length + ' 个依赖文件；资源目录 dist/；无需安装运行时依赖。');
  console.log('发布目录排除 ' + plan.omitted.length + ' 个未引用源文件（' + plan.omittedBytes + ' B）；public/ 源文件全部保留。');
  console.log('选品示例 ' + products.length + ' 件；所有页面保持 noindex；真实结算未开放。');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await build();
