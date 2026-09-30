// lib/downloader.js - Modul Download Lagu & Media menggunakan yt-dlp & yt-search
import { spawn } from 'child_process';
import path from 'path';
import os from 'os';
import fs from 'fs';
import yts from 'yt-search';

export async function downloadSong(query) {
  let videoUrl = query;
  if (!query.match(/^https?:\/\//)) {
    videoUrl = `ytsearch1:${query}`;
  }

  const tmpDir = os.tmpdir();
  const fileId = `song_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const outputTemplate = path.join(tmpDir, `${fileId}.%(ext)s`);
  const finalMp3Path = path.join(tmpDir, `${fileId}.mp3`);

  // Jalankan yt-dlp untuk ekstrak audio MP3 dan dapatkan metadata
  const args = [
    '-x',
    '--audio-format', 'mp3',
    '--audio-quality', '192K',
    '--extractor-args', 'youtube:player_client=android,web',
    '--print', '%(title)s|%(uploader)s|%(duration_string)s|%(view_count)s|%(thumbnail)s',
    '-o', outputTemplate,
    '--no-playlist',
    videoUrl
  ];

  const meta = await new Promise((resolve, reject) => {
    const proc = spawn('yt-dlp', args, { windowsHide: true });
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => {
      stdout += d.toString();
    });

    proc.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    proc.on('close', (code) => {
      if (code === 0 && fs.existsSync(finalMp3Path)) {
        // stdout berisi metadata karena flag --print
        resolve(stdout.trim().split('\\n').pop());
      } else {
        reject(new Error(`Gagal mendownload audio: ${stderr.slice(-300)}`));
      }
    });
  });

  const [title, artist, duration, views, thumbnail] = (meta || '').split('|');

  return {
    title: title || 'Lagu YouTube',
    artist: artist || 'Unknown Artist',
    duration: duration || 'Unknown',
    views: views || 0,
    thumbnail: thumbnail || null,
    filePath: finalMp3Path,
    cleanUp: async () => {
      try {
        if (fs.existsSync(finalMp3Path)) {
          await fs.promises.unlink(finalMp3Path);
        }
      } catch {}
    }
  };
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

  const args = [
    '-f', 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best',
    '--extractor-args', 'youtube:player_client=android,web',
    '-o', finalMp4Path,
    '--no-playlist',
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
        reject(new Error(`Gagal mendownload video YouTube: ${stderr.slice(-300)}`));
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
