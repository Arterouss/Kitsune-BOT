// plugins/ai.js - Plugin Tanya Jawab AI, Wikipedia & Manajemen API OpenAI Kustom
import {
  askAI,
  searchWiki,
  getAiConfig,
  saveAiConfig,
  resetAiConfig,
  testAiConnection,
  normalizeBaseUrl,
  maskApiKey
} from '../lib/ai.js';
import { config, isUserOwner, getOwnerNumbers } from '../config.js';

export default {
  name: 'ai',
  command: ['ai', 'chatgpt', 'ask', 'wiki', 'wikipedia', 'setai', 'setapi', 'aicfg', 'getai'],
  category: 'ai',
  description: 'Tanya jawab AI cerdas dan manajemen konfigurasi OpenAI via WhatsApp',
  async run({ sock, jid, msg, command, args, prefix, sender, isGroup, reply }) {
    
    // ============================================================
    // 1. MANAJEMEN PENGATURAN API OPENAI (KHUSUS OWNER)
    // ============================================================
    if (['setai', 'setapi', 'aicfg', 'getai'].includes(command)) {
      const isOwner = isUserOwner(sender, msg);

      if (!isOwner) {
        console.warn(`[AUTH DENIED] Sender "${sender}" ditolak mengakses ${prefix}${command}. Terdaftar:`, getOwnerNumbers());
        return reply('⛔ *AKSES DITOLAK:*\nPerintah pengaturan API AI hanya dapat diakses oleh Pemilik Bot (Owner) demi menjaga keamanan API Key.');
      }

      const rawInput = (args || '').trim();

      // Jika tanpa argumen atau meminta status, tampilkan konfigurasi saat ini
      if (!rawInput || rawInput.toLowerCase() === 'status') {
        const cfg = getAiConfig();
        const infoText = `
🤖 *[PENGATURAN API AI (OPENAI COMPATIBLE)]*

📡 *Status Provider:* ${cfg.enabled ? '🟢 AKTIF (Custom OpenAI)' : '⚪ NONAKTIF (Fallback Gratis)'}
🌐 *Base URL:* \`${normalizeBaseUrl(cfg.baseUrl)}\`
🧠 *Model:* \`${cfg.model || 'gpt-4o-mini'}\`
🔑 *API Key:* \`${maskApiKey(cfg.apiKey)}\`
🌡️ *Temperature:* \`${cfg.temperature ?? 0.7}\`
📝 *System Prompt:*
_${cfg.systemPrompt || '-'}_

━━━━━━━━━━━━━━━━━━━━━━━━
🛠️ *CARA EDIT DI WHATSAPP (TANPA EDIT KODE):*

1️⃣ *Ubah API Key:*
   › \`${prefix}setai key <api_key_kamu>\`
   _Contoh: \`${prefix}setai key sk-proj-123456789...\`_

2️⃣ *Ubah Base URL (OpenAI / Groq / OpenRouter / DeepSeek):*
   › \`${prefix}setai url <base_url>\`
   _Contoh OpenAI: \`${prefix}setai url https://api.openai.com/v1\`_
   _Contoh Groq: \`${prefix}setai url https://api.groq.com/openai/v1\`_
   _Contoh DeepSeek: \`${prefix}setai url https://api.deepseek.com/v1\`_
   _Contoh OpenRouter: \`${prefix}setai url https://openrouter.ai/api/v1\`_

3️⃣ *Ubah Model:*
   › \`${prefix}setai model <nama_model>\`
   _Contoh: \`${prefix}setai model gpt-4o-mini\` atau \`deepseek-chat\`_

4️⃣ *Ubah System Prompt / Kepribadian Bot:*
   › \`${prefix}setai prompt <instruksi_baru>\`

5️⃣ *Uji Coba Koneksi:*
   › \`${prefix}setai test\`

6️⃣ *Nyalakan / Matikan / Reset:*
   › \`${prefix}setai on\` / \`${prefix}setai off\`
   › \`${prefix}setai reset\`
`.trim();
        return reply(infoText);
      }

      const parts = rawInput.split(/ +/);
      let subCmd = parts[0].toLowerCase();
      let value = rawInput.slice(parts[0].length).trim();

      // Pintasan Pintar: Jika langsung mengetik sk-... otomatis simpan sebagai key
      if (rawInput.startsWith('sk-')) {
        subCmd = 'key';
        value = rawInput;
      }

      // Pintasan Pintar: Jika format .setai <url> <key> [model]
      if (parts[0].startsWith('http://') || parts[0].startsWith('https://')) {
        const customUrl = normalizeBaseUrl(parts[0]);
        const customKey = parts[1];
        const customModel = parts[2] || 'gpt-4o-mini';

        if (customKey) {
          if (isGroup) {
            await sock.sendMessage(jid, { delete: msg.key }).catch(() => {});
          }
          await saveAiConfig({
            baseUrl: customUrl,
            apiKey: customKey.trim(),
            model: customModel.trim(),
            enabled: true
          });
          return reply(
            `✅ *Konfigurasi AI Berhasil Disimpan!*\n\n` +
            `🌐 *Base URL:* \`${customUrl}\`\n` +
            `🔑 *API Key:* \`${maskApiKey(customKey)}\`\n` +
            `🧠 *Model:* \`${customModel}\`\n` +
            `📡 *Status:* 🟢 AKTIF\n\n` +
            `_Ketik *${prefix}setai test* untuk menguji koneksi._`
          );
        }
      }

      // Subcommand: KEY
      if (['key', 'apikey', 'kunci'].includes(subCmd)) {
        if (!value) {
          return reply(`⚠️ Masukkan API Key baru Anda!\nContoh: *${prefix}setai key sk-proj-xxxx...*`);
        }
        // Hapus pesan pengirim di grup agar API Key tidak terbaca anggota grup lain
        if (isGroup) {
          await sock.sendMessage(jid, { delete: msg.key }).catch(() => {});
        }
        await saveAiConfig({ apiKey: value.trim(), enabled: true });
        return reply(
          `✅ *API Key OpenAI Berhasil Disimpan!*\n\n` +
          `🔑 *Key:* \`${maskApiKey(value.trim())}\`\n` +
          `📡 *Status:* 🟢 Diaktifkan otomatis!\n\n` +
          (isGroup ? `🔒 _Pesan berisi API Key telah otomatis dihapus dari grup demi keamanan._\n\n` : '') +
          `_Ketik *${prefix}setai test* untuk menguji koneksi._`
        );
      }

      // Subcommand: URL / BASEURL
      if (['url', 'baseurl', 'base', 'endpoint'].includes(subCmd)) {
        if (!value) {
          return reply(
            `⚠️ Masukkan Base URL API baru!\nContoh:\n` +
            `• *${prefix}setai url https://api.openai.com/v1*\n` +
            `• *${prefix}setai url https://api.groq.com/openai/v1*\n` +
            `• *${prefix}setai url https://api.deepseek.com/v1*`
          );
        }
        const cleanUrl = normalizeBaseUrl(value.trim());
        await saveAiConfig({ baseUrl: cleanUrl });
        return reply(
          `✅ *Base URL API Berhasil Diperbarui!*\n\n` +
          `🌐 *Base URL:* \`${cleanUrl}\`\n\n` +
          `_Ketik *${prefix}setai test* untuk menguji koneksi._`
        );
      }

      // Subcommand: MODEL
      if (['model', 'tipe'].includes(subCmd)) {
        if (!value) {
          return reply(`⚠️ Masukkan nama model baru!\nContoh: *${prefix}setai model gpt-4o-mini* atau *${prefix}setai model deepseek-chat*`);
        }
        await saveAiConfig({ model: value.trim() });
        return reply(`✅ *Model AI Berhasil Diperbarui!*\n\n🧠 *Model Aktif:* \`${value.trim()}\``);
      }

      // Subcommand: PROMPT / SYSTEM
      if (['prompt', 'system', 'instruksi'].includes(subCmd)) {
        if (!value) {
          return reply(`⚠️ Masukkan instruksi system prompt baru!\nContoh: *${prefix}setai prompt Kamu adalah asisten ramah...*`);
        }
        await saveAiConfig({ systemPrompt: value.trim() });
        return reply(`✅ *System Prompt Berhasil Diperbarui!*\n\n📝 *Prompt Baru:*\n_${value.trim()}_`);
      }

      // Subcommand: ON / OFF
      if (subCmd === 'on' || subCmd === 'enable') {
        await saveAiConfig({ enabled: true });
        return reply(`🟢 *Custom OpenAI Provider Diaktifkan!*\nBot sekarang akan memproses perintah *.ai* menggunakan OpenAI API yang Anda atur.`);
      }

      if (subCmd === 'off' || subCmd === 'disable') {
        await saveAiConfig({ enabled: false });
        return reply(`⚪ *Custom OpenAI Provider Dinonaktifkan!*\nBot akan beralih ke provider default (Groq / Pollinations / Wikipedia).`);
      }

      // Subcommand: RESET
      if (subCmd === 'reset') {
        await resetAiConfig();
        return reply(`🔄 *Konfigurasi AI telah berhasil di-reset ke default awal.*`);
      }

      // Subcommand: TEST / CEK
      if (['test', 'cek', 'ping'].includes(subCmd)) {
        await reply('⏳ Menguji koneksi ke endpoint OpenAI... Mohon tunggu sejenak.');
        try {
          const testRes = await testAiConnection();
          return reply(
            `✅ *TES KONEKSI AI BERHASIL!* 🚀\n\n` +
            `⏱️ *Kecepatan Respon:* ${testRes.latency} ms\n` +
            `🌐 *Base URL:* \`${testRes.baseUrl}\`\n` +
            `🧠 *Model:* \`${testRes.model}\`\n\n` +
            `🤖 *Balasan Uji:* "${testRes.reply}"`
          );
        } catch (testErr) {
          return reply(
            `❌ *TES KONEKSI AI GAGAL!*\n\n` +
            `⚠️ *Detail Error:* ${testErr.message}\n\n` +
            `💡 *Saran Pemeriksaan:*\n` +
            `1. Periksa apakah API Key benar & memiliki saldo/kuota aktif.\n` +
            `2. Periksa apakah Base URL dapat diakses (contoh: https://api.openai.com/v1).\n` +
            `3. Pastikan nama model sesuai dengan provider yang digunakan.`
          );
        }
      }

      return reply(`⚠️ Perintah sub tidak dikenali! Ketik *${prefix}setai* untuk melihat panduan lengkap.`);
    }

    // ============================================================
    // 2. PERINTAH TANYA AI (.ai / .chatgpt / .ask)
    // ============================================================
    if (['ai', 'chatgpt', 'ask'].includes(command)) {
      if (!args) {
        return reply(`⚠️ Mau tanya apa ke AI?\nContoh: *${prefix}${command} Jelaskan apa itu kecerdasan buatan*`);
      }

      await reply('🤔 AI sedang berpikir...');

      try {
        const aiResponse = await askAI(args);
        await reply(`🤖 *Jawaban AI:*\n\n${aiResponse}`);
      } catch (err) {
        console.error('Error saat tanya AI:', err);
        await reply(`❌ ${err.message || 'Terjadi kesalahan pada server AI.'}`);
      }
      return;
    }

    // ============================================================
    // 3. PERINTAH WIKIPEDIA (.wiki / .wikipedia)
    // ============================================================
    if (['wiki', 'wikipedia'].includes(command)) {
      if (!args) {
        return reply(`⚠️ Masukkan kata kunci pencarian!\nContoh: *${prefix}${command} Albert Einstein*`);
      }

      try {
        const wiki = await searchWiki(args);
        const wikiText = `
📚 *${wiki.title}*
_${wiki.description}_

${wiki.extract}

🔗 *Baca selengkapnya:*
${wiki.url}
`.trim();
        await reply(wikiText);
      } catch (err) {
        await reply(`❌ ${err.message}`);
      }
      return;
    }
  }
};
