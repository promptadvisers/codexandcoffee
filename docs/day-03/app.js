import { number, percent, calculateQuote } from './domain/pricing.js';
export { calculateQuote };
/* UI, persistence and export use the extracted pricing module. */
const STORAGE_KEY='codex-coffee-quote-studio-v1';
const example=()=>({id:'MOR-026',project:'A clearer customer experience',client:'Northstar Services',brief:'Understand the current customer journey and turn the findings into a practical service improvement plan.',discount:5,tax:13,deposit:30,items:[{id:'discovery',name:'Discovery & stakeholder interviews',qty:2,rate:1600,cost:900},{id:'service',name:'Service blueprint & recommendations',qty:5,rate:1250,cost:700},{id:'handover',name:'Team workshop & handover',qty:3,rate:1100,cost:650}]});
let quote=example(),saved=[],dirty=true;
function money(value){return new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD',maximumFractionDigits:2}).format(value/100);}
function escapeHtml(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function $ (id){return document.getElementById(id);}
function notify(message,error=false){$('notice').textContent=message;$('notice').style.color=error?'#9a5d26':'#235c4d';}
function valid(){return quote.project.trim()&&quote.client.trim()&&quote.items.length&&quote.items.every(i=>i.name.trim()&&number(i.qty)>0);}
function setDirty(){dirty=true;$('quote-status').textContent='Unsaved draft';notify('');}
function updateTotals(){
 const t=calculateQuote(quote);
 $('summary-client').textContent=quote.client||'Your client';$('quote-reference').textContent=quote.id;
 $('grand-total').textContent=money(t.total);$('subtotal').textContent=money(t.subtotal);$('discount-total').textContent='−'+money(t.discount);$('net-total').textContent=money(t.net);$('tax-total').textContent=money(t.tax);$('deposit-total').textContent=money(t.deposit);$('balance-total').textContent=money(t.balance);
 $('discount-label').textContent='Client discount · '+percent(quote.discount)+'%';$('tax-label').textContent='Tax · '+percent(quote.tax)+'%';$('margin-percent').textContent=t.margin.toFixed(1)+'%';$('margin-bar').style.width=Math.max(0,Math.min(100,t.margin))+'%';
 $('margin-message').textContent=t.net===0?'Add priced work to see your delivery margin.':t.margin<30?'This scope has a tight delivery margin. Review the discount or delivery costs.':'Based on professional fees less your internal delivery costs.';
 for(const r of t.rows){const target=document.querySelector('[data-total="'+CSS.escape(r.id)+'"]');if(target)target.textContent=money(r.amount);}
 $('save-quote').disabled=!valid();$('export-proposal').disabled=!valid();renderScenarios();
}
function renderLines(){
 $('quote-lines').innerHTML=quote.items.map((item,i)=>`<div class="quote-line"><input aria-label="Service ${i+1}" data-item="${escapeHtml(item.id)}" data-field="name" maxlength="120" value="${escapeHtml(item.name)}"><input aria-label="Quantity ${i+1}" data-item="${escapeHtml(item.id)}" data-field="qty" type="number" min="0" step="0.5" value="${number(item.qty)}"><input aria-label="Rate ${i+1}" data-item="${escapeHtml(item.id)}" data-field="rate" type="number" min="0" step="0.01" value="${number(item.rate)}"><span class="line-total" data-total="${escapeHtml(item.id)}"></span><button class="remove-line" aria-label="Remove service ${i+1}" data-remove="${escapeHtml(item.id)}">×</button></div>`).join('');
 $('cost-lines').innerHTML=quote.items.map((item,i)=>`<label class="cost-row"><span>${escapeHtml(item.name||'Service '+(i+1))} · cost per unit</span><input aria-label="Cost ${i+1}" data-item="${escapeHtml(item.id)}" data-field="cost" type="number" min="0" step="0.01" value="${number(item.cost)}"></label>`).join('');updateTotals();
}
function renderScenarios(){
 $('scenario-options').innerHTML=[0,5,10].map(d=>{const t=calculateQuote({...quote,discount:d});return`<article class="scenario ${percent(quote.discount)===d?'current':''}"><h3>${d===0?'Full value':d+'% concession'}</h3><p class="amount">${money(t.net)}</p><p>Professional fees · ${t.margin.toFixed(1)}% delivery margin<br>${money(t.subtotal-t.net)} given up from the scope price</p><button data-discount="${d}">Apply ${d}% discount</button></article>`}).join('');
}
function renderSaved(){
 $('saved-count').textContent=saved.length+' saved';
 $('saved-quotes').innerHTML=saved.length?saved.map(q=>`<article class="saved-quote"><div><h3>${escapeHtml(q.project)}</h3><p>${escapeHtml(q.client)} · ${escapeHtml(q.id)}</p></div><time>${escapeHtml(q.savedAt)}</time><span class="saved-total">${money(calculateQuote(q).total)}</span><div class="saved-actions"><button class="text-button" data-load="${escapeHtml(q.id)}">Open</button><button class="text-button" data-delete="${escapeHtml(q.id)}" aria-label="Delete ${escapeHtml(q.project)}">×</button></div></article>`).join(''):'<p class="empty-state">Your saved proposals will appear here. Save this draft to keep a local copy.</p>';
}
function syncFields(){for(const[key,id]of[['project','project-name'],['client','client-name'],['brief','project-brief'],['discount','discount'],['tax','tax'],['deposit','deposit']])$(id).value=quote[key];renderLines();}
function storeSaved(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(saved));return true;}catch{notify('This browser could not save the quote. Export a proposal to keep a copy.',true);return false;}}
function saveQuote(){if(!valid())return notify('Add a project, a client, and a named service with quantity greater than zero.',true);const copy={...structuredClone(quote),savedAt:new Date().toLocaleDateString('en-CA')};const next=[copy,...saved.filter(s=>s.id!==copy.id)];const previous=saved;saved=next;if(storeSaved()){dirty=false;$('quote-status').textContent='Saved in this browser';notify('Quote saved. You can reopen it below.');renderSaved();}else saved=previous;}
function exportProposal(){
 if(!valid())return;const t=calculateQuote(quote);const markup=`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(quote.project)} — proposal</title><style>body{font:16px Arial;color:#172c28;max-width:800px;margin:60px auto;padding:24px;line-height:1.6}h1{font-size:38px}table{width:100%;border-collapse:collapse;margin:30px 0}th,td{text-align:left;border-bottom:1px solid #dbe2da;padding:12px 0}td:last-child{text-align:right}.sum{text-align:right}small{color:#6b7771}</style></head><body><small>MORROW ADVISORY · FICTIONAL COURSE DEMO</small><h1>${escapeHtml(quote.project)}</h1><p>Prepared for ${escapeHtml(quote.client)}</p><p>${escapeHtml(quote.brief)}</p><table><thead><tr><th>Scope</th><th>Quantity</th><th>Amount (CAD)</th></tr></thead><tbody>${quote.items.map((i,n)=>`<tr><td>${escapeHtml(i.name)}</td><td>${number(i.qty)}</td><td>${money(t.rows[n].amount)}</td></tr>`).join('')}</tbody></table><div class="sum"><p>Scope subtotal: ${money(t.subtotal)}<br>Discount: −${money(t.discount)}<br>Professional fees: ${money(t.net)}<br>Tax: ${money(t.tax)}</p><h2>Total: ${money(t.total)}</h2><p>Upfront deposit: ${money(t.deposit)}<br>Remaining balance: ${money(t.balance)}</p></div><small>Draft proposal. No payment is collected. Tax rate and prices are sample inputs; no tax advice or contract terms are implied.</small></body></html>`;
 const url=URL.createObjectURL(new Blob([markup],{type:'text/html'}));const a=document.createElement('a');a.href=url;a.download=quote.id+'-proposal.html';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('Proposal exported. Open the HTML file in your browser, then print or save as PDF.');
}
function boot(){
 try{const data=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');saved=Array.isArray(data)?data.filter(q=>q&&typeof q.id==='string'&&Array.isArray(q.items)&&typeof q.project==='string'&&typeof q.client==='string'):[];}catch{saved=[];notify('Saved quotes could not be read. This draft is still available.',true);}
 syncFields();renderSaved();
 for(const[key,id]of[['project','project-name'],['client','client-name'],['brief','project-brief'],['discount','discount'],['tax','tax'],['deposit','deposit']])$(id).addEventListener('input',e=>{quote[key]=['discount','tax','deposit'].includes(key)?percent(e.target.value):e.target.value;setDirty();updateTotals();});
 document.addEventListener('input',e=>{const {item,field}=e.target.dataset;if(!item)return;const row=quote.items.find(i=>i.id===item);if(!row)return;row[field]=field==='name'?e.target.value:number(e.target.value);setDirty();updateTotals();});
 document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
  if(b.dataset.remove){quote.items=quote.items.filter(i=>i.id!==b.dataset.remove);setDirty();renderLines();}
  if(b.dataset.discount){quote.discount=Number(b.dataset.discount);$('discount').value=quote.discount;setDirty();updateTotals();}
  if(b.dataset.load){if(dirty&&!confirm('Replace the current draft with this saved quote?'))return;quote=structuredClone(saved.find(q=>q.id===b.dataset.load));dirty=false;syncFields();$('quote-status').textContent='Saved in this browser';notify('Saved quote opened.');}
  if(b.dataset.delete){if(!confirm('Delete this saved quote from this browser?'))return;saved=saved.filter(q=>q.id!==b.dataset.delete);storeSaved();renderSaved();}
 });
 $('add-line').addEventListener('click',()=>{quote.items.push({id:'item-'+Date.now(),name:'New service',qty:1,rate:0,cost:0});setDirty();renderLines();});
 $('new-quote').addEventListener('click',()=>{if(dirty&&!confirm('Start a new quote? Unsaved changes will be replaced.'))return;quote={...example(),id:'MOR-'+crypto.randomUUID().slice(0,6).toUpperCase(),project:'New engagement',client:'',brief:'',items:[{id:'new-service',name:'',qty:1,rate:0,cost:0}]};setDirty();syncFields();notify('Add a client and service to begin.');});
 $('save-quote').addEventListener('click',saveQuote);$('export-proposal').addEventListener('click',exportProposal);
 $('reset-demo').addEventListener('click',()=>{if(dirty&&!confirm('Reset the draft to the original example? Saved proposals will stay.'))return;quote=example();setDirty();syncFields();notify('Example restored. Saved quotes have not been removed.');});
 $('scenario-toggle').addEventListener('click',()=>{const hidden=!$('scenarios').hidden;$('scenarios').hidden=hidden;$('scenario-toggle').setAttribute('aria-expanded',String(!hidden));if(!hidden)$('scenarios').scrollIntoView({behavior:'smooth',block:'center'});});
 $('close-scenarios').addEventListener('click',()=>{$('scenarios').hidden=true;$('scenario-toggle').setAttribute('aria-expanded','false');});
}
if(typeof document!=='undefined')boot();
