// plugins/akademik.js - Plugin Asisten Akademik (Catatan Tugas & Deadline)
import fs from 'fs';
import path from 'path';

const tugasFile = path.resolve('./tugas_database.json');

// Helper load database tugas
function getTugasList() {
  if (!fs.existsSync(tugasFile)) {
    fs.writeFileSync(tugasFile, JSON.stringify([]));
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(tugasFile, 'utf-8'));
  } catch {
    return [];
  }
}

// Helper save database tugas
function saveTugasList(list) {
  fs.writeFileSync(tugasFile, JSON.stringify(list, null, 2));
}

export default {
  name: 'akademik',
  command: ['tugas', 'deadline'],
  category: 'akademik',
  description: 'Catat dan pantau daftar tugas & deadline akademik',
  async run({ jid, msg, command, args, prefix, reply }) {
    const subCmd = args.split(' ')[0]?.toLowerCase();
    const isi = args.slice(subCmd.length).trim();

    const list = getTugasList();

    if (!args || subCmd === 'list') {
      if (list.length === 0) {
        return reply(`🎉 Belum ada tugas yang dicatat! Santai dulu.\n\nUntuk menambah tugas ketik:\n*${prefix}${command} tambah <Mata Pelajaran/Kuliah> - <Deadline/Deskripsi>*`);
      }

      let text = `📝 *DAFTAR TUGAS AKADEMIK AKTIF:*\n\n`;
      list.forEach((t, i) => {
        text += `*${i + 1}.* ${t.matkul}\n   📅 Deadline/Detail: _${t.detail}_\n\n`;
      });
      text += `💡 Ketik *${prefix}${command} hapus <nomor>* jika tugas sudah selesai dikerjakan.`;
      return reply(text.trim());
    }

    if (subCmd === 'tambah' || subCmd === 'add') {
      if (!isi || !isi.includes('-')) {
        return reply(`⚠️ Format salah!\nContoh: *${prefix}${command} tambah Pemrograman Web - Laporan Praktikum modul 3 (Besok jam 23:59)*`);
      }

      const [matkul, ...detailParts] = isi.split('-');
      const detail = detailParts.join('-').trim();

      list.push({
        matkul: matkul.trim(),
        detail: detail || 'Tidak ada detail',
        createdAt: new Date().toLocaleDateString('id-ID')
      });

      saveTugasList(list);
      return reply(`✅ Berhasil menambahkan tugas: *${matkul.trim()}* ke daftar pengingat akademik!`);
    }

    if (subCmd === 'hapus' || subCmd === 'del') {
      const idx = parseInt(isi) - 1;
      if (isNaN(idx) || idx < 0 || idx >= list.length) {
        return reply(`⚠️ Nomor tugas tidak valid! Ketik *${prefix}${command} list* untuk melihat daftar nomor.`);
      }

      const removed = list.splice(idx, 1);
      saveTugasList(list);
      return reply(`🗑️ Tugas *${removed[0].matkul}* telah dihapus/selesai!`);
    }

    return reply(`⚠️ Perintah tidak dikenal!\nGunakan:\n› *${prefix}${command} list*\n› *${prefix}${command} tambah <Pelajaran> - <Detail>*\n› *${prefix}${command} hapus <nomor>*`);
  }
};
