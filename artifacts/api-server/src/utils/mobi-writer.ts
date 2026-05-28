interface MobiChapter {
  title: string;
  content: string;
}

interface MobiBookInput {
  title: string;
  author: string;
  chapters: MobiChapter[];
}

function buildExthRecord(type: number, value: string): Buffer {
  const valueBuf = Buffer.from(value, "utf8");
  const rec = Buffer.alloc(8 + valueBuf.length);
  rec.writeUInt32BE(type, 0);
  rec.writeUInt32BE(8 + valueBuf.length, 4);
  valueBuf.copy(rec, 8);
  return rec;
}

function buildExthBlock(title: string, author: string): Buffer {
  const records = [
    buildExthRecord(100, author),
    buildExthRecord(503, title),
  ];
  const recordsBuffer = Buffer.concat(records);
  const headerSize = 12 + recordsBuffer.length;
  const padSize = (4 - (headerSize % 4)) % 4;
  const exth = Buffer.alloc(headerSize + padSize, 0);
  exth.write("EXTH", 0, "ascii");
  exth.writeUInt32BE(headerSize + padSize, 4);
  exth.writeUInt32BE(records.length, 8);
  recordsBuffer.copy(exth, 12);
  return exth;
}

export function generateMobi(input: MobiBookInput): Buffer {
  const { title, author, chapters } = input;

  const htmlParts: string[] = [
    `<html><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title></head><body>`,
    `<h1>${escapeHtml(title)}</h1>`,
    author ? `<p><em>by ${escapeHtml(author)}</em></p>` : "",
    "<hr/>",
  ];

  for (const ch of chapters) {
    htmlParts.push(`<h2>${escapeHtml(ch.title)}</h2>`);
    for (const para of ch.content.split("\n").filter((l) => l.trim())) {
      htmlParts.push(`<p>${escapeHtml(para)}</p>`);
    }
    htmlParts.push("<mbp:pagebreak/>");
  }

  htmlParts.push("</body></html>");
  const html = htmlParts.join("\n");

  const contentBuf = Buffer.from(html, "utf8");
  const chunkSize = 4096;
  const chunks: Buffer[] = [];
  for (let i = 0; i < contentBuf.length; i += chunkSize) {
    chunks.push(contentBuf.subarray(i, i + chunkSize));
  }
  if (chunks.length === 0) chunks.push(Buffer.from("<html><body></body></html>", "utf8"));

  const numTextRecords = chunks.length;
  const totalRecords = 1 + numTextRecords;

  const exthBlock = buildExthBlock(title, author || "Unknown Author");

  const titleBuf = Buffer.from(title, "utf8");

  const mobiHeaderLength = 232;
  const palmDocHeader = Buffer.alloc(16, 0);
  palmDocHeader.writeUInt16BE(1, 0);
  palmDocHeader.writeUInt32BE(contentBuf.length, 4);
  palmDocHeader.writeUInt16BE(numTextRecords, 8);
  palmDocHeader.writeUInt16BE(chunkSize, 10);

  const mobiHeaderBuf = Buffer.alloc(mobiHeaderLength, 0);
  mobiHeaderBuf.write("MOBI", 0, "ascii");
  mobiHeaderBuf.writeUInt32BE(mobiHeaderLength, 4);
  mobiHeaderBuf.writeUInt32BE(2, 8);
  mobiHeaderBuf.writeUInt32BE(65001, 12);
  mobiHeaderBuf.writeUInt32BE(Math.floor(Math.random() * 0xffffff), 16);
  mobiHeaderBuf.writeUInt32BE(6, 20);
  for (let off = 24; off <= 44; off += 4) mobiHeaderBuf.writeUInt32BE(0xffffffff, off);
  mobiHeaderBuf.writeUInt32BE(1 + numTextRecords, 48);

  const fullNameOffsetInRecord0 =
    palmDocHeader.length + mobiHeaderLength + exthBlock.length;
  mobiHeaderBuf.writeUInt32BE(fullNameOffsetInRecord0, 52);
  mobiHeaderBuf.writeUInt32BE(titleBuf.length, 56);

  mobiHeaderBuf.writeUInt32BE(0x0409, 60);
  mobiHeaderBuf.writeUInt32BE(6, 68);
  mobiHeaderBuf.writeUInt32BE(0xffffffff, 72);
  mobiHeaderBuf.writeUInt32BE(0x40, 92);
  mobiHeaderBuf.writeUInt32BE(0xffffffff, 128);
  mobiHeaderBuf.writeUInt16BE(1, 152);
  mobiHeaderBuf.writeUInt16BE(numTextRecords, 154);
  mobiHeaderBuf.writeUInt32BE(1, 156);
  mobiHeaderBuf.writeUInt32BE(0xffffffff, 160);
  mobiHeaderBuf.writeUInt32BE(0xffffffff, 164);

  const record0Raw = Buffer.concat([palmDocHeader, mobiHeaderBuf, exthBlock, titleBuf]);
  const padLen = (4 - (record0Raw.length % 4)) % 4;
  const record0 = padLen > 0 ? Buffer.concat([record0Raw, Buffer.alloc(padLen, 0)]) : record0Raw;

  const pdbHeader = Buffer.alloc(78, 0);
  const nameBuf = Buffer.alloc(32, 0);
  Buffer.from(title.slice(0, 31), "latin1").copy(nameBuf);
  nameBuf.copy(pdbHeader, 0);
  const macNow = Math.floor(Date.now() / 1000) + 2082844800;
  pdbHeader.writeUInt32BE(macNow, 36);
  pdbHeader.writeUInt32BE(macNow, 40);
  pdbHeader.write("BOOK", 60, "ascii");
  pdbHeader.write("MOBI", 64, "ascii");
  pdbHeader.writeUInt32BE(0xdeadbeef, 68);
  pdbHeader.writeUInt16BE(totalRecords, 76);

  const recordListSize = totalRecords * 8;
  const recordList = Buffer.alloc(recordListSize, 0);
  const gap = Buffer.alloc(2, 0);
  const dataStart = 78 + recordListSize + gap.length;

  let offset = dataStart;
  recordList.writeUInt32BE(offset, 0);
  recordList.writeUInt8(0, 4);
  recordList.writeUInt8(0, 5);
  recordList.writeUInt8(0, 6);
  recordList.writeUInt8(0, 7);
  offset += record0.length;

  for (let i = 0; i < numTextRecords; i++) {
    const base = (i + 1) * 8;
    recordList.writeUInt32BE(offset, base);
    recordList.writeUInt8(0, base + 4);
    const uid = i + 1;
    recordList.writeUInt8((uid >> 16) & 0xff, base + 5);
    recordList.writeUInt8((uid >> 8) & 0xff, base + 6);
    recordList.writeUInt8(uid & 0xff, base + 7);
    offset += chunks[i].length;
  }

  return Buffer.concat([pdbHeader, recordList, gap, record0, ...chunks]);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
