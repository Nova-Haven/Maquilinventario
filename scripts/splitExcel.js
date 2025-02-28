import { readFileSync, writeFileSync } from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import { config } from "dotenv";
import { platform } from "os";
import { Octokit } from "@octokit/rest";
import sodium from "libsodium-wrappers";

config();

// Add GitHub configuration
const { GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, VITE_EXCEL_FILE } =
  process.env;

const octokit = new Octokit({
  auth: GITHUB_TOKEN,
});

const execAsync = promisify(exec);
const isWindows = platform() === "win32";

// Configuration
const NUM_CHUNKS = 6;
const FILE_PATH = `./data/${VITE_EXCEL_FILE}`;
const TEMP_DIR = "./.temp";

// Platform-specific commands
const commands = {
  mkdir: isWindows ? "mkdir" : "mkdir -p",
  rmrf: isWindows ? "rmdir /s /q" : "rm -rf",
  base64: (path) =>
    isWindows
      ? `certutil -encode "${path}" temp.b64 && type temp.b64 | findstr /v /c:- && del temp.b64`
      : `base64 -i "${path}"`,
};

async function splitAndEncodeFile() {
  try {
    const fileBuffer = readFileSync(FILE_PATH);
    const chunkSize = Math.ceil(fileBuffer.length / NUM_CHUNKS);

    // Split into exactly 6 chunks
    const chunks = [];
    for (let i = 0; i < NUM_CHUNKS; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, fileBuffer.length);
      chunks.push(new Uint8Array(fileBuffer).subarray(start, end));
    }

    // Create temp directory
    await execAsync(`${commands.mkdir} ${TEMP_DIR}`);

    // Process each chunk
    const encodingCommands = [];
    chunks.forEach((chunk, index) => {
      const chunkPath = `${TEMP_DIR}/chunk_${index}`;
      writeFileSync(chunkPath, chunk);
      const command = `echo "EXCEL_FILE_CHUNK_${
        index + 1
      }" && ${commands.base64(chunkPath)}`;
      encodingCommands.push(command);
    });

    // Execute commands and collect output
    const results = await Promise.all(
      encodingCommands.map((cmd) => execAsync(cmd))
    );

    // Format output for easy copying to GitHub Secrets
    for (let i = 0; i < results.length; i++) {
      const secretName = `EXCEL_FILE_CHUNK_${i + 1}`;
      const secretValue = results[i].stdout.trim();
      await updateGithubSecret(secretName, secretValue);
    }

    // Clean up
    await execAsync(`${commands.rmrf} ${TEMP_DIR}`);

    console.log("✅ Successfully split Excel file into 6 chunks");
  } catch (error) {
    console.error("❌ Error:", error);
    if (error.stdout) console.error("stdout:", error.stdout);
    if (error.stderr) console.error("stderr:", error.stderr);
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
