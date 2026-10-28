export function number(value){const n=Number(value);return Number.isFinite(n)?Math.max(0,n):0;}
export function percent(value){return Math.min(100,number(value));}
function cents(value){return Math.round(number(value)*100);}
export function calculateQuote(input){
 const rows=(Array.isArray(input.items)?input.items:[]).map(item=>({id:String(item.id??''),amount:Math.round(cents(item.rate)*number(item.qty)),cost:Math.round(cents(item.cost)*number(item.qty))}));
 const subtotal=rows.reduce((sum,row)=>sum+row.amount,0);
 const cost=rows.reduce((sum,row)=>sum+row.cost,0);
 const discount=Math.round(subtotal*percent(input.discount)/100);
 const net=subtotal-discount;
 const tax=Math.round(net*percent(input.tax)/100);
 const total=net+tax;
 const deposit=Math.round(total*percent(input.deposit)/100);
 return{rows,subtotal,cost,discount,net,tax,total,deposit,balance:total-deposit,margin:net?Math.round((net-cost)/net*1000)/10:0};
}
