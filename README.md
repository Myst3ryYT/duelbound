# Rebound

A top-down 1v1 arena fighting game for keyboard and mouse, playable in the browser.
The full design spec is in [GAME_BRIEF.md](GAME_BRIEF.md).

**Current build: step 3 of 6 done.** All three classes, the training dummy, and best-of-3 matches against a bot (countdown, 90 s clock, tie screen, rematch). Until the menus arrive in step 4: press Tab in training to switch class, and B to fight the bot with your current class (the bot picks a random class).

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

## Controls (training)

| Key | Does |
| --- | --- |
| W A S D | move |
| Mouse | aim (the crosshair) |
| Tab | switch class |
| R | put the dummy back and refill its HP |
| F | make the dummy shoot at you (on / off) |
| T | switch ability cooldowns on / off |
| B | start a best-of-3 match against the bot |
| ` (the key left of 1) | open the dev panel |
| Esc | pause menu (volume, mute, leave match) |

**Mage**

| Key | Does |
| --- | --- |
| Left click | Staff: hold to charge (bar under the crosshair), release to fire. Fires by itself at full charge. |
| Right click | Reflective shield: bounces enemy shots back, and they become yours |
| C | Watchtower: shows an outline, left click to place, right click or C to cancel |
| V | Switch: every projectile and tumbleweed slows down and comes back the other way |
| Space | Teleport to the crosshair |

**Sheriff**

| Key | Does |
| --- | --- |
| Left click | Revolver: hold to keep firing. Hits harder up close. 6 shots, then it reloads by itself. |
| Right click | Lasso: catches the enemy and drags them to you |
| C | Bramble: a tumbleweed that stuns whoever touches it (you too) and drags them along. Shoot it to knock it around. |
| V | Piercing bullet: aim for a moment (the red line shows the path, bounces included), then a very fast shot that bounces 3 times |
| Space | Roll in the direction you're walking, briefly invincible |

**Refractor**

| Key | Does |
| --- | --- |
| Left click | Mind Shotgun: 4 pellets. Pellets that bounce off your own mirror double (once), and that mirror breaks. |
| Right click | Mind Ray: hold for a beam. Uses the purple bar by the crosshair. Double damage for each mirror it bounces off. |
| C | Mirror mode on / off. In mirror mode, hold left click where a mirror starts, drag, release where it ends; place as many as you have uses (3 stored). |
| V | Refract: split into two halves for a moment; a shot can pass between them |
| Space | Shatter: breaks every mirror; enemies near a mirror take damage for each one |

--- | --- |
| W A S D | move |
| Mouse | aim (the crosshair) |
| R | refill the dummy's HP |
| T | switch ability cooldowns on / off |
| B | start a best-of-3 match against the bot |
| Left click | Mage staff: hold to charge, release to fire |
| Right click | Mage reflective shield |
| C | Mage watchtower: shows an outline, left click to place, right click or C to cancel |
| V | Mage switch: every projectile turns around |
| Space | Mage teleport to the crosshair |
| ` (the key left of 1) | open the dev panel |
| Esc | pause menu (volume, mute, leave match) |

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
has a slider and a box. Changes apply instantly. Values you changed turn yellow.

- **Save to tuning.ts** writes the current values into the file for you (only works with `npm run dev`).
- **Revert to file** throws away slider changes.
- **Damage dummy / Damage me / Heal all** are test buttons.

### Round rules and the bot

Also in `src/config/tuning.ts`: the `match:` group (countdown, round clock, rounds to win) and the
`bot:` group (aim error, how often it dodges, how far it likes to stay from you, and so on).

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

The numbers for every ability are in `src/config/tuning.ts` (look for the `mage:`, `sheriff:` and `refractor:` groups).

How an ability *behaves* is in `src/sim/classes/<class>/`, one file per ability, for example
`src/sim/classes/mage/staff.ts`. Each file starts with a short description. The class's
`index.ts` says which ability goes on which key slot.

To add a class later: copy the `mage` folder, rename it, edit the abilities, then add it to
`src/sim/classes/registry.ts`. Its art goes in `src/config/assets.ts` like everything else.

### Menus

Arrive in build step 4. For now, the pause menu is `src/ui/pauseMenu.ts`.

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
| `src/platform/` | Browser-only services (saved settings now; links and PeerJS later). Swap these for a desktop build. |
| `src/dev/`, `tools/` | Dev-panel helpers and the dev-server hook that saves `tuning.ts`. |

The simulation runs at a fixed 60 ticks per second, independent of the screen's frame rate.
