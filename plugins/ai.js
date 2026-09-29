// plugins/ai.js - Plugin Tanya Jawab AI & Wikipedia
import { askAI, searchWiki } from '../lib/ai.js';

export default {
  name: 'ai',
  command: ['ai', 'chatgpt', 'ask', 'wiki', 'wikipedia'],
  category: 'ai',
  description: 'Tanya AI ChatGPT gratis dan cari ensiklopedia Wikipedia',
  async run({ sock, jid, msg, command, args, prefix, reply }) {
    if (['ai', 'chatgpt', 'ask'].includes(command)) {
      if (!args) {
        return reply(`⚠️ Mau tanya apa ke AI?\nContoh: *${prefix}${command} Jelaskan apa itu kecerdasan buatan*`);
      }

      await reply('🤔 AI sedang berpikir...');

      try {
        const aiResponse = await askAI(args);
        await reply(`🤖 *Jawaban AI:*\n\n${aiResponse}`);
      } catch (err) {
        console.error('Error saat tanya AI:', err);
        await reply(`❌ ${err.message || 'Terjadi kesalahan pada server AI.'}`);
      }
      return;
    }

    if (['wiki', 'wikipedia'].includes(command)) {
      if (!args) {
        return reply(`⚠️ Masukkan kata kunci pencarian!\nContoh: *${prefix}${command} Albert Einstein*`);
      }

      try {
        const wiki = await searchWiki(args);
        const wikiText = `
📚 *${wiki.title}*
_${wiki.description}_

${wiki.extract}

🔗 *Baca selengkapnya:*
${wiki.url}
`.trim();
        await reply(wikiText);
      } catch (err) {
        await reply(`❌ ${err.message}`);
      }
      return;
    }
  }
};
