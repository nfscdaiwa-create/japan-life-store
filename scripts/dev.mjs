import http from 'node:http';
import { readFile,stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import worker from '../worker/index.mjs';

const root = path.resolve(fileURLToPath(new URL('../dist/',import.meta.url)));
const args = process.argv.slice(2);
const portArg = args.indexOf('--port');
const hostArg = args.indexOf('--host');
const port = Number(portArg >= 0 ? args[portArg+1] : process.env.PORT || 3000);
const host = hostArg >= 0 ? args[hostArg+1] : '0.0.0.0';
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8','.json':'application/json; charset=utf-8'};
const security = {
  'X-Robots-Tag':'noindex, nofollow',
  'X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'strict-origin-when-cross-origin',
  // 本地预览允许同源窄屏测试框；生产 public/_headers 仍禁止页面嵌入。
  'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'",
};
async function serve(request) {
  const url = new URL(request.url);
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { return new Response('Bad request',{status:400}); }
  if (pathname.includes('\0') || pathname.split('/').some(p=>p.startsWith('.')) || /\\/.test(pathname)) return new Response('Not found',{status:404});
  let file = path.resolve(root,`.${pathname}`);
  if (file !== root && !file.startsWith(root+path.sep)) return new Response('Not found',{status:404});
  let status = 200;
  try {
    const info = await stat(file);
    if (info.isDirectory()) {
      if (!pathname.endsWith('/')) return new Response(null,{status:308,headers:{Location:url.pathname+'/'+url.search}});
      file = path.join(file,'index.html');
    }
    if (!['GET','HEAD'].includes(request.method)) return new Response('Method not allowed',{status:405,headers:{Allow:'GET, HEAD'}});
    const body = await readFile(file);
    return new Response(request.method === 'HEAD' ? null : body,{status,headers:{...security,'Content-Type':types[path.extname(file)] || 'application/octet-stream','Cache-Control':'no-store'}});
  } catch {
    const body = await readFile(path.join(root,'404.html'));
    return new Response(request.method === 'HEAD' ? null : body,{status:404,headers:{...security,'Content-Type':'text/html; charset=utf-8'}});
  }
}
const server = http.createServer(async (req,res)=>{
  try {
    const request = new Request(`http://${req.headers.host || 'localhost'}${req.url}`,{method:req.method,headers:req.headers});
    const response = new URL(request.url).pathname.startsWith('/api/') ? await worker.fetch(request,{ASSETS:{fetch:serve}}) : await serve(request);
    res.writeHead(response.status,Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    res.writeHead(500,{'Content-Type':'text/plain; charset=utf-8'});
    res.end('本地预览发生错误');
  }
});
server.listen(port,host,()=>console.log(`Local preview ready: http://${host}:${port}`));
