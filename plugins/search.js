// plugins/search.js - Plugin Pencarian (Pinterest & YouTube)
import axios from 'axios';
import { spawn } from 'child_process';

export default {
  name: 'search',
  command: ['pinterest', 'pin', 'yts', 'ytsearch'],
  category: 'tools',
  description: 'Pencarian gambar Pinterest dan video YouTube',
  async run({ sock, jid, msg, command, args, prefix, reply }) {
    
    // 1. PINTEREST SEARCH
    if (['pinterest', 'pin'].includes(command)) {
      if (!args) {
        return reply(`⚠️ Masukkan kata kunci!\nContoh: *${prefix}${command} anime aesthetic*`);
      }

      await reply(`🔍 Mencari gambar *"${args}"* di Pinterest...`);

      try {
        // Menggunakan public API gratis
        const res = await axios.get(`https://api.vreden.web.id/api/pinterest?query=${encodeURIComponent(args)}`);
        
        if (!res.data.result || res.data.result.length === 0) {
          return reply('❌ Tidak menemukan gambar yang cocok.');
        }

        // Ambil hasil acak dari beberapa gambar pertama
        const results = res.data.result;
        const randomImg = results[Math.floor(Math.random() * Math.min(10, results.length))];

        return await sock.sendMessage(jid, { 
          image: { url: randomImg },
          caption: `📌 *Pinterest Search*\nKata kunci: ${args}`
        }, { quoted: msg });
        
      } catch (err) {
        console.error('Error Pinterest:', err);
        return reply('❌ Gagal mengambil gambar dari Pinterest. API mungkin sedang limit.');
      }
    }

    // 2. YOUTUBE SEARCH
    if (['yts', 'ytsearch'].includes(command)) {
      if (!args) {
        return reply(`⚠️ Masukkan kata kunci!\nContoh: *${prefix}${command} tutorial nodejs*`);
      }

      await reply(`🔍 Mencari *"${args}"* di YouTube...`);

      try {
        // Menggunakan yt-dlp agar tidak kena blokir
        const ytArgs = [
          '--print', '%(title)s|%(webpage_url)s|%(duration_string)s|%(view_count)s',
          '--no-playlist',
          `ytsearch5:${args}`
        ];

        const meta = await new Promise((resolve, reject) => {
          const proc = spawn('yt-dlp', ytArgs, { windowsHide: true });
          let stdout = '';
          proc.stdout.on('data', (d) => { stdout += d.toString(); });
          proc.on('close', (code) => {
            if (code === 0) resolve(stdout.trim());
            else resolve('');
          });
        });

        if (!meta) {
          return reply('❌ Tidak menemukan video atau terkena limit dari YouTube.');
        }

        const lines = meta.split('\n');
        let txt = `📺 *HASIL PENCARIAN YOUTUBE*\n\n`;

        lines.forEach((line, i) => {
          const [title, url, duration, views] = line.split('|');
          if (title && url) {
            txt += `*${i+1}. ${title}*\n`;
            txt += `⏱️ Durasi: ${duration} | 👀 Views: ${views || 0}\n`;
            txt += `🔗 Link: ${url}\n\n`;
          }
        });

        return reply(txt.trim());

      } catch (err) {
        console.error('Error YT Search:', err);
        return reply('❌ Terjadi kesalahan saat mencari video.');
      }
    }

  }
};
