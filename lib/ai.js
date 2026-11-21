// lib/ai.js - Modul Tanya Jawab AI Dinamis (OpenAI Compatible + Groq + Fallback)
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { config } from '../config.js';
import { getMongoDb } from './rpg.js';

const CONFIG_DIR = path.resolve('./database');
const CONFIG_FILE = path.join(CONFIG_DIR, 'ai_config.json');

// Pastikan direktori database ada
if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

export const DEFAULT_AI_CONFIG = {
  enabled: true,
  provider: 'openai',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o-mini',
  systemPrompt: 'Kamu adalah asisten pintar WhatsApp Kitsune Bot yang ramah, informatif, dan berbahasa Indonesia santun.',
  temperature: 0.7,
  maxTokens: null
};

let cachedAiConfig = null;

/**
 * Normalisasi URL Base API (Menghapus trailing slash & menambahkan /v1 jika belum ada pada domain standar)
 */
export function normalizeBaseUrl(rawUrl) {
  if (!rawUrl) return 'https://api.openai.com/v1';
  let url = String(rawUrl).trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  try {
    const parsed = new URL(url);
    if (parsed.pathname === '' || parsed.pathname === '/') {
      url = `${url}/v1`;
    }
  } catch {}
  return url;
}

/**
 * Sensor/Masking API Key untuk keamanan tampilan chat
 */
export function maskApiKey(key) {
  if (!key) return '(Belum diatur)';
  const clean = String(key).trim();
  if (clean.length <= 8) return '********';
  return `${clean.slice(0, 7)}...${clean.slice(-4)}`;
}

/**
 * Membaca konfigurasi AI aktif dari cache memori, file lokal, atau fallback env
 */
export function getAiConfig() {
  if (cachedAiConfig) return cachedAiConfig;

  let loaded = null;
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
      loaded = JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error membaca database/ai_config.json:', err.message);
  }

  if (!loaded) {
    const envKey = process.env.OPENAI_API_KEY || '';
    const envUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    const envModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    loaded = {
      ...DEFAULT_AI_CONFIG,
      apiKey: envKey,
      baseUrl: envUrl,
      model: envModel,
      enabled: Boolean(envKey)
    };
  } else {
    loaded = { ...DEFAULT_AI_CONFIG, ...loaded };
  }

  cachedAiConfig = loaded;
  return cachedAiConfig;
}

/**
 * Sinkronisasi konfigurasi AI dari MongoDB Atlas saat cloud tersedia
 */
export async function syncAiConfigFromMongo() {
  try {
    const db = getMongoDb();
    if (!db) return;
    const doc = await db.collection('bot_settings').findOne({ _id: 'ai_config' });
    if (doc) {
      const { _id, ...mongoData } = doc;
      cachedAiConfig = { ...DEFAULT_AI_CONFIG, ...mongoData };
      if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
      }
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(cachedAiConfig, null, 2), 'utf-8');
      console.log('🤖 [AI CONFIG] Berhasil memuat konfigurasi OpenAI dari MongoDB Atlas!');
    }
  } catch (err) {
    console.warn('⚠️ [AI CONFIG] Gagal sinkronisasi dari Mongo:', err.message);
  }
}

/**
 * Menyimpan konfigurasi AI baru ke cache, disk lokal, dan MongoDB Atlas
 */
export async function saveAiConfig(newConfig) {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }

  const current = getAiConfig();
  const updated = {
    ...current,
    ...newConfig,
    updatedAt: new Date().toISOString()
  };

  cachedAiConfig = updated;
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf-8');

  // Simpan juga ke MongoDB Atlas jika terhubung
  try {
    const db = getMongoDb();
    if (db) {
      await db.collection('bot_settings').updateOne(
        { _id: 'ai_config' },
        { $set: { ...updated, _id: 'ai_config' } },
        { upsert: true }
      );
    }
  } catch (err) {
    console.warn('⚠️ [AI CONFIG] Gagal menyimpan ke Mongo:', err.message);
  }

  return updated;
}

/**
 * Mengembalikan konfigurasi AI ke default bawaan
 */
export async function resetAiConfig() {
  return await saveAiConfig({
    enabled: false,
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    systemPrompt: DEFAULT_AI_CONFIG.systemPrompt,
    temperature: 0.7,
    maxTokens: null
  });
}

/**
 * Uji coba koneksi langsung ke provider OpenAI yang dikonfigurasi
 */
export async function testAiConnection() {
  const cfg = getAiConfig();
  if (!cfg.apiKey) {
    throw new Error('API Key belum diatur! Gunakan perintah: *.setai key <api_key>*');
  }

  const startTime = Date.now();
  const reply = await askAI('Tes koneksi bot. Balas singkat "Koneksi AI OpenAI Berhasil!".', { isTest: true });
  const latency = Date.now() - startTime;

  return {
    success: true,
    latency,
    reply,
    baseUrl: normalizeBaseUrl(cfg.baseUrl),
    model: cfg.model
  };
}

/**
 * Tanya Jawab menggunakan AI (OpenAI Compatible -> Groq -> Pollinations -> Wikipedia)
 */
export async function askAI(prompt, options = {}) {
  const customAi = getAiConfig();

  // 1. PRIORITAS 1: Gunakan Custom OpenAI API jika apiKey terpasang & enabled
  if (customAi && customAi.enabled && customAi.apiKey) {
    try {
      const baseUrl = normalizeBaseUrl(customAi.baseUrl);
      const endpoint = `${baseUrl}/chat/completions`;
      const model = customAi.model || 'gpt-4o-mini';
      const systemPrompt = customAi.systemPrompt || DEFAULT_AI_CONFIG.systemPrompt;

      const payload = {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: customAi.temperature ?? 0.7
      };
      if (customAi.maxTokens) {
        payload.max_tokens = customAi.maxTokens;
      }

      const res = await axios.post(endpoint, payload, {
        timeout: 30000,
        headers: {
          'Authorization': `Bearer ${customAi.apiKey.trim()}`,
          'Content-Type': 'application/json'
        }
      });

      const reply = res.data?.choices?.[0]?.message?.content;
      if (reply && typeof reply === 'string' && reply.trim()) {
        return reply.trim();
      }
    } catch (err) {
      console.error('❌ [CUSTOM AI ERROR]:', err?.response?.data || err.message);

      if (options.isTest) {
        const detail = err?.response?.data?.error?.message || err?.response?.statusText || err.message;
        throw new Error(`OpenAI API Error (${err?.response?.status || 'Network'}): ${detail}`);
      }

      if (err?.response?.status === 401) {
        return '❌ *Gagal menghubungi AI:* API Key tidak valid atau salah. Silakan periksa kembali melalui *.setai key <api_key>*.';
      } else if (err?.response?.status === 429) {
        return '⚠️ *Kuota AI Habis:* Kuota atau rate-limit API Key Anda telah habis.';
      } else if (err?.response?.status === 404) {
        return `❌ *Model / Endpoint Tidak Ditemukan:* Periksa kembali nama model (*.setai model*) atau Base URL (*.setai url*).`;
      }
      // Untuk error koneksi sementara, bot lanjut ke fallback di bawah
    }
  }

  // 2. PRIORITAS 2: Cek Kunci API Groq bawaan di Environment (jika ada)
  const groqKey = process.env.GROQ_API_KEY || config.ai?.groqApiKey;
  if (groqKey) {
    try {
      const res = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'Kamu adalah asisten pintar WhatsApp Kitsune Bot yang ramah dan berbahasa Indonesia santun.' },
          { role: 'user', content: prompt }
        ]
      }, {
        timeout: 10000,
        headers: { 'Authorization': `Bearer ${groqKey}`, 'Content-Type': 'application/json' }
      });
      const reply = res.data?.choices?.[0]?.message?.content;
      if (reply) return reply.trim();
    } catch {}
  }

  // 3. PRIORITAS 3: Coba API AI Publik Gratisan (Pollinations)
  try {
    const encoded = encodeURIComponent(prompt);
    const res = await axios.get(`https://text.pollinations.ai/${encoded}`, {
      timeout: 12000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });
    if (res.data && typeof res.data === 'string' && res.data.trim()) {
      return res.data.trim();
    }
  } catch (err) {}

  // 4. PRIORITAS 4: Fallback Cerdas Ensiklopedia Wikipedia
  try {
    const cleanQuery = prompt
      .replace(/^(siapa|apa itu|apakah|jelaskan|sejarah|arti|makna|maksud|tentang|tahu gak)\s+/i, '')
      .replace(/[?!.]+$/g, '')
      .trim();

    if (cleanQuery.length > 2) {
      const wiki = await searchWiki(cleanQuery);
      if (wiki && wiki.extract) {
        return `📖 *Berdasarkan Ensiklopedia (${wiki.title}):*\n\n${wiki.extract}`;
      }
    }
  } catch (err) {}

  return 'Maaf kawan, server AI sedang sibuk. Silakan coba kirim ulang pertanyaanmu beberapa saat lagi!';
}

/**
 * Mencari penjelasan atau artikel dari Wikipedia Indonesia
 */
export async function searchWiki(query) {
  try {
    const url = `https://id.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
    const res = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'KitsuneBot/1.0 (https://github.com/Arterouss/Kitsune-BOT; arterouss@gmail.com)'
      }
    });

    const data = res.data;
    if (!data.extract) {
      throw new Error('Informasi tidak ditemukan di Wikipedia.');
    }

    return {
      title: data.title,
      description: data.description || 'Artikel Wikipedia',
      extract: data.extract,
      url: data.content_urls?.desktop?.page || `https://id.wikipedia.org/wiki/${encodeURIComponent(query)}`
    };
  } catch (err) {
    if (err.response && err.response.status === 404) {
      throw new Error(`Informasi mengenai "${query}" tidak ditemukan di Wikipedia.`);
    }
    throw new Error('Gagal mengambil data dari Wikipedia.');
  }
}
