// plugins/sticker.js - Plugin Pembuat Stiker & Watermark
import { createSticker, setStickerWatermark, extractAudioFromMedia, createSoundSticker } from '../lib/sticker.js';
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
  command: ['s', 'sticker', 'stiker', 'saudio', 's_audio', 'sts', 'soundsticker', 'wm', 'take', 'cekstiker', 'ceksticker', 'inspect', 'cek'],
  category: 'sticker',
  description: 'Konversi foto/GIF/video ke stiker WebP 1:1, Sound Sticker (.sts), combo audio (.saudio), ganti watermark & inspeksi stiker',
  async run({ sock, jid, msg, command, args, prefix, reply }) {
    // 0. Sound Sticker (.sts / .soundsticker)
    if (['sts', 'soundsticker'].includes(command)) {
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      let mediaMsg = null;
      let mediaType = 'video';

      if (msg.message?.videoMessage) {
        mediaMsg = msg.message.videoMessage;
      } else if (msg.message?.documentMessage && (msg.message.documentMessage.mimetype?.includes('video') || msg.message.documentMessage.mimetype?.includes('gif'))) {
        mediaMsg = msg.message.documentMessage;
        mediaType = 'document';
      } else if (quoted?.videoMessage) {
        mediaMsg = quoted.videoMessage;
      } else if (quoted?.documentMessage && (quoted.documentMessage.mimetype?.includes('video') || quoted.documentMessage.mimetype?.includes('gif'))) {
        mediaMsg = quoted.documentMessage;
        mediaType = 'document';
      }

      if (!mediaMsg) {
        return reply(`⚠️ Balas (quote) video atau kirim video dengan caption:\n*${prefix}${command}*\n💡 Maksimal durasi 10 detik.`);
      }

      await reply('Making your sticker, please wait...');

      try {
        const buffer = await downloadMedia(mediaMsg, mediaType);
        const soundStickerBuffer = await createSoundSticker(buffer, 7);

        await sock.sendMessage(jid, {
          sticker: soundStickerBuffer,
          isAnimated: true
        }, { quoted: msg });
      } catch (err) {
        console.error('Gagal membuat sound sticker .sts:', err);
        await reply(`❌ Gagal membuat sound sticker: ${err.message}`);
      }
      return;
    }

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
        return reply(`⚠️ Kirim gambar/video/GIF dengan caption *${prefix}${command}* atau balas (quote) media dengan *${prefix}${command}*\n💡 Tambahkan *${prefix}${command} full* jika tidak ingin dipotong ke rasio 1:1.`);
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

      await reply(isVideo ? '⏳ Sedang memproses stiker animasi (1:1)...' : '⏳ Sedang membuat stiker (1:1)...');

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
            }
          } catch {}
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

      await reply('🔍 Sedang membongkar format file, chunk biner & protobuf stiker...');

      try {
        const buffer = await downloadMedia(targetSticker, 'sticker');
        const keys = Object.keys(targetSticker);
        const isAnim = Boolean(targetSticker.isAnimated);
        const sizeKb = (buffer.length / 1024).toFixed(1);

        // 1. Cek Magic Bytes & Format Kontainer Asli
        let realFormat = 'Unknown';
        try {
          const { fileTypeFromBuffer } = await import('file-type');
          const ft = await fileTypeFromBuffer(buffer);
          if (ft) realFormat = `${ft.ext.toUpperCase()} (${ft.mime})`;
        } catch {}
        const headerHex = buffer.subarray(0, 16).toString('hex');
        const headerAscii = buffer.subarray(0, 16).toString('ascii').replace(/[^\x20-\x7E]/g, '.');

        // 2. Analisis Struktur RIFF / WebP Chunks + Trailing Bytes
        const chunkCounts = {};
        const nonFrameChunks = [];
        let trailingInfo = '0 B';
        try {
          if (buffer.length > 12 && buffer.toString('ascii', 0, 4) === 'RIFF') {
            const declaredRiffEnd = 8 + buffer.readUInt32LE(4);
            if (buffer.length > declaredRiffEnd) {
              const tail = buffer.subarray(declaredRiffEnd, declaredRiffEnd + 16).toString('ascii').replace(/[^\x20-\x7E]/g, '.');
              trailingInfo = `${buffer.length - declaredRiffEnd} B (${tail})`;
            }
            let offset = 12;
            while (offset + 8 <= buffer.length && offset < declaredRiffEnd) {
              const chunkId = buffer.toString('ascii', offset, offset + 4);
              const chunkSize = buffer.readUInt32LE(offset + 4);
              chunkCounts[chunkId] = (chunkCounts[chunkId] || 0) + 1;
              if (chunkId !== 'ANMF') {
                nonFrameChunks.push(`${chunkId}(${chunkSize}B)`);
              }
              offset += 8 + chunkSize + (chunkSize % 2);
            }
          }
        } catch {}

        const chunkSummary = Object.entries(chunkCounts)
          .map(([id, cnt]) => cnt > 1 ? `${id} x${cnt}` : id)
          .join(', ');

        // 3. Cek stream audio via ffmpeg (jika ada track tersembunyi)
        let ffmpegStreamInfo = '-';
        try {
          const { spawnSync } = await import('child_process');
          const os = (await import('os')).default;
          const fs = (await import('fs')).default;
          const path = (await import('path')).default;
          const tmpProbe = path.join(os.tmpdir(), `probe_${Date.now()}.bin`);
          fs.writeFileSync(tmpProbe, buffer);
          const res = spawnSync('ffmpeg', ['-i', tmpProbe], { encoding: 'utf-8', windowsHide: true });
          try { fs.unlinkSync(tmpProbe); } catch {}
          const lines = (res.stderr || '').split('\n').filter(l => l.includes('Stream #') || l.includes('Input #'));
          if (lines.length) ffmpegStreamInfo = lines.map(l => l.trim()).join('\n');
        } catch {}

        // 4. Baca EXIF & Metadata WebP
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

        // 5. Deteksi apakah ada sinyal audio / label / contextInfo
        let soundInfo = '❌ Tidak terdeteksi keyword audio di protobuf';
        const rawJson = JSON.stringify({ targetSticker, quoted });
        if (/audio|sound|music|voice|opus|Audio/i.test(rawJson) || /Audio/.test(ffmpegStreamInfo)) {
          soundInfo = '🔊 Terdeteksi sinyal/stream audio!';
        }

        const ctxSummary = targetSticker.contextInfo ? JSON.stringify(targetSticker.contextInfo) : 'null';
        const quotedKeys = quoted ? Object.keys(quoted).join(', ') : '-';

        const report = `
📊 *[HASIL ANALISIS MENDALAM STIKER]*

🎞️ *Tipe:* ${isAnim ? 'Animasi Bergerak' : 'Gambar Diam'} (${targetSticker.width || '?'}x${targetSticker.height || '?'})
🧬 *Format Asli:* ${realFormat}
🪪 *Mimetype Proto:* \`${targetSticker.mimetype || '-'}\`
📦 *Ukuran File:* ${sizeKb} KB | *Trailing:* ${trailingInfo}
🔤 *Magic Header:* \`${headerAscii}\` (\`${headerHex}\`)
🏷️ *Packname:* ${pack} | *Author:* ${author}
🎵 *Status Audio:* ${soundInfo}

🧱 *RIFF Chunks:* \`${chunkSummary || 'Bukan RIFF/WebP'}\`
🧩 *Non-ANMF:* \`${nonFrameChunks.join(', ') || '-'}\`

🎬 *FFmpeg Probe:*
\`\`\`
${ffmpegStreamInfo.slice(0, 400)}
\`\`\`

⚙️ *Quoted Keys:* \`${quotedKeys}\`
⚙️ *Protobuf Keys:* \`${keys.join(', ')}\`
🏷️ *Extra Flags:* lottie=${Boolean(targetSticker.isLottie)}, avatar=${Boolean(targetSticker.isAvatar)}, ai=${Boolean(targetSticker.isAiSticker)}, label=${targetSticker.accessibilityLabel || '-'}

🔗 *ContextInfo:*
\`${ctxSummary.slice(0, 350)}\`

📋 *Detail Metadata EXIF:*
\`\`\`json
${exifInfo.length > 350 ? exifInfo.slice(0, 350) + '...' : exifInfo}
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
