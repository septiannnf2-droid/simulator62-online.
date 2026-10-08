'use strict';
// SIMULATOR +62 durable room storage via Upstash Redis REST.
// Secrets and reconnect tokens never leave the server or get served to the browser.
const PREFIX='s62:room:v1:';
const ROOM_TTL_SECONDS=24*60*60;
const STALE_MS=2*60*60*1000;
class RoomStorage {
  constructor(opts={}){
    this.url=opts.url??process.env.UPSTASH_REDIS_REST_URL??'';
    this.token=opts.token??process.env.UPSTASH_REDIS_REST_TOKEN??'';
    this.fetcher=opts.fetcher??globalThis.fetch;
    if (!!this.url!==!!this.token)throw Error('Lengkapi kedua variabel UPSTASH_REDIS_REST_URL dan UPSTASH_REDIS_REST_TOKEN.');
    this.enabled=!!this.url;
    if(this.enabled&&!/^https:\/\//i.test(this.url)&&!(process.env.NODE_ENV==='test'&&/^http:\/\/127\.0\.0\.1:\d+$/.test(this.url)))throw Error('UPSTASH_REDIS_REST_URL wajib HTTPS.');
    this.status=this.enabled?'connecting':'memory-only';
  }
  async command(parts){
    if(!this.enabled)throw Error('Redis belum dikonfigurasi');
    const response=await this.fetcher(this.url.replace(/\/$/,''),{
      method:'POST',headers:{'Authorization':`Bearer ${this.token}`,'Content-Type':'application/json'},
      body:JSON.stringify(parts),signal:AbortSignal.timeout(9000)
    });
    if(!response.ok)throw Error(`Redis HTTP ${response.status}`);
    const data=await response.json();
    if(data.error)throw Error(`Redis: ${String(data.error).slice(0,150)}`);
    this.status='ready';
    return data.result;
  }
  pack(room){
    return {schema:1,code:room.code,hostId:room.hostId,createdAt:room.createdAt,updatedAt:room.updatedAt,
      seats:room.seats.map(s=>({id:s.id,token:s.token,name:s.name,avatar:s.avatar,ready:s.ready})),
      game:room.game?.g??null};
  }
  async save(room){
    if(!this.enabled)return;
    await this.command(['SET',PREFIX+room.code,JSON.stringify(this.pack(room)),'EX',ROOM_TTL_SECONDS]);
  }
  async remove(code){if(this.enabled)await this.command(['DEL',PREFIX+code]);}
  async load(){
    if(!this.enabled)return [];
    const keys=[];let cursor='0',pages=0;
    do{
      const result=await this.command(['SCAN',cursor,'MATCH',PREFIX+'*','COUNT','200']);
      if(!Array.isArray(result)||result.length!==2)throw Error('Respon SCAN Redis tidak valid');
      cursor=String(result[0]);keys.push(...result[1]);
      if(++pages>25||keys.length>1000)throw Error('Jumlah room melampaui batas restorasi');
    }while(cursor!=='0');
    const rooms=[];const time=Date.now();
    for(const key of keys){
      const raw=await this.command(['GET',key]);if(!raw)continue;
      try{
        const row=JSON.parse(raw);
        if(row.schema!==1||!/^[-A-Z0-9]{6}$/.test(row.code)||key!==PREFIX+row.code||!Array.isArray(row.seats)||row.seats.length<1||row.seats.length>5||!Number.isFinite(row.updatedAt)||time-row.updatedAt>STALE_MS){
          await this.command(['DEL',key]);continue;
        }
        if(row.game&&(!Array.isArray(row.game.players)||row.game.players.length<3||row.game.players.length>5||!row.game.properties||!row.game.decks)){
          console.error('[RESTORE] Struktur permainan tidak sesuai:',row.code);continue;
        }
        rooms.push(row);
      }catch(e){console.error('[RESTORE] Gagal membaca room',key,e.message);}
    }
    return rooms;
  }
}
module.exports={RoomStorage,PREFIX,STALE_MS};
