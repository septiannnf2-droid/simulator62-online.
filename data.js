'use strict';
// Game data adapted from the original Milestone A design; all content original and fictional.
const lands=[
['Bantargebang','Bekasi','Ekonomis',800000],['Mustikajaya','Bekasi','Ekonomis',1000000],['Cakung','Jakarta','Ekonomis',1100000],['Cililitan','Jakarta','Ekonomis',1200000],
['Bekasi Timur','Bekasi','Berkembang',1500000],['Rawalumbu','Bekasi','Berkembang',1700000],['Pondok Gede','Bekasi','Berkembang',1800000],['Duren Sawit','Jakarta','Berkembang',2000000],
['Bekasi Barat','Bekasi','Strategis',2300000],['Medan Satria','Bekasi','Strategis',2500000],['Tebet','Jakarta','Strategis',2800000],['Kelapa Gading','Jakarta','Strategis',3000000],
['Bekasi Selatan','Bekasi','Premium',3500000],['Kemang','Jakarta','Premium',4000000],['Kuningan','Jakarta','Premium',4500000],['Menteng','Jakarta','Premium',5000000]
];
const zoneColors={Ekonomis:'#67e8a8',Berkembang:'#73b8ff',Strategis:'#c29afb',Premium:'#ffd477'};
const specials={0:['START','🚩','#bf8222'],2:['TAKDIR','✨','#6942af'],4:['PAJAK','🧾','#c25742'],6:['TILANG','🚔','#af4351'],8:['LAPAS','🔒','#495b77'],10:['MUSIBAH','💀','#a83548'],12:['BERITA','📺','#a27825'],14:['TOL','🚧','#b26a3f'],16:['PENGADILAN','⚖️','#526779'],18:['TAKDIR','✨','#6942af'],20:['LELANG','🔨','#935d2e'],22:['PUNGLI','💸','#9d4836'],24:['BURSA','📈','#246d82'],26:['MUSIBAH','💀','#a83548'],28:['BANSOS','🧺','#2e7d67'],30:['KESEMPATAN','🎯','#7953b7']};
const tiles=Array.from({length:32},(_,i)=>{if(i%2===1){let l=lands[(i-1)/2];return {index:i,type:'land',name:l[0],area:l[1],zone:l[2],price:l[3],icon:'🏡'};}const z=specials[i];return {index:i,type:'special',name:z[0],icon:z[1],color:z[2]};});
const eventList=[
{id:'E01',name:'Kawasan Bekasi Semakin Diminati',desc:'Indeks tanah Bekasi +8% permanen, sewa Bekasi +10% selama dua ronde.',area:'Bekasi',index:0.08,rent:0.10},
{id:'E02',name:'Perkantoran Jakarta Menggeliat',desc:'Indeks Jakarta +6% permanen, sewa Jakarta +10% dua ronde.',area:'Jakarta',index:0.06,rent:0.10},
{id:'E03',name:'Akses Transportasi Membaik',desc:'Indeks Bekasi +5% permanen, penghasilan kos +10% dua ronde.',area:'Bekasi',index:0.05,incomeKind:'kos',income:0.10},
{id:'E04',name:'Musim Liburan Kota',desc:'Sewa Jakarta +12% selama dua ronde.',area:'Jakarta',rent:0.12},
{id:'E05',name:'Aktivitas Ruko Ramai',desc:'Penghasilan ruko +20% selama dua ronde.',incomeKind:'ruko',income:0.20},
{id:'E06',name:'Bonus Akhir Tahun',desc:'Seluruh pemain menerima Rp250.000 sekali.',allGrant:250000},
{id:'E07',name:'Harga Material Naik',desc:'Biaya upgrade +20% selama dua ronde.',upgrade:0.20},
{id:'E08',name:'Penjualan Ritel Melemah',desc:'Penghasilan ruko −20% selama dua ronde.',incomeKind:'ruko',income:-0.20},
{id:'E09',name:'Koreksi Pasar Jakarta',desc:'Indeks Jakarta −10% permanen, sewa Jakarta −10% dua ronde.',area:'Jakarta',index:-0.10,rent:-0.10},
{id:'E10',name:'Koreksi Pasar Bekasi',desc:'Indeks Bekasi −10% permanen, sewa Bekasi −10% dua ronde.',area:'Bekasi',index:-0.10,rent:-0.10},
{id:'E11',name:'Biaya Operasional Membengkak',desc:'Penghasilan kos dan ruko turun 15% selama dua ronde.',income:-0.15},
{id:'E12',name:'Kredit Lebih Ketat',desc:'Bunga pinjaman baru +5 poin persentase selama dua ronde.',loan:0.05}
];
const T=[
['Bonus Kerja','Terima Rp200.000 dari bank.'],['Cashback Belanja','Terima Rp150.000.'],['Proyek Sampingan','Terima Rp300.000.'],['Pengembalian Deposit','Terima Rp200.000 dan stres turun 1.'],['Pelanggan Baru','Terima Rp250.000.'],['Pujian Warga','Reputasi bertambah 1.'],['Bonus Kontrak','Terima Rp350.000.'],['Dukungan Komunitas','Terima bantuan berdasarkan posisi kekayaanmu.'],['Usaha Berkembang','Bonus untuk properti yang telah dibangun.'],['Kabar Baik dari Bekasi','Bonus bila memiliki aset di Bekasi.'],['Kabar Baik dari Jakarta','Bonus bila memiliki aset di Jakarta.'],['Reimburse Kantor','Terima Rp300.000.'],['Ramai Pembeli','Bonus bila punya ruko.'],['Istirahat Berkualitas','Stres berkurang 2.'],['Relasi Baru','Reputasi +1 dan uang +Rp100.000.'],['Modal Kembali','Bonus bagi pemilik aset.'],['Bonus Akhir Pekan','Terima Rp250.000.'],['Dividen Kecil','Bonus berdasarkan jumlah aset.'],['Bantuan Pelunasan','Utang berkurang, atau dapat uang bila tanpa utang.'],['Proyek Padat','Terima Rp500.000 tetapi stres naik 1.']
];
const M=[
['Sewa Tempat Naik','Bayar Rp200.000.',200000],['Motor Perlu Servis','Bayar Rp250.000.',250000],['Telepon Rusak','Bayar Rp300.000.',300000],['Kurang Enak Badan','Bayar Rp150.000; stres +1.',150000],['Atap Bocor','Bayar Rp250.000, tambah biaya jika punya bangunan besar.',250000],['Tagihan Listrik','Bayar Rp180.000.',180000],['Biaya Administrasi','Bayar Rp260.000.',260000],['Kontrak Gagal','Bayar Rp300.000.',300000],['Keluhan Pelanggan','Bayar Rp100.000; reputasi −1.',100000],['Tekanan Pekerjaan','Bayar Rp100.000; stres +2.',100000],['Perangkat Hilang','Bayar Rp150.000.',150000],['Perawatan Properti','Bayar berdasarkan jumlah tanah.',0],['Barang Dikembalikan','Bayar Rp250.000.',250000],['Arisan Macet','Bayar Rp300.000.',300000],['Tilang di Jalan','Bayar Rp200.000.',200000],['Tagihan Tak Terduga','Bayar Rp300.000.',300000],['Sengketa Kontrak','Status sengketa aktif sampai diselesaikan.',0],['Toko Sepi','Bayar Rp200.000 dan stres +1.',200000],['Kesalahan Pengiriman','Bayar Rp350.000.',350000],['Perbaikan Mendadak','Bayar Rp300.000 dan stres +1.',300000]
];
const K=[
['Usaha Mendadak Viral',150000,.70,500000,-300000],['Proyek Akhir Pekan',180000,.65,450000,-200000],['Tender Lingkungan',200000,.60,550000,-200000],['Bursa Barang Bekas',120000,.55,600000,-250000],['Kampanye Online',160000,.70,420000,-180000],['Pilihan Proteksi',200000,null,null,null],['Sumbangan Komunitas',0,null,null,null],['Jatah Istirahat',100000,null,null,null],['Kerja Borongan',200000,.70,400000,-220000],['Lapak Dadakan',100000,.60,480000,-230000],['Perbaikan Kesehatan',0,null,null,null],['Perdagangan Musiman',120000,.55,550000,-260000],['Kontrak Jangka Pendek',150000,.75,350000,-200000],['Pengiriman Besar',130000,.65,430000,-250000],['Promosi Kawasan',150000,.70,360000,-200000],['Penawaran Kerja Sama',200000,.60,450000,-200000],['Penasihat Keuangan',100000,null,null,null],['Mediasi Tetangga',0,null,null,null],['Shift Tambahan',200000,.80,300000,-200000],['Kontrak Konten',180000,.50,650000,-250000]
];
const DICE=['⚀','⚁','⚂','⚃','⚄','⚅'];

module.exports={lands,zoneColors,specials,tiles,eventList,T,M,K,DICE};
