// lib/sticker.js - Pembuat Stiker WhatsApp Resmi menggunakan wa-sticker-formatter
import { Sticker, StickerTypes } from 'wa-sticker-formatter';

/**
 * Membuat Stiker WhatsApp dari Buffer Gambar atau Video
 * Mendukung resolusi 512x512, transparansi, dan EXIF metadata WhatsApp resmi
 */
export async function createSticker(mediaBuffer, packname = 'Kitsune Sticker Pack', author = 'Kitsune Bot') {
  try {
    const sticker = new Sticker(mediaBuffer, {
      pack: packname,
      author: author,
      type: StickerTypes.FULL,
      categories: ['✨', '🦊', '🤖'],
      id: 'kitsune-bot',
      quality: 75
    });

    return await sticker.toBuffer();
  } catch (err) {
    console.error('Error saat membuat stiker dengan wa-sticker-formatter:', err);
    throw err;
  }
}
