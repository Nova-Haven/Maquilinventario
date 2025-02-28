import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";

// Create necessary directories
const outputDir = join("dist", "data");
if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

// Get all chunks from secrets
const chunks = [
  process.env.EXCEL_FILE_CHUNK_1,
  process.env.EXCEL_FILE_CHUNK_2,
  process.env.EXCEL_FILE_CHUNK_3,
  process.env.EXCEL_FILE_CHUNK_4,
  process.env.EXCEL_FILE_CHUNK_5,
  process.env.EXCEL_FILE_CHUNK_6,
].filter(Boolean);

if (chunks.length !== 6) {
  throw new Error("Missing one or more chunks");
}

// Combine and decode chunks
const combined = chunks.join("");
const decoded = Buffer.from(combined, "base64");

// Write output file
const outputFile = join(outputDir, process.env.VITE_EXCEL_FILE);
writeFileSync(outputFile, decoded);

// Output JSON formatted result
console.log(
  JSON.stringify({
    size: decoded.length,
    path: outputFile,
  })
);
