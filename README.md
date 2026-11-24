# Cafe Palmier Tasks

## Shared Supabase setup

1. In Supabase, open **SQL Editor** and run [supabase/schema.sql](./supabase/schema.sql).
2. Deploy this project normally, including `public/supabase-config.js`.
3. Open the updated task board on the iPad first. Its current browser-local tasks and Today/Tomorrow lists will seed the shared database if it is empty.

The same SQL also creates the shared Tutorials table and public video bucket. After deploying this version, open the Tutorials page once on the device that contains any previously uploaded browser-local videos; they will be moved into shared storage automatically and will then appear on every device.

The project deliberately uses the Supabase publishable key and public database policies because this is a no-login shared board. Never add a Supabase secret key to this repository.

## Local data versus shared data

Tutorials always use the shared Supabase video library, including on `localhost`. Task pages intentionally use the local Node task store on `localhost`, so production task edits will not appear there and local testing cannot accidentally change the live board. Use the deployed site when you need to inspect the current shared task data.

Tutorial uploads show video length and suggest 15–45 second clips, with one action per slide. On browsers that support the required video codecs, the editor tries to compress videos over 5 MB to MP4 before upload. It uploads the smaller version when possible and keeps the original if it fits and compression is unavailable. Files that still exceed 50 MB need a shorter clip or smaller export.

Run `npm start`, then open `http://localhost:8000/index.html` for the local task board.

## Home-screen app and favourite icon

The site includes a web app manifest, Apple touch icon, favicon, and service worker. Once deployed over HTTPS, use **Add to Home Screen** or **Install app** in the browser menu. The supplied Cafe Palmier icon will be used for the installed app and browser favourite.

## Tag Generator

A browser-only tag editor is available at `tag-generator/index.html` (also served by `npm start`). See [its implementation and print notes](tag-generator/README.md) for setup, local sample PDFs, typography licensing gates and remaining print validation. Production PDF export is intentionally gated until authorized complete typography assets are supplied.
