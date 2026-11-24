// plugins/sticker.js - Plugin Pembuat Stiker & Watermark
import { createSticker, setStickerWatermark } from '../lib/sticker.js';
import { config } from '../config.js';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';

async function downloadMedia(mediaMessage, mediaType) {
  const stream = await downloadContentFromMessage(mediaMessage, mediaType);
  let buffer = Buffer.from([]);
  for await (const chunk of stream) {
    buffer = Buffer.concat([buffer, chunk]);
  }
  return buffer;
}

export default {
  name: 'sticker',
  command: ['s', 'sticker', 'stiker', 'wm', 'take', 'cekstiker', 'ceksticker', 'inspect', 'cek'],
  category: 'sticker',
  description: 'Konversi foto/GIF/video ke stiker WebP 1:1, ganti watermark & inspeksi stiker',
  async run({ sock, jid, msg, command, args, prefix, reply }) {
    // 1. Buat Stiker Baru (.s / .sticker)
    if (['s', 'sticker', 'stiker'].includes(command)) {
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      let mediaMsg = null;
      let mediaType = 'image';
      let isVideo = false;

      if (msg.message?.imageMessage) {
        mediaMsg = msg.message.imageMessage;
        mediaType = 'image';
      } else if (msg.message?.videoMessage) {
        mediaMsg = msg.message.videoMessage;
        mediaType = 'video';
        isVideo = true;
      } else if (msg.message?.documentMessage && (msg.message.documentMessage.mimetype?.includes('image') || msg.message.documentMessage.mimetype?.includes('video'))) {
        mediaMsg = msg.message.documentMessage;
        mediaType = 'document';
        isVideo = mediaMsg.mimetype?.includes('video') || mediaMsg.mimetype?.includes('gif');
      } else if (quoted?.imageMessage) {
        mediaMsg = quoted.imageMessage;
        mediaType = 'image';
      } else if (quoted?.videoMessage) {
        mediaMsg = quoted.videoMessage;
        mediaType = 'video';
        isVideo = true;
      } else if (quoted?.documentMessage && (quoted.documentMessage.mimetype?.includes('image') || quoted.documentMessage.mimetype?.includes('video'))) {
        mediaMsg = quoted.documentMessage;
        mediaType = 'document';
        isVideo = mediaMsg.mimetype?.includes('video') || mediaMsg.mimetype?.includes('gif');
      } else if (quoted?.stickerMessage) {
        mediaMsg = quoted.stickerMessage;
        mediaType = 'sticker';
        isVideo = Boolean(quoted.stickerMessage.isAnimated);
      }

      if (!mediaMsg) {
        return reply(`⚠️ Kirim gambar/video/GIF dengan caption *${prefix}${command}* atau balas (quote) media dengan *${prefix}${command}*\n💡 Tambahkan *${prefix}${command} full* jika tidak ingin dipotong ke rasio 1:1.`);
      }

      if (isVideo && mediaMsg.seconds > 10) {
        return reply('⚠️ Durasi video/GIF maksimal 10 detik untuk dijadikan stiker!');
      }

      const modeArg = (args || '').trim().toLowerCase();
      let fitMode = 'crop';
      if (['full', 'ori', 'nocrop', 'fit'].includes(modeArg)) {
        fitMode = 'full';
      } else if (['crop', 'kotak', '1:1'].includes(modeArg)) {
        fitMode = 'force_crop';
      }

      await reply(isVideo ? '⏳ Sedang memproses stiker animasi (1:1)...' : '⏳ Sedang membuat stiker (1:1)...');

      try {
        const buffer = await downloadMedia(mediaMsg, mediaType);
        const packname = config.sticker.packname;
        const author = config.sticker.author;

        const stickerBuffer = await createSticker(buffer, packname, author, { fitMode });
        await sock.sendMessage(jid, { sticker: stickerBuffer }, { quoted: msg });
      } catch (err) {
        console.error('Gagal convert stiker:', err);
        await reply('❌ Gagal membuat stiker. Pastikan format file gambar atau video didukung.');
      }
      return;
    }

    // 2. Ganti Watermark Stiker (.wm / .take)
    if (['wm', 'take'].includes(command)) {
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      if (!quoted?.stickerMessage) {
        return reply(`⚠️ Balas (quote) stiker WhatsApp lalu ketik:\n*${prefix}${command} NamaPack|NamaAuthor*`);
      }

      let [packname, author] = args.split('|').map(s => s.trim());
      if (!packname) packname = config.sticker.packname;
      if (!author) author = config.sticker.author;

      await reply('⏳ Mengganti watermark stiker...');

      try {
        const buffer = await downloadMedia(quoted.stickerMessage, 'sticker');
        const newSticker = await setStickerWatermark(buffer, packname, author);
        await sock.sendMessage(jid, { sticker: newSticker }, { quoted: msg });
      } catch (err) {
        console.error('Gagal mengubah watermark:', err);
        await reply('❌ Gagal mengubah watermark stiker.');
      }
      return;
    }

    // 3. Inspeksi Detail Stiker (.cekstiker / .inspect)
    if (['cekstiker', 'ceksticker', 'inspect', 'cek'].includes(command)) {
      let quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      if (quoted?.ephemeralMessage?.message) quoted = quoted.ephemeralMessage.message;
      if (quoted?.viewOnceMessage?.message) quoted = quoted.viewOnceMessage.message;
      if (quoted?.viewOnceMessageV2?.message) quoted = quoted.viewOnceMessageV2.message;

      const targetSticker = quoted?.stickerMessage || msg.message?.stickerMessage;

      if (!targetSticker) {
        const quotedType = quoted ? Object.keys(quoted)[0] : 'tidak ada';
        return reply(`⚠️ Balas (quote) stiker yang ingin diperiksa dengan mengetik:\n*${prefix}${command}*\n\n_(Pesan yang terdeteksi: ${quotedType})_`);
      }

      await reply('🔍 Sedang membongkar & menganalisis struktur file stiker...');

      try {
        const buffer = await downloadMedia(targetSticker, 'sticker');
        const keys = Object.keys(targetSticker);
        const isAnim = Boolean(targetSticker.isAnimated);
        const sizeKb = (buffer.length / 1024).toFixed(1);

        // Baca EXIF & Metadata WebP
        let exifInfo = 'Tidak ada EXIF';
        let pack = '-';
        let author = '-';

        try {
          const webpmux = (await import('node-webpmux')).default;
          const img = new webpmux.Image();
          await img.load(buffer);
          if (img.exif) {
            const rawStr = img.exif.toString('utf-8');
            const start = rawStr.indexOf('{');
            const end = rawStr.lastIndexOf('}');
            if (start !== -1 && end !== -1) {
              const parsed = JSON.parse(rawStr.slice(start, end + 1));
              pack = parsed['sticker-pack-name'] || '-';
              author = parsed['sticker-pack-publisher'] || '-';
              exifInfo = JSON.stringify(parsed, null, 2);
            }
          }
        } catch {}

        // Deteksi apakah ada audio / suara tersembunyi
        let soundInfo = '❌ Tidak ada audio tersemat';
        const rawJson = JSON.stringify(targetSticker);
        if (rawJson.includes('audio') || rawJson.includes('sound') || targetSticker.audio || targetSticker.sound) {
          soundInfo = '🔊 Terdeteksi metadata audio di dalam stiker!';
        }

        const report = `
📊 *[HASIL ANALISIS STRUKTUR STIKER]*

🎞️ *Tipe:* ${isAnim ? 'Animasi Bergerak (Animated WebP)' : 'Gambar Diam (Static WebP)'}
📦 *Ukuran File:* ${sizeKb} KB
🏷️ *Packname:* ${pack}
👤 *Author:* ${author}
🎵 *Status Audio:* ${soundInfo}

⚙️ *Properti Protobuf:*
\`${keys.join(', ')}\`

📋 *Detail Metadata EXIF:*
\`\`\`json
${exifInfo.length > 500 ? exifInfo.slice(0, 500) + '...' : exifInfo}
\`\`\`
`.trim();

        await reply(report);
      } catch (err) {
        console.error('Error saat inspect stiker:', err);
        await reply(`❌ Gagal memeriksa stiker: ${err.message}`);
      }
      return;
    }
  }
};
