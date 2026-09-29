// handler.js - Dynamic Plugin Loader & Message Dispatcher
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { config } from './config.js';

// Koleksi Plugin dan Cooldown
export const plugins = [];
const cooldownMap = new Map();
const startTime = Date.now();
const pluginDir = path.resolve('./plugins');

/**
 * Memuat semua file plugin secara dinamis dari folder ./plugins
 */
export async function loadPlugins() {
  plugins.length = 0; // Bersihkan array jika reload
  if (!fs.existsSync(pluginDir)) {
    fs.mkdirSync(pluginDir, { recursive: true });
  }

  const files = fs.readdirSync(pluginDir).filter((f) => f.endsWith('.js'));
  for (const file of files) {
    try {
      const fullPath = path.join(pluginDir, file);
      // Gunakan timestamp query agar bisa di-hot reload tanpa restart
      const fileUrl = `${pathToFileURL(fullPath).href}?v=${Date.now()}`;
      const mod = await import(fileUrl);
      if (mod.default && Array.isArray(mod.default.command)) {
        plugins.push(mod.default);
      }
    } catch (err) {
      console.error(`❌ Gagal memuat plugin "${file}":`, err.message);
    }
  }
  console.log(`🧩 [PLUGIN SYSTEM] Berhasil memuat ${plugins.length} plugin modular.`);
}

// Inisialisasi awal saat file diimport
await loadPlugins();

/**
 * Jeda waktu alami (delay)
 */
// Cache Pesan & Cooldown untuk Anti-Spam & Anti-Duplikasi
const processedMessageIds = new Set();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Handler utama untuk semua pesan masuk dari WhatsApp
 */
export async function messageHandler(sock, msg) {
  try {
    if (!msg.message) return;
    if (msg.key && msg.key.remoteJid === 'status@broadcast') return; // Abaikan story

    // Cegah duplikasi pesan (Deduplikasi ID)
    const msgId = msg.key?.id;
    if (msgId) {
      if (processedMessageIds.has(msgId)) return;
      processedMessageIds.add(msgId);
      if (processedMessageIds.size > 2000) {
        const oldest = processedMessageIds.values().next().value;
        processedMessageIds.delete(oldest);
      }
    }

    const jid = msg.key.remoteJid;
    const isGroup = jid.endsWith('@g.us');
    const sender = isGroup ? (msg.key.participant || msg.participant) : jid;
    const senderName = msg.pushName || 'Sahabat';

    // Ekstrak teks pesan
    const msgType = Object.keys(msg.message)[0];
    let body = '';

    if (msgType === 'conversation') {
      body = msg.message.conversation;
    } else if (msgType === 'imageMessage') {
      body = msg.message.imageMessage.caption || '';
    } else if (msgType === 'videoMessage') {
      body = msg.message.videoMessage.caption || '';
    } else if (msgType === 'extendedTextMessage') {
      body = msg.message.extendedTextMessage.text || '';
    }

    body = body.trim();
    if (!body) return;

    // 1. PROTEKSI KEAMANAN: Anti-Virtex & Crash Text
    // Mengabaikan pesan lebih dari 3000 karakter untuk mencegah lag / bug WhatsApp
    if (body.length > 3000) {
      console.log(`🛡️ [ANTI-VIRTEX] Pesan mencurigakan dari ${sender} diblokir (Panjang: ${body.length} karakter).`);
      return;
    }

    // Cek apakah pesan diawali prefix perintah yang valid
    const prefix = config.prefixes.find((p) => body.startsWith(p));
    if (!prefix) return; // HANYA BALAS JIKA PERINTAH VALID (Anti-Banned)

    const command = body.slice(prefix.length).trim().split(/ +/)[0].toLowerCase();
    const args = body.slice(prefix.length + command.length).trim();

    // 1. KEAMANAN ANTI-BANNED: Anti-Spam Cooldown per pengguna
    const now = Date.now();
    const lastTime = cooldownMap.get(sender) || 0;
    if (now - lastTime < config.security.cooldownMs) {
      console.log(`[SPAM BLOCKED] Mengabaikan spam cepat dari ${sender}`);
      return;
    }
    cooldownMap.set(sender, now);

    // Cari plugin yang memiliki command yang diminta
    const matchedPlugin = plugins.find((p) => p.command.includes(command));
    if (!matchedPlugin) return; // Jika bukan command terdaftar, abaikan

    // 2. KEAMANAN ANTI-BANNED: Simulasi Mengetik Alami
    if (config.security.simulateTyping) {
      await sock.sendPresenceUpdate('composing', jid);
      await sleep(config.security.typingDelayMs);
    }

    console.log(`[COMMAND] ${prefix}${command} | Pengirim: ${senderName}`);

    // Helper kirim balasan pesan
    const reply = async (text) => {
      return await sock.sendMessage(jid, { text }, { quoted: msg });
    };

    // Jalankan Plugin
    try {
      await matchedPlugin.run({
        sock,
        jid,
        msg,
        command,
        args,
        prefix,
        sender,
        senderName,
        isGroup,
        reply,
        plugins,
        startTime,
        loadPlugins
      });
    } catch (pluginErr) {
      console.error(`Error saat mengeksekusi plugin "${matchedPlugin.name}":`, pluginErr);
      await reply(`❌ Terjadi error pada fitur *${command}*. Silakan coba lagi.`);
    }

  } catch (err) {
    console.error('Error di messageHandler:', err);
  }
}
