// plugins/rpg.js - Fitur Game RPG Petualang, Leveling, Mining, Crafting, & Ekonomi
import {
  getUser,
  saveRpgDb,
  loadRpgDb,
  addExp,
  formatDuration,
  SHOP_ITEMS,
  MATERIAL_PRICES,
  CRAFT_RECIPES,
  MONSTERS,
  RAID_BOSSES,
  GACHA_POOL_ETERNAL,
  addToArmory,
  equipFromArmory,
  sellFromArmory,
  rollGacha,
  getDatabaseStatus,
  recordBotMsg,
  PET_TYPES,
  getPetBuff,
  addPetExp
} from '../lib/rpg.js';

// Global memory state for active group duels & boss raids
global.rpgDuels = global.rpgDuels || {};
global.rpgRaids = global.rpgRaids || {};
global.rpgRaidCooldowns = global.rpgRaidCooldowns || {};

// Visual progress bar helper
function renderBar(current, max, length = 10) {
  const percent = Math.max(0, Math.min(1, current / max));
  const filled = Math.round(percent * length);
  const empty = length - filled;
  return '■'.repeat(filled) + '□'.repeat(empty);
}

// Format numbers with thousand separators (e.g. 10.000)
function formatNumber(num) {
  return Number(num || 0).toLocaleString('id-ID');
}

export default {
  name: 'rpg',
  command: [
    'profile', 'status', 'me',
    'inv', 'inventory', 'tas',
    'armory', 'lemari', 'koleksi',
    'equip', 'pasang',
    'jualeq', 'selleq',
    'adventure', 'petualang', 'adv',
    'mining', 'nambang', 'mine',
    'heal', 'obat',
    'use', 'pakai', 'minum',
    'daily', 'klaim',
    'shop', 'toko',
    'buy', 'beli',
    'sell', 'jual',
    'craft', 'tempa',
    'gacha', 'pull',
    'leaderboard', 'top', 'lb',
    'transfer', 'pay',
    'duel', 'pvp', 'terima', 'terimaduel', 'gas', 'tolak', 'tolakduel',
    'raid', 'boss', 'serang', 'hit', 'attack', 'cekkondisi', 'tagraid', 'ajakraid',
    'bank', 'nabung', 'depo', 'tarik', 'wd',
    'slot', 'spin', 'coinflip', 'cf',
    'pet', 'adopt', 'adopsi', 'feed', 'kasihmakan', 'renamepet',
    'token', 'tokenmistis', 'koinmistis',
    'dbstatus', 'cekdb'
  ],
  category: 'rpg',
  description: 'Sistem Petualangan RPG, Pet Companion, Kasino, Bank, Leveling, Mining, Toko, Duel PvP, dan Boss Raid',
  async run({ sock, jid, msg, command, args, prefix, sender, senderName, isGroup, reply }) {
    const user = getUser(sender, senderName);
    const now = Date.now();

    // ──────────────────────────────────────────────────────────
    // 1. PROFIL & STATUS PEMAIN (.profile / .status / .me)
    // ──────────────────────────────────────────────────────────
    if (['profile', 'status', 'me'].includes(command)) {
      const expBar = renderBar(user.exp, user.maxExp, 8);
      const hpBar = renderBar(user.hp, user.maxHp, 8);
      const staBar = renderBar(user.stamina, user.maxStamina, 8);

      let petInfo = `_Belum punya pet_ (Ketik *${prefix}pet*)`;
      if (user.pet && user.pet.type) {
        const petConfig = PET_TYPES[user.pet.type];
        const petTypeName = petConfig?.name || user.pet.type;
        const hungerStatus = (user.pet.hunger || 0) <= 0 ? '⚠️ *Kelaparan!*' : `${user.pet.hunger || 0}%`;
        petInfo = `*${user.pet.name}* (${petTypeName} Lv. ${user.pet.level || 1})\n┃    └ 🍖 Hunger: [${renderBar(user.pet.hunger || 0, 100, 6)}] ${hungerStatus}`;
      }

      const text = `
╭━━━━━「 👤 *PROFIL PETUALANG* 」━━━━━╮
┃ 🏷️ *Nama:* ${user.name}
┃ 🎖️ *Pangkat:* ${user.title} (Lv. ${user.level})
┃ 💰 *Dompet:* ${formatNumber(user.money)} Gold
┃ 🏦 *Tabungan Bank:* ${formatNumber(user.bank || 0)} Gold
┃ 🔮 *Token Mistis:* ${formatNumber(user.token || 0)} Token
┃
┃ ❤️ *HP:* [${hpBar}] ${user.hp}/${user.maxHp}
┃ ⚡ *Stamina:* [${staBar}] ${user.stamina}/${user.maxStamina}
┃ 📊 *EXP:* [${expBar}] ${user.exp}/${user.maxExp}
┃
┃ 🗡️ *Senjata:* ${user.equipment.weapon} (+${user.equipment.weaponAtk} ATK)
┃ 🛡️ *Zirah:* ${user.equipment.armor} (+${user.equipment.armorDef} DEF)
┃ ⛏️ *Beliung:* ${user.equipment.pickaxe}
┃ 🐾 *Pet:* ${petInfo}
┃ 🎯 *Pity Mythic (5★):* ${user.gachaPity || 0}/120
┃ 🌌 *Pity Eternal (6★):* ${user.gachaPityEternal || 0}/500
┃
┃ 📜 *Catatan Petualang:*
┃  • Menang Adventure: ${formatNumber(user.stats.adventures)} kali
┃  • Monster Dibantai: ${formatNumber(user.stats.monstersKilled)} ekor
┃  • Tambang Dikeruk: ${formatNumber(user.stats.minedCount)} kali
┃  • Menang Duel PvP: ${user.stats.pvpWins || 0}W / ${user.stats.pvpLosses || 0}L
┃  • Boss Raid Gugur: ${user.stats.raidBossesKilled || 0} ekor
┃  • Total Tarikan Gacha: ${formatNumber(user.stats.gachaCount || 0)} kali
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

💡 _Ketik *${prefix}adventure* untuk bertualang, *${prefix}bank* untuk menabung, atau *${prefix}pet* untuk kelola hewan peliharaan._
`.trim();

      return reply(text);
    }

    // ──────────────────────────────────────────────────────────
    // 2. INVENTORY / TAS PENYIMPANAN (.inv / .inventory / .tas)
    // ──────────────────────────────────────────────────────────
    if (['inv', 'inventory', 'tas'].includes(command)) {
      const inv = user.inventory;
      const text = `
╭━━━━━「 🎒 *TAS PENYIMPANAN* 」━━━━━╮
┃ 👤 *Pemilik:* ${user.name} (Lv. ${user.level})
┃ 💰 *Saldo Koin:* ${formatNumber(user.money)} Gold
┃ 🔮 *Token Mistis:* ${formatNumber(user.token || 0)} Token
┃
┃ 🪵 *Hasil Alam & Tambang:*
┃  • Kayu Hutan: ${formatNumber(inv.kayu)}
┃  • Batu Gua: ${formatNumber(inv.batu)}
┃  • Bijih Besi: ${formatNumber(inv.besi)}
┃  • Bijih Emas: ${formatNumber(inv.emas)}
┃  • Berlian Murni: ${formatNumber(inv.berlian)}
┃
┃ 🧪 *Ramuan & Item Pendukung:*
┃  • Ramuan HP (+60): ${formatNumber(inv.potion_hp)} buah
┃  • Ramuan HP Besar (+160): ${formatNumber(inv.potion_hp_besar)} buah
┃  • Ramuan Stamina (+60): ${formatNumber(inv.potion_stamina)} buah
┃  • Ramuan Stamina Besar (+120): ${formatNumber(inv.potion_stamina_besar)} buah
┃  • Kitab Pengalaman (+250 EXP): ${formatNumber(inv.kitab_exp)} buku
┃  • Jimat Pelindung (Anti Kalah): ${formatNumber(inv.jimat_pelindung)} buah
┃  • Tiket Boss Raid: ${formatNumber(inv.tiket_raid)} tiket
┃  • Makanan Pet: ${formatNumber(inv.makanan_pet || 0)} porsi
┃
┃ ⚔️ *Perlengkapan Terpasang:*
┃  • ${user.equipment.weapon} (+${user.equipment.weaponAtk} ATK)
┃  • ${user.equipment.armor} (+${user.equipment.armorDef} DEF)
┃  • ${user.equipment.pickaxe}
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

💡 *Menu Interaksi:*
• Ketik *${prefix}use <item>* untuk memakai item pendukung.
• Ketik *${prefix}feed* untuk memberi makan pet peliharaanmu.
• Ketik *${prefix}jual <nama/all>* untuk jual hasil tambang ke toko.
• Ketik *${prefix}craft* untuk membuka bengkel tempa perlengkapan.
• Ketik *${prefix}shop* untuk membeli ramuan & perlengkapan baru.
`.trim();

      return reply(text);
    }

    // ──────────────────────────────────────────────────────────
    // 2B. LEMARI KOLEKSI SENJATA & ZIRAH (.armory / .lemari / .koleksi)
    // ──────────────────────────────────────────────────────────
    if (['armory', 'lemari', 'koleksi'].includes(command)) {
      const armory = user.armory || [];
      if (armory.length === 0) {
        return reply(`🚪 Lemari senjatamu masih kosong!\nBeli perlengkapan di *${prefix}shop* atau buat di *${prefix}craft*.`);
      }

      const weapons = armory.filter(i => i.type === 'weapon');
      const armors = armory.filter(i => i.type === 'armor');
      const pickaxes = armory.filter(i => i.type === 'pickaxe');

      const weaponsList = weapons.map((w, i) => {
        const isEquipped = user.equipment.weaponId === w.id || user.equipment.weapon === w.name ? ' ✅ *[DIPAKAI]*' : '';
        return `  ${i + 1}. \`${w.id}\` - ${w.name} (+${w.stat} ATK)${isEquipped}`;
      }).join('\n') || '  _(Kosong)_';

      const armorsList = armors.map((a, i) => {
        const isEquipped = user.equipment.armorId === a.id || user.equipment.armor === a.name ? ' ✅ *[DIPAKAI]*' : '';
        return `  ${i + 1}. \`${a.id}\` - ${a.name} (+${a.stat} DEF)${isEquipped}`;
      }).join('\n') || '  _(Kosong)_';

      const pickaxesList = pickaxes.map((p, i) => {
        const isEquipped = user.equipment.pickaxeId === p.id || user.equipment.pickaxe === p.name ? ' ✅ *[DIPAKAI]*' : '';
        return `  ${i + 1}. \`${p.id}\` - ${p.name} (Tier ${p.tier || 1})${isEquipped}`;
      }).join('\n') || '  _(Kosong)_';

      const text = `
╭━━━━━「 🚪 *LEMARI PERLENGKAPAN* 」━━━━━╮
┃ 👤 *Pemilik:* ${user.name} (Lv. ${user.level})
┃ 💰 *Koin:* ${formatNumber(user.money)} Gold
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

🗡️ *Koleksi Senjata:*
${weaponsList}

🛡️ *Koleksi Zirah:*
${armorsList}

⛏️ *Koleksi Beliung:*
${pickaxesList}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 *Pasang:* \`${prefix}equip <id>\` (Contoh: \`${prefix}equip pedang_iron\`)
💡 *Jual Bekas:* \`${prefix}jualeq <id>\` (Dapat refund 50% koin)
`.trim();

      return reply(text);
    }

    // ──────────────────────────────────────────────────────────
    // 2C. MEMASANG PERLENGKAPAN DARI LEMARI (.equip / .pasang)
    // ──────────────────────────────────────────────────────────
    if (['equip', 'pasang'].includes(command)) {
      if (!args) {
        return reply(`⚠️ Masukkan ID perlengkapan yang ingin dipasang!\nContoh: *${prefix}equip pedang_iron*\nKetik *${prefix}lemari* untuk melihat koleksi lemarimu.`);
      }

      const res = equipFromArmory(user, args);
      if (!res.success) {
        return reply(`❌ ${res.msg}`);
      }

      saveRpgDb();
      return reply(`✅ *PERLENGKAPAN BERHASIL DIPASANG!*\n${res.item.name} kini menjadi *${res.slot} Aktif* karaktermu!\nCek status barumu di *${prefix}profile*.`);
    }

    // ──────────────────────────────────────────────────────────
    // 2D. MENJUAL PERLENGKAPAN BEKAS (.jualeq / .selleq)
    // ──────────────────────────────────────────────────────────
    if (['jualeq', 'selleq'].includes(command)) {
      if (!args) {
        return reply(`⚠️ Masukkan ID perlengkapan bekas yang ingin dijual!\nContoh: *${prefix}jualeq pedang_kayu*\nKetik *${prefix}lemari* untuk melihat isi lemarimu.`);
      }

      const res = sellFromArmory(user, args);
      if (!res.success) {
        return reply(`❌ ${res.msg}`);
      }

      saveRpgDb();
      return reply(`💰 *PERLENGKAPAN TERJUAL!*
Kamu telah menjual *${res.item.name}* ke toko loak!
💵 Uang refund didapat: *+${formatNumber(res.refund)} Gold*
Saldo sekarang: *${formatNumber(user.money)} Gold*.`);
    }

    // ──────────────────────────────────────────────────────────
    // 3. PETUALANGAN / ADVENTURE (.adventure / .petualang)
    // ──────────────────────────────────────────────────────────
    if (['adventure', 'petualang', 'adv'].includes(command)) {
      const cd = 180000; // 3 Menit Cooldown
      const lastAdv = user.cooldowns.adventure || 0;
      if (now - lastAdv < cd) {
        const sisa = formatDuration(cd - (now - lastAdv));
        return reply(`⏳ Tubuhmu masih lelah setelah bertualang!\nIstirahat dulu sejenak: *${sisa}* lagi.`);
      }

      if (user.stamina < 20) {
        return reply(`⚡ Stamina kamu tidak cukup (${user.stamina}/100)!\nMinimal butuh *20 Stamina*.\nTunggu stamina terisi otomatis atau minum *${prefix}toko* ramuan stamina.`);
      }

      if (user.hp <= 20) {
        return reply(`⚠️ Darahmu sekarat (HP: ${user.hp}/${user.maxHp})!\nTerlalu berbahaya untuk bertualang. Ketik *${prefix}heal* untuk menyembuhkan luka.`);
      }

      // Ambil monster acak sesuai tingkatan level pemain
      const eligibleMonsters = MONSTERS.filter(m => m.minLv <= user.level);
      const monster = eligibleMonsters[Math.floor(Math.random() * eligibleMonsters.length)] || MONSTERS[0];

      // Dapatkan buff dari Pet pendamping (jika ada dan tidak lapar)
      const petBuff = getPetBuff(user);

      // Simulasi pertarungan
      const weaponBonus = user.equipment.weaponAtk || 5;
      const isPlayerCrit = Math.random() < (0.22 + (petBuff.critBonus || 0));
      const totalAtk = (user.level * 10) + weaponBonus + (petBuff.atkBonus || 0) + Math.floor(Math.random() * 25);
      const playerAtk = Math.floor(totalAtk * (isPlayerCrit ? 1.5 : 1));
      const monsterHp = monster.baseHp;

      // Hitung damage monster ke pemain (dikurangi Armor DEF + Pet DEF)
      const isMonsterCrit = Math.random() < 0.22;
      const monsterRoll = monster.atk + Math.floor(Math.random() * (monster.atk * 0.45));
      const rawMonsterAtk = isMonsterCrit ? Math.floor(monsterRoll * 1.45) : monsterRoll;
      const armorDef = user.equipment.armorDef || 2;
      const totalDef = armorDef + (petBuff.defBonus || 0);
      const mitigatedDmg = Math.max(Math.floor(rawMonsterAtk * 0.28), rawMonsterAtk - Math.floor(totalDef * 0.8));
      const rawDmg = Math.max(5, Math.floor(mitigatedDmg + (Math.random() * 8) - 4));
      
      // Pemain menang jika attack cukup
      const isWin = playerAtk >= (monsterHp * 0.4);

      user.cooldowns.adventure = now;
      user.stamina -= 20;

      if (isWin) {
        const baseExp = Math.floor(Math.random() * (monster.expMax - monster.expMin + 1)) + monster.expMin;
        const baseGold = Math.floor(Math.random() * (monster.goldMax - monster.goldMin + 1)) + monster.goldMin;
        
        const expGained = Math.floor(baseExp * (1 + ((petBuff.expPercent || 0) / 100)));
        const goldGained = Math.floor(baseGold * (1 + ((petBuff.goldPercent || 0) / 100)));
        
        // Drop bahan acak
        const dropKayu = Math.floor(Math.random() * 4) + 1;
        const dropBatu = Math.floor(Math.random() * 3) + 1;
        const dropBesi = Math.random() < 0.45 ? Math.floor(Math.random() * 2) + 1 : 0;
        const dropEmas = Math.random() < 0.2 ? 1 : 0;
        const dropPotion = Math.random() < 0.15 ? 1 : 0;
        const dropMakananPet = Math.random() < 0.12 ? 1 : 0;
        const dropTokenMistis = Math.random() < 0.05 ? 1 : 0;

        user.inventory.kayu += dropKayu;
        user.inventory.batu += dropBatu;
        user.inventory.besi += dropBesi;
        user.inventory.emas += dropEmas;
        if (dropPotion) user.inventory.potion_hp += 1;
        if (dropMakananPet) user.inventory.makanan_pet = (user.inventory.makanan_pet || 0) + 1;
        if (dropTokenMistis) user.token = (user.token || 0) + 1;

        user.money += goldGained;
        user.hp = Math.max(1, user.hp - rawDmg);
        user.stats.adventures += 1;
        user.stats.monstersKilled += 1;

        // Pet interaksi saat bertualang
        let petNotes = [];
        if (petBuff.isActive) {
          user.pet.hunger = Math.max(0, (user.pet.hunger || 0) - 4);
          const pLvl = addPetExp(user, 12);
          if (pLvl.leveledUp) {
            petNotes.push(`🐾 *${user.pet.name} LEVEL UP!* Naik ke Level ${pLvl.newLevel}!`);
          }
          if (user.pet.hunger <= 0) {
            petNotes.push(`⚠️ *${user.pet.name} kelaparan!* Buff nonaktif sampai diberi makan (*${prefix}feed*).`);
          }
        } else if (petBuff.isHungry) {
          petNotes.push(`💤 *${user.pet.name}* terlalu lapar untuk bertarung! Ketik *${prefix}feed* untuk memberinya makan.`);
        }

        // Tambah EXP & Cek Level Up
        const lvlResult = addExp(user, expGained);

        let drops = [`🪵 +${dropKayu} Kayu`, `🪨 +${dropBatu} Batu`];
        if (dropBesi > 0) drops.push(`⚙️ +${dropBesi} Bijih Besi`);
        if (dropEmas > 0) drops.push(`🪙 +${dropEmas} Bijih Emas`);
        if (dropPotion > 0) drops.push(`🧪 +1 Ramuan HP`);
        if (dropMakananPet > 0) drops.push(`🍖 +1 Makanan Pet`);
        if (dropTokenMistis > 0) drops.push(`🔮 *SUPER RARE!* +1 Token Mistis Purba! ✨`);

        let text = `
⚔️ *PETUALANGAN SELESAI*
Kamu melawan *${monster.name}* dan berhasil menang!

❤️ Darah: -${rawDmg} HP (Sisa: ${user.hp}/${user.maxHp})
⚡ Stamina: -20 (Sisa: ${user.stamina}/${user.maxStamina})

🎁 *Hadiah:*
• 💰 +${formatNumber(goldGained)} Koin ${petBuff.goldPercent > 0 ? `_(+${petBuff.goldPercent}% Pet Buff)_` : ''}
• 📈 +${expGained} EXP ${petBuff.expPercent > 0 ? `_(+${petBuff.expPercent}% Pet Buff)_` : ''}
• ${drops.join('\n• ')}
`.trim();

        if (petNotes.length > 0) {
          text += `\n\n${petNotes.join('\n')}`;
        }

        if (lvlResult.leveledUp) {
          text += `\n\n🎉 *LEVEL UP!* Selamat, kamu naik ke *Level ${lvlResult.newLevel}*!\n⭐ Gelar Baru: *${user.title}*\n❤️ Max HP bertambah (+15) & darah pulih penuh!\n💰 Bonus Hadiah: +${formatNumber(lvlResult.bonusMoney)} Gold!`;
        }

        saveRpgDb();
        return reply(text);
      } else {
        // Kalah / Melarikan diri
        if ((user.inventory.jimat_pelindung || 0) > 0) {
          user.inventory.jimat_pelindung -= 1;
          user.stats.timesDefeated += 1;
          const consExp = 25;
          addExp(user, consExp);
          saveRpgDb();

          return reply(`
🧿 *JIMAT PELINDUNG BERSINAR!*
Kamu terpojok oleh monster *${monster.name}*, namun Jimat Pelindung di tasmu pecah menjadi perisai cahaya gaib!
✨ Semua luka fatal tertahan! Darahmu tetap aman (*${user.hp}/${user.maxHp} HP*).
⚡ Stamina: -20 (Sisa: ${user.stamina}/${user.maxStamina})
📈 EXP Hiburan: +${consExp} EXP
📦 Sisa Jimat Pelindung: ${user.inventory.jimat_pelindung} buah
`.trim());
        }

        const severeDmg = Math.min(user.hp - 1, rawDmg + 15);
        user.hp = Math.max(1, user.hp - severeDmg);
        user.stats.timesDefeated += 1;
        const consExp = 15;
        addExp(user, consExp);
        saveRpgDb();

        return reply(`
💀 *KAMU KALAH & MELARIKAN DIRI*
Kamu melawan *${monster.name}*, namun kekuatanmu belum cukup untuk mengalahkannya.

❤️ Darah: -${severeDmg} HP (Sisa: ${user.hp}/${user.maxHp})
⚡ Stamina: -20
📈 EXP Hiburan: +${consExp} EXP

💡 _Gunakan *${prefix}heal* untuk memulihkan darah atau beli *${prefix}shop* Jimat Pelindung._
`.trim());
      }
    }

    // ──────────────────────────────────────────────────────────
    // 4. MENAMBANG / MINING (.mining / .nambang)
    // ──────────────────────────────────────────────────────────
    if (['mining', 'nambang', 'mine'].includes(command)) {
      const cd = 150000; // 2.5 Menit Cooldown
      const lastMine = user.cooldowns.mining || 0;
      if (now - lastMine < cd) {
        const sisa = formatDuration(cd - (now - lastMine));
        return reply(`⛏️ Tanganmu masih pegal setelah menambang batu!\nIstirahat dulu: *${sisa}* lagi.`);
      }

      if (user.stamina < 15) {
        return reply(`⚡ Staminamu tidak cukup untuk mengayun beliung (${user.stamina}/100)!\nMinimal butuh *15 Stamina*.`);
      }

      user.cooldowns.mining = now;
      user.stamina -= 15;

      const pickTier = user.equipment.pickaxeTier || 1;
      const petBuff = getPetBuff(user);
      
      // Hasil tambang tergantung tier beliung
      const batuDapat = Math.floor(Math.random() * 6 * pickTier) + 3;
      const besiDapat = Math.floor(Math.random() * 3 * pickTier) + (Math.random() < 0.6 ? 1 : 0);
      const emasDapat = Math.random() < (0.2 * pickTier) ? Math.floor(Math.random() * 2) + 1 : 0;
      const berlianDapat = Math.random() < (0.05 * pickTier) ? 1 : 0;
      const dropTokenMistis = Math.random() < 0.03 ? 1 : 0;
      const baseExp = Math.floor(Math.random() * 25) + 20;
      const expDapat = Math.floor(baseExp * (1 + ((petBuff.expPercent || 0) / 100)));

      user.inventory.batu += batuDapat;
      user.inventory.besi += besiDapat;
      user.inventory.emas += emasDapat;
      user.inventory.berlian += berlianDapat;
      if (dropTokenMistis) user.token = (user.token || 0) + 1;
      user.stats.minedCount += 1;

      // Pet ikut membantu menambang
      let petNotes = [];
      if (petBuff.isActive) {
        user.pet.hunger = Math.max(0, (user.pet.hunger || 0) - 3);
        const pLvl = addPetExp(user, 10);
        if (pLvl.leveledUp) {
          petNotes.push(`🐾 *${user.pet.name} LEVEL UP!* Naik ke Level ${pLvl.newLevel}!`);
        }
        if (user.pet.hunger <= 0) {
          petNotes.push(`⚠️ *${user.pet.name} kelaparan!* Beri makan dengan *${prefix}feed*.`);
        }
      }

      const lvlResult = addExp(user, expDapat);

      let hasil = [`🪨 +${batuDapat} Batu`];
      if (besiDapat > 0) hasil.push(`⚙️ +${besiDapat} Bijih Besi`);
      if (emasDapat > 0) hasil.push(`🪙 +${emasDapat} Bijih Emas murni!`);
      if (berlianDapat > 0) hasil.push(`💎 *JACKPOT!* +${berlianDapat} Berlian Langka! ✨`);
      if (dropTokenMistis > 0) hasil.push(`🔮 *KRISTAL MISTIS!* +1 Token Mistis mengkristal! ✨`);

      let text = `
⛏️ *HASIL TAMBANG GUA MINERAL*
Kamu mengayunkan *${user.equipment.pickaxe}* ke dinding batu gua yang dalam...

📦 *Material Ditemukan:*
• ${hasil.join('\n• ')}
• 📈 +${expDapat} EXP ${petBuff.expPercent > 0 ? `_(+${petBuff.expPercent}% Pet Buff)_` : ''}
⚡ Stamina terpakai: -15 (Sisa: ${user.stamina}/${user.maxStamina})
`.trim();

      if (petNotes.length > 0) {
        text += `\n\n${petNotes.join('\n')}`;
      }

      if (lvlResult.leveledUp) {
        text += `\n\n🎉 *LEVEL UP!* Level ${lvlResult.newLevel} diraih!\nMax HP & Stamina meningkat penuh!`;
      }

      saveRpgDb();
      return reply(text);
    }

    // ──────────────────────────────────────────────────────────
    // 5. PENYEMBUHAN / HEAL (.heal / .obat)
    // ──────────────────────────────────────────────────────────
    if (['heal', 'obat'].includes(command)) {
      if (user.hp >= user.maxHp) {
        return reply(`❤️ Darahmu sudah penuh (${user.hp}/${user.maxHp} HP)! Tidak perlu minum obat.`);
      }

      const argsStr = (args || '').trim().toLowerCase();
      const wantsBig = argsStr.includes('besar') || argsStr.includes('large');
      const numMatch = argsStr.match(/\d+/);
      const isAll = argsStr.includes('all') || argsStr.includes('semua');
      let requestedCount = numMatch ? parseInt(numMatch[0]) : (isAll ? 999 : 1);
      if (requestedCount < 1) requestedCount = 1;

      if (wantsBig) {
        const available = user.inventory.potion_hp_besar || 0;
        if (available <= 0) {
          return reply(`❌ Kamu tidak memiliki *Ramuan HP Besar* di tas!\nBeli di *${prefix}shop* atau minum ramuan biasa dengan *${prefix}heal*.`);
        }
        const needed = Math.ceil((user.maxHp - user.hp) / 160);
        const count = Math.min(requestedCount, available, needed);
        const oldHp = user.hp;
        user.hp = Math.min(user.maxHp, user.hp + (count * 160));
        user.inventory.potion_hp_besar -= count;
        const recovered = user.hp - oldHp;
        saveRpgDb();
        return reply(`🧪 *GULP GULP~!* Kamu meminum *${count}x Ramuan HP Besar*.\n❤️ Darah pulih drastis +${recovered} HP!\n📊 Kondisi sekarang: *${user.hp}/${user.maxHp} HP* (Sisa ramuan besar: ${user.inventory.potion_hp_besar})`);
      }

      const normalAvail = user.inventory.potion_hp || 0;
      const bigAvail = user.inventory.potion_hp_besar || 0;

      if (normalAvail > 0) {
        const needed = Math.ceil((user.maxHp - user.hp) / 60);
        const count = Math.min(requestedCount, normalAvail, needed);
        const oldHp = user.hp;
        user.hp = Math.min(user.maxHp, user.hp + (count * 60));
        user.inventory.potion_hp -= count;
        const recovered = user.hp - oldHp;
        saveRpgDb();
        return reply(`🧪 *SLURP~!* Kamu meminum *${count}x Ramuan HP*.\n❤️ Darah pulih +${recovered} HP!\n📊 Kondisi sekarang: *${user.hp}/${user.maxHp} HP* (Sisa ramuan: ${user.inventory.potion_hp})`);
      } else if (bigAvail > 0) {
        const needed = Math.ceil((user.maxHp - user.hp) / 160);
        const count = Math.min(requestedCount, bigAvail, needed);
        const oldHp = user.hp;
        user.hp = Math.min(user.maxHp, user.hp + (count * 160));
        user.inventory.potion_hp_besar -= count;
        const recovered = user.hp - oldHp;
        saveRpgDb();
        return reply(`🧪 *GULP GULP~!* Kamu meminum *${count}x Ramuan HP Besar*.\n❤️ Darah pulih drastis +${recovered} HP!\n📊 Kondisi sekarang: *${user.hp}/${user.maxHp} HP* (Sisa ramuan besar: ${user.inventory.potion_hp_besar})`);
      } else {
        return reply(`❌ Kamu tidak memiliki *Ramuan HP* di tas!\nBeli ramuan di *${prefix}shop* atau istirahat sejenak (HP pulih otomatis 1 poin tiap 45 detik).`);
      }
    }

    // ──────────────────────────────────────────────────────────
    // 5B. MENGGUNAKAN ITEM PENDUKUNG (.use / .pakai / .minum)
    // ──────────────────────────────────────────────────────────
    if (['use', 'pakai', 'minum'].includes(command)) {
      if (!args) {
        return reply(`
🎒 *PENGGUNAAN ITEM PENDUKUNG:*
Ketik: *${prefix}use <nama_item> [jumlah]*
Contoh: *${prefix}use kitab_exp 10* atau *${prefix}use potion_hp 5*

📋 *Daftar Item yang Bisa Dipakai:*
• \`${prefix}use potion_hp [jumlah]\` ─ Minum Ramuan HP (+60 HP/botol)
• \`${prefix}use potion_hp_besar [jumlah]\` ─ Minum Ramuan HP Besar (+160 HP/botol)
• \`${prefix}use potion_stamina [jumlah]\` ─ Minum Ramuan Stamina (+60 Stamina/botol)
• \`${prefix}use potion_stamina_besar [jumlah]\` ─ Minum Ramuan Stamina Besar (+120 Stamina/botol)
• \`${prefix}use kitab_exp [jumlah]\` ─ Membaca Kitab Pengalaman (+250 EXP/buku)
• \`${prefix}use makanan_pet [jumlah]\` ─ Memberi makan pet (+25 Hunger & +20 EXP)
• \`${prefix}use tiket_raid\` ─ Reset Cooldown World Boss grup
• \`${prefix}use jimat_pelindung\` ─ Cek status perlindungan jimat
`.trim());
      }

      // Parsing nama item dan jumlah pemakaian
      const tokens = args.trim().split(/\s+/);
      let rawCount = 1;
      let itemTokens = [];

      const lastToken = tokens[tokens.length - 1].toLowerCase();
      const firstToken = tokens[0].toLowerCase();

      if (!isNaN(parseInt(lastToken)) && parseInt(lastToken) > 0) {
        rawCount = parseInt(lastToken);
        itemTokens = tokens.slice(0, tokens.length - 1);
      } else if (['all', 'semua'].includes(lastToken)) {
        rawCount = 'all';
        itemTokens = tokens.slice(0, tokens.length - 1);
      } else if (!isNaN(parseInt(firstToken)) && parseInt(firstToken) > 0) {
        rawCount = parseInt(firstToken);
        itemTokens = tokens.slice(1);
      } else if (['all', 'semua'].includes(firstToken)) {
        rawCount = 'all';
        itemTokens = tokens.slice(1);
      } else {
        rawCount = 1;
        itemTokens = tokens;
      }

      const itemKey = itemTokens.join('_').toLowerCase();

      // 1. Ramuan HP Biasa
      if (['potion_hp', 'hp', 'darah', 'potion_darah'].includes(itemKey)) {
        if (user.hp >= user.maxHp) {
          return reply(`❤️ Darahmu sudah penuh (${user.hp}/${user.maxHp} HP)!`);
        }
        const available = user.inventory.potion_hp || 0;
        if (available <= 0) {
          return reply(`❌ Kamu tidak memiliki *Ramuan HP* di tas! Beli di *${prefix}shop*.`);
        }
        const needed = Math.ceil((user.maxHp - user.hp) / 60);
        let count = rawCount === 'all' ? Math.min(available, needed) : Math.min(parseInt(rawCount) || 1, available);
        if (count <= 0) count = 1;

        const oldHp = user.hp;
        user.hp = Math.min(user.maxHp, user.hp + (count * 60));
        user.inventory.potion_hp -= count;
        saveRpgDb();
        return reply(`🧪 *SLURP~!* Kamu meminum *${count}x Ramuan HP*.\n❤️ Darah pulih +${user.hp - oldHp} HP!\n📊 Kondisi sekarang: *${user.hp}/${user.maxHp} HP* (Sisa: ${user.inventory.potion_hp}).`);
      }

      // 2. Ramuan HP Besar
      if (['potion_hp_besar', 'hp_besar', 'darah_besar', 'potion_besar'].includes(itemKey)) {
        if (user.hp >= user.maxHp) {
          return reply(`❤️ Darahmu sudah penuh (${user.hp}/${user.maxHp} HP)!`);
        }
        const available = user.inventory.potion_hp_besar || 0;
        if (available <= 0) {
          return reply(`❌ Kamu tidak memiliki *Ramuan HP Besar* di tas! Beli di *${prefix}shop*.`);
        }
        const needed = Math.ceil((user.maxHp - user.hp) / 160);
        let count = rawCount === 'all' ? Math.min(available, needed) : Math.min(parseInt(rawCount) || 1, available);
        if (count <= 0) count = 1;

        const oldHp = user.hp;
        user.hp = Math.min(user.maxHp, user.hp + (count * 160));
        user.inventory.potion_hp_besar -= count;
        saveRpgDb();
        return reply(`🧪 *GULP GULP~!* Kamu meminum *${count}x Ramuan HP Besar*.\n❤️ Darah pulih drastis +${user.hp - oldHp} HP!\n📊 Kondisi sekarang: *${user.hp}/${user.maxHp} HP* (Sisa: ${user.inventory.potion_hp_besar}).`);
      }

      // 3. Ramuan Stamina Biasa
      if (['potion_stamina', 'stamina', 'energi'].includes(itemKey)) {
        if (user.stamina >= user.maxStamina) {
          return reply(`⚡ Staminamu sudah penuh (${user.stamina}/${user.maxStamina})!`);
        }
        const available = user.inventory.potion_stamina || 0;
        if (available <= 0) {
          return reply(`❌ Kamu tidak memiliki *Ramuan Stamina* di tas! Beli di *${prefix}shop*.`);
        }
        const needed = Math.ceil((user.maxStamina - user.stamina) / 60);
        let count = rawCount === 'all' ? Math.min(available, needed) : Math.min(parseInt(rawCount) || 1, available);
        if (count <= 0) count = 1;

        const oldStamina = user.stamina;
        user.stamina = Math.min(user.maxStamina, user.stamina + (count * 60));
        user.inventory.potion_stamina -= count;
        saveRpgDb();
        return reply(`⚡ *GLEK GLEK~!* Kamu meminum *${count}x Ramuan Stamina*.\n⚡ Stamina pulih +${user.stamina - oldStamina} poin!\n📊 Kondisi sekarang: *${user.stamina}/${user.maxStamina}* (Sisa: ${user.inventory.potion_stamina}).`);
      }

      // 4. Ramuan Stamina Besar
      if (['potion_stamina_besar', 'stamina_besar', 'energi_besar'].includes(itemKey)) {
        if (user.stamina >= user.maxStamina) {
          return reply(`⚡ Staminamu sudah penuh (${user.stamina}/${user.maxStamina})!`);
        }
        const available = user.inventory.potion_stamina_besar || 0;
        if (available <= 0) {
          return reply(`❌ Kamu tidak memiliki *Ramuan Stamina Besar* di tas! Beli di *${prefix}shop*.`);
        }
        const needed = Math.ceil((user.maxStamina - user.stamina) / 120);
        let count = rawCount === 'all' ? Math.min(available, needed) : Math.min(parseInt(rawCount) || 1, available);
        if (count <= 0) count = 1;

        const oldStamina = user.stamina;
        user.stamina = Math.min(user.maxStamina, user.stamina + (count * 120));
        user.inventory.potion_stamina_besar -= count;
        saveRpgDb();
        return reply(`⚡ *GLEK GLEK~!* Kamu meminum *${count}x Ramuan Stamina Besar*!\n⚡ Stamina terisi +${user.stamina - oldStamina} poin!\n📊 Kondisi sekarang: *${user.stamina}/${user.maxStamina}* (Sisa: ${user.inventory.potion_stamina_besar}).`);
      }

      // 5. Kitab Pengalaman
      if (['kitab_exp', 'kitab', 'exp_book', 'buku_exp', 'exp'].includes(itemKey)) {
        const available = user.inventory.kitab_exp || 0;
        if (available <= 0) {
          return reply(`❌ Kamu tidak memiliki *Kitab Pengalaman* di tas! Beli di *${prefix}shop*.`);
        }

        const count = rawCount === 'all' ? available : Math.min(parseInt(rawCount) || 1, available);
        if (count <= 0) {
          return reply(`❌ Masukkan jumlah kitab yang valid (minimal 1)!`);
        }

        user.inventory.kitab_exp -= count;
        const totalExp = count * 250;
        const lvlRes = addExp(user, totalExp);
        saveRpgDb();

        const levelsGained = (lvlRes.newLevel || user.level) - (lvlRes.oldLevel || user.level);
        let expText = `📖 *${count}x KITAB PENGALAMAN DIBACA!*
Cahaya kebijaksanaan merasuki pikiranmu!
📈 Mendapatkan: *+${formatNumber(totalExp)} EXP* (${count} x 250 EXP)!
📊 EXP Sekarang: *${user.exp}/${user.maxExp}* (Sisa Kitab: ${user.inventory.kitab_exp})`;

        if (lvlRes.leveledUp) {
          expText += `\n\n🎉 *LEVEL UP!* Kamu naik ${levelsGained > 1 ? `*+${levelsGained} Level* sekaligus` : ''} ke *Level ${lvlRes.newLevel}*!\n⭐ Gelar: *${user.title}*\n❤️ HP & Stamina meningkat penuh!`;
        }

        return reply(expText);
      }

      // 6. Tiket Raid
      if (['tiket_raid', 'tiket', 'raid_ticket'].includes(itemKey)) {
        if (!isGroup) {
          return reply(`⚠️ Tiket Raid hanya dapat digunakan di dalam grup yang memiliki cooldown World Boss!`);
        }
        if ((user.inventory.tiket_raid || 0) <= 0) {
          return reply(`❌ Kamu tidak memiliki *Tiket Raid* di tas! Beli di *${prefix}shop*.`);
        }

        const activeRaid = global.rpgRaids[jid];
        if (activeRaid) {
          return reply(`⚠️ Sedang ada boss raid yang aktif (*${activeRaid.name}*) di grup ini! Serang boss dengan *${prefix}serang*.`);
        }

        const lastRaid = global.rpgRaidCooldowns[jid] || 0;
        const raidCooldown = 600000;
        if (now - lastRaid >= raidCooldown) {
          return reply(`🛡️ Cooldown raid grup sudah selesai! Kamu bisa langsung mengetik *${prefix}raid* tanpa perlu memakai tiket.`);
        }

        user.inventory.tiket_raid -= 1;
        global.rpgRaidCooldowns[jid] = 0;
        saveRpgDb();

        return reply(`🎫 *TIKET RAID BERHASIL DIGUNAKAN!*
👤 *${user.name}* telah mereset cooldown World Boss di grup ini!
🔥 Boss Raid kini bisa langsung dipanggil kembali!
👉 Ketik *${prefix}raid* untuk memanggil monster raksasa!`);
      }

      // 7. Jimat Pelindung
      if (['jimat_pelindung', 'jimat'].includes(itemKey)) {
        return reply(`🧿 *INFO PENGGUNAAN JIMAT PELINDUNG:*
Jimat Pelindung bekerja secara *otomatis dan pasif* dari dalam tasmu saat bertualang (*${prefix}adventure*).
Jika kamu kalah saat bertarung, jimat ini akan otomatis pecah melindungi nyawamu sehingga darahmu (HP) tidak berkurang parah!
📦 Koleksimu saat ini: *${user.inventory.jimat_pelindung || 0} buah*.`);
      }

      // 8. Makanan Pet
      if (['makanan_pet', 'makananpet', 'pet_food', 'makanan'].includes(itemKey)) {
        if (!user.pet || !user.pet.type) {
          return reply(`⚠️ Kamu belum memiliki pet companion!\nAdopsi pet terlebih dahulu dengan mengetik *${prefix}pet*.`);
        }
        const available = user.inventory.makanan_pet || 0;
        if (available <= 0) {
          return reply(`❌ Kamu tidak memiliki *Makanan Pet* di tas! Beli di *${prefix}shop* seharga 150 Gold.`);
        }
        if ((user.pet.hunger || 0) >= 100) {
          return reply(`🍖 *${user.pet.name}* masih sangat kenyang (Hunger: 100%)!\nBawa dia bertualang dulu sebelum diberi makan lagi.`);
        }
        const needed = Math.ceil((100 - (user.pet.hunger || 0)) / 25);
        let count = rawCount === 'all' ? Math.min(available, needed) : Math.min(parseInt(rawCount) || 1, available);
        if (count <= 0) count = 1;

        user.inventory.makanan_pet -= count;
        user.pet.hunger = Math.min(100, (user.pet.hunger || 0) + (count * 25));
        const petLvl = addPetExp(user, count * 20);
        saveRpgDb();

        let feedText = `🍖 *NYAM NYAM NYAM~!*
Kamu memberi makan *${count}x Makanan Pet* kepada *${user.pet.name}*!
🍖 Hunger pulih: *${user.pet.hunger}/100%*
📈 EXP Pet: *+${count * 20} EXP* (${user.pet.exp}/${user.pet.maxExp})
📦 Sisa Makanan Pet di tas: ${user.inventory.makanan_pet} porsi`;

        if (petLvl.leveledUp) {
          feedText += `\n\n🎉 *PET LEVEL UP!* *${user.pet.name}* naik ke *Level ${petLvl.newLevel}*!\nKekuatan buff pet meningkat drastis!`;
        }

        return reply(feedText);
      }

      return reply(`❌ Item *"${args}"* tidak dikenali atau tidak bisa dipakai!\nKetik *${prefix}use* untuk melihat panduan item.`);
    }

    // ──────────────────────────────────────────────────────────
    // 6. HADIAH HARIAN / DAILY (.daily / .klaim)
    // ──────────────────────────────────────────────────────────
    if (['daily', 'klaim'].includes(command)) {
      const cd = 86400000; // 24 Jam
      const lastDaily = user.cooldowns.daily || 0;
      if (now - lastDaily < cd) {
        const sisa = formatDuration(cd - (now - lastDaily));
        return reply(`🎁 Kamu sudah mengambil jatah harian hari ini!\nSilakan kembali dalam: *${sisa}*.`);
      }

      user.cooldowns.daily = now;
      const rewardMoney = 1000 + (user.level * 100);
      const rewardExp = 60 + (user.level * 15);
      const bankInterest = Math.floor((user.bank || 0) * 0.02);

      user.money += rewardMoney;
      if (bankInterest > 0) {
        user.bank += bankInterest;
      }
      user.inventory.potion_hp = (user.inventory.potion_hp || 0) + 2;
      user.inventory.potion_stamina = (user.inventory.potion_stamina || 0) + 1;
      user.hp = user.maxHp;
      user.stamina = user.maxStamina;

      const lvlResult = addExp(user, rewardExp);

      let text = `
🎁 *HADIAH HARIAN PETUALANG BERHASIL DIAMBIL!*
Terima kasih sudah setia berpetualang bersama Kitsune Bot!

📦 *Hadiah yang didapat:*
• 💰 +${formatNumber(rewardMoney)} Koin Emas
${bankInterest > 0 ? `• 🏦 +${formatNumber(bankInterest)} Gold (Bunga Deposito Bank 2%)\n` : ''}• 📈 +${rewardExp} EXP
• 🧪 +2 Ramuan HP
• ⚡ +1 Ramuan Stamina
• ❤️ HP & ⚡ Stamina dipulihkan sampai penuh (100%)!
`.trim();

      if (lvlResult.leveledUp) {
        text += `\n\n🎉 *LEVEL UP!* Level ${lvlResult.newLevel} diraih!`;
      }

      saveRpgDb();
      return reply(text);
    }

    // ──────────────────────────────────────────────────────────
    // 7. TOKO BARANG (.shop / .toko)
    // ──────────────────────────────────────────────────────────
    if (['shop', 'toko'].includes(command)) {
      const consumables = SHOP_ITEMS.filter(i => i.type === 'consumable');
      const weapons = SHOP_ITEMS.filter(i => i.type === 'weapon');
      const armors = SHOP_ITEMS.filter(i => i.type === 'armor');
      const pickaxes = SHOP_ITEMS.filter(i => i.type === 'pickaxe');

      const text = `
╭━━━━━「 🛒 *TOKO PETUALANG KITSUNE* 」━━━━━╮
┃ 👤 *Koin Kamu:* ${formatNumber(user.money)} Gold
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

🧪 *RAMUAN & ITEM PENDUKUNG:*
${consumables.map(i => `  • \`${i.id}\` : *${formatNumber(i.price)} G* ─ _${i.name} (${i.desc})_`).join('\n')}

🗡️ *SENJATA (PEDANG TIER 1 - 5):*
${weapons.map(i => `  • \`${i.id}\` : *${formatNumber(i.price)} G* ─ _${i.name} (${i.desc})_`).join('\n')}

🛡️ *ZIRAH (PELINDUNG TIER 1 - 5):*
${armors.map(i => `  • \`${i.id}\` : *${formatNumber(i.price)} G* ─ _${i.name} (${i.desc})_`).join('\n')}

⛏️ *BELIUNG TAMBANG TIER 2 - 5:*
${pickaxes.map(i => `  • \`${i.id}\` : *${formatNumber(i.price)} G* ─ _${i.name} (${i.desc})_`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 *Beli:* \`${prefix}buy <id> <jumlah>\` (Contoh: \`${prefix}buy potion_hp 3\` atau \`${prefix}buy pedang_besi\`)
💡 *Gunakan Item:* \`${prefix}use <id>\` (Contoh: \`${prefix}use potion_hp\`)
💡 *Koleksi:* \`${prefix}armory\` | *Ganti:* \`${prefix}equip <id>\` | *Jual:* \`${prefix}jualeq <id>\`
`.trim();

      return reply(text);
    }

    // ──────────────────────────────────────────────────────────
    // 8. MEMBELI BARANG (.buy / .beli)
    // ──────────────────────────────────────────────────────────
    if (['buy', 'beli'].includes(command)) {
      if (!args) {
        return reply(`⚠️ Masukkan ID item yang ingin dibeli!\nContoh: *${prefix}buy pedang_besi* atau *${prefix}buy potion_hp 2*\nKetik *${prefix}shop* untuk melihat katalog barang.`);
      }

      const parts = args.split(' ');
      const itemIdOrIndex = parts[0]?.toLowerCase();
      const count = Math.max(1, parseInt(parts[1]) || 1);

      // Cari berdasarkan ID atau nomor urut
      let targetItem = SHOP_ITEMS.find(i => i.id === itemIdOrIndex);
      if (!targetItem && !isNaN(parseInt(itemIdOrIndex))) {
        const idx = parseInt(itemIdOrIndex) - 1;
        targetItem = SHOP_ITEMS[idx];
      }

      if (!targetItem) {
        return reply(`❌ Item tidak ditemukan! Ketik *${prefix}shop* untuk melihat barang yang dijual.`);
      }

      // Pembelian Ramuan & Item Pendukung
      if (targetItem.type === 'consumable') {
        const totalPrice = targetItem.price * count;
        if (user.money < totalPrice) {
          return reply(`💸 Koin tidak cukup!\nTotal: *${formatNumber(totalPrice)} Gold* (Koinmu: ${formatNumber(user.money)}).`);
        }

        user.money -= totalPrice;
        user.inventory[targetItem.id] = (user.inventory[targetItem.id] || 0) + count;

        saveRpgDb();
        return reply(`✅ Berhasil membeli *${count}x ${targetItem.name}* seharga *${formatNumber(totalPrice)} Gold*!\nSisa saldo: *${formatNumber(user.money)} Gold*.\n💡 Cek tasmu di *${prefix}inv* atau ketik *${prefix}use ${targetItem.id}* untuk memakainya.`);
      }

      // Pembelian Perlengkapan (Senjata / Zirah / Beliung)
      if (user.armory?.some(a => a.id === targetItem.id)) {
        return reply(`⚠️ Kamu sudah memiliki *${targetItem.name}* di lemarimu!\nKetik *${prefix}lemari* untuk melihat koleksimu atau *${prefix}equip ${targetItem.id}* untuk memasangnya.`);
      }

      if (user.money < targetItem.price) {
        return reply(`💸 Koin kamu tidak cukup!\nHarga *${targetItem.name}*: *${formatNumber(targetItem.price)} Gold*\nKoin kamu: *${formatNumber(user.money)} Gold* (Kurang ${formatNumber(targetItem.price - user.money)}).`);
      }

      user.money -= targetItem.price;
      addToArmory(user, targetItem);
      equipFromArmory(user, targetItem.id);
      saveRpgDb();

      return reply(`
🎉 *PEMBELIAN PERLENGKAPAN BERHASIL!*
Kamu telah membeli *${targetItem.name}* seharga *${formatNumber(targetItem.price)} Gold*!
✨ Perlengkapan telah disimpan di lemarimu dan langsung terpasang!
Cek statusmu di *${prefix}profile* atau kelola lemari di *${prefix}lemari*.
`.trim());
    }

    // ──────────────────────────────────────────────────────────
    // 9. MENJUAL MATERIAL (.sell / .jual)
    // ──────────────────────────────────────────────────────────
    if (['sell', 'jual'].includes(command)) {
      if (!args) {
        let priceList = Object.entries(MATERIAL_PRICES).map(([key, val]) => {
          return `• ${val.name} (\`${key}\`): *${val.price} Gold* / biji`;
        }).join('\n');

        return reply(`
🏪 *BURSA JUAL MATERIAL KITSUNE*
Jual material hasil petualangan & tambangmu untuk mendapatkan pundi-pundi koin emas!

📋 *Daftar Harga Beli NPC:*
${priceList}

💡 *Format Perintah:*
• *${prefix}jual <nama_material> <jumlah>* (Contoh: \`${prefix}jual batu 10\`)
• *${prefix}jual all* (Jual semua hasil tambang sekaligus!)
`.trim());
      }

      const parts = args.split(' ');
      const targetMat = parts[0]?.toLowerCase();

      // Fitur jual semua (jual all)
      if (targetMat === 'all' || targetMat === 'semua') {
        let totalDapat = 0;
        let soldItems = [];

        for (const [key, val] of Object.entries(MATERIAL_PRICES)) {
          const qty = user.inventory[key] || 0;
          if (qty > 0) {
            const earn = qty * val.price;
            totalDapat += earn;
            user.inventory[key] = 0;
            soldItems.push(`${val.name}: ${qty} biji (+${formatNumber(earn)} Gold)`);
          }
        }

        if (totalDapat === 0) {
          return reply('🎒 Kamu tidak memiliki material apapun di tas untuk dijual!');
        }

        user.money += totalDapat;
        saveRpgDb();

        return reply(`
💰 *SEMUA MATERIAL BERHASIL DIJUAL!*
${soldItems.join('\n')}

💵 Total uang masuk: *+${formatNumber(totalDapat)} Gold*!
Saldo sekarang: *${formatNumber(user.money)} Gold*.
`.trim());
      }

      // Jual per item
      const itemConfig = MATERIAL_PRICES[targetMat];
      if (!itemConfig) {
        return reply(`❌ Material *"${targetMat}"* tidak valid!\nPilih antara: kayu, batu, besi, emas, berlian.`);
      }

      const available = user.inventory[targetMat] || 0;
      if (available <= 0) {
        return reply(`🎒 Kamu tidak memiliki *${itemConfig.name}* di tas!`);
      }

      let count = parseInt(parts[1]);
      if (parts[1] === 'all' || parts[1] === 'semua' || isNaN(count)) {
        count = available;
      }
      count = Math.min(available, Math.max(1, count));

      const earned = count * itemConfig.price;
      user.inventory[targetMat] -= count;
      user.money += earned;
      saveRpgDb();

      return reply(`💰 Berhasil menjual *${count}x ${itemConfig.name}* seharga *+${formatNumber(earned)} Gold*!\nSisa material di tas: ${user.inventory[targetMat]}\nSaldo sekarang: *${formatNumber(user.money)} Gold*.`);
    }

    // ──────────────────────────────────────────────────────────
    // 10. MENEMPA / CRAFTING (.craft / .tempa)
    // ──────────────────────────────────────────────────────────
    if (['craft', 'tempa'].includes(command)) {
      if (!args) {
        let recipeList = CRAFT_RECIPES.map((r, i) => {
          const isUnlocked = user.level >= (r.minLv || 1);
          const statusBadge = isUnlocked ? '✅' : `🔒 Min Lv. ${r.minLv}`;
          const reqs = Object.entries(r.cost).map(([k, v]) => `${v} ${k}`).join(', ');
          return `*${i + 1}. [${statusBadge}] ${r.name}* (\`${r.id}\`)\n   📝 _${r.desc}_\n   🔨 Bahan: *${reqs}*\n   ⚡ Tempa: \`${prefix}craft ${r.id}\``;
        }).join('\n\n');

        return reply(`
╭━━━━━「 🔨 *BENGKEL TEMPA PERLENGKAPAN* 」━━━━━╮
┃ 👤 *Level Petualang:* Lv. ${user.level} (${user.title})
┃ Tempa senjata & zirah tempur sesuai tingkat level!
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

${recipeList}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 *Cara Tempa:* \`${prefix}craft <id_resep>\` (Contoh: \`${prefix}craft pedang_besi\`)
🔒 Item bertanda 🔒 butuh level lebih tinggi untuk dibuka.
`.trim());
      }

      const recipeId = args.trim().toLowerCase();
      const recipe = CRAFT_RECIPES.find(r => r.id === recipeId);
      if (!recipe) {
        return reply(`❌ Resep tempa tidak ditemukan! Ketik *${prefix}craft* untuk melihat resep yang tersedia.`);
      }

      // Cek Persyaratan Level (minLv)
      if (recipe.minLv && user.level < recipe.minLv) {
        return reply(`🔒 *LEVEL BELUM MENCUKUPI!*
Untuk menempa *${recipe.name}*, kamu minimal harus mencapai *Level ${recipe.minLv}*!
Levelmu saat ini: *Lv. ${user.level}* (Kurang ${recipe.minLv - user.level} Level).

💡 Selesaikan *${prefix}adventure* atau kalahkan monster di *${prefix}raid* untuk menaikkan level!`);
      }

      // Cek koin
      if (recipe.cost.koin && user.money < recipe.cost.koin) {
        return reply(`💸 Koin tidak cukup! Butuh *${formatNumber(recipe.cost.koin)} Gold* (Koinmu: ${formatNumber(user.money)}).`);
      }

      // Cek bahan material
      for (const [mat, needed] of Object.entries(recipe.cost)) {
        if (mat === 'koin') continue;
        const have = user.inventory[mat] || 0;
        if (have < needed) {
          return reply(`📦 Bahan tidak cukup! Butuh *${needed} ${mat}*, kamu hanya punya *${have} ${mat}*.\nKumpulkan lebih banyak lewat *${prefix}adventure* atau *${prefix}nambang*.`);
        }
      }

      // Kurangi bahan & uang
      if (recipe.cost.koin) user.money -= recipe.cost.koin;
      for (const [mat, needed] of Object.entries(recipe.cost)) {
        if (mat === 'koin') continue;
        user.inventory[mat] -= needed;
      }

      // Simpan ke lemari dan pasang equipment baru
      const craftedItem = {
        id: recipe.id,
        name: recipe.name,
        type: recipe.type,
        stat: recipe.bonusAtk || recipe.bonusDef || 0,
        tier: recipe.tier || 1,
        price: (recipe.cost.koin || 300) * 2
      };
      addToArmory(user, craftedItem);
      equipFromArmory(user, recipe.id);

      saveRpgDb();
      return reply(`
🔨 *TEMPA BERHASIL!*
Berhasil membuat *${recipe.name}*!
✨ Perlengkapan sudah masuk ke lemarimu dan langsung dipasang.
📊 Cek status terbarumu di *${prefix}profile*.
`.trim());
    }

    // ──────────────────────────────────────────────────────────
    // 10B. GACHA SENJATA EKSKLUSIF (.gacha / .pull)
    // ──────────────────────────────────────────────────────────
    if (['gacha', 'pull'].includes(command)) {
      const mode = args?.trim().toLowerCase();

      if (!mode || (!['1', '10', 'single', 'multi'].includes(mode))) {
        const pityMythicBar = renderBar(user.gachaPity || 0, 120, 10);
        const pityEternalBar = renderBar(user.gachaPityEternal || 0, 500, 10);
        const text = `
╭━━━━━「 🌌 *GACHA SENJATA MYTHIC & ETERNAL* 」━━━━━╮
┃ 👤 *Petualang:* ${user.name}
┃ 💰 *Koin Kamu:* ${formatNumber(user.money)} Gold
┃ 🎯 *Pity Mythic (5★):* [${pityMythicBar}] ${user.gachaPity || 0}/120
┃ 🌌 *Pity Eternal (6★):* [${pityEternalBar}] ${user.gachaPityEternal || 0}/500
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

🌌 *Perlengkapan 6★ Eternal:*
• ⚔️ *Pedang Ea* (+850 ATK) ─ Senjata kuno terkuat
• 🔱 *Tombak Longinus* (+780 ATK) ─ Tombak suci terkuat
• 🛡️ *Zirah Ouroboros* (+620 DEF) ─ Zirah pelindung terkuat
• ⛏️ *Beliung Celestial* (Tier 7) ─ Beliung tambang tertinggi

👑 *Senjata 5★ Mythic:*
• ⚔️ *Pedang Excalibur* (+400 ATK) ─ Pedang suci cahaya
• 🗡️ *Pedang Muramasa* (+360 ATK) ─ Pedang terkutuk haus darah
• 🛡️ *Zirah Aegis* (+290 DEF) ─ Perisai dewa pelindung mutlak
• ⛏️ *Beliung Mithril* (Tier 6) ─ Beliung tambang kristal suci

💎 *Sistem Garansi Pity:*
• 👑 *Pity 5★ Mythic (120x):* Jika mencapai 120x tarikan, kamu **PASTI DIJAMIN 100%** mendapatkan perlengkapan 5★ Mythic! (Reset saat dapat 5★).
• 🌌 *Pity 6★ Eternal (500x):* Jika mencapai 500x tarikan, kamu **PASTI DIJAMIN 100%** mendapatkan perlengkapan 6★ Eternal! (Reset saat dapat 6★).

📊 *Peluang Drop:*
• 🌌 6★ Eternal: *0.001%* (Garansi Pity 500x)
• 👑 5★ Mythic: *1.0%* (Garansi Pity 120x ─ Lebih Menantang!)
• ✨ 4★ Epic: *19.0%* (Senjata Naga, Berlian, Emas, Tiket)
• ⚪ 3★ Rare: *80.0%* (Ramuan Besar, Kitab EXP, Jimat, Material)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 *Pilihan Tarik Gacha:*
• \`${prefix}gacha 1\` ─ 1x Tarik (*150 Gold*)
• \`${prefix}gacha 10\` ─ 10x Tarik (*1.350 Gold* ─ Hemat 150 Gold!)
`.trim();

        return reply(text);
      }

      const times = (mode === '10' || mode === 'multi') ? 10 : 1;
      const result = rollGacha(user, times);

      if (!result.success) {
        return reply(`❌ ${result.msg}`);
      }

      const pityMythicBar = renderBar(result.pity, 120, 10);
      const pityEternalBar = renderBar(result.pityEternal, 500, 10);
      const headerTitle = times === 10 ? '✨ 10x GACHA RESULT' : '✨ 1x GACHA RESULT';

      let replyMsg = `
╭━━━━━「 ${headerTitle} 」━━━━━╮
┃ 👤 *Petualang:* ${user.name}
┃ 💰 *Sisa Koin:* ${formatNumber(user.money)} Gold
┃ 🎯 *Pity Mythic:* [${pityMythicBar}] ${result.pity}/120
┃ 🌌 *Pity Eternal:* [${pityEternalBar}] ${result.pityEternal}/500
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

${result.results.map((r, i) => `${i + 1}. ${r.text}`).join('\n')}
`.trim();

      if (result.gotEternal) {
        replyMsg += `\n\n🎉 *HOKI BESAR! KAMU DAPAT ITEM 6★ ETERNAL!*`;
        replyMsg += `\nCek lemarimu di *${prefix}lemari* dan pasang dengan *${prefix}equip <id/nama>*.`;
      }
      if (result.got5Star) {
        replyMsg += `\n\n🎉 *SELAMAT! KAMU MENDAPATKAN PERLENGKAPAN 5★ MYTHIC!*`;
        replyMsg += `\n✨ Perlengkapan telah tersimpan di *${prefix}lemari*. Pasang dengan *${prefix}equip <nama/id>*!`;
      }
      if (!result.gotEternal && !result.got5Star) {
        const remainingMythic = 120 - result.pity;
        const remainingEternal = 500 - result.pityEternal;
        replyMsg += `\n\n🎯 *Pity Tracker:*`;
        replyMsg += `\n• Kurang *${remainingMythic} tarikan* lagi menuju Garansi 5★ Mythic!`;
        replyMsg += `\n• Kurang *${remainingEternal} tarikan* lagi menuju Garansi 6★ Eternal!`;
        replyMsg += `\n💡 Tarik lagi: \`${prefix}gacha ${times}\``;
      }

      if (result.bonusToken > 0) {
        replyMsg += `\n\n🔮 *BONUS TARIKAN:* Mendapatkan *+${result.bonusToken} Token Mistis*! (Saldo: ${formatNumber(user.token || 0)} Token)`;
      }

      return reply(replyMsg);
    }

    // ──────────────────────────────────────────────────────────
    // 11. LEADERBOARD PERINGKAT (.leaderboard / .top / .lb)
    // ──────────────────────────────────────────────────────────
    if (['leaderboard', 'top', 'lb'].includes(command)) {
      const db = loadRpgDb();
      const allUsers = Object.values(db.users || {});

      if (allUsers.length === 0) {
        return reply('🏆 Belum ada data pemain petualang yang tercatat.');
      }

      // Urutkan berdasarkan Level & EXP tertinggi
      const sortedByLevel = [...allUsers].sort((a, b) => {
        if (b.level !== a.level) return b.level - a.level;
        return b.exp - a.exp;
      }).slice(0, 10);

      const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

      let rows = sortedByLevel.map((u, i) => {
        const medal = medals[i] || `${i + 1}.`;
        return `${medal} *${u.name}*\n   🎖️ Lv. ${u.level} | 📈 ${u.exp}/${u.maxExp} EXP | 💰 ${formatNumber(u.money)} Gold`;
      }).join('\n\n');

      const text = `
╭━━━━━「 🏆 *PAPAN PERINGKAT PETUALANG* 」━━━━━╮
┃ 10 Pemain terkuat & level tertinggi saat ini:
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

${rows}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌟 _Terus bertualang untuk mengejar posisi teratas!_
`.trim();

      return reply(text);
    }

    // ──────────────────────────────────────────────────────────
    // 12. TRANSFER KOIN ANTAR PEMAIN (.transfer / .pay)
    // ──────────────────────────────────────────────────────────
    if (['transfer', 'pay'].includes(command)) {
      // Ambil tag target atau nomor
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.participant;
      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
      
      let targetJid = mentioned || quoted;
      let amountStr = '';

      if (targetJid) {
        // Format: .transfer @tag 500
        amountStr = args.replace(/@\d+/g, '').trim();
      } else {
        // Format: .transfer 628xxx 500
        const parts = args.trim().split(/\s+/);
        if (parts.length >= 2 && /^\d+$/.test(parts[0])) {
          targetJid = `${parts[0].replace(/[^0-9]/g, '')}@s.whatsapp.net`;
          amountStr = parts[1];
        }
      }

      if (!targetJid) {
        return reply(`⚠️ Format salah!\nReply/tag teman yang ingin dikirim koin:\n*${prefix}transfer @teman <jumlah>*\nContoh: *${prefix}transfer @user 500*`);
      }

      if (targetJid === sender) {
        return reply('😅 Kamu tidak bisa mentransfer uang ke dirimu sendiri!');
      }

      const amount = parseInt(amountStr);
      if (isNaN(amount) || amount <= 0) {
        return reply('⚠️ Masukkan nominal koin yang valid (angka bulat positif)!');
      }

      if (user.money < amount) {
        return reply(`💸 Saldo koinmu tidak cukup!\nSaldo kamu: *${formatNumber(user.money)} Gold*\nIngin transfer: *${formatNumber(amount)} Gold*.`);
      }

      const targetUser = getUser(targetJid, 'Kawan Petualang');
      user.money -= amount;
      targetUser.money += amount;

      saveRpgDb();
      return reply(`💸 *TRANSFER BERHASIL!*
Telah mengirimkan *${formatNumber(amount)} Gold* kepada *${targetUser.name}*!
Sisa saldo kamu: *${formatNumber(user.money)} Gold*.`);
    }

    // ──────────────────────────────────────────────────────────
    // 13. TANTANGAN PVP DUEL (.duel / .pvp)
    // ──────────────────────────────────────────────────────────
    if (['duel', 'pvp'].includes(command)) {
      if (!isGroup) {
        return reply('⚠️ Fitur duel antar pemain hanya bisa dimainkan di dalam grup WhatsApp!');
      }

      const quoted = msg.message?.extendedTextMessage?.contextInfo?.participant;
      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
      const targetJid = mentioned || quoted;

      if (!targetJid) {
        return reply(`⚔️ *TANTANG DUEL TEMAN!*\nFormat: *${prefix}duel @teman <taruhan_koin>*\nContoh: *${prefix}duel @user 500*\n_(Isi 0 jika tanpa taruhan)_`);
      }

      if (targetJid === sender) {
        return reply('😅 Kamu tidak bisa menantang dirimu sendiri untuk duel!');
      }

      if (targetJid.includes(sock.user?.id?.split(':')[0])) {
        return reply('🤖 Bot tidak bisa diajak duel! Tantang anggota grup yang lain.');
      }

      let betStr = args.replace(/@\d+/g, '').trim();
      let bet = parseInt(betStr);
      if (isNaN(bet) || bet < 0) bet = 0;

      const targetUser = getUser(targetJid, 'Kawan Petualang');

      if (bet > 0) {
        if (user.money < bet) {
          return reply(`💸 Koin kamu tidak cukup untuk taruhan ini!\nSaldo kamu: *${formatNumber(user.money)} Gold*, Taruhan: *${formatNumber(bet)} Gold*.`);
        }
        if (targetUser.money < bet) {
          return reply(`💸 Lawanmu tidak punya cukup koin untuk taruhan ini!\nSaldo ${targetUser.name}: *${formatNumber(targetUser.money)} Gold*.`);
        }
      }

      if (user.hp < 25) {
        return reply(`⚠️ Darahmu sekarat (HP: ${user.hp}/${user.maxHp})!\nSembuhkan lukamu dengan *${prefix}heal* sebelum bertarung.`);
      }

      if (targetUser.hp < 25) {
        return reply(`⚠️ Lawanmu (${targetUser.name}) sedang sekarat (HP: ${targetUser.hp}/${targetUser.maxHp})!\nTunggu dia pulih terlebih dahulu.`);
      }

      if (global.rpgDuels[jid]) {
        return reply(`⚠️ Masih ada duel yang sedang berlangsung atau menunggu konfirmasi di grup ini!\nKetik *${prefix}tolak* jika ingin membatalkannya.`);
      }

      // Buat sesi duel dengan timer batas waktu 60 detik
      global.rpgDuels[jid] = {
        challenger: sender,
        challengerName: user.name,
        target: targetJid,
        targetName: targetUser.name,
        bet,
        timer: setTimeout(() => {
          if (global.rpgDuels[jid]) {
            reply(`⏳ Waktu konfirmasi duel antara *${user.name}* dan *${targetUser.name}* telah habis! Tantangan dibatalkan.`);
            delete global.rpgDuels[jid];
          }
        }, 60000)
      };

      const taruhanText = bet > 0 ? `💰 *Taruhan Koin:* ${formatNumber(bet)} Gold` : '💰 *Taruhan:* Adu Kehormatan (0 Gold)';

      return reply(`
⚔️ *TANTANGAN DUEL TELAH DILAYANGKAN!*
👤 *Penantang:* ${user.name} (Lv. ${user.level})
🎯 *Target Lawan:* ${targetUser.name} (Lv. ${targetUser.level})
${taruhanText}

Kepada *${targetUser.name}*, silakan konfirmasi dalam 60 detik:
👉 Ketik *${prefix}terima* untuk menyetujui duel!
👉 Ketik *${prefix}tolak* untuk menolak duel.
`.trim());
    }

    // ──────────────────────────────────────────────────────────
    // 14. MENERIMA TANTANGAN DUEL (.terima / .gas / .terimaduel)
    // ──────────────────────────────────────────────────────────
    if (['terima', 'terimaduel', 'gas'].includes(command)) {
      if (!isGroup) return;
      const session = global.rpgDuels[jid];
      if (!session) {
        return reply('⚠️ Tidak ada tantangan duel yang sedang menunggu konfirmasi di grup ini!');
      }

      if (sender !== session.target) {
        return reply(`⚠️ Hanya *${session.targetName}* yang berhak menerima tantangan duel ini!`);
      }

      clearTimeout(session.timer);

      // Re-fetch kedua data pengguna terkini
      const u1 = getUser(session.challenger, session.challengerName);
      const u2 = getUser(session.target, session.targetName);

      // Re-validate saldo & HP
      if (session.bet > 0 && (u1.money < session.bet || u2.money < session.bet)) {
        delete global.rpgDuels[jid];
        return reply('❌ Duel dibatalkan karena saldo salah satu pemain tidak mencukupi untuk taruhan!');
      }

      // Simulasi pertarungan PvP
      const power1 = (u1.level * 10) + (u1.equipment.weaponAtk || 5) + Math.floor(Math.random() * 30);
      const def1 = u1.equipment.armorDef || 2;

      const power2 = (u2.level * 10) + (u2.equipment.weaponAtk || 5) + Math.floor(Math.random() * 30);
      const def2 = u2.equipment.armorDef || 2;

      const dmgTo2 = Math.max(10, power1 - def2);
      const dmgTo1 = Math.max(10, power2 - def1);

      const score1 = power1 + (u1.hp * 0.4);
      const score2 = power2 + (u2.hp * 0.4);

      let winner, loser, winDmg, loseDmg;
      if (score1 >= score2) {
        winner = u1;
        loser = u2;
        winDmg = dmgTo1;
        loseDmg = dmgTo2;
      } else {
        winner = u2;
        loser = u1;
        winDmg = dmgTo2;
        loseDmg = dmgTo1;
      }

      // Update darah
      winner.hp = Math.max(1, winner.hp - winDmg);
      loser.hp = Math.max(1, loser.hp - loseDmg);

      // Taruhan
      if (session.bet > 0) {
        loser.money -= session.bet;
        winner.money += session.bet;
      }

      // Update statistik
      winner.stats.pvpWins = (winner.stats.pvpWins || 0) + 1;
      loser.stats.pvpLosses = (loser.stats.pvpLosses || 0) + 1;

      // EXP
      const winExp = addExp(winner, 75);
      const loseExp = addExp(loser, 25);

      delete global.rpgDuels[jid];
      saveRpgDb();

      let text = `
⚔️ *DUEL BERLANGSUNG SENJATA BENTROK!*
💥 *${winner.name}* menghunus ${winner.equipment.weapon} dan mendominasi medan tempur!
🛡️ *${loser.name}* tertekan oleh gempuran serangan bertubi-tubi!

🏆 *HASIL PERTARUNGAN:*
🥇 *PEMENANG:* *${winner.name}* (Sisa HP: ${winner.hp}/${winner.maxHp})
🥈 *KALAH:* *${loser.name}* (Sisa HP: ${loser.hp}/${loser.maxHp})

🎁 *Hadiah Duel:*
• Pemenang: +${session.bet > 0 ? formatNumber(session.bet) + ' Gold | ' : ''}+75 EXP
• Kalah: +25 EXP hiburan ${session.bet > 0 ? `(-${formatNumber(session.bet)} Gold)` : ''}
`.trim();

      if (winExp.leveledUp) {
        text += `\n\n🎉 *LEVEL UP!* ${winner.name} naik ke *Level ${winExp.newLevel}*!`;
      }

      return reply(text);
    }

    // ──────────────────────────────────────────────────────────
    // 15. MENOLAK TANTANGAN DUEL (.tolak / .tolakduel)
    // ──────────────────────────────────────────────────────────
    if (['tolak', 'tolakduel'].includes(command)) {
      if (!isGroup) return;
      const session = global.rpgDuels[jid];
      if (!session) {
        return reply('⚠️ Tidak ada tantangan duel yang sedang berjalan di grup ini.');
      }

      if (sender !== session.target && sender !== session.challenger) {
        return reply('⚠️ Kamu bukan peserta dari tantangan duel ini!');
      }

      clearTimeout(session.timer);
      delete global.rpgDuels[jid];
      return reply(`🏳️ Tantangan duel antara *${session.challengerName}* dan *${session.targetName}* telah dibatalkan.`);
    }

    // ──────────────────────────────────────────────────────────
    // 16. BOSS RAID GRUP (.raid / .boss / .cekkondisi)
    // ──────────────────────────────────────────────────────────
    if (['raid', 'boss', 'cekkondisi'].includes(command)) {
      if (!isGroup) {
        return reply('⚠️ Misi Boss Raid adalah pertempuran akbar yang hanya bisa dilakukan di dalam grup!');
      }

      const activeRaid = global.rpgRaids[jid];

      // Jika ada raid aktif, tampilkan kondisinya
      if (activeRaid) {
        const hpBar = renderBar(activeRaid.hp, activeRaid.maxHp, 10);
        const sisaWaktu = formatDuration(Math.max(0, activeRaid.expiresAt - now));
        const persenHp = Math.round((activeRaid.hp / activeRaid.maxHp) * 100);

        // Ambil Top 3 kontributor
        const topHitter = Object.values(activeRaid.contributors)
          .sort((a, b) => b.damage - a.damage)
          .slice(0, 3)
          .map((c, i) => `${i + 1}. *${c.name}*: ${formatNumber(c.damage)} DMG (${c.hits}x Serang)`)
          .join('\n');

        return reply(`
╭━━━━━「 👑 *STATUS BOSS RAID AKTIF* 」━━━━━╮
┃ 👹 *Musuh:* ${activeRaid.name}
┃ 📜 _${activeRaid.title}_
┃ ⏳ *Sisa Waktu:* ${sisaWaktu}
┃
┃ ❤️ *Darah Boss:*
┃ [${hpBar}] ${formatNumber(activeRaid.hp)} / ${formatNumber(activeRaid.maxHp)} (${persenHp}%)
┃
┃ 🏆 *Top Penyerang Sementara:*
${topHitter ? topHitter.split('\n').map(l => '┃ ' + l).join('\n') : '┃  _Belum ada yang menyerang!_'}
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

⚔️ *Ayo serang bersama!* Ketik: *${prefix}serang*
`.trim());
      }

      // Jika belum ada raid aktif, periksa cooldown spawn
      const lastRaid = global.rpgRaidCooldowns[jid] || 0;
      const raidCooldown = 600000; // 10 menit jeda antar raid per grup
      if (now - lastRaid < raidCooldown) {
        const sisa = formatDuration(raidCooldown - (now - lastRaid));
        return reply(`🛡️ Wilayah ini masih aman dan tenang!\nMonster raksasa berikutnya baru akan muncul dalam: *${sisa}*.`);
      }

      // Ambil boss acak dari katalog
      const bossData = RAID_BOSSES[Math.floor(Math.random() * RAID_BOSSES.length)];

      // Variasi acak trait gelar dan stat HP & ATK agar selalu berbeda-beda
      const traits = [
        { prefix: "🔥 [Beringas]", hpMult: 1.15, atkMult: 1.2, rewardMult: 1.2 },
        { prefix: "⚡ [Murka]", hpMult: 1.1, atkMult: 1.3, rewardMult: 1.25 },
        { prefix: "💀 [Terkutuk]", hpMult: 1.25, atkMult: 1.15, rewardMult: 1.2 },
        { prefix: "👑 [Kuno]", hpMult: 1.3, atkMult: 1.2, rewardMult: 1.3 },
        { prefix: "🌌 [Abyssal]", hpMult: 1.4, atkMult: 1.35, rewardMult: 1.4 },
        { prefix: "🛡️ [Berdarah Besi]", hpMult: 1.35, atkMult: 1.05, rewardMult: 1.15 },
        { prefix: "", hpMult: 1.0, atkMult: 1.0, rewardMult: 1.0 }
      ];
      const selectedTrait = traits[Math.floor(Math.random() * traits.length)];
      const randomVariance = 0.92 + (Math.random() * 0.16); // 92% - 108%

      const finalHp = Math.floor(bossData.hp * selectedTrait.hpMult * randomVariance);
      const finalAtk = Math.floor(bossData.atk * selectedTrait.atkMult * randomVariance);
      const finalGold = Math.floor(bossData.rewardGold * selectedTrait.rewardMult);
      const finalExp = Math.floor(bossData.rewardExp * selectedTrait.rewardMult);
      const bossFullName = selectedTrait.prefix ? `${selectedTrait.prefix} ${bossData.name}` : bossData.name;

      global.rpgRaids[jid] = {
        id: bossData.id,
        name: bossFullName,
        rawName: bossData.name,
        title: bossData.title,
        hp: finalHp,
        maxHp: finalHp,
        atk: finalAtk,
        skills: bossData.skills || ["Hantaman Brutal", "Cakaran Mematikan"],
        rewardGold: finalGold,
        rewardExp: finalExp,
        drops: bossData.drops,
        startedAt: now,
        expiresAt: now + (20 * 60 * 1000), // 20 menit per raid
        contributors: {},
        timer: setTimeout(() => {
          if (global.rpgRaids[jid]) {
            reply(`⏳ *WAKTU HABIS!* ${bossFullName} meraung congkak dan melarikan diri ke sarangnya!\nAnggota grup gagal menaklukkan boss raid.`);
            global.rpgRaidCooldowns[jid] = Date.now();
            delete global.rpgRaids[jid];
          }
        }, 20 * 60 * 1000)
      };

      const hpBar = renderBar(finalHp, finalHp, 10);

      let mentions = [];
      try {
        const meta = await sock.groupMetadata(jid);
        mentions = (meta.participants || []).map(p => p.id);
      } catch {}

      const raidSent = await sock.sendMessage(jid, {
        text: `
🔥━━━━━「 🚨 *WORLD BOSS MUNCUL!* 🚨 」━━━━━🔥
*${bossFullName}* telah menginvasi grup ini!

👹 *Monster:* ${bossFullName}
📜 *Pangkat:* ${bossData.title}
❤️ *HP Total:* [${hpBar}] ${formatNumber(finalHp)} HP
⚔️ *Daya Serang:* ~${finalAtk} ATK
⏱️ *Batas Waktu:* 20 Menit

🎁 *Total Hadiah Kemenangan:*
• 💰 ${formatNumber(finalGold)} Koin
• 📈 ${formatNumber(finalExp)} EXP
• 💎 Berlian, Emas, & Besi untuk penyerang teratas!

⚔️ *Ayo serang bersama!* Ketik: *${prefix}serang*
📢 _Ajak teman grup:_ Ketik *${prefix}tagraid*
💡 _Hapus semua chat raid di grup: ketik *${prefix}del raid*_
`.trim(),
        mentions
      }, { quoted: msg });

      if (raidSent?.key?.id) {
        recordBotMsg(jid, raidSent.key.id, 'raid', 'rpg');
        if (!global.botMessageHistory) global.botMessageHistory = new Map();
        if (!global.botMessageHistory.has(jid)) global.botMessageHistory.set(jid, []);
        global.botMessageHistory.get(jid).push({ id: raidSent.key.id, command: 'raid', category: 'rpg', timestamp: Date.now() });
        if (global.rpgRaids[jid]) {
          global.rpgRaids[jid].messageIds = global.rpgRaids[jid].messageIds || [];
          global.rpgRaids[jid].messageIds.push(raidSent.key.id);
        }
      }
      return raidSent;
    }

    // ──────────────────────────────────────────────────────────
    // 16B. AJAK TEMAN SERANG BOSS (.tagraid / .ajakraid)
    // ──────────────────────────────────────────────────────────
    if (['tagraid', 'ajakraid'].includes(command)) {
      if (!isGroup) return reply('⚠️ Perintah ini hanya bisa digunakan di dalam grup!');
      const raid = global.rpgRaids[jid];
      if (!raid) {
        return reply(`⚠️ Tidak ada Boss Raid yang sedang berlangsung di grup ini!\nKetik *${prefix}raid* untuk memanggil boss.`);
      }

      let mentions = [];
      try {
        const meta = await sock.groupMetadata(jid);
        mentions = (meta.participants || []).map(p => p.id);
      } catch {}

      const hpBar = renderBar(raid.hp, raid.maxHp, 10);
      const persen = Math.round((raid.hp / raid.maxHp) * 100);
      const sisaWaktu = formatDuration(Math.max(0, raid.expiresAt - now));

      const tagSent = await sock.sendMessage(jid, {
        text: `
🚨 *PANGGILAN PERANG WORLD BOSS RAID!* 🚨
👤 *${user.name}* memanggil seluruh petualang di grup ini untuk membantu mengalahkan *${raid.name}*!

❤️ *Sisa Darah Boss:* [${hpBar}] ${formatNumber(raid.hp)} / ${formatNumber(raid.maxHp)} HP (${persen}%)
⏳ *Sisa Waktu:* ${sisaWaktu}

⚔️ *Ayo serang sekarang bareng-bareng!*
👉 Ketik *${prefix}serang* untuk memukul!
💡 _Hapus semua chat raid: ketik *${prefix}del raid*_
`.trim(),
        mentions
      }, { quoted: msg });

      if (tagSent?.key?.id) {
        recordBotMsg(jid, tagSent.key.id, 'raid', 'rpg');
        if (!global.botMessageHistory) global.botMessageHistory = new Map();
        if (!global.botMessageHistory.has(jid)) global.botMessageHistory.set(jid, []);
        global.botMessageHistory.get(jid).push({ id: tagSent.key.id, command: 'raid', category: 'rpg', timestamp: Date.now() });
        if (global.rpgRaids[jid]) {
          global.rpgRaids[jid].messageIds = global.rpgRaids[jid].messageIds || [];
          global.rpgRaids[jid].messageIds.push(tagSent.key.id);
        }
      }
      return tagSent;
    }

    // ──────────────────────────────────────────────────────────
    // 17. MENYERANG BOSS RAID (.serang / .hit / .attack)
    // ──────────────────────────────────────────────────────────
    if (['serang', 'hit', 'attack'].includes(command)) {
      if (!isGroup) return;
      const raid = global.rpgRaids[jid];
      if (!raid) {
        return reply(`⚠️ Tidak ada Boss Raid yang sedang berlangsung di grup ini!\nKetik *${prefix}raid* untuk memanggil monster raksasa.`);
      }

      if (user.stamina < 10) {
        return reply(`⚡ Staminamu tidak cukup untuk menyerang monster raksasa (${user.stamina}/100)!\nMinimal butuh *10 Stamina*.`);
      }

      if (user.hp <= 20) {
        return reply(`⚠️ Darahmu sekarat (HP: ${user.hp}/${user.maxHp})!\nTerlalu berbahaya untuk mendekati boss. Ketik *${prefix}heal* dulu.`);
      }

      // Cooldown pukul per pemain (10 detik)
      const lastHit = raid.contributors[sender]?.lastHitTime || 0;
      if (now - lastHit < 10000) {
        const sisaDetik = Math.ceil((10000 - (now - lastHit)) / 1000);
        return reply(`⏳ Napasmu masih terengah-engah! Tunggu *${sisaDetik} detik* lagi sebelum mengayunkan senjata kembali.`);
      }

      // Kurangi stamina
      user.stamina -= 10;

      // Ambil buff pet aktif
      const petBuff = getPetBuff(user);

      // 1. Hitung damage pemain ke boss (skala Senjata & Critical Hit + Pet ATK)
      const weaponBonus = user.equipment.weaponAtk || 5;
      const isPlayerCrit = Math.random() < (0.25 + (petBuff.critBonus || 0)); // 25% + Pet Crit
      const critMultiplier = isPlayerCrit ? (1.75 + (Math.random() * 0.5)) : 1.0;
      const basePlayerDmg = (user.level * 22) + (weaponBonus * 2.2) + (petBuff.atkBonus * 1.5) + Math.floor(Math.random() * 50) + 40;
      const playerDmg = Math.floor(basePlayerDmg * critMultiplier);

      // 2. Serangan balik boss ke pemain (dengan variasi skill boss & zirah + Pet DEF)
      const skills = raid.skills || ["Hantaman Mematikan", "Cakaran Badai", "Guncangan Gempa"];
      const skillName = skills[Math.floor(Math.random() * skills.length)];
      
      const isBossCrit = Math.random() < 0.22; // 22% serangan kuat boss
      const bossMult = isBossCrit ? (1.4 + (Math.random() * 0.4)) : (0.85 + (Math.random() * 0.35));
      const rawBossAtk = Math.floor(raid.atk * bossMult);
      const armorBonus = user.equipment.armorDef || 2;
      const totalArmor = armorBonus + (petBuff.defBonus || 0);
      
      // Zirah & Pet meredam serangan
      const mitigatedDmg = Math.max(Math.floor(rawBossAtk * 0.28), rawBossAtk - Math.floor(totalArmor * 0.8));
      const counterDmg = Math.max(12, Math.floor(mitigatedDmg + (Math.random() * 12) - 6));
      user.hp = Math.max(1, user.hp - counterDmg);

      // Pet beraksi saat raid
      if (petBuff.isActive) {
        user.pet.hunger = Math.max(0, (user.pet.hunger || 0) - 2);
        addPetExp(user, 15);
      }

      // Catat kontribusi
      if (!raid.contributors[sender]) {
        raid.contributors[sender] = {
          jid: sender,
          name: user.name,
          damage: 0,
          hits: 0,
          lastHitTime: now
        };
      }
      raid.contributors[sender].damage += playerDmg;
      raid.contributors[sender].hits += 1;
      raid.contributors[sender].lastHitTime = now;
      user.stats.raidDamageDealt = (user.stats.raidDamageDealt || 0) + playerDmg;

      // Kurangi darah boss
      raid.hp = Math.max(0, raid.hp - playerDmg);

      // Jika boss masih hidup
      if (raid.hp > 0) {
        saveRpgDb();
        const hpBar = renderBar(raid.hp, raid.maxHp, 10);
        const persen = Math.round((raid.hp / raid.maxHp) * 100);

        const playerAttackHeadline = isPlayerCrit 
          ? `⚔️💥 *CRITICAL HIT!* Serangan dahsyat menembus titik lemah boss!` 
          : `💥 *SERANGAN TELAK MENGHANTAM!*`;

        const bossCounterHeadline = isBossCrit
          ? `⚡ *SKILL KHUSUS BOSS:* ${raid.name} melepaskan *"${skillName}"*!`
          : `💢 *Serangan Balik:* ${raid.name} membalas dengan *"${skillName}"*!`;

        let warningHp = '';
        if (user.hp <= 25) {
          warningHp = `\n⚠️ *PERINGATAN:* Darahmu sekarat! Segera gunakan *${prefix}use potion_hp* sebelum menyerang kembali!`;
        }

        return reply(`
${playerAttackHeadline}
👤 *${user.name}* menghunus *${user.equipment.weapon}*!
🗡️ Damage Dihasilkan: *-${formatNumber(playerDmg)} HP* ${isPlayerCrit ? '*(CRIT! 🔥)*' : ''}

${bossCounterHeadline}
💔 Luka Diterima: *-${formatNumber(counterDmg)} HP* (Darahmu: ${user.hp}/${user.maxHp})
⚡ Sisa Stamina: ${user.stamina}/${user.maxStamina}${warningHp}

👹 *Kondisi ${raid.name}:*
[${hpBar}] ${formatNumber(raid.hp)} / ${formatNumber(raid.maxHp)} HP (${persen}%)

🔥 _Ayo serang lagi ketik *${prefix}serang*!_
💡 _Hapus semua chat raid: ketik *${prefix}del raid* (atau quote *.del*)_
`.trim());
      }

      // ────────────────────────────────────────────────────────
      // BOSS BERHASIL DIKALAHKAN! (VICTORY & DISTRIBUSI HADIAH)
      // ────────────────────────────────────────────────────────
      clearTimeout(raid.timer);
      global.rpgRaidCooldowns[jid] = Date.now();

      const contributorsList = Object.values(raid.contributors)
        .sort((a, b) => b.damage - a.damage);

      const totalDmgDealt = contributorsList.reduce((acc, c) => acc + c.damage, 0) || 1;

      let rewardSummary = [];

      for (let i = 0; i < contributorsList.length; i++) {
        const c = contributorsList[i];
        const participantUser = getUser(c.jid, c.name);
        const ratio = c.damage / totalDmgDealt;

        // Porsi hadiah emas & exp sesuai persentase damage
        let goldShare = Math.floor(raid.rewardGold * ratio);
        let expShare = Math.floor(raid.rewardExp * ratio);
        let dropItems = [];

        if (i === 0) {
          // MVP (Peringkat 1)
          goldShare += 2500;
          expShare += 600;
          participantUser.inventory.berlian += (raid.drops.berlian || 2);
          participantUser.inventory.emas += (raid.drops.emas || 5);
          participantUser.token = (participantUser.token || 0) + 3;
          dropItems.push(`💎 +${raid.drops.berlian || 2} Berlian`, `🪙 +${raid.drops.emas || 5} Emas`, `🔮 +3 Token Mistis`);
        } else if (i === 1) {
          // Peringkat 2
          goldShare += 1000;
          expShare += 300;
          participantUser.inventory.berlian += 1;
          participantUser.inventory.emas += 3;
          participantUser.token = (participantUser.token || 0) + 2;
          dropItems.push(`💎 +1 Berlian`, `🪙 +3 Emas`, `🔮 +2 Token Mistis`);
        } else if (i === 2) {
          // Peringkat 3
          goldShare += 500;
          expShare += 150;
          participantUser.inventory.emas += 2;
          participantUser.inventory.besi += 5;
          participantUser.token = (participantUser.token || 0) + 1;
          dropItems.push(`🪙 +2 Emas`, `⚙️ +5 Besi`, `🔮 +1 Token Mistis`);
        } else {
          // Peserta Lainnya
          participantUser.inventory.besi += 3;
          dropItems.push(`⚙️ +3 Besi`);
          if (Math.random() < 0.5) {
            participantUser.token = (participantUser.token || 0) + 1;
            dropItems.push(`🔮 +1 Token Mistis`);
          }
        }

        participantUser.money += goldShare;
        participantUser.stats.raidBossesKilled = (participantUser.stats.raidBossesKilled || 0) + 1;
        const lvlRes = addExp(participantUser, expShare);

        const badge = i === 0 ? '🥇 *MVP*' : i === 1 ? '🥈 *#2*' : i === 2 ? '🥉 *#3*' : `🏅 *#${i + 1}*`;
        rewardSummary.push(`${badge} *${c.name}*
   💥 Total Damage: ${formatNumber(c.damage)} (${Math.round(ratio * 100)}%)
   🎁 Hadiah: +${formatNumber(goldShare)} Gold, +${expShare} EXP${dropItems.length > 0 ? ', ' + dropItems.join(', ') : ''}${lvlRes.leveledUp ? ' (🎉 *LEVEL UP!*)' : ''}`);
      }

      delete global.rpgRaids[jid];
      saveRpgDb();

      return reply(`
🎉 *BOSS RAID SELESAI!*
*${raid.name}* berhasil dikalahkan oleh anggota grup!

📊 *PAPAN KONTRIBUSI & HADIAH:*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${rewardSummary.join('\n\n')}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌟 _Cek saldo & item barumu di *${prefix}profile* atau *${prefix}inv*._
`.trim());
    }

    // ──────────────────────────────────────────────────────────
    // 18. BANK PETUALANG (.bank / .nabung / .depo / .tarik / .wd)
    // ──────────────────────────────────────────────────────────
    if (['bank', 'nabung', 'depo', 'tarik', 'wd'].includes(command)) {
      user.bank = typeof user.bank === 'number' ? user.bank : 0;

      // Cek Saldo Bank (.bank)
      if (command === 'bank') {
        const text = `
╭━━━━━「 🏦 *BANK PETUALANG KITSUNE* 」━━━━━╮
┃ 👤 *Nasabah:* ${user.name}
┃ 💰 *Dompet (Gold):* ${formatNumber(user.money)} Gold
┃ 🏦 *Tabungan Bank:* ${formatNumber(user.bank)} Gold
┃ 📈 *Bunga Deposito:* 2% setiap klaim *${prefix}daily*
┃ 🛡️ *Keamanan:* 100% Kebal dari Duel & Kematian
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

💡 *Menu Transaksi:*
• \`${prefix}nabung <jumlah/all>\` ─ Setor uang ke brankas bank
• \`${prefix}tarik <jumlah/all>\` ─ Tarik uang tunai ke dompet
• \`${prefix}daily\` ─ Ambil jatah harian & bunga deposito bank
`.trim();

        return reply(text);
      }

      // Menyetor Uang ke Bank (.nabung / .depo)
      if (['nabung', 'depo'].includes(command)) {
        if (!args) {
          return reply(`⚠️ Masukkan nominal koin yang ingin ditabung!\nContoh: *${prefix}nabung 1000* atau *${prefix}nabung all*`);
        }

        const cleanArg = args.trim().toLowerCase();
        let amount = 0;

        if (cleanArg === 'all' || cleanArg === 'semua') {
          amount = user.money;
        } else {
          amount = parseInt(cleanArg.replace(/[^0-9]/g, ''));
        }

        if (isNaN(amount) || amount <= 0) {
          return reply('⚠️ Nominal setoran harus berupa angka positif!');
        }

        if (user.money < amount) {
          return reply(`💸 Saldo dompetmu tidak cukup!\nDompetmu: *${formatNumber(user.money)} Gold*, ingin setor: *${formatNumber(amount)} Gold*.`);
        }

        user.money -= amount;
        user.bank += amount;
        saveRpgDb();

        return reply(`
🏦 *SETORAN BANK BERHASIL!*
💵 Disetor ke Bank: *+${formatNumber(amount)} Gold*
🏦 Saldo Tabungan: *${formatNumber(user.bank)} Gold*
💰 Sisa di Dompet: *${formatNumber(user.money)} Gold*
✨ _Uang di bank aman dari kekalahan duel PvP & petualangan!_
`.trim());
      }

      // Menarik Uang dari Bank (.tarik / .wd)
      if (['tarik', 'wd'].includes(command)) {
        if (!args) {
          return reply(`⚠️ Masukkan nominal koin yang ingin ditarik!\nContoh: *${prefix}tarik 1000* atau *${prefix}tarik all*`);
        }

        const cleanArg = args.trim().toLowerCase();
        let amount = 0;

        if (cleanArg === 'all' || cleanArg === 'semua') {
          amount = user.bank;
        } else {
          amount = parseInt(cleanArg.replace(/[^0-9]/g, ''));
        }

        if (isNaN(amount) || amount <= 0) {
          return reply('⚠️ Nominal penarikan harus berupa angka positif!');
        }

        if (user.bank < amount) {
          return reply(`💸 Saldo di bank tidak cukup!\nTabunganmu: *${formatNumber(user.bank)} Gold*, ingin ditarik: *${formatNumber(amount)} Gold*.`);
        }

        user.bank -= amount;
        user.money += amount;
        saveRpgDb();

        return reply(`
🏦 *PENARIKAN BANK BERHASIL!*
💵 Ditarik ke Dompet: *+${formatNumber(amount)} Gold*
💰 Saldo Dompet: *${formatNumber(user.money)} Gold*
🏦 Sisa Tabungan Bank: *${formatNumber(user.bank)} Gold*
`.trim());
      }
    }

    // ──────────────────────────────────────────────────────────
    // 19. KASINO & MINI-GAMES (.slot / .spin / .coinflip / .cf)
    // ──────────────────────────────────────────────────────────
    if (['slot', 'spin', 'coinflip', 'cf'].includes(command)) {
      // 1. GAME SLOT MACHINE (.slot / .spin)
      if (['slot', 'spin'].includes(command)) {
        if (!args) {
          return reply(`
🎰 *KASINO MESIN SLOT KITSUNE* 🎰
Uji keberuntunganmu melawan keganasan mesin slot bandar!
⚠️ _Peringatan: Bandar slot sangat kejam, resiko rungkad 75%!_

📜 *Tabel Hadiah (3 Rel Kembar):*
• 👑 👑 👑 ─ Jackpot Raja (*25x Taruhan*)
• 💎 💎 💎 ─ Jackpot Berlian (*15x Taruhan*)
• 7️⃣ 7️⃣ 7️⃣ ─ Lucky Seven (*10x Taruhan*)
• 🔔 🔔 🔔 ─ Golden Bell (*6x Taruhan*)
• 🍋 🍋 🍋 ─ Lemon Segar (*4x Taruhan*)
• 🍇 🍇 🍇 ─ Anggur Manis (*3.5x Taruhan*)
• 🍒 🍒 🍒 ─ Cherry Merah (*3x Taruhan*)
• 2 Simbol Kembar ─ Hiburan Tipis (*1.2x Taruhan*)

💡 *Cara Main:*
• \`${prefix}slot <taruhan>\` (Contoh: \`${prefix}slot 500\`)
• Minimal taruhan: *50 Gold* | Maksimal: *50.000 Gold*
`.trim());
        }

        const cleanArg = args.trim().toLowerCase();
        let bet = 0;
        if (cleanArg === 'all' || cleanArg === 'semua') {
          bet = Math.min(user.money, 50000);
        } else {
          bet = parseInt(cleanArg.replace(/[^0-9]/g, ''));
        }

        if (isNaN(bet) || bet < 50) {
          return reply('⚠️ Minimal taruhan slot adalah *50 Gold*!');
        }

        if (bet > 50000) {
          return reply('⚠️ Maksimal taruhan slot adalah *50.000 Gold* demi keamanan finansialmu!');
        }

        if (user.money < bet) {
          return reply(`💸 Koin kamu tidak cukup!\nTaruhan: *${formatNumber(bet)} Gold* (Koinmu: ${formatNumber(user.money)} Gold).`);
        }

        const symbolList = [
          { sym: '🍒', name: 'Cherry', mult: 3.0, jackpotWeight: 22 },
          { sym: '🍇', name: 'Anggur', mult: 3.5, jackpotWeight: 20 },
          { sym: '🍋', name: 'Lemon', mult: 4.0, jackpotWeight: 18 },
          { sym: '🔔', name: 'Golden Bell', mult: 6.0, jackpotWeight: 15 },
          { sym: '7️⃣', name: 'Lucky Seven', mult: 10.0, jackpotWeight: 12 },
          { sym: '💎', name: 'Berlian', mult: 15.0, jackpotWeight: 8 },
          { sym: '👑', name: 'Mahkota Raja', mult: 25.0, jackpotWeight: 5 },
        ];

        const roll = Math.random();
        let s1, s2, s3;
        let isWin = false;
        let mult = 0;
        let winType = '';

        if (roll < 0.05) {
          // 1. TIER 1: JACKPOT 3 KEMBAR (Hanya 5% Peluang - Langka & Pecah!)
          const totalJpWeight = symbolList.reduce((acc, s) => acc + s.jackpotWeight, 0);
          let r = Math.random() * totalJpWeight;
          let picked = symbolList[0];
          for (const s of symbolList) {
            if (r < s.jackpotWeight) {
              picked = s;
              break;
            }
            r -= s.jackpotWeight;
          }

          s1 = picked;
          s2 = picked;
          s3 = picked;
          isWin = true;
          mult = picked.mult;
          winType = `🎉💥 *PECAH JACKPOT 3 KEMBAR! (${picked.name})*`;
        } else if (roll < 0.25) {
          // 2. TIER 2: 2 KEMBAR (20% Peluang - Hiburan Balik Modal Dikit)
          const matched = symbolList[Math.floor(Math.random() * symbolList.length)];
          const others = symbolList.filter(s => s.sym !== matched.sym);
          const diff = others[Math.floor(Math.random() * others.length)];
          
          const arrangement = Math.floor(Math.random() * 3);
          if (arrangement === 0) {
            s1 = matched; s2 = matched; s3 = diff;
          } else if (arrangement === 1) {
            s1 = matched; s2 = diff; s3 = matched;
          } else {
            s1 = diff; s2 = matched; s3 = matched;
          }

          isWin = true;
          mult = 1.2;
          winType = `✨ *2 SIMBOL KEMBAR! (${matched.name})* _(Hiburan)_`;
        } else {
          // 3. TIER 3: RUNGKAD / ZONK TOTAL (75% Peluang - Kebanyakan Rungkad!)
          const shuffled = [...symbolList].sort(() => 0.5 - Math.random());
          s1 = shuffled[0];
          s2 = shuffled[1];
          s3 = shuffled[2];
          isWin = false;
        }

        let resultText = '';
        if (isWin) {
          const totalWon = Math.floor(bet * mult);
          const netProfit = totalWon - bet;
          user.money += netProfit;
          resultText = `
${winType}
💰 Menang Hadiah: *+${formatNumber(totalWon)} Gold* (Pengali ${mult}x)!
📈 Laba Bersih: *+${formatNumber(netProfit)} Gold*
Saldo Kamu Sekarang: *${formatNumber(user.money)} Gold*
`.trim();
        } else {
          user.money -= bet;
          const rungkadQuotes = [
            "💀 *RUNGKAD KAU JIR!* Modal disikat habis oleh mesin slot!",
            "💀 *ZONK TOTAL!* Bandar tertawa melihat koinmu melayang!",
            "💀 *RUNGKAD LAGI!* Jangan main slot kalau gak mau miskin!",
            "💀 *LENYAP SUDAH!* Putaran ampas tanpa hasil!",
            "💀 *RUNGKAD ABANGKUH!* Modal menipis, bandar makin kaya!"
          ];
          const quote = rungkadQuotes[Math.floor(Math.random() * rungkadQuotes.length)];
          resultText = `
${quote}
💸 Kehilangan taruhan: *-${formatNumber(bet)} Gold*
Sisa Saldo Kamu: *${formatNumber(user.money)} Gold*
`.trim();
        }

        saveRpgDb();

        const slotVisual = `
🎰━━━━━「 *KASINO SLOT KITSUNE* 」━━━━━🎰
┃
┃   ┌───────────────────────────┐
┃   │   [  ${s1.sym}   |   ${s2.sym}   |   ${s3.sym}  ]   │
┃   └───────────────────────────┘
┃
${resultText}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 Putar lagi: \`${prefix}slot ${bet}\`
`.trim();

        return reply(slotVisual);
      }

      // 2. COIN FLIP (.coinflip / .cf)
      if (['coinflip', 'cf'].includes(command)) {
        const tokens = (args || '').trim().split(/\s+/);
        if (tokens.length < 2) {
          return reply(`
🪙 *KASINO LEMPAR KOIN (50:50)* 🪙
Pilih satu sisi koin dan gandakan taruhanmu!

💡 *Format Perintah:*
\`${prefix}coinflip <gambar/angka> <taruhan>\`
Contoh:
• \`${prefix}cf gambar 1000\`
• \`${prefix}cf angka 500\`

📊 Peluang Menang: *50:50* (Menang dapat *2x Lipat*!)
💵 Minimal: *50 Gold* | Maksimal: *50.000 Gold*
`.trim());
        }

        let choice = '';
        let bet = 0;

        for (const t of tokens) {
          const lower = t.toLowerCase();
          if (['gambar', 'g', 'head', 'heads'].includes(lower)) {
            choice = 'gambar';
          } else if (['angka', 'a', 'tail', 'tails'].includes(lower)) {
            choice = 'angka';
          } else if (lower === 'all' || lower === 'semua') {
            bet = Math.min(user.money, 50000);
          } else if (!isNaN(parseInt(lower))) {
            bet = parseInt(lower);
          }
        }

        if (!choice) {
          return reply('⚠️ Pilih sisi koin: *gambar* atau *angka*!\nContoh: *' + prefix + 'cf gambar 500*');
        }

        if (isNaN(bet) || bet < 50) {
          return reply('⚠️ Minimal taruhan coin flip adalah *50 Gold*!');
        }

        if (bet > 50000) {
          return reply('⚠️ Maksimal taruhan coin flip adalah *50.000 Gold*!');
        }

        if (user.money < bet) {
          return reply(`💸 Koinmu tidak cukup!\nTaruhan: *${formatNumber(bet)} Gold* (Koinmu: ${formatNumber(user.money)} Gold).`);
        }

        const coinResult = Math.random() < 0.5 ? 'gambar' : 'angka';
        const coinIcon = coinResult === 'gambar' ? '🦅 (Gambar)' : '🔢 (Angka)';
        const isPlayerWin = choice === coinResult;

        if (isPlayerWin) {
          user.money += bet;
          saveRpgDb();
          return reply(`
🪙━━━━━「 *COIN FLIP MENANG!* 」━━━━━🪙
Koin dilempar ke udara dan mendarat di...
👉 *${coinIcon}*

🎉 Tebakanmu tepat (*${choice.toUpperCase()}*)!
💰 Kamu memenangkan: *+${formatNumber(bet)} Gold* (Total dapat *${formatNumber(bet * 2)} Gold*)!
💵 Saldo kamu sekarang: *${formatNumber(user.money)} Gold*.
`.trim());
        } else {
          user.money -= bet;
          saveRpgDb();
          return reply(`
🪙━━━━━「 *COIN FLIP KALAH!* 」━━━━━🪙
Koin dilempar ke udara dan mendarat di...
👉 *${coinIcon}*

💀 Tebakanmu meleset (Kamu memilih *${choice.toUpperCase()}*)!
💸 Kehilangan taruhan: *-${formatNumber(bet)} Gold*.
💵 Sisa saldo kamu: *${formatNumber(user.money)} Gold*.
`.trim());
        }
      }
    }

    // ──────────────────────────────────────────────────────────
    // 20. PET COMPANION SYSTEM (.pet / .adopt / .feed / .renamepet)
    // ──────────────────────────────────────────────────────────
    if (['pet', 'adopt', 'adopsi', 'feed', 'kasihmakan', 'renamepet'].includes(command)) {
      // 1. STATUS PET & PUSAT ADOPSI (.pet)
      if (command === 'pet') {
        if (!user.pet || !user.pet.type) {
          const petList = Object.values(PET_TYPES).map((p, i) => {
            return `*${i + 1}. ${p.name}*
   🔮 Biaya Adopsi: *${p.priceToken} Token Mistis*
   ✨ Efek Buff: _${p.desc}_
   👉 Adopsi: \`${prefix}adopt ${p.id} <nama>\``;
          }).join('\n\n');

          const text = `
╭━━━━━「 🐾 *PUSAT ADOPSI PET KITSUNE* 」━━━━━╮
┃ Rawat hewan pendamping setiamu untuk
┃ mendapatkan berbagai buff tempur & petualangan!
┃ 🔮 *Token Mistis Kamu:* ${formatNumber(user.token || 0)} Token
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

${petList}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 *Cara Mengadopsi:*
Ketik: \`${prefix}adopt <jenis> <nama_pet>\`
Contoh: \`${prefix}adopt kitsune Shiro\` atau \`${prefix}adopt fenrir Kuro\`
💡 _Ketik *${prefix}token* untuk info cara mendapatkan Token Mistis langka._
`.trim();

          return reply(text);
        }

        const pet = user.pet;
        const petConfig = PET_TYPES[pet.type] || PET_TYPES.kitsune;
        const buff = petConfig.getBuff(pet.level || 1);
        const expBar = renderBar(pet.exp || 0, pet.maxExp || 100, 8);
        const hungerBar = renderBar(pet.hunger || 0, 100, 8);

        const isHungry = (pet.hunger || 0) <= 0;
        const statusBuff = isHungry 
          ? '❌ *NONAKTIF (Pet Kelaparan!)*' 
          : '✅ *AKTIF (Memberikan Buff)*';

        const text = `
╭━━━━━「 🐾 *STATUS PET COMPANION* 」━━━━━╮
┃ 🏷️ *Nama:* ${pet.name}
┃ 🧬 *Ras:* ${petConfig.name}
┃ 🎖️ *Level:* Lv. ${pet.level || 1}
┃ 📊 *EXP:* [${expBar}] ${pet.exp || 0}/${pet.maxExp || 100}
┃ 🍖 *Hunger:* [${hungerBar}] ${pet.hunger || 0}/100%
┃
┃ 🌟 *Status Buff:* ${statusBuff}
┃  • 🗡️ Bonus ATK: *+${buff.atkBonus} ATK*
┃  • 🛡️ Bonus DEF: *+${buff.defBonus} DEF*
┃  • 📈 Bonus EXP: *+${buff.expPercent}% EXP*
┃  • 💰 Bonus Gold: *+${buff.goldPercent}% Gold*
┃  • 🔥 Serangan Kritis: *+${Math.round((buff.critBonus || 0) * 100)}% Crit*
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

💡 *Menu Interaksi Pet:*
• \`${prefix}feed [jumlah]\` ─ Beri makan pet (1 Makanan = +25 Hunger & +20 EXP)
• \`${prefix}renamepet <nama>\` ─ Mengganti nama panggilan pet
• \`${prefix}adopt <jenis> <nama>\` ─ Ganti dengan ras pet baru
`.trim();

        return reply(text);
      }

      // 2. ADOPSI PET BARU (.adopt / .adopsi)
      if (['adopt', 'adopsi'].includes(command)) {
        if (!args) {
          return reply(`⚠️ Masukkan ras pet dan nama yang diinginkan!\nContoh: *${prefix}adopt kitsune Shiro*\nKetik *${prefix}pet* untuk melihat jenis ras dan harganya.`);
        }

        const parts = args.trim().split(/\s+/);
        const petType = parts[0]?.toLowerCase();
        const petName = parts.slice(1).join(' ').trim();

        const petConfig = PET_TYPES[petType];
        if (!petConfig) {
          const avail = Object.keys(PET_TYPES).join(', ');
          return reply(`❌ Ras pet *"${petType}"* tidak dikenali!\nPilihan yang tersedia: *${avail}*.\nKetik *${prefix}pet* untuk info detail.`);
        }

        if (!petName) {
          return reply(`⚠️ Harap beri nama untuk pet kamu!\nContoh: *${prefix}adopt ${petType} Shiro*`);
        }

        if ((user.token || 0) < petConfig.priceToken) {
          return reply(`
🔮 *TOKEN MISTIS TIDAK CUKUP!*
Biaya adopsi *${petConfig.name}*: *${petConfig.priceToken} Token Mistis*
Token kamu saat ini: *${formatNumber(user.token || 0)} Token* (Kurang ${petConfig.priceToken - (user.token || 0)} Token).

💡 *Cara Mendapatkan Token Mistis Langka:*
• 👹 Kalahkan World Boss Raid (*${prefix}raid* & *${prefix}serang*)
• ⚔️ Peluang drop langka saat Bertualang (*${prefix}adv*)
• ⛏️ Kristal mistis langka saat Menambang (*${prefix}mining*)
• 🌌 Bonus Tarik 10x Gacha (*${prefix}gacha 10*)
• 📜 Ketik *${prefix}token* untuk info lengkap.
`.trim());
        }

        user.token -= petConfig.priceToken;
        user.pet = {
          type: petType,
          name: petName,
          level: 1,
          exp: 0,
          maxExp: 100,
          hunger: 100,
          adoptedAt: now,
        };

        saveRpgDb();

        return reply(`
🎉 *SELAMAT! ADOPSI PET BERHASIL!*
Kamu telah resmi mengadopsi *${petConfig.name}* dengan mahar *${petConfig.priceToken} Token Mistis* dan memberinya nama *"${petName}"*!

🐾 *Stats Awal:*
• Level: 1 (0/100 EXP)
• Hunger: 100% (Kenyang & Siap tempur!)
• Efek Buff: ${petConfig.desc}
🔮 Sisa Token Mistis: *${formatNumber(user.token)} Token*

💡 _Pet akan otomatis mendampingimu di *${prefix}adventure*, *${prefix}mining*, dan *${prefix}serang*!_
💡 _Jangan lupa beri makan dengan *${prefix}feed* jika hunger berkurang._
`.trim());
      }

      // 3. MEMBERI MAKAN PET (.feed / .kasihmakan)
      if (['feed', 'kasihmakan'].includes(command)) {
        if (!user.pet || !user.pet.type) {
          return reply(`⚠️ Kamu belum memiliki pet companion!\nAdopsi pet dulu dengan mengetik *${prefix}pet*.`);
        }

        const available = user.inventory.makanan_pet || 0;
        if (available <= 0) {
          return reply(`❌ Kamu tidak memiliki *Makanan Pet* di tas!\nBeli di *${prefix}shop* seharga 150 Gold.`);
        }

        if ((user.pet.hunger || 0) >= 100) {
          return reply(`🍖 *${user.pet.name}* masih sangat kenyang (Hunger: 100%)!\nBawa dia bertualang (*${prefix}adventure*) dulu sebelum memberinya makan lagi.`);
        }

        let rawCount = 1;
        const argStr = (args || '').trim().toLowerCase();
        if (argStr === 'all' || argStr === 'semua') {
          rawCount = 'all';
        } else if (!isNaN(parseInt(argStr)) && parseInt(argStr) > 0) {
          rawCount = parseInt(argStr);
        }

        const needed = Math.ceil((100 - (user.pet.hunger || 0)) / 25);
        let count = rawCount === 'all' ? Math.min(available, needed) : Math.min(parseInt(rawCount) || 1, available);
        if (count <= 0) count = 1;

        user.inventory.makanan_pet -= count;
        user.pet.hunger = Math.min(100, (user.pet.hunger || 0) + (count * 25));
        const petLvl = addPetExp(user, count * 20);
        saveRpgDb();

        let feedText = `🍖 *NYAM NYAM NYAM~!*
Kamu memberi makan *${count}x Makanan Pet* kepada *${user.pet.name}*!
🍖 Sisa Hunger: *${user.pet.hunger}/100%*
📈 EXP Pet: *+${count * 20} EXP* (${user.pet.exp}/${user.pet.maxExp})
📦 Sisa Makanan Pet di tas: ${user.inventory.makanan_pet} porsi`;

        if (petLvl.leveledUp) {
          feedText += `\n\n🎉 *PET LEVEL UP!* *${user.pet.name}* naik ke *Level ${petLvl.newLevel}*!\nEfek buff pet semakin menguat!`;
        }

        return reply(feedText);
      }

      // 4. MENGGANTI NAMA PET (.renamepet)
      if (['renamepet'].includes(command)) {
        if (!user.pet || !user.pet.type) {
          return reply(`⚠️ Kamu belum memiliki pet companion! Adopsi dulu di *${prefix}pet*.`);
        }

        if (!args) {
          return reply(`⚠️ Masukkan nama baru untuk pet kamu!\nContoh: *${prefix}renamepet Kurama*`);
        }

        const oldName = user.pet.name;
        user.pet.name = args.trim();
        saveRpgDb();

        return reply(`✨ Berhasil mengubah nama pet dari *"${oldName}"* menjadi *"${user.pet.name}"*!`);
      }
    }

    // ──────────────────────────────────────────────────────────
    // 20B. MATA UANG KHUSUS / TOKEN MISTIS (.token / .tokenmistis)
    // ──────────────────────────────────────────────────────────
    if (['token', 'tokenmistis', 'koinmistis'].includes(command)) {
      const text = `
╭━━━━━「 🔮 *TOKEN MISTIS KITSUNE* 」━━━━━╮
┃ 👤 *Pemilik:* ${user.name}
┃ 🔮 *Saldo Token:* ${formatNumber(user.token || 0)} Token Mistis
┃ 💰 *Dompet Gold:* ${formatNumber(user.money)} Gold
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

📖 *Apa itu Token Mistis?*
Token Mistis adalah **mata uang langka & paling berharga** yang digunakan khusus untuk:
• 🐾 Mengadopsi Hewan Pendamping (Pet Companion) di *${prefix}pet*
• 🎁 Menukarkan item keramat & barang berharga langka di masa mendatang!

⚔️ *Cara Mendapatkan Token Mistis Langka:*
1. 👹 *World Boss Raid* (*${prefix}raid* & *${prefix}serang*) ─ Mengalahkan Boss Raid menghadiahkan hingga +3 Token Mistis!
2. 🗺️ *Petualangan Dungeon* (*${prefix}adv*) ─ Peluang langka (5%) menemukan Token Purba saat mengalahkan monster!
3. ⛏️ *Gua Mineral* (*${prefix}mining*) ─ Peluang langka (3%) menemukan kristal mistis saat menambang batu gua!
4. 🌌 *Gacha 10x Pull* (*${prefix}gacha 10*) ─ Bonus pasti +1 Token Mistis setiap tarikan 10x!
`.trim();

      return reply(text);
    }

    // ──────────────────────────────────────────────────────────
    // 21. STATUS DATABASE & PENYIMPANAN DATA (.dbstatus / .cekdb)
    // ──────────────────────────────────────────────────────────
    if (['dbstatus', 'cekdb'].includes(command)) {
      const status = await getDatabaseStatus(true);

      let text = `
╭━━━━━「 💾 *STATUS DATABASE BOT* 」━━━━━╮
┃ 📂 *Tipe:* ${status.storageType}
┃ 👥 *Pemain Terdaftar:* ${status.userCount} Orang
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯
`.trim();

      if (status.isMongoConnected) {
        text += `\n\n✅ *CLOUD DATABASE AKTIF!*
Semua progres level, koin, perlengkapan, dan inventori pemain tersimpan otomatis secara real-time di *MongoDB Atlas*.
Data kamu *100% AMAN* dan tidak akan terhapus meski bot di-restart atau di-deploy ulang di Render!`;
      } else if (status.hasMongoUri) {
        text += `\n\n⚠️ *KONEKSI GAGAL TERHUBUNG!*`;
        if (status.lastError) {
          text += `\n🔍 *Detail Error:* \`${status.lastError}\``;
        }

        if (status.hasBracketWarning) {
          text += `\n\n🚨 *PENYEBAB UTAMA:*
Terdapat tanda kurung siku \`< >\` pada connection string MongoDB Anda!
❌ Salah: \`mongodb+srv://admin:<password>@cluster...\`
✅ Benar: \`mongodb+srv://admin:password@cluster...\`
👉 Harap hapus tanda kurung \`< \` dan \` >\` di Environment Variable Render Anda.`;
        } else {
          text += `\n\n📋 *Langkah Pemeriksaan:*
1. **Password Mengandung Simbol Khusus?**
   Jika password ada simbol \`@\`, \`#\`, \`:\`, ubah password di tab *Database Access* MongoDB menjadi kombinasi huruf & angka sederhana saja (contoh: \`Kitsune123\`).
2. **Akun Database User Sudah Ada?**
   Pastikan Anda membuat user di tab **Database Access** (bukan email login website MongoDB).
3. **Role Akses User:**
   Pastikan di tab Database Access, role user disetel ke *Built-in Role: Read and write to any database*.`;
        }
      } else {
        text += `\n\n⚠️ *PERINGATAN PENYIMPANAN LOKAL:*
Data saat ini tersimpan di file lokal (*database/rpg_database.json*).
Karena Render Free Tier bersifat _ephemeral_, data bisa ter-reset saat bot melakukan deploy ulang dari Git.

💡 *Solusi Simpan Permanen (Gratis):*
1. Buat database gratis di *mongodb.com/atlas*
2. Salin connection string: \`mongodb+srv://...\`
3. Masukkan ke *Environment Variables* di dashboard Render dengan Key: \`MONGODB_URI\`.`;
      }

      return reply(text);
    }
  }
};
