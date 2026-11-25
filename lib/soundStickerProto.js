// lib/soundStickerProto.js - Ekstensi Runtime WAProto untuk Sound Stickers (StickerMessage.audioMessage = 26 & audioStickerMessage = 134)
import { proto } from '@whiskeysockets/baileys';
import protobuf from 'protobufjs/minimal.js';

const { Reader, Writer } = protobuf;

function readUnknownField(scanner, wireType) {
  switch (wireType) {
    case 0: return scanner.int64().toString();
    case 1: return scanner.fixed64().toString();
    case 2: {
      const len = scanner.uint32();
      const bytes = scanner.buf.subarray(scanner.pos, scanner.pos + len);
      scanner.pos += len;
      return `<bytes ${bytes.length}B hex=${Buffer.from(bytes.subarray(0, 16)).toString('hex')}>`;
    }
    case 5: return scanner.fixed32();
    default: {
      scanner.skipType(wireType);
      return `<wireType ${wireType}>`;
    }
  }
}

export function patchSoundStickerProto() {
  const StickerMessage = proto.Message?.StickerMessage;
  const AudioMessage = proto.Message?.AudioMessage;
  const Message = proto.Message;
  const FutureProofMessage = proto.Message?.FutureProofMessage;

  if (!StickerMessage || !AudioMessage || !Message) return false;
  if (StickerMessage.__soundStickerPatched) return true;

  // 1. Tambah properti ke prototype StickerMessage
  StickerMessage.prototype.premium = null;
  StickerMessage.prototype.emojis = null;
  StickerMessage.prototype.audioMessage = null;

  const origStickerEncode = StickerMessage.encode;
  StickerMessage.encode = function encode(m, w) {
    w = origStickerEncode.call(this, m, w);
    if (m.premium != null && Object.hasOwnProperty.call(m, 'premium')) {
      w.uint32(192).int32(m.premium); // field 24 << 3 | 0
    }
    if (m.emojis != null && Object.hasOwnProperty.call(m, 'emojis')) {
      w.uint32(202).string(m.emojis); // field 25 << 3 | 2
    }
    if (m.audioMessage != null && Object.hasOwnProperty.call(m, 'audioMessage')) {
      AudioMessage.encode(m.audioMessage, w.uint32(210).fork()).ldelim(); // field 26 << 3 | 2
    }
    return w;
  };

  const origStickerDecode = StickerMessage.decode;
  StickerMessage.decode = function decode(r, l, e) {
    if (!(r instanceof Reader)) r = Reader.create(r);
    const startPos = r.pos;
    const m = origStickerDecode.call(this, r, l, e);
    const endPos = r.pos;

    try {
      const scanner = Reader.create(r.buf.subarray(startPos, endPos));
      while (scanner.pos < scanner.len) {
        const t = scanner.uint32();
        if (t === e) break;
        const fieldNo = t >>> 3;
        const wireType = t & 7;
        if (fieldNo === 24 && wireType === 0) {
          m.premium = scanner.int32();
        } else if (fieldNo === 25 && wireType === 2) {
          m.emojis = scanner.string();
        } else if (fieldNo === 26 && wireType === 2) {
          m.audioMessage = AudioMessage.decode(scanner, scanner.uint32());
        } else if (fieldNo > 23) {
          m._unknownFields = m._unknownFields || {};
          m._unknownFields[fieldNo] = readUnknownField(scanner, wireType);
        } else {
          scanner.skipType(wireType);
        }
      }
    } catch {}
    return m;
  };

  const origStickerFromObject = StickerMessage.fromObject;
  StickerMessage.fromObject = function fromObject(d) {
    const m = origStickerFromObject.call(this, d);
    if (d && d.premium != null) m.premium = d.premium | 0;
    if (d && d.emojis != null) m.emojis = String(d.emojis);
    if (d && d.audioMessage != null) m.audioMessage = AudioMessage.fromObject(d.audioMessage);
    return m;
  };

  const origStickerToObject = StickerMessage.toObject;
  StickerMessage.toObject = function toObject(m, o) {
    const d = origStickerToObject.call(this, m, o);
    if (m && m.premium != null && Object.hasOwnProperty.call(m, 'premium')) d.premium = m.premium;
    if (m && m.emojis != null && Object.hasOwnProperty.call(m, 'emojis')) d.emojis = m.emojis;
    if (m && m.audioMessage != null && Object.hasOwnProperty.call(m, 'audioMessage')) {
      d.audioMessage = AudioMessage.toObject(m.audioMessage, o);
    }
    if (m && m._unknownFields) d._unknownFields = m._unknownFields;
    return d;
  };

  StickerMessage.__soundStickerPatched = true;

  // 2. Patch Message untuk audioStickerMessage (field 134) & scan unknown fields
  if (FutureProofMessage && !Message.__soundStickerPatched) {
    Message.prototype.audioStickerMessage = null;

    const origMsgEncode = Message.encode;
    Message.encode = function encode(m, w) {
      w = origMsgEncode.call(this, m, w);
      if (m.audioStickerMessage != null && Object.hasOwnProperty.call(m, 'audioStickerMessage')) {
        FutureProofMessage.encode(m.audioStickerMessage, w.uint32(1074).fork()).ldelim(); // 134 << 3 | 2
      }
      return w;
    };

    const origMsgDecode = Message.decode;
    Message.decode = function decode(r, l, e) {
      if (!(r instanceof Reader)) r = Reader.create(r);
      const startPos = r.pos;
      const m = origMsgDecode.call(this, r, l, e);
      const endPos = r.pos;

      try {
        const scanner = Reader.create(r.buf.subarray(startPos, endPos));
        while (scanner.pos < scanner.len) {
          const t = scanner.uint32();
          if (t === e) break;
          const fieldNo = t >>> 3;
          const wireType = t & 7;
          if (fieldNo === 134 && wireType === 2) {
            m.audioStickerMessage = FutureProofMessage.decode(scanner, scanner.uint32());
          } else if (fieldNo >= 100) {
            m._unknownMsgFields = m._unknownMsgFields || {};
            m._unknownMsgFields[fieldNo] = readUnknownField(scanner, wireType);
          } else {
            scanner.skipType(wireType);
          }
        }
      } catch {}
      return m;
    };

    const origMsgFromObject = Message.fromObject;
    Message.fromObject = function fromObject(d) {
      const m = origMsgFromObject.call(this, d);
      if (d && d.audioStickerMessage != null) {
        m.audioStickerMessage = FutureProofMessage.fromObject(d.audioStickerMessage);
      }
      return m;
    };

    const origMsgToObject = Message.toObject;
    Message.toObject = function toObject(m, o) {
      const d = origMsgToObject.call(this, m, o);
      if (m && m.audioStickerMessage != null && Object.hasOwnProperty.call(m, 'audioStickerMessage')) {
        d.audioStickerMessage = FutureProofMessage.toObject(m.audioStickerMessage, o);
      }
      if (m && m._unknownMsgFields) d._unknownMsgFields = m._unknownMsgFields;
      return d;
    };

    Message.__soundStickerPatched = true;
  }

  return true;
}
