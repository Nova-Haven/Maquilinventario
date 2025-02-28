# Maquilinventario

A web application that displays inventory data from an exported from a specific accounting software resulting in a specially formatted Excel file, secured behind Firebase Authentication.

## Features

- 🔒 Secure authentication with Firebase
- 📊 Excel file visualization
- 🚀 Vite-powered development
- 🔥 Firebase hosting integration
- 🤖 GitHub Actions automation

## Prerequisites

- Node.js 20.x or higher
- Firebase CLI (`npm install -g firebase-tools`)
- Bun (recommended) or npm/yarn
- Firebase project
- Excel file in the required format

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
VITE_EXCEL_FILE=your_excel_filename.xlsx
```

### 2. Excel File Setup

1. Place your Excel file in the `public/assets` directory
2. Ensure it follows the required format:

```plaintext
Column structure:
- Column B: Item Code
- Column C: Name
- Column D: Cost Method
- Column E: (Intentionally empty)
... (see src/js/excel.js for full specification)
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

5. Access the application:

- Open http://localhost:5173
- Log in with your test credentials
- Verify the Excel data is displayed correctly

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
├── public/              # Static assets
│   └── data/           # Excel files
├── scripts/            # Utility scripts
├── src/                # Source code
│   ├── js/            # JavaScript modules
│   │   └── excel.js   # Excel parsing logic
│   └── components/    # UI components
├── .env.example        # Environment template
└── firebase.json       # Firebase configuration
```

### Auto-build in GitHub Actions Setup

> **Note**: This setup handles Excel files up to 192 KB. For larger files, see the [Advanced Configuration](#advanced-configuration) section.

#### Prerequisites

- A GitHub repository for your project
- Firebase project already set up
- Excel file ready to be used

#### 1. Set up GitHub Repository Secrets

Go to your repository's **Settings** > **Secrets and variables** > **Actions** and add the following secrets:

```plaintext
VITE_EXCEL_FILE=your_excel_filename.xlsx
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
```

#### 2. Create GitHub Personal Access Token

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
VITE_EXCEL_FILE=your_excel_filename.xlsx
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

2. Verify the chunks:

```bash
node scripts/testChunks.min.js
```

3. Check your repository's Actions tab to ensure workflows are running correctly

#### Advanced Configuration

To handle Excel files larger than 192 KB:

1. Modify `scripts/splitExcel.js`:

```javascript
const NUM_CHUNKS = 12; // Increase number of chunks
```

2. Update workflow files in `.github/workflows/` to match the new number of chunks
3. Test thoroughly before deploying

#### Troubleshooting

- If chunks fail to upload, check the size of your Excel file and adjust chunks accordingly
- Ensure all secrets are properly set in GitHub repository settings
- Verify the Firebase service account name matches exactly in workflow files`
