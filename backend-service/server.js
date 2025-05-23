const express = require("express");
const cors = require("cors");
const multer = require("multer");
const admin = require("firebase-admin");
const { Octokit } = require("@octokit/rest");
const { createAppAuth } = require("@octokit/auth-app");
const fs = require("fs");
const path = require("path");
const sanitizeFilename = require("sanitize-filename");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit"); // Added for rate limiting

// Import NUM_CHUNKS from config.js
const { NUM_CHUNKS } = require("./config.js");

// --- Configuration ---
const PORT = process.env.PORT || 1111;
const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO = process.env.GITHUB_REPO;
const FIREBASE_SERVICE_ACCOUNT_PATH = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN;
const GITHUB_APP_ID = process.env.GITHUB_APP_ID;
const GITHUB_APP_PRIVATE_KEY = process.env.GITHUB_APP_PRIVATE_KEY; // Store this securely!
const GITHUB_APP_PRIVATE_KEY_PATH = process.env.GITHUB_APP_PRIVATE_KEY_PATH; // Path to the private key file
const GITHUB_APP_INSTALLATION_ID = process.env.GITHUB_APP_INSTALLATION_ID; // Or discover it

const SERVER_TEMP_DIR = path.join(__dirname, "server_temp_uploads"); // For server.js to temporarily store full uploads

// Function to get the private key
function getGitHubAppPrivateKey() {
  if (GITHUB_APP_PRIVATE_KEY_PATH) {
    try {
      return fs.readFileSync(GITHUB_APP_PRIVATE_KEY_PATH, "utf8");
    } catch (error) {
      console.warn(
        `WARN: GITHUB_APP_PRIVATE_KEY_PATH is set but could not read file (${GITHUB_APP_PRIVATE_KEY_PATH}):`,
        error.message
      );
      console.warn(
        "Falling back to GITHUB_APP_PRIVATE_KEY environment variable."
      );
    }
  }
  if (GITHUB_APP_PRIVATE_KEY) {
    return GITHUB_APP_PRIVATE_KEY;
  }
  throw new Error(
    "Missing GitHub App private key. Set GITHUB_APP_PRIVATE_KEY_PATH or GITHUB_APP_PRIVATE_KEY."
  );
}

const effectiveGitHubAppPrivateKey = getGitHubAppPrivateKey();

if (
  !GITHUB_OWNER ||
  !GITHUB_REPO ||
  !FIREBASE_SERVICE_ACCOUNT_PATH ||
  !FIREBASE_PROJECT_ID ||
  !FRONTEND_ORIGIN ||
  !GITHUB_APP_ID ||
  // !GITHUB_APP_PRIVATE_KEY || // No longer directly checking this, getGitHubAppPrivateKey handles it
  !effectiveGitHubAppPrivateKey || // Check if we successfully got a key
  !GITHUB_APP_INSTALLATION_ID
) {
  console.error(
    "FATAL ERROR: Missing one or more required environment variables."
  );
  console.error(
    !GITHUB_OWNER,
    !GITHUB_REPO,
    !FIREBASE_SERVICE_ACCOUNT_PATH,
    !FIREBASE_PROJECT_ID,
    !FRONTEND_ORIGIN,
    !GITHUB_APP_ID,
    !effectiveGitHubAppPrivateKey,
    !GITHUB_APP_INSTALLATION_ID
  );
  process.exit(1);
}

// --- Initialize Firebase Admin SDK ---
try {
  const serviceAccount = require(FIREBASE_SERVICE_ACCOUNT_PATH);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log("Firebase Admin SDK initialized successfully.");
} catch (error) {
  console.error("Error initializing Firebase Admin SDK:", error.message);
  console.error(
    "Ensure FIREBASE_SERVICE_ACCOUNT_PATH is correct and the file exists"
  );
  process.exit(1);
}

// --- Initialize Octokit (GitHub API client) ---
let octokit; // Define in a higher scope
try {
  octokit = new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: GITHUB_APP_ID,
      privateKey: effectiveGitHubAppPrivateKey.replace(/\\n/g, "\n"), // Ensure newlines are correct
      installationId: GITHUB_APP_INSTALLATION_ID,
    },
  });
  console.log("Octokit initialized successfully.");
} catch (error) {
  console.error("Error initializing Octokit:", error.message);
  console.error(
    "Ensure GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, and GITHUB_APP_INSTALLATION_ID are correct and have the necessary permissions."
  );
  process.exit(1);
}

// --- Express App Setup ---
const app = express();

// Tell Express that it's behind a trusted proxy (Nginx in this case)
// This allows req.ip to be the actual client IP from X-Forwarded-For
// and helps express-rate-limit work correctly.
app.set("trust proxy", 1);

// Rate Limiter for the API endpoint
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: "Too many requests from this IP, please try again after 15 minutes",
});

// Multer setup for file uploads (in-memory storage)
let upload; // Define in a higher scope
try {
  const storage = multer.memoryStorage();
  upload = multer({
    // Assign here
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit per file
  });
  console.log("Multer initialized successfully.");
} catch (error) {
  console.error("Error setting up Multer:", error.message);
  process.exit(1);
}

console.log(`CORS: Allowing requests from origin: ${FRONTEND_ORIGIN}`);

// CORS Configuration
const corsOptions = {
  origin: FRONTEND_ORIGIN, // Directly use the string from environment variable
  methods: ["POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true, // Often useful for cross-origin requests involving auth/cookies
};

// Use CORS middleware
app.use(cors(corsOptions));
// app.options("*", cors(corsOptions)); // Temporarily remove this to see if the main middleware handles OPTIONS

// Middleware for parsing JSON (though not strictly needed for multipart/form/data)
try {
  app.use(express.json());
  console.log("JSON parsing middleware set up.");
} catch (error) {
  console.error("Error setting up JSON parsing middleware:", error.message);
  process.exit(1);
}

// --- Middleware for Firebase Authentication ---
async function firebaseAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ message: "Unauthorized: No token provided." });
  }
  const idToken = authHeader.split("Bearer ")[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);

    // Check if the token is for the correct Firebase project
    // console.log("FIREBASE_PROJECT_ID:", FIREBASE_PROJECT_ID);
    // console.log("decodedToken.aud:", decodedToken.aud);
    if (decodedToken.aud !== FIREBASE_PROJECT_ID) {
      return res
        .status(401)
        .json({ message: "Unauthorized: Invalid token (audience mismatch)." });
    }

    // Check for custom claims (role)
    const userRole = decodedToken.roles;
    if (userRole !== "admin" && userRole !== "upload") {
      return res
        .status(403)
        .json({ message: "Forbidden: Insufficient permissions." });
    }
    req.user = decodedToken; // Attach user info to request object
    next();
  } catch (error) {
    console.error("Error verifying Firebase ID token:", error);
    return res
      .status(401)
      .json({ message: "Unauthorized: Invalid token.", error: error.message });
  }
}

// --- API Endpoint ---
try {
  app.get("/", (req, res) => {
    console.log(`${new Date().toISOString()} - Received GET request on /`);
    res.status(200).json({
      message: "Welcome to the Excelite API. Please upload files.",
    });
  });
  app.post(
    "/",
    apiLimiter, // Apply rate limiting first
    firebaseAuthMiddleware, // Apply authentication middleware
    upload.fields([
      // Expecting two files, but will handle if only one is present
      { name: "inventoryFile", maxCount: 1 },
      { name: "catalogFile", maxCount: 1 },
    ]),
    async (req, res) => {
      console.log(
        `${new Date().toISOString()} - Received POST file upload request on /`
      );
      const files = req.files;
      const inventoryFile = files?.inventoryFile?.[0];
      const catalogFile = files?.catalogFile?.[0];

      if (!inventoryFile && !catalogFile) {
        return res.status(400).json({
          message:
            "Solicitud incorrecta: Se requiere al menos un archivo (inventoryFile o catalogFile).",
        });
      }

      let tempInventoryFilePath = "";
      let tempCatalogFilePath = "";
      let processedInventory = false;
      let processedCatalog = false;

      try {
        const { main: splitExcelBotMain } = await import(
          "./splitExcel-bot.min.js"
        );

        const githubConfig = {
          appId: GITHUB_APP_ID,
          privateKey: effectiveGitHubAppPrivateKey,
          installationId: GITHUB_APP_INSTALLATION_ID,
          owner: GITHUB_OWNER,
          repo: GITHUB_REPO,
        };

        if (!fs.existsSync(SERVER_TEMP_DIR)) {
          fs.mkdirSync(SERVER_TEMP_DIR, { recursive: true });
        }

        if (inventoryFile) {
          console.log(`Received inventory file: ${inventoryFile.originalname}`);
          if (!inventoryFile.originalname.endsWith(".xlsx")) {
            return res.status(400).json({
              message:
                "Tipo de archivo de inventario no válido. Se esperaba .xlsx",
            });
          }
          const sanitizedInventoryFilename = sanitizeFilename(
            inventoryFile.originalname
          );
          tempInventoryFilePath = path.join(
            SERVER_TEMP_DIR,
            sanitizedInventoryFilename
          );
          fs.writeFileSync(tempInventoryFilePath, inventoryFile.buffer);
          console.log(
            `Inventory file temporarily saved to ${tempInventoryFilePath}`
          );
          await splitExcelBotMain(
            tempInventoryFilePath,
            "INVENTORY_FILE",
            githubConfig
          );
          console.log(`Inventory file processed by splitExcel-bot.`);
          processedInventory = true;
        }

        if (catalogFile) {
          console.log(`Received catalog file: ${catalogFile.originalname}`);
          if (!catalogFile.originalname.endsWith(".xls")) {
            return res.status(400).json({
              message:
                "Tipo de archivo de catálogo no válido. Se esperaba .xls",
            });
          }
          const sanitizedCatalogFilename = sanitizeFilename(
            catalogFile.originalname
          );
          tempCatalogFilePath = path.join(
            SERVER_TEMP_DIR,
            sanitizedCatalogFilename
          );
          fs.writeFileSync(tempCatalogFilePath, catalogFile.buffer);
          console.log(
            `Catalog file temporarily saved to ${tempCatalogFilePath}`
          );
          await splitExcelBotMain(
            tempCatalogFilePath,
            "CATALOG_FILE",
            githubConfig
          );
          console.log(`Catalog file processed by splitExcel-bot.`);
          processedCatalog = true;
        }

        console.log(
          "GitHub secrets updated for processed files via splitExcel-bot."
        );

        // Verify files only if both were uploaded and processed
        if (
          processedInventory &&
          processedCatalog &&
          inventoryFile &&
          catalogFile
        ) {
          console.log(
            "Verifying uploaded files against reconstructed chunks..."
          );
          await verifyUploadedFilesAgainstReconstructed(
            inventoryFile.originalname,
            catalogFile.originalname,
            NUM_CHUNKS,
            inventoryFile.buffer,
            catalogFile.buffer
          );
          console.log(
            "Local file verification successful: Uploaded content matches reconstructed chunks."
          );
        } else if (processedInventory || processedCatalog) {
          console.log(
            "Skipping full file verification as only one file type was processed or uploaded."
          );
        }

        // Trigger GitHub Actions workflow
        console.log("Triggering GitHub Actions workflow...");
        await triggerWorkflow(
          GITHUB_OWNER,
          GITHUB_REPO,
          "build-bot.yml",
          "v2.x.x", // Or the branch you want to trigger on
          octokit
        );

        let successMessage = "";
        if (processedInventory && processedCatalog) {
          successMessage =
            "Se procesaron los archivos de inventario y catálogo, se actualizaron los secretos y se activó la actualización del sitio.";
        } else if (processedInventory) {
          successMessage =
            "Se procesó el archivo de inventario, se actualizaron los secretos y se activó la actualización del sitio.";
        } else if (processedCatalog) {
          successMessage =
            "Se procesó el archivo de catálogo, se actualizaron los secretos y se activó la actualización del sitio.";
        }

        res.status(200).json({
          message: successMessage + ", espere un minuto, y actualice el sitio.",
        });
      } catch (error) {
        console.error("Error processing files or updating secrets:", error);
        if (error.status) {
          console.error("GitHub API Error Details:", error.response?.data);
        }
        res.status(500).json({
          message: "Failed to process files or update secrets.",
          error: error.message,
        });
      } finally {
        // Clean up temporary files
        if (tempInventoryFilePath && fs.existsSync(tempInventoryFilePath)) {
          fs.unlinkSync(tempInventoryFilePath);
          console.log(
            `Cleaned up temporary inventory file: ${tempInventoryFilePath}`
          );
        }
        if (tempCatalogFilePath && fs.existsSync(tempCatalogFilePath)) {
          fs.unlinkSync(tempCatalogFilePath);
          console.log(
            `Cleaned up temporary catalog file: ${tempCatalogFilePath}`
          );
        }
        // Optionally, clean up SERVER_TEMP_DIR if it's empty and you want to,
        // but it's often fine to leave it.
      }
    }
  );
} catch (error) {
  console.error("Error setting up API endpoint:", error.message);
  process.exit(1);
}

// --- Start Server ---
try {
  app.listen(PORT, () => {
    console.log(`Backend server listening on port ${PORT}`);
    console.log(`Accepting requests from origin: ${FRONTEND_ORIGIN}`);
  });
} catch (error) {
  console.error("Error starting server:", error.message);
  process.exit(1);
}

// Function to trigger GitHub Actions workflow
async function triggerWorkflow(owner, repo, workflow_id, ref, appOctokit) {
  try {
    await appOctokit.request(
      "POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches",
      {
        owner,
        repo,
        workflow_id,
        ref,
      }
    );
    console.log(`Successfully triggered workflow: ${workflow_id}`);
  } catch (error) {
    console.error(`Error triggering workflow ${workflow_id}:`, error);
  }
}

// Adapted verifyAndReconstructFiles function, now named verifyUploadedFilesAgainstReconstructed
async function verifyUploadedFilesAgainstReconstructed(
  inventoryOriginalName,
  catalogOriginalName,
  numChunks,
  originalInventoryBuffer,
  originalCatalogBuffer
) {
  const botTempDir = path.join(__dirname, ".temp"); // Chunks created by splitExcel-bot.js

  let inventorySuccess = false;
  let catalogSuccess = false;

  try {
    // --- Process inventory file ---
    console.log("\n📊 Verifying inventory file against its original upload...");
    const originalInventoryHash = crypto
      .createHash("sha256")
      .update(originalInventoryBuffer)
      .digest("hex");
    console.log(
      `🔍 Original uploaded inventory file hash: ${originalInventoryHash}`
    );
    console.log(
      `📊 Original uploaded inventory size: ${originalInventoryBuffer.length} bytes`
    );

    const inventoryChunks = [];
    for (let i = 0; i < numChunks; i++) {
      const chunkPath = path.join(botTempDir, `INVENTORY_FILE_chunk_${i}`);
      if (fs.existsSync(chunkPath)) {
        const data = fs.readFileSync(chunkPath);
        inventoryChunks.push(data);
        console.log(
          `✅ Read inventory chunk ${i} (${data.length} bytes) from ${chunkPath}`
        );
      } else {
        console.error(
          `❌ Error: Inventory chunk ${i} not found at ${chunkPath}`
        );
        throw new Error(
          `Missing inventory chunk for verification: INVENTORY_FILE_chunk_${i}`
        );
      }
    }

    if (inventoryChunks.length !== numChunks) {
      throw new Error(
        `Expected ${numChunks} inventory chunks for verification, but found ${inventoryChunks.length}`
      );
    }

    const reconstructedInventoryBuffer = Buffer.concat(inventoryChunks);
    console.log(
      `✅ Combined ${inventoryChunks.length} inventory chunks: ${reconstructedInventoryBuffer.length} bytes`
    );
    const reconstructedInventoryHash = crypto
      .createHash("sha256")
      .update(reconstructedInventoryBuffer)
      .digest("hex");
    console.log(
      `🔐 Reconstructed inventory from chunks, hash: ${reconstructedInventoryHash}`
    );

    if (reconstructedInventoryHash === originalInventoryHash) {
      console.log(
        `✅ Inventory file hash verification: MATCH (Uploaded === Reconstructed) ✓`
      );
      inventorySuccess = true;
    } else {
      console.error(
        `❌ Inventory file hash verification: MISMATCH (Uploaded !== Reconstructed) ✗`
      );
      console.log(`   Original Uploaded: ${originalInventoryHash}`);
      console.log(`   Reconstructed    : ${reconstructedInventoryHash}`);
      throw new Error(
        "Inventory file hash mismatch: Original uploaded content does not match content reconstructed from bot's chunks."
      );
    }

    // --- Process catalog file ---
    console.log("\n📚 Verifying catalog file against its original upload...");
    const originalCatalogHash = crypto
      .createHash("sha256")
      .update(originalCatalogBuffer)
      .digest("hex");
    console.log(
      `🔍 Original uploaded catalog file hash: ${originalCatalogHash}`
    );
    console.log(
      `📊 Original uploaded catalog size: ${originalCatalogBuffer.length} bytes`
    );

    const catalogChunks = [];
    for (let i = 0; i < numChunks; i++) {
      const chunkPath = path.join(botTempDir, `CATALOG_FILE_chunk_${i}`);
      if (fs.existsSync(chunkPath)) {
        const data = fs.readFileSync(chunkPath);
        catalogChunks.push(data);
        console.log(
          `✅ Read catalog chunk ${i} (${data.length} bytes) from ${chunkPath}`
        );
      } else {
        console.error(`❌ Error: Catalog chunk ${i} not found at ${chunkPath}`);
        throw new Error(
          `Missing catalog chunk for verification: CATALOG_FILE_chunk_${i}`
        );
      }
    }

    if (catalogChunks.length !== numChunks) {
      throw new Error(
        `Expected ${numChunks} catalog chunks for verification, but found ${catalogChunks.length}`
      );
    }

    const reconstructedCatalogBuffer = Buffer.concat(catalogChunks);
    console.log(
      `✅ Combined ${catalogChunks.length} catalog chunks: ${reconstructedCatalogBuffer.length} bytes`
    );
    const reconstructedCatalogHash = crypto
      .createHash("sha256")
      .update(reconstructedCatalogBuffer)
      .digest("hex");
    console.log(
      `🔐 Reconstructed catalog from chunks, hash: ${reconstructedCatalogHash}`
    );

    if (reconstructedCatalogHash === originalCatalogHash) {
      console.log(
        `✅ Catalog file hash verification: MATCH (Uploaded === Reconstructed) ✓`
      );
      catalogSuccess = true;
    } else {
      console.error(
        `❌ Catalog file hash verification: MISMATCH (Uploaded !== Reconstructed) ✗`
      );
      console.log(`   Original Uploaded: ${originalCatalogHash}`);
      console.log(`   Reconstructed    : ${reconstructedCatalogHash}`);
      throw new Error(
        "Catalog file hash mismatch: Original uploaded content does not match content reconstructed from bot's chunks."
      );
    }

    console.log(
      "\n📋 Verification summary (Uploaded vs. Reconstructed from bot's .temp chunks):"
    );
    console.log(
      `   Inventory file: ${inventorySuccess ? "✅ SUCCESS" : "❌ FAILED"}`
    );
    console.log(
      `   Catalog file: ${catalogSuccess ? "✅ SUCCESS" : "❌ FAILED"}`
    );

    if (inventorySuccess && catalogSuccess) {
      console.log(
        "\n✅ All uploaded files successfully verified against reconstructed versions from bot's chunks!"
      );
      return true;
    } else {
      // This case should ideally be caught by earlier throws if hashes mismatch or chunks are missing.
      throw new Error(
        "One or more files failed verification against reconstructed versions."
      );
    }
  } catch (error) {
    console.error(
      "❌ Error during local file verification (Uploaded vs. Reconstructed from bot's .temp chunks):",
      error.message
    );
    // Re-throw the error to be caught by the API endpoint handler
    throw error;
  }
}
