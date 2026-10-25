Troll Forces radio tracks, one mp3 per song, named after the song
(`griddle.mp3`, `hold-that-heat.mp3`).

To add a song, download the mp3 and run:

    node tools/troll-ops-add-song.mjs

It takes the newest mp3 in Downloads (or pass a path), reads the title and
artist from its tags, copies it here, adds it to `../sound/music.js`, builds
its beat grid, bumps the cache tags, writes the HANDOFF line and plays it in
the real page. `--title`, `--artist`, `--slug` override; `--dry` just shows
what it would do. Then commit and push.
