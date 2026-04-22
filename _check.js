const https = require('https');
function api(method, path, body) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : undefined;
    const req = https.request({
      hostname: 'ssqwo123-production.up.railway.app', path, method,
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer authorized',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}) }
    }, res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>{try{resolve(JSON.parse(d));}catch{resolve(d);}}); });
    req.on('error',e=>resolve({error:e.message}));
    if(data) req.write(data); req.end();
  });
}
async function main(){
  const r = await api('GET','/api/products');
  console.log(JSON.stringify(r,null,2));
}
main();
