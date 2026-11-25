/**
 * The bot opponent. Each tick it looks at the World and produces a PlayerInput,
 * exactly like a human's keyboard and mouse would. So it plays by the same rules,
 * and it runs headless (the host will run it in online games later, too).
 *
 * What it does:
 *  - keeps a good distance from you for its class, strafing side to side, away from walls
 *  - aims where you'll be when the shot arrives (with some random error)
 *  - dodges shots, flung furniture, rolling tumbleweeds, charging horses and the Mind Ray
 *  - fires its weapon and uses its other abilities, including class combos
 *  - kicks you when you get right up close
 *
 * Playing smart ("tactics", re-rolled every time it changes strafing direction):
 * backs off while its gun reloads, rushes in when you're stunned, lassoed or reloading,
 * plays safe when it's losing, and does combos (bramble + lasso, build + hammer fling,
 * bank shots and shatter traps with mirrors...).
 *
 * Five difficulties: easy, normal, hard, expert, insane. Their numbers are in
 * tuning.bot.<difficulty>; the bot only notices a shot reactionTime seconds after it appears.
 */
import type { Tuning } from '../config/tuning.ts';
import { emptyInput, type Fighter, type Placeable, type PlayerInput, type World } from './types.ts';
import { clamp, dist, segmentCircle, segmentIntersect } from './math.ts';
import { isReady } from './abilities.ts';
import { canPlaceSegment, distanceTo, pathHits } from './placeables.ts';
import { traceRay } from './classes/refractor/ray.ts';

/** Small, repeatable random number generator (same seed = same bot decisions). */
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type BotDifficulty = 'easy' | 'normal' | 'hard' | 'expert' | 'insane';

/** The difficulties in menu order, with their names. */
export const BOT_DIFFICULTIES: { id: BotDifficulty; name: string }[] = [
  { id: 'easy', name: 'Easy' },
  { id: 'normal', name: 'Normal' },
  { id: 'hard', name: 'Hard' },
  { id: 'expert', name: 'Expert' },
  { id: 'insane', name: 'Insane' },
];

type Skill = Tuning['bot']['normal'];

/** One planned tick of a multi-step move (like placing a structure). */
type ScriptStep = (input: PlayerInput, me: Fighter, enemy: Fighter) => void;

/** Something dangerous heading at the bot. */
interface Threat {
  id: number;
  time: number; // seconds until closest approach
  sideX: number; // which way to step to get out of its path
  sideY: number;
}

/** Everything a class's play function needs for this tick. */
interface Ctx {
  world: World;
  tuning: Tuning;
  skill: Skill;
  input: PlayerInput;
  me: Fighter;
  enemy: Fighter;
  d: number; // distance between us
  dt: number;
  los: boolean; // a clear straight line to the enemy (no structures or objects in the way)
  threat: Threat | null; // a close shot it decided to use a defensive ability against
  tryAbility: () => boolean; // a random "use a cooldown ability now?" roll
}

export class BotBrain {
  private rng: () => number;
  private seq = 0;
  private strafeDir = 1;
  private strafeT = 0;
  private smart = false; // playing smart right now? (re-rolled from skill.tactics)
  private noiseX = 0;
  private noiseY = 0;
  private noiseT = 0;
  private clickAcc = 0; // Sheriff: clicks "owed" at the bot's click rate
  private rayT = 0; // Refractor: seconds left of the current beam burst
  private belchT = 0; // Frog: seconds left of holding the belch
  private spot: { x: number; y: number } | null = null; // where it's walking to get a clear shot
  private spotT = 0;
  private script: ScriptStep[] = [];
  private dodgeDecisions = new Map<number, boolean>(); // threat id -> decided to dodge it?
  private defendDecisions = new Map<number, boolean>();
  private kickDecisions = new Map<number, boolean>();
  private firstSeen = new Map<number, number>(); // threat id -> world time the bot first saw it
  private difficulty: BotDifficulty;
  private fighterId: number;

  constructor(fighterId: number, seed: number, difficulty: BotDifficulty = 'normal') {
    this.fighterId = fighterId;
    this.difficulty = difficulty;
    this.rng = makeRng(seed);
  }

  think(world: World, tuning: Tuning): PlayerInput {
    const input = emptyInput();
    input.seq = ++this.seq;
    const me = world.fighters.find((f) => f.id === this.fighterId);
    const enemy = world.fighters.find((f) => f.id !== this.fighterId);
    if (!me || !enemy) return input;
    const b = tuning.bot;
    const skill = b[this.difficulty] ?? b.normal;
    const dt = 1 / tuning.world.tickRate;
    const d = dist(me.x, me.y, enemy.x, enemy.y);
    const los = !lineBlocked(world, me.x, me.y, enemy.x, enemy.y);

    // ---- Aim: where they'll be when the shot gets there, plus some wobble ----
    this.noiseT -= dt;
    if (this.noiseT <= 0) {
      this.noiseT = 0.25 + this.rng() * 0.25;
      this.noiseX = (this.rng() * 2 - 1) * skill.aimJitter;
      this.noiseY = (this.rng() * 2 - 1) * skill.aimJitter;
    }
    const lead = interceptTime(me, enemy, weaponSpeed(me, tuning)) * skill.leadFactor;
    input.aimX = enemy.x + enemy.vx * lead + this.noiseX;
    input.aimY = enemy.y + enemy.vy * lead + this.noiseY;

    // ---- Move: keep a good range, strafe, find a clear shot, avoid walls and hazards ----
    this.strafeT -= dt;
    if (this.strafeT <= 0) {
      this.strafeT = b.strafeMin + this.rng() * (b.strafeMax - b.strafeMin);
      this.strafeDir = this.rng() < skill.pauseChance ? 0 : this.rng() < 0.5 ? -1 : 1;
      this.smart = this.rng() < skill.tactics;
    }
    let range = preferredRange(me.classId, tuning);
    if (this.smart) range = this.tacticalRange(tuning, me, enemy, range);
    const toX = (enemy.x - me.x) / (d || 1);
    const toY = (enemy.y - me.y) / (d || 1);
    const radial = d > range + 60 ? 1 : d < range - 60 ? -1 : 0;
    let mx = toX * radial + -toY * this.strafeDir;
    let my = toY * radial + toX * this.strafeDir;

    // Something in the way: walk to a spot with a clear shot.
    this.spotT -= dt;
    if (los || skill.lineOfSight < 1) this.spot = null;
    else if (!this.spot || this.spotT <= 0) {
      this.spot = this.findClearSpot(world, tuning, me, enemy, range);
      this.spotT = 0.4;
    }
    if (this.spot) {
      const sl = dist(me.x, me.y, this.spot.x, this.spot.y) || 1;
      mx = (this.spot.x - me.x) / sl;
      my = (this.spot.y - me.y) / sl;
    }

    const size = tuning.world.arenaSize;
    if (me.x < b.wallMargin) mx += 1.5;
    if (me.x > size - b.wallMargin) mx -= 1.5;
    if (me.y < b.wallMargin) my += 1.5;
    if (me.y > size - b.wallMargin) my -= 1.5;
    if (skill.avoidHazards >= 1) {
      const h = hazardPush(world, me);
      mx += h.x;
      my += h.y;
    }

    // ---- Dodge: step out of the path of something coming at us ----
    const threat = this.findThreat(world, tuning, me, enemy, skill);
    let speed = skill.moveSpeed;
    if (this.smart && (enemy.stunT > 0 || enemy.pullById === me.id)) speed = 1; // go get them
    if (threat && this.decide(this.dodgeDecisions, threat.id, skill.dodgeChance)) {
      mx = threat.sideX;
      my = threat.sideY;
      speed = 1;
    }
    const len = Math.hypot(mx, my);
    if (len > 0.01) {
      input.moveX = (mx / len) * speed;
      input.moveY = (my / len) * speed;
    }

    // ---- A planned multi-tick move (placing a structure, a combo) takes over ----
    const step = this.script.shift();
    if (step) {
      step(input, me, enemy);
      return input;
    }

    // ---- Use abilities ----
    const urgent = threat && threat.time < 0.3 && this.decide(this.defendDecisions, threat.id, skill.defendChance) ? threat : null;
    const c: Ctx = { world, tuning, skill, input, me, enemy, d, dt, los, threat: urgent, tryAbility: () => this.rng() < skill.abilityRate * dt };
    if (me.classId === 'sheriff') this.playSheriff(c);
    else if (me.classId === 'refractor') this.playRefractor(c);
    else if (me.classId === 'builder') this.playBuilder(c);
    else if (me.classId === 'mage') this.playMage(c);
    else if (me.classId === 'frog') this.playFrog(c);
    this.maybeKick(c);
    return input;
  }

  // ------------------------------------------------------------- tactics ----

  /** Smart range: back off to reload or when losing, rush in when the enemy is open, respect the hammer. */
  private tacticalRange(tuning: Tuning, me: Fighter, enemy: Fighter, range: number): number {
    const b = tuning.bot;
    if (me.vars.reloading > 0) range += b.reloadRetreat;
    if (me.hp < enemy.hp * b.lowHpRatio) range += 100;
    if (enemy.classId === 'builder' && me.classId !== 'builder' && isReady(enemy, 'secondary')) range = Math.max(range, 240);
    if (enemy.stunT > 0 || enemy.pullById === me.id || enemy.vars.reloading > 0) range = Math.min(range, b.pushRange);
    return range;
  }

  /** Kick (F) when the enemy is right on top of us. */
  private maybeKick(c: Ctx): void {
    const { me, enemy, d, input, tuning, world } = c;
    if (me.kickCd > 0 || me.prevButtons.kick || enemy.invulnT > 0 || me.placing) return;
    if (d > me.radius + tuning.kick.range + enemy.radius - 4) return;
    if (me.classId === 'builder' && isReady(me, 'secondary')) return; // the hammer is better
    if (!this.decide(this.kickDecisions, Math.floor(world.time * 2), c.skill.kickChance)) return; // one decision every half second
    input.aimX = enemy.x;
    input.aimY = enemy.y;
    input.buttons.kick = true;
  }

  /** May we spend a shot now? (Not into a wall, and not into a dodge roll when playing smart.) */
  private canShoot(c: Ctx): boolean {
    if (c.skill.lineOfSight >= 1 && !c.los) return false;
    if (this.smart && c.enemy.invulnT > 0) return false;
    return true;
  }

  /** A nearby spot with a clear straight line to the enemy, close to the range we like. */
  private findClearSpot(world: World, tuning: Tuning, me: Fighter, enemy: Fighter, range: number): { x: number; y: number } | null {
    const size = tuning.world.arenaSize;
    let best: { x: number; y: number } | null = null;
    let bestScore = Infinity;
    for (const r of [140, 260]) {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const x = me.x + Math.cos(a) * r;
        const y = me.y + Math.sin(a) * r;
        if (x < 60 || y < 60 || x > size - 60 || y > size - 60) continue;
        if (lineBlocked(world, x, y, enemy.x, enemy.y)) continue;
        if (lineBlocked(world, me.x, me.y, x, y, me.radius)) continue; // can't walk there
        const score = Math.abs(dist(x, y, enemy.x, enemy.y) - range) + r * 0.5;
        if (score < bestScore) {
          bestScore = score;
          best = { x, y };
        }
      }
      if (best) return best;
    }
    return null;
  }

  // ------------------------------------------------------------- classes ----

  private playSheriff(c: Ctx): void {
    const { me, enemy, d, input, tuning, skill } = c;
    const g = tuning.sheriff;

    // On the horse: fire a burst whenever it's ready.
    if (me.vars.mountT > 0) {
      if (isReady(me, 'primary') && !me.prevButtons.primary && d < 750 && this.canShoot(c)) input.buttons.primary = true;
      return;
    }

    // Revolver: one shot per click, so click at the bot's click rate (a fresh press each time).
    this.clickAcc = Math.min(2, this.clickAcc + skill.clickRate * c.dt);
    if (this.clickAcc >= 1 && !me.prevButtons.primary && d < 750 && !(me.vars.reloading > 0) && this.canShoot(c)) {
      input.buttons.primary = true;
      this.clickAcc -= 1;
    }

    // Roll out of the way of a shot, or away from a Builder about to swing.
    const hammerNear = enemy.classId === 'builder' && isReady(enemy, 'secondary') && d < 150;
    if ((c.threat || (this.smart && hammerNear)) && isReady(me, 'mobility')) {
      if (c.threat) {
        input.moveX = c.threat.sideX;
        input.moveY = c.threat.sideY;
      } else {
        input.moveX = (me.x - enemy.x) / (d || 1);
        input.moveY = (me.y - enemy.y) / (d || 1);
      }
      input.buttons.mobility = true;
      return;
    }

    const lassoOk = isReady(me, 'secondary') && c.los && d > 150 && d < g.lasso.range * 0.85 && enemy.invulnT <= 0;

    // Combo: roll a tumbleweed at them, then lasso them through it (stunned on the way = bonus damage).
    if (lassoOk && this.smart && isReady(me, 'ability1') && d > 220 && d < 600 && c.tryAbility()) {
      const ax = enemy.x;
      const ay = enemy.y;
      this.script = [
        (i) => {
          i.aimX = ax;
          i.aimY = ay;
          i.buttons.ability1 = true;
        },
        ...wait(8),
        (i, _m, e) => {
          i.aimX = e.x;
          i.aimY = e.y;
          i.buttons.secondary = true;
        },
      ];
      return;
    }

    if (!c.tryAbility()) return;
    // Lasso: smart bots wait until the enemy has used their dodge.
    if (lassoOk && (!this.smart || !isReady(enemy, 'mobility') || this.rng() < 0.3)) input.buttons.secondary = true;
    // Tumbleweed: a roadblock in front of someone rushing in.
    else if (isReady(me, 'ability1') && d < 320) input.buttons.ability1 = true;
    // Horse: charge at them, or (smart, losing) ride away soaking up damage.
    else if (isReady(me, 'ability2')) {
      const escape = this.smart && me.hp < me.maxHp * 0.3 && d < 400;
      if (escape) {
        const mid = tuning.world.arenaSize / 2;
        input.aimX = mid + (mid - enemy.x) * 0.5;
        input.aimY = mid + (mid - enemy.y) * 0.5;
        input.buttons.ability2 = true;
      } else if (d > 200 && d < 650) input.buttons.ability2 = true;
    }
  }

  private playBuilder(c: Ctx): void {
    const { world, me, enemy, d, input, tuning } = c;
    const bd = tuning.builder;
    const reach = me.radius + bd.hammer.range;
    const halfArc = (bd.hammer.arcDegrees * Math.PI) / 360;

    // Nail gun. Smart: only from close enough to hit (nails are slow), and straight
    // through enemy structures in the way (nails break them).
    const nailRange = this.smart ? 480 : 700;
    const throughEnemyStuff = !c.los && onlyEnemyInTheWay(world, me, enemy);
    if (d < nailRange && !(me.vars.reloading > 0) && (this.canShoot(c) || (this.smart && throughEnemyStuff))) input.buttons.primary = true;
    // Dash out of the way.
    if (c.threat && isReady(me, 'mobility')) input.buttons.mobility = true;

    // Hammer: the enemy is in the swing, or our furniture is (fling it at them),
    // or (smart) our wall is, with the enemy on the far side (smash it: bricks fly at them).
    if (isReady(me, 'secondary')) {
      const enemyAngle = Math.atan2(enemy.y - me.y, enemy.x - me.x);
      const inArc = (x: number, y: number) => Math.abs(angleDiff(Math.atan2(y - me.y, x - me.x), enemyAngle)) < halfArc;
      const fling = world.objects.some((o) => o.ownerId === me.id && o.kind.startsWith('builder_furniture') && dist(o.x, o.y, me.x, me.y) < reach + o.radius && inArc(o.x, o.y) && d < 800);
      const smash =
        this.smart &&
        world.placeables.some((p) => {
          if (p.ownerId !== me.id || p.kind !== 'builder_wall' || distanceTo(p, me.x, me.y) > reach + p.radius) return false;
          return oppositeSides(p, me.x, me.y, enemy.x, enemy.y) && distanceTo(p, enemy.x, enemy.y) < bd.wall.brickRange * 0.8;
        });
      // Smart: smash an enemy structure (mirror, wall) that's in reach and in our way.
      const wreck =
        this.smart &&
        !c.los &&
        world.placeables.some((p) => p.ownerId !== me.id && distanceTo(p, me.x, me.y) < reach + p.radius && pathHits(p, me.x, me.y, enemy.x, enemy.y, 6) >= 0);
      if (d < reach + enemy.radius || fling || smash || wreck) {
        input.aimX = enemy.x;
        input.aimY = enemy.y;
        input.buttons.secondary = true;
        return;
      }
    }

    // Combo (smart): build a piece of furniture and hammer it straight at them.
    if (this.smart && isReady(me, 'ability2') && isReady(me, 'secondary') && c.los && d > 180 && d < 600 && c.tryAbility()) {
      this.script = [
        (i, _m, e) => {
          i.aimX = e.x;
          i.aimY = e.y;
          i.buttons.ability2 = true;
        },
        ...wait(4),
        (i, _m, e) => {
          i.aimX = e.x;
          i.aimY = e.y;
          i.buttons.secondary = true;
        },
      ];
      return;
    }

    // Gap close (smart): dash in when they're stunned or reloading.
    const open = enemy.stunT > 0 || enemy.vars.reloading > 0 || !isReady(enemy, 'mobility'); // (they can't dodge away)
    if (this.smart && open && isReady(me, 'mobility') && d > reach + 40 && d < reach + bd.dash.distance) {
      input.moveX = (enemy.x - me.x) / d;
      input.moveY = (enemy.y - me.y) / d;
      input.buttons.mobility = true;
      return;
    }

    if (!c.tryAbility()) return;
    // Wall (smart): cover between us while reloading or under fire.
    if (this.smart && isReady(me, 'ability1') && (me.vars.reloading > 0 || c.threat) && d > 200) {
      const w = wallAcross(me, enemy, 90, bd.wall.maxLength * 0.4);
      if (canPlaceSegment(world, tuning, w.ax, w.ay, w.bx, w.by, bd.wall.thickness / 2)) {
        this.script = dragPlace('ability1', w.ax, w.ay, w.bx, w.by);
        return;
      }
    }
    // Furniture: build some cover towards the enemy.
    if (isReady(me, 'ability2') && d < 600) input.buttons.ability2 = true;
  }

  private playRefractor(c: Ctx): void {
    const { world, me, enemy, d, input, tuning, skill } = c;
    const r = tuning.refractor;
    const mirrors = world.placeables.filter((p) => p.kind === 'refractor_mirror' && p.ownerId === me.id);

    // Where to shoot: straight at them, or (smart, or no clear line) banked off our own mirror,
    // which doubles the pellets.
    let clear = c.los;
    if (this.smart || (!c.los && skill.lineOfSight >= 1)) {
      const bank = findBankShot(world, me, enemy, mirrors);
      if (bank) {
        input.aimX = bank.x;
        input.aimY = bank.y;
        clear = true;
      }
    }

    // Mind Ray in short bursts, shotgun otherwise.
    this.rayT -= c.dt;
    if (this.rayT > 0) {
      let fire = true;
      if (skill.lineOfSight >= 1) {
        // Only burn the pool if the beam really reaches them (straight or off mirrors).
        const angle = Math.atan2(input.aimY - me.y, input.aimX - me.x);
        fire = traceRay(world, tuning, me, angle).hitFighterId === enemy.id;
        if (!fire) {
          const direct = Math.atan2(enemy.y - me.y, enemy.x - me.x);
          if (traceRay(world, tuning, me, direct).hitFighterId === enemy.id) {
            input.aimX = enemy.x;
            input.aimY = enemy.y;
            fire = true;
          }
        }
      }
      if (fire) input.buttons.secondary = true;
    } else if (d < 560 && (clear || skill.lineOfSight < 1)) input.buttons.primary = true;
    if (this.rayT <= 0 && d < 800 && (me.vars.rayPool ?? r.ray.pool) > 50 && this.rng() < 0.6 * c.dt) this.rayT = 0.6 + this.rng() * 0.6;

    // Dash out of the way, or (smart) away from a Builder about to swing.
    if (c.threat && isReady(me, 'mobility')) input.buttons.mobility = true;
    else if (this.smart && enemy.classId === 'builder' && d < 160 && isReady(me, 'mobility')) {
      input.moveX = (me.x - enemy.x) / (d || 1);
      input.moveY = (me.y - enemy.y) / (d || 1);
      input.buttons.mobility = true;
    }

    // Shatter when the enemy stands near a mirror.
    if (isReady(me, 'ability2') && mirrors.some((m) => distanceTo(m, enemy.x, enemy.y) < r.shatter.radius * 0.8)) {
      input.buttons.ability2 = true;
      return;
    }

    if (!isReady(me, 'ability1') || !c.tryAbility()) return;
    const half = r.mirror.maxLength * 0.4;
    const thick = r.mirror.thickness / 2;

    // Combo (smart): drop a mirror right in front of them, then shatter it.
    if (this.smart && isReady(me, 'ability2') && d > 200 && d < 700) {
      const w = wallAcross(enemy, me, 90, half);
      if (canPlaceSegment(world, tuning, w.ax, w.ay, w.bx, w.by, thick)) {
        this.script = [...dragPlace('ability1', w.ax, w.ay, w.bx, w.by), (i) => (i.buttons.ability2 = true)];
        return;
      }
    }

    if (mirrors.length >= 2) return;
    // Smart: a bank mirror off to the side, angled so shots off it fly at the enemy.
    if (this.smart && d < 700) {
      for (const side of this.rng() < 0.5 ? [1, -1] : [-1, 1]) {
        const w = bankMirror(me, enemy, side, half);
        if (w && canPlaceSegment(world, tuning, w.ax, w.ay, w.bx, w.by, thick) && inArena(tuning, w.ax, w.ay, 40) && inArena(tuning, w.bx, w.by, 40)) {
          this.script = dragPlace('ability1', w.ax, w.ay, w.bx, w.by);
          return;
        }
      }
    }
    // Otherwise: a mirror across the line between us (a shield).
    const tilt = (this.rng() - 0.5) * 1.2;
    const w = wallAcross(me, enemy, 140, half, tilt);
    this.script = dragPlace('ability1', w.ax, w.ay, w.bx, w.by);
  }

  private playMage(c: Ctx): void {
    const { world, me, enemy, d, input, tuning, threat } = c;
    // Staff: keep firing.
    if (d < 950 && this.canShoot(c)) input.buttons.primary = true;
    if (threat) {
      if (isReady(me, 'secondary')) input.buttons.secondary = true; // shield
      else if (isReady(me, 'mobility')) {
        // teleport sideways out of the shot's path
        const size = tuning.world.arenaSize;
        input.aimX = clamp(me.x + threat.sideX * 220, 40, size - 40);
        input.aimY = clamp(me.y + threat.sideY * 220, 40, size - 40);
        input.buttons.mobility = true;
      }
    }
    // Switch when several enemy shots are bearing down.
    const incoming = world.projectiles.filter((p) => p.ownerId !== me.id && (me.x - p.x) * p.vx + (me.y - p.y) * p.vy > 0 && dist(p.x, p.y, me.x, me.y) < 350).length;
    if (incoming >= 2 && isReady(me, 'ability2')) input.buttons.ability2 = true;
    // Watchtower: press C, then click a spot between us.
    if (isReady(me, 'ability1') && d < 650 && c.tryAbility()) {
      const spotX = me.x + ((enemy.x - me.x) / d) * 110;
      const spotY = me.y + ((enemy.y - me.y) / d) * 110;
      this.script = [
        (i) => (i.buttons.ability1 = true),
        () => {},
        (i) => {
          i.aimX = spotX;
          i.aimY = spotY;
          i.buttons.primary = true;
        },
        (i, m) => {
          if (m.placing) i.buttons.secondary = true; // spot was blocked: cancel
        },
        () => {},
      ];
    }
  }

  private playFrog(c: Ctx): void {
    const { me, enemy, d, input, tuning, threat } = c;
    const fr = tuning.frog;
    const slime = me.vars.slime ?? fr.slime.pool;
    const reach = me.radius + fr.tongue.range + enemy.radius;
    // Tongue when they're in reach (one lash per click: let go while it cools down).
    if (d < reach && isReady(me, 'primary')) input.buttons.primary = true;
    // Belch: hold for a random time when they're out of tongue reach.
    this.belchT -= c.dt;
    if (this.belchT > 0) input.buttons.secondary = true;
    else if (isReady(me, 'secondary') && d > reach && d < 750 && slime > 25 && this.rng() < 2 * c.dt) this.belchT = 0.2 + this.rng() * 0.8;
    // Swallow incoming shots; spit the glob back when there is something stored.
    if (me.vars.stored > 0 && !(me.vars.mouthT > 0) && d < 700) input.buttons.ability2 = !me.prevButtons.ability2; // tap (a fresh press) to spit
    else if (threat && isReady(me, 'ability2') && !(me.vars.mouthT > 0)) input.buttons.ability2 = true;
    else if (threat && isReady(me, 'mobility')) {
      input.moveX = threat.sideX; // hop sideways out of the shot's path
      input.moveY = threat.sideY;
      input.buttons.mobility = true;
    }
    // Close the gap: hop at them when just out of tongue reach.
    if (!threat && d > reach && d < reach + fr.hop.distance && isReady(me, 'mobility') && c.tryAbility()) {
      input.moveX = (enemy.x - me.x) / d;
      input.moveY = (enemy.y - me.y) / d;
      input.buttons.mobility = true;
    }
    // Acid Goop: glide in when far away with slime to spare; stop once in reach.
    if (!me.vars.goopOn && slime > 50 && d > 320 && isReady(me, 'ability1')) input.buttons.ability1 = true;
    else if (me.vars.goopOn && (slime < 20 || d < reach)) input.buttons.ability1 = true;
    if (me.vars.goopOn) {
      const len = Math.hypot(input.moveX, input.moveY) || 1;
      input.moveX /= len; // glide at full tilt
      input.moveY /= len;
    }
  }

  // ------------------------------------------------------------- helpers ----

  /** Make a yes/no decision once per id, then stick to it. */
  private decide(memory: Map<number, boolean>, id: number, chance: number): boolean {
    let yes = memory.get(id);
    if (yes === undefined) {
      yes = this.rng() < chance;
      memory.set(id, yes);
      if (memory.size > 200) memory.delete(memory.keys().next().value!);
    }
    return yes;
  }

  /**
   * The dangerous thing that will pass closest to us soon, if it would hit:
   * enemy shots, and (with avoidHazards) flung furniture, rolling tumbleweeds,
   * a charging horse and a Mind Ray that's on us.
   */
  private findThreat(world: World, tuning: Tuning, me: Fighter, enemy: Fighter, skill: Skill): Threat | null {
    const movers: { id: number; x: number; y: number; vx: number; vy: number; r: number }[] = [];
    for (const p of world.projectiles) {
      if (p.ownerId === me.id) continue;
      movers.push({ id: p.id, x: p.x, y: p.y, vx: p.vx, vy: p.vy, r: tuning.player.projectileHitRadius + p.radius * tuning.projectiles.hitboxScale - me.radius });
    }
    if (skill.avoidHazards >= 1) {
      for (const o of world.objects) {
        if (o.ownerId === me.id || (!o.armed && o.kind !== 'sheriff_bramble')) continue;
        if (Math.hypot(o.vx, o.vy) < 150) continue;
        movers.push({ id: o.id, x: o.x, y: o.y, vx: o.vx, vy: o.vy, r: o.radius });
      }
      if (enemy.vars.mountT > 0) {
        const hs = tuning.sheriff.horse.speed;
        movers.push({ id: -enemy.id, x: enemy.x, y: enemy.y, vx: enemy.vars.mountDX * hs, vy: enemy.vars.mountDY * hs, r: enemy.radius });
      }
    }

    // Forget things that no longer exist.
    for (const id of this.firstSeen.keys()) if (!movers.some((m) => m.id === id) && id !== BEAM_ID) this.firstSeen.delete(id);

    let best: Threat | null = null;
    for (const m of movers) {
      // Reaction time: ignored until the bot has 'seen' it for long enough.
      if (!this.firstSeen.has(m.id)) this.firstSeen.set(m.id, world.time);
      if (world.time - this.firstSeen.get(m.id)! < skill.reactionTime) continue;
      const speed2 = m.vx * m.vx + m.vy * m.vy;
      if (speed2 < 1) continue;
      const rx = me.x - m.x;
      const ry = me.y - m.y;
      const t = (rx * m.vx + ry * m.vy) / speed2; // time of closest approach
      if (t <= 0 || t > 0.7) continue;
      const cx = m.x + m.vx * t - me.x;
      const cy = m.y + m.vy * t - me.y;
      if (Math.hypot(cx, cy) > me.radius + m.r + 18) continue;
      if (best && best.time <= t) continue;
      // Step sideways, away from where it will pass.
      const sp = Math.sqrt(speed2);
      let sx = -m.vy / sp;
      let sy = m.vx / sp;
      if (sx * cx + sy * cy > 0) {
        sx = -sx;
        sy = -sy;
      }
      best = { id: m.id, time: t, ...this.safeSide(tuning, me, sx, sy) };
    }

    // The Mind Ray is a beam, not a projectile: step out of it sideways.
    if (!best && skill.avoidHazards >= 1 && enemy.vars.rayOn && traceRay(world, tuning, enemy, enemy.aimAngle).hitFighterId === me.id) {
      if (!this.firstSeen.has(BEAM_ID)) this.firstSeen.set(BEAM_ID, world.time);
      if (world.time - this.firstSeen.get(BEAM_ID)! >= skill.reactionTime) {
        const a = enemy.aimAngle;
        best = { id: BEAM_ID - Math.floor(world.time), time: 0.2, ...this.safeSide(tuning, me, -Math.sin(a) * this.strafeSign(), Math.cos(a) * this.strafeSign()) };
      }
    } else if (!enemy.vars.rayOn) this.firstSeen.delete(BEAM_ID);
    return best;
  }

  private strafeSign(): number {
    return this.strafeDir === 0 ? 1 : this.strafeDir;
  }

  /** Dodge direction, flipped if it would run us into the arena wall. */
  private safeSide(tuning: Tuning, me: Fighter, sx: number, sy: number): { sideX: number; sideY: number } {
    if (!inArena(tuning, me.x + sx * 120, me.y + sy * 120, 30)) return { sideX: -sx, sideY: -sy };
    return { sideX: sx, sideY: sy };
  }
}

const BEAM_ID = -1_000_000; // threat id used for an enemy Mind Ray

/** Do-nothing ticks in a script. */
function wait(n: number): ScriptStep[] {
  return Array.from({ length: n }, () => () => {});
}

/** The steps for dragging out a wall or mirror (enter placing mode, drag A -> B, leave placing mode). */
function dragPlace(slot: 'ability1', ax: number, ay: number, bx: number, by: number): ScriptStep[] {
  return [
    (i) => (i.buttons[slot] = true),
    () => {},
    (i) => {
      i.aimX = ax;
      i.aimY = ay;
      i.buttons.primary = true;
    },
    (i) => {
      i.aimX = bx;
      i.aimY = by;
      i.buttons.primary = true;
    },
    (i) => {
      i.aimX = bx;
      i.aimY = by;
    },
    (i, m) => {
      if (m.placing) i.buttons[slot] = true; // leave placing mode (also if the spot was blocked)
    },
    () => {},
  ];
}

/** A segment across the line from `a` towards `b`, `ahead` units out from `a`, `half` long each way (optionally tilted). */
function wallAcross(a: { x: number; y: number }, b: { x: number; y: number }, ahead: number, half: number, tilt = 0) {
  const d = dist(a.x, a.y, b.x, b.y) || 1;
  const mx = a.x + ((b.x - a.x) / d) * ahead;
  const my = a.y + ((b.y - a.y) / d) * ahead;
  const ang = Math.atan2(b.y - a.y, b.x - a.x) + Math.PI / 2 + tilt;
  return { ax: mx + Math.cos(ang) * half, ay: my + Math.sin(ang) * half, bx: mx - Math.cos(ang) * half, by: my - Math.sin(ang) * half };
}

/**
 * A mirror off to one side of the line between us, angled so a shot from `me` that hits
 * its middle bounces straight at `enemy` (its surface faces halfway between the two).
 */
function bankMirror(me: Fighter, enemy: Fighter, side: number, half: number) {
  const d = dist(me.x, me.y, enemy.x, enemy.y) || 1;
  const px = (-(enemy.y - me.y) / d) * side;
  const py = ((enemy.x - me.x) / d) * side;
  const off = clamp(d * 0.45, 120, 220);
  const mx = (me.x + enemy.x) / 2 + px * off;
  const my = (me.y + enemy.y) / 2 + py * off;
  const u1 = norm(me.x - mx, me.y - my);
  const u2 = norm(enemy.x - mx, enemy.y - my);
  const n = norm(u1.x + u2.x, u1.y + u2.y); // the mirror's surface faces this way
  if (!Number.isFinite(n.x)) return null;
  const dx = -n.y;
  const dy = n.x;
  return { ax: mx + dx * half, ay: my + dy * half, bx: mx - dx * half, by: my - dy * half };
}

/**
 * A shot off one of our mirrors that bounces into the enemy: aim at the enemy's
 * reflection in the mirror. Returns the aim point, or null if no mirror works.
 */
function findBankShot(world: World, me: Fighter, enemy: Fighter, mirrors: Placeable[]): { x: number; y: number } | null {
  for (const m of mirrors) {
    if (m.shape !== 'segment') continue;
    // Both of us have to be on the mirror's shiny side... well, the same side.
    if (!sameSide(m, me.x, me.y, enemy.x, enemy.y)) continue;
    const img = reflectPoint(m, enemy.x, enemy.y);
    const t = segmentIntersect(me.x, me.y, img.x, img.y, m.x1, m.y1, m.x2, m.y2);
    if (t < 0) continue;
    const hx = me.x + (img.x - me.x) * t;
    const hy = me.y + (img.y - me.y) * t;
    // Keep away from the very ends of the mirror.
    if (Math.min(dist(hx, hy, m.x1, m.y1), dist(hx, hy, m.x2, m.y2)) < 12) continue;
    // Pull the two legs back from the mirror a little so the mirror itself doesn't count as "in the way".
    const back = norm(me.x - hx, me.y - hy);
    const out = norm(enemy.x - hx, enemy.y - hy);
    if (lineBlocked(world, me.x, me.y, hx + back.x * 16, hy + back.y * 16)) continue;
    if (lineBlocked(world, hx + out.x * 16, hy + out.y * 16, enemy.x, enemy.y)) continue;
    return { x: hx, y: hy };
  }
  return null;
}

/** Is the straight line A -> B blocked by a structure or a physics object? */
function lineBlocked(world: World, ax: number, ay: number, bx: number, by: number, pad = 6): boolean {
  for (const p of world.placeables) if (pathHits(p, ax, ay, bx, by, pad) >= 0) return true;
  for (const o of world.objects) if (segmentCircle(ax, ay, bx, by, o.x, o.y, o.radius + pad) >= 0) return true;
  return false;
}

/** Is everything on the straight line between us the enemy's (breakable for us), and is there something? */
function onlyEnemyInTheWay(world: World, me: Fighter, enemy: Fighter): boolean {
  let any = false;
  for (const p of world.placeables) {
    if (pathHits(p, me.x, me.y, enemy.x, enemy.y, 6) < 0) continue;
    if (p.ownerId === me.id) return false;
    any = true;
  }
  for (const o of world.objects) {
    if (segmentCircle(me.x, me.y, enemy.x, enemy.y, o.x, o.y, o.radius + 6) < 0) continue;
    if (o.ownerId === me.id) return false;
    any = true;
  }
  return any;
}

/** A push away from nearby enemy tumbleweeds and enemy slime. */
function hazardPush(world: World, me: Fighter): { x: number; y: number } {
  let x = 0;
  let y = 0;
  const away = (hx: number, hy: number, reach: number, strength: number) => {
    const d = dist(me.x, me.y, hx, hy);
    if (d >= reach || d < 0.01) return;
    const k = (1 - d / reach) * strength;
    x += ((me.x - hx) / d) * k;
    y += ((me.y - hy) / d) * k;
  };
  for (const o of world.objects) if (o.kind === 'sheriff_bramble' && o.ownerId !== me.id) away(o.x, o.y, o.radius + me.radius + 90, 2);
  for (const z of world.zones) if (z.ownerId !== me.id) away(z.x, z.y, z.radius + me.radius + 20, 1.5);
  return { x, y };
}

/** Seconds until a shot at `speed` from me would meet the target, if they keep moving the same way. */
function interceptTime(me: Fighter, target: Fighter, speed: number): number {
  if (!Number.isFinite(speed)) return 0; // instant (a beam)
  const rx = target.x - me.x;
  const ry = target.y - me.y;
  const a = target.vx * target.vx + target.vy * target.vy - speed * speed;
  const b = 2 * (rx * target.vx + ry * target.vy);
  const c = rx * rx + ry * ry;
  const fallback = Math.sqrt(c) / speed;
  if (Math.abs(a) < 1e-6) return b < 0 ? -c / b : fallback;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return fallback;
  const s = Math.sqrt(disc);
  const t1 = (-b - s) / (2 * a);
  const t2 = (-b + s) / (2 * a);
  const t = Math.min(t1 > 0 ? t1 : Infinity, t2 > 0 ? t2 : Infinity);
  return Number.isFinite(t) ? Math.min(t, 2) : fallback;
}

function norm(x: number, y: number): { x: number; y: number } {
  const l = Math.hypot(x, y);
  return { x: x / l, y: y / l };
}

function angleDiff(a: number, b: number): number {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

function inArena(t: Tuning, x: number, y: number, margin: number): boolean {
  const s = t.world.arenaSize;
  return x >= margin && y >= margin && x <= s - margin && y <= s - margin;
}

/** Which side of a segment structure's line a point is on (+ or -). */
function sideOf(p: Placeable, x: number, y: number): number {
  return (p.x2 - p.x1) * (y - p.y1) - (p.y2 - p.y1) * (x - p.x1);
}

function sameSide(p: Placeable, ax: number, ay: number, bx: number, by: number): boolean {
  return sideOf(p, ax, ay) * sideOf(p, bx, by) > 0;
}

function oppositeSides(p: Placeable, ax: number, ay: number, bx: number, by: number): boolean {
  return p.shape === 'segment' && sideOf(p, ax, ay) * sideOf(p, bx, by) < 0;
}

/** A point mirrored across a segment structure's line. */
function reflectPoint(p: Placeable, x: number, y: number): { x: number; y: number } {
  const dx = p.x2 - p.x1;
  const dy = p.y2 - p.y1;
  const len2 = dx * dx + dy * dy || 1;
  const t = ((x - p.x1) * dx + (y - p.y1) * dy) / len2;
  const fx = p.x1 + dx * t;
  const fy = p.y1 + dy * t;
  return { x: 2 * fx - x, y: 2 * fy - y };
}

function preferredRange(classId: string, t: Tuning): number {
  if (classId === 'mage') return t.bot.rangeMage;
  if (classId === 'sheriff') return t.bot.rangeSheriff;
  if (classId === 'builder') return t.bot.rangeBuilder;
  if (classId === 'frog') return t.bot.rangeFrog;
  return t.bot.rangeRefractor;
}

/** How fast this fighter's main weapon flies right now (for leading shots). Infinity = instant. */
function weaponSpeed(f: Fighter, t: Tuning): number {
  if (f.classId === 'mage') return t.mage.staff.speed;
  if (f.classId === 'sheriff') return t.sheriff.gun.speed;
  if (f.classId === 'builder') return t.builder.nailgun.speed;
  if (f.classId === 'frog') return (t.frog.belch.minSpeed + t.frog.belch.maxSpeed) / 2;
  if (f.vars.rayOn) return Infinity;
  return t.refractor.shotgun.speed;
}
