import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const CRX3_MAGIC = Buffer.from('Cr24', 'ascii');
const CRX3_VERSION = 3;
const CRX3_SIGNED_DATA_PREFIX = Buffer.from('CRX3 SignedData\0', 'ascii');

function encodeVarint(num) {
  let n = num >>> 0;
  const bytes = [];
  while (n >= 0x80) {
    bytes.push((n & 0x7f) | 0x80);
    n >>>= 7;
  }
  bytes.push(n);
  return Buffer.from(bytes);
}

function encodeBytesField(fieldNumber, data) {
  const key = encodeVarint((fieldNumber << 3) | 2);
  const len = encodeVarint(data.length);
  return Buffer.concat([key, len, data]);
}

function decodeVarint(buf, offset) {
  let value = 0;
  let shift = 0;
  let pos = offset;
  while (pos < buf.length) {
    const b = buf[pos++];
    value += (b & 0x7f) * (2 ** shift);
    if ((b & 0x80) === 0) {
      return { value, nextOffset: pos };
    }
    shift += 7;
  }
  throw new Error('Protobuf varint truncado no cabeçalho CRX3.');
}

function decodeProtoFields(buf) {
  const fields = [];
  let pos = 0;
  while (pos < buf.length) {
    const tag = decodeVarint(buf, pos);
    pos = tag.nextOffset;
    const fieldNumber = Math.floor(tag.value / 8);
    const wireType = tag.value & 0x07;
    if (wireType !== 2) {
      throw new Error(`WireType protobuf inesperado no CRX3: ${wireType}`);
    }
    const len = decodeVarint(buf, pos);
    pos = len.nextOffset;
    const end = pos + len.value;
    if (end > buf.length) {
      throw new Error('Campo protobuf excede tamanho do cabeçalho CRX3.');
    }
    fields.push({ fieldNumber, data: buf.subarray(pos, end) });
    pos = end;
  }
  return fields;
}

export function deriveCrxIdAndExtensionId(publicKeyDer) {
  const hash = crypto.createHash('sha256').update(publicKeyDer).digest();
  const crxId = hash.subarray(0, 16);
  let extensionId = '';
  for (const byte of crxId) {
    extensionId += String.fromCharCode(97 + ((byte >> 4) & 0x0f));
    extensionId += String.fromCharCode(97 + (byte & 0x0f));
  }
  return { crxId, extensionId };
}

export function loadOrCreateCrxPrivateKey({ keyPath, pemEnv = process.env.CRX_PRIVATE_KEY_PEM } = {}) {
  if (pemEnv && pemEnv.trim()) {
    const normalized = pemEnv.replace(/\\n/g, '\n').trim();
    return {
      privateKey: crypto.createPrivateKey(normalized),
      source: 'env:CRX_PRIVATE_KEY_PEM',
      created: false,
    };
  }

  if (!keyPath) {
    throw new Error('keyPath é obrigatório quando CRX_PRIVATE_KEY_PEM não está definido.');
  }

  if (fs.existsSync(keyPath)) {
    const pem = fs.readFileSync(keyPath, 'utf8');
    return {
      privateKey: crypto.createPrivateKey(pem),
      source: keyPath,
      created: false,
    };
  }

  const { privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });

  fs.mkdirSync(path.dirname(keyPath), { recursive: true });
  fs.writeFileSync(keyPath, privateKey, { encoding: 'utf8', mode: 0o600 });

  return {
    privateKey: crypto.createPrivateKey(privateKey),
    source: keyPath,
    created: true,
  };
}

export function buildCrx3Buffer(zipBuffer, privateKeyInput) {
  const privateKey =
    typeof privateKeyInput === 'string' || Buffer.isBuffer(privateKeyInput)
      ? crypto.createPrivateKey(privateKeyInput)
      : privateKeyInput;

  const publicKeyObj = crypto.createPublicKey(privateKey);
  const publicKeyDer = publicKeyObj.export({ type: 'spki', format: 'der' });
  const { crxId, extensionId } = deriveCrxIdAndExtensionId(publicKeyDer);

  // SignedData { crx_id = 1 }
  const signedHeaderData = encodeBytesField(1, crxId);

  // Payload assinado segundo especificação CRX3 do Chromium
  const signedDataLen = Buffer.alloc(4);
  signedDataLen.writeUInt32LE(signedHeaderData.length, 0);

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(CRX3_SIGNED_DATA_PREFIX);
  signer.update(signedDataLen);
  signer.update(signedHeaderData);
  signer.update(zipBuffer);
  const signature = signer.sign(privateKey);

  // AsymmetricKeyProof { public_key = 1, signature = 2 }
  const proof = Buffer.concat([
    encodeBytesField(1, publicKeyDer),
    encodeBytesField(2, signature),
  ]);

  // CrxFileHeader { sha256_with_rsa = 2, signed_header_data = 10000 }
  const header = Buffer.concat([
    encodeBytesField(2, proof),
    encodeBytesField(10000, signedHeaderData),
  ]);

  const versionBuf = Buffer.alloc(4);
  versionBuf.writeUInt32LE(CRX3_VERSION, 0);
  const headerSizeBuf = Buffer.alloc(4);
  headerSizeBuf.writeUInt32LE(header.length, 0);

  return {
    crxBuffer: Buffer.concat([CRX3_MAGIC, versionBuf, headerSizeBuf, header, zipBuffer]),
    extensionId,
    headerSize: header.length,
  };
}

export function verifyCrx3Buffer(crxBuffer) {
  if (!Buffer.isBuffer(crxBuffer) || crxBuffer.length < 16) {
    return { valid: false, reason: 'Buffer CRX3 inválido ou pequeno demais.' };
  }
  if (!crxBuffer.subarray(0, 4).equals(CRX3_MAGIC)) {
    return { valid: false, reason: 'Assinatura mágica Cr24 ausente.' };
  }
  const version = crxBuffer.readUInt32LE(4);
  if (version !== CRX3_VERSION) {
    return { valid: false, reason: `Versão CRX inesperada: ${version}` };
  }

  const headerSize = crxBuffer.readUInt32LE(8);
  const headerEnd = 12 + headerSize;
  if (headerEnd >= crxBuffer.length) {
    return { valid: false, reason: 'Tamanho de cabeçalho CRX3 inválido.' };
  }

  const headerBuf = crxBuffer.subarray(12, headerEnd);
  const zipBuffer = crxBuffer.subarray(headerEnd);

  const headerFields = decodeProtoFields(headerBuf);
  const proofField = headerFields.find((f) => f.fieldNumber === 2);
  const signedDataField = headerFields.find((f) => f.fieldNumber === 10000);
  if (!proofField || !signedDataField) {
    return { valid: false, reason: 'Campos sha256_with_rsa ou signed_header_data ausentes.' };
  }

  const proofSub = decodeProtoFields(proofField.data);
  const pubKeyDer = proofSub.find((f) => f.fieldNumber === 1)?.data;
  const signature = proofSub.find((f) => f.fieldNumber === 2)?.data;
  if (!pubKeyDer || !signature) {
    return { valid: false, reason: 'Chave pública ou assinatura ausente em AsymmetricKeyProof.' };
  }

  const signedDataSub = decodeProtoFields(signedDataField.data);
  const crxId = signedDataSub.find((f) => f.fieldNumber === 1)?.data;
  if (!crxId || crxId.length !== 16) {
    return { valid: false, reason: 'crx_id ausente ou inválido.' };
  }

  const derived = deriveCrxIdAndExtensionId(pubKeyDer);
  if (!derived.crxId.equals(crxId)) {
    return { valid: false, reason: 'crx_id não corresponde à chave pública.' };
  }

  const signedDataLen = Buffer.alloc(4);
  signedDataLen.writeUInt32LE(signedDataField.data.length, 0);

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(CRX3_SIGNED_DATA_PREFIX);
  verifier.update(signedDataLen);
  verifier.update(signedDataField.data);
  verifier.update(zipBuffer);

  const publicKeyObj = crypto.createPublicKey({ key: pubKeyDer, format: 'der', type: 'spki' });
  const sigOk = verifier.verify(publicKeyObj, signature);
  if (!sigOk) {
    return { valid: false, reason: 'Assinatura RSA-SHA256 do CRX3 inválida.' };
  }

  return {
    valid: true,
    version,
    headerSize,
    extensionId: derived.extensionId,
    zipBuffer,
  };
}
