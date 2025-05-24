# Maquilinventario

A web application that displays inventory and product catalog data from exports of a specific accounting software, resulting in specially formatted Excel files, secured behind Firebase Authentication.

## Features

- 🔒 Secure authentication with Firebase
- 🔑 Role-based access control with in-app Excel file management for administrators
- 📊 Excel file visualization for inventory and product catalog
- 🔄 Toggle between inventory and catalog views
- 💾 PDF export capabilities for both data types
- 🚀 Vite-powered development
- 🔥 Firebase hosting integration
- 🤖 GitHub Actions automation

## Prerequisites

- Node.js 20.x or higher
- Firebase CLI (`npm install -g firebase-tools`)
- Bun (recommended) or npm/yarn
- Firebase project
- Excel files in the required format (inventory and catalog)
- Docker and Docker Compose (for running the backend file upload service)

## Quick Start

### 1. Project Setup

1. Clone the repository:

```bash
git clone https://github.com/Nova-Haven/maquilinventario.git
cd maquilinventario
```

2. Create environment file from template:

```bash
cp .env.example .env
```

3. Update `.env` with your Firebase configuration:

```plaintext
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_INVENTORY_FILE=your_excel_inventory_filename.xlsx
VITE_CATALOG_FILE=your_excel_catalog_filename.xls
VITE_RFC=company_rfc
VITE_IMMEX=company_immex
VITE_FINANCIAL_ADDR='company address'
```

### 2. Excel File Setup

This application manages Excel files for inventory and catalog data. There are two primary ways to handle these files:

1.  **Initial Setup / Manual Placement:**

    - Place your Excel files (e.g., `your_excel_inventory_filename.xlsx`, `your_excel_catalog_filename.xls`) directly into the `public/assets` directory. This method is suitable for initial project setup or if the backend service for dynamic uploads is not configured.
    - Ensure your `.env` file's `VITE_INVENTORY_FILE` and `VITE_CATALOG_FILE` variables correctly point to these filenames.

2.  **Administrator In-App Uploads (Recommended for ongoing management):**
    - Administrators can upload and manage Excel files directly within the application. This functionality relies on a separate **backend service**.
    - This backend service receives files from authenticated admins, validates them, and updates them in the `public/assets` directory of the GitHub repository. This, in turn, triggers an automated rebuild and deployment of the frontend application via GitHub Actions.
    - For detailed setup instructions for this backend service, refer to the `backend-service/README.md` file. The setup of this service is crucial for the admin file upload feature.

Ensure your files follow the required format:

#### Inventory Excel Format

```plaintext
Column structure:
- Column B: Item Code
- Column C: Name
- Column D: Cost Method
- Column E: (Intentionally empty)
... (see src/js/excel.js for full specification)
```

#### Product Catalog Excel Format

```plaintext
Format:
- Headers in row 3
- Data starts from row 4
- Column A: Product Code
- Column B: Product Name
- Column C: Price
- Column D: Fraction
- Column E: Description
- Column F: Fraction (alternate)
- Column G: Observations
```

### 3. Development Environment

1. Install dependencies:

```bash
# Using Bun (recommended)
bun install

# Using npm
npm install

# Using yarn
yarn install
```

2. Start Firebase emulators:

```bash
firebase emulators:start
```

3. Create a test user:

- Navigate to http://localhost:4000/auth
- Click "Add User"
- Enter email and password
- Save the credentials for testing

4. Start development server:

```bash
# Using Bun
bun run dev

# Using npm
npm run dev

# Using yarn
yarn dev
```

**Note on Backend Service:** For file upload functionality by admin/upload users, a separate backend service is required. This service runs in Docker. See the `backend-service/README.md` for detailed setup instructions. Ensure the `VITE_DOCKER_SERVER_ENDPOINT` in your main `.env` file points to where this service is running (e.g., `http://localhost:PORT` where `PORT` is the host port mapped in `backend-service/docker-compose.yml`), unless using a reverse proxy.

### 5. Access the application:

- Open http://localhost:5173
- Log in with your test credentials
- Verify the Excel data is displayed correctly
- Use the navigation tabs to toggle between Inventory and Catalog views

### 4. Building for Production

1. Build the application:

```bash
# Using Bun
bun run build

# Using npm
npm run build

# Using yarn
yarn build
```

2. Deploy to Firebase (if configured):

```bash
firebase deploy
```

The built files will be in the `dist` directory, ready for deployment to any static hosting service.

## Project Structure

```plaintext
maquilinventario/
├── .github/workflows/    # GitHub Actions workflows
├── backend-service/      # Dockerized backend for file uploads
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── package.json
│   ├── server.js
│   └── README.md         # Instructions for the backend service
├── public/              # Static assets
│   └── assets/          # Excel files
├── scripts/            # Utility scripts
├── src/                # Source code
│   ├── js/            # JavaScript modules
│   │   └── excel.js   # Excel parsing and display logic
├── .env.example        # Environment template
└── firebase.json       # Firebase configuration
```

## Automated Deployments with GitHub Actions

This project is configured for automated builds and deployments to Firebase Hosting using GitHub Actions. Workflows are triggered whenever changes are pushed to the main branch of the repository. This includes code updates or Excel file updates in the `public/assets` directory (e.g., by the [backend service](backend-service/README.md) or manual commits).

### 1. Firebase GitHub Integration Setup

This is the core setup for enabling CI/CD with Firebase Hosting.

1.  **Run the Firebase GitHub setup command** in your project root:
    ```bash
    firebase init hosting:github
    ```
2.  **Follow the prompts:**

    - Select your GitHub username/organization.
    - Authorize Firebase if prompted.
    - **Important**: Note the service account name displayed (e.g., `FIREBASE_SERVICE_ACCOUNT_YOUR_PROJECT_NAME`). This will be created as a secret in your GitHub repository.
    - When asked about generating new workflow files:
      - If you already have `.github/workflows/build.yml` and `.github/workflows/firebase-hosting-pull-request.yml` (or similar) from this project template, you might choose `N` to avoid overwriting them. Ensure they are correctly configured as per the template's requirements. Otherwise, let Firebase generate them and adapt as needed.

3.  **Configure Repository Secrets for Firebase:**
    Ensure the following secrets are set in your repository's **Settings > Secrets and variables > Actions**:

    - `FIREBASE_SERVICE_ACCOUNT_YOUR_PROJECT_NAME`: (This should have been created by `firebase init hosting:github`). Verify its name matches what the workflow files expect (e.g., `${{ secrets.FIREBASE_SERVICE_ACCOUNT_PROJECT_NAME }}` as used in the template workflows).
    - The various `VITE_FIREBASE_*` API keys and configuration values, `VITE_RFC`, `VITE_IMMEX`, and `VITE_FINANCIAL_ADDR` should also be set as secrets if they are not intended to be hardcoded or if your workflows need them during build.

4.  **Review and Update Workflow Files (if necessary):**
    - Navigate to `.github/workflows/`.
    - Ensure your workflow files (e.g., `build.yml`, `firebase-hosting-pull-request.yml`) correctly reference the Firebase service account secret and other necessary configurations. Example snippet for deployment:
      ```yaml
      # Example from a workflow file:
      # - uses: FirebaseExtended/action-hosting-deploy@v0
      #   with:
      #     repoToken: '${{ secrets.GITHUB_TOKEN }}'
      #     firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT_PROJECT_NAME }}' # Ensure this matches your secret name
      #     channelId: live
      #     projectId: your_project_id # Make sure this is your Firebase Project ID
      ```

### 2. Optional: Managing Excel Files via GitHub Secrets (using `scripts/splitExcel.js`)

If your Excel files are very large (e.g., >256KB, which can be problematic for direct commits or single GitHub secrets) or if you prefer to manage their content via GitHub secrets rather than committing them directly to `public/assets`, this project includes a script (`scripts/splitExcel.js`). This script chunks the files and stores their content as multiple GitHub secrets. The GitHub Actions workflow would then need to be adapted to reassemble these files during the build process.

> **Note**: This method is used for security reasons, as Excel files are not committed directly to version history. Instead, they are split into chunks (currently defaulting to **8 chunks**) and stored as GitHub secrets. These chunks are then reassembled during the build process by the GitHub Actions workflow. This approach also helps manage large files (e.g., >256KB) that might be problematic for direct commits or single GitHub secrets. If files in `public/assets` are updated through other means (e.g., manual commit or the [backend service](backend-service/README.md)), the general CI/CD setup (Part 1 above) will trigger a rebuild. Using `splitExcel.js` and managing files as chunked secrets requires specific workflow steps for reconstruction.

#### a. Prerequisites for `splitExcel.js`

- Your Excel files (inventory and catalog) ready locally.
- The general repository secrets (Firebase keys, app config like `VITE_RFC`, etc.) should already be configured as per Part 1.

#### b. Create GitHub Personal Access Token (Fine-grained token) for `splitExcel.js`

This token is used by the `splitExcel.js` script to write the chunked file content as secrets to your GitHub repository.

1.  Visit [GitHub Personal Access Tokens (Fine-grained tokens)](https://github.com/settings/personal-access-tokens/new).
2.  Set up the token:
    - **Token name:** `Maquilinventario Excel Splitter` (or similar).
    - **Expiration:** Choose based on your security policy.
    - **Repository access:** Select "Only select repositories" and choose your Maquilinventario repository.
    - **Permissions:** Under "Repository permissions," grant:
      - **Secrets:** `Read and write`.
3.  Click "Generate token" and copy the generated token.

#### c. Configure Local Environment for `splitExcel.js`

1.  Create or update your local `.env` file in the project root with the following:
    ```plaintext
    GITHUB_TOKEN=your_copied_pat_for_splitExcel
    GITHUB_OWNER=your_github_username_or_organization
    GITHUB_REPO=your_maquilinventario_repo_name
    VITE_INVENTORY_FILE=path/to/your/local/inventory_filename.xlsx
    VITE_CATALOG_FILE=path/to/your/local/catalog_filename.xls
    ```
    - Ensure `VITE_INVENTORY_FILE` and `VITE_CATALOG_FILE` point to the actual Excel files on your local system that you want to split and upload as secrets.

#### d. Run the `splitExcel.js` Script

1.  From your project root, run the script to split the Excel files and upload their content as secrets:

    ```bash
    # Using Bun
    bun run split-excel

    # Using npm
    # npm run split-excel

    # Using yarn
    # yarn split-excel
    ```

    This script will create secrets in your GitHub repository named like `EXCEL_CONTENT_CHUNK_0`, `EXCEL_CONTENT_CHUNK_1`, etc., for each file.

#### e. Adapt GitHub Workflow to Use Chunked Secrets

Your GitHub Actions workflow (e.g., `.github/workflows/build.yml`) will need additional steps _before_ the application build step to:

1.  Read these `EXCEL_CONTENT_CHUNK_X` secrets.
2.  Combine them back into the original Excel file structures.
3.  Place these reassembled files into the `public/assets/` directory, using the filenames specified by `VITE_INVENTORY_FILE` and `VITE_CATALOG_FILE` environment variables/secrets.
    _(The project's `scripts/combineChunks.js` might be used or adapted for this purpose within the workflow. Ensure the workflow provides the necessary environment variables and context for such a script.)_

#### f. Advanced Configuration for `splitExcel.js` (Chunking)

The system is currently configured to split Excel files into **8 chunks**. This number is defined in `scripts/splitExcel.js` and is critical for both the splitting and reassembly processes.

To handle very large Excel files or to adjust the chunking strategy:

1.  Modify `scripts/splitExcel.js`:
    ```javascript
    const NUM_CHUNKS = 8; // Change this value if needed
    ```
    A higher number of chunks means smaller individual secrets, which can help avoid size limits per secret.
2.  **Crucially, if you change `NUM_CHUNKS` from the default of 8 (e.g., for heavier files), you must update this value consistently in all relevant places.** This includes:
    - The `scripts/splitExcel.js` file itself.
    - Any logic in your GitHub Actions workflow (see step 2.e) responsible for reading and combining these chunks.
    - Any related scripts or configurations that depend on the number of chunks.
3.  Test thoroughly after making any changes to the chunking mechanism.

#### g. Troubleshooting `splitExcel.js`

- **Chunk Upload Failures:** If chunks fail to upload, check the total size of your Excel file. You might need to increase `NUM_CHUNKS` in `scripts/splitExcel.js`. Also, verify GitHub's limits on the number and size of secrets.
- **PAT Permissions:** Ensure the GitHub Personal Access Token (PAT) used in `GITHUB_TOKEN` has `Secrets: Read and write` permissions for the repository.
- **Environment Variables:** Double-check that `GITHUB_OWNER`, `GITHUB_REPO`, `VITE_INVENTORY_FILE`, and `VITE_CATALOG_FILE` are correctly set in your local `.env` file when running `splitExcel.js`.
- **Workflow Secret Names:** Verify that the Firebase service account secret name in your workflow files (e.g., `FIREBASE_SERVICE_ACCOUNT_PROJECT_NAME`) exactly matches the name of the secret in your GitHub repository settings.

## Using the Application

### Navigation

- Use the tabs at the top of the page to toggle between Inventory and Catalog views
- Each view provides specific functionality for that data type

### Inventory View

- Displays complete inventory data with units and amounts
- Shows error codes with tooltip explanations
- Includes totals row at the bottom

### Catalog View

- Shows product catalog information
- Displays prices, fractions, and product details
- Formatted for easy reference

### PDF Export

- Both views support PDF export functionality
- Click the "Exportar PDF" button to generate a downloadable PDF
- PDFs are formatted with proper headers and company information
