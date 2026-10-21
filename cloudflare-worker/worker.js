// Paula Docce / Cloudflare Worker: authentication + GitHub JSON file editing.
const te = new TextEncoder(), td = new TextDecoder(), MAX_BODY=100000, EIGHT_HOURS=8*3600*1000;
const filePath='data/pricing.json';
const encode = bytes => {let t='';for(let i=0;i<bytes.length;i+=8192)t+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(t)};
const decode = text => Uint8Array.from(atob(text.replace(/\s/g,'')), c=>c.charCodeAt(0));
const url64 = bytes => encode(bytes).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const unurl64 = text => decode(text.replace(/-/g,'+').replace(/_/g,'/'));
async function hmac(secret,message){const key=await crypto.subtle.importKey('raw',te.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return new Uint8Array(await crypto.subtle.sign('HMAC',key,te.encode(message)))}
async function hash(text){return new Uint8Array(await crypto.subtle.digest('SHA-256',te.encode(text)))}
function safeEqual(a,b){let n=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)n|=(a[i]||0)^(b[i]||0);return n===0}
async function token(env){const body=url64(te.encode(JSON.stringify({v:1,exp:Date.now()+EIGHT_HOURS})));return body+'.'+url64(await hmac(env.SESSION_SECRET+env.ADMIN_PASSWORD,body))}
async function verify(env,value){if(!value||value.length>1000)return false;const parts=value.split('.');if(parts.length!==2)return false;try{const valid=safeEqual(await hmac(env.SESSION_SECRET+env.ADMIN_PASSWORD,parts[0]),unurl64(parts[1]));if(!valid)return false;const v=JSON.parse(td.decode(unurl64(parts[0])));return v.v===1 && typeof v.exp==='number' && v.exp>Date.now() && v.exp<=Date.now()+EIGHT_HOURS}catch{return false}}
function validate(data){
 if(!data||!Array.isArray(data.categories)||data.categories.length!==3)return 'Ceník musí obsahovat tři kategorie.';
 const ids=['damske','panske','detske'];
 for(let i=0;i<ids.length;i++){
  const c=data.categories[i];if(!c||c.id!==ids[i]||typeof c.name!=='string'||c.name.length>40||!Array.isArray(c.services)||c.services.length>200)return 'Nesprávná kategorie.';
  const names=new Set(), serviceIds=new Set();
  for(const s of c.services){
   if(!s||typeof s.id!=='string'||!/^[\w-]{1,90}$/.test(s.id)||serviceIds.has(s.id))return 'Duplicitní nebo neplatné ID služby.';
   serviceIds.add(s.id);
   for(const [k,n] of [['name',120],['shortHair',60],['mediumHair',60],['longHair',60]])if(typeof s[k]!=='string'||s[k].length>n)return 'Neplatné údaje služby.';
   const key=s.name.trim().toLocaleLowerCase('cs');if(!key||names.has(key))return 'Prázdný nebo duplicitní název služby.';names.add(key);
  }
 }
 return null;
}
function ghUrl(env){return `https://api.github.com/repos/${encodeURIComponent(env.GH_OWNER)}/${encodeURIComponent(env.GH_REPO)}/contents/${filePath}`}
function ghHeaders(env){return {'Authorization':`Bearer ${env.GITHUB_TOKEN}`,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'PaulaDocceWorker','Content-Type':'application/json'}}
async function getFile(env){
 const resp=await fetch(ghUrl(env)+'?ref='+encodeURIComponent(env.GH_BRANCH),{headers:ghHeaders(env),cache:'no-store'});
 if(!resp.ok)throw Error(`GitHub GET HTTP ${resp.status}: ověřte token, repozitář a větev.`);
 const data=await resp.json();if(!data.sha||!data.content)throw Error('GitHub nevrátil data/pricing.json.');
 return {sha:data.sha,data:JSON.parse(td.decode(decode(data.content)))};
}
async function putFile(env,data,sha){
 const body={message:'Aktualizace ceníku Paula Docce z administrace',content:encode(te.encode(JSON.stringify(data,null,2)+'\n')),sha,branch:env.GH_BRANCH};
 const resp=await fetch(ghUrl(env),{method:'PUT',headers:ghHeaders(env),body:JSON.stringify(body)});
 if([409,422].includes(resp.status))return {conflict:true};
 if(!resp.ok)throw Error(`GitHub PUT HTTP ${resp.status}: ověřte oprávnění Contents: Read and write a ochranu větve.`);
 const result=await resp.json();return {sha:result?.content?.sha};
}
// Basic per-isolate protection only, not a substitute for a Cloudflare rate limiting rule.
const attempts=new Map();
function rateLimit(ip){const t=Date.now(),item=attempts.get(ip);if(attempts.size>2000)attempts.clear();if(!item||t-item.start>900000){attempts.set(ip,{start:t,count:1});return false}item.count++;return item.count>12}
export default {
 async fetch(request,env){
  const origin=request.headers.get('Origin');
  const allowed=(env.ALLOWED_ORIGIN||'').split(',').map(s=>s.trim());
  const cors=origin&&allowed.includes(origin)?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'Content-Type,Authorization','Access-Control-Allow-Methods':'GET,POST,PUT,OPTIONS','Access-Control-Max-Age':'600','Vary':'Origin'}:{};
  const respond=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...cors}});
  if(!origin||!allowed.includes(origin))return respond({error:'Přístup z této domény není povolen.'},403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  const path=new URL(request.url).pathname.replace(/\/+$/,'');
  if(!['/login','/session','/pricing'].includes(path))return respond({error:'Neznámá cesta.'},404);
  for(const key of ['ADMIN_EMAIL','ADMIN_PASSWORD','SESSION_SECRET','GITHUB_TOKEN','GH_OWNER','GH_REPO','GH_BRANCH','ALLOWED_ORIGIN'])if(!env[key])return respond({error:'Cloudflare Worker ještě není kompletně nastaven.'},503);
  try {
   if(path==='/login'&&request.method==='POST'){
    const ip=request.headers.get('CF-Connecting-IP')||'unknown';
    const body=await request.json();const email=String(body?.email||'').trim().toLowerCase(), password=String(body?.password||'');
    if(email.length>254||password.length>1024)return respond({error:'Neplatné přihlašovací údaje.'},401);
    const matchEmail=safeEqual(await hash(email),await hash(env.ADMIN_EMAIL.trim().toLowerCase()));
    const matchPassword=safeEqual(await hash(password),await hash(env.ADMIN_PASSWORD));
    if(!matchEmail||!matchPassword){if(rateLimit(ip))return respond({error:'Příliš mnoho pokusů. Zkuste to později.'},429);return respond({error:'Neplatný e-mail nebo heslo.'},401)}
    attempts.delete(ip);return respond({token:await token(env),expiresInSeconds:EIGHT_HOURS/1000});
   }
   const bearer=(request.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
   if(!await verify(env,bearer))return respond({error:'Přihlaste se prosím znovu.'},401);
   if(path==='/session'&&request.method==='GET')return respond({ok:true});
   if(path==='/pricing'&&request.method==='GET')return respond(await getFile(env));
   if(path==='/pricing'&&request.method==='PUT'){
    if(Number(request.headers.get('Content-Length')||0)>MAX_BODY)return respond({error:'Příliš velký ceník.'},413);
    const raw=await request.text();if(te.encode(raw).length>MAX_BODY)return respond({error:'Příliš velký ceník.'},413);
    const body=JSON.parse(raw);
    if(typeof body?.sha!=='string'||!/^[a-f0-9]{40}$/.test(body.sha))return respond({error:'Chybí platná verze ceníku.'},400);
    const err=validate(body.data);if(err)return respond({error:err},400);
    const current=await getFile(env);if(current.sha!==body.sha)return respond({error:'Ceník byl mezitím změněn. Obnovte stránku.'},409);
    const output=await putFile(env,body.data,body.sha);if(output.conflict)return respond({error:'Konflikt při ukládání.'},409);
    return respond({ok:true,sha:output.sha});
   }
   return respond({error:'Nepodporovaná metoda.'},405);
  }catch(err){if(err instanceof SyntaxError)return respond({error:'Neplatný formát JSON.'},400);
   console.error('API error',err);return respond({error:'Operace se nezdařila. '+(String(err.message).startsWith('GitHub')?err.message:'Zkontrolujte nastavení Workeru.')},502)}
 }
};
