# Cafe Palmier Tasks

## Shared Supabase setup

1. In Supabase, open **SQL Editor** and run [supabase/schema.sql](./supabase/schema.sql).
2. Deploy this project normally, including `public/supabase-config.js`.
3. Open the updated task board on the iPad first. Its current browser-local tasks and Today/Tomorrow lists will seed the shared database if it is empty.

The project deliberately uses the Supabase publishable key and public database policies because this is a no-login shared board. Never add a Supabase secret key to this repository.
