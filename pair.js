// pair.js - Generator Sesi WhatsApp (Mendukung Pairing Code & QR Code Anti-Gagal)
import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestWaWebVersion,
  fetchLatestBaileysVersion,
  Browsers
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import path from 'path';
import { config } from './config.js';

const sessionDir = path.resolve('./session');
const arg = (process.argv[2] || '').trim();
const useQrMode = arg.toLowerCase() === 'qr';
const targetNumber = (useQrMode ? '' : (arg || config.phoneNumber || '')).replace(/[^0-9]/g, '');

if (!useQrMode && !targetNumber) {
  console.error('❌ Harap masukkan nomor WhatsApp atau mode qr!');
  console.error('   Contoh Pairing Code: node pair.js 6288976563675');
  console.error('   Contoh Scan QR Code: node pair.js qr');
  process.exit(1);
}

// Bersihkan folder session lama agar sesi benar-benar fresh
if (fs.existsSync(sessionDir)) {
  fs.rmSync(sessionDir, { recursive: true, force: true });
}
fs.mkdirSync(sessionDir, { recursive: true });

let currentSock = null;

async function getPairingSession() {
  if (currentSock) {
    try {
      currentSock.ev.removeAllListeners();
      currentSock.end(new Error('Reconnecting'));
    } catch {}
    currentSock = null;
  }

  console.log(
    useQrMode
      ? '\n⏳ Menghubungkan ke server WhatsApp (Mode Scan QR)...'
      : `\n⏳ Menghubungkan ke server WhatsApp untuk nomor: +${targetNumber}...`
  );

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

  let waVersion;
  try {
    const waWeb = await fetchLatestWaWebVersion({});
    waVersion = waWeb.version;
  } catch {
    const fallback = await fetchLatestBaileysVersion();
    waVersion = fallback.version;
  }
  console.log(`ℹ️ Menggunakan WA Web versi v${waVersion.join('.')}`);

  const sock = makeWASocket({
    version: waVersion,
    logger: pino({ level: 'fatal' }),
    printQRInTerminal: false,
    auth: state,
    browser: Browsers.ubuntu('Chrome'),
    qrTimeout: 180_000,
    connectTimeoutMs: 60_000,
    syncFullHistory: false
  });
  currentSock = sock;

  let pairingRequested = false;

  sock.ev.on('creds.update', async () => {
    if (sock.authState.creds.registered || sock.authState.creds.account) {
      await saveCreds();
    }
  });

  sock.ev.on('connection.update', async (update) => {
    if (sock !== currentSock) return;
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      if (useQrMode) {
        console.log('\n📱 Silakan SCAN QR Code ini lewat WhatsApp > Perangkat Tertaut > Tautkan Perangkat:\n');
        qrcode.generate(qr, { small: true });
      } else if (!pairingRequested && !sock.authState.creds.registered && !sock.authState.creds.account) {
        pairingRequested = true;
        try {
          const code = await sock.requestPairingCode(targetNumber);
          if (sock !== currentSock) return;
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
          pairingRequested = false;
          console.error('❌ Gagal meminta kode pairing:', err.message);
        }
      }
    }

    if (connection === 'open') {
      await saveCreds();
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

      console.log('Bot sudah siap digunakan! Anda bisa menutup proses ini (Ctrl+C).');
      setTimeout(() => process.exit(0), 3000);
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error instanceof Boom)
        ? lastDisconnect.error.output.statusCode
        : null;

      if (statusCode === DisconnectReason.loggedOut) {
        console.log('❌ Perangkat dikeluarkan (Logged Out). Jalankan ulang skrip ini.');
        process.exit(0);
      } else {
        const delayMs = statusCode === DisconnectReason.restartRequired ? 1000 : 3000;
        console.log(`🔄 Koneksi restart/terputus (kode: ${statusCode || 'unknown'}), menyambung ulang...`);
        setTimeout(() => getPairingSession(), delayMs);
      }
    }
  });
}

getPairingSession();
