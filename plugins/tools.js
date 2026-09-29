// plugins/tools.js - Plugin Utilitas dan Alat Bantu
import os from 'os';
import { config } from '../config.js';

export default {
  name: 'tools',
  command: ['qr', 'qrcode', 'ping', 'speed', 'owner'],
  category: 'tools',
  description: 'Generator QR Code, cek status server, dan kontak pemilik',
  async run({ sock, jid, msg, command, args, prefix, reply }) {
    // 1. QR Code Generator
    if (['qr', 'qrcode'].includes(command)) {
      if (!args) {
        return reply(`⚠️ Masukkan teks atau tautan yang ingin dijadikan QR Code!\nContoh: *${prefix}${command} https://google.com*`);
      }

      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&margin=10&data=${encodeURIComponent(args)}`;
      return await sock.sendMessage(jid, {
        image: { url: qrUrl },
        caption: `✅ *QR Code Berhasil Dibuat!*\nKonten: _${args}_`
      }, { quoted: msg });
    }

    // 2. Ping / Speed Check
    if (['ping', 'speed'].includes(command)) {
      const start = Date.now();
      const ramUsed = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
      const ramTotal = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
      const freeRam = (os.freemem() / 1024 / 1024 / 1024).toFixed(2);
      const latency = Date.now() - start;

      const pingText = `
🏓 *Pong!*
⚡ *Kecepatan Respon:* ${latency} ms
💻 *Sistem:* ${os.type()} (${os.arch()})
🧠 *Penggunaan RAM:* ${ramUsed} MB / ${ramTotal} GB (Sisa: ${freeRam} GB)
`.trim();
      return reply(pingText);
    }

    // 3. Owner Info
    if (command === 'owner') {
      const ownerText = `
👑 *Kontak Pemilik & Developer:*
Nama: *${config.ownerName}*
WhatsApp: https://wa.me/${config.ownerNumber.replace(/[^0-9]/g, '')}
GitHub: ${config.github}
`.trim();
      return reply(ownerText);
    }
  }
};
