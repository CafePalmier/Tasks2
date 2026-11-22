# Shared presets — awaiting database approval

No database changes or deployment have been performed. Synchronization defaults to off in `sync-config.mjs`.

After approval, open the existing Tasks2 project (`dwcmazbsbnafgfefbogi`) in Supabase, choose SQL Editor, and run `supabase/tag-generator.sql` once. It creates only `tag_generator_library`, `tag_generator_history`, their validation/version functions, trigger and policies. The transaction seeds revision zero. Existing Tasks tables and policies are untouched.

Anonymous visitors can read the singleton library, update only its validated payload, and read version history. Preset deletion uses tombstones so bundled defaults do not reappear. Anonymous callers cannot delete history, change revisions, create extra library rows or change timestamps. Only the existing publishable key is used. No authentication, service-role key, new service, realtime publication or Supabase configuration change is required.

After the SQL has been applied, set `sharedPresetsEnabled=true` in `tag-generator/sync-config.mjs` for local acceptance testing. Do not deploy until separately authorized. Test with two browsers: edit a preset, wait up to ten seconds, and verify the second browser receives it. Then edit while offline, reconnect, and verify synchronization or the explicit conflict controls. Test Delete and Restore shared version under Manage shared presets. No active draft, saved print collection or generated PDF is rewritten by a remote update.

The first device with existing local presets uploads them only against empty revision zero; an already populated shared library produces an explicit conflict. Updates poll every ten seconds and on reconnect. A revision-filtered PATCH prevents lost concurrent writes. Conflicts pause uploads until staff choose a version; a local conflict backup retains both, and every server update archives the previous complete payload. Restore is a new versioned write, not destructive history replacement. The latest 30 revisions are listed in the UI; all versions remain in the history table. Local storage failures are reported and offline printing keeps using the existing assets and saved tags.

This deliberately simple implementation resolves conflicts at library level, not field level. It supports payloads up to 2 MB / 2,000 custom records and retains history without automatic pruning. Anonymous collaboration means any visitor can change the library within these bounds; history provides recovery, not identity attribution. Fonts and public export retain their existing restrictions.

Focused automated tests use a fake REST server. SQL must still be executed and its grants, constraints and policies smoke-tested in Supabase after approval; no live database test was run.
