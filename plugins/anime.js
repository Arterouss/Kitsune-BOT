// plugins/anime.js - Plugin Anime, Manga, Karakter & Wallpaper Aesthetic
import axios from 'axios';
import { askAI } from '../lib/ai.js';

export default {
  name: 'anime',
  command: ['anime', 'manga', 'character', 'chara', 'kitsune', 'waifu', 'neko', 'husbando', 'quoteanime', 'animequote', 'kataanime'],
  category: 'anime',
  description: 'Info Anime, Manga, Karakter (AniList), Wallpaper Anime Aesthetic (Kitsune/Waifu/Neko), & Kutipan Anime',
  async run({ sock, jid, msg, command, args, prefix, reply }) {
    // 1. INFO ANIME / MANGA (.anime / .manga <judul>)
    if (['anime', 'manga'].includes(command)) {
      if (!args) {
        return reply(`⚠️ Masukkan judul ${command} yang ingin dicari!\nContoh: *${prefix}${command} Naruto*`);
      }

      const isAnime = command === 'anime';
      const mediaType = isAnime ? 'ANIME' : 'MANGA';

      const graphqlQuery = `
        query ($search: String, $type: MediaType) {
          Media (search: $search, type: $type) {
            title {
              romaji
              english
              native
            }
            description(asHtml: false)
            episodes
            chapters
            volumes
            status
            averageScore
            genres
            coverImage {
              large
            }
            siteUrl
          }
        }
      `;

      try {
        const res = await axios.post('https://graphql.anilist.co', {
          query: graphqlQuery,
          variables: { search: args, type: mediaType }
        }, { timeout: 10000 });

        const media = res.data?.data?.Media;
        if (!media) {
          return reply(`❌ ${command} dengan judul *"${args}"* tidak ditemukan.`);
        }

        const cleanDesc = (media.description || 'Tidak ada sinopsis.')
          .replace(/<[^>]*>/g, '')
          .slice(0, 500) + '...';

        const infoText = `
🌸 *${media.title.romaji || media.title.english}*
_${media.title.native || ''}_

📊 *Skor:* ${media.averageScore ? media.averageScore + '/100' : 'N/A'}
📌 *Status:* ${media.status || '-'}
🎭 *Genre:* ${media.genres ? media.genres.join(', ') : '-'}
${isAnime ? `🎬 *Episode:* ${media.episodes || '-'}` : `📖 *Chapter/Volume:* ${media.chapters || '-'} ch / ${media.volumes || '-'} vol`}

📝 *Sinopsis:*
${cleanDesc}

🔗 *Link AniList:* ${media.siteUrl}
`.trim();

        if (media.coverImage?.large) {
          return await sock.sendMessage(jid, {
            image: { url: media.coverImage.large },
            caption: infoText
          }, { quoted: msg });
        } else {
          return await reply(infoText);
        }
      } catch (err) {
        console.error('Error anime/manga:', err.message);
        return reply(`❌ Gagal mencari data ${command}. Pastikan judul dieja dengan benar.`);
      }
    }

    // 2. PENCARIAN KARAKTER ANIME (.character / .chara <nama>)
    if (['character', 'chara'].includes(command)) {
      if (!args) {
        return reply(`⚠️ Masukkan nama karakter anime!\nContoh: *${prefix}${command} Megumin*`);
      }

      await reply('🔍 Mencari karakter anime...');

      const charQuery = `
        query ($search: String) {
          Character (search: $search) {
            name {
              full
              native
              alternative
            }
            description(asHtml: false)
            image {
              large
            }
            media(page: 1, perPage: 1) {
              nodes {
                title {
                  romaji
                  english
                }
              }
            }
            siteUrl
          }
        }
      `;

      try {
        const res = await axios.post('https://graphql.anilist.co', {
          query: charQuery,
          variables: { search: args }
        }, { timeout: 10000 });

        const chara = res.data?.data?.Character;
        if (!chara) {
          return reply(`❌ Karakter *"${args}"* tidak ditemukan di database.`);
        }

        const animeOrigin = chara.media?.nodes?.[0]?.title?.romaji || chara.media?.nodes?.[0]?.title?.english || '-';
        const cleanDesc = (chara.description || 'Tidak ada deskripsi.')
          .replace(/<[^>]*>/g, '')
          .slice(0, 450) + '...';

        const caption = `
👤 *${chara.name.full}* ${chara.name.native ? `(${chara.name.native})` : ''}
🎬 *Asal Anime:* ${animeOrigin}
${chara.name.alternative?.length ? `🏷️ *Alias:* ${chara.name.alternative.slice(0, 3).join(', ')}` : ''}

📖 *Deskripsi:*
${cleanDesc}

🔗 *Info Lengkap:* ${chara.siteUrl}
`.trim();

        if (chara.image?.large) {
          return await sock.sendMessage(jid, {
            image: { url: chara.image.large },
            caption
          }, { quoted: msg });
        } else {
          return await reply(caption);
        }
      } catch (err) {
        console.error('Error character:', err.message);
        return reply('❌ Gagal mencari info karakter. Pastikan nama karakter benar.');
      }
    }

    // 3. WALLPAPER & ANIME ART AESTHETIC (.kitsune, .waifu, .neko, .husbando)
    if (['kitsune', 'waifu', 'neko', 'husbando'].includes(command)) {
      const categoryLabel = {
        kitsune: '🦊 Kitsune (Rubah)',
        waifu: '💖 Waifu',
        neko: '🐱 Neko (Catgirl)',
        husbando: '✨ Husbando'
      }[command] || command;

      await reply(`🎨 Mengambil gambar ${categoryLabel} aesthetic...`);

      try {
        const res = await axios.get(`https://nekos.best/api/v2/${command}`, { timeout: 10000 });
        const item = res.data?.results?.[0];

        if (!item || !item.url) {
          return reply('❌ Gagal mendapatkan gambar, silakan coba lagi.');
        }

        const caption = `
✨ *Kitsune-BOT Aesthetic Gallery* ✨
🏷️ *Kategori:* ${categoryLabel}
🎨 *Artist:* ${item.artist_name || 'Unknown'}
🔗 *Sumber:* ${item.source_url || item.artist_href || 'Pixiv/Twitter'}
`.trim();

        return await sock.sendMessage(jid, {
          image: { url: item.url },
          caption
        }, { quoted: msg });
      } catch (err) {
        console.error('Error nekos.best:', err.message);
        return reply('❌ Gagal memuat gambar anime.');
      }
    }

    // 4. KUTIPAN ANIME INSPIRATIF (.quoteanime / .animequote / .kataanime)
    if (['quoteanime', 'animequote', 'kataanime'].includes(command)) {
      await reply('📜 Mengambil kutipan anime...');

      try {
        const res = await axios.get('https://katanime.vercel.app/api/getrandom', { timeout: 5000 });
        if (res.data?.result && res.data.result.length > 0) {
          const q = res.data.result[0];
          const quoteText = `
💬 *Kutipan Anime:*
"${q.indo || q.english}"

👤 *Karakter:* ${q.character}
🎬 *Anime:* ${q.anime}
`.trim();
          return reply(quoteText);
        }
      } catch (e) {
        // Fallback ke Gemini AI jika API katanime sedang sibuk
        try {
          const aiQuote = await askAI('Berikan 1 kutipan anime populer yang menginspirasi lengkap dengan nama karakter dan judul animenya dalam bahasa Indonesia.');
          return reply(`💬 *Kutipan Anime:*\n\n${aiQuote}`);
        } catch (err) {
          return reply('❌ Gagal mengambil kutipan anime.');
        }
      }
    }
  }
};
