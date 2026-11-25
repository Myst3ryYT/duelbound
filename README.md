# Rebound

A top-down 1v1 arena fighting game for keyboard and mouse, playable in the browser.
The full design spec is in [GAME_BRIEF.md](GAME_BRIEF.md).

**Current build: steps 4 and 5 of 6 done.** Main menu, character select, training, best-of-3 vs a bot (Normal / Hard), and online 1v1 by room code or link. Next: a debug menu with fake lag, then putting it online on Cloudflare Pages.

## Running the game

You need [Node.js](https://nodejs.org) installed (any recent version).

1. Open a terminal in this folder.
2. The first time only, run `npm install`
3. Run `npm run dev`
4. Open the address it prints (normally http://localhost:5173) in your browser.

Leave `npm run dev` running while you play. Any file you save is picked up straight away.

Other commands:

- `npm run build` checks the code and builds the finished site into `dist/`
- `npm run typecheck` only checks the code for mistakes

## Playing online

1. One player clicks **Host Match**. A 5-letter room code and a link appear.
2. Send the link (or the code) to a friend. They open the link, or click **Join Match** and type the code.
3. Both pick a class and click **Ready**. The match starts when both are ready.

Good to know:

- Both players need internet access, even on the same network (a free public service introduces the two browsers; after that they talk directly).
- Some strict networks (some schools, offices, mobile hotspots) block direct connections. The game then says it could not connect. Fixing that needs a paid relay server, which this free setup doesn't have.
- The host's computer runs the real game, so the host has no delay. The guest's own side (walking, shots, abilities, cooldowns, structures) also reacts instantly: the guest's browser predicts it with the same rules and quietly corrects itself if the host disagrees. The opponent is shown about 0.08 s behind so they move smoothly. Hits and damage are always decided by the host.
- If someone drops out, the game freezes and waits 10 seconds for them to come back, then the other player wins.
- **Testing alone:** open the game in two separate browser *windows* side by side (not two tabs: a tab you aren't looking at stops drawing). Host in one, join with the code in the other.
- **Testing a bad connection:** open the dev panel (`) in one window. The **Network test** section at the top adds fake latency (0 to 200 ms), jitter and packet loss to that window, and can show a **network overlay** (ping, snapshots per second, data use) during online matches.

## Controls

| Key | Does |
| --- | --- |
| W A S D | move |
| Mouse | aim (the crosshair) |
| Tab | training: switch class |
| R | training: put the dummy back and refill its HP |
| G | training: make the dummy shoot at you (on / off) |
| F | kick: short shove + small damage, every class (cooldown in tuning.kick) |
| T | training: switch ability cooldowns on / off |
| ` (the key left of 1) | open the dev panel |
| Esc | pause menu (volume, mute, leave match). Online games keep running while it's open. |

**Mage** (taken out of the menus for now; the code is still there, set `hidden: true` to false in `mage/index.ts` to bring it back)

| Key | Does |
| --- | --- |
| Left click | Staff: hold to keep firing magic bolts |
| Right click | Reflective shield: a curved wall that drifts forward for a few seconds. Enemy shots bounce off it and become yours; you and your shots go through it. 2 stored uses. |
| C | Watchtower: shows an outline, left click to place, right click or C to cancel. While you stand in its glowing ring, your staff fires faster. |
| V | Switch: switched off for now (shown greyed out) |
| Space | Teleport to the crosshair |

**Sheriff**

| Key | Does |
| --- | --- |
| Left click | Revolver: one shot per click (click as fast as you can), 6 shots then it reloads by itself. Hits harder up close and harder on stunned targets. |
| Right click | Lasso: catches the enemy and drags them to you (flies through tumbleweeds) |
| C | Bramble: throws a tumbleweed that stops and stuns the enemy who touches it (not you), and is used up. Shoot it to knock it around. 3 stored uses. |
| V | Horse: charges off in the direction you were facing for 3 seconds (can't steer), bounces off walls, smashes structures, tramples the enemy. The horse has its own 250 HP that takes hits first. While riding, left click fires a burst of 6 bullets. |
| Space | Roll in the direction you're walking, briefly invincible |

**Refractor**

| Key | Does |
| --- | --- |
| Left click | Mind Shotgun: 4 pellets. Pellets that bounce off your own mirror double (up to 3 mirrors: 4 → 8 → 16 → 32). |
| Right click | Mind Ray: hold for a strong beam (bounces off mirrors). Uses the purple bar by the crosshair, which refills slowly. |
| C | Mirror mode on / off. In mirror mode, hold left click where a mirror starts, drag, release where it ends; place as many as you have uses (3 stored, shown as diamonds above the crosshair). Mirrors break after 8 seconds. |
| V | Shatter: breaks every mirror; enemies near a mirror take damage for each one |
| Space | Dash in the direction you're walking |

**Builder**

| Key | Does |
| --- | --- |
| Left click | Nail Gun: hold to spray fast, weak nails. 30 nails, then it reloads by itself. Nails barely push tumbleweeds and furniture. |
| Right click | Sledge Hammer: a swing in front of you. Hurts the enemy and knocks them back, wrecks enemy structures, smashes your own brick walls into a volley of bricks (they fly straight out of the wall on the crosshair's side, slowing to a stop), and flings your own furniture. |
| C | Brick wall mode on / off. Placed like mirrors (drag with left click). Lots of health, blocks everyone's shots (yours too). 2 stored uses. |
| V | Construction: builds a random piece of furniture in front of you (3 stored uses). It's heavy, movable cover: players can shove it, shots nudge it, it blocks everyone's shots until it's broken. Hit it with the hammer to fling it: 100 damage to the enemy it hits. |
| Space | Dash in the direction you're walking |

**Frog** (the green bar by the crosshair is his slime pool; it refills after a short rest)

| Key | Does |
| --- | --- |
| Left click | Tongue: a whip towards the crosshair. Damage, no knockback: the target is stuck (slowed) for a moment. |
| Right click | Belch: hold to charge, let go to fire. Longer = faster and harder, but uses more slime. |
| C | Acid Goop on / off: fast gliding that leaves a slime trail. Uses slime while on. In your own slime you walk faster. An enemy that touches slime is **marked** for 3 s: slowed, burning, and your tongue and belch hit it for 1.5x. The longer it stands in slime the worse the slow and acid get. |
| V | Swallow: opens your mouth for 0.8 s and eats enemy shots and objects (brambles, furniture, not walls or beams) in front of you. Press V again to spit them back as one glob (1.5x the damage, capped). |
| Space | Hop the way you're moving (crosshair if standing still), over structures, objects and slime, and nothing can hit you in the air. Costs a little slime. In goop mode, landing splashes a big puddle. |

Anything that belongs to your **opponent** (shots, walls, mirrors, furniture, beams) is tinted **red**.
In any placing mode (watchtower, mirrors, walls) the crosshair turns into green corner brackets.

---

## Where to change things (no programming needed)

All the files you would normally touch are in **`src/config/`**. Save the file
while the game is running and the change shows up immediately.

### Numbers: damage, speed, cooldowns, HP, ranges, durations

**File: `src/config/tuning.ts`**

Every number in the game is here, grouped by topic, with a comment on each
line saying what it does. Change the number, save, done.

Keep the layout the same: one value per line, like `moveSpeed: 420, // ...`.

**Or tweak them while playing:** press ` to open the **dev panel**. Every number
has a slider and a box, tucked into folders (click a folder to open it, e.g. builder > hammer) so you don't have to scroll. The search box finds a value by name. Changes apply instantly. Values you changed turn yellow.

- **Save to tuning.ts** writes the current values into the file for you (only works with `npm run dev`).
- **Revert to file** throws away slider changes.
- **Damage dummy / Damage me / Heal all** are test buttons.

### Round rules and the bot

Also in `src/config/tuning.ts`: the `match:` group (countdown, round clock, rounds to win) and the
`bot:` group, with separate `normal:` and `hard:` settings (reaction time, aim error, how often it dodges, how fast it moves, and so on).

### Keys

**File: `src/config/keybinds.ts`**

Each action lists the key(s) for it. Key names are explained at the top of the file
(for example `KeyC`, `Space`, `Mouse0` for left click).

### Art

**File: `src/config/assets.ts`** lists every sprite and its file name.

To use your own art, put a PNG with that file name into **`public/art/`**
(create the folder if it isn't there). For example `public/art/dummy.png`
replaces the training dummy. No code changes needed. Remove the file to go back
to the built-in placeholder. Characters should face **right** in the image.
The `size` number in `assets.ts` sets how big it appears in the game.

### Sounds

Same idea: the sound list is also in **`src/config/assets.ts`**. Put a `.wav`
with the listed file name into **`public/sfx/`** to replace a placeholder beep.
Volume and mute are in the pause menu.

### Abilities and classes

The numbers for every ability are in `src/config/tuning.ts` (look for the `mage:`, `sheriff:`, `refractor:` and `builder:` groups).

How an ability *behaves* is in `src/sim/classes/<class>/`, one file per ability, for example
`src/sim/classes/mage/staff.ts`. Each file starts with a short description. The class's
`index.ts` says which ability goes on which key slot.

To add a class (checklist):

1. Copy a class folder in `src/sim/classes/` (the `sheriff` one is the simplest), rename it, and write one file per ability.
   Shared building blocks are in `src/sim/classes/shared/` (dash, drag-placed walls).
2. In the class's `index.ts` set `id`, `name`, `sprite`, `ratings` (the 1-5 stars on the character select), and which ability goes on which key.
3. Add the class to `CLASSES` in `src/sim/classes/registry.ts` (use `hidden: true` to keep it out of the menus).
4. Add its numbers as a new group in `src/config/tuning.ts` (comment every line; the dev panel builds itself from this file).
5. Add its art and sounds to `src/config/assets.ts` (a missing file falls back to a placeholder drawn in `src/render/placeholders.ts`).
   Characters with a sprite sheet are listed in `SHEETS` (see the comment there).
6. Optional: teach the bot (`src/sim/bot.ts`) to use it. Run the headless tests in your scratch folder or `npm run build` (typechecks everything).

Things every class gets for free: the kick (F), hitstun, knockback (`src/sim/status.ts`), and some shared fighter variables:
`vars.absorbHp` (a health pool that takes damage first, like the Sheriff's horse), `vars.airT` (airborne: passes over
structures, objects and ground zones, like the Frog's hop) and `vars.speedMult` (walking speed, set each tick by ground zones).
A class can also have ground zones (`ClassDef.zones`, see `src/sim/zones.ts`) and a per-tick hook (`ClassDef.tick`) for
its own resource, like the Frog's slime.

### Menus

All menu screens (main menu, host, join, character select) are in `src/ui/menus.ts`: button
text and titles are near the top of each screen. The pause menu is `src/ui/pauseMenu.ts` and the
end-of-match screen is `src/ui/matchOverMenu.ts`. Their look is in `src/style.css`.

### Online settings

The `net:` group in `src/config/tuning.ts`: how often the host sends updates, how far behind
the guest draws, and how long to wait for a dropped player.

---

## How the code is organised (for programmers)

| Folder | What's in it |
| --- | --- |
| `src/config/` | Tuning numbers, keybinds, asset list. The things you tweak. |
| `src/sim/` | The game rules. No drawing, sound or browser code (checked by `npm run typecheck`), so it can later run headless on a server or in a desktop build. |
| `src/input/` | Turns keyboard and mouse into a `PlayerInput` each tick. A controller would be another input source. |
| `src/render/` | Draws the world and HUD on the canvas. Placeholder art is in `placeholders.ts`. |
| `src/audio/` | Sound effects. |
| `src/ui/` | HTML menus and the dev panel. |
| `src/game/` | Glue: runs a session (input â†’ simulation â†’ visuals/sound). |
| `src/platform/` | Browser-only services: saved settings, room links, PeerJS connections. Swap these for a desktop build. |
| `src/net/` | The online message format (snapshots, inputs, lobby). |
| `src/dev/`, `tools/` | Dev-panel helpers and the dev-server hook that saves `tuning.ts`. |

The simulation runs at a fixed 60 ticks per second, independent of the screen's frame rate.
