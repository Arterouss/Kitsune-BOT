// lib/ai.js - Modul Tanya Jawab AI Otomatis (Tanpa Wajib API Key)
import axios from 'axios';
import { config } from '../config.js';

/**
 * Tanya Jawab menggunakan AI (Gratis Otomatis, Tanpa Wajib API Key)
 */
export async function askAI(prompt) {
  // 1. Cek jika pengguna memasang API Key opsional (Groq / Gemini)
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

  // 2. Coba API AI Gratisan Seperti Semula (Pollinations - Langsung Pakai Tanpa Key)
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
  } catch (err) {
    // Jika server gratisan sedang sibuk/antrean, lanjut ke fallback cerdas
  }

  // 3. Fallback Cerdas: Pencarian Ensiklopedia Wikipedia (100% Gratis Tanpa Key)
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

  // 4. Respon ramah jika server gratisan sedang padat
  return 'Maaf kawan, server AI gratisan sedang sibuk antrean sejenak. Silakan coba kirim ulang pertanyaanmu beberapa saat lagi ya!';
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
