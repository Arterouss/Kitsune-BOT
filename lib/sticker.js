// lib/sticker.js - Pembuat & Converter Stiker WhatsApp Resmi (1:1 Square Optimized)
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const MAX_STICKER_BYTES = 485 * 1024; // Batas aman di bawah limit 500 KB WhatsApp

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
 * Mendeteksi format media dan apakah bersifat animasi (GIF / Video / Animated WebP)
 */
async function detectMediaFormat(mediaBuffer) {
  let isAnimated = false;
  let isWebpAnim = false;
  let ext = 'tmp';

  if (Buffer.isBuffer(mediaBuffer) && mediaBuffer.length > 12) {
    const isGif = mediaBuffer.subarray(0, 3).toString() === 'GIF';
    const isMp4 = mediaBuffer.subarray(4, 8).toString() === 'ftyp';
    const isWebm = mediaBuffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
    const isWebp = mediaBuffer.subarray(0, 4).toString() === 'RIFF' &&
                   mediaBuffer.subarray(8, 12).toString() === 'WEBP';

    if (isGif) {
      isAnimated = true;
      ext = 'gif';
    } else if (isMp4) {
      isAnimated = true;
      ext = 'mp4';
    } else if (isWebm) {
      isAnimated = true;
      ext = 'webm';
    } else if (isWebp) {
      ext = 'webp';
      if (mediaBuffer.indexOf('ANIM') !== -1) {
        isAnimated = true;
        isWebpAnim = true;
      }
    }
  }

  if (ext === 'tmp' && Buffer.isBuffer(mediaBuffer)) {
    try {
      const { fileTypeFromBuffer } = await import('file-type');
      const ft = await fileTypeFromBuffer(mediaBuffer);
      if (ft) {
        ext = ft.ext || 'tmp';
        if (ft.mime.includes('gif') || ft.mime.includes('video') || ft.ext === 'gif' || ft.ext === 'mp4') {
          isAnimated = true;
        }
      }
    } catch {}
  }

  return { isAnimated, isWebpAnim, ext };
}

/**
 * Membangun filter FFmpeg untuk menghasilkan kanvas penuh 512x512 (rasio 1:1 kotak)
 * Secara default melakukan center-crop proporsional (tanpa gepeng/ruang kosong).
 * Mode 'full' menjaga seluruh bidang asli dengan padding transparan penuh 512x512.
 */
function buildAnimatedVideoFilter({ fps, renderSize, isFullMode }) {
  const filters = [
    `fps=${fps}`,
    // Normalisasi SAR (Sample Aspect Ratio) anamorfik ke 1:1 dan pastikan dimensi genap
    "scale='max(2,trunc(iw*if(gt(sar,0),sar,1)/2)*2)':'max(2,trunc(ih/2)*2)'",
    'setsar=1'
  ];

  if (isFullMode) {
    filters.push(
      `scale=${renderSize}:${renderSize}:force_original_aspect_ratio=decrease:flags=lanczos`,
      `pad=${renderSize}:${renderSize}:(ow-iw)/2:(oh-ih)/2:color=0x00000000`
    );
  } else {
    filters.push(
      `scale=${renderSize}:${renderSize}:force_original_aspect_ratio=increase:flags=lanczos`,
      `crop=${renderSize}:${renderSize}`
    );
  }

  // Pastikan ukuran akhir SELALU 512x512 penuh, meski preset kompresi berat menurunkan detail internal
  if (renderSize !== 512) {
    filters.push('scale=512:512:flags=bilinear');
  }

  filters.push('setsar=1', 'format=yuva420p');
  return filters.join(',');
}

/**
 * Mengompres & menyesuaikan ukuran Animated WebP via Sharp (FFmpeg tidak bisa decode WebP animasi)
 */
async function createAnimatedWebpWithSharp(mediaBuffer, fitMode, maxBytes) {
  const sharp = (await import('sharp')).default;
  const isFullMode = fitMode === 'full';
  const resizeOpts = isFullMode
    ? { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }
    : { fit: 'cover', position: 'centre' };

  const qualities = [55, 40, 28, 18, 12];
  let bestBuffer = null;

  for (const quality of qualities) {
    const buf = await sharp(mediaBuffer, { animated: true })
      .resize(512, 512, resizeOpts)
      .webp({ quality, effort: 4 })
      .toBuffer();

    if (!bestBuffer || buf.length < bestBuffer.length) {
      bestBuffer = buf;
    }
    if (buf.length <= maxBytes) {
      bestBuffer = buf;
      break;
    }
  }

  return bestBuffer;
}

/**
 * Membuat Stiker Animasi (GIF / Video / Animated WebP) ukuran pas 512x512 (1:1) & <= 485 KB
 */
async function createAnimatedSticker(mediaBuffer, packname, author, options = {}) {
  const fitMode = options.fitMode || 'crop';
  const isFullMode = fitMode === 'full';

  if (options.isWebpAnim) {
    const webpBuf = await createAnimatedWebpWithSharp(mediaBuffer, fitMode, MAX_STICKER_BYTES);
    return await addExif(webpBuf, packname, author);
  }

  const tmpDir = os.tmpdir();
  const fileId = `anim_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const ext = options.ext && options.ext !== 'tmp' ? options.ext : 'tmp';
  const inputPath = path.join(tmpDir, `${fileId}.${ext}`);
  const outputPath = path.join(tmpDir, `${fileId}.webp`);

  await fs.promises.writeFile(inputPath, mediaBuffer);

  // Preset kompresi bertahap: output selalu 512x512 penuh (tidak pernah mengecilkan konten di dalam bingkai)
  const presets = [
    { quality: 42, fps: 15, duration: 5, renderSize: 512 },
    { quality: 30, fps: 12, duration: 4, renderSize: 512 },
    { quality: 18, fps: 10, duration: 3, renderSize: 512 },
    { quality: 14, fps: 8, duration: 2.5, renderSize: 360 },
    { quality: 10, fps: 6, duration: 2, renderSize: 280 }
  ];

  let bestBuffer = null;

  try {
    for (const preset of presets) {
      const vf = buildAnimatedVideoFilter({
        fps: preset.fps,
        renderSize: preset.renderSize,
        isFullMode
      });

      await new Promise((resolve, reject) => {
        const proc = spawn('ffmpeg', [
          '-y',
          '-t', String(preset.duration),
          '-i', inputPath,
          '-vf', vf,
          '-vcodec', 'libwebp',
          '-lossless', '0',
          '-compression_level', '6',
          '-q:v', String(preset.quality),
          '-loop', '0',
          '-an',
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

      if (!bestBuffer || buffer.length < bestBuffer.length) {
        bestBuffer = buffer;
      }

      if (buffer.length <= MAX_STICKER_BYTES) {
        bestBuffer = buffer;
        break;
      }
    }
  } finally {
    try { await fs.promises.unlink(inputPath); } catch {}
    try { await fs.promises.unlink(outputPath); } catch {}
  }

  if (!bestBuffer) {
    throw new Error('Gagal menghasilkan stiker animasi.');
  }

  return await addExif(bestBuffer, packname, author);
}

/**
 * Membuat Stiker Gambar Statis (Foto / PNG / JPG) ukuran pas 512x512 (1:1)
 * PNG dengan latar transparan otomatis dijaga utuh kecuali dipaksa mode crop.
 */
async function createStaticSticker(mediaBuffer, packname, author, options = {}) {
  const fitMode = options.fitMode || 'crop';
  const sharp = (await import('sharp')).default;

  const meta = await sharp(mediaBuffer).rotate().metadata();
  let useContain = fitMode === 'full';

  if (!useContain && fitMode !== 'force_crop' && meta.hasAlpha) {
    try {
      const stats = await sharp(mediaBuffer).rotate().stats();
      const alphaChannel = stats.channels?.[3];
      // Anggap gambar cutout transparan jika lebih dari ~4% area bersifat transparan
      if (alphaChannel && alphaChannel.mean < 245) {
        useContain = true;
      }
    } catch {}
  }

  const resizeOpts = useContain
    ? { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }
    : { fit: 'cover', position: 'centre' };

  const qualities = [80, 65, 45, 25];
  let bestBuffer = null;

  for (const quality of qualities) {
    const buf = await sharp(mediaBuffer)
      .rotate()
      .resize(512, 512, resizeOpts)
      .webp({ quality })
      .toBuffer();

    if (!bestBuffer || buf.length < bestBuffer.length) {
      bestBuffer = buf;
    }
    if (buf.length <= MAX_STICKER_BYTES) {
      bestBuffer = buf;
      break;
    }
  }

  return await addExif(bestBuffer, packname, author);
}

/**
 * Mengganti watermark EXIF pada stiker WebP (statis maupun animasi) tanpa re-encode
 */
export async function setStickerWatermark(webpBuffer, packname = 'Kitsune Sticker Pack', author = 'Kitsune Bot') {
  const isWebp = Buffer.isBuffer(webpBuffer) &&
                 webpBuffer.length > 12 &&
                 webpBuffer.subarray(0, 4).toString() === 'RIFF' &&
                 webpBuffer.subarray(8, 12).toString() === 'WEBP';

  if (isWebp) {
    return await addExif(webpBuffer, packname, author);
  }
  return await createSticker(webpBuffer, packname, author);
}

/**
 * Membuat Stiker WhatsApp dari Buffer Gambar, GIF, atau Video
 */
export async function createSticker(mediaBuffer, packname = 'Kitsune Sticker Pack', author = 'Kitsune Bot', options = {}) {
  const { isAnimated, isWebpAnim, ext } = await detectMediaFormat(mediaBuffer);

  if (isAnimated) {
    return await createAnimatedSticker(mediaBuffer, packname, author, { ...options, isWebpAnim, ext });
  } else {
    return await createStaticSticker(mediaBuffer, packname, author, options);
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
