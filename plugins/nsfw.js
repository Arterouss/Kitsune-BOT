// plugins/nsfw.js - Fitur NSFW: Waifu/Neko/Trap/Blowjob/Hentai (multi-API fallback + DoH DNS bypass), GIF & Search Doujin
import axios from "axios";
import dns from "dns";
import { Agent as HttpsAgent } from "https";

// ── DNS-over-HTTPS (DoH) Bypass ──
// Kalau DNS lokal hosting/ISP gagal resolve (ENOTFOUND) atau sertifikat salah
// (Hostname does not match ... ioh.co.id = DNS hijack ISP), kita resolve manual
// via Cloudflare/Google DoH lalu konek langsung ke IP-nya dengan SNI benar.
const dohCache = new Map(); // hostname -> { ip, ts } (cache 10 menit)

async function resolveViaDoH(hostname) {
  const cached = dohCache.get(hostname);
  if (cached && Date.now() - cached.ts < 10 * 60 * 1000) return cached.ip;

  const providers = [
    `https://dns.google/resolve?name=${encodeURIComponent(hostname)}&type=A`,
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=A`,
  ];

  for (const url of providers) {
    try {
      const res = await axios.get(url, {
        timeout: 8000,
        headers: { Accept: "application/dns-json" },
      });
      const answer = (res.data?.Answer || []).find((a) => a.type === 1);
      if (answer?.data) {
        dohCache.set(hostname, { ip: answer.data, ts: Date.now() });
        console.log(`🌐 [NSFW] DoH resolve ${hostname} -> ${answer.data}`);
        return answer.data;
      }
    } catch (err) {
      console.warn(`⚠️ [NSFW] DoH provider gagal: ${err.message}`);
    }
  }
  return null;
}

// Custom lookup: coba DNS normal dulu, kalau gagal -> bypass via DoH
function smartLookup(hostname, options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = {};
  }
  dns.lookup(hostname, { ...options, all: false }, (err, address, family) => {
    if (!err) {
      if (options.all) return callback(null, [{ address, family }]);
      return callback(null, address, family);
    }
    resolveViaDoH(hostname)
      .then((ip) => {
        if (ip) {
          if (options.all) return callback(null, [{ address: ip, family: 4 }]);
          return callback(null, ip, 4);
        }
        callback(err);
      })
      .catch(() => callback(err));
  });
}

// Agent HTTPS dengan smart lookup (SNI tetap benar, TLS tidak ditolak)
const smartAgent = new HttpsAgent({
  lookup: smartLookup,
  keepAlive: true,
});

// Wrapper axios yang selalu pakai agent smart-DNS
async function smartGet(url, config = {}) {
  return axios.get(url, { ...config, httpsAgent: smartAgent });
}

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

// ── Sumber API utama: Nekobot.xyz (terbukti jalan tanpa Cloudflare challenge) ──
// Map endpoint internal -> tipe Nekobot
const NEKOBOT_MAP = {
  waifu: "hneko", // NSFW neko girl
  neko: "hneko",
  trap: "hkitsune", // Nekobot tidak punya 'trap', pakai kitsune NSFW
  blow: "blowjob",
  random: "hentai", // random hentai pic
  gif: "anal", // GIF NSFW (hentai gif)
};

// Fallback tambahan: waifu.im & nekos.best (kadang 403 di beberapa jaringan)
const API_SOURCES = [
  {
    name: "waifu.im",
    url: (e) => {
      const tag = ["waifu", "neko", "trap"].includes(e) ? e : "waifu";
      return `https://api.waifu.im/search?included_tags=${tag}&is_nsfw=true`;
    },
    parse: (d) => d.images?.[0]?.url,
  },
  {
    name: "nekos.best",
    url: (e) => {
      const cat = { neko: "hneko", waifu: "hwaifu" }[e] || "hneko";
      return `https://nekos.best/api/v2/${cat}`;
    },
    parse: (d) => d.results?.[0]?.url,
  },
];

async function fetchNekobot(endpoint) {
  const type = NEKOBOT_MAP[endpoint] || "hentai";
  const res = await smartGet(`https://nekobot.xyz/api/image?type=${type}`, {
    timeout: 15000,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      Accept: "application/json",
    },
  });
  if (res.data?.success && res.data?.message) return res.data.message;
  throw new Error(`Nekobot: ${res.data?.message || "respons tidak valid"}`);
}

async function fetchWaifuPics(endpoint) {
  let lastErr;
  // 1. Coba Nekobot dulu (paling stabil)
  try {
    return await fetchNekobot(endpoint);
  } catch (err) {
    lastErr = err;
    console.warn(
      `⚠️ [NSFW] Nekobot gagal: ${err.message}, coba sumber lain...`,
    );
  }
  // 2. Fallback ke sumber lain
  for (const api of API_SOURCES) {
    try {
      const res = await smartGet(api.url(endpoint), {
        timeout: 15000,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
          Accept: "application/json",
        },
        validateStatus: (s) => s >= 200 && s < 400,
      });
      const url = api.parse(res.data);
      if (url) return url;
      lastErr = new Error(`${api.name}: format respons tidak dikenal`);
    } catch (err) {
      lastErr = err;
      console.warn(
        `⚠️ [NSFW] Sumber ${api.name} gagal: ${err.message}, coba sumber lain...`,
      );
    }
  }
  throw lastErr || new Error("Semua sumber API gagal");
}

// ── Helper: nhentai search via API (dengan DoH bypass + mirror fallback) ──
async function searchNhentai(query) {
  const sources = [
    { host: "nhentai.net", base: "https://nhentai.net" },
    { host: "nhentai.to", base: "https://nhentai.to" },
  ];
  let lastErr;
  for (const src of sources) {
    try {
      const res = await smartGet(`${src.base}/api/search`, {
        params: { query, sort: "popular" },
        timeout: 15000,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
          Accept: "application/json",
        },
        validateStatus: (s) => s >= 200 && s < 400,
      });
      const results = res.data?.result || [];
      if (results.length > 0) return results;
      lastErr = new Error(`${src.host}: hasil kosong / ${res.status}`);
    } catch (err) {
      lastErr = err;
      console.warn(`⚠️ [NSFW] Sumber doujin ${src.host} gagal: ${err.message}`);
    }
  }
  throw lastErr || new Error("Semua sumber doujin gagal");
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

      // ── .nsfwgif (random GIF) ──
      if (command === "nsfwgif") {
        await reply("⏳ Mengambil GIF...");
        const url = await fetchWaifuPics("gif");
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
          `🔞 ${command} • via Kitsune-BOT`,
        );
      }
    } catch (err) {
      console.error("❌ [NSFW] Error:", err.message);
      return reply(
        "❌ Gagal mengambil konten, semua sumber API sedang bermasalah (kemungkinan DNS/hosting diblokir). Coba lagi nanti.",
      );
    }
  },
};
