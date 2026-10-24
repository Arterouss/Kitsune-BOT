// lib/rpg.js - Core RPG Engine, Database Manager & Game Logic
import fs from "fs";
import path from "path";
import { MongoClient } from "mongodb";

const DB_DIR = path.resolve("./database");
const DB_FILE = path.join(DB_DIR, "rpg_database.json");

// Ensure database directory & file exist
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

let dbCache = null;
let saveTimeout = null;

// MongoDB Atlas Integration
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
let mongoClient = null;
let mongoCollection = null;
let isMongoConnected = false;
let isConnecting = false;
let lastMongoError = null;

/**
 * Initialize connection to MongoDB Atlas Cloud
 */
export async function initMongo() {
  if (isMongoConnected) return true;
  if (!MONGO_URI) {
    lastMongoError = "Environment variable MONGODB_URI belum diatur.";
    return false;
  }
  if (isConnecting) return false;
  isConnecting = true;

  try {
    mongoClient = new MongoClient(MONGO_URI, {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
    });
    await mongoClient.connect();
    const db = mongoClient.db("kitsune_bot");
    mongoCollection = db.collection("rpg_users");
    isMongoConnected = true;
    isConnecting = false;
    lastMongoError = null;
    console.log("🍃 [RPG DB] Berhasil terhubung ke MongoDB Atlas Cloud!");

    // Muat data pemain yang ada di MongoDB Atlas ke dalam memori
    const remoteDocs = await mongoCollection.find({}).toArray();
    if (remoteDocs.length > 0) {
      if (!dbCache) dbCache = { users: {} };
      let count = 0;
      for (const doc of remoteDocs) {
        if (doc._id) {
          const jid = String(doc._id);
          const { _id, ...userData } = doc;
          dbCache.users[jid] = userData;
          count++;
        }
      }
      saveRpgDbSync(dbCache);
      console.log(`🍃 [RPG DB] Berhasil memuat ${count} data petualang dari MongoDB Atlas!`);
    } else if (dbCache && Object.keys(dbCache.users).length > 0) {
      // Jika di cloud masih kosong, migrasikan data lokal saat ini ke cloud
      await syncAllToMongo();
    }
    return true;
  } catch (err) {
    isConnecting = false;
    isMongoConnected = false;
    lastMongoError = err.message;
    console.error("⚠️ [RPG DB] Gagal menghubungkan ke MongoDB Atlas:", err.message);
    return false;
  }
}

/**
 * Sync all local users to MongoDB Atlas
 */
async function syncAllToMongo() {
  if (!isMongoConnected || !mongoCollection || !dbCache?.users) return;
  try {
    const entries = Object.entries(dbCache.users);
    if (entries.length === 0) return;
    const ops = entries.map(([jid, userData]) => ({
      updateOne: {
        filter: { _id: jid },
        update: { $set: { ...userData, updatedAt: new Date() } },
        upsert: true,
      },
    }));
    await mongoCollection.bulkWrite(ops);
  } catch (err) {
    console.error("⚠️ [RPG DB] Gagal sinkronisasi data ke MongoDB Atlas:", err.message);
  }
}

// Otomatis inisialisasi koneksi jika MONGODB_URI tersedia
if (MONGO_URI) {
  initMongo().catch(() => {});
}

/**
 * Get current database status (Local vs MongoDB)
 */
export async function getDatabaseStatus(autoRetry = true) {
  if (!isMongoConnected && MONGO_URI && autoRetry && !isConnecting) {
    await initMongo().catch(() => {});
  }
  const userCount = dbCache?.users ? Object.keys(dbCache.users).length : 0;
  return {
    isMongoConnected,
    hasMongoUri: Boolean(MONGO_URI),
    lastError: lastMongoError,
    hasBracketWarning: Boolean(MONGO_URI && (MONGO_URI.includes('<') || MONGO_URI.includes('>'))),
    userCount,
    storageType: isMongoConnected
      ? "🍃 MongoDB Atlas Cloud Database (Data Permanen Aman)"
      : "💾 Penyimpanan File Lokal (database/rpg_database.json)",
  };
}

/**
 * Load RPG Database safely
 */
export function loadRpgDb() {
  if (dbCache) return dbCache;
  if (!fs.existsSync(DB_FILE)) {
    dbCache = { users: {} };
    saveRpgDbSync(dbCache);
    return dbCache;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, "utf-8");
    dbCache = JSON.parse(raw);
    if (!dbCache.users) dbCache.users = {};
    return dbCache;
  } catch (err) {
    console.error(
      "⚠️ [RPG] Error reading database, resetting memory cache:",
      err.message,
    );
    dbCache = { users: {} };
    return dbCache;
  }
}

/**
 * Save RPG Database synchronously (used for startup or urgent saves)
 */
export function saveRpgDbSync(data) {
  try {
    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(
      tempFile,
      JSON.stringify(data || dbCache, null, 2),
      "utf-8",
    );
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    console.error(
      "❌ [RPG] Failed to save database synchronously:",
      err.message,
    );
  }
}

/**
 * Debounced Save RPG Database to prevent excessive disk writes
 */
export function saveRpgDb() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveRpgDbSync(dbCache);
    if (isMongoConnected) {
      syncAllToMongo().catch(() => {});
    }
  }, 1000);
}

/**
 * Title mapping based on level
 */
export function getTitle(level) {
  if (level >= 50) return "🐉 Penakluk Naga Mythic";
  if (level >= 35) return "👑 Pahlawan Legendaris";
  if (level >= 20) return "🛡️ Panglima Perang";
  if (level >= 10) return "⚔️ Ksatria Perak";
  if (level >= 5) return "🥈 Petualang Berbakat";
  return "🥉 Petualang Pemula";
}

/**
 * Format milliseconds to Indonesian readable duration (e.g. "2 menit 15 detik")
 */
export function formatDuration(ms) {
  if (ms <= 0) return "0 detik";
  const seconds = Math.ceil((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor(ms / (1000 * 60 * 60));

  const parts = [];
  if (hours > 0) parts.push(`${hours} jam`);
  if (minutes > 0) parts.push(`${minutes} menit`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds} detik`);
  return parts.join(" ");
}

/**
 * Get or initialize user profile
 */
export function getUser(jid, pushName = "Petualang") {
  const db = loadRpgDb();
  if (!db.users[jid]) {
    db.users[jid] = {
      jid,
      name: pushName || "Petualang",
      level: 1,
      exp: 0,
      maxExp: 100,
      hp: 100,
      maxHp: 100,
      stamina: 100,
      maxStamina: 100,
      money: 500, // Starter gold
      title: "🥉 Petualang Pemula",
      inventory: {
        kayu: 5,
        batu: 5,
        besi: 0,
        emas: 0,
        berlian: 0,
        potion_hp: 2,
        potion_hp_besar: 0,
        potion_stamina: 1,
        potion_stamina_besar: 0,
        kitab_exp: 0,
        jimat_pelindung: 0,
        tiket_raid: 0,
      },
      equipment: {
        weaponId: "pedang_kayu",
        weapon: "🗡️ Pedang Kayu",
        weaponAtk: 5,
        armorId: "baju_kain",
        armor: "🛡️ Baju Kain",
        armorDef: 2,
        pickaxeId: "beliung_batu",
        pickaxe: "⛏️ Beliung Batu",
        pickaxeTier: 1,
      },
      armory: [
        {
          id: "pedang_kayu",
          name: "🗡️ Pedang Kayu",
          type: "weapon",
          stat: 5,
          price: 50,
        },
        {
          id: "baju_kain",
          name: "🛡️ Baju Kain",
          type: "armor",
          stat: 2,
          price: 30,
        },
        {
          id: "beliung_batu",
          name: "⛏️ Beliung Batu",
          type: "pickaxe",
          tier: 1,
          price: 50,
        },
      ],
      stats: {
        adventures: 0,
        monstersKilled: 0,
        timesDefeated: 0,
        minedCount: 0,
        pvpWins: 0,
        pvpLosses: 0,
        raidBossesKilled: 0,
        raidDamageDealt: 0,
        gachaCount: 0,
      },
      gachaPity: 0,
      cooldowns: {
        adventure: 0,
        mining: 0,
        daily: 0,
      },
      lastActive: Date.now(),
    };
    saveRpgDb();
  }

  const user = db.users[jid];
  if (pushName && pushName !== "Petualang" && user.name !== pushName) {
    user.name = pushName;
  }

  // Ensure newly added fields exist on older user records
  if (!user.inventory) user.inventory = {};
  user.inventory.kayu = user.inventory.kayu || 0;
  user.inventory.batu = user.inventory.batu || 0;
  user.inventory.besi = user.inventory.besi || 0;
  user.inventory.emas = user.inventory.emas || 0;
  user.inventory.berlian = user.inventory.berlian || 0;
  user.inventory.potion_hp = user.inventory.potion_hp ?? 0;
  user.inventory.potion_hp_besar = user.inventory.potion_hp_besar ?? 0;
  user.inventory.potion_stamina = user.inventory.potion_stamina ?? 0;
  user.inventory.potion_stamina_besar = user.inventory.potion_stamina_besar ?? 0;
  user.inventory.kitab_exp = user.inventory.kitab_exp ?? 0;
  user.inventory.jimat_pelindung = user.inventory.jimat_pelindung ?? 0;
  user.inventory.tiket_raid = user.inventory.tiket_raid ?? 0;

  if (!user.equipment) {
    user.equipment = {
      weaponId: "pedang_kayu",
      weapon: "🗡️ Pedang Kayu",
      weaponAtk: 5,
      armorId: "baju_kain",
      armor: "🛡️ Baju Kain",
      armorDef: 2,
      pickaxeId: "beliung_batu",
      pickaxe: "⛏️ Beliung Batu",
      pickaxeTier: 1,
    };
  }

  // Armory migration / initialization
  if (!user.armory || !Array.isArray(user.armory)) {
    user.armory = [
      {
        id: user.equipment.weaponId || "pedang_kayu",
        name: user.equipment.weapon || "🗡️ Pedang Kayu",
        type: "weapon",
        stat: user.equipment.weaponAtk || 5,
        price: 50,
      },
      {
        id: user.equipment.armorId || "baju_kain",
        name: user.equipment.armor || "🛡️ Baju Kain",
        type: "armor",
        stat: user.equipment.armorDef || 2,
        price: 30,
      },
      {
        id: user.equipment.pickaxeId || "beliung_batu",
        name: user.equipment.pickaxe || "⛏️ Beliung Batu",
        type: "pickaxe",
        tier: user.equipment.pickaxeTier || 1,
        price: 50,
      },
    ];
  }

  if (!user.stats) {
    user.stats = {
      adventures: 0,
      monstersKilled: 0,
      timesDefeated: 0,
      minedCount: 0,
      pvpWins: 0,
      pvpLosses: 0,
      raidBossesKilled: 0,
      raidDamageDealt: 0,
    };
  }
  user.stats.pvpWins = user.stats.pvpWins || 0;
  user.stats.pvpLosses = user.stats.pvpLosses || 0;
  user.stats.raidBossesKilled = user.stats.raidBossesKilled || 0;
  user.stats.raidDamageDealt = user.stats.raidDamageDealt || 0;
  user.stats.gachaCount = user.stats.gachaCount || 0;
  user.gachaPity = typeof user.gachaPity === "number" ? user.gachaPity : 0;

  if (!user.cooldowns) {
    user.cooldowns = { adventure: 0, mining: 0, daily: 0 };
  }

  // Natural Passive Regeneration (1 HP & 1 Stamina per 45 seconds offline)
  const now = Date.now();
  const lastActive = user.lastActive || now;
  const elapsedSec = Math.floor((now - lastActive) / 1000);
  if (elapsedSec >= 45) {
    const regenAmount = Math.floor(elapsedSec / 45);
    user.hp = Math.min(user.maxHp, (user.hp || 0) + regenAmount);
    user.stamina = Math.min(user.maxStamina, (user.stamina || 0) + regenAmount);
    user.lastActive = now;
    saveRpgDb();
  }

  user.title = getTitle(user.level);
  return user;
}

/**
 * Add EXP to user and process level-ups
 */
export function addExp(user, amount) {
  user.exp += amount;
  let leveledUp = false;
  let oldLevel = user.level;

  while (user.exp >= user.maxExp) {
    user.exp -= user.maxExp;
    user.level += 1;
    leveledUp = true;
    user.maxExp = user.level * 100;
    user.maxHp += 15;
    user.hp = user.maxHp; // Full heal upon level up
    user.maxStamina += 10;
    user.stamina = user.maxStamina; // Full stamina upon level up
    user.money += user.level * 150; // Bonus gold reward
  }

  user.title = getTitle(user.level);
  saveRpgDb();

  return {
    leveledUp,
    oldLevel,
    newLevel: user.level,
    bonusMoney: leveledUp ? (user.level - oldLevel) * (user.level * 150) : 0,
  };
}

/**
 * Shop items catalog with full Bronze to Eternal tiers
 */
export const SHOP_ITEMS = [
  // --- KONSUMSI & ITEM PENDUKUNG ---
  {
    id: "potion_hp",
    name: "🧪 Ramuan HP",
    type: "consumable",
    price: 80,
    desc: "Pulihkan 60 HP",
  },
  {
    id: "potion_hp_besar",
    name: "🧪 Ramuan HP Besar",
    type: "consumable",
    price: 200,
    desc: "Pulihkan 160 HP",
  },
  {
    id: "potion_stamina",
    name: "⚡ Ramuan Stamina",
    type: "consumable",
    price: 100,
    desc: "Pulihkan 60 Stamina",
  },
  {
    id: "potion_stamina_besar",
    name: "⚡ Ramuan Stamina Besar",
    type: "consumable",
    price: 240,
    desc: "Pulihkan 120 Stamina",
  },
  {
    id: "kitab_exp",
    name: "📖 Kitab Pengalaman",
    type: "consumable",
    price: 450,
    desc: "+250 EXP Instan",
  },
  {
    id: "jimat_pelindung",
    name: "🧿 Jimat Pelindung",
    type: "consumable",
    price: 300,
    desc: "Cegah luka HP saat kalah petualang",
  },
  {
    id: "tiket_raid",
    name: "🎫 Tiket Raid",
    type: "consumable",
    price: 1200,
    desc: "Reset Cooldown World Boss grup",
  },

  // --- SENJATA (PEDANG TIER 1 - 5) ---
  {
    id: "pedang_batu",
    name: "🗡️ Pedang Batu",
    type: "weapon",
    stat: 12,
    price: 180,
    desc: "+12 ATK",
  },
  {
    id: "pedang_besi",
    name: "⚔️ Pedang Besi",
    type: "weapon",
    stat: 30,
    price: 600,
    desc: "+30 ATK",
  },
  {
    id: "pedang_emas",
    name: "✨ Pedang Emas",
    type: "weapon",
    stat: 65,
    price: 1800,
    desc: "+65 ATK",
  },
  {
    id: "pedang_berlian",
    name: "💎 Pedang Berlian",
    type: "weapon",
    stat: 135,
    price: 4500,
    desc: "+135 ATK",
  },
  {
    id: "pedang_eternal",
    name: "🗡️ Pedang Eternal",
    type: "weapon",
    stat: 270,
    price: 12000,
    desc: "+270 ATK",
  },

  // --- ZIRAH (ARMOR TIER 1 - 5) ---
  {
    id: "zirah_kulit",
    name: "🛡️ Zirah Kulit",
    type: "armor",
    stat: 8,
    price: 150,
    desc: "+8 DEF",
  },
  {
    id: "zirah_besi",
    name: "🛡️ Zirah Besi",
    type: "armor",
    stat: 22,
    price: 500,
    desc: "+22 DEF",
  },
  {
    id: "zirah_emas",
    name: "🛡️ Zirah Emas",
    type: "armor",
    stat: 50,
    price: 1500,
    desc: "+50 DEF",
  },
  {
    id: "zirah_berlian",
    name: "🛡️ Zirah Berlian",
    type: "armor",
    stat: 105,
    price: 3800,
    desc: "+105 DEF",
  },
  {
    id: "zirah_eternal",
    name: "🛡️ Zirah Eternal",
    type: "armor",
    stat: 210,
    price: 10000,
    desc: "+210 DEF",
  },

  // --- BELIUNG (MINING TIER 2 - 5) ---
  {
    id: "beliung_besi",
    name: "⛏️ Beliung Besi",
    type: "pickaxe",
    tier: 2,
    price: 400,
    desc: "Tier 2",
  },
  {
    id: "beliung_emas",
    name: "⛏️ Beliung Emas",
    type: "pickaxe",
    tier: 3,
    price: 1200,
    desc: "Tier 3",
  },
  {
    id: "beliung_berlian",
    name: "⛏️ Beliung Berlian",
    type: "pickaxe",
    tier: 4,
    price: 3200,
    desc: "Tier 4",
  },
  {
    id: "beliung_eternal",
    name: "⛏️ Beliung Eternal",
    type: "pickaxe",
    tier: 5,
    price: 8500,
    desc: "Tier 5",
  },
];

/**
 * Material selling prices to NPC
 */
export const MATERIAL_PRICES = {
  kayu: { name: "🪵 Kayu", price: 15 },
  batu: { name: "🪨 Batu", price: 20 },
  besi: { name: "⚙️ Besi", price: 65 },
  emas: { name: "🪙 Emas", price: 260 },
  berlian: { name: "💎 Berlian", price: 1200 },
};

/**
 * Crafting recipes with level requirements (minLv)
 */
export const CRAFT_RECIPES = [
  // --- TIER 1: PEMULA (MIN LV. 1) ---
  {
    id: "pedang_batu",
    name: "🗡️ Pedang Batu",
    type: "weapon",
    minLv: 1,
    bonusAtk: 12,
    cost: { koin: 40, batu: 15, kayu: 10 },
    desc: "+12 ATK",
  },
  {
    id: "zirah_kulit",
    name: "🛡️ Zirah Kulit",
    type: "armor",
    minLv: 1,
    bonusDef: 8,
    cost: { koin: 30, kayu: 15, batu: 5 },
    desc: "+8 DEF",
  },
  {
    id: "beliung_batu",
    name: "⛏️ Beliung Batu",
    type: "pickaxe",
    tier: 1,
    minLv: 1,
    cost: { koin: 20, batu: 10, kayu: 10 },
    desc: "Tier 1",
  },

  // --- TIER 2: BESI (MIN LV. 5) ---
  {
    id: "pedang_besi",
    name: "⚔️ Pedang Besi",
    type: "weapon",
    minLv: 5,
    bonusAtk: 30,
    cost: { koin: 120, besi: 15, kayu: 10 },
    desc: "+30 ATK",
  },
  {
    id: "zirah_besi",
    name: "🛡️ Zirah Besi",
    type: "armor",
    minLv: 5,
    bonusDef: 22,
    cost: { koin: 100, besi: 18, batu: 10 },
    desc: "+22 DEF",
  },
  {
    id: "beliung_besi",
    name: "⛏️ Beliung Besi",
    type: "pickaxe",
    tier: 2,
    minLv: 5,
    cost: { koin: 80, besi: 12, kayu: 8 },
    desc: "Tier 2",
  },

  // --- TIER 3: EMAS (MIN LV. 12) ---
  {
    id: "pedang_emas",
    name: "✨ Pedang Emas",
    type: "weapon",
    minLv: 12,
    bonusAtk: 65,
    cost: { koin: 350, emas: 14, besi: 12 },
    desc: "+65 ATK",
  },
  {
    id: "zirah_emas",
    name: "🛡️ Zirah Emas",
    type: "armor",
    minLv: 12,
    bonusDef: 50,
    cost: { koin: 300, emas: 16, besi: 14 },
    desc: "+50 DEF",
  },
  {
    id: "beliung_emas",
    name: "⛏️ Beliung Emas",
    type: "pickaxe",
    tier: 3,
    minLv: 12,
    cost: { koin: 250, emas: 10, besi: 10 },
    desc: "Tier 3",
  },

  // --- TIER 4: BERLIAN (MIN LV. 20) ---
  {
    id: "pedang_berlian",
    name: "💎 Pedang Berlian",
    type: "weapon",
    minLv: 20,
    bonusAtk: 135,
    cost: { koin: 900, berlian: 8, emas: 15 },
    desc: "+135 ATK",
  },
  {
    id: "zirah_berlian",
    name: "🛡️ Zirah Berlian",
    type: "armor",
    minLv: 20,
    bonusDef: 105,
    cost: { koin: 800, berlian: 10, emas: 18 },
    desc: "+105 DEF",
  },
  {
    id: "beliung_berlian",
    name: "⛏️ Beliung Berlian",
    type: "pickaxe",
    tier: 4,
    minLv: 20,
    cost: { koin: 650, berlian: 6, emas: 12 },
    desc: "Tier 4",
  },

  // --- TIER 5: ETERNAL (MIN LV. 30) ---
  {
    id: "pedang_eternal",
    name: "🗡️ Pedang Eternal",
    type: "weapon",
    minLv: 30,
    bonusAtk: 270,
    cost: { koin: 2500, berlian: 20, emas: 35, besi: 50 },
    desc: "+270 ATK",
  },
  {
    id: "zirah_eternal",
    name: "🛡️ Zirah Eternal",
    type: "armor",
    minLv: 30,
    bonusDef: 210,
    cost: { koin: 2000, berlian: 22, emas: 40, besi: 50 },
    desc: "+210 DEF",
  },
  {
    id: "beliung_eternal",
    name: "⛏️ Beliung Eternal",
    type: "pickaxe",
    tier: 5,
    minLv: 30,
    cost: { koin: 1600, berlian: 15, emas: 25, besi: 40 },
    desc: "Tier 5",
  },
];

/**
 * Monster pools for adventure based on player level
 */
export const MONSTERS = [
  {
    name: "Slime",
    minLv: 1,
    baseHp: 30,
    atk: 12,
    expMin: 25,
    expMax: 45,
    goldMin: 80,
    goldMax: 160,
  },
  {
    name: "Serigala",
    minLv: 1,
    baseHp: 45,
    atk: 18,
    expMin: 35,
    expMax: 65,
    goldMin: 120,
    goldMax: 220,
  },
  {
    name: "Goblin",
    minLv: 2,
    baseHp: 60,
    atk: 22,
    expMin: 50,
    expMax: 85,
    goldMin: 160,
    goldMax: 300,
  },
  {
    name: "Orc",
    minLv: 4,
    baseHp: 90,
    atk: 30,
    expMin: 80,
    expMax: 130,
    goldMin: 250,
    goldMax: 450,
  },
  {
    name: "Golem",
    minLv: 7,
    baseHp: 130,
    atk: 40,
    expMin: 120,
    expMax: 200,
    goldMin: 400,
    goldMax: 700,
  },
  {
    name: "Naga",
    minLv: 10,
    baseHp: 180,
    atk: 55,
    expMin: 200,
    expMax: 350,
    goldMin: 700,
    goldMax: 1200,
  },
];

/**
 * World Raid Bosses for group events
 */
export const RAID_BOSSES = [
  {
    id: "goblin",
    name: "Raja Goblin",
    title: "Boss Rank C",
    hp: 2500,
    atk: 25,
    rewardGold: 8000,
    rewardExp: 2000,
    drops: { berlian: 1, emas: 5, besi: 15 },
  },
  {
    id: "troll",
    name: "Troll",
    title: "Boss Rank B",
    hp: 4000,
    atk: 38,
    rewardGold: 14000,
    rewardExp: 3500,
    drops: { berlian: 3, emas: 10, besi: 25 },
  },
  {
    id: "naga",
    name: "Naga",
    title: "Boss Rank A",
    hp: 6000,
    atk: 50,
    rewardGold: 22000,
    rewardExp: 5500,
    drops: { berlian: 6, emas: 20, besi: 40 },
  },
  {
    id: "raja_iblis",
    name: "Raja Iblis",
    title: "Boss Rank S (Tertinggi)",
    hp: 9000,
    atk: 65,
    rewardGold: 35000,
    rewardExp: 9000,
    drops: { berlian: 10, emas: 35, besi: 60 },
  },
];

/**
 * Add equipment to armory
 */
export function addToArmory(user, item) {
  if (!user.armory) user.armory = [];
  const exists = user.armory.find((a) => a.id === item.id);
  if (!exists) {
    user.armory.push({
      id: item.id,
      name: item.name,
      type: item.type,
      stat: item.stat || 0,
      tier: item.tier || 1,
      price: item.price || 100,
    });
    return true;
  }
  return false;
}

/**
 * Equip an item from armory
 */
export function equipFromArmory(user, idOrQuery) {
  if (!user.armory || user.armory.length === 0)
    return { success: false, msg: "Lemari senjatamu kosong!" };

  const query = String(idOrQuery).toLowerCase().trim();
  const item = user.armory.find(
    (a, i) =>
      String(i + 1) === query ||
      a.id.toLowerCase() === query ||
      a.name.toLowerCase().includes(query),
  );

  if (!item)
    return {
      success: false,
      msg: "Barang tidak ditemukan di lemarimu! Ketik *.lemari* untuk cek koleksi.",
    };

  if (item.type === "weapon") {
    if (user.equipment.weaponId === item.id)
      return { success: false, msg: `${item.name} sudah kamu pasang!` };
    user.equipment.weaponId = item.id;
    user.equipment.weapon = item.name;
    user.equipment.weaponAtk = item.stat;
    return { success: true, item, slot: "Senjata" };
  } else if (item.type === "armor") {
    if (user.equipment.armorId === item.id)
      return { success: false, msg: `${item.name} sudah kamu pasang!` };
    user.equipment.armorId = item.id;
    user.equipment.armor = item.name;
    user.equipment.armorDef = item.stat;
    return { success: true, item, slot: "Zirah" };
  } else if (item.type === "pickaxe") {
    if (user.equipment.pickaxeId === item.id)
      return { success: false, msg: `${item.name} sudah kamu pasang!` };
    user.equipment.pickaxeId = item.id;
    user.equipment.pickaxe = item.name;
    user.equipment.pickaxeTier = item.tier;
    return { success: true, item, slot: "Beliung" };
  }

  return { success: false, msg: "Tipe barang tidak dapat dipasang!" };
}

/**
 * Sell an item from armory (refunds 50% value)
 */
export function sellFromArmory(user, idOrQuery) {
  if (!user.armory || user.armory.length === 0)
    return { success: false, msg: "Lemari senjatamu kosong!" };

  const query = String(idOrQuery).toLowerCase().trim();
  const index = user.armory.findIndex(
    (a, i) =>
      String(i + 1) === query ||
      a.id.toLowerCase() === query ||
      a.name.toLowerCase().includes(query),
  );

  if (index === -1)
    return {
      success: false,
      msg: "Barang tidak ditemukan di lemarimu! Ketik *.lemari* untuk cek koleksi.",
    };

  const item = user.armory[index];

  // Prevent selling currently equipped items
  if (
    user.equipment.weaponId === item.id ||
    user.equipment.armorId === item.id ||
    user.equipment.pickaxeId === item.id
  ) {
    return {
      success: false,
      msg: `⚠️ ${item.name} sedang terpasang di tubuhmu!\nPasang perlengkapan lain dulu lewat *.equip* sebelum menjualnya.`,
    };
  }

  const refund = Math.floor((item.price || 100) * 0.5);
  user.armory.splice(index, 1);
  user.money += refund;

  return { success: true, item, refund };
}

/**
 * Gacha Banner Pools (Exclusive 5★ items NOT available in shop)
 */
export const GACHA_POOL_5_STAR = [
  {
    id: "pedang_excalibur",
    name: "⚔️ Pedang Excalibur",
    type: "weapon",
    stat: 400,
    price: 18000,
    rarity: "⭐⭐⭐⭐⭐",
    desc: "Pedang suci cahaya legendaris terkuat (+400 ATK)",
  },
  {
    id: "pedang_muramasa",
    name: "🗡️ Pedang Muramasa",
    type: "weapon",
    stat: 360,
    price: 15000,
    rarity: "⭐⭐⭐⭐⭐",
    desc: "Pedang terkutuk haus darah (+360 ATK)",
  },
  {
    id: "zirah_aegis",
    name: "🛡️ Zirah Aegis",
    type: "armor",
    stat: 290,
    price: 15000,
    rarity: "⭐⭐⭐⭐⭐",
    desc: "Pelindung suci dewa Olympus (+290 DEF)",
  },
  {
    id: "beliung_mithril",
    name: "⛏️ Beliung Mithril",
    type: "pickaxe",
    tier: 6,
    price: 14000,
    rarity: "⭐⭐⭐⭐⭐",
    desc: "Beliung kuno penambang kristal suci (Tier 6)",
  },
];

export const GACHA_POOL_4_STAR = [
  {
    type: "equipment",
    item: {
      id: "pedang_naga",
      name: "🗡️ Pedang Sisik Naga",
      type: "weapon",
      stat: 175,
      price: 5500,
      rarity: "⭐⭐⭐⭐",
    },
    label: "🗡️ Pedang Sisik Naga (+175 ATK)",
  },
  {
    type: "equipment",
    item: {
      id: "zirah_naga",
      name: "🛡️ Zirah Sisik Naga",
      type: "armor",
      stat: 135,
      price: 4500,
      rarity: "⭐⭐⭐⭐",
    },
    label: "🛡️ Zirah Sisik Naga (+135 DEF)",
  },
  {
    type: "inventory",
    field: "berlian",
    amount: 3,
    label: "💎 3x Berlian Murni",
  },
  {
    type: "inventory",
    field: "emas",
    amount: 10,
    label: "🪙 10x Bijih Emas",
  },
  {
    type: "inventory",
    field: "tiket_raid",
    amount: 1,
    label: "🎫 1x Tiket Raid",
  },
];

export const GACHA_POOL_3_STAR = [
  {
    type: "inventory",
    field: "potion_hp_besar",
    amount: 2,
    label: "🧪 2x Ramuan HP Besar",
  },
  {
    type: "inventory",
    field: "potion_stamina_besar",
    amount: 2,
    label: "⚡ 2x Ramuan Stamina Besar",
  },
  {
    type: "inventory",
    field: "kitab_exp",
    amount: 1,
    label: "📖 1x Kitab Pengalaman (+250 EXP)",
  },
  {
    type: "inventory",
    field: "jimat_pelindung",
    amount: 1,
    label: "🧿 1x Jimat Pelindung",
  },
  {
    type: "inventory",
    field: "besi",
    amount: 8,
    label: "⚙️ 8x Bijih Besi",
  },
  {
    type: "inventory",
    field: "batu",
    amount: 15,
    label: "🪨 15x Batu Gua",
  },
  {
    type: "gold",
    amount: 250,
    label: "💰 250 Gold Cashback",
  },
];

/**
 * Execute Gacha Roll with Pity 50 system
 */
export function rollGacha(user, times = 1) {
  times = times === 10 ? 10 : 1;
  const cost = times === 10 ? 1350 : 150;

  if (user.money < cost) {
    return {
      success: false,
      msg: `💸 Koin tidak cukup untuk Gacha!\nButuh: *${cost.toLocaleString("id-ID")} Gold* (Koinmu: ${user.money.toLocaleString("id-ID")}).`,
    };
  }

  user.money -= cost;
  const pullResults = [];
  let got5Star = false;

  for (let i = 0; i < times; i++) {
    user.gachaPity = (user.gachaPity || 0) + 1;
    user.stats.gachaCount = (user.stats.gachaCount || 0) + 1;

    let star = 3;
    let isPityGuaranteed = false;

    if (user.gachaPity >= 50) {
      star = 5;
      isPityGuaranteed = true;
    } else {
      const rand = Math.random();
      if (rand < 0.025) {
        star = 5;
      } else if (rand < 0.20) {
        star = 4;
      } else {
        star = 3;
      }
    }

    if (star === 5) {
      got5Star = true;
      user.gachaPity = 0; // Reset pity
      const item =
        GACHA_POOL_5_STAR[Math.floor(Math.random() * GACHA_POOL_5_STAR.length)];

      const alreadyHave =
        user.armory && user.armory.some((a) => a.id === item.id);
      if (alreadyHave) {
        user.inventory.berlian = (user.inventory.berlian || 0) + 5;
        user.money += 1000;
        pullResults.push({
          star: 5,
          isPity: isPityGuaranteed,
          text: `👑 5★ [MYTHIC] *${item.name}* _(Duplikat: Dikonversi jadi +5 Berlian & +1.000 Gold!)_`,
        });
      } else {
        addToArmory(user, {
          id: item.id,
          name: item.name,
          type: item.type,
          stat: item.stat,
          tier: item.tier || 5,
          price: item.price,
        });
        pullResults.push({
          star: 5,
          isPity: isPityGuaranteed,
          text: `👑 5★ [MYTHIC EXCLUSIVE] *${item.name}*! (${item.desc})`,
        });
      }
    } else if (star === 4) {
      const pick =
        GACHA_POOL_4_STAR[Math.floor(Math.random() * GACHA_POOL_4_STAR.length)];
      if (pick.type === "equipment") {
        const alreadyHave =
          user.armory && user.armory.some((a) => a.id === pick.item.id);
        if (alreadyHave) {
          user.inventory.berlian = (user.inventory.berlian || 0) + 2;
          user.money += 300;
          pullResults.push({
            star: 4,
            text: `✨ 4★ [EPIC] *${pick.item.name}* _(Duplikat: Dikonversi jadi +2 Berlian & +300 Gold)_`,
          });
        } else {
          addToArmory(user, pick.item);
          pullResults.push({
            star: 4,
            text: `✨ 4★ [EPIC] *${pick.label}*`,
          });
        }
      } else {
        user.inventory[pick.field] =
          (user.inventory[pick.field] || 0) + pick.amount;
        pullResults.push({
          star: 4,
          text: `✨ 4★ [EPIC] *${pick.label}*`,
        });
      }
    } else {
      const pick =
        GACHA_POOL_3_STAR[Math.floor(Math.random() * GACHA_POOL_3_STAR.length)];
      if (pick.type === "gold") {
        user.money += pick.amount;
        pullResults.push({
          star: 3,
          text: `⚪ 3★ [RARE] *${pick.label}*`,
        });
      } else {
        user.inventory[pick.field] =
          (user.inventory[pick.field] || 0) + pick.amount;
        pullResults.push({
          star: 3,
          text: `⚪ 3★ [RARE] *${pick.label}*`,
        });
      }
    }
  }

  saveRpgDb();
  return {
    success: true,
    times,
    cost,
    pity: user.gachaPity,
    got5Star,
    results: pullResults,
  };
}
