// plugins/media_tools.js - Plugin Alat Media & Konversi Tingkat Lanjut
import axios from 'axios';
import { stickerToImage } from '../lib/sticker.js';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import { askAI } from '../lib/ai.js';

async function downloadMedia(mediaMessage, mediaType) {
  const stream = await downloadContentFromMessage(mediaMessage, mediaType);
  let buffer = Buffer.from([]);
  for await (const chunk of stream) {
    buffer = Buffer.concat([buffer, chunk]);
  }
  return buffer;
}

// Helper kalkulator matematika aman
function calculateMath(expr) {
  if (!/^[\d\s\+\-\*\/\(\)\.\,\%\^]+$/.test(expr)) {
    throw new Error('Hanya mendukung angka dan operator +, -, *, /, %, ^, ()');
  }
  const sanitized = expr.replace(/\^/g, '**').replace(/,/g, '.');
  const res = new Function(`return (${sanitized});`)();
  if (typeof res !== 'number' || isNaN(res) || !isFinite(res)) {
    throw new Error('Hasil perhitungan tidak valid.');
  }
  return res;
}

export default {
  name: 'media_tools',
  command: ['toimg', 'tts', 'tr', 'translate', 'calc', 'kalkulator', 'short', 'shortlink'],
  category: 'tools',
  description: 'Alat media: stiker ke gambar, TTS Google (VN), terjemahan AI, kalkulator, & shortlink',
  async run({ sock, jid, msg, command, args, prefix, reply }) {
    // 1. STIKER KE GAMBAR (.toimg)
    if (command === 'toimg') {
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      if (!quoted?.stickerMessage) {
        return reply(`⚠️ Balas (quote) stiker yang ingin diubah menjadi gambar dengan mengetik *${prefix}${command}*`);
      }

      await reply('⏳ Mengonversi stiker ke gambar...');

      try {
        const buffer = await downloadMedia(quoted.stickerMessage, 'sticker');
        const imgBuffer = await stickerToImage(buffer);

        return await sock.sendMessage(jid, {
          image: imgBuffer,
          caption: '✅ *Berhasil mengubah stiker menjadi gambar!*'
        }, { quoted: msg });
      } catch (err) {
        console.error('Error toimg:', err);
        return reply('❌ Gagal mengubah stiker menjadi gambar.');
      }
    }

    // 2. TEXT TO SPEECH / SUARA GOOGLE (.tts <lang> <teks>)
    if (command === 'tts') {
      if (!args) {
        return reply(`⚠️ Masukkan kode bahasa dan teks!\nContoh:\n› *${prefix}${command} id Halo kawan-kawan*\n› *${prefix}${command} ja Konnichiwa*\n› *${prefix}${command} en Good morning everyone*`);
      }

      let [lang, ...textParts] = args.split(' ');
      let text = textParts.join(' ').trim();

      // Jika user tidak menulis kode bahasa, default ke Indonesia ('id')
      if (lang.length !== 2 && !text) {
        text = lang;
        lang = 'id';
      }

      if (!text) {
        return reply(`⚠️ Masukkan teks yang ingin dibacakan!\nContoh: *${prefix}${command} id Halo selamat siang*`);
      }

      await reply('🎙️ Mengubah teks menjadi suara Google...');

      try {
        const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${encodeURIComponent(lang)}&client=tw-ob&q=${encodeURIComponent(text.slice(0, 200))}`;
        const res = await axios.get(ttsUrl, {
          responseType: 'arraybuffer',
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        return await sock.sendMessage(jid, {
          audio: Buffer.from(res.data),
          mimetype: 'audio/mp4',
          ptt: true // Dikirim sebagai Voice Note WhatsApp
        }, { quoted: msg });
      } catch (err) {
        console.error('Error TTS:', err);
        return reply('❌ Gagal membuat suara audio TTS. Pastikan kode bahasa valid (id, en, ja, ko, dll).');
      }
    }

    // 3. TRANSLATE MULTI-BAHASA (.tr <lang> <teks>)
    if (['tr', 'translate'].includes(command)) {
      if (!args) {
        return reply(`⚠️ Masukkan bahasa tujuan dan teks!\nContoh:\n› *${prefix}${command} en Selamat pagi sahabat*\n› *${prefix}${command} id Good morning my friend*\n› *${prefix}${command} ja Terima kasih banyak*`);
      }

      const [targetLang, ...textParts] = args.split(' ');
      const textToTranslate = textParts.join(' ').trim();

      if (!textToTranslate) {
        return reply(`⚠️ Masukkan teks yang ingin diterjemahkan!\nContoh: *${prefix}${command} en Selamat malam*`);
      }

      await reply('🌐 Menerjemahkan bahasa...');

      try {
        const prompt = `Terjemahkan kalimat berikut secara akurat ke dalam bahasa dengan kode '${targetLang}': "${textToTranslate}". Berikan HANYA hasil terjemahannya saja tanpa penjelasan tambahan.`;
        const translated = await askAI(prompt);

        return reply(`🌐 *Hasil Terjemahan (${targetLang.toUpperCase()}):*\n\n"${translated}"`);
      } catch (err) {
        console.error('Error Translate:', err);
        return reply('❌ Gagal menerjemahkan teks.');
      }
    }

    // 4. KALKULATOR MATEMATIKA (.calc <rumus>)
    if (['calc', 'kalkulator'].includes(command)) {
      if (!args) {
        return reply(`⚠️ Masukkan rumus perhitungan matematika!\nContoh: *${prefix}${command} (1500 * 25) + 500 / 2*`);
      }

      try {
        const result = calculateMath(args);
        return reply(`🧮 *Hasil Perhitungan:*\n\`${args}\` = *${result.toLocaleString('id-ID')}*`);
      } catch (err) {
        return reply(`❌ ${err.message || 'Rumus tidak valid.'}`);
      }
    }

    // 5. SHORTEN URL (.short <link>)
    if (['short', 'shortlink'].includes(command)) {
      if (!args || !args.includes('http')) {
        return reply(`⚠️ Masukkan tautan/URL yang valid!\nContoh: *${prefix}${command} https://github.com/Arterouss/Kitsune-BOT*`);
      }

      await reply('⏳ Memendekkan tautan URL...');

      try {
        const res = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(args)}`);
        return reply(`🔗 *Tautan Pendek Berhasil Dibuat:*\n${res.data}`);
      } catch (err) {
        console.error('Error Shortlink:', err);
        return reply('❌ Gagal memendekkan tautan.');
      }
    }
  }
};
