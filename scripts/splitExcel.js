import { readFileSync, writeFileSync, statSync, mkdirSync, rmSync } from "fs";
import { config } from "dotenv";
import { Octokit } from "@octokit/rest";
import sodium from "libsodium-wrappers";

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
    console.log(`📊 Original file size: ${originalSize} bytes`);

    const fileBuffer = readFileSync(FILE_PATH);
    const chunkSize = Math.ceil(fileBuffer.length / NUM_CHUNKS);

    // Split into exactly 6 chunks
    const chunks = [];
    let totalSize = 0;
    for (let i = 0; i < NUM_CHUNKS; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, fileBuffer.length);
      const chunk = new Uint8Array(fileBuffer).subarray(start, end);
      chunks.push(chunk);
      totalSize += chunk.length;
    }

    // Validate total size
    if (totalSize !== originalSize) {
      throw new Error(
        `Size mismatch after splitting! Original: ${originalSize}, Chunks total: ${totalSize}`
      );
    }

    // Create temp directory
    mkdirSync(TEMP_DIR, { recursive: true });

    // Process each chunk using Node.js Buffer for base64 encoding
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkPath = `${TEMP_DIR}/chunk_${i}`;

      // Write the binary chunk for validation and future use
      writeFileSync(chunkPath, chunk);

      // Validate chunk was written correctly
      const writtenSize = statSync(chunkPath).size;
      if (writtenSize !== chunk.length) {
        throw new Error(
          `Chunk ${i} size mismatch! Expected: ${chunk.length}, Got: ${writtenSize}`
        );
      }

      // Use Node.js Buffer for base64 encoding - consistent across platforms
      const secretName = `EXCEL_FILE_CHUNK_${i + 1}`;
      const secretValue = Buffer.from(chunk).toString("base64");

      // Validate base64 string
      if (secretValue.length % 4 !== 0) {
        throw new Error(`Invalid base64 padding in chunk ${i + 1}`);
      }

      await updateGithubSecret(secretName, secretValue);
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

splitAndEncodeFile();
