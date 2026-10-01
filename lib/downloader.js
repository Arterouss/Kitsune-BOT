// lib/downloader.js - Modul Download Lagu & Media menggunakan yt-dlp & Auto-Fallback
import { spawn } from 'child_process';
import path from 'path';
import os from 'os';
import fs from 'fs';

/**
 * Download lagu dari YouTube via yt-dlp
 */
async function downloadFromYouTube(query, isUrl, cookiePath) {
  let videoUrl = query;
  if (!isUrl) {
    videoUrl = `ytsearch1:${query}`;
  }

  const tmpDir = os.tmpdir();
  const fileId = `song_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const outputTemplate = path.join(tmpDir, `${fileId}.%(ext)s`);
  const finalMp3Path = path.join(tmpDir, `${fileId}.mp3`);

  const args = [
    '--js-runtimes', 'node',
    '--remote-components', 'ejs:github',
    '--extractor-args', 'youtube:player_client=android',
    '-x',
    '--audio-format', 'mp3',
    '--audio-quality', '192K',
    '--no-simulate',
    '--print', '%(title)s|%(uploader)s|%(duration_string)s|%(view_count)s|%(thumbnail)s',
    '-o', outputTemplate,
    '--no-playlist'
  ];

  if (cookiePath && fs.existsSync(cookiePath)) {
    args.push('--cookies', cookiePath);
  }

  args.push(videoUrl);

  const meta = await new Promise((resolve, reject) => {
    const proc = spawn('yt-dlp', args, { windowsHide: true });
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      const actualFile = fs.existsSync(finalMp3Path)
        ? finalMp3Path
        : fs.readdirSync(tmpDir).find(f => f.startsWith(fileId) && f.endsWith('.mp3'))
          ? path.join(tmpDir, fs.readdirSync(tmpDir).find(f => f.startsWith(fileId) && f.endsWith('.mp3')))
          : null;

      if (code === 0 && actualFile) {
        const metaLine = stdout.split(/\r?\n/).find(l => l.includes('|')) || '';
        resolve({ metaLine, filePath: actualFile });
      } else {
        reject(new Error(stderr.slice(-400) || stdout.slice(-400) || 'Gagal mengekstrak audio YouTube.'));
      }
    });
  });

  const [title, artist, duration, views, thumbnail] = (meta.metaLine || '').split('|');

  return {
    source: 'YouTube',
    title: title || 'Lagu YouTube',
    artist: artist || 'Unknown Artist',
    duration: duration || 'Unknown',
    views: views || 0,
    thumbnail: thumbnail || null,
    filePath: meta.filePath,
    cleanUp: async () => {
      try {
        if (fs.existsSync(meta.filePath)) {
          await fs.promises.unlink(meta.filePath);
        }
      } catch {}
    }
  };
}

/**
 * Fallback download lagu dari SoundCloud (bebas blokir bot cloud / tidak perlu cookies)
 */
export async function downloadFromSoundCloud(query) {
  const tmpDir = os.tmpdir();
  const fileId = `sc_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const outputTemplate = path.join(tmpDir, `${fileId}.%(ext)s`);
  const finalMp3Path = path.join(tmpDir, `${fileId}.mp3`);

  const args = [
    '-x',
    '--audio-format', 'mp3',
    '--audio-quality', '192K',
    '--no-simulate',
    '--print', '%(title)s|%(uploader)s|%(duration_string)s|%(thumbnail)s',
    '-o', outputTemplate,
    '--no-playlist',
    `scsearch1:${query}`
  ];

  const meta = await new Promise((resolve, reject) => {
    const proc = spawn('yt-dlp', args, { windowsHide: true });
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      const actualFile = fs.existsSync(finalMp3Path)
        ? finalMp3Path
        : fs.readdirSync(tmpDir).find(f => f.startsWith(fileId) && f.endsWith('.mp3'))
          ? path.join(tmpDir, fs.readdirSync(tmpDir).find(f => f.startsWith(fileId) && f.endsWith('.mp3')))
          : null;

      if (code === 0 && actualFile) {
        const metaLine = stdout.split(/\r?\n/).find(l => l.includes('|')) || '';
        resolve({ metaLine, filePath: actualFile });
      } else {
        reject(new Error(stderr.slice(-400) || stdout.slice(-400) || 'Gagal mendownload lagu via SoundCloud.'));
      }
    });
  });

  const [title, artist, duration, thumbnail] = (meta.metaLine || '').split('|');

  return {
    source: 'SoundCloud (Cloud Stream)',
    title: title || query,
    artist: artist || 'Artist',
    duration: duration || 'Unknown',
    views: 'N/A',
    thumbnail: thumbnail || null,
    filePath: meta.filePath,
    cleanUp: async () => {
      try {
        if (fs.existsSync(meta.filePath)) {
          await fs.promises.unlink(meta.filePath);
        }
      } catch {}
    }
  };
}

/**
 * Fungsi Utama Download Lagu dengan Auto-Fallback
 */
export async function downloadSong(query) {
  const isUrl = Boolean(query.match(/^https?:\/\//));
  const cookiePath = path.resolve('./cookies.txt');

  // 1. Coba download via YouTube
  try {
    return await downloadFromYouTube(query, isUrl, cookiePath);
  } catch (err) {
    const errMsg = err.message || '';
    const isBotOrCookieBlocked = errMsg.includes('cookies') || 
                                errMsg.includes('bot') || 
                                errMsg.includes('Sign in') || 
                                errMsg.includes('403') ||
                                errMsg.includes('Forbidden');

    // 2. Jika pencarian judul lagu dan terkena blokir bot YouTube di server cloud,
    // langsung alihkan otomatis ke SoundCloud agar user langsung dapat lagunya!
    if (!isUrl && isBotOrCookieBlocked) {
      console.log(`⚠️ YouTube memblokir cloud IP untuk query "${query}". Mengalihkan otomatis ke SoundCloud...`);
      return await downloadFromSoundCloud(query);
    }

    // 3. Jika berupa tautan link langsung dan diblokir karena cookies
    if (isUrl && isBotOrCookieBlocked) {
      throw new Error(
        'Server cloud Render diblokir oleh proteksi bot YouTube.\n' +
        'Silakan masukkan cookies YouTube di Render Environment Variable `YOUTUBE_COOKIES`, ' +
        'atau gunakan pencarian judul lagu (contoh: `.play judul lagu`).'
      );
    }

    throw err;
  }
}

/**
 * Download video TikTok tanpa watermark menggunakan yt-dlp
 */
export async function downloadTikTok(url) {
  const tmpDir = os.tmpdir();
  const fileId = `tiktok_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const finalMp4Path = path.join(tmpDir, `${fileId}.mp4`);

  const args = [
    '-f', 'best',
    '-o', finalMp4Path,
    url
  ];

  await new Promise((resolve, reject) => {
    const proc = spawn('yt-dlp', args, { windowsHide: true });
    let stderr = '';

    proc.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    proc.on('close', (code) => {
      if (code === 0 && fs.existsSync(finalMp4Path)) {
        resolve();
      } else {
        reject(new Error(`Gagal mendownload TikTok: ${stderr.slice(-300)}`));
      }
    });
  });

  return {
    filePath: finalMp4Path,
    cleanUp: async () => {
      try {
        if (fs.existsSync(finalMp4Path)) {
          await fs.promises.unlink(finalMp4Path);
        }
      } catch {}
    }
  };
}

/**
 * Download Video YouTube (MP4) resolusi hingga 720p
 */
export async function downloadYtVideo(url) {
  const tmpDir = os.tmpdir();
  const fileId = `ytvid_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const finalMp4Path = path.join(tmpDir, `${fileId}.mp4`);
  const cookiePath = path.resolve('./cookies.txt');

  const args = [
    '--js-runtimes', 'node',
    '--remote-components', 'ejs:github',
    '--extractor-args', 'youtube:player_client=android',
    '-f', '18/best[height<=720][ext=mp4]/best',
    '-o', finalMp4Path,
    '--no-playlist'
  ];

  if (fs.existsSync(cookiePath)) {
    args.push('--cookies', cookiePath);
  }

  args.push(url);

  await new Promise((resolve, reject) => {
    const proc = spawn('yt-dlp', args, { windowsHide: true });
    let stderr = '';

    proc.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    proc.on('close', (code) => {
      if (code === 0 && fs.existsSync(finalMp4Path)) {
        resolve();
      } else {
        const err = stderr.slice(-300);
        if (err.includes('cookies') || err.includes('bot') || err.includes('Sign in')) {
          reject(new Error('Server cloud Render terkena proteksi bot YouTube. Tambahkan `YOUTUBE_COOKIES` di Environment Variable Render untuk mendownload video YouTube langsung.'));
        } else {
          reject(new Error(`Gagal mendownload video YouTube: ${err}`));
        }
      }
    });
  });

  return {
    filePath: finalMp4Path,
    cleanUp: async () => {
      try {
        if (fs.existsSync(finalMp4Path)) {
          await fs.promises.unlink(finalMp4Path);
        }
      } catch {}
    }
  };
}
