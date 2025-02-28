import { readFileSync, writeFileSync, statSync, mkdirSync, rmSync } from "fs";
import sodium from "libsodium-wrappers";
import { Octokit } from "@octokit/rest";
import { createHash } from "crypto";
import { config } from "dotenv";

config();

// Add GitHub configuration
const { GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, VITE_EXCEL_FILE } =
  process.env;

const octokit = new Octokit({
  auth: GITHUB_TOKEN,
});

// Configuration
const NUM_CHUNKS = 6;
const FILE_PATH = `./data/${VITE_EXCEL_FILE}`;
const TEMP_DIR = "./.temp";

async function splitAndEncodeFile() {
  try {
    // Get original file size for validation
    const originalSize = statSync(FILE_PATH).size;
    if (originalSize === 0) {
      throw new Error("❌ Error: Excel file is empty");
    }
    const fileBuffer = readFileSync(FILE_PATH);
    const chunkSize = Math.ceil(fileBuffer.length / NUM_CHUNKS);
    const base64Chunks = [];

    // Add debug info for original file
    const originalHash = createHash("sha256").update(fileBuffer).digest("hex");
    console.log(`🔒 Original file hash: ${originalHash}`);
    console.log(`📊 Original file size: ${originalSize} bytes`);

    // Split into exactly 6 chunks
    const chunks = [];
    let totalSize = 0;
    for (let i = 0; i < NUM_CHUNKS; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, fileBuffer.length);
      const chunk = fileBuffer.subarray(start, end);
      const chunkPath = `${TEMP_DIR}/chunk_${i}`; // Define chunkPath here

      // Write and validate chunk
      writeFileSync(chunkPath, chunk);
      const writtenSize = statSync(chunkPath).size;

      chunks.push(chunk);
      totalSize += chunk.length;

      // Add chunk-specific debug info
      console.log(`📦 Chunk ${i + 1}:`);
      console.log(`   Size: ${chunk.length} bytes`);
      console.log(`   Written size: ${writtenSize} bytes`);

      // Base64 encode with validation
      const secretName = `EXCEL_FILE_CHUNK_${i + 1}`;
      const secretValue = Buffer.from(chunk).toString("base64");
      base64Chunks.push(secretValue); // Store the base64 string

      // Validate base64 content
      const decodedSize = Buffer.from(secretValue, "base64").length;
      if (decodedSize !== chunk.length) {
        throw new Error(
          `Base64 validation failed for chunk ${i + 1}! ` +
            `Original: ${chunk.length}, Decoded: ${decodedSize}`
        );
      }

      console.log(`   Base64 length: ${secretValue.length}`);
      console.log(`   Decoded size matches: ✅`);

      await updateGithubSecret(secretName, secretValue);
    }

    // Verify total content using stored base64 strings
    const decodedChunks = base64Chunks.map((str) => Buffer.from(str, "base64"));
    const combinedBuffer = Buffer.concat(decodedChunks);
    const finalHash = createHash("sha256").update(combinedBuffer).digest("hex");

    console.log("\n🔍 Final validation:");
    console.log(`   Original size: ${originalSize} bytes`);
    console.log(`   Final size: ${combinedBuffer.length} bytes`);
    console.log(`   Original hash: ${originalHash}`);
    console.log(`   Final hash: ${finalHash}`);
    console.log(`   Hashes match: ${originalHash === finalHash ? "✅" : "❌"}`);

    // Validate total size
    if (totalSize !== originalSize) {
      throw new Error(
        `Size mismatch after splitting! Original: ${originalSize}, Chunks total: ${totalSize}`
      );
    }

    // Clean up temp directory when done
    //rmSync(TEMP_DIR, { recursive: true, force: true });

    console.log("✅ Successfully split Excel file into 6 chunks");
    console.log("🔍 Validations passed:");
    console.log(`   - Original size: ${originalSize} bytes`);
    console.log(`   - Total chunks size: ${totalSize} bytes`);
    console.log(`   - All chunks properly base64 encoded`);
    console.log("🔑 Secrets updated on GitHub");
  } catch (error) {
    // Clean up temp directory on error
    try {
      rmSync(TEMP_DIR, { recursive: true, force: true });
    } catch (cleanupError) {
      console.error("❌ Failed to clean up temp directory:", cleanupError);
    }

    console.error("❌ Error:", error);
    process.exit(1);
  }
}

async function updateGithubSecret(secretName, secretValue) {
  try {
    // Get the public key for secret encryption
    const { data: publicKey } = await octokit.actions.getRepoPublicKey({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
    });

    // Convert secret to bytes
    const secretBytes = Buffer.from(secretValue);
    const keyBytes = Buffer.from(publicKey.key, "base64");

    // Encrypt the secret using libsodium
    const encryptedBytes = sodium.crypto_box_seal(secretBytes, keyBytes);
    const encrypted = Buffer.from(encryptedBytes).toString("base64");

    // Update the secret
    await octokit.actions.createOrUpdateRepoSecret({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      secret_name: secretName,
      encrypted_value: encrypted,
      key_id: publicKey.key_id,
    });

    console.log(`✅ Updated secret: ${secretName}`);
  } catch (error) {
    console.error(`❌ Failed to update secret ${secretName}:`, error);
    throw error;
  }
}

const requiredEnvVars = [
  "GITHUB_TOKEN",
  "GITHUB_OWNER",
  "GITHUB_REPO",
  "VITE_EXCEL_FILE",
];
const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

if (missingVars.length > 0) {
  console.error(
    "❌ Missing required environment variables:",
    missingVars.join(", ")
  );
  process.exit(1);
}

// Create temp directory
mkdirSync(TEMP_DIR, { recursive: true });

splitAndEncodeFile();
