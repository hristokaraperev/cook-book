# Google Cloud Setup Guide

This app uses three Google APIs. You need a Google Cloud project with OAuth2 credentials configured.
The whole setup takes about 10 minutes.

---

## 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **Select a project** → **New Project**
3. Name it `My Cookbook` → click **Create**
4. Make sure the new project is selected in the top bar

---

## 2. Enable the Required APIs

In the Cloud Console, go to **APIs & Services → Library** and enable all four:

| API | What it's used for |
|-----|-------------------|
| **Google Drive API** | Saving recipes as Google Docs in your Drive |
| **Google Docs API** | Formatting recipe documents |
| **Gmail API** | Sending recipes via email |
| **People API** | Reading your Google Contacts for the recipient picker |

Search each one by name, click it, then click **Enable**.

---

## 3. Configure the OAuth Consent Screen

1. Go to **APIs & Services → OAuth consent screen**
2. Choose **External** → **Create**
3. Fill in:
   - **App name**: My Cookbook
   - **User support email**: your email
   - **Developer contact**: your email
4. Click **Save and Continue**
5. On the **Scopes** step, click **Add or Remove Scopes** and add:
   - `https://www.googleapis.com/auth/drive.file`
   - `https://www.googleapis.com/auth/documents`
   - `https://www.googleapis.com/auth/gmail.send`
   - `https://www.googleapis.com/auth/contacts.readonly`
   - `openid`, `email`, `profile`
6. Click **Save and Continue**
7. On **Test users**, add your own Google account email
8. Click **Save and Continue** → **Back to Dashboard**

> **Note:** While the app is in "Testing" mode, only the test users you add can sign in.
> To open it to anyone, submit for verification (optional for personal use).

---

## 4. Create OAuth2 Credentials

1. Go to **APIs & Services → Credentials**
2. Click **Create Credentials → OAuth client ID**
3. Choose **Web application**
4. Set the name to `My Cookbook`
5. Under **Authorised JavaScript origins**, add:
   - `http://localhost:5173` (for local development)
   - Your production domain (e.g. `https://my-cookbook.netlify.app`) if deploying
6. Click **Create**
7. Copy the **Client ID** (looks like `123456789-abc.apps.googleusercontent.com`)

---

## 5. Configure the App

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Edit `.env.local` and paste your Client ID:
   ```
   VITE_GOOGLE_CLIENT_ID=123456789-abc.apps.googleusercontent.com
   ```

3. (Optional) Get a free USDA API key at https://fdc.nal.usda.gov/api-key-signup.html
   and add it too:
   ```
   VITE_USDA_API_KEY=your-usda-key
   ```
   Without this, the app uses `DEMO_KEY` which has very limited rate limits.

---

## 6. Run the App

```bash
npm install
npm run dev
```

Open http://localhost:5173 and click **Sign in with Google**.

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `redirect_uri_mismatch` | Add `http://localhost:5173` to Authorised JS origins |
| `access_denied` | Make sure your Google account is added as a test user |
| `invalid_client` | Double-check the Client ID in `.env.local` |
| USDA search returns nothing | The `DEMO_KEY` is rate-limited; get a free key |
| Contacts list is empty | You may not have saved contacts — try adding a contact in Google Contacts first |
