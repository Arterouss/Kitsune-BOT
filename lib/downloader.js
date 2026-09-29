// lib/downloader.js - Modul Download Lagu & Media menggunakan yt-dlp & yt-search
import { spawn } from 'child_process';
import path from 'path';
import os from 'os';
import fs from 'fs';
import yts from 'yt-search';

/**
 * Mencari video di YouTube berdasarkan keyword
 */
export async function searchYouTube(query) {
  const result = await yts(query);
  if (!result || !result.videos || result.videos.length === 0) {
    throw new Error('Lagu atau video tidak ditemukan!');
  }
  return result.videos[0];
}

/**
 * Download lagu YouTube menjadi file audio MP3
 */
export async function downloadSong(query) {
  // 1. Cari video
  const video = await searchYouTube(query);
  
  if (video.seconds > 600) {
    throw new Error(`Durasi lagu terlalu panjang (${video.timestamp}). Maksimal 10 menit.`);
  }

  const tmpDir = os.tmpdir();
  const fileId = `song_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const outputTemplate = path.join(tmpDir, `${fileId}.%(ext)s`);
  const finalMp3Path = path.join(tmpDir, `${fileId}.mp3`);

  // 2. Jalankan yt-dlp untuk ekstrak audio MP3
  const args = [
    '-x',
    '--audio-format', 'mp3',
    '--audio-quality', '192K',
    '--extractor-args', 'youtube:player_client=android',
    '-o', outputTemplate,
    '--no-playlist',
    video.url
  ];

  await new Promise((resolve, reject) => {
    const proc = spawn('yt-dlp', args, { windowsHide: true });
    let stderr = '';

    proc.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    proc.on('close', (code) => {
      if (code === 0 && fs.existsSync(finalMp3Path)) {
        resolve();
      } else {
        reject(new Error(`Gagal mendownload audio: ${stderr.slice(-300)}`));
      }
    });
  });

  return {
    title: video.title,
    artist: video.author?.name || 'Unknown Artist',
    duration: video.timestamp,
    views: video.views,
    thumbnail: video.thumbnail,
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
    '--extractor-args', 'youtube:player_client=android',
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
