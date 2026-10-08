'use strict';
// SIMULATOR +62 Milestone B. Dependency-free HTTP + RFC6455 WebSocket server.
// All dice, cards, currency and turn validation are decided server-side.
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {GameSession,tiles,COLORS,FACES,T,M,K,eventList}=require('./engine');
const {RoomStorage,STALE_MS}=require('./storage');
const PORT=Number(process.env.PORT)||3000;
const HOST=process.env.HOST||'0.0.0.0';
const ROOT=path.join(__dirname,'public');
const MAX_MSG=24_576;
const rooms=new Map();
const storage=new RoomStorage();
let restoredCount=0;
let mutationQueue=Promise.resolve();
function enqueue(fn){const p=mutationQueue.then(fn);mutationQueue=p.catch(e=>console.error('[QUEUE]',e.message));return p;}
const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const safeName=s=>typeof s==='string'?s.trim().replace(/\s+/g,' '):'';
const validName=s=>s.length>=3&&s.length<=20&&/^[\p{L}\p{N} _.-]+$/u.test(s);
const now=()=>Date.now();
function code(){for(let attempt=0;attempt<80;attempt++){const c=Array.from({length:6},()=>alphabet[crypto.randomInt(alphabet.length)]).join('');if(!rooms.has(c))return c;}throw Error('Room penuh, coba lagi');}
function send(ws,obj){if(ws?.destroyed)return;try{const data=Buffer.from(JSON.stringify(obj));let prefix;if(data.length<126){prefix=Buffer.from([0x81,data.length]);}else if(data.length<65536){prefix=Buffer.alloc(4);prefix[0]=0x81;prefix[1]=126;prefix.writeUInt16BE(data.length,2);}else{prefix=Buffer.alloc(10);prefix[0]=0x81;prefix[1]=127;prefix.writeBigUInt64BE(BigInt(data.length),2);}ws.write(Buffer.concat([prefix,data]));}catch{}}
function onClose(ws,fn){ws._closed=false;function once(){if(ws._closed)return;ws._closed=true;fn();}ws.on('close',once);ws.on('error',once);}
function parseSocket(ws,onMessage){let pending=Buffer.alloc(0);ws.on('data',chunk=>{pending=Buffer.concat([pending,chunk]);if(pending.length>MAX_MSG+2048){ws.destroy();return;}while(pending.length>=2){const b0=pending[0],b1=pending[1],opcode=b0&15,final=!!(b0&128),masked=!!(b1&128);let length=b1&127,offset=2;if(length===126){if(pending.length<4)break;length=pending.readUInt16BE(2);offset=4;}else if(length===127){if(pending.length<10)break;const big=pending.readBigUInt64BE(2);if(big>BigInt(MAX_MSG)){ws.destroy();return;}length=Number(big);offset=10;}if(length>MAX_MSG||!masked||!final){ws.destroy();return;}if(pending.length<offset+4+length)break;const mask=pending.subarray(offset,offset+4),body=Buffer.from(pending.subarray(offset+4,offset+4+length));for(let i=0;i<body.length;i++)body[i]^=mask[i%4];pending=pending.subarray(offset+4+length);if(opcode===8){ws.end();return;}if(opcode===9){ws.write(Buffer.from([0x8a,body.length,...body]));continue;}if(opcode!==1){ws.destroy();return;}try{onMessage(JSON.parse(body.toString('utf8')));}catch(e){send(ws,{type:'error',message:e?.message||'Pesan tidak valid'});}}});}
function scrubRoom(room){return {code:room.code,persistence:storage.status,started:!!room.game,hostId:room.hostId,createdAt:room.createdAt,deadline:room.deadline,seats:[...room.seats].map(s=>({id:s.id,name:s.name,avatar:s.avatar,ready:s.ready,online:!!s.ws&&!s.ws.destroyed})),game:room.game?.snapshot()||null};}
async function broadcast(room,session=null){room.updatedAt=now();await storage.save(room);if(session)send(session.ws,{type:'session',roomCode:room.code,token:session.seat.token,youId:session.seat.id});const data=scrubRoom(room);for(const seat of room.seats){if(seat.ws)send(seat.ws,{type:'state',youId:seat.id,room:data});}}
async function attach(ws,room,seat){if(seat.ws&&seat.ws!==ws){send(seat.ws,{type:'kicked',message:'Sesi ini dilanjutkan di perangkat lain'});seat.ws.end();}seat.ws=ws;ws.room=room;ws.seat=seat;room.updatedAt=now();if(!room.deadline&&room.game)resetDeadline(room);await broadcast(room,{ws,seat});}
async function createRoom(ws,data){if(ws.room)throw Error('Sudah berada di room');if(rooms.size>=200)throw Error('Server demo sedang penuh');const name=safeName(data.name);if(!validName(name))throw Error('Nama harus 3–20 karakter (huruf, angka, spasi, titik, -, _)');const avatar=Number(data.avatar);if(!Number.isInteger(avatar)||avatar<0||avatar>4)throw Error('Pion tidak tersedia');const c=code();const seat={id:crypto.randomUUID(),token:crypto.randomBytes(32).toString('hex'),name,avatar,ready:false,ws};const room={code:c,hostId:seat.id,seats:[seat],game:null,createdAt:now(),updatedAt:now(),deadline:0};rooms.set(c,room);await attach(ws,room,seat);}
async function joinRoom(ws,data){if(ws.room)throw Error('Sudah berada di room');const c=String(data.code||'').trim().toUpperCase();const room=rooms.get(c);if(!room)throw Error('Kode room tidak ditemukan');if(room.game)throw Error('Pertandingan sudah dimulai, gunakan fitur sambung ulang');if(room.seats.length>=5)throw Error('Room sudah berisi 5 pemain');const name=safeName(data.name);if(!validName(name))throw Error('Nama harus 3–20 karakter');if(room.seats.some(x=>x.name.toLocaleLowerCase('id-ID')===name.toLocaleLowerCase('id-ID')))throw Error('Nama sudah digunakan di room');const avatar=Number(data.avatar);if(!Number.isInteger(avatar)||avatar<0||avatar>4)throw Error('Pion tidak tersedia');const seat={id:crypto.randomUUID(),token:crypto.randomBytes(32).toString('hex'),name,avatar,ready:false,ws};room.seats.push(seat);await attach(ws,room,seat);}
async function resume(ws,data){if(ws.room)throw Error('Sudah terhubung');const room=rooms.get(String(data.code||'').toUpperCase());if(!room)throw Error('Room sudah tidak aktif (server baru dinyalakan ulang?)');const seat=room.seats.find(s=>s.token===data.token&&typeof data.token==='string');if(!seat)throw Error('Token sambung ulang tidak sesuai');await attach(ws,room,seat);}
function resetDeadline(room,auctionBump=false){if(!room.game||room.game.g.phase==='finished'){room.deadline=0;return;}const g=room.game.g,p=g.pending;let span=60000;if(g.phase==='manage')span=75000;if(g.phase==='roll')span=60000;if(g.phase==='end')span=30000;if(g.phase==='resolve')span=p?.type==='auction'?(auctionBump?10000:20000):p?.type==='card'?45000:40000;room.deadline=now()+span;}
async function doAction(ws,data){const room=ws.room,seat=ws.seat;if(!room||!seat)throw Error('Kamu belum bergabung');if(data.type==='leave'){
   if(room.game)throw Error('Tidak bisa keluar dari pertandingan aktif. Tutup tab untuk sementara.');room.seats=room.seats.filter(x=>x!==seat);ws.room=null;ws.seat=null;seat.ws=null;if(room.hostId===seat.id)room.hostId=room.seats[0]?.id||null;if(room.seats.length)await broadcast(room);else {rooms.delete(room.code);await storage.remove(room.code);}send(ws,{type:'left'});return;
  }
  if(data.type==='lobby'){
   if(room.game)throw Error('Nama dibekukan setelah permainan dimulai');if(data.action==='rename'){const name=safeName(data.name);if(!validName(name))throw Error('Nama harus 3–20 karakter');if(room.seats.some(s=>s!==seat&&s.name.toLocaleLowerCase('id-ID')===name.toLocaleLowerCase('id-ID')))throw Error('Nama sudah dipakai');seat.name=name;seat.ready=false;}
   else if(data.action==='avatar'){const n=Number(data.avatar);if(!Number.isInteger(n)||n<0||n>4)throw Error('Pion tidak tersedia');seat.avatar=n;seat.ready=false;}
   else if(data.action==='ready')seat.ready=!!data.ready;
   else if(data.action==='start'){if(room.hostId!==seat.id)throw Error('Hanya host yang boleh memulai');if(room.seats.length<3||room.seats.length>5||room.seats.some(s=>!s.ready||!s.ws))throw Error('Perlu 3–5 pemain online dengan status Siap');room.game=new GameSession(room.seats.map(s=>({id:s.id,name:s.name,avatar:s.avatar,online:true})));resetDeadline(room);}
   else throw Error('Aksi lobby tidak dikenal');await broadcast(room);return;
  }
  if(data.type==='action'){
   if(!room.game)throw Error('Permainan belum dimulai');const old=room.game.g.pending?.type;const outcome=room.game.act(seat.id,String(data.action||''),data.args||{});const current=room.game.g.pending?.type;
   // Server owns the auction clock. A bid cannot make timer run forever.
   if(data.action==='bid'&&old==='auction'&&current==='auction')room.deadline=Math.min(Math.max(room.deadline,now()+8000),now()+25000);
   else resetDeadline(room);
   await broadcast(room);return;
  }
  throw Error('Jenis pesan tidak dikenal');
}
function defaultAction(game){const g=game.g,p=g.pending;switch(g.phase){case 'manage':return ['advance',{}];case 'roll':return [game.current.jailed?'jail-wait':'roll',{}];case 'end':return ['end',{}];case 'resolve':if(p?.type==='purchase')return ['auction',{}];if(p?.type==='card')return ['choose',{choice:'A'}];if(p?.type==='reveal'||p?.type==='bursa')return ['continue',{}];if(p?.type==='court')return ['court-pay',{}];if(p?.type==='pungli')return ['pungli-report',{}];}return null;}
const server=http.createServer((req,res)=>{
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
 let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);res.end();return;}
 if(pathname==='/health'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ok:true,rooms:rooms.size,restoredRooms:restoredCount,persistence:storage.status,version:'milestone-b-render'}));return;}
 const file=pathname==='/'?'index.html':pathname.slice(1);if(file.includes('..')||file.includes('\\')||file.startsWith('.')){res.writeHead(403);res.end();return;}const full=path.join(ROOT,file);if(!full.startsWith(ROOT+path.sep)){res.writeHead(403);res.end();return;}
 fs.readFile(full,(err,bytes)=>{if(err){res.writeHead(404);res.end('Tidak ditemukan');return;}const ext=path.extname(full);res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml'}[ext]||'application/octet-stream'));res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.writeHead(200);if(req.method==='HEAD')res.end();else res.end(bytes);});
});
server.on('upgrade',(req,socket,head)=>{
 const key=req.headers['sec-websocket-key'],upgrade=String(req.headers.upgrade||'').toLowerCase();if(req.url!=='/ws'||upgrade!=='websocket'||typeof key!=='string'||key.length>128){socket.destroy();return;}
 // Reject malicious cross-origin browser connections, allow same-origin requests.
 const origin=req.headers.origin;if(origin){try{const host=req.headers.host;const o=new URL(origin);if(o.host!==host||!['http:','https:'].includes(o.protocol)){socket.destroy();return;}}catch{socket.destroy();return;}}
 const accept=crypto.createHash('sha1').update(key+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+accept+'\r\n\r\n');socket.setNoDelay(true);
 parseSocket(socket,msg=>{if(msg?.type==='heartbeat')return;return enqueue(async()=>{try{if(!msg||typeof msg!=='object'||Array.isArray(msg))throw Error('Format pesan tidak benar');if(msg.type==='create')await createRoom(socket,msg);else if(msg.type==='join')await joinRoom(socket,msg);else if(msg.type==='resume')await resume(socket,msg);else await doAction(socket,msg);}catch(e){console.error('[ACTION]',e.message);send(socket,{type:'error',message:e.message||'Aksi ditolak'});}});});
 onClose(socket,()=>{enqueue(async()=>{const room=socket.room,seat=socket.seat;if(!room||!seat||seat.ws!==socket)return;seat.ws=null;if(!room.game&&room.hostId===seat.id){const successor=room.seats.find(s=>s.ws);if(successor)room.hostId=successor.id;}await broadcast(room);});});
 if(head?.length)socket.emit('data',head);
});
let checking=false;
setInterval(()=>{
 if(checking)return;checking=true;
 enqueue(async()=>{
  const time=now();
  for(const [code,room] of rooms){
   if(time-room.updatedAt>STALE_MS&&!room.seats.some(s=>s.ws)){
    await storage.remove(code);rooms.delete(code);continue;
   }
   if(room.seats.some(s=>s.ws)&&time-room.updatedAt>5*60*1000)await broadcast(room);
   if(!room.game||!room.deadline||room.deadline>time||!room.seats.some(s=>s.ws))continue;
   try{
    const g=room.game,action=defaultAction(g);
    if(g.g.pending?.type==='auction'){g.closeAuction();resetDeadline(room);}
    else if(action){g.act(g.current.id,action[0],action[1]);resetDeadline(room);}
    else resetDeadline(room);
    await broadcast(room);
   }catch(e){console.error('Timeout error:',e.message);resetDeadline(room);}
  }
 }).finally(()=>{checking=false;});
},1000).unref();
async function bootstrap(){
 if(process.env.NODE_ENV==='production'&&!storage.enabled)throw Error('Auto-save production memerlukan UPSTASH_REDIS_REST_URL dan UPSTASH_REDIS_REST_TOKEN');
 const saved=await storage.load();
 for(const item of saved){
   const seats=item.seats.map(s=>({id:s.id,token:s.token,name:s.name,avatar:s.avatar,ready:!!s.ready,ws:null}));
   const game=item.game?GameSession.restore(item.game):null;
   rooms.set(item.code,{code:item.code,hostId:item.hostId,seats,game,createdAt:item.createdAt,updatedAt:item.updatedAt,deadline:0});
 }
 restoredCount=saved.length;
 console.log(`[RESTORE] ${restoredCount} room dipulihkan (${storage.status})`);
}
if(require.main===module){
 bootstrap().then(()=>server.listen(PORT,HOST,()=>console.log(`SIMULATOR +62 online: http://${HOST}:${PORT}`))).catch(e=>{
   console.error('[FATAL] Gagal memulihkan penyimpanan. Server tidak diluncurkan untuk melindungi progres:',e.message);
   process.exitCode=1;
 });
}
module.exports={server,rooms,resetDeadline,bootstrap,storage};
