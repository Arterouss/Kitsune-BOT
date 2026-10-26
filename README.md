# 🦊 Kitsune Bot - WhatsApp Multi-Feature (Modular Plugins & Anti-Blokir)

> **Created by:** [Arterouss](https://github.com/Arterouss)  
> **Repository:** [https://github.com/Arterouss/Kitsune-BOT](https://github.com/Arterouss/Kitsune-BOT)

Bot WhatsApp multifitur modern yang dibangun menggunakan **Node.js** dan library `@whiskeysockets/baileys`. Dilengkapi dengan banner gambar pembuka, sistem plugin modular, dan proteksi anti-blokir.

---

## 🛡️ Mengapa Bot Ini Aman dari Pemblokiran WhatsApp?

1. **Inbound-Only (Reaktif):** Bot **hanya** membalas jika ada yang memanggil perintah ber-prefix (contoh: `.menu`, `.play`). Bot **tidak pernah melakukan blast/spam** ke orang lain tanpa izin.
2. **Simulasi Mengetik Alami (*Presence Typing*):** Bot mengirim status `composing` ("sedang mengetik...") selama 1.2 detik sebelum membalas, sehingga menyerupai interaksi manusia alami.
3. **Anti-Spam Cooldown:** Mencegah pengguna mengirim perintah bertubi-tubi dalam waktu singkat (cooldown 3 detik per pengguna).
4. **Multi-Device Protokol:** Menggunakan WebSocket resmi multi-device WhatsApp Web tanpa browser headless berat.
5. **Bebas Konten Terlarang:** Tidak menyebarkan konten ilegal atau pornografi/NSFW (penyebab nomor terkena auto-banned permanen oleh Meta).

---

## 🧩 Daftar Plugin & Perintah

Semua fitur disimpan secara modular di dalam folder [`plugins/`](file:///d:/Kuliah/Web/BotWa/plugins):

| Kategori | Plugin | Perintah | Deskripsi |
| :--- | :--- | :--- | :--- |
| **🎵 Musik & Media** | `downloader.js` | `.play <judul>` / `.lagu` | Download audio MP3 YouTube jernih |
| | | `.tt <url>` / `.tiktok` | Download video TikTok tanpa watermark |
| | | `.ytmp4 <url>` | Download video YouTube resolusi HD |
| **🎨 Stiker** | `sticker.js` | `.s` atau `.sticker` | Ubah foto atau video pendek (max 10s) jadi stiker |
| | | `.wm <pack>\|<author>` | Ganti watermark stiker |
| **🌸 Anime & Manga** | `anime.js` | `.anime <judul>` | Info detail, skor, & poster anime (AniList) |
| | | `.manga <judul>` | Info detail, skor, & sinopsis manga |
| **🎓 Asisten Akademik** | `akademik.js` | `.tugas list` | Lihat semua catatan tugas & deadline akademik |
| | | `.tugas tambah <matkul> - <detail>` | Tambah catatan tugas baru |
| | | `.tugas hapus <nomor>` | Hapus tugas yang sudah selesai |
| **🤖 AI & Ensiklopedia** | `ai.js` | `.ai <pertanyaan>` | Tanya jawab cerdas dengan AI ChatGPT gratis |
| | | `.wiki <topik>` | Cari ensiklopedia di Wikipedia Indonesia |
| **⚙️ Utilitas** | `tools.js` | `.qr <teks/link>` | Generator gambar QR Code |
| | | `.ping` | Cek kecepatan respon (*latency ms*) dan RAM |
| | | `.owner` | Menampilkan nomor kontak pemilik bot |
| **📋 Menu Dinamis** | `menu.js` | `.menu` / `.help` | Menampilkan daftar seluruh menu |

---

## 💡 Cara Menambah Fitur / Plugin Baru

Cukup buat file JavaScript baru di dalam folder `plugins/`, contoh: `plugins/contoh.js`:

```javascript
export default {
  name: 'contoh',
  command: ['halo', 'hi'],
  category: 'tools',
  description: 'Menyapa pengguna',
  async run({ reply, senderName }) {
    await reply(`Halo kak ${senderName}! Selamat datang!`);
  }
};
```
Perintah `.halo` langsung aktif otomatis tanpa perlu restart bot!

---

## ⚡ Cara Menjalankan Bot di Laptop (Lokal)

1. Buka Terminal / PowerShell di folder ini (`d:\Kuliah\Web\BotWa`).
2. Jalankan perintah:
   ```bash
   npm start
   ```
3. Masukkan nomor WhatsApp Anda (format: `628xxxxxxxxxx`).
4. Salin 8 digit **Kode Pairing** yang muncul di terminal (contoh: `ABCD-1234`).
5. Buka WhatsApp di HP > **Perangkat Tertaut** > **Tautkan Perangkat** > pilih **"Tautkan dengan nomor telepon saja"**, lalu masukkan kodenya.

---

## ☁️ Deployment Cloud Gratis 24/7

### 1. Deploy ke Render (Gratis & Direkomendasikan)
Klik tombol di bawah untuk deploy langsung ke **Render** secara gratis:

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/Arterouss/Kitsune-BOT)

---

### 2. Deploy di HP Android (Termux — 100% Gratis Tanpa Laptop)
1. Buka aplikasi **Termux** di HP Android Anda.
2. Jalankan perintah:
   ```bash
   pkg update && pkg install git nodejs-lts ffmpeg -y
   git clone https://github.com/Arterouss/Kitsune-BOT.git
   cd Kitsune-BOT
   npm install
   npm start
   ```
3. Masukkan kode pairing yang muncul ke WhatsApp Anda. Selesai!


