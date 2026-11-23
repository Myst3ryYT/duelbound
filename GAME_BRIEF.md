**BRIEF:**

DUELBOUND cis a top-down fighting game made to be played with keyboard and mouse. 

2 players are confined within a square arena, left to fight in a best 2 of three rounds. There are different characters, each with 5 different abilities available to them, and 1000hp. The arena is empty. Each round starts with a 3 second countdown and has a 90 second timer. If the timer runs out, the player with more HP wins the round, and an exact tie opens a simple tie screen that replays the round. Both players can pick any character, including the same one. Movement must feel snappy: no sliding or floaty acceleration, full speed within about 3 frames and an instant stop when keys are released. 

   
**ART STYLE:**

Pixel art graphics, but not pixel perfect. Rotations and things are fine. The game runs at a logical 1920x1080 and scales to the window. Placeholder art is drawn in code for now. Real assets will be supplied later, so every sprite loads from one asset map and can be swapped without code changes. Sound effects are simple placeholders with a volume slider and mute.

Health bars are visible on the top of the screen

**ABILITIES**  
	Abilities are buttons a player can press to perform actions. Most should be on a short cooldown unless it is their base weapon or otherwise specified.

Later I will specify hotkeys LC \= Left click, RC \= Right Click. WASD moves the player and the mouse aims, with a crosshair in place of the cursor. Escape opens a pause menu with a leave-match option.

Abilities can also either be instant, or variable. Instant abilities trigger right after pressing the hotkey, variable abilities wait for click(s) to execute. 

**ABILITY TYPES:**

There are 4 distinct types of abilities. 

\- Projectiles: projectiles are about what you'd expect, a standard projectile bullet which is minimally impacted by physics, and can travel at various speeds. Projectile hitboxes are about 20 percent larger than the sprite

\- Placeable: Placeables are structures or abilities that can be placed statically on the map in various ways. Placeables cannot be placed inside of players or other placeables. Players should have a relatively big hitbox for these collision checks to be safe in cases of high ping, and so players movement wont allow them to instantly move inside of a placeable. Projectiles damage placeables, and every placeable has its own HP, so they can all be destroyed at varying difficulty.

There are two main types of these and the way they are placed vary on the type

STATIC PLACEABLES: upon pressing the ability hotkey, an outline appears of the placeable. These cannot be rotated (or their rotation is bound to the direction the player is looking.) Upon clicking it places them / triggers their placing animation

DYNAMIC PLACEABLES. These abilities can be rotated. (generally these are walls)  
Or more fluidly placed, in most cases the way this should work is as follows: After hitting the ability hotkey you are in a “placing mode” once you click it registers as the first point, once you release it registers the second point. Then the object uses these points to draw a wall. These   
also should have set radii. Meaning, if the player takes their mouse too far from their initial point, it automatically creates the second point to avoid walls becoming too big.

\- Object: these are things that can be summoned in the arena and do interact with physics. For example shooting an object should cause it to move and bounce around the walls and or placeables. It is important that the physics of these objects are synced between the two players so both players see these objects at the same place at the same time. 

- Misc: every other ability that doesn’t fit cleanly to a category of how it should behave.

**FINISHED CLASS IDEAS:**

**Mage**   
Overview: Has a magic staff. Gold and Blue colors.

spell ideas:

**LC \- Staff (instant, projectile)**  
simple projectile attack, the duration a click is held \+ more speed and more damage. Hold to charge and release to fire, up to a maximum charge time.

**RC \-Reflective shield. (instant, misc)**  
	Player becomes encased in a circular blue shield which reflects away any incoming projectiles. Reflected projectiles change owner to the Mage.

**C \- WATCHTOWER (variable, static placeable)**  
Has a fairly long startup animation, once its created it shoots projectiles in 8 directions, (all cardinal directions and diagonals) 

**V \- SWITCH (instant, misc)**  
	Switches the direction of all projectiles/objects. Very long cooldown. They slow down and curve into the opposite direction over about 0.4 seconds so players have time to react. It affects the caster's own projectiles and objects too.  
	  
**SPACE \- Teleportation. (instant, misc)**  
	The player clicks a location and after a brief animation telepots there. There is no maximum range, but the target cannot be inside a wall, a placeable or a player. Clicking an invalid spot does nothing and does not start the cooldown.

**Sheriff**  
Overview: Sharpshooter with high mobility. Uses revolver primarily. Brown and Red color scheme.

**LC \- Gun (instant, projectile)**  
	\-Literally just shoot. Pretty fast and decent damage, the closer you are to an enemy the more damage it does

**RC \- LASSO (instant, projectile/misc)**  
	Essentially just a roadhog hook from overwatch. It pulls the enemy to the Sheriff, does very minimal damage, and has a range of about half the arena width.

**C \- BRAMBLE (instant, object)**  
	Summons a tumbleweed that is reactive to physics, shooting it bounces it around the arena, when it interacts with a player it stuns them. It summons in the direction of the mouse relative to the player. Summons quite close to the player. It hurts its owner too.

**V \- PIERCING BULLET (instant, projectile)**  
	After a short delay it fires an extremely high speed bullet which bounces off of up to 3   
walls/placeables, leaving a distinct bullet trail for a short time (the trail is visual only, damage comes from the bullet itself). Heavy damage

**SPACE \- ROLL (instant, misc)**  
	The player rolls with a few frames of invincibility. 

**REFRACTOR**  
Overview: A character based around multiplying projectiles and ricocheting shots, glassy refractive look. 

**LC \- Mind Shotgun (instant, projectile)**   
shoots 4 bullets with a tight spread. After bouncing off a mirror the amount of bullets double. It doubles only once (4 becomes 8, never more), and a mirror that doubled a volley breaks afterward, so two mirrors facing each other cannot multiply shots endlessly.

**RC \- Mind ray: (instant, projectile)**  
Summons a beam coming from the character's head. Ammo comes from a resource pool which is a bar visible next to crosshair. Heavy damage but drains the resource pool fast, damage doubles on each mirror it reflects off. The beam gets bigger and more intense with each mirror. Works like a ray gun, so the beam only shoots when clicking. Deals low amounts of damage in quick succession. The resource pool refills gradually after not using it for a short time. Each tick is low damage with many ticks per second, and the total gets heavy mainly through mirror reflections.

**C \- Mirror: (variable, dynamic placable)**  
place a mirror down that bullets bounce off. Up to 3 mirrors can be placed at once. The cooldown can hold up to 3 uses. Fairly short placement radius. Mirrors also reflect enemy projectiles without multiplying them. They can be destroyed by damage, but it takes sustained fire.

**V \- Refract**   
 splits character horizontally. to a "red and blue channel" it's pretty brief and just for dodging abilities. Splits perpendicular to how your pointing your mouse. It makes two hitboxes that both count as the player, so damage to either one hurts the player. 

**SPACE \- Shatter**  
	Instantly shatters every mirror in the arena dealing damage to players who are nearby a mirror.

**UNFINISHED CLASS IDEAS:**

\- Ninja  
Very mobile. All about doing cheeky stuff like bouncing shurikens off walls. Or going invisible and doing melee dmg

LC \-Shuriken can bounce of walls and abillities but other characters, can be fired fairly quickly but medium speed. And low damage.  
\#1 \-Cloak: Makes yourself invisible for \_\_\_ seconds, invisibility ends when damage is taken  
\#2 \-Sword: Just a melee, prob can be combo'd  
\#3 \-Evade: Makes you invisible and invincible for a very short amount of time. Good for avoiding projectiles

\- Earthbender  
Very low mobility. But all about controlling your enemy with walls and attacks wit  
LC \- Rock Throw: Very slow projectile. But does very heavy damage  
\#1 \- Can basically draw walls. They have like a limited amount that you can move your mouse and then it draws the wall  
\#2 \- Creates a circular earthquake. It shakes for like 3 seconds and then inflicts damage  
\#3 \- Something similar to 

\- Reaper

LC: Scythe, just a melee  
1: throws your scythe and it spins in a circle

\- Builder

LC: nail gun, low dmg shoots super fast  
1: Brick wall, like earth bender but can be destroyed. When it destroyed the bricks will shoot backwards and deal heavy damage  
2: Construction, builds a random piece of furniture and when hit with the sledge hammer it gets flung  
3: Sledge hammer, instantly breaks the brick wall and can break other placeables from other people

\- Chemist

**SCOPE AND PLATFORM (V1):**

* Scope: the three finished classes (Mage, Sheriff, Refractor) plus a basic menu for joining a match. The unfinished classes are not in v1.  
* Platform: browser game first, downloadable later. Nothing in the build may cost money, so hosting is free static hosting only.  
* Modes: online 1v1 (host a match or join by room code or link), play against a bot, and a training dummy. LAN testing is enough at first, but joining by shared link is the real target.  
* Game name: undecided. Candidates: Rebound, Duelbound, Crossfire, Four Corners, Spellslinger, Shatterpoint.

**SCREENS:**

* Main menu: Host Match (shows a room code and a shareable link), Join Match (enter a code), Play vs Bot, Training Dummy.  
* Character select: each player picks a class, then confirms.  
* Match HUD: both HP bars at the top of the screen, round wins, round timer, ability icons with cooldowns, and the Refractor resource bar next to the crosshair.  
* Between rounds: short round result, then the countdown. End of match: winner, rematch, back to menu. A tie opens the tie screen described above.  
* Bot: moves, aims and fires at the opponent, with a simple dodge. One fixed difficulty in v1.  
* Training dummy: a stationary target with resettable HP. It shows damage numbers, and cooldowns can be switched off.

**DEFAULT TUNING VALUES (starting numbers, all in one config file so balance changes never touch game code):**

* World: 960 x 960 unit arena centered on the 1920x1080 screen.  
* Player: 1000 HP, move speed 420 units per second, body radius 22, projectile hit radius 26, placement check radius 40\.  
* Mage Staff: charge up to 0.8 s, damage 40 to 120, speed 700 to 1300, fire interval 0.35 s.  
* Mage Shield: lasts 1.5 s, cooldown 10 s.  
* Mage Watchtower: 1.5 s startup, 200 HP, lasts 8 s, fires 8 bolts every 1.2 s (30 damage, speed 500), cooldown 18 s.  
* Mage Switch: cooldown 25 s.  
* Mage Teleport: 0.35 s animation, cooldown 8 s.  
* Sheriff Gun: one shot every 0.4 s, speed 1600, damage 25 at long range rising to 45 point blank.  
* Sheriff Lasso: range 480, speed 1400, 20 damage, pulls the target at 1400 units per second, cooldown 9 s, blocked by placeables.  
* Sheriff Bramble: spawns 80 units from the player toward the mouse, lasts 8 s, 30 damage and 0.8 s stun on contact, bounce restitution 0.9, cooldown 10 s.  
* Sheriff Piercing Bullet: 0.6 s delay, speed 4000, up to 3 bounces, 220 damage, trail lasts 0.4 s, cooldown 14 s.  
* Sheriff Roll: 0.35 s long, 0.2 s invincible, 260 units, cooldown 4 s.  
* Refractor Mind Shotgun: 4 pellets in a 6 degree spread, 18 damage each, speed 1000, fire interval 0.5 s.  
* Refractor Mind Ray: resource pool 100, drains 40 per second while held, refills 25 per second after 1 s unused, 40 damage per second doubled per mirror reflection, at most 3 reflections.  
* Refractor Mirror: up to 3 placed, max length 220 units, 150 HP, one charge returns every 6 s.  
* Refractor Refract: lasts 0.6 s, two hitboxes 90 units apart perpendicular to the aim direction, cooldown 8 s.  
* Refractor Shatter: radius 250 around each mirror, 120 damage, cooldown 20 s.

**NETCODE AND HOSTING:**

* Goal: free to run, and playable by friends from a link, with no paid server.  
* Hosting: static files on Cloudflare Pages (free tier), connected to a GitHub repo so every push gets a shareable preview link.  
* Connection: browser to browser over WebRTC, using PeerJS and its free public signaling service. The host creates a room and shares a link that contains the room code. STUN servers are free. Some strict networks cannot connect without a TURN relay, which is not free, so show a clear could-not-connect message in that case.  
* Authority: the host's browser runs the real game simulation. The guest sends inputs only (movement keys, aim angle, ability presses and clicks) with a sequence number, and the host sends back world snapshots. One source of truth keeps physics objects like Bramble identical for both players.  
* Shared code: all game rules live in one simulation module with no drawing code. The same module can later run headless on a Node server for matchmaking and for the downloadable build, without a rewrite.  
* Tick rate: fixed 60 Hz simulation step, independent of frame rate. Snapshots go out about 30 times per second.  
* Guest feel: the guest predicts its own movement locally so controls respond instantly, and corrects when a host snapshot arrives by replaying inputs the host has not yet acknowledged. The host's own player has no delay.  
* Remote entities: the opponent, projectiles and objects are drawn about 100 ms behind the latest snapshot, interpolated, so motion looks smooth.  
* Hits and health: only the host decides hits, damage and deaths. The guest may start an animation or sound at once, but HP changes only when the host reports them.  
* Projectiles: send a spawn event (position, direction, speed, tick) instead of a position every tick, and let each side simulate the projectile between snapshots.  
* Physics objects: only the host simulates them. Snapshots carry position and velocity, and clients interpolate.  
* Fast shots (Piercing Bullet, Mind Ray): the host resolves them with swept line checks so they cannot skip through thin mirrors or walls. Lag compensation (rewinding the target by the shooter's latency) can be added later.  
* Placement: the host validates every placement against players and placeables using the larger placement radius, so small position differences from latency do not break it. A rejected placement is cancelled and the cooldown refunded.  
* Disconnects: wait 10 seconds for a reconnect, then award the match to the remaining player.  
* Cheating: the host could cheat. That is acceptable for friends. A dedicated server later removes the problem.  
* Testing: a debug menu with fake latency (0 to 200 ms), jitter and packet loss, an overlay showing ping and snapshot rate, and two browser tabs on one machine as a quick two-player test.  
* Later: a headless server running the same simulation for matchmaking, possibly on Cloudflare Workers. Free hosting tiers go to sleep and add delay, so do this only once matchmaking is needed.

