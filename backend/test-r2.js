import { S3Client, ListObjectsV2Command, PutObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
dotenv.config({ quiet: true});

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});

async function test() {
  try {
    console.log("Checking R2 environment...");
    console.log("Account ID:", process.env.R2_ACCOUNT_ID);
    console.log("Bucket Name:", process.env.R2_BUCKET_NAME);
    
    console.log("\nAttempting to upload a test file...");
    await r2.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: "test-write.txt",
      Body: "Success!",
      ContentType: "text/plain"
    }));
    console.log("✅ Success! File uploaded successfully.");

    console.log("\nAttempting to list objects...");
    const data = await r2.send(new ListObjectsV2Command({
      Bucket: process.env.R2_BUCKET_NAME,
      MaxKeys: 1
    }));
    console.log("✅ Current objects in bucket:", data.Contents?.map(o => o.Key).join(", ") || "(empty)");
  } catch (err) {
    console.error("❌ Test Failed!");
    console.error("Code:", err.name);
    console.error("Message:", err.message);
  }
}

test();
