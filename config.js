// config.js - Konfigurasi Utama Bot WhatsApp

export const config = {
  // Informasi Bot & Creator
  botName: 'Kitsune Bot',
  ownerName: 'Arterouss',
  ownerNumber: '6281234567890', // Ganti dengan nomor WhatsApp kamu (format: 628xxx)
  github: 'https://github.com/Arterouss/Kitsune-BOT',
  bannerPath: './assets/banner.jpg', // Banner gambar pembuka di .menu
  
  // Prefix perintah (bisa titik, tanda seru, tagar, atau garis miring)
  prefixes: ['.', '!', '#', '/'],

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
