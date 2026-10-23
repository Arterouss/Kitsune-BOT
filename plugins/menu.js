// plugins/menu.js - Menu Tampilan Bot Interaktif & Lengkap
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

    // Daftar menu yang terstruktur dan rapi
    const menuStructure = [
      {
        category: '🤖 AI & OCR',
        items: [
          { cmd: 'ai', param: '<pertanyaan>', desc: 'Tanya AI ChatGPT / Gemini gratis' },
          { cmd: 'wiki', param: '<topik>', desc: 'Cari ensiklopedia di Wikipedia' },
          { cmd: 'ocr', param: '(reply foto)', desc: 'Ekstrak & salin teks dari gambar' }
        ]
      },
      {
        category: '🎵 MUSIK & MEDIA DOWNLOADER',
        items: [
          { cmd: 'play / ytmp3', param: '<judul/link>', desc: 'Download audio MP3 dari YouTube' },
          { cmd: 'ytmp4', param: '<link>', desc: 'Download video YouTube hingga 720p' },
          { cmd: 'tiktok', param: '<link>', desc: 'Download video TikTok tanpa watermark' },
          { cmd: 'spotify', param: '<link>', desc: 'Download lagu dari Spotify' },
          { cmd: 'ig / twitter / fb', param: '<link>', desc: 'Download video sosmed' }
        ]
      },
      {
        category: '🎨 STIKER & MEDIA TOOLS',
        items: [
          { cmd: 's / sticker', param: '(caption/reply foto)', desc: 'Ubah gambar/video jadi stiker WebP' },
          { cmd: 'wm / take', param: '<pack|author>', desc: 'Ganti nama pack/author stiker' },
          { cmd: 'toimg / getimage', param: '(reply stiker)', desc: 'Ubah stiker kembali jadi foto biasa' },
          { cmd: 'tts', param: '<teks>', desc: 'Ubah teks jadi Voice Note suara Google' }
        ]
      },
      {
        category: '🔍 PENCARIAN & GAMBAR',
        items: [
          { cmd: 'pinterest', param: '<kata kunci>', desc: 'Cari gambar aesthetic Pinterest / HD' },
          { cmd: 'yts', param: '<kata kunci>', desc: 'Cari video di YouTube' }
        ]
      },
      {
        category: '🌸 ANIME & WALLPAPER',
        items: [
          { cmd: 'anime', param: '<judul>', desc: 'Info lengkap anime dari AniList' },
          { cmd: 'manga', param: '<judul>', desc: 'Info manga / manhwa / komik' },
          { cmd: 'chara', param: '<nama>', desc: 'Info karakter anime' },
          { cmd: 'kitsune / waifu / neko', param: '', desc: 'Wallpaper anime aesthetic HD' },
          { cmd: 'quoteanime', param: '', desc: 'Kata-kata bijak karakter anime' }
        ]
      },
      {
        category: '⚔️ RPG & PETUALANGAN',
        items: [
          { cmd: 'adventure / adv', param: '', desc: 'Jelajahi hutan dungeon, lawan monster & dapatkan EXP' },
          { cmd: 'mining / nambang', param: '', desc: 'Tambang batu, besi, emas & kristal berharga' },
          { cmd: 'profile / status', param: '', desc: 'Lihat status level, HP, stamina, koin & perlengkapan' },
          { cmd: 'inv / tas', param: '', desc: 'Buka tas penyimpanan material & ramuan' },
          { cmd: 'heal', param: '', desc: 'Gunakan ramuan untuk memulihkan darah (HP)' },
          { cmd: 'daily / klaim', param: '', desc: 'Ambil jatah koin harian & ramuan gratis tiap 24 jam' },
          { cmd: 'shop / toko', param: '', desc: 'Beli ramuan, beliung, & perlengkapan baru' },
          { cmd: 'jual', param: '<nama/all>', desc: 'Jual hasil tambang & kayu jadi koin emas' },
          { cmd: 'craft', param: '<resep>', desc: 'Tempa pedang & zirah tempur lebih kuat' },
          { cmd: 'top / leaderboard', param: '', desc: 'Peringkat 10 petualang terkuat di bot' },
          { cmd: 'transfer', param: '@tag <koin>', desc: 'Kirim koin emas ke rekan petualang lain' },
          { cmd: 'duel / pvp', param: '@tag <koin>', desc: 'Tantang duel PvP adu kuat antar anggota grup' },
          { cmd: 'raid / boss', param: '', desc: 'Panggil / cek status World Boss Raid monster raksasa' },
          { cmd: 'serang / hit', param: '', desc: 'Serang Boss Raid bersama anggota grup untuk raih hadiah' }
        ]
      },
      {
        category: '🎮 GAME & HIBURAN',
        items: [
          { cmd: 'susunkata', param: '', desc: 'Game tebak dan susun huruf acak' },
          { cmd: 'caklontong', param: '', desc: 'Tebak-tebakan lucu & teka-teki logika' },
          { cmd: 'menyerah', param: '', desc: 'Menyerah dari ronde game yang berjalan' }
        ]
      },
      {
        category: '📅 INFORMASI & UTILITAS',
        items: [
          { cmd: 'cuaca', param: '<kota>', desc: 'Cek prakiraan cuaca & temperatur kota' },
          { cmd: 'sholat', param: '<kota>', desc: 'Jadwal sholat 5 waktu harian' },
          { cmd: 'gempa', param: '', desc: 'Info gempa bumi BMKG terkini + peta guncangan' },
          { cmd: 'tugas / deadline', param: '', desc: 'Catat & pantau daftar tugas akademik' }
        ]
      },
      {
        category: '⚙️ ALAT & KONVERSI',
        items: [
          { cmd: 'tr', param: '<kode> <teks>', desc: 'Penerjemah bahasa (contoh: .tr en Halo)' },
          { cmd: 'calc', param: '<rumus>', desc: 'Kalkulator hitung matematika instan' },
          { cmd: 'short', param: '<url>', desc: 'Perpendek link panjang via TinyURL' },
          { cmd: 'qr', param: '<teks>', desc: 'Buat gambar QR Code instan' },
          { cmd: 'ping / speed', param: '', desc: 'Cek latency dan kecepatan server' },
          { cmd: 'owner', param: '', desc: 'Informasi kontak pemilik bot' }
        ]
      },
      {
        category: '👥 PENGELOLA GRUP',
        items: [
          { cmd: 'hidetag', param: '<pesan>', desc: 'Tag seluruh anggota tanpa teks terlihat' },
          { cmd: 'tagall', param: '<pesan>', desc: 'Tag seluruh anggota secara terbuka' },
          { cmd: 'linkgc', param: '', desc: 'Ambil link tautan undangan grup' },
          { cmd: 'group', param: '<open/close>', desc: 'Buka atau tutup izin obrolan grup' }
        ]
      }
    ];

    // Bangun isi menu
    let menuBody = '';
    for (const sec of menuStructure) {
      menuBody += `\n*${sec.category}*\n`;
      for (const item of sec.items) {
        const formattedCmd = item.cmd.split('/').map(c => `\`${prefix}${c.trim()}\``).join(' / ');
        const paramStr = item.param ? ` ${item.param}` : '';
        menuBody += `  › ${formattedCmd}${paramStr}\n    _${item.desc}_\n`;
      }
    }

    const header = `
╭━━━━━「 *${config.botName.toUpperCase()}* 」━━━━━╮
┃ 👤 *Halo, ${senderName}!*
┃ 👑 *Developer:* ${config.ownerName}
┃ ⏱️ *Uptime:* ${uptime}
┃ 🧩 *Total Modul:* ${plugins.length} Plugin
┃ ⚡ *Prefix:* [ ${config.prefixes.join(' ')} ]
╰━━━━━━━━━━━━━━━━━━━━━━━╯
`.trim();

    const footer = `
╭───────────────────────╮
│ 💡 *Tips Penggunaan:*
│ • Mau simpan stiker jadi foto? Reply stiker ketik \`${prefix}toimg\`
│ • Mau dengerin lagu? Ketik \`${prefix}play judul lagu\`
│ • Gabut? Ajak main \`${prefix}susunkata\` atau \`${prefix}caklontong\`
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
