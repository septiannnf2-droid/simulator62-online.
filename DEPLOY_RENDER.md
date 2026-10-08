# Cara Meng-online-kan SIMULATOR +62 GRATIS

Panduan untuk pemula, tanpa harus memahami kode.

## Langkah 1 — Buat database autosave gratis (Upstash)

1. Buka <https://console.upstash.com/> dan buat akun.
2. Buat **Redis database** pada **Free plan**. Pilih region terdekat yang tersedia.
3. Buka halaman database lalu cari **REST URL** dan **REST TOKEN**. **Simpan pribadi**, jangan pernah dipublikasikan/diunggah ke GitHub atau dikirim ke obrolan publik.
4. Kedua nilai itu akan dimasukkan langsung di Render pada langkah 3.

> Paket Upstash gratis memiliki batas kuota. Tidak perlu memasukkan detail kartu bank untuk paket Free sesuai ketentuan Upstash yang berlaku; cek kembali saat mendaftar.

## Langkah 2 — Unggah kode ke GitHub

1. Buka <https://github.com/new>, masuk akun GitHub.
2. Nama repository misalnya `simulator62-online`; pilih **Private** bila hanya untuk proyek pribadi (Render perlu diberi akses ke repo privat).
3. Klik **Create repository**, lalu **uploading an existing file** atau **Add file → Upload files**.
4. **Ekstrak ZIP** yang diberikan. Unggah **isi folder** `SIMULATOR_62_Render_Ready`, termasuk `server.js`, `storage.js`, `engine.js`, `data.js`, `public/`, `render.yaml`, dan `package.json`.
5. Pastikan `render.yaml` muncul di **root repository**, bukan di dalam folder tambahan. Klik **Commit changes**.
6. Jangan mengunggah `.env` asli atau token Upstash.

Jika ingin lewat Git di komputer:

```bash
git init
git add .
git commit -m "SIMULATOR +62 Render-ready multiplayer autosave"
git branch -M main
git remote add origin https://github.com/USERNAME/simulator62-online.git
git push -u origin main
```

## Langkah 3 — Deploy Web Service Free di Render

1. Buka <https://dashboard.render.com/>, masuk akun.
2. Pilih **New → Blueprint** (paling mudah karena telah tersedia `render.yaml`). Hubungkan GitHub bila diminta.
3. Pilih repository `simulator62-online`.
4. Blueprint menyiapkan service Node.js dengan `plan: free`, `npm install --omit=dev`, `npm start`, dan health check `/health`.
5. Render akan meminta environment variable yang ditandai `sync: false`. Masukkan:
   - `UPSTASH_REDIS_REST_URL` = REST URL dari Upstash.
   - `UPSTASH_REDIS_REST_TOKEN` = REST TOKEN dari Upstash.
6. Pastikan instance menggunakan **Free**, lalu klik **Apply / Deploy**.
7. Jika berhasil, Render memberi alamat seperti `https://simulator62-online.onrender.com` (**hanya contoh, bukan domain yang sudah aktif**).
8. Buka alamat HTTPS tersebut. Buka juga `/health` dan pastikan `persistence` bernilai `ready`.

### Alternatif jika tidak memakai Blueprint

Pilih **New → Web Service**, hubungkan repository, lalu isi:

- Runtime: `Node`
- Build Command: `npm install --omit=dev`
- Start Command: `npm start`
- Instance Type: **Free**
- Health Check Path: `/health`
- Environment: `NODE_ENV=production` dan dua variabel Upstash di atas

Tidak perlu database Render Postgres; data room ada di Upstash.

## Langkah 4 — Uji mabar tiga HP

1. Pemain A buka URL, masukkan nama, **Buat Room**.
2. Klik **Salin Link Undangan**, kirim ke dua teman.
3. Pemain B dan C buka URL yang sama, masukkan nama, lalu gabung memakai kode room.
4. Semua klik **Saya Siap**, host klik **Mulai Permainan**.
5. Jalankan dadu dan kartu. Uji beli tanah, pembayaran sewa, lelang.
6. Tutup semua tab lalu refresh atau restart service melalui Render. Buka URL pada **browser perangkat yang sama**: pemain otomatis mencoba gabung kembali menggunakan token tersimpan.
7. Pastikan saldo dan posisi pemain sama seperti sebelum restart.

## Hal yang wajib diketahui

- Render Free bisa tidur setelah **15 menit** tanpa request HTTP atau pesan WebSocket. Saat diakses lagi, perlu waktu untuk bangun.
- Browser mengirim heartbeat ketika masih aktif supaya permainan yang sedang dimainkan tidak dianggap idle.
- Data yang ditulis di filesystem Render **tidak permanen**. Karena itu **jangan** menghapus environment variable Upstash.
- Room hilang setelah **2 jam seluruh pemain offline** (kebijakan pada game ini); bukan untuk penyimpanan pertandingan berbulan-bulan.
- Kode reconnect disimpan di browser yang dipakai saat bermain. Menghapus site data atau mengganti perangkat bisa menghilangkan akses ke kursi sebelumnya.
- Jika ingin mengubah nama game/URL, perubahan subdomain bergantung pada ketersediaan nama di Render.
- Paket hosting gratis memiliki batasan dan dapat berubah sewaktu-waktu.

## Jika terjadi error

| Gejala | Penyebab umum | Solusi |
|---|---|---|
| Render: service gagal start | UPSTASH... kosong/salah | Periksa Environment di Render |
| `/health` tidak tersedia sementara | Render Free tidur | Buka ulang situs beberapa saat kemudian |
| `persistence` bukan `ready` | Upstash tidak terkoneksi | Periksa URL/token dan status Redis |
| Room tidak ditemukan setelah lama offline | Melebihi batas 2 jam | Buat room baru |
| Pemain tidak bisa gabung | Room sudah dimulai/penuh | Gunakan room baru atau reconnect dengan browser yang sama |
| Setelah restart browser gagal reconnect | Token lokal terhapus atau Redis tidak tersedia | Cek status browser dan Upstash |

## Sumber dokumentasi resmi

- Render Free: <https://render.com/docs/free>
- Render Blueprint: <https://render.com/docs/infrastructure-as-code>
- Render WebSocket: <https://render.com/docs/websocket>
- Upstash Redis REST: <https://upstash.com/docs/redis/features/restapi>
- Upstash Free: <https://upstash.com/pricing/redis>
