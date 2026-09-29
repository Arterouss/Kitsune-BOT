// plugins/anime.js - Plugin Pencari Informasi Anime & Manga (AniList API)
import axios from 'axios';

export default {
  name: 'anime',
  command: ['anime', 'manga'],
  category: 'anime',
  description: 'Cari informasi detail, sinopsis, dan skor Anime/Manga dari AniList',
  async run({ sock, jid, msg, command, args, prefix, reply }) {
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

      // Bersihkan tag HTML dari sinopsis jika ada
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
        await sock.sendMessage(jid, {
          image: { url: media.coverImage.large },
          caption: infoText
        }, { quoted: msg });
      } else {
        await reply(infoText);
      }
    } catch (err) {
      console.error('Error saat mencari anime/manga:', err.message);
      await reply(`❌ Gagal mencari data ${command}. Pastikan judul dieja dengan benar.`);
    }
  }
};
