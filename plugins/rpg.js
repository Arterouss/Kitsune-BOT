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
  MONSTERS
} from '../lib/rpg.js';

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
    'adventure', 'petualang', 'adv',
    'mining', 'nambang', 'mine',
    'heal', 'obat',
    'daily', 'klaim',
    'shop', 'toko',
    'buy', 'beli',
    'sell', 'jual',
    'craft', 'tempa',
    'leaderboard', 'top', 'lb',
    'transfer', 'pay'
  ],
  category: 'rpg',
  description: 'Sistem Petualangan RPG, Leveling, Mining, Toko, dan Leaderboard',
  async run({ sock, jid, msg, command, args, prefix, sender, senderName, reply }) {
    const user = getUser(sender, senderName);
    const now = Date.now();

    // ──────────────────────────────────────────────────────────
    // 1. PROFIL & STATUS PEMAIN (.profile / .status / .me)
    // ──────────────────────────────────────────────────────────
    if (['profile', 'status', 'me'].includes(command)) {
      const expBar = renderBar(user.exp, user.maxExp, 8);
      const hpBar = renderBar(user.hp, user.maxHp, 8);
      const staBar = renderBar(user.stamina, user.maxStamina, 8);

      const text = `
╭━━━━━「 👤 *PROFIL PETUALANG* 」━━━━━╮
┃ 🏷️ *Nama:* ${user.name}
┃ 🎖️ *Pangkat:* ${user.title} (Lv. ${user.level})
┃ 💰 *Koin Emas:* ${formatNumber(user.money)} Gold
┃
┃ ❤️ *HP:* [${hpBar}] ${user.hp}/${user.maxHp}
┃ ⚡ *Stamina:* [${staBar}] ${user.stamina}/${user.maxStamina}
┃ 📊 *EXP:* [${expBar}] ${user.exp}/${user.maxExp}
┃
┃ 🗡️ *Senjata:* ${user.equipment.weapon} (+${user.equipment.weaponAtk} ATK)
┃ 🛡️ *Zirah:* ${user.equipment.armor} (+${user.equipment.armorDef} DEF)
┃ ⛏️ *Beliung:* ${user.equipment.pickaxe}
┃
┃ 📜 *Catatan Petualang:*
┃  • Menang Adventure: ${formatNumber(user.stats.adventures)} kali
┃  • Monster Dibantai: ${formatNumber(user.stats.monstersKilled)} ekor
┃  • Tambang Dikeruk: ${formatNumber(user.stats.minedCount)} kali
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

💡 _Ketik *${prefix}adventure* untuk bertualang atau *${prefix}inv* untuk cek tas._
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
┃
┃ 🪵 *Hasil Alam & Tambang:*
┃  • Kayu Hutan: ${formatNumber(inv.kayu)}
┃  • Batu Gua: ${formatNumber(inv.batu)}
┃  • Bijih Besi: ${formatNumber(inv.besi)}
┃  • Bijih Emas: ${formatNumber(inv.emas)}
┃  • Berlian Murni: ${formatNumber(inv.berlian)}
┃
┃ 🧪 *Ramuan & Konsumsi:*
┃  • Ramuan HP (+60): ${formatNumber(inv.potion_hp)} buah
┃  • Minuman Stamina (+60): ${formatNumber(inv.potion_stamina)} buah
┃
┃ ⚔️ *Perlengkapan Terpasang:*
┃  • ${user.equipment.weapon} (+${user.equipment.weaponAtk} ATK)
┃  • ${user.equipment.armor} (+${user.equipment.armorDef} DEF)
┃  • ${user.equipment.pickaxe}
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

💡 *Menu Interaksi:*
• Ketik *${prefix}jual <nama/all>* untuk jual hasil ke toko.
• Ketik *${prefix}craft* untuk membuat senjata & zirah baru.
• Ketik *${prefix}heal* untuk minum ramuan pemulih HP.
`.trim();

      return reply(text);
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

      // Simulasi pertarungan
      const playerAtk = (user.level * 8) + (user.equipment.weaponAtk || 5) + Math.floor(Math.random() * 20);
      const monsterHp = monster.baseHp;

      // Hitung damage monster ke pemain (dikurangi Armor DEF)
      const rawDmg = Math.max(5, monster.atk + Math.floor(Math.random() * 10) - (user.equipment.armorDef || 2));
      
      // Pemain menang jika attack cukup
      const isWin = playerAtk >= (monsterHp * 0.4);

      user.cooldowns.adventure = now;
      user.stamina -= 20;

      if (isWin) {
        const expGained = Math.floor(Math.random() * (monster.expMax - monster.expMin + 1)) + monster.expMin;
        const goldGained = Math.floor(Math.random() * (monster.goldMax - monster.goldMin + 1)) + monster.goldMin;
        
        // Drop bahan acak
        const dropKayu = Math.floor(Math.random() * 4) + 1;
        const dropBatu = Math.floor(Math.random() * 3) + 1;
        const dropBesi = Math.random() < 0.45 ? Math.floor(Math.random() * 2) + 1 : 0;
        const dropEmas = Math.random() < 0.2 ? 1 : 0;
        const dropPotion = Math.random() < 0.15 ? 1 : 0;

        user.inventory.kayu += dropKayu;
        user.inventory.batu += dropBatu;
        user.inventory.besi += dropBesi;
        user.inventory.emas += dropEmas;
        if (dropPotion) user.inventory.potion_hp += 1;

        user.money += goldGained;
        user.hp = Math.max(1, user.hp - rawDmg);
        user.stats.adventures += 1;
        user.stats.monstersKilled += 1;

        // Tambah EXP & Cek Level Up
        const lvlResult = addExp(user, expGained);

        let drops = [`🪵 +${dropKayu} Kayu`, `🪨 +${dropBatu} Batu`];
        if (dropBesi > 0) drops.push(`⚙️ +${dropBesi} Bijih Besi`);
        if (dropEmas > 0) drops.push(`🪙 +${dropEmas} Bijih Emas`);
        if (dropPotion > 0) drops.push(`🧪 +1 Ramuan HP`);

        let text = `
⚔️ *PETUALANGAN SELESAI (KEMENANGAN!)*
Kamu menjelajahi Hutan Rimba dan bertemu dengan *${monster.name}*!

Pertarungan sengit terjadi:
💥 Seranganmu berhasil melumpuhkan monster!
❤️ Darah berkurang: -${rawDmg} HP (Sisa: ${user.hp}/${user.maxHp})
⚡ Stamina terpakai: -20 (Sisa: ${user.stamina}/${user.maxStamina})

🎁 *Hadiah Yang Didapat:*
• 💰 +${formatNumber(goldGained)} Koin Emas
• 📈 +${expGained} EXP
• ${drops.join('\n• ')}
`.trim();

        if (lvlResult.leveledUp) {
          text += `\n\n🎉 *LEVEL UP!* Selamat, kamu naik ke *Level ${lvlResult.newLevel}*!\n⭐ Gelar Baru: *${user.title}*\n❤️ Max HP bertambah (+15) & darah pulih penuh!\n💰 Bonus Hadiah: +${formatNumber(lvlResult.bonusMoney)} Gold!`;
        }

        saveRpgDb();
        return reply(text);
      } else {
        // Kalah / Melarikan diri
        const severeDmg = Math.min(user.hp - 1, rawDmg + 15);
        user.hp = Math.max(1, user.hp - severeDmg);
        user.stats.timesDefeated += 1;
        const consExp = 15;
        addExp(user, consExp);
        saveRpgDb();

        return reply(`
💀 *KAMU TERPOJOK & MELARIKAN DIRI!*
Kamu bertemu monster buas *${monster.name}*, namun kekuatanmu belum cukup untuk menaklukkannya!

💥 Kamu terluka parah dan kabur ke tempat aman:
❤️ Kehilangan: -${severeDmg} HP (Sisa HP: ${user.hp}/${user.maxHp})
⚡ Stamina: -20
📈 EXP Hiburan: +${consExp} EXP

💡 _Sembuhkan lukamu dengan *${prefix}heal* atau tempa senjata lebih kuat di *${prefix}craft*._
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
      
      // Hasil tambang tergantung tier beliung
      const batuDapat = Math.floor(Math.random() * 6 * pickTier) + 3;
      const besiDapat = Math.floor(Math.random() * 3 * pickTier) + (Math.random() < 0.6 ? 1 : 0);
      const emasDapat = Math.random() < (0.2 * pickTier) ? Math.floor(Math.random() * 2) + 1 : 0;
      const berlianDapat = Math.random() < (0.05 * pickTier) ? 1 : 0;
      const expDapat = Math.floor(Math.random() * 25) + 20;

      user.inventory.batu += batuDapat;
      user.inventory.besi += besiDapat;
      user.inventory.emas += emasDapat;
      user.inventory.berlian += berlianDapat;
      user.stats.minedCount += 1;

      const lvlResult = addExp(user, expDapat);

      let hasil = [`🪨 +${batuDapat} Batu`];
      if (besiDapat > 0) hasil.push(`⚙️ +${besiDapat} Bijih Besi`);
      if (emasDapat > 0) hasil.push(`🪙 +${emasDapat} Bijih Emas murni!`);
      if (berlianDapat > 0) hasil.push(`💎 *JACKPOT!* +${berlianDapat} Berlian Langka! ✨`);

      let text = `
⛏️ *HASIL TAMBANG GUA MINERAL*
Kamu mengayunkan *${user.equipment.pickaxe}* ke dinding batu gua yang dalam...

📦 *Material Ditemukan:*
• ${hasil.join('\n• ')}
• 📈 +${expDapat} EXP
⚡ Stamina terpakai: -15 (Sisa: ${user.stamina}/${user.maxStamina})
`.trim();

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

      if ((user.inventory.potion_hp || 0) <= 0) {
        return reply(`❌ Kamu tidak memiliki *Ramuan HP* di tas!\nBeli ramuan di *${prefix}shop* atau istirahat sejenak (HP pulih otomatis 1 poin tiap 45 detik).`);
      }

      user.inventory.potion_hp -= 1;
      const healAmount = 60;
      const oldHp = user.hp;
      user.hp = Math.min(user.maxHp, user.hp + healAmount);
      const recovered = user.hp - oldHp;

      saveRpgDb();
      return reply(`🧪 *SLURP~!* Kamu meminum Ramuan HP.\n❤️ Darah pulih +${recovered} HP!\n📊 Kondisi sekarang: *${user.hp}/${user.maxHp} HP* (Sisa ramuan: ${user.inventory.potion_hp})`);
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

      user.money += rewardMoney;
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
• 📈 +${rewardExp} EXP
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
      let listShop = SHOP_ITEMS.map((item, idx) => {
        return `*${idx + 1}. ${item.name}*\n   💰 Harga: *${formatNumber(item.price)} Gold*\n   📝 _${item.desc}_\n   🛒 Beli: \`${prefix}beli ${item.id} 1\``;
      }).join('\n\n');

      const text = `
╭━━━━━「 🛒 *TOKO PETUALANG KITSUNE* 」━━━━━╮
┃ 👤 *Koin Kamu:* ${formatNumber(user.money)} Gold
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

${listShop}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 *Cara Pembelian:*
Ketik: *${prefix}beli <nama_item> <jumlah>*
Contoh: *${prefix}beli potion_hp 2*
`.trim();

      return reply(text);
    }

    // ──────────────────────────────────────────────────────────
    // 8. MEMBELI BARANG (.buy / .beli)
    // ──────────────────────────────────────────────────────────
    if (['buy', 'beli'].includes(command)) {
      if (!args) {
        return reply(`⚠️ Masukkan item yang ingin dibeli!\nContoh: *${prefix}beli potion_hp 2*\nKetik *${prefix}shop* untuk melihat daftar item.`);
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

      const totalPrice = targetItem.price * count;
      if (user.money < totalPrice) {
        return reply(`💸 Koin kamu tidak cukup!\nTotal harga: *${formatNumber(totalPrice)} Gold*\nKoin kamu: *${formatNumber(user.money)} Gold* (Kurang ${formatNumber(totalPrice - user.money)}).`);
      }

      // Proses pembelian
      user.money -= totalPrice;

      if (targetItem.id === 'potion_hp') {
        user.inventory.potion_hp = (user.inventory.potion_hp || 0) + count;
      } else if (targetItem.id === 'potion_stamina') {
        user.inventory.potion_stamina = (user.inventory.potion_stamina || 0) + count;
      } else if (targetItem.id === 'beliung_besi') {
        user.equipment.pickaxe = '⛏️ Beliung Besi Kuat';
        user.equipment.pickaxeTier = 2;
      } else if (targetItem.id === 'pedang_batu') {
        user.equipment.weapon = '🗡️ Pedang Batu Tajam';
        user.equipment.weaponAtk = 12;
      }

      saveRpgDb();
      return reply(`✅ Berhasil membeli *${count}x ${targetItem.name}* seharga *${formatNumber(totalPrice)} Gold*!\nSisa saldo: *${formatNumber(user.money)} Gold*.`);
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
          const reqs = Object.entries(r.cost).map(([k, v]) => `${v} ${k}`).join(', ');
          return `*${i + 1}. ${r.name}*\n   📝 _${r.desc}_\n   🔨 Bahan: *${reqs}*\n   ⚡ Cara Buat: \`${prefix}craft ${r.id}\``;
        }).join('\n\n');

        return reply(`
╭━━━━━「 🔨 *BENGKEL TEMPA SENJATA* 」━━━━━╮
┃ Gabungkan material alam menjadi senjata & perlengkapan perang tingkat tinggi!
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

${recipeList}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Ketik *${prefix}craft <id_resep>* untuk menempa.
Contoh: *${prefix}craft pedang_besi*
`.trim());
      }

      const recipeId = args.trim().toLowerCase();
      const recipe = CRAFT_RECIPES.find(r => r.id === recipeId);
      if (!recipe) {
        return reply(`❌ Resep tempa tidak ditemukan! Ketik *${prefix}craft* untuk melihat resep yang tersedia.`);
      }

      // Cek koin
      if (recipe.cost.koin && user.money < recipe.cost.koin) {
        return reply(`💸 Koin tidak cukup! Butuh *${formatNumber(recipe.cost.koin)} Gold*.`);
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

      // Pasang equipment baru
      if (recipe.type === 'weapon') {
        user.equipment.weapon = recipe.name;
        user.equipment.weaponAtk = recipe.bonusAtk;
      } else if (recipe.type === 'armor') {
        user.equipment.armor = recipe.name;
        user.equipment.armorDef = recipe.bonusDef;
      } else if (recipe.type === 'pickaxe') {
        user.equipment.pickaxe = recipe.name;
        user.equipment.pickaxeTier = recipe.tier;
      }

      saveRpgDb();
      return reply(`
🎉 *BERHASIL MENEMPA PERLENGKAPAN BARU!*
🔨 Kamu berhasil menciptakan: *${recipe.name}*!

✨ Perlengkapan telah otomatis dipasang ke karaktermu!
Cek status tempur barumu di *${prefix}profile*.
`.trim());
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
  }
};
