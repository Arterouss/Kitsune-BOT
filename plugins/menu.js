// plugins/menu.js - Menu Tampilan Bot Ringkas, Estetik & Tidak Kepanjangan
import fs from 'fs';
import { config } from '../config.js';

function formatUptime(ms) {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  return `${days > 0 ? days + 'h ' : ''}${hours}j ${minutes}m ${seconds}d`;
}

export default {
  name: 'menu',
  command: ['menu', 'help'],
  category: 'main',
  description: 'Menampilkan seluruh daftar menu dan fitur bot',
  async run({ sock, jid, msg, prefix, senderName, plugins, startTime }) {
    const uptime = formatUptime(Date.now() - startTime);

    // Struktur menu terpadat & ringkas (1 baris per perintah agar tidak kepanjangan)
    const menuStructure = [
      {
        category: '🤖 AI & OCR',
        items: [
          { cmd: 'ai', param: '<teks>', desc: 'Tanya AI Gemini/GPT' },
          { cmd: 'wiki', param: '<topik>', desc: 'Ensiklopedia Wikipedia' },
          { cmd: 'ocr', param: '', desc: 'Ekstrak teks dari foto' }
        ]
      },
      {
        category: '🎵 DOWNLOADER',
        items: [
          { cmd: 'play', param: '<judul>', desc: 'Unduh MP3 YouTube/SC' },
          { cmd: 'ytmp4', param: '<link>', desc: 'Unduh video YouTube' },
          { cmd: 'tiktok', param: '<link>', desc: 'Unduh video TikTok tanpa WM' },
          { cmd: 'spotify', param: '<link>', desc: 'Unduh lagu Spotify' },
          { cmd: 'ig', param: '<link>', desc: 'Unduh video Instagram/FB' }
        ]
      },
      {
        category: '🎨 STIKER & MEDIA',
        items: [
          { cmd: 's', param: '', desc: 'Ubah gambar/video jadi stiker' },
          { cmd: 'wm', param: '<pack|author>', desc: 'Ganti nama pack stiker' },
          { cmd: 'toimg', param: '', desc: 'Ubah stiker jadi foto biasa' },
          { cmd: 'tts', param: '<teks>', desc: 'Voice note suara Google' }
        ]
      },
      {
        category: '🔍 PENCARIAN & ANIME',
        items: [
          { cmd: 'pinterest', param: '<kata>', desc: 'Cari foto Pinterest HD' },
          { cmd: 'yts', param: '<kata>', desc: 'Pencarian video YouTube' },
          { cmd: 'anime', param: '<judul>', desc: 'Info anime dari AniList' },
          { cmd: 'chara', param: '<nama>', desc: 'Info karakter anime' },
          { cmd: 'waifu', param: '', desc: 'Wallpaper anime aesthetic' }
        ]
      },
      {
        category: '⚔️ RPG & PETUALANGAN',
        items: [
          { cmd: 'adv', param: '', desc: 'Petualang dungeon & raih EXP' },
          { cmd: 'mining', param: '', desc: 'Tambang batu, besi, emas & kristal' },
          { cmd: 'profile', param: '', desc: 'Lihat status HP, level & gear' },
          { cmd: 'inv', param: '', desc: 'Cek isi tas material & ramuan' },
          { cmd: 'lemari', param: '', desc: 'Gudang senjata & zirah kamu' },
          { cmd: 'equip', param: '<id>', desc: 'Pasang perlengkapan dari lemari' },
          { cmd: 'jualeq', param: '<id>', desc: 'Jual perlengkapan bekas (50% refund)' },
          { cmd: 'heal', param: '', desc: 'Minum ramuan pemulih darah HP' },
          { cmd: 'daily', param: '', desc: 'Klaim hadiah koin harian gratis' },
          { cmd: 'shop', param: '', desc: 'Toko gear (Bronze s/d Eternal)' },
          { cmd: 'jual', param: '<nama/all>', desc: 'Tukar hasil tambang jadi koin' },
          { cmd: 'craft', param: '<id>', desc: 'Tempa pedang & zirah tempur' },
          { cmd: 'top', param: '', desc: 'Peringkat petualang terkuat' },
          { cmd: 'duel', param: '@tag <koin>', desc: 'Tantang duel PvP antar pemain' },
          { cmd: 'raid', param: '', desc: 'World Boss Raid monster raksasa' },
          { cmd: 'serang', param: '', desc: 'Pukul Boss Raid bersama anggota' }
        ]
      },
      {
        category: '🎮 GAME & HIBURAN',
        items: [
          { cmd: 'susunkata', param: '', desc: 'Tebak susun kata acak' },
          { cmd: 'caklontong', param: '', desc: 'Teka-teki logika Cak Lontong' },
          { cmd: 'menyerah', param: '', desc: 'Menyerah dari game aktif' }
        ]
      },
      {
        category: '📅 INFORMASI & UTILS',
        items: [
          { cmd: 'cuaca', param: '<kota>', desc: 'Prakiraan cuaca kota' },
          { cmd: 'sholat', param: '<kota>', desc: 'Jadwal sholat 5 waktu' },
          { cmd: 'gempa', param: '', desc: 'Info gempa BMKG terkini' },
          { cmd: 'tugas', param: '', desc: 'Pengingat tugas akademik' },
          { cmd: 'calc', param: '<rumus>', desc: 'Hitung kalkulator kilat' },
          { cmd: 'short', param: '<url>', desc: 'Perpendek link TinyURL' },
          { cmd: 'qr', param: '<teks>', desc: 'Bikin QR Code instan' },
          { cmd: 'ping', param: '', desc: 'Cek kecepatan respon bot' }
        ]
      },
      {
        category: '👥 GRUP ADMIN',
        items: [
          { cmd: 'hidetag', param: '<teks>', desc: 'Tag seluruh anggota tersembunyi' },
          { cmd: 'tagall', param: '<teks>', desc: 'Tag seluruh anggota terbuka' },
          { cmd: 'linkgc', param: '', desc: 'Ambil link undangan grup' },
          { cmd: 'group', param: '<open/close>', desc: 'Buka atau tutup izin obrolan' }
        ]
      }
    ];

    // Bangun menu dalam format 1 baris kompak per perintah
    let menuBody = '';
    for (const sec of menuStructure) {
      menuBody += `\n*${sec.category}*\n`;
      for (const item of sec.items) {
        const paramStr = item.param ? ` ${item.param}` : '';
        menuBody += `  › \`${prefix}${item.cmd}\`${paramStr} ─ _${item.desc}_\n`;
      }
    }

    const header = `
╭━━━━━「 *${config.botName.toUpperCase()}* 」━━━━━╮
┃ 👤 *Halo, ${senderName}!*
┃ ⏱️ *Uptime:* ${uptime} | 🧩 *Modul:* ${plugins.length}
┃ ⚡ *Prefix:* [ ${config.prefixes.join(' ')} ]
╰━━━━━━━━━━━━━━━━━━━━━━━╯
`.trim();

    const footer = `
╭───────────────────────╮
│ 💡 *Tips:* Ketik \`${prefix}adv\` untuk petualang atau \`${prefix}shop\` untuk beli perlengkapan!
╰───────────────────────╯
🔗 *GitHub:* ${config.github}
`.trim();

    const finalMenu = `${header}\n${menuBody}\n${footer}`;

    if (config.bannerPath && fs.existsSync(config.bannerPath)) {
      const bannerData = fs.readFileSync(config.bannerPath);
      await sock.sendMessage(jid, {
        image: bannerData,
        caption: finalMenu
      }, { quoted: msg });
    } else {
      await sock.sendMessage(jid, { text: finalMenu }, { quoted: msg });
    }
  }
};
