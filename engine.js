'use strict';
const {randomInt}=require('node:crypto');
const {tiles,lands,eventList,T,M,K}=require('./data');
const COLORS=['#FFD166','#FF7998','#3DD5A0','#69A8FF','#B58AFF'];
const FACES=['🧑','🧕','😎','👩','🧔'];
const roundk=n=>Math.round(n/1000)*1000;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const fmt=n=>'Rp'+Math.round(n).toLocaleString('id-ID');
function shuffle(list){const a=[...list];for(let i=a.length-1;i>0;i--){let j=randomInt(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
function assert(test,msg){if(!test)throw new Error(msg);}
class GameSession {
 static restore(state){
  if(!state || !Array.isArray(state.players) || !state.properties || !state.decks || !Array.isArray(state.eventDeck))throw Error('Game save tidak valid');
  const game=Object.create(GameSession.prototype);
  game.g=structuredClone(state);
  return game;
 }
 constructor(seats,roundLimit=15){
  assert(seats.length>=3&&seats.length<=5,'Jumlah pemain harus 3–5');
  const players=shuffle(seats).map(p=>({id:p.id,name:p.name,color:COLORS[p.avatar],face:FACES[p.avatar],cash:8000000,rep:3,stress:0,pos:0,arrears:[],loan:null,shield:0,dispute:false,jailed:false,comebackUsed:false,comebackEligible:-1,lastBansos:-10,online:p.online}));
  this.g={round:1,roundLimit,current:0,phase:'manage',players,properties:{},market:{Bekasi:1,Jakarta:1},activeEvent:null,eventDeck:shuffle(Array.from({length:12},(_,i)=>i)),decks:{T:shuffle(Array.from({length:20},(_,i)=>i)),M:shuffle(Array.from({length:20},(_,i)=>i)),K:shuffle(Array.from({length:20},(_,i)=>i))},logs:[],dice:[1,1],selected:1,pending:null,snapshot:[],prevMedian:0,cardSeen:null,rankings:[],lastRoll:null};
  for(const t of tiles.filter(t=>t.type==='land'))this.g.properties[t.index]={...t,owner:null,level:0,building:null,upgradeSpent:0,protectedUntil:0,marketBonus:0};
  this.log('Semua pemain mulai setara: Rp8 juta, tanpa kemampuan khusus.');this.startRound();this.beginTurn();
 }
 get current(){return this.g.players[this.g.current];}
 get properties(){return Object.values(this.g.properties);}
 getProperty(index){return this.g.properties[index];}
 owns(p){return this.properties.filter(x=>x.owner===p.id);}
 marketValue(x){return roundk(x.price*(this.g.market[x.area]+x.marketBonus));}
 assetValue(x){return this.marketValue(x)+roundk(x.upgradeSpent*.8);}
 debtSum(p){return (p.loan?p.loan.principal+p.loan.interest:0)+p.arrears.reduce((s,x)=>s+x.amount,0);}
 score(p){return p.cash+this.owns(p).reduce((s,x)=>s+this.assetValue(x),0)-this.debtSum(p)+p.rep*100000;}
 medianScore(){const a=this.g.players.map(p=>this.score(p)).sort((a,b)=>a-b);return a.length%2?a[Math.floor(a.length/2)]:(a[a.length/2-1]+a[a.length/2])/2;}
 log(msg){this.g.logs.unshift({text:msg,round:this.g.round});this.g.logs.length=Math.min(this.g.logs.length,45);}
 event(){let e=this.g.activeEvent;return e&&this.g.round<=e.start+1?e:null;}
 rent(x){const e=this.event(),p=this.g.players.find(p=>p.id===x.owner),complete=p&&this.owns(p).filter(z=>z.zone===x.zone).length===4;let f=1+(complete?.10:0);if(e?.area===x.area&&e.rent)f*=1+e.rent;return Math.max(0,Math.min(1800000,roundk(x.price*[.06,.12,.20,.30][x.level]*f)));}
 upgradeCost(x){const e=this.event();return roundk(x.price*[0,.25,.35,.50][x.level+1]*(1+(e?.upgrade||0)));}
 addIncome(p,amount,reason){let money=roundk(amount),limit=roundk(Math.floor(money*.5)),deducted=0;for(const a of p.arrears){if(limit<=0)break;let n=Math.min(limit,a.amount);a.amount-=n;limit-=n;deducted+=n;const c=this.g.players.find(v=>v.id===a.creditor);if(c)c.cash+=n;}p.arrears=p.arrears.filter(a=>a.amount>0);p.cash+=money-deducted;this.log(`${p.name} menerima ${fmt(money)} (${reason})${deducted?', potong tunggakan '+fmt(deducted):''}`);}
 pay(p,amount,creditor,reason){amount=roundk(amount);if(!Number.isFinite(amount)||amount<=0)return;const paid=Math.min(p.cash,amount);p.cash-=paid;const c=this.g.players.find(v=>v.id===creditor);if(c&&paid)this.addIncome(c,paid,`sewa dari ${p.name}`);let gap=amount-paid;if(gap){p.arrears.push({creditor:creditor||null,amount:gap,reason,round:this.g.round});p.stress=clamp(p.stress+1,0,5);this.log(`${p.name} menunggak ${fmt(gap)} (${reason})`);if(!p.comebackUsed){p.comebackEligible=this.g.round+2;p.comebackUsed=true;}}this.log(`${p.name} membayar ${fmt(paid)} (${reason})`);}
 adjust(p,key,n){p[key]=clamp(p[key]+n,0,5);}
 debtReduce(p,amount){let left=amount;for(const a of p.arrears){let n=Math.min(a.amount,left);a.amount-=n;left-=n;}p.arrears=p.arrears.filter(a=>a.amount>0);if(left&&p.loan){let n=Math.min(left,p.loan.interest);p.loan.interest-=n;left-=n;let m=Math.min(left,p.loan.principal);p.loan.principal-=m;left-=m;if(p.loan.principal<=0&&p.loan.interest<=0)p.loan=null;}if(left===amount)this.addIncome(p,100000,'bonus tanpa utang');else this.log(`${p.name} mendapat pengurangan utang ${fmt(amount-left)}`);}
 incomeRound(){const by={};for(const x of this.g.snapshot){let percent=x.level===2?.02:x.level===3?.03:0;if(!percent)continue;let e=this.event(),factor=1;if(e?.income&&(!e.incomeKind||e.incomeKind===x.building))factor+=e.income;by[x.owner]=(by[x.owner]||0)+roundk(x.price*percent*factor);}for(const [id,n] of Object.entries(by)){let p=this.g.players.find(p=>p.id===id);if(p)this.addIncome(p,n,'pendapatan properti akhir ronde');}}
 startRound(){this.g.snapshot=this.properties.filter(x=>x.owner&&x.level>=2).map(x=>({...x}));if([4,7,10,13].includes(this.g.round)){let id=this.g.eventDeck.pop();if(id===undefined){this.g.eventDeck=shuffle(Array.from({length:eventList.length},(_,i)=>i));id=this.g.eventDeck.pop();}const e=eventList[id];this.g.activeEvent={...e,start:this.g.round};if(e.index){const before=this.g.market[e.area];this.g.market[e.area]=clamp(Math.round((before+e.index)*100)/100,.8,1.25);const diff=before-this.g.market[e.area];if(diff>0){for(const x of this.properties){if(x.owner&&x.area===e.area&&x.protectedUntil>=this.g.round){x.marketBonus+=diff;x.protectedUntil=0;this.log(`Proteksi pasar melindungi ${x.name}`);}}}}if(e.allGrant)this.g.players.forEach(p=>this.addIncome(p,e.allGrant,'berita ekonomi'));this.log('📺 BERITA FIKSI: '+e.name);}this.log(`Ronde ${this.g.round} dimulai`);}
 beginTurn(){const p=this.current;this.g.phase='manage';this.g.pending=null;if(p.loan&&this.g.round>=p.loan.due){const n=p.loan.principal+p.loan.interest;p.loan=null;this.pay(p,n,null,'pinjaman jatuh tempo');}if(p.comebackEligible===this.g.round){this.addIncome(p,200000,'kontrak pemulihan sekali');p.comebackEligible=-1;}this.log(`Giliran ${p.name}`);}
 finalize(){this.g.current++;if(this.g.current>=this.g.players.length){this.incomeRound();this.g.prevMedian=this.medianScore();if(this.g.round>=this.g.roundLimit){this.g.phase='finished';this.g.rankings=[...this.g.players].sort((a,b)=>this.score(b)-this.score(a)||b.cash-a.cash||this.owns(b).length-this.owns(a).length||b.rep-a.rep).map(p=>({id:p.id,name:p.name,score:this.score(p),cash:p.cash,assetCount:this.owns(p).length,debt:this.debtSum(p)}));this.log(`Permainan selesai! Juara: ${this.g.rankings[0].name}`);return;}this.g.round++;this.g.current=0;this.startRound();}this.beginTurn();}
 deck(type){let d=this.g.decks[type];if(!d.length)d.push(...shuffle(Array.from({length:20},(_,i)=>i)));return d.pop();}
 applyTakdir(i){const p=this.current,owned=this.owns(p),built=owned.filter(x=>x.level>=2),area=a=>owned.some(x=>x.area===a);switch(i){case 0:this.addIncome(p,200000,'bonus kerja');break;case 1:this.addIncome(p,150000,'cashback');break;case 2:this.addIncome(p,300000,'proyek sampingan');break;case 3:this.addIncome(p,200000,'deposit');this.adjust(p,'stress',-1);break;case 4:this.addIncome(p,250000,'pelanggan baru');break;case 5:this.adjust(p,'rep',1);break;case 6:this.addIncome(p,350000,'bonus kontrak');break;case 7:this.addIncome(p,this.score(p)<this.medianScore()?400000:150000,'dukungan komunitas');break;case 8:this.addIncome(p,Math.min(450000,150000*built.length),'usaha berkembang');break;case 9:this.addIncome(p,area('Bekasi')?200000:100000,'kabar Bekasi');break;case 10:this.addIncome(p,area('Jakarta')?200000:100000,'kabar Jakarta');break;case 11:this.addIncome(p,300000,'reimburse');break;case 12:this.addIncome(p,built.some(x=>x.building==='ruko')?250000:100000,'ramai pembeli');break;case 13:this.adjust(p,'stress',-2);break;case 14:this.adjust(p,'rep',1);this.addIncome(p,100000,'relasi');break;case 15:this.addIncome(p,owned.length?300000:100000,'modal kembali');break;case 16:this.addIncome(p,250000,'bonus akhir pekan');break;case 17:this.addIncome(p,Math.min(400000,100000*owned.length),'dividen');break;case 18:this.debtReduce(p,200000);break;case 19:this.addIncome(p,500000,'proyek padat');this.adjust(p,'stress',1);break;}}
 applyMusibah(i){const p=this.current;if(i===16){p.dispute=true;this.log(`${p.name} terkena sengketa`);return;}let cost=M[i][2];if(i===4&&this.owns(p).some(x=>x.level>=2))cost+=100000;if(i===11)cost=Math.min(400000,100000*this.owns(p).length);if(p.shield){cost-=Math.min(cost,400000);p.shield=0;this.log('Pelindung Musibah digunakan');}this.pay(p,cost,null,M[i][0]);if([3,17,19].includes(i))this.adjust(p,'stress',1);if(i===9)this.adjust(p,'stress',2);if(i===8)this.adjust(p,'rep',-1);}
 chance(i,opt){const p=this.current,x=K[i];if(opt==='A'){if(x[1]>0)this.addIncome(p,x[1],x[0]+' (aman)');this.log(`${p.name} memilih opsi aman`);return;}if(x[2]!=null){const won=randomInt(10000)<Math.round(x[2]*10000),n=won?x[3]:x[4];if(n>=0)this.addIncome(p,n,x[0]);else this.pay(p,-n,null,x[0]);this.log(`Peluang ${x[0]}: ${won?'berhasil':'gagal'}`);return;}switch(i){case 5:if(p.shield)this.addIncome(p,200000,'bonus proteksi');else p.shield=1;break;case 6:this.pay(p,150000,null,'donasi');this.adjust(p,'rep',2);break;case 7:this.adjust(p,'stress',-2);this.adjust(p,'rep',1);break;case 10:this.pay(p,100000,null,'pemulihan');this.adjust(p,'stress',-2);break;case 16:this.debtReduce(p,250000);break;case 17:this.pay(p,100000,null,'mediasi');this.adjust(p,'rep',2);p.dispute=false;break;}}
 getCard(type){const i=this.deck(type),x=(type==='T'?T:type==='M'?M:K)[i];this.g.cardSeen={type,id:type+String(i+1).padStart(2,'0'),title:x[0],description:x[1]||''};this.g.phase='resolve';if(type==='T')this.applyTakdir(i);if(type==='M')this.applyMusibah(i);this.g.pending=type==='K'?{type:'card',index:i}:{type:'reveal',title:x[0],description:x[1]||'Efek kartu telah diterapkan.'};}
 startAuction(index){const x=this.getProperty(index);assert(x&&!x.owner,'Tanah tidak tersedia untuk dilelang');this.g.phase='resolve';this.g.pending={type:'auction',index,bid:roundk(x.price*.8)-50000,leader:null,bids:0};this.log(`Lelang ${x.name} dibuka`);}
 resolveTile(i){const t=tiles[i],p=this.current;this.g.selected=i;this.g.phase='resolve';if(t.type==='land'){const x=this.getProperty(i);if(!x.owner)this.g.pending={type:'purchase',index:i};else if(x.owner===p.id)this.g.pending={type:'reveal',title:'Tanah Sendiri',description:`${x.name} milikmu, tidak ada sewa.`};else{const n=this.rent(x);this.pay(p,n,x.owner,'sewa '+x.name);this.g.pending={type:'reveal',title:'Bayar Sewa',description:`Mendarat di ${x.name}. Biaya sewa ${fmt(n)}.`};}return;}
 if([2,18].includes(i))return this.getCard('T');if([10,26].includes(i))return this.getCard('M');if(i===30)return this.getCard('K');
 if(i===4){const n=clamp(roundk(p.cash*.05),100000,500000);this.pay(p,n,null,'pajak');this.g.pending={type:'reveal',title:'Pajak',description:`Pembayaran ${fmt(n)} diproses.`};}
 else if(i===6||i===14){let n=i===6?200000:100000;this.pay(p,n,null,i===6?'tilang':'tol');this.g.pending={type:'reveal',title:i===6?'Tilang':'Tol',description:`Biaya ${fmt(n)} diproses.`};}
 else if(i===8)this.g.pending={type:'reveal',title:'Lapas',description:'Kunjungan biasa. Tidak ada hukuman.'};
 else if(i===12)this.g.pending={type:'reveal',title:'Berita Nasional',description:this.event()?.desc||'Belum ada berita ekonomi aktif.'};
 else if(i===16)this.g.pending=p.dispute?{type:'court'}:{type:'reveal',title:'Pengadilan',description:'Tidak ada sengketa. Aman.'};
 else if(i===20){const free=this.properties.filter(x=>!x.owner);if(free.length)this.startAuction(free[randomInt(free.length)].index);else this.g.pending={type:'reveal',title:'Lelang',description:'Semua tanah sudah terjual.'};}
 else if(i===22)this.g.pending={type:'pungli'};
 else if(i===24)this.g.pending={type:'bursa'};
 else if(i===28){const ok=this.g.round>=4&&this.score(p)<this.g.prevMedian*.7&&this.g.round-p.lastBansos>=5;if(ok){this.addIncome(p,500000,'bansos bersyarat');p.lastBansos=this.g.round;}this.g.pending={type:'reveal',title:'Bansos',description:ok?'Syarat terpenuhi: +Rp500.000.':'Belum memenuhi syarat bansos.'};}
 else this.g.pending={type:'reveal',title:'START',description:'Gaji diberikan saat menyelesaikan lintasan.'};}
 closeAuction(){assert(this.g.phase==='resolve'&&this.g.pending?.type==='auction','Tidak ada lelang');const a=this.g.pending,x=this.getProperty(a.index);if(a.leader){const winner=this.g.players.find(p=>p.id===a.leader);if(winner&&winner.cash>=a.bid){winner.cash-=a.bid;x.owner=winner.id;this.log(`${winner.name} menang lelang ${x.name}: ${fmt(a.bid)}`);}}else this.log(`Lelang ${x.name} tidak terjual`);this.finishResolve();}
 finishResolve(){this.g.pending=null;this.g.phase='end';}
 act(id,action,arg={}){
  const g=this.g,p=this.current,actor=g.players.find(x=>x.id===id);
  assert(actor,'Pemain tidak ditemukan');assert(g.phase!=='finished','Permainan selesai');
  if(action==='bid'){
    assert(g.phase==='resolve'&&g.pending?.type==='auction','Tidak ada lelang aktif');const a=g.pending;const next=a.bid+50000;assert(a.leader!==id,'Kamu sedang unggul');assert(actor.cash>=next,'Saldo tidak cukup');a.bid=next;a.leader=id;a.bids++;this.log(`${actor.name} menawar ${fmt(next)}`);return {resetAuction:true};
  }
  assert(p.id===id,'Bukan giliranmu');
  if(g.phase==='manage'){
    if(action==='advance'){g.phase='roll';return;}
    if(action==='upgrade'){let x=this.getProperty(Number(arg.index));assert(x&&x.owner===id&&x.level<3&&p.stress<4&&!p.arrears.length,'Upgrade tidak tersedia');let cost=this.upgradeCost(x);assert(p.cash>=cost,'Saldo tidak cukup');assert(x.level!==1||['kos','ruko'].includes(arg.kind),'Pilih kos atau ruko');p.cash-=cost;x.upgradeSpent+=cost;x.level++;if(x.level===2)x.building=arg.kind;this.log(`${p.name} meng-upgrade ${x.name} ke L${x.level}: ${fmt(cost)}`);g.phase='roll';return;}
    if(action==='sell'){let x=this.getProperty(Number(arg.index));assert(x&&x.owner===id&&!p.dispute,'Aset tidak dapat dijual');let cash=roundk(this.marketValue(x)*.7+x.upgradeSpent*.5);x.owner=null;x.level=0;x.building=null;x.upgradeSpent=0;x.protectedUntil=0;x.marketBonus=0;this.addIncome(p,cash,'menjual '+x.name);g.phase='roll';return;}
    if(action==='loan'){const n=Number(arg.amount),max=roundk(this.owns(p).reduce((sum,x)=>sum+this.marketValue(x),0)*.5);assert([500000,1000000,2000000,3000000].includes(n)&&!p.loan&&n<=max,'Tidak memenuhi syarat pinjaman');const rate=(p.rep>=3?.10:.15)+(this.event()?.loan||0);p.loan={principal:n,interest:roundk(n*rate),due:g.round+3};this.addIncome(p,n,'pinjaman');this.log(`Bunga pinjaman ${Math.round(rate*100)}%, jatuh tempo ronde ${p.loan.due}`);g.phase='roll';return;}
    if(action==='repay'){assert(p.arrears.length||p.loan,'Tidak ada kewajiban');let remaining=Math.min(500000,p.cash);assert(remaining>=100000,'Saldo pelunasan kurang');let initial=remaining;p.cash-=remaining;for(const a of p.arrears){let n=Math.min(remaining,a.amount);a.amount-=n;remaining-=n;const c=g.players.find(q=>q.id===a.creditor);if(c)c.cash+=n;}p.arrears=p.arrears.filter(a=>a.amount>0);if(remaining&&p.loan){let n=Math.min(p.loan.interest,remaining);p.loan.interest-=n;remaining-=n;let m=Math.min(p.loan.principal,remaining);p.loan.principal-=m;remaining-=m;if(p.loan.principal<=0&&p.loan.interest<=0)p.loan=null;}p.cash+=remaining;this.log(`${p.name} melunasi kewajiban ${fmt(initial-remaining)}`);g.phase='roll';return;}
    if(action==='relax'){assert(p.cash>=200000,'Saldo tidak cukup');p.cash-=200000;this.adjust(p,'stress',-2);this.log(`${p.name} beristirahat, stres turun`);g.phase='roll';return;}
    if(action==='settle'){assert(p.dispute&&p.cash>=200000,'Tidak dapat menyelesaikan sengketa');p.cash-=200000;p.dispute=false;this.log(`${p.name} menyelesaikan sengketa`);g.phase='roll';return;}
    throw Error('Aksi manajemen tidak dikenal');
  }
  if(g.phase==='roll'){
    if(p.jailed){if(action==='jail-pay'){this.pay(p,300000,null,'jaminan lapas');p.jailed=false;return;}if(action==='jail-wait'){p.jailed=false;g.phase='end';this.log(`${p.name} menunggu satu giliran keluar lapas`);return;}throw Error('Selesaikan status lapas dahulu');}
    assert(action==='roll','Saatnya lempar dadu');const a=randomInt(1,7),b=randomInt(1,7),count=a+b;const old=p.pos;p.pos=(old+count)%32;g.dice=[a,b];g.lastRoll={playerId:id,from:old,to:p.pos,dice:[a,b],at:Date.now()};this.log(`${p.name} melempar ${a} + ${b} = ${count}`);if(old+count>=32)this.addIncome(p,1800000,'gaji START');if(a===b)this.addIncome(p,100000,'bonus dadu kembar');this.resolveTile(p.pos);return;}
  if(g.phase==='resolve'){
    const q=g.pending;assert(q,'Tidak ada kejadian');
    if(q.type==='purchase'){const x=this.getProperty(q.index);if(action==='buy'){assert(p.cash>=x.price&&!x.owner,'Tanah tidak tersedia atau uang kurang');p.cash-=x.price;x.owner=id;this.log(`${p.name} membeli ${x.name} senilai ${fmt(x.price)}`);this.finishResolve();return;}if(action==='auction'){this.startAuction(q.index);return {startAuction:true};}}
    if(q.type==='auction')throw Error('Tunggu hasil lelang');
    if(q.type==='card'&&action==='choose'){assert(['A','B'].includes(arg.choice),'Pilihan kartu salah');this.chance(q.index,arg.choice);this.finishResolve();return;}
    if(q.type==='reveal'&&action==='continue'){this.finishResolve();return;}
    if(q.type==='court'&&action==='court-pay'){this.pay(p,200000,null,'mediasi pengadilan');p.dispute=false;this.finishResolve();return;}
    if(q.type==='court'&&action==='court-risk'){const won=randomInt(2)===0;if(!won)this.pay(p,400000,null,'putusan pengadilan');p.dispute=false;this.log(won?'Pengadilan: dibebaskan':'Pengadilan: denda Rp400.000');this.finishResolve();return;}
    if(q.type==='pungli'&&action==='pungli-report'){this.adjust(p,'stress',1);this.log(`${p.name} melaporkan pungutan tidak resmi`);this.finishResolve();return;}
    if(q.type==='pungli'&&action==='pungli-pay'){this.pay(p,150000,null,'petak pungli fiktif');this.finishResolve();return;}
    if(q.type==='bursa'&&action==='buy-shield'){assert(!p.shield&&p.cash>=200000,'Proteksi belum tersedia');p.shield=1;p.cash-=200000;this.finishResolve();return;}
    if(q.type==='bursa'&&action==='market-shield'){assert(p.cash>=150000&&this.owns(p).some(x=>x.index===Number(arg.index)),'Tanah proteksi tidak sah');const x=this.getProperty(Number(arg.index));assert(x.protectedUntil<g.round,'Tanah sudah terlindungi');p.cash-=150000;x.protectedUntil=g.round+2;this.log(`${p.name} melindungi pasar ${x.name}`);this.finishResolve();return;}
    if(q.type==='bursa'&&action==='continue'){this.finishResolve();return;}
    throw Error('Tindakan belum sesuai kejadian');
  }
  if(g.phase==='end'){assert(action==='end','Selesaikan giliran');this.finalize();return;}
  throw Error('Aksi tidak cocok dengan fase');
 }
 snapshot(){const g=this.g;return {round:g.round,roundLimit:g.roundLimit,current:g.current,phase:g.phase,players:g.players.map(p=>({...p,score:this.score(p),assetCount:this.owns(p).length,debt:this.debtSum(p)})),properties:g.properties,market:g.market,activeEvent:this.event()?{...this.event()}:null,logs:g.logs,dice:g.dice,selected:g.selected,pending:g.pending,cardSeen:g.pending?.type==='card'?{...g.cardSeen}:null,rankings:g.rankings,lastRoll:g.lastRoll};}
}
module.exports={GameSession,tiles,lands,T,M,K,eventList,COLORS,FACES,fmt};
