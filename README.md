# My Cookbook

A single-page application for creating, storing, and sharing recipes — powered by Google Drive, Gmail, and the USDA nutrition database.

## Features

- **Recipe management** — create and edit recipes with ingredients, instructions, prep/cook times, and serving sizes
- **USDA nutrition data** — search the USDA FoodData Central database to auto-calculate calories per ingredient and per serving
- **Google Drive storage** — each saved recipe creates a machine-readable Recipe Record in `Cookbook/.data` and a formatted Recipe Document in `Cookbook/Recipes`
- **Gmail sharing** — send recipes to your Google Contacts directly from the app; the email includes the full ingredient list, calorie breakdown, and a link to the formatted document
- **Contacts integration** — pick recipients from your Google Contacts using the People API

## Tech Stack

| Concern | Choice |
|---------|--------|
| Framework | React 18 + Vite |
| Router | React Router v6 |
| State | Zustand |
| UI | Material UI v5 |
| Auth | Google Identity Services (OAuth2 implicit token) |
| Storage | Google Drive API + Google Docs API |
| Nutrition | USDA FoodData Central API |
| Email | Gmail API |
| Contacts | Google People API |

## Pages

1. **Home** — recipe grid with search and category filter; landing page for unauthenticated users
2. **Recipe Detail** — full recipe view with ingredient calorie bars, instruction steps, and action buttons
3. **Create / Edit Recipe** — form with live calorie calculation and USDA ingredient autocomplete
4. **Send Recipe** — pick a recipe, choose recipients from Google Contacts, send via Gmail

## Getting Started

See **[GOOGLE_SETUP.md](./GOOGLE_SETUP.md)** for the full setup walkthrough (Google Cloud project, OAuth2, API enablement).

```bash
cp .env.example .env.local   # add VITE_GOOGLE_CLIENT_ID (and optionally VITE_USDA_API_KEY)
npm install
npm run dev
```

Open http://localhost:5173.

## Commit Messages

This repo includes a Git commit message template in `.gitmessage`. Enable it for your local clone with:

```bash
git config --local commit.template .gitmessage
```
