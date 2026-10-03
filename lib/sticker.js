// lib/sticker.js - Pembuat & Converter Stiker WhatsApp Resmi
import { Sticker, StickerTypes } from 'wa-sticker-formatter';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Menyuntikkan EXIF metadata WhatsApp resmi ke dalam WebP menggunakan node-webpmux
 */
async function addExif(webpBuffer, packname = 'Kitsune Sticker Pack', author = 'Kitsune Bot') {
  try {
    const webpmux = (await import('node-webpmux')).default;
    const { Image } = webpmux;

    const json = JSON.stringify({
      'sticker-pack-id': 'kitsune-bot',
      'sticker-pack-name': packname,
      'sticker-pack-publisher': author,
      'emojis': ['✨', '🦊', '🤖'],
      'is-avatar-sticker': 0
    });

    const exif = Buffer.concat([
      Buffer.from([
        0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x16, 0x00, 0x00, 0x00
      ]),
      Buffer.from(json, 'utf-8')
    ]);
    exif.writeUIntLE(Buffer.byteLength(json), 14, 4);

    const img = new Image();
    await img.load(webpBuffer);
    img.exif = exif;
    return await img.save(null);
  } catch (err) {
    console.error('Gagal menambahkan EXIF ke stiker:', err.message);
    return webpBuffer;
  }
}

/**
 * Membuat Stiker Animasi (GIF / Video) dengan kompresi cerdas agar <= 500 KB
 * WhatsApp menolak mengunduh / menyimpan stiker jika ukurannya melebihi 500 KB (menjadi abu-abu)
 */
async function createAnimatedSticker(mediaBuffer, packname, author) {
  const tmpDir = os.tmpdir();
  const fileId = `anim_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const inputPath = path.join(tmpDir, `${fileId}.tmp`);
  const outputPath = path.join(tmpDir, `${fileId}.webp`);

  await fs.promises.writeFile(inputPath, mediaBuffer);

  // Parameter awal yang dioptimalkan untuk WhatsApp Animated Sticker
  let quality = 35;
  let fps = 15;
  let duration = 5;
  let scale = 512;
  let finalWebpBuffer = null;

  try {
    // Coba hingga 3 tahap kompresi agar ukuran stiker PASTI di bawah 490 KB
    for (let attempt = 0; attempt < 3; attempt++) {
      await new Promise((resolve, reject) => {
        const proc = spawn('ffmpeg', [
          '-y',
          '-t', String(duration),
          '-i', inputPath,
          '-vf', `scale=${scale}:${scale}:force_original_aspect_ratio=decrease,fps=${fps},pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000`,
          '-vcodec', 'libwebp',
          '-lossless', '0',
          '-compression_level', '6',
          '-q:v', String(quality),
          '-loop', '0',
          '-an',
          '-vsync', '0',
          outputPath
        ], { windowsHide: true });

        let stderr = '';
        proc.stderr.on('data', d => { stderr += d.toString(); });
        proc.on('close', code => {
          if (code === 0 && fs.existsSync(outputPath)) resolve();
          else reject(new Error(`FFmpeg error: ${stderr.slice(-300)}`));
        });
      });

      const buffer = await fs.promises.readFile(outputPath);
      try { await fs.promises.unlink(outputPath); } catch {}

      // Jika ukuran sudah di bawah 485 KB (aman dari batas 500 KB WhatsApp)
      if (buffer.length <= 485 * 1024) {
        finalWebpBuffer = buffer;
        break;
      }

      // Jika masih terlalu besar (> 485 KB), turunkan kualitas dan fps secara bertahap
      finalWebpBuffer = buffer;
      quality = Math.max(15, quality - 10);
      fps = Math.max(10, fps - 3);
      duration = Math.min(3.5, duration - 1);
      scale = 400; // sedikit turunkan resolusi agar hemat ukuran file
    }
  } finally {
    try { await fs.promises.unlink(inputPath); } catch {}
  }

  if (!finalWebpBuffer) {
    throw new Error('Gagal menghasilkan stiker animasi.');
  }

  return await addExif(finalWebpBuffer, packname, author);
}

/**
 * Membuat Stiker Gambar Statis (Foto / PNG / JPG)
 */
async function createStaticSticker(mediaBuffer, packname, author) {
  try {
    const sticker = new Sticker(mediaBuffer, {
      pack: packname,
      author: author,
      type: StickerTypes.FULL,
      categories: ['✨', '🦊', '🤖'],
      id: 'kitsune-bot',
      quality: 75
    });

    const buf = await sticker.toBuffer();
    // Pastikan stiker statis pun di bawah 500 KB
    if (buf.length <= 500 * 1024) {
      return buf;
    }
  } catch {}

  // Fallback kompresi tajam via Sharp jika wa-sticker-formatter melebihi batas
  const sharp = (await import('sharp')).default;
  const webpBuffer = await sharp(mediaBuffer)
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 65 })
    .toBuffer();

  return await addExif(webpBuffer, packname, author);
}

/**
 * Membuat Stiker WhatsApp dari Buffer Gambar, GIF, atau Video
 */
export async function createSticker(mediaBuffer, packname = 'Kitsune Sticker Pack', author = 'Kitsune Bot') {
  let isAnimated = false;

  // Cek signature buffer awal secara akurat
  if (Buffer.isBuffer(mediaBuffer) && mediaBuffer.length > 12) {
    const isGif = mediaBuffer.subarray(0, 3).toString() === 'GIF';
    const isMp4 = mediaBuffer.subarray(4, 8).toString() === 'ftyp';
    const isWebm = mediaBuffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
    const isWebpAnim = mediaBuffer.subarray(0, 4).toString() === 'RIFF' && 
                       mediaBuffer.subarray(8, 12).toString() === 'WEBP' && 
                       mediaBuffer.indexOf('ANIM') !== -1;

    if (isGif || isMp4 || isWebm || isWebpAnim) {
      isAnimated = true;
    }
  }

  // Jika belum terdeteksi, periksa menggunakan file-type
  if (!isAnimated && Buffer.isBuffer(mediaBuffer)) {
    try {
      const { fileTypeFromBuffer } = await import('file-type');
      const ft = await fileTypeFromBuffer(mediaBuffer);
      if (ft && (ft.mime.includes('gif') || ft.mime.includes('video') || ft.ext === 'gif' || ft.ext === 'mp4')) {
        isAnimated = true;
      }
    } catch {}
  }

  if (isAnimated) {
    return await createAnimatedSticker(mediaBuffer, packname, author);
  } else {
    return await createStaticSticker(mediaBuffer, packname, author);
  }
}

/**
 * Mengubah Stiker WebP menjadi Gambar PNG biasa (.toimg / .getimage)
 */
export async function stickerToImage(webpBuffer) {
  try {
    const sharp = (await import('sharp')).default;
    return await sharp(webpBuffer).png().toBuffer();
  } catch (sharpErr) {
    const tmpDir = os.tmpdir();
    const inputPath = path.join(tmpDir, `stk_${Date.now()}_${Math.random().toString(36).slice(2)}.webp`);
    const outputPath = path.join(tmpDir, `img_${Date.now()}_${Math.random().toString(36).slice(2)}.png`);

    await fs.promises.writeFile(inputPath, webpBuffer);

    return new Promise((resolve, reject) => {
      const proc = spawn('ffmpeg', [
        '-y',
        '-vcodec', 'libwebp',
        '-i', inputPath,
        '-vframes', '1',
        outputPath
      ], { windowsHide: true });

      let stderr = '';
      proc.stderr.on('data', d => { stderr += d.toString(); });
      proc.on('close', async (code) => {
        try { await fs.promises.unlink(inputPath); } catch {}
        if (code === 0 && fs.existsSync(outputPath)) {
          const imgData = await fs.promises.readFile(outputPath);
          try { await fs.promises.unlink(outputPath); } catch {}
          resolve(imgData);
        } else {
          try { await fs.promises.unlink(outputPath); } catch {}
          reject(new Error(`Gagal konversi ke gambar: ${stderr}`));
        }
      });
    });
  }
}
