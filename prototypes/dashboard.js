// Fictional sample data only. No network requests or account storage.
const sample={startingCash:10000000,cash:4450000,holdings:[
  {name:'가상 종목 A',quantity:20,average:80000,price:85000},
  {name:'가상 종목 B',quantity:5,average:300000,price:315000},
  {name:'가상 종목 C',quantity:10,average:245000,price:252000}
]};
const won=n=>n.toLocaleString('ko-KR')+'원';
const signed=n=>(n>0?'+':n<0?'−':'')+won(Math.abs(n));
const stockTotal=sample.holdings.reduce((sum,stock)=>sum+stock.quantity*stock.price,0);
const total=stockTotal+sample.cash,profit=total-sample.startingCash;
document.querySelector('#total').textContent=won(total);
document.querySelector('#stock-total').textContent=won(stockTotal);
document.querySelector('#cash').textContent=won(sample.cash);
document.querySelector('#profit').textContent=`${signed(profit)} (${profit>=0?'+':''}${(profit/sample.startingCash*100).toFixed(2)}%)`;
document.querySelector('#profit').classList.toggle('loss',profit<0);
document.querySelector('#holdings').innerHTML=sample.holdings.map(stock=>{
 const value=stock.quantity*stock.price,cost=stock.quantity*stock.average,change=value-cost;
 return `<article class="holding"><div><h3>${stock.name}</h3><p>${stock.quantity}주 보유</p></div><div class="holding-value"><strong class="private">${won(value)}</strong><p class="gain private ${change<0?'loss':''}">${signed(change)} (${change>=0?'+':''}${(change/cost*100).toFixed(2)}%)</p></div><details><summary>매수 가격과 예시 가격 보기</summary><p class="private">평균 매수 가격 ${won(stock.average)} · 예시 주가 ${won(stock.price)}</p><p>위 손익은 아직 팔지 않은 주식의 평가손익입니다.</p></details></article>`;
}).join('');
let hidden=false;
const amounts=[...document.querySelectorAll('.private')].map(element=>({element,text:element.textContent}));
document.querySelector('#visibility').addEventListener('click',event=>{
 hidden=!hidden;amounts.forEach(({element,text})=>{element.textContent=hidden?'금액 숨김':text;});
 event.currentTarget.textContent=hidden?'금액 보기':'금액 숨기기';event.currentTarget.setAttribute('aria-pressed',String(hidden));
});
