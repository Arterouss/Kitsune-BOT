// plugins/downloader_extra.js - Downloader Tambahan
import { downloadSong, downloadYtVideo } from '../lib/downloader.js';
import { spawn } from 'child_process';
import path from 'path';
import os from 'os';
import fs from 'fs';
import axios from 'axios';

export default {
  name: 'downloader_extra',
  command: ['spotify', 'ig', 'igdl', 'instagram', 'tw', 'twitter', 'x', 'facebook', 'fb'],
  category: 'media',
  description: 'Download dari Spotify, Instagram, Twitter/X, dan Facebook',
  async run({ sock, jid, msg, command, args, prefix, reply }) {
    
    // 1. SPOTIFY DOWNLOADER (Oembed -> yt-dlp)
    if (command === 'spotify') {
      if (!args || !args.includes('spotify.com')) {
        return reply(`⚠️ Masukkan tautan Spotify yang valid!\nContoh: *${prefix}${command} https://open.spotify.com/track/xxxx*`);
      }

      await reply('⏳ Mengambil metadata lagu dari Spotify...');
      
      try {
        // Ambil judul lagu secara gratis pakai Oembed API resmi Spotify
        const res = await axios.get(`https://open.spotify.com/oembed?url=${encodeURIComponent(args)}`);
        const query = `${res.data.title} ${res.data.author_name}`;
        
        await reply(`🔍 Mendownload lagu *"${query}"*...`);
        
        // Gunakan downloader YouTube yang sudah ada untuk mendownload audionya
        const song = await downloadSong(query);

        const caption = `
🎵 *Spotify Downloader*
🎤 *Judul:* ${song.title}
🎧 *Artis:* ${song.artist}
`.trim();

        if (song.thumbnail) {
          await sock.sendMessage(jid, {
            image: { url: song.thumbnail },
            caption: caption
          }, { quoted: msg });
        }

        await sock.sendMessage(jid, {
          audio: { url: song.filePath },
          mimetype: 'audio/mp4',
          fileName: `${song.title}.mp3`,
          ptt: false
        }, { quoted: msg });

        await song.cleanUp();
      } catch (err) {
        console.error('Error Spotify:', err);
        return reply('❌ Gagal mendownload lagu Spotify.');
      }
      return;
    }

    // 2. SOSMED DOWNLOADER (Instagram, Twitter, FB via yt-dlp)
    if (['ig', 'igdl', 'instagram', 'tw', 'twitter', 'x', 'facebook', 'fb'].includes(command)) {
      if (!args || !args.includes('http')) {
        return reply(`⚠️ Masukkan tautan video yang valid!\nContoh: *${prefix}${command} https://twitter.com/xxxx/status/xxxx*`);
      }

      await reply(`⏳ Sedang memproses video dari tautan tersebut...`);

      const tmpDir = os.tmpdir();
      const fileId = `vid_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const finalMp4Path = path.join(tmpDir, `${fileId}.mp4`);

      // Gunakan yt-dlp untuk universal download (Twitter, IG, FB)
      const ytArgs = [
        '-f', 'best',
        '-o', finalMp4Path,
        '--no-playlist',
        args
      ];

      try {
        await new Promise((resolve, reject) => {
          const proc = spawn('yt-dlp', ytArgs, { windowsHide: true });
          let stderr = '';
          proc.stderr.on('data', (d) => { stderr += d.toString(); });
          
          proc.on('close', (code) => {
            if (code === 0 && fs.existsSync(finalMp4Path)) {
              resolve();
            } else {
              reject(new Error(`Gagal mendownload: ${stderr.slice(-300)}`));
            }
          });
        });

        await sock.sendMessage(jid, {
          video: { url: finalMp4Path },
          caption: '✅ *Berhasil mendownload video!*'
        }, { quoted: msg });

        try {
          await fs.promises.unlink(finalMp4Path);
        } catch {}

      } catch (err) {
        console.error('Error Sosmed DL:', err);
        return reply(`❌ Gagal mendownload video. Pastikan akun tidak di-private atau tautan valid.\nJika ini Instagram, Instagram sering memblokir server cloud. Coba gunakan URL lain.`);
      }
    }

  }
};
