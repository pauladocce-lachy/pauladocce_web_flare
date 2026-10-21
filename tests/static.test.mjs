import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const pricing=JSON.parse(read('data/pricing.json'));
assert.deepEqual(pricing.categories.map(x=>x.id),['damske','panske','detske']);
for(const name of ['index.html','cenik.html','admin/index.html','admin/dashboard.html','admin/pricing.html']){
 const html=read(name);
 for(const [,src] of html.matchAll(/<(?:script|link|img)\b[^>]*?(?:src|href)="([^"]+)"/g)){
  if(/^https?:\/\//.test(src)||src.startsWith('//')||src.startsWith('#'))continue;
  assert.ok(fs.existsSync(path.join(root,path.dirname(name),src)),`${name} references missing ${src}`);
 }
 assert.ok(!/supabase|feedback\.html|připomínky/i.test(html));
}
for(const name of ['admin/feedback.html','admin/js/feedback.js','admin/js/feedbackSupabase.js','admin/js/supabase.js','js/supabase.js'])
 assert.ok(!fs.existsSync(path.join(root,name)),`Outdated file remains ${name}`);
assert.ok(read('js/pricing.js').includes('PaulaPricing.load()'));
assert.ok(read('admin/js/pricing.js').includes('paulaAPI.savePricing'));
console.log('PASS static: all local assets resolve, JSON categories, no Supabase or feedback pages, public and admin use new APIs.');
