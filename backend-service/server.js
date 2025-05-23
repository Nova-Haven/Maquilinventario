const express = require("express");
const cors = require("cors");
const multer = require("multer");
const admin = require("firebase-admin");
const { Octokit } = require("@octokit/rest");
const fs = require("fs");
const path = require("path");

// --- Configuration ---
const PORT = process.env.PORT || 3000;
const GITHUB_PAT = process.env.GITHUB_PAT;
const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO = process.env.GITHUB_REPO;
const FIREBASE_SERVICE_ACCOUNT_PATH = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN;

if (
  !GITHUB_PAT ||
  !GITHUB_OWNER ||
  !GITHUB_REPO ||
  !FIREBASE_SERVICE_ACCOUNT_PATH ||
  !FIREBASE_PROJECT_ID ||
  !FRONTEND_ORIGIN
) {
  console.error(
    "FATAL ERROR: Missing one or more required environment variables."
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
    "Ensure FIREBASE_SERVICE_ACCOUNT_PATH is correct and the file exists:",
    FIREBASE_SERVICE_ACCOUNT_PATH
  );
  process.exit(1);
}

// --- Initialize Octokit (GitHub API client) ---
let octokit; // Define in a higher scope
try {
  octokit = new Octokit({ auth: GITHUB_PAT }); // Assign here
  console.log("Octokit initialized successfully.");
} catch (error) {
  console.error("Error initializing Octokit:", error.message);
  console.error(
    "Ensure GITHUB_PAT is correct and has the necessary permissions."
  );
  process.exit(1);
}

// --- Express App Setup ---
const app = express();

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

// Middleware for parsing JSON (though not strictly needed for multipart/form-data)
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
    console.log("FIREBASE_PROJECT_ID:", FIREBASE_PROJECT_ID);
    console.log("decodedToken.aud:", decodedToken.aud);
    if (decodedToken.aud !== FIREBASE_PROJECT_ID) {
      return res
        .status(401)
        .json({ message: "Unauthorized: Invalid token (audience mismatch)." });
    }

    // Check for custom claims (role)
    const userRole = decodedToken.role; // Assuming 'role' is your custom claim
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
  app.post(
    "/api/update-excel-files",
    firebaseAuthMiddleware, // Apply authentication middleware
    upload.fields([
      // Expecting two files
      { name: "inventoryFile", maxCount: 1 },
      { name: "catalogFile", maxCount: 1 },
    ]),
    async (req, res) => {
      if (!req.files || !req.files.inventoryFile || !req.files.catalogFile) {
        return res.status(400).json({
          message:
            "Bad Request: Both inventory and catalog files are required.",
        });
      }

      const inventoryFile = req.files.inventoryFile[0];
      const catalogFile = req.files.catalogFile[0];

      // Expected filenames from your frontend (VITE_INVENTORY_FILE, VITE_CATALOG_FILE)
      // The client sends these as the third argument to formData.append()
      const expectedInventoryFilename = inventoryFile.originalname; // Multer uses this from FormData
      const expectedCatalogFilename = catalogFile.originalname;

      console.log(
        `Received inventory file: ${inventoryFile.originalname} (expected: ${expectedInventoryFilename})`
      );
      console.log(
        `Received catalog file: ${catalogFile.originalname} (expected: ${expectedCatalogFilename})`
      );

      // Basic validation (optional, as client should do this too)
      if (!expectedInventoryFilename.endsWith(".xlsx")) {
        return res
          .status(400)
          .json({ message: "Invalid inventory file type. Expected .xlsx" });
      }
      if (!expectedCatalogFilename.endsWith(".xls")) {
        return res
          .status(400)
          .json({ message: "Invalid catalog file type. Expected .xls" });
      }

      try {
        const filesToUpdate = [
          {
            path: `public/assets/${expectedInventoryFilename}`,
            contentBuffer: inventoryFile.buffer,
          },
          {
            path: `public/assets/${expectedCatalogFilename}`,
            contentBuffer: catalogFile.buffer,
          },
        ];

        const commitMessage = `Automated update of Excel files by ${
          req.user.email || req.user.uid
        }`;

        // Get the SHA of the latest commit on the main branch
        const { data: refData } = await octokit.rest.git.getRef({
          owner: GITHUB_OWNER,
          repo: GITHUB_REPO,
          ref: "heads/main", // Or your default branch
        });
        const latestCommitSha = refData.object.sha;

        // Get the tree of the latest commit
        const { data: commitData } = await octokit.rest.git.getCommit({
          owner: GITHUB_OWNER,
          repo: GITHUB_REPO,
          commit_sha: latestCommitSha,
        });
        const baseTreeSha = commitData.tree.sha;

        // Create new blobs for each file
        const newTreeEntries = [];
        for (const file of filesToUpdate) {
          const { data: blobData } = await octokit.rest.git.createBlob({
            owner: GITHUB_OWNER,
            repo: GITHUB_REPO,
            content: file.contentBuffer.toString("base64"),
            encoding: "base64",
          });
          newTreeEntries.push({
            path: file.path,
            mode: "100644", // file mode
            type: "blob",
            sha: blobData.sha,
          });
          console.log(`Created blob for ${file.path} with SHA ${blobData.sha}`);
        }

        // Create a new tree with the new file blobs
        const { data: newTreeData } = await octokit.rest.git.createTree({
          owner: GITHUB_OWNER,
          repo: GITHUB_REPO,
          base_tree: baseTreeSha,
          tree: newTreeEntries,
        });
        console.log(`Created new tree with SHA ${newTreeData.sha}`);

        // Create a new commit
        const { data: newCommitData } = await octokit.rest.git.createCommit({
          owner: GITHUB_OWNER,
          repo: GITHUB_REPO,
          message: commitMessage,
          tree: newTreeData.sha,
          parents: [latestCommitSha], // Set the parent commit
        });
        console.log(`Created new commit with SHA ${newCommitData.sha}`);

        // Update the main branch reference to point to the new commit
        await octokit.rest.git.updateRef({
          owner: GITHUB_OWNER,
          repo: GITHUB_REPO,
          ref: "heads/main", // Or your default branch
          sha: newCommitData.sha,
        });
        console.log(`Updated ref heads/main to ${newCommitData.sha}`);

        res.status(200).json({
          message:
            "Files successfully uploaded and committed to GitHub. Site update triggered.",
        });
      } catch (error) {
        console.error("Error processing files or committing to GitHub:", error);
        if (error.status) {
          // Octokit errors often have a status
          console.error("GitHub API Error Details:", error.response?.data);
        }
        res.status(500).json({
          message: "Failed to update files on GitHub.",
          error: error.message,
        });
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
