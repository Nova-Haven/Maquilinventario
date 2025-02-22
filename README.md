# Maquilinventario

Project to see the inventory on an Excel file exported from a specific accounting software, behind a login from Firebase Auth.

This is more specifically a web UI for a Firebase authentication to view a Excel specifically formatted file on the `public/data` folder.

There's a specific format that the Excel file must have to work, so unless you change the specific formatting on `src/js/excel.js` or use the correct format on the Inventario file, any other file won't work.

### Developer (Do first!)

1. Set your desired Excel file in the public/data folder
2. Make a new `.env` file with the required values of `.env.example`
3. Run `bun install`/`yarn install`/`npm install`
4. Run `firebase emulators:start`
5. Go to http://localhost:4000/auth and add a new entry
6. Run `npx vite dev`
7. Start developing and see your changes on http://localhost:5173

### Ready to export?

1. Run `npx vite build`
2. The output will be on the `dist` file, so do `firebase deploy` (if available) or do whatever you want with it!

### Auto-build in GitHub Actions in your own repo

1. Set all your secrets in the repository secrets settings on your github repo:

```
VITE_EXCEL_FILE
VITE_FIREBASE_API_KEY
VITE_FIREBASE_APP_ID
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
```

2. Run `firebase init hosting:github`
3. Follow the prompts, entering your username/organization name (ensure it's authorized), and keep note of the service account name, it should show up as:

```
✔  Uploaded service account JSON to GitHub as secret FIREBASE_SERVICE_ACCOUNT_PROJECT_NAME.
```

4. Any time a new workflow is suggested, just reply with "N" or "n", depending on what shows up (should be `N` and then `n`)
5. With your service account name in hand, go to the `.github/workflows` folder and open both of the `.yml` files in there
6. Replace `${{ secrets.FIREBASE_SERVICE_ACCOUNT_TESTING_MAQUILA }}` with your service account name you got on step 3, resulting in `${{ secrets.FIREBASE_SERVICE_ACCOUNT_PROJECT_NAME }}`
