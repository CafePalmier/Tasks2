# Cafe Palmier Tasks

## Shared Supabase setup

1. In Supabase, open **SQL Editor** and run [supabase/schema.sql](./supabase/schema.sql).
2. Deploy this project normally, including `public/supabase-config.js`.
3. Open the updated task board on the iPad first. Its current browser-local tasks and Today/Tomorrow lists will seed the shared database if it is empty.

The same SQL also creates the shared Tutorials table and public video bucket. After deploying this version, open the Tutorials page once on the device that contains any previously uploaded browser-local videos; they will be moved into shared storage automatically and will then appear on every device.

The project deliberately uses the Supabase publishable key and public database policies because this is a no-login shared board. Never add a Supabase secret key to this repository.

## Local data versus shared data

Tutorials always use the shared Supabase video library, including on `localhost`. Task pages intentionally use the local Node task store on `localhost`, so production task edits will not appear there and local testing cannot accidentally change the live board. Use the deployed site when you need to inspect the current shared task data.

## Home-screen app and favourite icon

The site includes a web app manifest, Apple touch icon, favicon, and service worker. Once deployed over HTTPS, use **Add to Home Screen** or **Install app** in the browser menu. The supplied Cafe Palmier icon will be used for the installed app and browser favourite.
