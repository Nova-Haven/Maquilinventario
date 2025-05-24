const admin = require("firebase-admin");
const path = require("path");

// --- Configuration ---
// Adjust the path to your service account key file as needed
const serviceAccountPath = path.resolve(
  __dirname,
  "firebase-service-account-key.json"
);
// --- End Configuration ---

try {
  const serviceAccount = require(serviceAccountPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
} catch (error) {
  console.error("Error initializing Firebase Admin SDK:");
  console.error(
    "Please ensure your service account key is correctly placed at:",
    serviceAccountPath
  );
  console.error(error.message);
  process.exit(1);
}

const [uid, rolesString] = process.argv.slice(2);

if (!uid || !rolesString) {
  console.error("Usage: node addRoles.js <uid> <role1,role2,...>");
  process.exit(1);
}

// Clean and prepare the roles string
const cleanedRoles = rolesString
  .split(",")
  .map((role) => role.trim())
  .filter((role) => role.length > 0);

if (cleanedRoles.length === 0) {
  console.error("No valid roles provided. Please provide at least one role.");
  process.exit(1);
}

// Get the current claims
admin
  .auth()
  .getUser(uid)
  .then((userRecord) => {
    const currentClaims = userRecord.customClaims || {};
    const existingRoles = currentClaims.roles
      ? currentClaims.roles.split(",")
      : [];

    console.log(
      `Updating roles for UID ${uid}: existing roles [${existingRoles.join(
        ","
      )}] = new roles [${cleanedRoles.join(",")}]`
    );

    // Update the custom claims with the merged roles
    return admin
      .auth()
      .setCustomUserClaims(uid, { roles: cleanedRoles.join(",") });
  })
  .catch((error) => {
    console.error(`Error fetching user data for UID ${uid}:`, error);
    process.exit(1);
  });
