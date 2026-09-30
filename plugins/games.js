// plugins/games.js - Plugin Game & Hiburan untuk meramaikan grup
global.gameSessions = global.gameSessions || {};
const gameSessions = global.gameSessions;

const databaseSusunKata = [
  { soal: "M - A - N - A - K", jawaban: "MAKAN" },
  { soal: "T - U - H - A", jawaban: "TAHU" },
  { soal: "P - A - S - T - U", jawaban: "SEPATU" }, // Wait, S-E-P-A-T-U (S,E,P,A,T,U)
  { soal: "E - S - P - A - U - T", jawaban: "SEPATU" },
  { soal: "L - O - K - B - A", jawaban: "BALOK" },
  { soal: "M - E - A - J", jawaban: "MEJA" },
  { soal: "S - A - P - U", jawaban: "PUAS" },
  { soal: "R - I - A", jawaban: "AIR" }
];

const databaseCakLontong = [
  { soal: "Mawar melati semuanya...", jawaban: "BUNGA", deskripsi: "Kalau bukan bunga apa dong?" },
  { soal: "Biasa disimpan di dalam saku...", jawaban: "BOCOR", deskripsi: "Kalau bocor ya jatuh lah, masa di saku" },
  { soal: "Beli lampu biasanya di...", jawaban: "COBA", deskripsi: "Kan harus dicoba dulu nyala apa nggak" }
];

export default {
  name: 'games',
  command: ['susunkata', 'caklontong', 'menyerah'],
  category: 'hiburan',
  description: 'Game seru: Susun Kata dan Tebak Cak Lontong',
  async run({ sock, jid, msg, command, args, prefix, reply }) {
    
    // CEK APAKAH ADA GAME BERJALAN
    if (command !== 'menyerah' && gameSessions[jid]) {
      return reply('⚠️ Masih ada game yang belum diselesaikan di chat ini! Ketik *menyerah* jika ingin mengakhiri.');
    }

    // 1. GAME SUSUN KATA
    if (command === 'susunkata') {
      const random = databaseSusunKata[Math.floor(Math.random() * databaseSusunKata.length)];
      
      gameSessions[jid] = {
        jenis: 'susunkata',
        jawaban: random.jawaban,
        waktu: setTimeout(() => {
          if (gameSessions[jid]) {
            reply(`⏳ Waktu habis!\nJawaban yang benar adalah: *${gameSessions[jid].jawaban}*`);
            delete gameSessions[jid];
          }
        }, 60000) // 1 Menit
      };

      return reply(`🎮 *GAME SUSUN KATA*\n\nSusun huruf berikut menjadi kata yang benar:\n*${random.soal}*\n\nWaktu: 60 Detik\nBalas pesan ini atau ketik langsung jawabanmu.`);
    }

    // 2. GAME CAK LONTONG
    if (command === 'caklontong') {
      const random = databaseCakLontong[Math.floor(Math.random() * databaseCakLontong.length)];
      
      gameSessions[jid] = {
        jenis: 'caklontong',
        jawaban: random.jawaban,
        deskripsi: random.deskripsi,
        waktu: setTimeout(() => {
          if (gameSessions[jid]) {
            reply(`⏳ Waktu habis!\nJawaban yang benar adalah: *${gameSessions[jid].jawaban}*\n\n_Alasan: ${gameSessions[jid].deskripsi}_`);
            delete gameSessions[jid];
          }
        }, 60000)
      };

      return reply(`🧠 *TEBAK CAK LONTONG*\n\n${random.soal}\n\nWaktu: 60 Detik\nBalas pesan ini atau ketik langsung jawabanmu.`);
    }

    // 3. MENYERAH
    if (command === 'menyerah') {
      if (!gameSessions[jid]) {
        return reply('⚠️ Tidak ada game yang sedang berjalan!');
      }
      clearTimeout(gameSessions[jid].waktu);
      const jwb = gameSessions[jid].jawaban;
      const alasan = gameSessions[jid].deskripsi ? `\n_Alasan: ${gameSessions[jid].deskripsi}_` : '';
      
      delete gameSessions[jid];
      return reply(`🏳️ Kamu menyerah.\nJawaban yang benar adalah: *${jwb}*${alasan}`);
    }
  }
};
