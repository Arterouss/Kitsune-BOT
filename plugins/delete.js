// plugins/delete.js - Fitur Hapus Pesan Bot, Pesan Member & Bersihkan Chat Raid RPG
import { config } from '../config.js';

export default {
  name: 'delete',
  command: ['del', 'delete', 'hapus', 'd', 'delraid', 'clearraid', 'delrpg', 'clearrpg'],
  category: 'group',
  description: 'Hapus pesan yang di-reply atau bersihkan seluruh chat bot saat raid/rpg agar grup tidak penuh',
  async run({ sock, jid, msg, command, args, prefix, isGroup, reply, sender }) {
    // Inisialisasi riwayat pesan bot di chat ini
    if (!global.botMessageHistory) global.botMessageHistory = new Map();
    if (!global.botMessageHistory.has(jid)) {
      global.botMessageHistory.set(jid, []);
    }
    const historyList = global.botMessageHistory.get(jid);

    const mode = (args || '').trim().toLowerCase();
    const isRaidClear = ['delraid', 'clearraid'].includes(command) || mode === 'raid' || mode === 'boss';
    const isRpgClear = ['delrpg', 'clearrpg'].includes(command) || mode === 'rpg';
    const isAllClear = mode === 'all' || mode === 'semua';
    const isCountClear = !isNaN(parseInt(mode)) && parseInt(mode) > 0;

    // Helper untuk menghapus daftar pesan bot secara berurutan
    const executeBulkDelete = async (targets, label = 'pesan') => {
      if (targets.length === 0) {
        return reply(`🎒 Tidak ada riwayat chat ${label} dari bot yang tersimpan baru-baru ini.`);
      }

      let successCount = 0;
      for (const item of targets) {
        try {
          await sock.sendMessage(jid, {
            delete: {
              remoteJid: jid,
              fromMe: true,
              id: item.id
            }
          });
          successCount++;
          // Jeda sedikit agar tidak terkena rate limit WhatsApp
          await new Promise((r) => setTimeout(r, 70));
        } catch {}
      }

      // Hapus item yang sudah didelete dari historyList
      const deletedIds = new Set(targets.map((t) => t.id));
      const remaining = historyList.filter((m) => !deletedIds.has(m.id));
      global.botMessageHistory.set(jid, remaining);

      // Hapus juga pesan perintah pengirim jika di grup
      if (msg.key?.id) {
        try {
          await sock.sendMessage(jid, { delete: msg.key });
        } catch {}
      }

      // Kirim konfirmasi ringkas yang otomatis terhapus dalam 5 detik
      const notif = await reply(`🧹 Berhasil membersihkan *${successCount} chat ${label}* dari grup!\n_(Pesan ini akan otomatis hilang dalam 5 detik)_`);
      setTimeout(async () => {
        try {
          if (notif?.key?.id) {
            await sock.sendMessage(jid, { delete: notif.key });
          }
        } catch {}
      }, 5000);
    };

    // ──────────────────────────────────────────────────────────
    // 1. BERSIHKAN SEMUA CHAT RAID (.del raid / .delraid)
    // ──────────────────────────────────────────────────────────
    if (isRaidClear) {
      const raidCommands = ['raid', 'boss', 'serang', 'hit', 'attack', 'cekkondisi', 'tagraid', 'ajakraid'];
      
      // Ambil dari riwayat bot yang berhubungan dengan raid
      let raidTargets = historyList.filter((m) => {
        return raidCommands.includes(m.command) || m.category === 'raid';
      });

      // Tambahkan juga pesan yang tercatat langsung di sesi active raid jika ada
      if (global.rpgRaids && global.rpgRaids[jid]?.messageIds) {
        for (const mid of global.rpgRaids[jid].messageIds) {
          if (!raidTargets.some((t) => t.id === mid)) {
            raidTargets.push({ id: mid, command: 'raid', category: 'rpg' });
          }
        }
      }

      return await executeBulkDelete(raidTargets, 'Boss Raid');
    }

    // ──────────────────────────────────────────────────────────
    // 2. BERSIHKAN SEMUA CHAT RPG (.del rpg / .delrpg)
    // ──────────────────────────────────────────────────────────
    if (isRpgClear) {
      const rpgTargets = historyList.filter((m) => m.category === 'rpg');
      return await executeBulkDelete(rpgTargets, 'RPG');
    }

    // ──────────────────────────────────────────────────────────
    // 3. BERSIHKAN SEMUA CHAT BOT TERAKHIR (.del all)
    // ──────────────────────────────────────────────────────────
    if (isAllClear) {
      const allTargets = [...historyList];
      return await executeBulkDelete(allTargets, 'bot');
    }

    // ──────────────────────────────────────────────────────────
    // 4. BERSIHKAN N PESAN BOT TERAKHIR (.del <jumlah>)
    // ──────────────────────────────────────────────────────────
    if (isCountClear) {
      const count = Math.min(100, Math.max(1, parseInt(mode)));
      const countTargets = historyList.slice(-count);
      return await executeBulkDelete(countTargets, `${count} terakhir`);
    }

    // ──────────────────────────────────────────────────────────
    // 5. HAPUS PESAN TERTENTU DENGAN REPLY / QUOTE (.del)
    // ──────────────────────────────────────────────────────────
    const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
    const quotedId = contextInfo?.stanzaId;

    if (quotedId) {
      const quotedParticipant = contextInfo?.participant;
      const botUserJid = sock.user?.id ? sock.user.id.split(':')[0] + '@s.whatsapp.net' : '';

      const isFromBot = (quotedParticipant && botUserJid && quotedParticipant.startsWith(botUserJid.split('@')[0])) ||
                        (contextInfo?.fromMe === true) ||
                        (!isGroup && quotedParticipant === botUserJid);

      const deleteKey = {
        remoteJid: jid,
        fromMe: Boolean(isFromBot),
        id: quotedId,
        participant: isGroup ? quotedParticipant : undefined
      };

      try {
        if (!isFromBot && isGroup) {
          let isBotAdmin = false;
          try {
            const groupMeta = await sock.groupMetadata(jid);
            const participants = groupMeta.participants || [];
            const botInGroup = participants.find((p) => p.id && botUserJid && p.id.startsWith(botUserJid.split('@')[0]));
            isBotAdmin = botInGroup?.admin === 'admin' || botInGroup?.admin === 'superadmin';
          } catch {}

          if (!isBotAdmin) {
            return reply('⚠️ Bot tidak bisa menghapus pesan anggota lain karena bot *bukan Admin Grup*!\nJadikan bot sebagai admin terlebih dahulu.');
          }
        }

        await sock.sendMessage(jid, { delete: deleteKey });

        if (msg.key?.id) {
          try {
            await sock.sendMessage(jid, { delete: msg.key });
          } catch {}
        }
        return;
      } catch (err) {
        console.error('Gagal menghapus pesan:', err.message);
        return reply('❌ Gagal menghapus pesan. Kemungkinan pesan tersebut sudah terlalu lama melebihi batas waktu WhatsApp.');
      }
    }

    // ──────────────────────────────────────────────────────────
    // 6. JIKA TIDAK ADA QUOTE & TIDAK ADA ARGS: TAMPILKAN MENU PANDUAN
    // ──────────────────────────────────────────────────────────
    return reply(`
╭━━━━━「 🗑️ *PEMBERSIH CHAT BOT* 」━━━━━╮
┃ Bersihkan spam chat quest & raid di grup!
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

👉 *Pilihan Perintah Hapus:*
• *${prefix}del raid* atau *${prefix}delraid*
  Menghapus SEMUA chat World Boss Raid dari bot yang tadi dilakukan!
• *${prefix}del rpg* atau *${prefix}delrpg*
  Menghapus semua chat petualangan, tambang, & toko RPG.
• *${prefix}del <jumlah>* (Contoh: \`${prefix}del 15\`)
  Menghapus 15 chat terakhir yang dikirim oleh bot.
• *${prefix}del all*
  Menghapus semua riwayat chat bot di grup ini.
• *Balas (Quote) Pesan + ketik ${prefix}del*
  Menghapus 1 pesan yang sedang kamu balas.

💡 _Semua pesan yang dihapus akan bersih total tanpa menyisakan sampah di obrolan grup._
`.trim());
  }
};
