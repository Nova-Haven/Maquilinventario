import {
  readFileSync,
  writeFileSync,
  statSync,
  mkdirSync,
  rmSync,
  existsSync,
} from "fs";
import sodium from "libsodium-wrappers";
import { Octokit } from "@octokit/rest";
import { createHash } from "crypto";
import { config } from "dotenv";

config();

// Add GitHub configuration
const {
  GITHUB_TOKEN,
  GITHUB_OWNER,
  GITHUB_REPO,
  VITE_INVENTORY_FILE,
  VITE_CATALOG_FILE,
} = process.env;

const octokit = new Octokit({
  auth: GITHUB_TOKEN,
});

// Configuration
export const NUM_CHUNKS = 8; // Per file
const TEMP_DIR = "./.temp";

async function processFile(filePath, secretPrefix) {
  try {
    console.log(`\n📄 Processing file: ${filePath}`);

    // Get original file size for validation
    const originalSize = statSync(filePath).size;
    if (originalSize === 0) {
      throw new Error(`❌ Error: ${filePath} is empty`);
    }

    const fileBuffer = readFileSync(filePath);
    const chunkSize = Math.ceil(fileBuffer.length / NUM_CHUNKS);
    const base64Chunks = [];

    // Add debug info for original file
    const originalHash = createHash("sha256").update(fileBuffer).digest("hex");
    console.log(`🔒 Original file hash: ${originalHash}`);
    console.log(`📊 Original file size: ${originalSize} bytes`);

    // Split into chunks
    const chunks = [];
    let totalSize = 0;
    for (let i = 0; i < NUM_CHUNKS; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, fileBuffer.length);
      const chunk = fileBuffer.subarray(start, end);
      const chunkPath = `${TEMP_DIR}/${secretPrefix}_chunk_${i}`;

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
      const secretName = `${secretPrefix}_CHUNK_${i + 1}`;
      const secretValue = Buffer.from(chunk).toString("base64");
      base64Chunks.push(secretValue);

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

    console.log(`✅ Successfully split file into ${NUM_CHUNKS} chunks`);
    console.log("🔍 Validations passed:");
    console.log(`   - Original size: ${originalSize} bytes`);
    console.log(`   - Total chunks size: ${totalSize} bytes`);
    console.log(`   - All chunks properly base64 encoded`);

    return true;
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error);
    return false;
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
    await sodium.ready;
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

async function main() {
  const requiredEnvVars = [
    "GITHUB_TOKEN",
    "GITHUB_OWNER",
    "GITHUB_REPO",
    "VITE_INVENTORY_FILE",
    "VITE_CATALOG_FILE",
  ];
  const missingVars = requiredEnvVars.filter(
    (varName) => !process.env[varName]
  );

  if (missingVars.length > 0) {
    console.error(
      "❌ Missing required environment variables:",
      missingVars.join(", ")
    );
    process.exit(1);
  }

  try {
    // Create temp directory
    mkdirSync(TEMP_DIR, { recursive: true });

    // Process inventory file
    const inventoryFilePath = `./public/assets/${VITE_INVENTORY_FILE}`;
    const inventorySuccess = await processFile(
      inventoryFilePath,
      "INVENTORY_FILE"
    );

    // Process catalog file
    const catalogFilePath = `./public/assets/${VITE_CATALOG_FILE}`;
    const catalogSuccess = await processFile(catalogFilePath, "CATALOG_FILE");

    if (inventorySuccess && catalogSuccess) {
      console.log("\n🎉 All files processed successfully!");
      console.log("🔑 All secrets updated on GitHub");
      // Combine back the chunks into files and ensure the hash matches
      console.log("🔍 Validating the combined files");
      const result = testChunks();
      if (result) {
        console.log("✅ All validations passed");
      } else {
        throw new Error("❌ Combined files do not match the original files");
      }
    } else {
      console.error("\n❌ One or more files failed to process");
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  } finally {
    // Clean up temp directory
    try {
      console.log("\n🧹 Cleaning up...");
      rmSync(TEMP_DIR, { recursive: true, force: true });
      console.log("🧹 Cleaned up temporary files");
    } catch (cleanupError) {
      console.error("❌ Failed to clean up temp directory:", cleanupError);
    }
  }
}

function testChunks() {
  // Get and validate environment variables
  const { VITE_INVENTORY_FILE, VITE_CATALOG_FILE } = process.env;
  if (!VITE_INVENTORY_FILE) {
    console.error(
      "❌ Error: VITE_INVENTORY_FILE environment variable is not set"
    );
    process.exit(1);
  }
  if (!VITE_CATALOG_FILE) {
    console.error(
      "❌ Error: VITE_CATALOG_FILE environment variable is not set"
    );
    process.exit(1);
  }

  // Ensure directories
  if (!existsSync("./public")) mkdirSync("./public", { recursive: true });
  if (!existsSync("./public/assets"))
    mkdirSync("./public/assets", { recursive: true });

  let inventorySuccess = false;
  let catalogSuccess = false;

  try {
    // Check if original inventory file exists to get hash for comparison
    const inventoryFilePath = `./public/assets/${VITE_INVENTORY_FILE}`;
    let originalInventoryHash = null;

    if (existsSync(inventoryFilePath)) {
      const originalInventory = readFileSync(inventoryFilePath);
      originalInventoryHash = createHash("sha256")
        .update(originalInventory)
        .digest("hex");
      console.log(`🔍 Original inventory file hash: ${originalInventoryHash}`);
      console.log(
        `📊 Original inventory size: ${originalInventory.length} bytes`
      );
      // Backup the original file
      writeFileSync(`${inventoryFilePath}.bak`, originalInventory);
    }

    // Check if original catalog file exists to get hash for comparison
    const catalogFilePath = `./public/assets/${VITE_CATALOG_FILE}`;
    let originalCatalogHash = null;

    if (existsSync(catalogFilePath)) {
      const originalCatalog = readFileSync(catalogFilePath);
      originalCatalogHash = createHash("sha256")
        .update(originalCatalog)
        .digest("hex");
      console.log(`🔍 Original catalog file hash: ${originalCatalogHash}`);
      console.log(`📊 Original catalog size: ${originalCatalog.length} bytes`);
      // Backup the original file
      writeFileSync(`${catalogFilePath}.bak`, originalCatalog);
    }

    // Process inventory file
    console.log("\n📊 Processing inventory file...");
    const inventoryChunks = [];
    for (let i = 0; i < NUM_CHUNKS; i++) {
      const chunkPath = `./.temp/INVENTORY_FILE_chunk_${i}`;
      if (existsSync(chunkPath)) {
        const data = readFileSync(chunkPath);
        inventoryChunks.push(data);
        console.log(`✅ Read inventory chunk ${i}: ${data.length} bytes`);
      } else {
        console.error(
          `⚠️ Warning: Inventory chunk ${i} not found at ${chunkPath}`
        );
        throw new Error("Missing inventory chunks");
      }
    }

    const combinedInventory = Buffer.concat(inventoryChunks);
    console.log(
      `✅ Combined ${inventoryChunks.length} inventory chunks: ${combinedInventory.length} bytes`
    );

    const inventoryHash = createHash("sha256")
      .update(combinedInventory)
      .digest("hex");
    console.log(`🔐 Reconstructed inventory file hash: ${inventoryHash}`);

    writeFileSync(inventoryFilePath, combinedInventory);
    console.log(`✅ Wrote inventory file: ${combinedInventory.length} bytes`);

    // Check if hashes match for inventory
    if (originalInventoryHash && inventoryHash === originalInventoryHash) {
      console.log(`✅ Inventory file hash verification: MATCH ✓`);
      inventorySuccess = true;
    } else if (originalInventoryHash) {
      console.error(`❌ Inventory file hash verification: MISMATCH ✗`);
      console.log(`   Original: ${originalInventoryHash}`);
      console.log(`   Reconstructed: ${inventoryHash}`);
    } else {
      console.log(`ℹ️ No original inventory file to compare hash with`);
      inventorySuccess = true; // No comparison possible, assume success
    }

    // Process catalog file
    console.log("\n📚 Processing catalog file...");
    const catalogChunks = [];
    for (let i = 0; i < NUM_CHUNKS; i++) {
      const chunkPath = `./.temp/CATALOG_FILE_chunk_${i}`;
      if (existsSync(chunkPath)) {
        const data = readFileSync(chunkPath);
        catalogChunks.push(data);
        console.log(`✅ Read catalog chunk ${i}: ${data.length} bytes`);
      } else {
        console.error(
          `⚠️ Warning: Catalog chunk ${i} not found at ${chunkPath}`
        );
        throw new Error("Missing catalog chunks");
      }
    }

    const combinedCatalog = Buffer.concat(catalogChunks);
    console.log(
      `✅ Combined ${catalogChunks.length} catalog chunks: ${combinedCatalog.length} bytes`
    );

    const catalogHash = createHash("sha256")
      .update(combinedCatalog)
      .digest("hex");
    console.log(`🔐 Reconstructed catalog file hash: ${catalogHash}`);

    writeFileSync(catalogFilePath, combinedCatalog);
    console.log(`✅ Wrote catalog file: ${combinedCatalog.length} bytes`);

    // Check if hashes match for catalog
    if (originalCatalogHash && catalogHash === originalCatalogHash) {
      console.log(`✅ Catalog file hash verification: MATCH ✓`);
      catalogSuccess = true;
    } else if (originalCatalogHash) {
      console.error(`❌ Catalog file hash verification: MISMATCH ✗`);
      console.log(`   Original: ${originalCatalogHash}`);
      console.log(`   Reconstructed: ${catalogHash}`);
    } else {
      console.log(`ℹ️ No original catalog file to compare hash with`);
      catalogSuccess = true; // No comparison possible, assume success
    }

    // Summary
    console.log("\n📋 Verification summary:");
    console.log(
      `   Inventory file: ${inventorySuccess ? "✅ SUCCESS" : "❌ FAILED"}`
    );
    console.log(
      `   Catalog file: ${catalogSuccess ? "✅ SUCCESS" : "❌ FAILED"}`
    );

    if (inventorySuccess && catalogSuccess) {
      console.log("\n✅ All files processed and verified successfully!");
      return true;
    } else {
      console.error("\n❌ One or more files failed verification!");
      return false;
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

main();
