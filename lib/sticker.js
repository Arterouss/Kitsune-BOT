// lib/sticker.js - Pembuat dan Converter Stiker WhatsApp dengan EXIF Metadata
import fs from 'fs';
import path from 'path';
import os from 'os';
import ffmpeg from 'fluent-ffmpeg';
import webpmux from 'node-webpmux';

/**
 * Menambahkan EXIF metadata (Packname & Author) ke file WebP
 */
export async function addExif(webpBuffer, packname = 'Kyouka Sticker Pack', author = 'Bot WA') {
  try {
    const img = new webpmux.Image();
    await img.load(webpBuffer);

    const json = {
      'sticker-pack-id': 'com.kyouka.sticker.pack',
      'sticker-pack-name': packname,
      'sticker-pack-publisher': author,
      'emojis': ['✨', '🤖', '🎉']
    };

    const jsonBuff = Buffer.from(JSON.stringify(json), 'utf-8');
    const exifHeader = Buffer.from([0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00]);
    const lengthBuff = Buffer.alloc(4);
    lengthBuff.writeUInt32LE(jsonBuff.length);

    const exif = Buffer.concat([exifHeader, lengthBuff, Buffer.from([0x00, 0x00, 0x00, 0x00]), jsonBuff]);
    exif.writeUIntLE(jsonBuff.length, 14, 4);

    img.exif = exif;
    return await img.save(null);
  } catch (err) {
    console.error('Error saat menyematkan EXIF sticker:', err);
    return webpBuffer; // Kembalikan buffer asli jika gagal inject exif
  }
}

/**
 * Mengubah Buffer Gambar menjadi Stiker WebP
 */
export async function imageToSticker(imageBuffer, packname, author) {
  const tmpDir = os.tmpdir();
  const inputPath = path.join(tmpDir, `stk_in_${Date.now()}_${Math.random().toString(36).slice(2)}.tmp`);
  const outputPath = path.join(tmpDir, `stk_out_${Date.now()}_${Math.random().toString(36).slice(2)}.webp`);

  await fs.promises.writeFile(inputPath, imageBuffer);

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .addOutputOptions([
        '-vcodec', 'libwebp',
        '-vf', 'scale=512:512:flags=lanczos:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000,setsar=1'
      ])
      .toFormat('webp')
      .on('error', async (err) => {
        try { await fs.promises.unlink(inputPath); } catch {}
        try { await fs.promises.unlink(outputPath); } catch {}
        reject(err);
      })
      .on('end', async () => {
        try {
          const webpData = await fs.promises.readFile(outputPath);
          const finalSticker = await addExif(webpData, packname, author);
          await fs.promises.unlink(inputPath);
          await fs.promises.unlink(outputPath);
          resolve(finalSticker);
        } catch (err) {
          reject(err);
        }
      })
      .save(outputPath);
  });
}

/**
 * Mengubah Buffer Video/GIF menjadi Animated Stiker WebP (Maksimal 8 detik)
 */
export async function videoToSticker(videoBuffer, packname, author) {
  const tmpDir = os.tmpdir();
  const inputPath = path.join(tmpDir, `vid_in_${Date.now()}_${Math.random().toString(36).slice(2)}.tmp`);
  const outputPath = path.join(tmpDir, `vid_out_${Date.now()}_${Math.random().toString(36).slice(2)}.webp`);

  await fs.promises.writeFile(inputPath, videoBuffer);

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .inputOptions(['-t', '8']) // Batasi 8 detik
      .addOutputOptions([
        '-vcodec', 'libwebp',
        '-vf', 'scale=512:512:flags=lanczos:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000,setsar=1,fps=15',
        '-loop', '0',
        '-ss', '00:00:00',
        '-an',
        '-vsync', '0',
        '-s', '512:512'
      ])
      .toFormat('webp')
      .on('error', async (err) => {
        try { await fs.promises.unlink(inputPath); } catch {}
        try { await fs.promises.unlink(outputPath); } catch {}
        reject(err);
      })
      .on('end', async () => {
        try {
          const webpData = await fs.promises.readFile(outputPath);
          const finalSticker = await addExif(webpData, packname, author);
          await fs.promises.unlink(inputPath);
          await fs.promises.unlink(outputPath);
          resolve(finalSticker);
        } catch (err) {
          reject(err);
        }
      })
      .save(outputPath);
  });
}
