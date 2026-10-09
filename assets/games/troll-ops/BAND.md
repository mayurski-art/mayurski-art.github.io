# Troll City band: guitar, trumpet, sheet music, songs in sync

Approved 2026-10-09. Socialize, Troll City's saloon stage. Builds on the playable piano (`piano-sheets.js`, `menu/piano-panel.js`, `rp-roles.js` `PianoVoice`, `modes/social-rp.js` `piano`) and the room clock (`modes/room-clock.js`).

## What the user asked
Guitar and trumpet beside the piano; real sheet music (notes on a staff, scores); songs that sync across the three; Basic / Intermediate / Expert pieces for each instrument; The Star-Spangled Banner; Latin songs; ten from their Spotify links.

**Public domain only.** Havana (Camila Cabello) and Fuerza Regida's songs are copyrighted, so they're out, simplified or not. In their place: public-domain Latin standards plus two originals in those styles. From the Spotify playlist, only the public-domain classics.

## Decisions
1. **Stage.** A guitar on a stand at stage west (≈ −14.7, −19.4) and a trumpet on a stand at stage east (≈ −11.6, −19.4). NPCs **Six-String Cisco** and **Trumpet Tex** play them and yield to a player (like Piano Pete).
2. **Taking one.** Hold X at the stand: role `guitarist` (`rr:"g"`) or `trumpeter` (`rr:"t"`); the instrument goes on your rig and you can walk off with it. Put it back the same way. One of each; the older peer wins.
3. **One panel** for all three (`menu/instrument-panel.js`, grown from `PianoPanel`):
   - Piano: today's keys.
   - Trumpet: the same letter → note map, one note at a time, hold to sustain, keys labelled with valve fingerings.
   - Guitar: chord strip on 1-8 (strum down, Shift = up) plus picked melody notes on the letter rows.
4. **Notation** (`notation.js`, string-built SVG): staff, treble and bass clefs, key and time signatures, noteheads, stems, flags, beams, dots, ties, rests, accidentals, ledger lines. Piano uses a grand staff. Guitar gets chord symbols; Basic trumpet gets fingerings. Four bars a system; the cursor marks the next note, and a playhead moves during a band song.
5. **Sync.** Every song has three parts over the same bars. **Band** sends `{k:"band", e:"start", s, at}`; the leader's state packet carries `bs` and `ba`, so late joiners catch up. Every part plays on the room clock from `at`: by the player holding that instrument (live, or Auto), else by the NPC.
6. **Live notes keep their beat:** `{k:"nt", i, n|c, b}`. Listeners play the band 0.4 s behind room time, so a live note that arrives in time lands on its beat. A musician hears their own notes instantly.
7. **Play-along.** During a band song, each hit is judged against the beat (±120 ms on time, ±250 ms early or late) and the panel shows "Bravo: n / m on time". Otherwise today's free-paced mode stays.
8. **Sound, all synthesised** (no files): guitar is Karplus-Strong (buffers built once), trumpet is detuned saws through an envelope-following lowpass with vibrato, piano is today's `PianoVoice`. All live in `instrument-voices.js`.
9. **Library** (`songs.js`): each part has its own level. About 49 songs:
   - **Kept:** today's 9 sheets and the 3 house tunes.
   - **Anthem:** The Star-Spangled Banner.
   - **Latin:** La Paloma, Cielito Lindo, La Cucaracha, Las Mañanitas, La Adelita, El Jarabe Tapatío, La Llorona, La Bamba (trad.), Amapola, Malagueña.
   - **Originals in the asked-for styles:** *Habanera del Trollface*, *Corrido del Grin*.
   - **Trumpet:** Taps, Reveille, When the Saints, Amazing Grace, Carnival of Venice, Flight of the Bumblebee.
   - **Guitar:** Red River Valley, Clementine, House of the Rising Sun, Greensleeves, Romance Anónimo.
   - **Piano:** Minuet in G, Moonlight Sonata, Maple Leaf Rag.
   - **From the user's links:** Wabash Blues, Silent Night, Gymnopédie 1, Gnossienne 1, Bach Prelude in C, Chopin Prelude E minor, Schubert Serenade, Clair de Lune, Chopin Nocturne Op. 9 No. 2, Rondo alla Turca, Liebestraum 3.

   A startup check validates every part: each bar adds up, every note is in range, every chord is known.
10. The piano's blank sheet-music plank shows the open sheet (a canvas texture). Done last, and optional.

## Build order (four commits, one gate, one push; tag suffix `bd1`)
1. Notation and the song model: `songs.js`, `notation.js`, the panel shows real scores, Hear it is local only. Test: `troll-ops-notation-test.mjs`.
2. The instruments: models, stands, NPCs, roles, poses (3P via `localPosers`, FP via `bandArms`), voices, panel strips.
3. The band: sync, beat-stamped live notes, play-along. Test: `troll-ops-band-test.mjs`.
4. The library.

## Rules
- Nothing new in game.js.
- Never import a job module from `menu/buttons.js` or `view/third-person.js` (the social-rp import loop).
- Never `sed -i` over `*.js`.
- `rp-test`, `duel-test`, `sheriff-test`, `conductor-test` and `train-test` must stay green.
