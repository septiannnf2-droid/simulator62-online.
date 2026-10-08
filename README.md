# SIMULATOR +62 — Multiplayer Online, Siap Deploy ke Render

**Versi:** Milestone B.1 (hosting gratis + autosave).

Game board multiplayer 3–5 pemain berbasis Node.js dan WebSocket. Semua pemain mulai setara: Rp8.000.000, tanpa profesi/skill khusus, dan bisa mengubah nama serta memilih pion di lobby. Peta Bekasi × Jakarta, 32 petak, 16 wilayah, 60 kartu, ekonomi dinamis.

## Langsung deploy

Baca **[DEPLOY_RENDER.md](DEPLOY_RENDER.md)** untuk langkah unggah GitHub → buat Upstash Free → Render Blueprint Free. Jangan upload file ZIP mentah sebagai source repo; **ekstrak ZIP dan unggah isinya**.

> Paket ini **belum online** sampai kamu memasukkan kredensial layanan gratis dan menjalankan proses deploy. Kami tidak menyertakan token, akun, atau URL publik palsu.

## Auto-save: cara kerjanya

- Room disimpan ke **Upstash Redis** sesudah setiap perubahan: nama, ready, memulai game, roll, transaksi, kartu, lelang, giliran, dan perubahan pada timer AFK.
- Yang disimpan: state mesin game sepenuhnya, kode room, posisi dan saldo seluruh pemain, pemilik properti, tumpukan kartu yang belum keluar, indeks ekonomi, urutan giliran, serta token reconnect.
- Saat server restart/spin-down, aplikasi memuat room dari Upstash **sebelum membuka port**. Pemain dapat menyambung kembali dari browser yang sama dengan token yang sudah tersimpan di localStorage. Timer giliran dimulai ulang pada koneksi pertama setelah pemulihan; tidak dipotong selama downtime.
- Room yang semua pemainnya offline lebih dari **2 jam** dibersihkan. Rekor cadangan Redis memiliki TTL maksimal **24 jam**, tetapi housekeeping menghapus room tidak aktif setelah 2 jam. Room aktif disimpan berkala.
- Token reconnect **tidak pernah ditampilkan melalui API publik**. Hanya server yang mengakses kredensial Redis melalui environment variable.
- Penyimpanan dibuat *berurutan* sehingga aksi tidak dipublikasikan ke klien sampai perintah simpan berhasil. Jika Upstash gagal saat server mulai, proses tidak meluncurkan game kosong secara diam-diam.

**Peringatan:** Ini versi beta. Tetap ada risiko gangguan jaringan, habisnya kuota gratis, atau layanan penyimpanan pihak ketiga. Disarankan bermain percobaan sebelum pertandingan penting. Belum ada login dan tidak disiapkan untuk jutaan pemain.

## Jalankan lokal

- Instal Node.js 22+.
- Buka terminal dalam folder ini dan jalankan `npm start`, atau klik `JALANKAN_WINDOWS.bat` di Windows.
- Akses `http://localhost:3000`.
- Tanpa `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`, permainan lokal **berjalan tanpa autosave permanen**.
- Untuk mengetes autosave lokal dengan Redis milikmu, set kedua environment variable tersebut dulu.

Tidak ada dependensi npm tambahan. Tautan invite menggunakan host yang sedang dibuka, sehingga setelah deploy semua orang menggunakan domain `.onrender.com` yang sama.

## Cek status

Buka `https://DOMAIN-GAME.onrender.com/health` sesudah deploy.

Contoh balasan saat sehat:

```json
{"ok":true,"rooms":0,"restoredRooms":0,"persistence":"ready","version":"milestone-b-render"}
```

Pastikan `persistence` = `ready`. Jika `memory-only`, data akan hilang saat server restart, dan konfigurasi produksi seharusnya menolak startup.

## Tes

```bash
npm test
```

Termasuk pengujian integrasi WebSocket, 60 pertandingan otomatis, serialisasi Redis, dan uji penghentian + start ulang server ketika satu room aktif. Mock Upstash berjalan lokal, tanpa memakai token/saldo cloud sungguhan.

## Isi proyek

```
server.js         WebSocket, lobby, timer, sambung ulang, pemulihan setelah restart
storage.js        Auto-save via Upstash REST (server-only)
engine.js         Aturan game, validasi saldo dan giliran
render.yaml       Infrastruktur Render Blueprint plan free
package.json      npm start / npm test
public/           Tampilan desktop dan HP
DEPLOY_RENDER.md  Panduan lengkap dalam bahasa Indonesia
tests/            Uji engine, WebSocket, dan persistence
```

**Belum termasuk**: model Three.js 3D yang dapat diputar, database pengguna/login, transaksi uang asli, URL domain kustom, atau server publik yang telah dibuat di akunmu.
