// Bring the live database's indexes in line with the schemas.
//
// Mongoose's autoIndex only *creates* missing indexes; it never drops ones a
// schema no longer declares. syncIndexes() does both — which means it will
// happily drop an index that exists in production but was never written into a
// schema, including TTL and unique indexes created by hand.
//
// So this defaults to a DRY RUN. Review the plan, make sure every index it wants
// to drop is genuinely stale, then re-run with --apply.
//
//   node scripts/syncIndexes.js            # show the plan, change nothing
//   node scripts/syncIndexes.js --apply    # actually do it, off-peak
//
// Index builds are online in MongoDB 4.2+, but they do consume IO — do not run
// the apply pass during a traffic spike.
import 'dotenv/config.js';
import mongoose from 'mongoose';
import { readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const APPLY = process.argv.includes('--apply');
const modelsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'models');

const loadAllModels = async (dir) => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) await loadAllModels(full);
    else if (entry.endsWith('.model.js')) await import(pathToFileURL(full).href);
  }
};

const describe = (idx) =>
  [
    idx.unique && 'UNIQUE',
    idx.sparse && 'sparse',
    idx.expireAfterSeconds !== undefined && `TTL=${idx.expireAfterSeconds}`,
  ]
    .filter(Boolean)
    .join(' ');

await loadAllModels(modelsDir);
await mongoose.connect(process.env.MONGO_URI);

console.log(APPLY ? '⚠️  APPLY MODE — indexes will be dropped and created.\n' : 'Dry run. Nothing will change.\n');

let willDrop = 0;
let risky = 0;

for (const name of mongoose.modelNames()) {
  const model = mongoose.model(name);
  let plan;
  try {
    plan = await model.diffIndexes();
  } catch (err) {
    console.error(`${name}: could not diff — ${err.message}`);
    continue;
  }

  const drops = plan.toDrop || [];
  const creates = plan.toCreate || [];
  if (drops.length === 0 && creates.length === 0) continue;

  console.log(name);

  if (drops.length) {
    // Look up what each doomed index actually is, so a unique constraint or a
    // TTL that only exists in the database can't disappear unnoticed.
    const live = await model.collection.indexes();
    for (const dropName of drops) {
      const idx = live.find((i) => i.name === dropName);
      const flags = idx ? describe(idx) : '';
      const dangerous = idx && (idx.unique || idx.expireAfterSeconds !== undefined);
      if (dangerous) risky++;
      willDrop++;
      console.log(`   ${dangerous ? '🚨' : '  '} DROP   ${dropName} ${flags}`);
    }
  }
  for (const spec of creates) {
    console.log(`      CREATE ${JSON.stringify(spec)}`);
  }

  if (APPLY) await model.syncIndexes();
}

if (risky > 0) {
  console.log(
    `\n🚨 ${risky} of the ${willDrop} indexes above are UNIQUE or TTL and exist only in the ` +
      `database, not in any schema.\n   Dropping them removes a real constraint or stops ` +
      `documents from expiring. Declare them in the schema first, then re-run.`
  );
} else if (willDrop > 0) {
  console.log(`\n${willDrop} stale index(es) to drop. None are UNIQUE or TTL.`);
}

await mongoose.disconnect();
console.log(APPLY ? '\nIndex sync complete.' : '\nDry run complete. Re-run with --apply to execute.');
