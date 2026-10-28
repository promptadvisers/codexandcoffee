import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const port=Number(process.env.PORT||4323);
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.md':'text/plain','.svg':'image/svg+xml'};
http.createServer(async(req,res)=>{try{
 const requestPath=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 const filename=path.resolve(root,'.'+(requestPath.endsWith('/')?requestPath+'index.html':requestPath));
 if(!filename.startsWith(root+path.sep)){res.writeHead(403);return res.end('Forbidden');}
 const content=await fs.readFile(filename);res.writeHead(200,{'Content-Type':mime[path.extname(filename)]||'application/octet-stream','Cache-Control':'no-store'});res.end(content);
 }catch{res.writeHead(404);res.end('Not found');}}).listen(port,'127.0.0.1',()=>console.log('Quote Studio: http://127.0.0.1:'+port));
