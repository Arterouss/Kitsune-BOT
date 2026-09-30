// plugins/utility.js - Plugin Utilitas Harian
import axios from 'axios';

export default {
  name: 'utility',
  command: ['cuaca', 'sholat', 'jadwalsholat', 'gempa'],
  category: 'utility',
  description: 'Cek cuaca dan jadwal sholat',
  async run({ sock, jid, msg, command, args, prefix, reply }) {
    // 1. INFO CUACA
    if (command === 'cuaca') {
      if (!args) {
        return reply(`⚠️ Masukkan nama kota!\nContoh: *${prefix}${command} Jakarta*`);
      }
      
      await reply('⏳ Mengecek info cuaca...');
      try {
        // Menggunakan layanan wttr.in (gratis, tanpa API key)
        const res = await axios.get(`https://wttr.in/${encodeURIComponent(args)}?format=j1`);
        const data = res.data.current_condition[0];
        const area = res.data.nearest_area[0];
        
        const lokasi = `${area.areaName[0].value}, ${area.region[0].value}, ${area.country[0].value}`;
        const suhu = `${data.temp_C}°C`;
        const kondisi = data.weatherDesc[0].value;
        const kelembaban = `${data.humidity}%`;
        const angin = `${data.windspeedKmph} km/h`;

        const text = `🌤️ *INFO CUACA*\n\n📍 *Lokasi:* ${lokasi}\n🌡️ *Suhu:* ${suhu}\n☁️ *Kondisi:* ${kondisi}\n💧 *Kelembaban:* ${kelembaban}\n💨 *Angin:* ${angin}`;
        
        return reply(text);
      } catch (err) {
        console.error('Error Cuaca:', err);
        return reply('❌ Kota tidak ditemukan atau layanan sedang sibuk.');
      }
    }

    // 2. JADWAL SHOLAT
    if (['sholat', 'jadwalsholat'].includes(command)) {
      if (!args) {
        return reply(`⚠️ Masukkan nama kota!\nContoh: *${prefix}${command} Bandung*`);
      }

      await reply('⏳ Mencari jadwal sholat...');
      try {
        // Cari ID Kota (Gratis via api.myquran.com)
        const search = await axios.get(`https://api.myquran.com/v2/sholat/kota/cari/${encodeURIComponent(args)}`);
        if (!search.data.status || search.data.data.length === 0) {
          return reply('❌ Kota tidak ditemukan. Coba gunakan nama kota yang lebih umum.');
        }

        const idKota = search.data.data[0].id;
        const namaKota = search.data.data[0].lokasi;
        
        // Ambil Jadwal Hari Ini
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');

        const jadwal = await axios.get(`https://api.myquran.com/v2/sholat/jadwal/${idKota}/${year}/${month}/${day}`);
        const dataJadwal = jadwal.data.data.jadwal;

        const text = `🕌 *JADWAL SHOLAT*\n📍 *Lokasi:* ${namaKota}\n📅 *Tanggal:* ${dataJadwal.tanggal}\n\n*Imsak:* ${dataJadwal.imsak}\n*Subuh:* ${dataJadwal.subuh}\n*Terbit:* ${dataJadwal.terbit}\n*Dhuha:* ${dataJadwal.dhuha}\n*Dzuhur:* ${dataJadwal.dzuhur}\n*Ashar:* ${dataJadwal.ashar}\n*Maghrib:* ${dataJadwal.maghrib}\n*Isya:* ${dataJadwal.isya}`;

        return reply(text);
      } catch (err) {
        console.error('Error Sholat:', err);
        return reply('❌ Terjadi kesalahan saat mengambil jadwal sholat.');
      }
    }

    // 3. INFO GEMPA BMKG
    if (command === 'gempa') {
      await reply('⏳ Mengambil data gempa terbaru dari BMKG...');
      try {
        const res = await axios.get('https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json');
        const gempa = res.data.Infogempa.gempa;
        
        const text = `🚨 *INFO GEMPA TERKINI (BMKG)* 🚨\n\n📅 *Waktu:* ${gempa.Tanggal} | ${gempa.Jam}\n📍 *Lokasi:* ${gempa.Wilayah}\n📌 *Koordinat:* ${gempa.Coordinates}\n💥 *Magnitudo:* ${gempa.Magnitude} SR\n🌊 *Kedalaman:* ${gempa.Kedalaman}\n⚠️ *Potensi Tsunami:* ${gempa.Potensi}\n\n_Catatan: ${gempa.Dirasakan}_`;

        const petaUrl = `https://data.bmkg.go.id/DataMKG/TEWS/${gempa.Shakemap}`;
        
        return await sock.sendMessage(jid, { 
          image: { url: petaUrl }, 
          caption: text 
        }, { quoted: msg });
        
      } catch (err) {
        console.error('Error Gempa BMKG:', err);
        return reply('❌ Gagal mengambil data gempa dari BMKG. Server mungkin sedang gangguan.');
      }
    }
  }
};
