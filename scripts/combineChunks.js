const fs = require("fs");
const path = require("path");

// Create necessary directories
const outputDir = path.join("dist", "data");
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
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
const outputFile = path.join(outputDir, process.env.VITE_EXCEL_FILE);
fs.writeFileSync(outputFile, decoded);

console.log('{"size": ' + decoded.length + ', "path": "' + outputFile + '"}');
