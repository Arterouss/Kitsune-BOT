// lib/ai.js - Modul Tanya Jawab AI & Wikipedia
import axios from 'axios';

/**
 * Tanya Jawab menggunakan AI (ChatGPT / Pollinations)
 */
export async function askAI(prompt) {
  try {
    const encodedPrompt = encodeURIComponent(prompt);
    const response = await axios.get(`https://text.pollinations.ai/${encodedPrompt}`, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });

    if (response.data && typeof response.data === 'string') {
      return response.data.trim();
    }
    throw new Error('Respon AI kosong');
  } catch (err) {
    console.error('Error saat memanggil AI:', err.message);
    throw new Error('Maaf, server AI sedang sibuk atau tidak merespons. Silakan coba lagi sebentar lagi.');
  }
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
        'User-Agent': 'KyoukaBot/1.0 (contact: botwa@gmail.com)'
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
