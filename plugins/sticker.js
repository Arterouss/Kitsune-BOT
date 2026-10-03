// plugins/sticker.js - Plugin Pembuat Stiker & Watermark
import { createSticker } from '../lib/sticker.js';
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
      }

      if (!mediaMsg) {
        return reply(`⚠️ Kirim gambar/video/GIF dengan caption *${prefix}${command}* atau balas (quote) media dengan *${prefix}${command}*`);
      }

      if (isVideo && mediaMsg.seconds > 10) {
        return reply('⚠️ Durasi video/GIF maksimal 10 detik untuk dijadikan stiker!');
      }

      await reply('⏳ Sedang memproses dan mengompres stiker animasi...');

      try {
        const buffer = await downloadMedia(mediaMsg, mediaType);
        const packname = config.sticker.packname;
        const author = config.sticker.author;

        const stickerBuffer = await createSticker(buffer, packname, author);
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
        const newSticker = await createSticker(buffer, packname, author);
        await sock.sendMessage(jid, { sticker: newSticker }, { quoted: msg });
      } catch (err) {
        console.error('Gagal mengubah watermark:', err);
        await reply('❌ Gagal mengubah watermark stiker.');
      }
      return;
    }
  }
};
