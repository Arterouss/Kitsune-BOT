// plugins/downloader.js - Plugin Downloader Lagu & Video
import { downloadSong, downloadTikTok, downloadYtVideo } from '../lib/downloader.js';

export default {
  name: 'downloader',
  command: ['play', 'lagu', 'ytmp3', 'tt', 'tiktok', 'ytmp4', 'ytvideo'],
  category: 'media',
  description: 'Download audio MP3 YouTube, video TikTok (No WM), dan YouTube MP4',
  async run({ sock, jid, msg, command, args, prefix, reply }) {
    // 1. Download Lagu MP3
    if (['play', 'lagu', 'ytmp3'].includes(command)) {
      if (!args) {
        return reply(`⚠️ Harap masukkan judul lagu atau link YouTube!\nContoh: *${prefix}${command} Lathi Weird Genius*`);
      }

      await reply(`🔍 Sedang mencari dan mendownload lagu *"${args}"*... Harap tunggu sebentar.`);

      try {
        const song = await downloadSong(args);

        const caption = `
🎵 *${song.title}*
🎤 *Artis:* ${song.artist}
⏱️ *Durasi:* ${song.duration}
👀 *Dilihat:* ${Number(song.views).toLocaleString('id-ID')} kali
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
        console.error('Error saat download lagu:', err);
        await reply(`❌ ${err.message || 'Gagal mendownload lagu. Coba judul lain.'}`);
      }
      return;
    }

    // 2. Download TikTok No Watermark
    if (['tt', 'tiktok'].includes(command)) {
      if (!args || (!args.includes('tiktok.com') && !args.includes('http'))) {
        return reply(`⚠️ Masukkan URL video TikTok yang valid!\nContoh: *${prefix}${command} https://vt.tiktok.com/xxxxxx/*`);
      }

      await reply('⏳ Sedang memproses video TikTok... Harap tunggu.');

      try {
        const tt = await downloadTikTok(args);
        await sock.sendMessage(jid, {
          video: { url: tt.filePath },
          caption: '✅ *Berhasil mendownload video TikTok (No Watermark)!*'
        }, { quoted: msg });

        await tt.cleanUp();
      } catch (err) {
        console.error('Error saat download TikTok:', err);
        await reply(`❌ ${err.message || 'Gagal mendownload video TikTok. Pastikan video tidak di-private.'}`);
      }
      return;
    }

    // 3. Download YouTube Video MP4
    if (['ytmp4', 'ytvideo'].includes(command)) {
      if (!args || !args.includes('http')) {
        return reply(`⚠️ Masukkan URL YouTube!\nContoh: *${prefix}${command} https://youtube.com/watch?v=xxxx*`);
      }

      await reply('⏳ Sedang memproses download video YouTube...');

      try {
        const vid = await downloadYtVideo(args);
        await sock.sendMessage(jid, {
          video: { url: vid.filePath },
          caption: '✅ *Berhasil mendownload video YouTube!*'
        }, { quoted: msg });

        await vid.cleanUp();
      } catch (err) {
        console.error('Error download video YT:', err);
        await reply(`❌ ${err.message || 'Gagal mendownload video YouTube.'}`);
      }
      return;
    }
  }
};
