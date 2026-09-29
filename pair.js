// pair.js - Generator Kode Pairing WhatsApp Baru
import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import { config } from './config.js';

const sessionDir = path.resolve('./session');

// Bersihkan folder session lama agar WhatsApp memberikan kode pairing baru
if (fs.existsSync(sessionDir)) {
  fs.rmSync(sessionDir, { recursive: true, force: true });
}
fs.mkdirSync(sessionDir, { recursive: true });

async function getPairingCode() {
  const targetNumber = (process.argv[2] || config.phoneNumber || '').replace(/[^0-9]/g, '');

  if (!targetNumber) {
    console.error('❌ Harap masukkan nomor WhatsApp! Contoh: node pair.js 6288976563675');
    process.exit(1);
  }

  console.log(`\n⏳ Menghubungkan ke server WhatsApp untuk nomor: +${targetNumber}...`);

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger: pino({ level: 'fatal' }),
    printQRInTerminal: false,
    auth: state,
    browser: ['Ubuntu', 'Chrome', '20.0.04'],
    syncFullHistory: false
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'open') {
      console.log('\n======================================================');
      console.log('🎉 SELAMAT! WHATSAPP BERHASIL TERHUBUNG & LOGIN!');
      console.log('======================================================');

      try {
        const credsPath = path.join(sessionDir, 'creds.json');
        if (fs.existsSync(credsPath)) {
          const credsData = fs.readFileSync(credsPath, 'utf-8');
          const base64Session = Buffer.from(credsData).toString('base64');
          console.log('\n🔑 [SESSION_DATA UNTUK CLOUD / RENDER]:');
          console.log('Copy teks berikut lalu paste di Environment Variables Render (key: SESSION_DATA):');
          console.log('\n' + base64Session + '\n');
        }
      } catch (err) {
        console.error('Gagal membuat string SESSION_DATA:', err.message);
      }

      console.log('Bot sudah siap digunakan! Anda bisa menutup proses ini.');
      setTimeout(() => process.exit(0), 3000);
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error instanceof Boom)
        ? lastDisconnect.error.output.statusCode
        : null;

      if (statusCode !== DisconnectReason.loggedOut) {
        console.log('🔄 Koneksi terputus sementara, mencoba reconnect...');
        getPairingCode();
      } else {
        console.log('❌ Perangkat dikeluarkan (Logged Out). Jalankan ulang skrip ini.');
        process.exit(0);
      }
    }
  });

  // Minta pairing code setelah socket siap
  setTimeout(async () => {
    try {
      const code = await sock.requestPairingCode(targetNumber);
      const formattedCode = code?.match(/.{1,4}/g)?.join('-') || code;

      console.log('\n======================================================');
      console.log(`🔥 KODE PAIRING BARU ANDA: \x1b[1m\x1b[32m${formattedCode}\x1b[0m`);
      console.log('======================================================');
      console.log('📱 Langkah memasukkan kode di WhatsApp:');
      console.log('1. Buka WhatsApp di HP Anda');
      console.log('2. Buka menu Titik Tiga (⋮) > "Perangkat Tertaut"');
      console.log('3. Klik "Tautkan Perangkat"');
      console.log('4. Klik "Tautkan dengan nomor telepon saja" di layar bawah');
      console.log(`5. Masukkan kode 8 digit di atas: ${formattedCode}`);
      console.log('======================================================\n');
      console.log('⏳ Menunggu Anda memasukkan kode di HP (jangan tutup terminal ini)...');
    } catch (err) {
      console.error('❌ Gagal meminta kode pairing:', err.message);
      process.exit(1);
    }
  }, 3000);
}

getPairingCode();
