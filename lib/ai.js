// lib/ai.js - Modul Tanya Jawab AI Pintar & Wikipedia
import axios from 'axios';
import { config } from '../config.js';

/**
 * Tanya Jawab menggunakan AI (Groq, Gemini, OpenAI, atau Wikipedia fallback)
 */
export async function askAI(prompt) {
  const groqKey = process.env.GROQ_API_KEY || config.ai?.groqApiKey;
  const geminiKey = process.env.GEMINI_API_KEY || config.ai?.geminiApiKey;
  const openAiKey = process.env.OPENAI_API_KEY || config.ai?.openAiApiKey;

  // 1. Opsi Utama: Groq (Gratis, Sangat Cepat, Model Llama 3.3 70B)
  if (groqKey) {
    try {
      const res = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'Kamu adalah asisten AI WhatsApp bernama Kitsune Bot yang ramah, cerdas, solutif, dan berbahasa Indonesia santun.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1024
      }, {
        timeout: 15000,
        headers: {
          'Authorization': `Bearer ${groqKey}`,
          'Content-Type': 'application/json'
        }
      });

      const reply = res.data?.choices?.[0]?.message?.content;
      if (reply) return reply.trim();
    } catch (err) {
      console.error('Groq AI error:', err.response?.data || err.message);
    }
  }

  // 2. Opsi Kedua: Google Gemini (Gratis, 1500 request/hari)
  if (geminiKey) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
      const res = await axios.post(url, {
        contents: [{
          parts: [{ text: `Kamu adalah asisten pintar WhatsApp Kitsune Bot. Jawab pertanyaan berikut dalam bahasa Indonesia yang jelas:\n\n${prompt}` }]
        }]
      }, { timeout: 15000 });

      const reply = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (reply) return reply.trim();
    } catch (err) {
      console.error('Gemini AI error:', err.response?.data || err.message);
    }
  }

  // 3. Opsi Ketiga: OpenAI
  if (openAiKey) {
    try {
      const res = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Kamu adalah asisten pintar WhatsApp Kitsune Bot.' },
          { role: 'user', content: prompt }
        ]
      }, {
        timeout: 15000,
        headers: {
          'Authorization': `Bearer ${openAiKey}`,
          'Content-Type': 'application/json'
        }
      });

      const reply = res.data?.choices?.[0]?.message?.content;
      if (reply) return reply.trim();
    } catch (err) {
      console.error('OpenAI error:', err.response?.data || err.message);
    }
  }

  // 4. Fallback Cerdas: Pencarian Ensiklopedia Wikipedia (Tanpa Kunci API)
  try {
    const cleanQuery = prompt
      .replace(/^(siapa|apa itu|apakah|jelaskan|sejarah|arti|makna|maksud|tentang)\s+/i, '')
      .replace(/[?!.]+$/g, '')
      .trim();

    if (cleanQuery.length > 2) {
      const wiki = await searchWiki(cleanQuery);
      if (wiki && wiki.extract) {
        return `📖 *Berdasarkan Ensiklopedia (${wiki.title}):*\n\n${wiki.extract}\n\n🔗 _Sumber: ${wiki.url}_`;
      }
    }
  } catch (err) {}

  // 5. Panduan Praktis Jika Belum Memasang Kunci API
  return `🤖 *Kitsune AI Assistant*\n\nUntuk mengaktifkan respon percakapan AI tanpa batas dan super cepat (< 1 detik), Anda bisa memasang API Key gratis (100% bebas biaya tanpa kartu kredit):\n\n1. Kunjungi: *https://console.groq.com/keys*\n2. Login dengan akun Google & buat key gratis (awalan \`gsk_...\`)\n3. Tempel key tersebut di file \`config.js\` (bagian \`ai.groqApiKey\`) atau di Environment Variable Render (\`GROQ_API_KEY\`).\n\n_💡 Tips: Untuk pertanyaan wawasan, Anda juga bisa langsung gunakan perintah: \`.wiki <topik>\`!_`;
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
