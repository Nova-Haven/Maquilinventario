import { writeFileSync, existsSync, mkdirSync } from "fs";
import { createHash } from "crypto";

// Helper function to ensure directories exist
function ensureDirectories() {
  // Path relative to CWD (project root)
  if (!existsSync("./public")) mkdirSync("./public", { recursive: true });
  if (!existsSync("./public/assets"))
    mkdirSync("./public/assets", { recursive: true });
}

// Get NUM_CHUNKS from environment variable
const NUM_CHUNKS_ENV = process.env.NUM_CHUNKS;
if (!NUM_CHUNKS_ENV) {
  console.error(
    JSON.stringify({
      error: "Missing NUM_CHUNKS environment variable.",
      success: false,
    })
  );
  process.exit(1);
}

const NUM_CHUNKS = parseInt(NUM_CHUNKS_ENV, 10);
if (isNaN(NUM_CHUNKS) || NUM_CHUNKS <= 0) {
  console.error(
    JSON.stringify({
      error: `Invalid NUM_CHUNKS environment variable: ${NUM_CHUNKS_ENV}. Must be a positive integer.`,
      success: false,
    })
  );
  process.exit(1);
}

// Configuration for the file types to process
const fileProcessingConfigs = [
  {
    type: "inventory",
    prefix: "INVENTORY_FILE",
    envFilenameVar: "VITE_INVENTORY_FILE",
  },
  {
    type: "catalog",
    prefix: "CATALOG_FILE",
    envFilenameVar: "VITE_CATALOG_FILE",
  },
];

try {
  ensureDirectories();
  const overallResults = [];

  for (const config of fileProcessingConfigs) {
    const { type, prefix, envFilenameVar } = config;

    const filename = process.env[envFilenameVar];
    if (!filename) {
      const message = `Skipping ${type} file: Environment variable ${envFilenameVar} for filename is not set.`;
      console.warn(JSON.stringify({ warning: message, type: type }));
      overallResults.push({
        type: type,
        success: false,
        status: "skipped",
        reason: message,
      });
      continue;
    }

    const base64Chunks = [];
    let allChunksForCurrentFilePresent = true;
    for (let i = 1; i <= NUM_CHUNKS; i++) {
      const chunkEnvVar = `${prefix}_CHUNK_${i}`;
      const chunk = process.env[chunkEnvVar];

      if (!chunk) {
        const errorMessage = `Missing chunk for ${type} file: ${chunkEnvVar}`;
        console.error(
          JSON.stringify({
            error: errorMessage,
            success: false,
            type: type,
          })
        );
        overallResults.push({
          type: type,
          success: false,
          status: "error",
          reason: errorMessage,
        });
        allChunksForCurrentFilePresent = false;
        break;
      }
      base64Chunks.push(chunk);
    }

    if (!allChunksForCurrentFilePresent) {
      continue; // Move to the next file type if current one has missing chunks
    }

    if (base64Chunks.length === 0) {
      // This case should ideally be caught by NUM_CHUNKS > 0 and missing chunk checks
      // but as a safeguard if filename is present but somehow no chunks were expected/found.
      const message = `No chunks found to process for ${type} file (${filename}), though filename was provided. NUM_CHUNKS: ${NUM_CHUNKS}.`;
      console.warn(JSON.stringify({ warning: message, type: type }));
      overallResults.push({
        type: type,
        success: false,
        status: "skipped",
        reason: message,
      });
      continue;
    }

    const buffers = base64Chunks.map((chunk) => Buffer.from(chunk, "base64"));
    const combinedBuffer = Buffer.concat(buffers);
    const hash = createHash("sha256").update(combinedBuffer).digest("hex");
    const outputPath = `./public/assets/${filename}`; // Assumes CWD is project root

    writeFileSync(outputPath, combinedBuffer);

    overallResults.push({
      success: true,
      status: "processed",
      type: type,
      path: outputPath,
      size: combinedBuffer.length,
      hash: hash,
    });
  }

  const processedCount = overallResults.filter(
    (r) => r.status === "processed"
  ).length;
  const erroredCount = overallResults.filter(
    (r) => r.status === "error"
  ).length;

  if (processedCount === 0 && overallResults.length > 0) {
    // If some files were attempted (configs existed) but none succeeded
    console.error(
      JSON.stringify({
        error:
          "No files were successfully processed. Check logs and environment variable configuration.",
        success: false,
        details: overallResults,
      })
    );
    process.exit(1);
  } else if (processedCount === 0 && overallResults.length === 0) {
    // This case means no file configs led to an attempt (e.g. VITE_INVENTORY_FILE and VITE_CATALOG_FILE not set)
    // This might be an acceptable state if no files were intended to be processed.
    // However, the script is usually called with the expectation of processing something.
    console.warn(
      JSON.stringify({
        warning:
          "No file configurations found (e.g., VITE_INVENTORY_FILE or VITE_CATALOG_FILE not set). No files processed.",
        success: true,
        details: overallResults,
      })
    );
  } else {
    // At least one file processed, or some processed and some failed/skipped
    console.log(
      JSON.stringify({
        overallSuccess: erroredCount === 0, // True if no errors, skips are not errors for overallSuccess
        processedCount: processedCount,
        details: overallResults,
      })
    );
  }
} catch (error) {
  console.error(
    JSON.stringify({
      error: error.message,
      stack: error.stack, // Include stack for better debugging in Actions
      success: false,
    })
  );
  process.exit(1);
}
