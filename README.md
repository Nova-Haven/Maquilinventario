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

1. Place your Excel file in the `public/assets` directory (for initial setup or non-admin users). Administrators can upload and manage these files directly within the application.
2. Ensure it follows the required format:

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

**Note on Backend Service:** For file upload functionality by admin/upload users, a separate backend service is required. This service runs in Docker. See the `backend-service/README.md` for setup instructions. Ensure the `VITE_DOCKER_SERVER_ENDPOINT` in your main `.env` file points to where this service is running (e.g., `http://localhost:PORT` where `PORT` is the host port mapped in `backend-service/docker-compose.yml`), unless using a reverse proxy.

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

### Auto-build in GitHub Actions Setup

> **Note**: This setup handles Excel files up to 256 KB. For larger files, see the [Advanced Configuration](#advanced-configuration) section.

#### Prerequisites

- A GitHub repository for your project
- Firebase project already set up
- Excel files ready to be used

#### 1. Set up GitHub Repository Secrets

Go to your repository's **Settings** > **Secrets and variables** > **Actions** and add the following secrets:

```plaintext
VITE_INVENTORY_FILE=your_excel_inventory_filename.xlsx
VITE_CATALOG_FILE=your_excel_catalog_filename.xls
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_RFC=company_rfc
VITE_IMMEX=company_immex
VITE_FINANCIAL_ADDR='company address'
```

#### 2. Create GitHub Personal Access Token (Fine-grained token)

1. Visit [Personal Access Tokens/Fine-grained tokens](https://github.com/settings/personal-access-tokens/new)
2. Set up the token:
   - Name: `Maquilinventario Deploy`
   - Expiration: Choose based on your needs
   - Repository access: Select your repository
   - Permissions:
     - Repository permissions:
       - ✓ Metadata: Read-only
       - ✓ Secrets: Read and write
3. Click "Generate token"
4. Copy the generated token

#### 3. Configure Local Environment

1. Create a `.env` file in your project root:

```plaintext
GITHUB_TOKEN=your_copied_token
GITHUB_OWNER=your_github_username
GITHUB_REPO=your_repo_name
VITE_INVENTORY_FILE=your_excel_inventory_filename.xlsx
VITE_CATALOG_FILE=your_excel_catalog_filename.xls
```

#### 4. Set up Firebase GitHub Integration

1. Run the Firebase GitHub setup:

```bash
firebase init hosting:github
```

2. During the setup:
   - Select your GitHub username/organization
   - Authorize Firebase if prompted
   - **Important**: Note the service account name displayed:
   ```plaintext
   ✔ Uploaded service account JSON to GitHub as secret FIREBASE_SERVICE_ACCOUNT_PROJECT_NAME
   ```
   - When asked about new workflows, respond with:
     - First prompt: `N`
     - Second prompt: `n`

#### 5. Update Workflow Files

1. Navigate to `.github/workflows/`
2. Update both `build.yml` and `firebase-hosting-pull-request.yml`:
   - Replace:
   ```yaml
   ${{ secrets.FIREBASE_SERVICE_ACCOUNT_TESTING_MAQUILA }}
   ```
   - With your service account name from step 4:
   ```yaml
   ${{ secrets.FIREBASE_SERVICE_ACCOUNT_PROJECT_NAME }}
   ```

#### 6. Test the Setup

1. Split the Excel file into chunks:

```bash
bun run split-excel  # or npm/yarn
```

2. Check your repository's Actions tab to ensure workflows are running correctly

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

#### Advanced Configuration

To handle Excel files larger than 256 KB:

1. Modify `scripts/splitExcel.js`:

```javascript
const NUM_CHUNKS = 8; // Increase number of chunks
```

2. Update workflow files in `.github/workflows/` to match the new number of chunks
3. Test thoroughly before deploying

#### Troubleshooting

- If chunks fail to upload, check the size of your Excel file and adjust chunks accordingly
- Ensure all secrets are properly set in GitHub repository settings
- Verify the Firebase service account name matches exactly in workflow files
