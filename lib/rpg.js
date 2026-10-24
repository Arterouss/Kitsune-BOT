// lib/rpg.js - Core RPG Engine, Database Manager & Game Logic
import fs from "fs";
import path from "path";

const DB_DIR = path.resolve("./database");
const DB_FILE = path.join(DB_DIR, "rpg_database.json");

// Ensure database directory & file exist
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

let dbCache = null;
let saveTimeout = null;

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
        potion_stamina: 1,
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
      },
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
  user.inventory.potion_stamina = user.inventory.potion_stamina ?? 0;

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
  // --- KONSUMSI ---
  {
    id: "potion_hp",
    name: "🧪 Ramuan HP",
    type: "consumable",
    price: 150,
    desc: "Pulihkan 60 HP",
  },
  {
    id: "potion_stamina",
    name: "⚡ Ramuan Stamina",
    type: "consumable",
    price: 200,
    desc: "Pulihkan 60 Stamina",
  },

  // --- SENJATA (PEDANG) TIER 1 - 5 ---
  {
    id: "pedang_bronze",
    name: "🗡️ Pedang Bronze",
    type: "weapon",
    stat: 15,
    price: 500,
    desc: "+15 ATK",
  },
  {
    id: "pedang_iron",
    name: "⚔️ Pedang Iron",
    type: "weapon",
    stat: 32,
    price: 1500,
    desc: "+32 ATK",
  },
  {
    id: "pedang_gold",
    name: "✨ Pedang Gold",
    type: "weapon",
    stat: 65,
    price: 4500,
    desc: "+65 ATK",
  },
  {
    id: "pedang_diamond",
    name: "💎 Pedang Diamond",
    type: "weapon",
    stat: 130,
    price: 15000,
    desc: "+130 ATK",
  },
  {
    id: "pedang_eternal",
    name: "👑 Pedang Eternal Abadi",
    type: "weapon",
    stat: 260,
    price: 50000,
    desc: "+260 ATK (Senjata Terkuat)",
  },

  // --- ZIRAH (ARMOR) TIER 1 - 5 ---
  {
    id: "zirah_bronze",
    name: "🛡️ Zirah Bronze",
    type: "armor",
    stat: 10,
    price: 400,
    desc: "+10 DEF",
  },
  {
    id: "zirah_iron",
    name: "🛡️ Zirah Iron",
    type: "armor",
    stat: 24,
    price: 1200,
    desc: "+24 DEF",
  },
  {
    id: "zirah_gold",
    name: "🛡️ Zirah Gold",
    type: "armor",
    stat: 50,
    price: 4000,
    desc: "+50 DEF",
  },
  {
    id: "zirah_diamond",
    name: "🛡️ Zirah Diamond",
    type: "armor",
    stat: 100,
    price: 12000,
    desc: "+100 DEF",
  },
  {
    id: "zirah_eternal",
    name: "👑 Zirah Eternal Abadi",
    type: "armor",
    stat: 200,
    price: 45000,
    desc: "+200 DEF (Pertahanan Mutlak)",
  },

  // --- BELIUNG (MINING) TIER 2 - 5 ---
  {
    id: "beliung_iron",
    name: "⛏️ Beliung Iron",
    type: "pickaxe",
    tier: 2,
    price: 800,
    desc: "Tier 2 (+Hasil Tambang 50%)",
  },
  {
    id: "beliung_gold",
    name: "🌟 Beliung Gold",
    type: "pickaxe",
    tier: 3,
    price: 3000,
    desc: "Tier 3 (+Hasil Tambang 100%)",
  },
  {
    id: "beliung_diamond",
    name: "💎 Beliung Diamond",
    type: "pickaxe",
    tier: 4,
    price: 10000,
    desc: "Tier 4 (+Chance Emas & Berlian)",
  },
  {
    id: "beliung_eternal",
    name: "👑 Beliung Eternal Abadi",
    type: "pickaxe",
    tier: 5,
    price: 35000,
    desc: "Tier 5 (Tambang Legendaris)",
  },
];

/**
 * Material selling prices to NPC
 */
export const MATERIAL_PRICES = {
  kayu: { name: "🪵 Kayu Hutan", price: 15 },
  batu: { name: "🪨 Batu Tambang", price: 20 },
  besi: { name: "⚙️ Bijih Besi", price: 65 },
  emas: { name: "🪙 Bijih Emas", price: 260 },
  berlian: { name: "💎 Berlian Murni", price: 1200 },
};

/**
 * Crafting recipes
 */
export const CRAFT_RECIPES = [
  {
    id: "pedang_besi",
    name: "⚔️ Pedang Besi Ksatria",
    type: "weapon",
    bonusAtk: 25,
    cost: { koin: 300, besi: 10, kayu: 5 },
    desc: "Pedang besi tempaan pandai besi (+25 Attack Power)",
  },
  {
    id: "pedang_emas",
    name: "✨ Pedang Emas Suci",
    type: "weapon",
    bonusAtk: 55,
    cost: { koin: 800, emas: 8, besi: 10 },
    desc: "Pedang bersepuh emas suci (+55 Attack Power)",
  },
  {
    id: "baju_zirah",
    name: "🛡️ Baju Zirah Besi",
    type: "armor",
    bonusDef: 18,
    cost: { koin: 500, besi: 12, kayu: 8 },
    desc: "Pelindung badan tebal (Menyerap hingga 18 damage monster)",
  },
  {
    id: "beliung_emas",
    name: "🌟 Beliung Emas Legendaris",
    type: "pickaxe",
    tier: 3,
    cost: { koin: 1000, emas: 10, besi: 5 },
    desc: "Beliung super tajam, kesempatan menemukan emas & berlian berlipat ganda",
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
