// plugins/menu.js - Menu Dinamis Otomatis Berdasarkan Plugin
import fs from 'fs';
import path from 'path';
import os from 'os';
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

    // Kategori & Emoji Pemisah
    const categoryNames = {
      media: '🎵 MUSIK & MEDIA DOWNLOADER',
      sticker: '🎨 PEMBUAT STIKER',
      ai: '🤖 AI & ENSIKLOPEDIA',
      anime: '🌸 ANIME & MANGA INFO',
      akademik: '🎓 AKADEMIK & TUGAS',
      tools: '⚙️ UTILITAS & ALAT',
      main: '📋 UTAMA'
    };

    // Kelompokkan plugin berdasarkan kategori
    const categorized = {};
    for (const p of plugins) {
      if (!p.category || p.category === 'main') continue;
      if (!categorized[p.category]) categorized[p.category] = [];
      categorized[p.category].push(p);
    }

    let menuBody = '';
    for (const [cat, items] of Object.entries(categorized)) {
      const title = categoryNames[cat] || `📁 ${cat.toUpperCase()}`;
      menuBody += `\n*${title}*\n`;
      for (const item of items) {
        const cmdList = item.command.map(c => `\`${prefix}${c}\``).join(' / ');
        menuBody += `  › ${cmdList}\n    _${item.description || '-'}\n`;
      }
    }

    const header = `
╭━━━━━「 *${config.botName.toUpperCase()}* 」━━━━━╮
┃ 👤 *Hai, ${senderName}!*
┃ 👑 *Developer:* ${config.ownerName}
┃ ⏱️ *Uptime:* ${uptime}
┃ 🧩 *Total Plugin:* ${plugins.length} Modul
┃ ⚡ *Prefix:* [ ${config.prefixes.join(' ')} ]
╰━━━━━━━━━━━━━━━━━━━━━━━╯
`.trim();

    const footer = `
_💡 Tips: Bot ini aman dari banned karena menggunakan arsitektur modular & proteksi delay alami._
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
