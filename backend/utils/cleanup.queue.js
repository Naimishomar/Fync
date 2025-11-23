import { Queue } from "bullmq";
import IORedis from "ioredis";

const connection = new IORedis(process.env.REDIS_URL || "redis://127.0.0.1:6379");

export const cleanupQueue = new Queue("cleanup", {
  connection,
});

export const scheduleCleanupJobs = async () => {
  await cleanupQueue.add(
    "deleteOldTasks",
    {},
    {
      repeat: { cron: "* * * * *" },
      removeOnComplete: true,
      removeOnFail: true,
    }
  );
};
