// plugins/sticker.js - Plugin Pembuat Stiker & Watermark
import { createSticker, setStickerWatermark, extractAudioFromMedia } from '../lib/sticker.js';
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
  command: ['s', 'sticker', 'stiker', 'saudio', 's_audio', 'wm', 'take', 'cekstiker', 'ceksticker', 'inspect', 'cek'],
  category: 'sticker',
  description: 'Konversi foto/GIF/video ke stiker WebP 1:1, stiker combo audio (.saudio), ganti watermark & inspeksi stiker',
  async run({ sock, jid, msg, command, args, prefix, reply }) {
    // 1. Buat Stiker Baru (.s / .sticker / .saudio)
    if (['s', 'sticker', 'stiker', 'saudio', 's_audio'].includes(command)) {
      const wantAudio = ['saudio', 's_audio'].includes(command) || /audio|suara|lagu|musik/i.test(args);
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
        return reply(`⚠️ Kirim gambar/video/GIF dengan caption *${prefix}${command}* atau balas (quote) media dengan *${prefix}${command}*\n💡 Tambahkan *${prefix}${command} full* jika tidak ingin dipotong ke rasio 1:1.\n🎵 Gunakan *${prefix}s audio* atau *${prefix}saudio* pada video untuk membuat stiker sekaligus audio suaranya.`);
      }

      if (isVideo && mediaMsg.seconds > 10) {
        return reply('⚠️ Durasi video/GIF maksimal 10 detik untuk dijadikan stiker!');
      }

      const modeArg = (args || '').replace(/audio|suara|lagu|musik/gi, '').trim().toLowerCase();
      let fitMode = 'crop';
      if (['full', 'ori', 'nocrop', 'fit'].includes(modeArg)) {
        fitMode = 'full';
      } else if (['crop', 'kotak', '1:1'].includes(modeArg)) {
        fitMode = 'force_crop';
      }

      await reply(isVideo 
        ? (wantAudio ? '⏳ Sedang memproses stiker animasi & mengekstrak audionya...' : '⏳ Sedang memproses stiker animasi (1:1)...')
        : '⏳ Sedang membuat stiker (1:1)...');

      try {
        const buffer = await downloadMedia(mediaMsg, mediaType);
        const packname = config.sticker.packname;
        const author = config.sticker.author;

        const stickerBuffer = await createSticker(buffer, packname, author, { fitMode });
        await sock.sendMessage(jid, { sticker: stickerBuffer }, { quoted: msg });

        if (wantAudio) {
          try {
            const audioBuffer = await extractAudioFromMedia(buffer, 10);
            if (audioBuffer) {
              await sock.sendMessage(jid, {
                audio: audioBuffer,
                mimetype: 'audio/ogg; codecs=opus',
                ptt: true
              }, { quoted: msg });
            } else {
              await reply('ℹ️ Stiker animasi berhasil dibuat, namun file video tidak memiliki audio/suara.');
            }
          } catch (audioErr) {
            console.error('Gagal mengekstrak audio video:', audioErr);
          }
        }
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

      await reply('🔍 Sedang membongkar & menganalisis struktur file stiker sampai ke akar-akarnya...');

      try {
        const buffer = await downloadMedia(targetSticker, 'sticker');
        const keys = Object.keys(targetSticker);
        const isAnim = Boolean(targetSticker.isAnimated);
        const sizeKb = (buffer.length / 1024).toFixed(1);

        // 1. Simpan dump lengkap pesan ke database/last_sticker_dump.json untuk debugging
        const fs = (await import('fs')).default;
        const path = (await import('path')).default;
        try {
          const dumpPath = path.resolve('database/last_sticker_dump.json');
          fs.writeFileSync(dumpPath, JSON.stringify({
            messageKeys: Object.keys(msg.message || {}),
            targetStickerKeys: keys,
            targetSticker: targetSticker,
            quotedKeys: quoted ? Object.keys(quoted) : null
          }, null, 2));
        } catch (e) {
          console.error('Gagal menulis dump:', e);
        }

        // 2. Analisis Chunk WebP (RIFF structure)
        const riffChunks = [];
        try {
          if (buffer.length > 12 && buffer.toString('ascii', 0, 4) === 'RIFF') {
            let offset = 12;
            while (offset + 8 <= buffer.length) {
              const chunkId = buffer.toString('ascii', offset, offset + 4);
              const chunkSize = buffer.readUInt32LE(offset + 4);
              riffChunks.push(`${chunkId} (${chunkSize} B)`);
              offset += 8 + chunkSize + (chunkSize % 2); // padded to even
            }
          }
        } catch {}

        // 3. Baca EXIF & Metadata WebP
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

        // 4. Deteksi apakah ada audio / suara tersembunyi
        let soundInfo = '❌ Tidak ada audio tersemat';
        const rawJson = JSON.stringify({ targetSticker, quoted });
        const hasSoundKeyword = /audio|sound|music|voice|audioMessage|opus/i.test(rawJson);
        const hasRiffAudio = riffChunks.some(c => /audi|snd|ogg|mp3|opus/i.test(c));

        if (hasSoundKeyword || hasRiffAudio || targetSticker.accessibilityLabel) {
          soundInfo = '🔊 Terdeteksi sinyal/metadata audio/label khusus!';
        }

        const report = `
📊 *[HASIL ANALISIS STRUKTUR STIKER]*

🎞️ *Tipe:* ${isAnim ? 'Animasi Bergerak (Animated WebP)' : 'Gambar Diam (Static WebP)'}
📦 *Ukuran File:* ${sizeKb} KB
🏷️ *Packname:* ${pack}
👤 *Author:* ${author}
🎵 *Status Audio:* ${soundInfo}

🧱 *RIFF Chunks:*
\`${riffChunks.join(', ') || 'N/A'}\`

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
