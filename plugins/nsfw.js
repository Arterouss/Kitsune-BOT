// plugins/nsfw.js - Fitur NSFW: Waifu/Neko/Trap/Blowjob/Hentai (waifu.pics), GIF & Search Doujin (nhentai API)
import axios from "axios";

// ── Helper: kirim gambar/GIF dari URL ──
async function sendMedia(sock, jid, msg, url, caption = "") {
  const isGif = url.endsWith(".gif");
  if (isGif) {
    return await sock.sendMessage(
      jid,
      {
        video: { url },
        gifPlayback: true,
        caption,
      },
      { quoted: msg },
    );
  }
  return await sock.sendMessage(
    jid,
    {
      image: { url },
      caption,
    },
    { quoted: msg },
  );
}

// ── Helper: fetch random dari waifu.pics ──
async function fetchWaifuPics(endpoint) {
  const res = await axios.get(`https://api.waifu.pics/nsfw/${endpoint}`, {
    timeout: 15000,
  });
  if (!res.data?.url) throw new Error("API tidak merespons");
  return res.data.url;
}

// ── Helper: nhentai search via API ──
async function searchNhentai(query) {
  const res = await axios.get("https://nhentai.net/api/search", {
    params: { query, sort: "popular" },
    timeout: 15000,
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  return res.data?.result || [];
}

export default {
  name: "nsfw",
  command: [
    "nsfwwaifu",
    "nsfwneko",
    "trap",
    "blowjob",
    "hentai",
    "nsfwgif",
    "nsfwsearch",
    "doujin",
    "nsfwmenu",
  ],
  category: "nsfw",
  description: "Konten NSFW: gambar, GIF, dan pencarian doujin (18+)",
  async run({ sock, jid, msg, command, args, prefix, reply }) {
    try {
      // ── .nsfwmenu ──
      if (command === "nsfwmenu") {
        return reply(
          `
╭━━━━━「 🔞 *MENU NSFW* 」━━━━━╮
┃ › \`${prefix}nsfwwaifu\` ─ _Random waifu NSFW_
┃ › \`${prefix}nsfwneko\` ─ _Random neko girl NSFW_
┃ › \`${prefix}trap\` ─ _Random trap_
┃ › \`${prefix}blowjob\` ─ _Random blowjob_
┃ › \`${prefix}hentai\` ─ _Random hentai pic_
┃ › \`${prefix}nsfwgif\` ─ _Random NSFW GIF_
┃ › \`${prefix}doujin\` \`<judul>\` ─ _Cari doujin (nhentai)_
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯
⚠️ _Konten 18+. Gunakan di chat pribadi._`.trim(),
        );
      }

      // ── .doujin / .nsfwsearch <query> ──
      if (["doujin", "nsfwsearch"].includes(command)) {
        if (!args)
          return reply(
            `⚠️ Masukkan kata kunci!\nContoh: *${prefix}doujin vanilla*`,
          );
        await reply("🔍 Mencari doujin...");
        const results = await searchNhentai(args);
        if (results.length === 0)
          return reply(`❌ Tidak ada hasil untuk *"${args}"*.`);

        const list = results
          .slice(0, 8)
          .map((d, i) => {
            const title = d.title?.pretty || d.title?.english || "Untitled";
            const tags = (d.tags || [])
              .filter((t) => t.type === "tag")
              .slice(0, 4)
              .map((t) => t.name)
              .join(", ");
            return `*${i + 1}.* ${title}\n   📖 ${d.num_pages} hal | ⭐ ${d.num_favorites} fav\n   🏷️ ${tags || "-"}\n   🔗 https://nhentai.net/g/${d.media_id || d.id}/`;
          })
          .join("\n\n");

        return reply(
          `🔞 *Hasil Pencarian:* "${args}"\n\n${list}\n\n💡 _Buka link di browser untuk baca._`,
        );
      }

      // ── .nsfwgif (random GIF dari waifu.pics) ──
      if (command === "nsfwgif") {
        await reply("⏳ Mengambil GIF...");
        const url = await fetchWaifuPics("random");
        return await sendMedia(sock, jid, msg, url, "🔞 NSFW GIF");
      }

      // ── Gambar: nsfwwaifu / nsfwneko / trap / blowjob / hentai ──
      const endpointMap = {
        nsfwwaifu: "waifu",
        nsfwneko: "neko",
        trap: "trap",
        blowjob: "blow",
        hentai: "random",
      };

      if (endpointMap[command]) {
        await reply("⏳ Mengambil gambar...");
        const url = await fetchWaifuPics(endpointMap[command]);
        return await sendMedia(
          sock,
          jid,
          msg,
          url,
          `🔞 ${command} • sumber: waifu.pics`,
        );
      }
    } catch (err) {
      console.error("❌ [NSFW] Error:", err.message);
      return reply(
        "❌ Gagal mengambil konten, API sedang bermasalah. Coba lagi nanti.",
      );
    }
  },
};
