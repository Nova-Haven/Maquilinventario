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
import { createAppAuth } from "@octokit/auth-app";
import fs from "fs"; // Import fs for reading the key file if needed

let octokit;

// Function to get the private key, similar to server.js
function getGitHubAppPrivateKey(providedKey, providedKeyPath) {
  if (providedKeyPath) {
    try {
      return fs.readFileSync(providedKeyPath, "utf8");
    } catch (error) {
      console.warn(
        `WARN (splitExcel-bot): GITHUB_APP_PRIVATE_KEY_PATH is set but could not read file (${providedKeyPath}):`,
        error.message
      );
      console.warn(
        "WARN (splitExcel-bot): Falling back to provided GITHUB_APP_PRIVATE_KEY."
      );
    }
  }
  if (providedKey) {
    return providedKey;
  }
  throw new Error(
    "Missing GitHub App private key in config for splitExcel-bot."
  );
}

async function initializeOctokit(
  appId,
  privateKey,
  privateKeyPath,
  installationId
) {
  const effectivePrivateKey = getGitHubAppPrivateKey(
    privateKey,
    privateKeyPath
  );
  if (!appId || !effectivePrivateKey || !installationId) {
    throw new Error(
      "Missing appId, privateKey/privateKeyPath, or installationId for GitHub App authentication in splitExcel-bot."
    );
  }
  try {
    const auth = createAppAuth({
      appId: appId,
      privateKey: effectivePrivateKey.replace(/\\\\n/g, "\\n"), // Ensure newlines are correct
      installationId: installationId,
    });
    const installationAuthentication = await auth({ type: "installation" });
    octokit = new Octokit({ auth: installationAuthentication.token });
    console.log(
      "Octokit initialized successfully using GitHub App credentials."
    );
  } catch (error) {
    console.error("Error initializing Octokit with GitHub App:", error);
    throw error; // Re-throw to be caught by main or exit
  }
}

// Configuration
import { NUM_CHUNKS } from "./config.js";
const TEMP_DIR = "./.temp";

async function processFile(filePath, secretPrefix, githubConfig) {
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

      await updateGithubSecret(secretName, secretValue, githubConfig);
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

async function updateGithubSecret(secretName, secretValue, githubConfig) {
  const { owner, repo } = githubConfig;
  try {
    // Get the public key for secret encryption
    const { data: publicKey } = await octokit.actions.getRepoPublicKey({
      owner: owner,
      repo: repo,
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
      owner: owner,
      repo: repo,
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

async function main(filePath, secretPrefix, githubConfig) {
  const {
    appId,
    privateKey, // This can be the key itself or undefined if path is used
    privateKeyPath, // New: path to the key file
    installationId,
    owner,
    repo,
  } = githubConfig;

  if (
    !appId ||
    (!privateKey && !privateKeyPath) ||
    !installationId ||
    !owner ||
    !repo
  ) {
    console.error(
      "❌ Missing required GitHub configuration parameters: appId, (privateKey or privateKeyPath), installationId, owner, or repo"
    );
    throw new Error(
      "Missing GitHub configuration parameters for splitExcel-bot"
    );
  }

  try {
    // Pass both privateKey and privateKeyPath to initializeOctokit
    await initializeOctokit(appId, privateKey, privateKeyPath, installationId);

    // Create temp directory if it doesn't exist
    if (!existsSync(TEMP_DIR)) {
      mkdirSync(TEMP_DIR, { recursive: true });
    }

    // Process the provided file
    const success = await processFile(filePath, secretPrefix, githubConfig);

    if (success) {
      console.log(
        `\n🎉 File ${filePath} processed successfully with prefix ${secretPrefix}!`
      );
      console.log("🔑 All secrets updated on GitHub");
      // The validation of combined chunks (previously in testChunks)
      // would ideally happen after retrieval from GitHub secrets if needed,
      // or this script now assumes the upload was successful if processFile completes.
    } else {
      console.error(
        `\n❌ File ${filePath} failed to process with prefix ${secretPrefix}`
      );
      // Throw an error or return a status to the caller
      throw new Error(`Failed to process file ${filePath}`);
    }
    return success; // Return status
  } catch (error) {
    console.error("❌ Error in main processing:", error);
    // Re-throw the error so the caller can handle it
    throw error;
  } finally {
    // Clean up temp directory
    try {
      if (existsSync(TEMP_DIR)) {
        console.log("\n🧹 Cleaning up...");
        rmSync(TEMP_DIR, { recursive: true, force: true });
        console.log("🧹 Cleaned up temporary files");
      }
    } catch (cleanupError) {
      console.error("❌ Failed to clean up temp directory:", cleanupError);
      // Log cleanup error but don't let it hide the main processing error
    }
  }
}

// Export main for use in server.js
export { main };

// Remove direct execution of main() if this script is now a module
// main().catch((error) => {
// console.error("Unhandled error in main:", error);
// process.exit(1);
// });
