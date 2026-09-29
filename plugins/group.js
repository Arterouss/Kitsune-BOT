// plugins/group.js - Plugin Khusus Pengelolaan Grup WhatsApp
import { config } from '../config.js';

export default {
  name: 'group',
  command: ['hidetag', 'tagall', 'linkgc', 'group'],
  category: 'group',
  description: 'Perintah khusus grup (Hidetag, Tagall, Link grup, Buka/Tutup grup)',
  async run({ sock, jid, msg, command, args, prefix, sender, isGroup, reply }) {
    // Pastikan perintah dijalankan di dalam grup
    if (!isGroup) {
      return reply('⚠️ Perintah ini hanya bisa digunakan di dalam *Grup WhatsApp*!');
    }

    try {
      const groupMetadata = await sock.groupMetadata(jid);
      const participants = groupMetadata.participants || [];

      // Helper cek apakah pengirim adalah admin grup atau owner bot
      const senderParticipant = participants.find(p => p.id === sender);
      const isSenderAdmin = senderParticipant?.admin === 'admin' || senderParticipant?.admin === 'superadmin';
      const isOwner = sender.includes(config.ownerNumber.replace(/[^0-9]/g, ''));

      // Helper cek apakah nomor bot adalah admin grup
      const botNumber = sock.user?.id ? sock.user.id.split(':')[0] + '@s.whatsapp.net' : '';
      const botParticipant = participants.find(p => p.id === botNumber);
      const isBotAdmin = botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin';

      // 1. Perintah HIDETAG (Tag semua member secara senyap)
      if (command === 'hidetag') {
        if (!isSenderAdmin && !isOwner) {
          return reply('⚠️ Hanya *Admin Grup* yang bisa menggunakan perintah hidetag!');
        }

        const pesan = args || '📢 Pengumuman untuk semua anggota grup!';
        const mentions = participants.map(p => p.id);

        return await sock.sendMessage(jid, {
          text: pesan,
          mentions: mentions
        });
      }

      // 2. Perintah TAGALL (Tag semua member dengan daftar nomor)
      if (command === 'tagall') {
        if (!isSenderAdmin && !isOwner) {
          return reply('⚠️ Hanya *Admin Grup* yang bisa menggunakan perintah tagall!');
        }

        let pesan = `📢 *PANGGILAN KEPADA SEMUA MEMBER*\n`;
        if (args) pesan += `Pesan: *${args}*\n\n`;

        const mentions = [];
        participants.forEach((p, idx) => {
          const number = p.id.split('@')[0];
          pesan += `${idx + 1}. @${number}\n`;
          mentions.push(p.id);
        });

        return await sock.sendMessage(jid, {
          text: pesan.trim(),
          mentions: mentions
        }, { quoted: msg });
      }

      // 3. Perintah LINKGC (Mengambil link undangan grup)
      if (command === 'linkgc') {
        if (!isBotAdmin) {
          return reply('⚠️ Bot harus menjadi *Admin Grup* untuk mengambil link undangan!');
        }

        const inviteCode = await sock.groupInviteCode(jid);
        return reply(`🔗 *Tautan Undangan Grup:*\nhttps://chat.whatsapp.com/${inviteCode}`);
      }

      // 4. Perintah BUKA / TUTUP GRUP (.group open / .group close)
      if (command === 'group') {
        if (!isSenderAdmin && !isOwner) {
          return reply('⚠️ Hanya *Admin Grup* yang bisa mengubah setelan grup!');
        }
        if (!isBotAdmin) {
          return reply('⚠️ Bot harus menjadi *Admin Grup* untuk mengubah setelan grup!');
        }

        const subCmd = args.toLowerCase();
        if (subCmd === 'open' || subCmd === 'buka') {
          await sock.groupSettingUpdate(jid, 'not_announcement');
          return reply('🔓 *Grup telah dibuka!* Semua anggota sekarang bisa mengirim pesan.');
        } else if (subCmd === 'close' || subCmd === 'tutup') {
          await sock.groupSettingUpdate(jid, 'announcement');
          return reply('🔒 *Grup telah ditutup!* Hanya admin yang bisa mengirim pesan.');
        } else {
          return reply(`⚠️ Gunakan:\n› *${prefix}group open* (Membuka grup)\n› *${prefix}group close* (Menutup grup)`);
        }
      }
    } catch (err) {
      console.error('Error pada plugin group:', err);
      return reply(`❌ Terjadi kesalahan: ${err.message || 'Gagal memproses perintah grup.'}`);
    }
  }
};
