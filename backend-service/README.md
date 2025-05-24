# Maquilinventario Backend Service

This service handles secure, role-based file uploads for the Maquilinventario application. It receives Excel files from authenticated users, validates them, and then uses the GitHub API (via a GitHub App) to update the files in the `public/assets` directory of the main project's GitHub repository. This triggers an existing GitHub Action to rebuild and redeploy the site to Firebase Hosting.

## Prerequisites

- Docker
- Docker Compose
- Node.js (for `npm install` if you need to modify dependencies, otherwise Docker handles it)
- A GitHub App configured with necessary permissions and installed on your repository.
- Firebase Admin SDK service account key (JSON file).
- The main Maquilinventario frontend application set up and configured.

## Setup and Configuration

1.  **Navigate to the Backend Service Directory:**

    ```bash
    cd backend-service
    ```

2.  **Firebase Service Account Key:**

    - Download your Firebase Admin SDK service account key JSON file from your Firebase project settings (Project settings > Service accounts > Generate new private key).
    - Place this JSON file in the `backend-service` directory and name it `firebase-service-account-key.json`. This path is referenced in the `docker-compose.example.yml`.

3.  **GitHub App Setup:**

    To allow the backend service to securely interact with your GitHub repository, you need to create and configure a GitHub App:

    a. **Create a New GitHub App:**

    - Go to your GitHub account settings > Developer settings > GitHub Apps > New GitHub App.

    - **GitHub App name:** Choose a descriptive name (e.g., "Maquilinventario Backend Bot").
    - **Homepage URL:** Can be your repository URL or any valid URL.
    - **Webhook:** You can leave this inactive for this service's current functionality.
    - **Repository permissions:** This is crucial. Grant the following permissions:
      - **Contents:** `Read & write` (to update files in `public/assets` and to read repository contents if needed for other operations by `splitExcel-bot.min.js`). -
        **Actions:** `Read & write` (to trigger workflows like `build-bot.yml`).
      - **Secrets:** `Read & write` (if `splitExcel-bot.min.js` is managing secrets directly, otherwise this might not be strictly needed by the backend service itself if secrets are pre-configured). - Review if `splitExcel-bot.min.js` requires any other specific permissions.
      - **User permissions:** No user permissions are typically needed for this service.
      - **Where can this GitHub App be installed?** Choose "Only on this account" or your organization.

    b. **Generate a Private Key:** - After creating the app, on the app's settings page, scroll down to "Private keys" and click "Generate a private key". - This will download a `.pem` file. **Treat this file like a password; it's highly sensitive.**

    c. **Install the App on Your Repository:** - Go to your GitHub App's settings page. - Click "Install App" from the sidebar. - Select the account or organization where your Maquilinventario repository resides. - Choose to install it on "All repositories" or "Only select repositories" (recommended: select only your Maquilinventario repository). - After installation, you'll be redirected. Note the **Installation ID** from the URL (e.g., `github.com/settings/installations/YOUR_INSTALLATION_ID`) or find it on the installation settings page.

    d. **Collect App Credentials:** - **App ID:** Found on your GitHub App's general settings page. - **Installation ID:** Obtained when you installed the app on your repository. - **Private Key:** The content of the `.pem` file you downloaded.

4.  **Configure Environment Variables:**

    - The backend service is configured using environment variables defined in the `docker-compose.yml` file.
    - Make a copy of `docker-compose.example.yml`, rename the copy to `docker-compose.yml` and update the `environment` section for the `backend` service with your specific values:
      - `PORT`: The port the backend service will run on inside the container (e.g., `1111`).
      - `GITHUB_APP_ID`: The App ID of your GitHub App.
      - `GITHUB_APP_PRIVATE_KEY_PATH`: Set this to `/usr/src/app/your-app-private-key.pem`. You will need to mount your downloaded `.pem` file to this path in the container via `docker-compose.yml` (see step below).
      - `GITHUB_APP_INSTALLATION_ID`: The Installation ID for your app on the target repository.
      - `GITHUB_OWNER`: Your GitHub username or the organization name that owns the repository.
      - `GITHUB_REPO`: The name of your Maquilinventario GitHub repository (e.g., `maquilinventario`).
      - `FIREBASE_SERVICE_ACCOUNT_PATH`: This should generally be left as `/usr/src/app/firebase-service-account-key.json` as the `docker-compose.yml` mounts your local key file to this path inside the container.
      - `FIREBASE_PROJECT_ID`: Your Firebase Project ID. This is crucial for verifying Firebase ID tokens.
      - `FRONTEND_ORIGIN`: The URL of your deployed Maquilinventario frontend application (e.g., `https://your-project-name.web.app`). This is used for CORS configuration.

5.  **Mount GitHub App Private Key in Docker Compose:**

    - Rename the downloaded `.pem` file (e.g., to `your-app-name.private-key.pem` or a generic `github-app-private-key.pem`) and place it in the `backend-service` directory.
    - Update the `volumes` section in your `docker-compose.yml` for the `backend` service to mount this key:
      ```yaml
      services:
        backend:
          # ... other configurations ...
          volumes:
            - ./firebase-service-account-key.json:/usr/src/app/firebase-service-account-key.json:ro
            - ./your-app-name.private-key.pem:/usr/src/app/your-app-private-key.pem:ro # Add this line
          environment:
            # ... other environment variables ...
            GITHUB_APP_PRIVATE_KEY_PATH: /usr/src/app/your-app-name.private-key.pem
            # ...
      ```
    - **Note:** Alternatively, instead of `GITHUB_APP_PRIVATE_KEY_PATH`, you can set `GITHUB_APP_PRIVATE_KEY` directly in the environment variables with the _content_ of the PEM file (ensure newlines are correctly formatted, e.g., `\\n`), but using the path and mounting the file is generally cleaner and more secure. The `server.js` file is already configured to prioritize the `_PATH` variable.

6.  **Install Dependencies (Optional - if modifying `package.json`):**
    If you change dependencies in `package.json`, you might want to update `node_modules` locally or ensure Docker rebuilds correctly. Docker will handle `npm install` during the image build based on `package.json`.

    ```bash
    npm install
    # or
    # bun install
    ```

7.  **Build and Run with Docker Compose:**
    From the `backend-service` directory:
    ```bash
    docker-compose up --build
    ```
    To run in detached mode (in the background):
    ```bash
    docker-compose up -d --build
    ```

## API Endpoint

The service exposes the following endpoint:

- `POST /api/update-excel-files`: Accepts `multipart/form-data` with `inventoryFile` and `catalogFile`. Requires a Firebase ID token in the `Authorization: Bearer <token>` header from an authenticated user with 'admin' or 'upload' roles.

## Frontend Configuration

Ensure the `VITE_DOCKER_SERVER_ENDPOINT` environment variable in the main frontend application's `.env` file points to the URL where this backend service is accessible (e.g., `http://localhost:1111` if you mapped host port 1111 to the container's port and are running it locally).
