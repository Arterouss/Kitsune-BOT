// lib/mongoAuth.js - Penyimpanan Sesi WhatsApp Permanen di MongoDB Atlas (Anti-Logout Saat Restart Cloud)
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { initAuthCreds, BufferJSON, proto, useMultiFileAuthState } from '@whiskeysockets/baileys';
import { initMongo, getMongoDb } from './rpg.js';

const COLLECTION_NAME = 'wa_auth_state';
const META_DOC_ID = '_meta_session_status';

function fixFileName(file) {
  return file?.replace(/\//g, '__')?.replace(/:/g, '-');
}

function hashString(str) {
  return crypto.createHash('sha256').update(str || '').digest('hex');
}

function isPairedCreds(creds) {
  return Boolean(creds && (creds.registered || creds.account));
}

/**
 * Menghapus sesi WhatsApp yang kedaluwarsa dari lokal maupun MongoDB Atlas
 */
export async function clearAuthSession(localFolder = './session') {
  try {
    fs.rmSync(path.resolve(localFolder), { recursive: true, force: true });
  } catch {}

  try {
    await initMongo();
    const db = getMongoDb();
    if (db) {
      const col = db.collection(COLLECTION_NAME);
      await col.deleteMany({ _id: { $ne: META_DOC_ID } });
      if (process.env.SESSION_DATA) {
        await col.updateOne(
          { _id: META_DOC_ID },
          {
            $set: {
              invalidatedSessionDataHash: hashString(process.env.SESSION_DATA),
              updatedAt: new Date()
            }
          },
          { upsert: true }
        );
      }
      console.log('🧹 [MONGO AUTH] Sesi kedaluwarsa dibersihkan dari MongoDB Atlas.');
    }
  } catch (err) {
    console.error('⚠️ [MONGO AUTH] Gagal membersihkan sesi MongoDB:', err.message);
  }
}

/**
 * Auth State Hybrid: Menyimpan seluruh kredensial & Signal keys ke MongoDB Atlas agar permanen
 * di hosting cloud (Render/Koyeb), dengan fallback otomatis ke file lokal jika tanpa MongoDB.
 */
export async function useHybridAuthState(localFolder = './session') {
  const folderPath = path.resolve(localFolder);
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }

  let db = null;
  try {
    await initMongo();
    db = getMongoDb();
  } catch {}

  // Jika MongoDB tidak dikonfigurasi, pakai MultiFileAuthState standar
  if (!db) {
    const credsPath = path.join(folderPath, 'creds.json');
    if (fs.existsSync(credsPath)) {
      try {
        const existing = JSON.parse(fs.readFileSync(credsPath, 'utf-8'), BufferJSON.reviver);
        if (!isPairedCreds(existing)) {
          fs.unlinkSync(credsPath);
        }
      } catch {
        try { fs.unlinkSync(credsPath); } catch {}
      }
    }

    if (process.env.SESSION_DATA && !fs.existsSync(credsPath)) {
      try {
        const decoded = Buffer.from(process.env.SESSION_DATA, 'base64').toString('utf-8');
        const parsed = JSON.parse(decoded, BufferJSON.reviver);
        if (isPairedCreds(parsed)) {
          fs.writeFileSync(credsPath, decoded);
          console.log('🔑 [SESSION RESTORED] Berhasil memulihkan creds.json dari SESSION_DATA.');
        }
      } catch (e) {
        console.error('Gagal memulihkan SESSION_DATA:', e.message);
      }
    }
    const multiFile = await useMultiFileAuthState(folderPath);
    return {
      ...multiFile,
      saveCreds: async () => {
        if (!isPairedCreds(multiFile.state.creds)) return;
        return multiFile.saveCreds();
      },
      flushSaves: async () => {},
      isMongoAuth: false
    };
  }

  const col = db.collection(COLLECTION_NAME);
  const docs = await col.find({}).toArray();
  const cache = new Map();
  let metaDoc = null;
  let pendingWrites = Promise.resolve();

  for (const doc of docs) {
    if (doc._id === META_DOC_ID) {
      metaDoc = doc;
    } else if (typeof doc.data === 'string') {
      cache.set(doc._id, doc.data);
    }
  }

  const queueWrite = (fn) => {
    pendingWrites = pendingWrites.then(fn).catch((err) => {
      console.error('⚠️ [MONGO AUTH] Error menulis sesi:', err.message);
    });
    return pendingWrites;
  };

  const writeData = async (data, file) => {
    const id = fixFileName(file);
    const jsonStr = JSON.stringify(data, BufferJSON.replacer);
    cache.set(id, jsonStr);

    return queueWrite(async () => {
      if (id === 'creds.json') {
        try {
          await fs.promises.writeFile(path.join(folderPath, 'creds.json'), jsonStr);
        } catch {}
      }
      await col.updateOne(
        { _id: id },
        { $set: { data: jsonStr, updatedAt: new Date() } },
        { upsert: true }
      );
    });
  };

  const readData = (file) => {
    const id = fixFileName(file);
    const jsonStr = cache.get(id);
    if (!jsonStr) return null;
    try {
      return JSON.parse(jsonStr, BufferJSON.reviver);
    } catch {
      return null;
    }
  };

  let creds = readData('creds.json');

  // Buang creds setengah jadi (creds.me terisi tapi belum pair-success) agar tidak memicu 401
  if (creds && !isPairedCreds(creds)) {
    creds = null;
    cache.delete('creds.json');
    try { await col.deleteOne({ _id: 'creds.json' }); } catch {}
    try { fs.unlinkSync(path.join(folderPath, 'creds.json')); } catch {}
  }

  // Jika belum ada creds di MongoDB, cek SESSION_DATA env atau file lokal
  if (!creds) {
    const envSession = process.env.SESSION_DATA;
    const isEnvInvalidated = metaDoc?.invalidatedSessionDataHash === hashString(envSession);

    if (envSession && !isEnvInvalidated) {
      try {
        const decoded = Buffer.from(envSession, 'base64').toString('utf-8');
        const parsed = JSON.parse(decoded, BufferJSON.reviver);
        if (isPairedCreds(parsed)) {
          creds = parsed;
          await writeData(creds, 'creds.json');
          console.log('🔑 [MONGO AUTH] Berhasil mengimpor sesi awal dari SESSION_DATA ke MongoDB Atlas!');
        }
      } catch (e) {
        console.error('Gagal membaca SESSION_DATA:', e.message);
      }
    }

    if (!creds) {
      const localCredsPath = path.join(folderPath, 'creds.json');
      if (fs.existsSync(localCredsPath)) {
        try {
          const raw = fs.readFileSync(localCredsPath, 'utf-8');
          const parsed = JSON.parse(raw, BufferJSON.reviver);
          if (isPairedCreds(parsed)) {
            creds = parsed;
            await writeData(creds, 'creds.json');
            console.log('🔑 [MONGO AUTH] Berhasil mengimpor creds.json lokal ke MongoDB Atlas!');
          }
        } catch {}
      }
    }

    if (!creds) {
      creds = initAuthCreds();
    }
  } else {
    console.log('🔑 [MONGO AUTH] Sesi WhatsApp permanen dimuat otomatis dari MongoDB Atlas!');
  }

  return {
    isMongoAuth: true,
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = {};
          for (const id of ids) {
            let value = readData(`${type}-${id}.json`);
            if (type === 'app-state-sync-key' && value) {
              value = proto.Message.AppStateSyncKeyData.fromObject(value);
            }
            data[id] = value;
          }
          return data;
        },
        set: async (data) => {
          const ops = [];
          for (const category in data) {
            for (const id in data[category]) {
              const value = data[category][id];
              const docId = fixFileName(`${category}-${id}.json`);
              if (value) {
                const jsonStr = JSON.stringify(value, BufferJSON.replacer);
                cache.set(docId, jsonStr);
                ops.push({
                  updateOne: {
                    filter: { _id: docId },
                    update: { $set: { data: jsonStr, updatedAt: new Date() } },
                    upsert: true
                  }
                });
              } else {
                cache.delete(docId);
                ops.push({
                  deleteOne: { filter: { _id: docId } }
                });
              }
            }
          }
          if (ops.length > 0) {
            await queueWrite(() => col.bulkWrite(ops, { ordered: false }));
          }
        }
      }
    },
    saveCreds: async () => {
      if (!isPairedCreds(creds)) return;
      return writeData(creds, 'creds.json');
    },
    flushSaves: async () => {
      await pendingWrites;
    }
  };
}
