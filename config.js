// config.js - Konfigurasi Utama Bot WhatsApp
import fs from 'fs';
import path from 'path';

// Auto-load .env jika file ada secara lokal (Aman & Tidak di-push ke GitHub)
if (fs.existsSync('.env')) {
  try {
    const lines = fs.readFileSync('.env', 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const idx = trimmed.indexOf('=');
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
        if (key && !process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  } catch {}
}

export const config = {
  // Informasi Bot & Creator
  botName: 'Kitsune Bot',
  ownerName: 'Arterouss',
  ownerNumber: process.env.OWNER_NUMBER || '6281234567890', // Nomor WhatsApp Owner (Gunakan env OWNER_NUMBER di cloud)
  github: 'https://github.com/Arterouss/Kitsune-BOT',
  bannerPath: './assets/banner.jpg', // Banner gambar pembuka di .menu
  
  // Prefix perintah (bisa titik, tanda seru, tagar, atau garis miring)
  prefixes: ['.', '!', '#', '/'],

  // Pengaturan Jam Operasional (Auto-Sleep)
  // Bot aktif jam 05:00 s/d 23:00 WIB, dan istirahat jam 23:00 s/d 05:00 WIB
  operatingHours: {
    enabled: true,               // true = aktifkan jadwal jam kerja & tidur bot
    startHour: 5,                // Bangun & aktif jam 05:00 WIB
    endHour: 23,                 // Istirahat / tidur jam 23:00 WIB (11 malam)
    timezone: 'Asia/Jakarta',    // Zona waktu (WIB)
    silentDuringOffHours: false, // false = kirim info jam operasional sopan; true = hening total
    sleepNoticeCooldownMs: 60000 // Cooldown pemberitahuan tidur per pengirim (1 menit agar tidak spam)
  },

  // Pengaturan Watermark Stiker (Exif Metadata)
  sticker: {
    packname: 'Kitsune Sticker Pack',
    author: 'Kitsune Bot'
  },

  // Fitur Anti-Blokir & Keamanan
  security: {
    cooldownMs: 3000,          // Jeda minimal antar perintah per pengguna (mencegah spam)
    simulateTyping: true,      // Mengirim status "sedang mengetik..." sebelum membalas
    typingDelayMs: 1200,       // Delay pengetikan alami (1.2 detik)
    maxAudioDurationSec: 600   // Maksimal durasi lagu (10 menit)
  },

  // Konfigurasi AI (Gratis, tanpa kartu kredit)
  ai: {
    // Kunci API Groq (Disarankan: 14.400 request/hari, super cepat)
    // Ambil gratis di: https://console.groq.com/keys
    groqApiKey: process.env.GROQ_API_KEY || '',

    // Kunci API Google Gemini (Opsional: 1.500 request/hari)
    // Ambil gratis di: https://aistudio.google.com/app/apikey
    geminiApiKey: process.env.GEMINI_API_KEY || ''
  },

  // Pilihan Login:
  // true = Gunakan Pairing Code (8 digit kode angka/huruf tanpa kamera)
  // false = Gunakan Scan QR Code di Terminal
  usePairingCode: true,
  phoneNumber: '6288976563675' // Nomor WhatsApp Business bot (format 628xxx)
};

/**
 * Mendapatkan daftar seluruh nomor Owner yang terdaftar dari berbagai sumber aman
 */
export function getOwnerNumbers() {
  const owners = new Set();

  const addNumber = (raw) => {
    if (!raw) return;
    const parts = String(raw).split(/[,;| ]+/);
    for (const p of parts) {
      if (!p) continue;
      const noDomain = p.split('@')[0].split(':')[0].trim();
      const clean = noDomain.replace(/[^0-9]/g, '').replace(/^0/, '62');
      if (clean) owners.add(clean);
      if (noDomain && noDomain !== clean) owners.add(noDomain.toLowerCase());
    }
  };

  // 1. Dari config.ownerNumber
  addNumber(config.ownerNumber);

  // 2. Dari process.env.OWNER_NUMBER
  addNumber(process.env.OWNER_NUMBER);

  // 3. Dari database/owner.json (Aman & Tidak pernah di-push ke git)
  try {
    const ownerFile = path.resolve('./database/owner.json');
    if (fs.existsSync(ownerFile)) {
      const raw = fs.readFileSync(ownerFile, 'utf-8');
      const data = JSON.parse(raw);
      const list = Array.isArray(data) ? data : (data.owners || []);
      for (const item of list) {
        addNumber(item);
      }
    }
  } catch {}

  // 4. Nomor bot sendiri
  addNumber(config.phoneNumber);

  return Array.from(owners);
}

/**
 * Validasi apakah pengirim pesan adalah Owner sah bot
 */
export function isUserOwner(sender, msg = null) {
  if (msg?.key?.fromMe) return true;
  if (!sender) return false;

  const owners = getOwnerNumbers();
  const candidates = new Set();

  const addCand = (val) => {
    if (!val) return;
    const raw = String(val).toLowerCase();
    candidates.add(raw);
    const noDomain = raw.split('@')[0].split(':')[0].trim();
    candidates.add(noDomain);
    const cleanNum = noDomain.replace(/[^0-9]/g, '').replace(/^0/, '62');
    if (cleanNum) candidates.add(cleanNum);
  };

  addCand(sender);
  if (msg?.senderPn) addCand(msg.senderPn);
  if (msg?.key?.remoteJid) addCand(msg.key.remoteJid);
  if (msg?.key?.participant) addCand(msg.key.participant);
  if (msg?.key?.participantPn) addCand(msg.key.participantPn);
  if (msg?.key?.remoteJidPn) addCand(msg.key.remoteJidPn);

  for (const owner of owners) {
    if (!owner) continue;
    const cleanOwner = String(owner).toLowerCase().split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
    const rawOwner = String(owner).toLowerCase();

    for (const cand of candidates) {
      if (cand === rawOwner || cand === cleanOwner) return true;
      if (cand.includes(rawOwner) || cand.includes(cleanOwner)) return true;
    }
  }
  return false;
}

