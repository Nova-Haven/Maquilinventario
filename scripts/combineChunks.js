import { writeFileSync, existsSync, mkdirSync } from "fs";
import { NUM_CHUNKS } from "./splitExcel";
import { createHash } from "crypto";

// Helper function to ensure directories exist
function ensureDirectories() {
  if (!existsSync("./public")) mkdirSync("./public", { recursive: true });
  if (!existsSync("./public/assets"))
    mkdirSync("./public/assets", { recursive: true });
}

// Process command line args to determine file type
let fileType = "inventory"; // default
const args = process.argv.slice(2);
if (args.includes("--type") && args.indexOf("--type") + 1 < args.length) {
  fileType = args[args.indexOf("--type") + 1];
}

// Set appropriate variables based on file type
const filePrefix = fileType === "catalog" ? "CATALOG_FILE" : "INVENTORY_FILE";
const envFilename =
  fileType === "catalog" ? "VITE_CATALOG_FILE" : "VITE_INVENTORY_FILE";

// Ensure required env variables are set
const filename = process.env[envFilename];
if (!filename) {
  console.error(
    JSON.stringify({
      error: `Missing environment variable: ${envFilename}`,
      success: false,
    })
  );
  process.exit(1);
}

try {
  ensureDirectories();

  // Collect the base64 encoded chunks from environment variables
  const base64Chunks = [];
  for (let i = 1; i <= NUM_CHUNKS; i++) {
    const chunkEnvVar = `${filePrefix}_CHUNK_${i}`;
    const chunk = process.env[chunkEnvVar];

    if (!chunk) {
      console.error(
        JSON.stringify({
          error: `Missing chunk: ${chunkEnvVar}`,
          success: false,
        })
      );
      process.exit(1);
    }

    base64Chunks.push(chunk);
  }

  // Decode and combine all the chunks
  const buffers = base64Chunks.map((chunk) => Buffer.from(chunk, "base64"));
  const combinedBuffer = Buffer.concat(buffers);

  // Generate a checksum for validation
  const hash = createHash("sha256").update(combinedBuffer).digest("hex");

  // Write the complete file
  const outputPath = `./public/assets/${filename}`;
  writeFileSync(outputPath, combinedBuffer);

  // Output the results as JSON for the GitHub Action to parse
  console.log(
    JSON.stringify({
      success: true,
      size: combinedBuffer.length,
      hash: hash,
      path: outputPath,
      type: fileType,
    })
  );
} catch (error) {
  console.error(
    JSON.stringify({
      error: error.message,
      success: false,
    })
  );
  process.exit(1);
}
