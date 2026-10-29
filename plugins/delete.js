// plugins/delete.js - Menghapus Pesan WhatsApp (Delete / Hapus Chat)
import { config } from '../config.js';

export default {
  name: 'delete',
  command: ['del', 'delete', 'hapus', 'd'],
  category: 'group',
  description: 'Hapus pesan yang di-reply / dikutip (pesan bot atau pesan member)',
  async run({ sock, jid, msg, command, prefix, isGroup, reply, sender }) {
    // Ambil info pesan yang dikutip (quoted message)
    const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
    const quotedId = contextInfo?.stanzaId;

    if (!quotedId) {
      return reply(`
🗑️ *PANDUAN HAPUS PESAN (${prefix}${command})*
Gunakan fitur ini untuk menghapus chat quest RPG atau pesan spam agar tidak memenuhi grup!

👉 *Cara Penggunaan:*
1. Tekan lama / balas (*reply / quote*) pesan yang ingin dihapus.
2. Ketik *${prefix}del* atau *${prefix}delete*.

💡 *Aturan:*
• *Pesan Bot:* Bisa dihapus langsung oleh siapa saja di obrolan pribadi maupun grup.
• *Pesan Member Lain:* Hanya bisa dihapus jika bot memiliki jabatan sebagai *Admin Grup*.
`.trim());
    }

    const quotedParticipant = contextInfo?.participant;
    const quotedRemoteJid = contextInfo?.remoteJid || jid;

    // Nomor bot saat ini
    const botUserJid = sock.user?.id ? sock.user.id.split(':')[0] + '@s.whatsapp.net' : '';

    // Cek apakah pesan yang di-quote berasal dari bot
    const isFromBot = (quotedParticipant && botUserJid && quotedParticipant.startsWith(botUserJid.split('@')[0])) ||
                      (contextInfo?.fromMe === true) ||
                      (!isGroup && quotedParticipant === botUserJid);

    // Kunci pesan yang akan dihapus
    const deleteKey = {
      remoteJid: jid,
      fromMe: Boolean(isFromBot),
      id: quotedId,
      participant: isGroup ? quotedParticipant : undefined
    };

    try {
      // Jika pesan dari anggota lain di dalam grup, periksa izin admin bot
      if (!isFromBot && isGroup) {
        let isBotAdmin = false;
        try {
          const groupMeta = await sock.groupMetadata(jid);
          const participants = groupMeta.participants || [];
          const botInGroup = participants.find(p => p.id && botUserJid && p.id.startsWith(botUserJid.split('@')[0]));
          isBotAdmin = botInGroup?.admin === 'admin' || botInGroup?.admin === 'superadmin';
        } catch {}

        if (!isBotAdmin) {
          return reply('⚠️ Bot tidak bisa menghapus pesan anggota lain karena bot *bukan Admin Grup*!\nJadikan bot sebagai admin grup terlebih dahulu.');
        }
      }

      // Hapus pesan target
      await sock.sendMessage(jid, { delete: deleteKey });

      // Hapus juga pesan perintah .del pengirim agar grup tetap bersih
      if (msg.key?.id) {
        try {
          await sock.sendMessage(jid, { delete: msg.key });
        } catch {}
      }
    } catch (err) {
      console.error('Gagal menghapus pesan:', err.message);
      return reply('❌ Gagal menghapus pesan. Kemungkinan pesan tersebut sudah terlalu lama (melebihi batas waktu hapus WhatsApp).');
    }
  }
};
