# Audio drop-in folder

Optional real audio files. The game synthesizes placeholders if a file is missing.

**Important:** the runtime does **not** probe missing files (avoids 404 spam).
When you add a real file, also list its stem in `PRESENT_AUDIO_STEMS` inside `js/audio.js`.

Supported names (any of `.ogg` / `.mp3` / `.wav`):

| File | Cue |
|------|-----|
| `bgm.*` | Generic stage loop BGM |
| `bgm_1.*` / `bgm_city.*` | Act 1 — city |
| `bgm_2.*` / `bgm_hive.*` | Act 2 — hive |
| `bgm_3.*` / `bgm_nest.*` | Act 3 — nest |
| `bgm_4.*` / `bgm_airfield.*` | Act 4 — airfield |
| `bgm_5.*` / `bgm_abyss.*` | Act 5 — abyss |
| `shoot.*` | Player shot |
| `enemy_hit.*` | Enemy damaged |
| `enemy_death.*` | Enemy destroyed |
| `player_hit.*` | Player bullet hit |
| `player_death.*` | Player lost a life |
| `bomb.*` | Bomb (X) |
| `special.*` | Special (C) |
| `pickup_p.*` | Power item |
| `pickup_b.*` | Bomb item |
| `power_down.*` | Body-contact power down |
| `charge.*` | Charge shot release |
| `charge_hold.*` | Charge hold loop (optional; procedural drone used if missing) |
| `deny.*` | Empty bomb / empty special |
| `warning.*` | Boss / midboss warning |
| `graze.*` | Graze |
| `cue.*` | Wave cue |
| `clear.*` | Stage clear |
| `phase.*` | Boss / midboss phase change |
| `fanfare.*` | Rare character reveal |

Volume / mute are controlled in OPTIONS (and `M` mute). Procedural BGM motifs change per stage scene when no file is present.
