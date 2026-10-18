// Read-only storage report: per-collection docs, data/storage/index size,
// compressor and TTL indexes. Run on the server: node scripts/dbStorageReport.js
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config({ quiet: true });

const mb = (b) => (b / 1048576).toFixed(2);
await mongoose.connect(process.env.MONGO_URI);
const db = mongoose.connection.db;
const info = await db.admin().command({ buildInfo: 1 }).catch(() => ({}));
const host = (process.env.MONGO_URI || "").replace(/\/\/[^@]*@/, "//***@").split("/")[2];
console.log(`MongoDB ${info.version || "?"} host=${host}`);
const rows = [];
for (const { name } of await db.listCollections({}, { nameOnly: true }).toArray()) {
  const s = await db.command({ collStats: name }).catch(() => null);
  if (!s) continue;
  const idx = await db.collection(name).indexes().catch(() => []);
  const ttl = idx.filter((i) => i.expireAfterSeconds != null).map((i) => `${Object.keys(i.key)[0]}:${i.expireAfterSeconds}s`);
  const comp = /block_compressor=(\w+)/.exec(s.wiredTiger?.creationString || "")?.[1] || "?";
  rows.push({ name, docs: s.count, dataMB: +mb(s.size), storageMB: +mb(s.storageSize), indexMB: +mb(s.totalIndexSize), avgDocB: Math.round(s.avgObjSize || 0), comp, ttl: ttl.join(",") });
}
rows.sort((a, b) => b.storageMB + b.indexMB - (a.storageMB + a.indexMB));
console.table(rows);
const t = rows.reduce((a, r) => ({ data: a.data + r.dataMB, storage: a.storage + r.storageMB, index: a.index + r.indexMB }), { data: 0, storage: 0, index: 0 });
console.log(`TOTAL data=${t.data.toFixed(1)}MB storage=${t.storage.toFixed(1)}MB indexes=${t.index.toFixed(1)}MB`);
await mongoose.disconnect();
