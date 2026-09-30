// lib/sticker.js - Pembuat & Converter Stiker WhatsApp Resmi
import { Sticker, StickerTypes } from 'wa-sticker-formatter';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import os from 'os';

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

/**
 * Mengubah Stiker WebP menjadi Gambar PNG biasa (toimg)
 */
export async function stickerToImage(webpBuffer) {
  try {
    // Coba gunakan sharp (lebih cepat dan stabil untuk WebP)
    const sharp = (await import('sharp')).default;
    return await sharp(webpBuffer).png().toBuffer();
  } catch (sharpErr) {
    console.log('Sharp gagal/tidak terinstall, fallback ke ffmpeg...', sharpErr.message);
    const tmpDir = os.tmpdir();
    const inputPath = path.join(tmpDir, `stk_${Date.now()}_${Math.random().toString(36).slice(2)}.webp`);
    const outputPath = path.join(tmpDir, `img_${Date.now()}_${Math.random().toString(36).slice(2)}.png`);

    await fs.promises.writeFile(inputPath, webpBuffer);

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .inputOptions(['-vcodec', 'libwebp'])
        .outputOptions(['-vframes', '1'])
        .output(outputPath)
        .on('error', async (err) => {
          try { await fs.promises.unlink(inputPath); } catch {}
          try { await fs.promises.unlink(outputPath); } catch {}
          reject(err);
        })
        .on('end', async () => {
          try {
            const imgData = await fs.promises.readFile(outputPath);
            await fs.promises.unlink(inputPath);
            await fs.promises.unlink(outputPath);
            resolve(imgData);
          } catch (err) {
            reject(err);
          }
        })
        .run();
    });
  }
}
