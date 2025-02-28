import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from "fs";
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname } from "path";
import path from "path";

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config(path.resolve(__dirname, "../.env"));

// Get and validate VITE_EXCEL_FILE
const { VITE_EXCEL_FILE } = process.env;
if (!VITE_EXCEL_FILE) {
  console.error("❌ Error: VITE_EXCEL_FILE environment variable is not set");
  process.exit(1);
}

// Ensure directories
if (!existsSync("./dist")) mkdirSync("./dist", { recursive: true });
if (!existsSync("./dist/data")) mkdirSync("./dist/data", { recursive: true });

try {
  // Step 1: Read all chunks
  console.log("Reading chunks as binary...");
  const binaryChunks = [];
  for (let i = 1; i <= 6; i++) {
    const chunkPath = `./.temp/chunk_${i - 1}`;
    if (existsSync(chunkPath)) {
      const data = readFileSync(chunkPath);
      binaryChunks.push(data);
      console.log(`✅ Read chunk ${i - 1}: ${data.length} bytes`);
    } else {
      console.error(`⚠️ Warning: Chunk ${i - 1} not found at ${chunkPath}`);
      throw new Error("Missing chunks");
    }
  }

  // Step 2: Combine binary chunks
  const combined = Buffer.concat(binaryChunks);
  console.log(
    `✅ Combined ${binaryChunks.length} chunks: ${combined.length} bytes`
  );

  // Step 3: Write directly to output file
  writeFileSync(`./public/assets/${VITE_EXCEL_FILE}`, combined);
  console.log(`✅ Wrote Excel file: ${combined.length} bytes`);

  // Step 4: Create a proper base64 version for GitHub Actions
  const base64Data = combined.toString("base64");
  console.log(`✅ Base64 encoded: ${base64Data.length} characters`);

  // Save in chunks of ~40KB for GitHub Actions secrets
  /*const chunkSize = 40000;
  for (let i = 0; i < base64Data.length; i += chunkSize) {
    const chunk = base64Data.substring(i, i + chunkSize);
    writeFileSync(`./.temp/b64_chunk_${Math.floor(i / chunkSize)}`, chunk);
    console.log(
      `✅ Wrote base64 chunk ${Math.floor(i / chunkSize)}: ${
        chunk.length
      } chars`
    );
  }*/
  // Clean up with an emoji
  console.log("🧹 Cleaning up...");
  rmSync("./.temp", { recursive: true, force: true });

  console.log("✅ Done!");
} catch (error) {
  console.error("❌ Error:", error.message);
  process.exit(1);
}
