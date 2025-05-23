# Maquilinventario Backend Service

This service handles secure, role-based file uploads for the Maquilinventario application. It receives Excel files from authenticated users, validates them, and then uses the GitHub API to update the files in the `public/assets` directory of the main project's GitHub repository. This triggers an existing GitHub Action to rebuild and redeploy the site to Firebase Hosting.

## Prerequisites

- Docker
- Docker Compose
- Node.js (for `npm install` if you need to modify dependencies, otherwise Docker handles it)
- A GitHub Personal Access Token (Fine-grained token) with `repo` scope.
- Firebase Admin SDK service account key (JSON file).
- The main Maquilinventario frontend application set up and configured.

## Setup and Configuration

1.  **Navigate to the Backend Service Directory:**

    ```bash
    cd backend-service
    ```

2.  **Firebase Service Account Key:**

    - Download your Firebase Admin SDK service account key JSON file from your Firebase project settings (Project settings > Service accounts > Generate new private key).
    - Place this JSON file in the `backend-service` directory and name it `firebase-service-account-key.json`. This path is referenced in the `docker-compose.yml`.

3.  **Configure Environment Variables:**

    - The backend service is configured using environment variables defined in the `docker-compose.yml` file. You'll need to edit this file directly or create a `.env` file in the `backend-service` directory that `docker-compose.yml` can use (though the provided `docker-compose.yml` doesn't explicitly load a `.env` file, Docker Compose v1.28+ typically does).
    - Open `docker-compose.yml` and update the `environment` section for the `backend` service with your specific values:
      - `PORT`: The port the backend service will run on inside the container (e.g., `3000` or `1111` as per the current setting). The `ports` mapping in `docker-compose.yml` will expose this to your host.
      - `GITHUB_PAT`: Your GitHub Personal Access Token (Fine-grained token) with `repo` scope.
      - `GITHUB_OWNER`: Your GitHub username or the organization name that owns the repository.
      - `GITHUB_REPO`: The name of your Maquilinventario GitHub repository (e.g., `maquilinventario`).
      - `FIREBASE_SERVICE_ACCOUNT_PATH`: This should generally be left as `/usr/src/app/firebase-service-account-key.json` as the `docker-compose.yml` mounts your local key file to this path inside the container.
      - `FIREBASE_PROJECT_ID`: Your Firebase Project ID. This is crucial for verifying Firebase ID tokens.
      - `FRONTEND_ORIGIN`: The URL of your deployed Maquilinventario frontend application (e.g., `https://your-project-name.web.app`). This is used for CORS configuration.

4.  **Install Dependencies (Optional - if modifying `package.json`):**
    If you change dependencies in `package.json`, you might want to update `node_modules` locally or ensure Docker rebuilds correctly. Docker will handle `npm install` during the image build based on `package.json`.

    ```bash
    npm install
    # or
    # bun install
    ```

5.  **Build and Run with Docker Compose:**
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
