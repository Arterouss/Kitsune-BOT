# 🦊 Kitsune Bot

> **Private WhatsApp Multi-Device Bot**  
> **Author & Creator:** [Arterouss](https://github.com/Arterouss)  
> **Status:** 🔒 *Private / Closed-Source Project* (Bukan untuk redistribusi publik)

---

## 📌 Ringkasan Proyek

**Kitsune Bot** adalah bot WhatsApp multifitur modern yang dirancang khusus untuk penggunaan privat dan komunitas tertutup. Dibangun menggunakan arsitektur modular berbasis **Node.js (ESM)** dan protokol resmi Multi-Device **@whiskeysockets/baileys**.

Bot ini dilengkapi dengan beragam kapabilitas: asisten kecerdasan buatan (AI & OCR), multimedia downloader, generator stiker presisi 1:1, ekosistem RPG petualangan lengkap (dengan Pet Companion & sistem perbankan bunga harian), kasino mini-game, serta proteksi keamanan berlapis agar nomor tetap aman dari pemblokiran Meta WhatsApp.

---

## 🛡️ Sistem Proteksi Anti-Blokir & Keamanan

Bot mengedepankan keamanan nomor WhatsApp pemilik dengan menerapkan standar interaksi alami:

1. **Reaktif (Inbound-Only):** Bot **hanya** merespon pesan jika pengguna memanggil perintah ber-prefix (contoh: `.menu`, `.play`). Bot tidak pernah melakukan siaran (*broadcast/blast*) atau spam ke nomor orang lain tanpa izin.
2. **Simulasi Pengetikan Alami (*Presence Composing*):** Bot mengirim sinyal status `sedang mengetik...` selama 1.2 detik sebelum mengirimkan balasan pesan.
3. **Anti-Spam Cooldown:** Pembatasan frekuensi perintah (3 detik jeda per pengguna) untuk menghindari spam berlebihan.
4. **Anti-Virtex & Crash Guard:** Pesan teks dengan panjang ekstrem (> 3.000 karakter) otomatis diabaikan untuk melindungi kestabilan sesi WhatsApp.
5. **Anti-Call Guard:** Panggilan suara dan video yang masuk ke nomor bot akan otomatis ditolak secara instan dengan pemberitahuan ramah.
6. **Jam Operasional Terjadwal (Auto-Sleep):** Bot otomatis memasuki mode istirahat pada malam hari (23:00 - 05:00 WIB) untuk mengurangi beban aktivitas jaringan saat jam tidur.

---

## ⏰ Jam Operasional & Manajemen Uptime

Bot dirancang agar dapat di-host di layanan Cloud (seperti **Render**, **Koyeb**, atau **VPS**) dengan integrasi pemantau uptime (**UptimeRobot**):

- **Jam Aktif:** `05:00 - 23:00 WIB` (Bot aktif merespon seluruh perintah WhatsApp)
- **Jam Istirahat (Sleep Mode):** `23:00 - 05:00 WIB` (Bot menonaktifkan respon obrolan malam hari; pesan perintah diabaikan atau dibalas dengan pesan sopan mengenai jam operasional)
- **Akses Khusus Pemilik (Owner Bypass):** Pemilik bot (`ownerNumber`) tetap dapat mengeksekusi perintah darurat atau pemeliharaan kapan pun tanpa dibatasi jadwal tidur.
- **Web Health Check Server (Port 8080):** Server HTTP terintegrasi tetap berjalan dan merespon `HTTP 200 OK` secara kontinu. Dengan demikian, UptimeRobot dapat terus memantau tanpa memicu alarm error atau menyebabkan hosting Render me-restart aplikasi.

---

## 🧩 Katalog Fitur & Modul Plugin

Kitsune Bot menggunakan sistem plugin modular independen yang dimuat secara dinamis dari direktori `plugins/`:

### 1. 🤖 Kecerdasan Buatan (AI) & OCR
- `.ai <pertanyaan>` ─ Asisten pintar berbasis Groq (Llama 3) atau Google Gemini.
- `.wiki <topik>` ─ Pencarian ensiklopedia resmi Wikipedia Indonesia.
- `.ocr` ─ Ekstraksi teks dari foto/gambar dokumen secara otomatis via Gemini Vision.

### 2. 🎵 Multimedia Downloader
- `.play <judul>` / `.lagu <judul>` ─ Pengunduh audio MP3 jernih dari YouTube atau SoundCloud.
- `.ytmp4 <tautan>` ─ Pengunduh video YouTube dalam resolusi HD.
- `.tiktok <tautan>` / `.tt <tautan>` ─ Pengunduh video TikTok tanpa tanda air (watermark).
- `.spotify <tautan>` ─ Pengunduh lagu Spotify ke format MP3.
- `.ig <tautan>` ─ Pengunduh video Instagram Reels / Postingan dan Facebook.

### 3. 🎨 Generator Stiker & Media
- `.s` / `.sticker` ─ Konversi foto, GIF, atau video pendek jadi stiker kotak 1:1 presisi tanpa potongan berlebih.
- `.wm <pack|author>` ─ Ubah nama paket dan pembuat watermark stiker.
- `.toimg` ─ Mengembalikan stiker WhatsApp menjadi gambar foto biasa.
- `.tts <teks>` ─ Konversi teks ke pesan suara (Voice Note Google).

### 4. 🔍 Pencarian & Anime
- `.pinterest <kata kunci>` ─ Pencarian foto resolusi tinggi dari Pinterest.
- `.yts <kata kunci>` ─ Pencarian daftar video di YouTube.
- `.anime <judul>` ─ Informasi statistik, skor, dan sinopsis anime dari AniList.
- `.chara <nama>` ─ Informasi profil karakter anime.
- `.waifu` ─ Koleksi wallpaper anime estetik berkualitas tinggi.

### 5. ⚔️ Sistem RPG Petualangan & Dungeon
- `.adv` ─ Petualangan dungeon menghadapi monster (Serigala Bayangan, Gryphon Petir, Naga Hitam, Raja Iblis Kegelapan).
- `.mining` ─ Menambang batu, besi, emas, dan kristal mistis.
- `.profile` ─ Melihat status HP, level, EXP, koin, dan perlengkapan aktif.
- `.inv` ─ Memeriksa isi tas material tambang dan ramuan pemulih.
- `.lemari` ─ Gudang penyimpanan koleksi senjata dan zirah tempur.
- `.equip <id>` & `.jualeq <id>` ─ Pasang atau jual perlengkapan bekas (refund koin 50%).
- `.heal` & `.use <item>` ─ Konsumsi ramuan darah dan item penguat stat.
- `.daily` ─ Klaim bonus koin harian.
- `.shop` ─ Toko perlengkapan bertingkat (*Bronze* hingga *Eternal*).
- `.craft <id>` ─ Tempa senjata dan zirah tempur menggunakan material tambang.
- `.gacha <1/10>` ─ Undian senjata legendaris bintang 5 dan 6.
- `.duel @tag <koin>` ─ Tantangan bertarung PvP antar pemain dengan taruhan koin.
- `.raid`, `.serang`, `.tagraid` ─ Pertarungan World Boss Raid bersama seluruh anggota grup.
- `.top` ─ Papan peringkat pemain petualang terkuat.

### 6. 🐾 Peliharaan (Pet Companion) & Mata Uang Mistis
- `.pet` ─ Melihat status, level, dan mengadopsi peliharaan mistis (Serigala Api, Elang Petir, Kucing Astral, Naga Miniatur).
- `.feed [jumlah]` ─ Memberi makan peliharaan agar efek peningkatan statistik tempur tetap aktif.
- `.token` ─ Memeriksa saldo **Token Mistis (🔮)**, mata uang langka yang didapatkan dari Raid Boss, Gacha, dan Petualangan tingkat tinggi untuk membeli dan merawat Pet.

### 7. 🏦 Sistem Perbankan Digital
- `.bank` ─ Memeriksa saldo tabungan brankas bank dan riwayat bunga.
- `.nabung <jumlah/all>` ─ Menyetor koin dompet ke dalam rekening bank aman.
- `.tarik <jumlah/all>` ─ Menarik koin dari rekening bank ke dompet.
- *Fitur Bunga Harian:* Tabungan di bank memperoleh bunga pasif sebesar 2% per hari secara otomatis.

### 8. 🎰 Kasino & Mini-Games
- `.slot <taruhan>` ─ Mesin slot 3 rel dengan peluang kekalahan realistis (*high house edge*).
- `.cf <gambar/angka> <taruhan>` ─ Permainan tebak sisi koin 50:50 dengan hadiah 2x lipat.
- `.susunkata` ─ Game asah otak menyusun huruf kata acak.
- `.caklontong` ─ Teka-teki logika lucu khas Cak Lontong.
- `.menyerah` ─ Menyerah dari sesi kuis yang sedang aktif.

### 9. 📅 Informasi Publik & Asisten Utilitas
- `.cuaca <kota>` ─ Prakiraan cuaca terkini di seluruh kota Indonesia.
- `.sholat <kota>` ─ Jadwal waktu sholat 5 waktu resmi Kemenag.
- `.gempa` ─ Informasi gempa bumi terkini bersumber dari BMKG.
- `.tugas` ─ Pengingat catatan tugas dan deadline perkuliahan.
- `.calc <rumus>` ─ Kalkulator hitung cepat matematika.
- `.short <tautan>` ─ Pemendek tautan web instan via TinyURL.
- `.qr <teks/link>` ─ Generator kode QR instan.
- `.ping` ─ Pengujian kecepatan respon server dan penggunaan memori RAM.
- `.owner` ─ Informasi kontak resmi pemilik bot.

### 10. 👥 Administrasi Grup & Keamanan
- `.hidetag <teks>` ─ Tag seluruh anggota grup secara tersembunyi.
- `.tagall <teks>` ─ Tag seluruh anggota grup secara terbuka.
- `.linkgc` ─ Mengambil tautan undangan grup WhatsApp.
- `.group <open/close>` ─ Mengatur izin kirim pesan obrolan grup.
- `.del` ─ Menghapus pesan bot atau pesan obrolan yang dikutip.

---

## ⚙️ Panduan Menjalankan Bot (Khusus Pemilik)

### 1. Menjalankan di Komputer Lokal
1. Pastikan telah terpasang **Node.js v18+** dan **FFmpeg**.
2. Pasang modul dependensi:
   ```bash
   npm install
   ```
3. Jalankan bot:
   ```bash
   npm start
   ```
4. Masukkan nomor WhatsApp bot untuk mendapatkan 8 digit **Kode Pairing**.
5. Buka WhatsApp di ponsel > **Perangkat Tertaut** > **Tautkan Perangkat** > pilih **"Tautkan dengan nomor telepon saja"**, lalu masukkan kode pairing yang tertera di terminal.

### 2. Variabel Lingkungan (Environment Variables)
Jika di-deploy pada platform hosting seperti **Render** atau **VPS**, konfigurasikan variabel berikut:

| Variabel | Keterangan |
| :--- | :--- |
| `PORT` | Port server web health check (standar: `8080`) |
| `PHONE_NUMBER` | Nomor telepon bot untuk auto-request pairing code |
| `SESSION_DATA` | String base64 isi file `creds.json` agar sesi WhatsApp tetap awet di cloud |
| `MONGODB_URI` | Tautan koneksi database MongoDB Atlas untuk penyimpanan cloud persisten |
| `GROQ_API_KEY` | Kunci API Groq Cloud untuk asisten cerdas Llama 3 |
| `GEMINI_API_KEY` | Kunci API Google AI Studio untuk Gemini & OCR Vision |
| `YOUTUBE_COOKIES` | Isi file `cookies.txt` (format Netscape) untuk downloader YouTube |

---

## 🔒 Lisensi & Hak Cipta

**Hak Cipta © 2026 Arterouss. Seluruh hak cipta dilindungi undang-undang.**

Proyek ini adalah perangkat lunak privat (*closed-source*). Dilarang keras menggandakan, mendistribusikan, mempublikasikan ulang, atau menyalin seluruh maupun sebagian dari kode sumber proyek ini untuk keperluan publik atau komersial tanpa izin tertulis dari pemilik sah.
