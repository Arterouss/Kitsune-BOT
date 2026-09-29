// index.js - Titik Masuk dan Pengelola Koneksi Bot WhatsApp Baileys
import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import readline from 'readline';
import qrcode from 'qrcode-terminal';
import { config } from './config.js';
import { messageHandler } from './handler.js';

import http from 'http';

// Setup Interface Input Terminal
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});
const question = (query) => new Promise((resolve) => rl.question(query, resolve));

let currentSock = null;

// Server Health Check untuk Cloud Hosting (Koyeb / Render / Railway)
const PORT = process.env.PORT || 8080;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`
    <!DOCTYPE html>
    <html>
      <head><title>Kitsune Bot</title></head>
      <body style="font-family: -apple-system, sans-serif; text-align: center; padding: 60px; background: #0f172a; color: #f8fafc;">
        <h1 style="font-size: 3rem; margin-bottom: 10px;">🦊 Kitsune Bot</h1>
        <p style="font-size: 1.2rem; color: #94a3b8;">WhatsApp Multi-Device Bot created by <strong>Arterouss</strong></p>
        <div style="display: inline-block; padding: 10px 20px; background: #22c55e; color: #000; font-weight: bold; border-radius: 999px; margin-top: 20px;">
          🟢 BOT IS ACTIVE & HEALTHY
        </div>
      </body>
    </html>
  `);
});

server.listen(PORT, () => {
  console.log(`🌐 Server Web Health Check aktif di port ${PORT}`);
});

/**
 * Fungsi Utama Memulai Bot WhatsApp
 */
async function startBot() {
  if (currentSock) {
    try {
      currentSock.ev.removeAllListeners();
      currentSock.end(new Error('Reconnecting'));
    } catch {}
    currentSock = null;
  }

  console.log('====================================================');
  console.log(`🚀 Menjalankan ${config.botName}...`);
  console.log('====================================================');

  // 1. Inisialisasi Sesi Multi-File Auth
  const { state, saveCreds } = await useMultiFileAuthState('./session');
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`ℹ️ Menggunakan Baileys versi v${version.join('.')} (Latest: ${isLatest})`);

  // 2. Setup Socket Baileys
  const sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }), // Log hening agar terminal bersih dan rapi
    printQRInTerminal: !config.usePairingCode,
    auth: state,
    browser: ['Ubuntu', 'Chrome', '20.0.04'],
    generateHighQualityLinkPreview: true,
    syncFullHistory: false
  });
  currentSock = sock;

  // 3. Login Menggunakan Pairing Code (Jika diaktifkan & belum login)
  if (config.usePairingCode && !sock.authState.creds.registered) {
    let phoneNumber = config.phoneNumber;

    if (!phoneNumber) {
      console.log('\n[LOGIN PAIRING CODE]');
      console.log('Masukkan nomor WhatsApp Anda yang ingin dijadikan bot.');
      console.log('Format: gunakan kode negara tanpa spasi atau tanda + (Contoh: 6281234567890)');
      phoneNumber = await question('👉 Masukkan Nomor WhatsApp: ');
    }

    phoneNumber = phoneNumber.replace(/[^0-9]/g, '');

    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(phoneNumber);
        const formattedCode = code?.match(/.{1,4}/g)?.join('-') || code;
        console.log('\n┌──────────────────────────────────────────────┐');
        console.log(`│   KODE PAIRING ANDA:  \x1b[32m${formattedCode}\x1b[0m       │`);
        console.log('└──────────────────────────────────────────────┘');
        console.log('Cara menghubungkan:');
        console.log('1. Buka aplikasi WhatsApp di HP Anda');
        console.log('2. Buka menu titik tiga (⋮) > Perangkat Tertaut');
        console.log('3. Klik "Tautkan Perangkat"');
        console.log('4. Pilih opsi "Tautkan dengan nomor telepon saja" di bagian bawah');
        console.log(`5. Masukkan 8 digit kode di atas: ${formattedCode}\n`);
      } catch (err) {
        console.error('Gagal mendapatkan kode pairing:', err);
      }
    }, 3000);
  }

  // 4. Pantau Status Koneksi
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr && !config.usePairingCode) {
      console.log('Silakan scan QR code di bawah menggunakan WhatsApp di HP:');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error instanceof Boom)
        ? lastDisconnect.error.output.statusCode
        : null;
      
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log(`⚠️ Koneksi terputus (Alasan: ${lastDisconnect?.error?.message || statusCode}). Reconnect: ${shouldReconnect}`);

      if (shouldReconnect) {
        console.log('🔄 Menyambungkan ulang ke server WhatsApp...');
        startBot();
      } else {
        console.log('❌ Anda telah logout dari WhatsApp. Silakan hapus folder "session" dan mulai ulang.');
      }
    } else if (connection === 'open') {
      console.log('\n====================================================');
      console.log(`✅ BERHASIL TERHUBUNG! ${config.botName} siap digunakan.`);
      console.log(`📱 Coba kirim pesan ".menu" ke nomor bot.`);
      console.log('====================================================\n');
    }
  });

  // 5. Simpan Kredensial Sesi Otomatis
  sock.ev.on('creds.update', saveCreds);

  // 6. Tangani Pesan Masuk (Upsert)
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      await messageHandler(sock, msg);
    }
  });
}

// Menangani Error yang Tidak Tertangkap agar Bot Tidak Mati (Anti-Crash)
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[UNHANDLED REJECTION]:', reason);
});

// Jalankan Bot
startBot();
