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

      await reply(`🔍 Mencari gambar *"${args}"*...`);

      try {
        let imageUrls = [];

        // Strategi 1: Siputzx Pinterest API
        try {
          const res = await axios.get(`https://api.siputzx.my.id/api/s/pinterest?query=${encodeURIComponent(args)}`, {
            timeout: 8000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
          });
          if (res.data?.status && Array.isArray(res.data.data) && res.data.data.length > 0) {
            imageUrls = res.data.data.map(item => item.image_url || item.pin).filter(Boolean);
          }
        } catch {}

        // Strategi 2: Coba cari dengan query wallpaper/aesthetic jika hasil kosong
        if (imageUrls.length === 0) {
          try {
            const res = await axios.get(`https://api.siputzx.my.id/api/s/pinterest?query=${encodeURIComponent(args + ' aesthetic wallpaper')}`, {
              timeout: 8000,
              headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            if (res.data?.status && Array.isArray(res.data.data) && res.data.data.length > 0) {
              imageUrls = res.data.data.map(item => item.image_url).filter(Boolean);
            }
          } catch {}
        }

        // Strategi 3: Unsplash HD fallback jika Pinterest limit/kosong
        if (imageUrls.length === 0) {
          try {
            const res = await axios.get(`https://unsplash.com/napi/search/photos?query=${encodeURIComponent(args)}&per_page=15`, {
              timeout: 8000,
              headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            if (Array.isArray(res.data?.results) && res.data.results.length > 0) {
              imageUrls = res.data.results.map(item => item.urls?.regular || item.urls?.full).filter(Boolean);
            }
          } catch {}
        }

        if (imageUrls.length === 0) {
          return reply(`❌ Tidak menemukan gambar yang cocok untuk "${args}". Coba kata kunci lain.`);
        }

        const randomImg = imageUrls[Math.floor(Math.random() * Math.min(10, imageUrls.length))];

        return await sock.sendMessage(jid, { 
          image: { url: randomImg },
          caption: `📌 *Pencarian Gambar*\nKata kunci: ${args}`
        }, { quoted: msg });
        
      } catch (err) {
        console.error('Error Pinterest:', err);
        return reply('❌ Gagal mengambil gambar dari Pinterest. Silakan coba beberapa saat lagi.');
      }
    }

    // 2. YOUTUBE SEARCH
    if (['yts', 'ytsearch'].includes(command)) {
      if (!args) {
        return reply(`⚠️ Masukkan kata kunci!\nContoh: *${prefix}${command} tutorial nodejs*`);
      }

      await reply(`🔍 Mencari *"${args}"* di YouTube...`);

      try {
        const ytArgs = [
          '--js-runtimes', 'node',
          '--remote-components', 'ejs:github',
          '--extractor-args', 'youtube:player_client=android',
          '--print', '%(title)s|%(webpage_url)s|%(duration_string)s|%(view_count)s',
          '--no-playlist',
          `ytsearch5:${args}`
        ];

        const meta = await new Promise((resolve) => {
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
