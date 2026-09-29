// plugins/sticker.js - Plugin Pembuat Stiker & Watermark
import { imageToSticker, videoToSticker, addExif } from '../lib/sticker.js';
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
  command: ['s', 'sticker', 'stiker', 'wm', 'take'],
  category: 'sticker',
  description: 'Konversi foto/video ke stiker WebP dan ganti watermark',
  async run({ sock, jid, msg, command, args, prefix, reply }) {
    // 1. Buat Stiker Baru
    if (['s', 'sticker', 'stiker'].includes(command)) {
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      let mediaMsg = null;
      let isVideo = false;

      if (msg.message?.imageMessage) {
        mediaMsg = msg.message.imageMessage;
      } else if (msg.message?.videoMessage) {
        mediaMsg = msg.message.videoMessage;
        isVideo = true;
      } else if (quoted?.imageMessage) {
        mediaMsg = quoted.imageMessage;
      } else if (quoted?.videoMessage) {
        mediaMsg = quoted.videoMessage;
        isVideo = true;
      }

      if (!mediaMsg) {
        return reply(`⚠️ Kirim gambar/video dengan caption *${prefix}${command}* atau balas (quote) media dengan *${prefix}${command}*`);
      }

      if (isVideo && mediaMsg.seconds > 10) {
        return reply('⚠️ Durasi video maksimal 10 detik untuk dijadikan stiker!');
      }

      await reply('⏳ Sedang membuat stiker, mohon tunggu sebentar...');

      try {
        const buffer = await downloadMedia(mediaMsg, isVideo ? 'video' : 'image');
        const packname = config.sticker.packname;
        const author = config.sticker.author;

        let stickerBuffer;
        if (isVideo) {
          stickerBuffer = await videoToSticker(buffer, packname, author);
        } else {
          stickerBuffer = await imageToSticker(buffer, packname, author);
        }

        await sock.sendMessage(jid, { sticker: stickerBuffer }, { quoted: msg });
      } catch (err) {
        console.error('Gagal convert stiker:', err);
        await reply('❌ Gagal membuat stiker. Pastikan format file gambar atau video didukung.');
      }
      return;
    }

    // 2. Ganti Watermark Stiker
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
        const newSticker = await addExif(buffer, packname, author);
        await sock.sendMessage(jid, { sticker: newSticker }, { quoted: msg });
      } catch (err) {
        console.error('Gagal mengubah watermark:', err);
        await reply('❌ Gagal mengubah watermark stiker.');
      }
      return;
    }
  }
};
