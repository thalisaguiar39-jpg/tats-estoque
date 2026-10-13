import {initializeApp} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {getAuth,signInWithEmailAndPassword,onAuthStateChanged,signOut} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {getFirestore,collection,doc,onSnapshot,addDoc,updateDoc,deleteDoc,writeBatch,increment} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {firebaseConfig} from "./firebase-config.js";
import {SEED} from "./seed.js";
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const brl=n=>(+n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const num=n=>(+n||0).toLocaleString('pt-BR',{maximumFractionDigits:3});
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmt=d=>d?d.split('-').reverse().join('/'):'—';
const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app);
const CATS=['Insumo','Embalagem','Etiqueta'];
let items=[],compras=[],cat='Todos',unsubs=[];
$('#nCat').innerHTML=CATS.map(c=>`<option>${c}</option>`).join('');
$('#cData').valueAsDate=new Date();
const login=()=>signInWithEmailAndPassword(auth,$('#em').value,$('#pw').value).catch(()=>$('#err').textContent='E-mail ou senha incorretos.');
$('#go').onclick=login;
$('#pw').addEventListener('keydown',e=>{if(e.key==='Enter')login()});
$('#out').onclick=()=>signOut(auth);
onAuthStateChanged(auth,u=>{
  $('#login').hidden=!!u;$('#app').hidden=!u;unsubs.forEach(f=>f());unsubs=[];
  if(u){
    unsubs.push(onSnapshot(collection(db,'items'),s=>{items=s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.ordem||0)-(b.ordem||0));render()}));
    unsubs.push(onSnapshot(collection(db,'compras'),s=>{compras=s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.criado||0)-(a.criado||0));render()}));
  }
});
$$('nav button').forEach(b=>b.onclick=()=>{$$('nav button').forEach(x=>x.classList.toggle('on',x===b));['estoque','compras','config'].forEach(t=>$('#'+t).hidden=t!==b.dataset.tab)});
const pct=i=>i.meta>0?Math.min(100,(i.atual||0)/i.meta*100):null;
const low=i=>i.min>0&&(i.atual||0)<=i.min;
const view=()=>items.filter(i=>(cat==='Todos'||i.cat===cat)&&i.nome.toLowerCase().includes($('#q').value.toLowerCase()));
function render(){
  $('#chips').innerHTML=['Todos',...CATS].map(c=>`<button data-cat="${c}" class="${c===cat?'on':''}">${c}</button>`).join('');
  const L=items.filter(low);
  $('#alert').innerHTML=L.length?`<div class="warn"><b>⚠ ${L.length} item(ns) no estoque mínimo — hora de comprar:</b> ${L.map(i=>esc(i.nome)).join(', ')}</div>`:'';
  let v=view();
  if($('#sort').value==='pct')v=[...v].sort((a,b)=>(low(b)-low(a))||((pct(a)??101)-(pct(b)??101)));
  $('#grid').innerHTML=items.length?v.map(card).join(''):'<p>Nenhum item ainda. Vá em <b>Configurações</b> e clique em "Carregar lista inicial".</p>';
  const sel=$('#cItem').value;
  $('#cItem').innerHTML=items.map(i=>`<option value="${i.id}">${esc(i.nome)}</option>`).join('');$('#cItem').value=sel;
  $('#clist').innerHTML=tabela();
  $('#seedBox').innerHTML=items.length?'':'<br><button data-act="seed">Carregar lista inicial (insumos + embalagens + etiquetas)</button>';
  if(!document.activeElement.closest('#cfg'))$('#cfg').innerHTML=view().map(cfgRow).join('');
}
function card(i){
  const p=pct(i),st=p===null?'none':low(i)?'low':p<40?'mid':'ok';
  const pend=compras.filter(c=>c.itemId===i.id&&c.status==='pedido');
  return `<div class="card ${st}" data-id="${i.id}"><div class="top"><b>${esc(i.nome)}</b><span class="tag">${i.cat}</span></div>
  <div class="bar"><i style="width:${p||0}%"></i>${p!==null&&i.min>0?`<u style="left:${Math.min(100,i.min/i.meta*100)}%"></u>`:''}</div>
  <div class="meta"><span>${p===null?'defina o estoque ideal':Math.round(p)+'% restante'}</span><span>mín: ${num(i.min)} ${esc(i.un)}</span></div>
  <div class="edit"><input type="number" step="any" min="0" value="${i.atual||0}" data-f="atual"> <span>${esc(i.un)} em estoque</span></div>
  ${low(i)?'<div class="pend bad">⚠ Estoque mínimo atingido</div>':''}
  ${pend.map(c=>`<div class="pend">📦 Pedido: ${num(c.qtd)} ${esc(i.un)} · chega ${fmt(c.prev)}</div>`).join('')}</div>`;
}
function cfgRow(i){
  const f=(k,l,t='number')=>`<label>${l}<input type="${t}" step="any" data-f="${k}" value="${esc(i[k]??'')}"></label>`;
  return `<div class="row" data-id="${i.id}"><div class="rn"><input data-f="nome" value="${esc(i.nome)}"><select data-f="cat">${CATS.map(c=>`<option${c===i.cat?' selected':''}>${c}</option>`).join('')}</select></div>
  ${f('un','Unidade','text')}${f('meta','Estoque ideal')}${f('min','Mínimo')}${f('alvo','Preço alvo/un')}${f('qp','Qtd. pacote')}${f('pp','Preço pacote')}
  <div class="acts"><button data-act="up">▲</button><button data-act="down">▼</button><button class="del" data-act="del">✕</button></div></div>`;
}
function tabela(){
  if(!compras.length)return '<p>Nenhuma compra registrada.</p>';
  return `<table><tr><th>Data</th><th>Item</th><th>Qtd.</th><th>Total</th><th>Por un.</th><th>Previsão</th><th>Fornecedor</th><th>Status</th><th></th></tr>`+compras.map(c=>{
    const it=items.find(i=>i.id===c.itemId),cmp=it?.alvo>0?(c.unit<=it.alvo?'good':'bad'):'';
    return `<tr data-id="${c.id}"><td>${fmt(c.data)}</td><td>${esc(c.nome)}</td><td>${num(c.qtd)} ${esc(c.un)}</td><td>${brl(c.total)}</td><td class="${cmp}">${brl(c.unit)}</td><td>${fmt(c.prev)}</td><td>${esc(c.forn)}</td>
    <td><span class="st ${c.status==='recebido'?'ok':''}">${c.status==='recebido'?'Recebido':'A caminho'}</span></td>
    <td>${c.status==='pedido'?'<button data-act="recv">Recebi</button> ':''}<button class="ghost" style="color:#b3402f;border-color:#e8b9af" data-act="delc">✕</button></td></tr>`}).join('')+'</table>';
}
$('#q').oninput=$('#sort').onchange=render;
const calc=()=>$('#cUnit').value=+$('#cQtd').value>0?brl($('#cTot').value/$('#cQtd').value):'';
$('#cQtd').oninput=$('#cTot').oninput=calc;
$('#cAdd').onclick=async()=>{
  const it=items.find(i=>i.id===$('#cItem').value),qtd=+$('#cQtd').value,total=+$('#cTot').value;
  if(!it||qtd<=0)return alert('Escolha o item e informe a quantidade.');
  await addDoc(collection(db,'compras'),{itemId:it.id,nome:it.nome,un:it.un,data:$('#cData').value,qtd,total,unit:total/qtd,prev:$('#cPrev').value,forn:$('#cForn').value,status:'pedido',criado:Date.now()});
  ['cQtd','cTot','cUnit','cPrev','cForn'].forEach(k=>$('#'+k).value='');
};
$('#nAdd').onclick=async()=>{
  if(!$('#nNome').value.trim())return alert('Informe o nome.');
  await addDoc(collection(db,'items'),{nome:$('#nNome').value.trim(),cat:$('#nCat').value,un:$('#nUn').value||'un',meta:+$('#nMeta').value||0,min:+$('#nMin').value||0,atual:0,alvo:0,qp:1,pp:0,ordem:Math.max(0,...items.map(i=>i.ordem||0))+10});
  ['nNome','nUn','nMeta','nMin'].forEach(k=>$('#'+k).value='');
};
document.addEventListener('change',e=>{
  const f=e.target.dataset.f,id=e.target.closest('[data-id]')?.dataset.id;if(!f||!id)return;
  updateDoc(doc(db,'items',id),{[f]:e.target.type==='number'?+e.target.value||0:e.target.value});
});
document.addEventListener('click',async e=>{
  const cb=e.target.dataset.cat;if(cb){cat=cb;return render()}
  const act=e.target.dataset.act;if(!act)return;
  const id=e.target.closest('[data-id]')?.dataset.id;
  if(act==='seed'){const b=writeBatch(db);SEED.forEach((s,n)=>b.set(doc(collection(db,'items')),{...s,ordem:n*10,atual:0,min:0,meta:0,alvo:0}));await b.commit()}
  if(act==='del'&&confirm('Excluir este item?'))await deleteDoc(doc(db,'items',id));
  if(act==='delc'&&confirm('Excluir esta compra?'))await deleteDoc(doc(db,'compras',id));
  if(act==='up'||act==='down'){
    const v=view(),n=v.findIndex(i=>i.id===id),m=act==='up'?n-1:n+1;if(m<0||m>=v.length)return;
    const b=writeBatch(db),A=v[n],B=v[m];let oa=A.ordem||0,ob=B.ordem||0;if(oa===ob)ob+=act==='up'?-1:1;
    b.update(doc(db,'items',A.id),{ordem:ob});b.update(doc(db,'items',B.id),{ordem:oa});await b.commit();
  }
  if(act==='recv'){
    const c=compras.find(x=>x.id===id);if(!confirm(`Somar ${num(c.qtd)} ${c.un} de "${c.nome}" ao estoque?`))return;
    const b=writeBatch(db);b.update(doc(db,'compras',id),{status:'recebido'});b.update(doc(db,'items',c.itemId),{atual:increment(c.qtd)});await b.commit();
  }
});
