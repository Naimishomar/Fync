import mongoose from 'mongoose';
import Contest from './models/coding/contest.model.js';
import dotenv from 'dotenv';
dotenv.config({quiet: true});

async function checkContests() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const contests = await Contest.find({});
    console.log('--- All Recorded Contests ---');
    console.log(JSON.stringify(contests, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkContests();
