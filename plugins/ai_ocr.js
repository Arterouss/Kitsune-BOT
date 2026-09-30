// plugins/ai_ocr.js - Plugin Image to Text (OCR) Menggunakan Tesseract.js
import Tesseract from 'tesseract.js';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function downloadMedia(mediaMessage, mediaType) {
  const stream = await downloadContentFromMessage(mediaMessage, mediaType);
  let buffer = Buffer.from([]);
  for await (const chunk of stream) {
    buffer = Buffer.concat([buffer, chunk]);
  }
  return buffer;
}

export default {
  name: 'ai_ocr',
  command: ['ocr', 'imagetotext', 'salinteks'],
  category: 'ai',
  description: 'Membaca dan menyalin teks dari dalam sebuah gambar (AI OCR)',
  async run({ sock, jid, msg, command, args, prefix, reply }) {
    
    // CEK APAKAH ADA GAMBAR (Bisa kirim foto + caption, atau membalas foto)
    const isImage = msg.message?.imageMessage;
    const isQuotedImage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
    
    const imageMessage = isImage ? msg.message.imageMessage : isQuotedImage;

    if (!imageMessage) {
      return reply(`⚠️ Kirim gambar dengan caption *${prefix}${command}* atau balas (quote) sebuah gambar dengan perintah tersebut.`);
    }

    await reply('🔍 Membaca teks dari gambar... (Ini mungkin memakan waktu beberapa detik)');

    try {
      // 1. Download gambar
      const buffer = await downloadMedia(imageMessage, 'image');
      
      // 2. Simpan sementara karena Tesseract JS kadang lebih stabil baca dari file
      const tmpFile = path.join(os.tmpdir(), `ocr_${Date.now()}.jpg`);
      await fs.promises.writeFile(tmpFile, buffer);

      // 3. Proses dengan Tesseract
      // Menggunakan bahasa Indonesia (ind) dan English (eng)
      const { data: { text } } = await Tesseract.recognize(
        tmpFile,
        'ind+eng',
        { logger: m => console.log(m) } // Log progress di terminal
      );

      // Hapus file sementara
      await fs.promises.unlink(tmpFile);

      if (!text || text.trim().length === 0) {
        return reply('❌ Tidak ada teks yang terdeteksi di dalam gambar tersebut.');
      }

      return reply(`📄 *HASIL PEMBACAAN TEKS (OCR):*\n\n${text.trim()}`);

    } catch (err) {
      console.error('Error OCR:', err);
      return reply('❌ Terjadi kesalahan saat mencoba membaca gambar.');
    }

  }
};
