/**
 * The bot opponent. Each tick it looks at the World and produces a PlayerInput,
 * exactly like a human's keyboard and mouse would. So it plays by the same rules,
 * and it runs headless (the host will run it in online games later, too).
 *
 * What it does:
 *  - keeps a preferred distance from you, strafing side to side, away from walls
 *  - aims at you (leading your movement a bit, with some random error)
 *  - fires its weapon and sometimes uses its other abilities
 *  - sometimes dodges shots coming at it, or uses a defensive ability
 *
 * Two difficulties, 'normal' and 'hard'. Their numbers are in tuning.bot.normal and tuning.bot.hard;
 * the bot only notices a shot 
eactionTime seconds after it appears.
 */
import type { Tuning } from '../config/tuning.ts';
import { emptyInput, type Fighter, type PlayerInput, type Projectile, type World } from './types.ts';
import { clamp, dist } from './math.ts';
import { isReady } from './abilities.ts';
import { distanceTo } from './placeables.ts';

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

export type BotDifficulty = 'normal' | 'hard';

/** One planned tick of a multi-step move (like placing a structure). */
type ScriptStep = (input: PlayerInput, me: Fighter, enemy: Fighter) => void;

/** A shot heading at the bot. */
interface Threat {
  p: Projectile;
  time: number; // seconds until closest approach
  sideX: number; // which way to step to get out of its path
  sideY: number;
}

export class BotBrain {
  private rng: () => number;
  private seq = 0;
  private strafeDir = 1;
  private strafeT = 0;
  private noiseX = 0;
  private noiseY = 0;
  private noiseT = 0;
  private rayT = 0; // Refractor: seconds left of the current beam burst
  private script: ScriptStep[] = [];
  private dodgeDecisions = new Map<number, boolean>(); // projectile id -> decided to dodge it?
  private defendDecisions = new Map<number, boolean>();
  private firstSeen = new Map<number, number>(); // projectile id -> world time the bot first saw it
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
    const skill = tuning.bot[this.difficulty];
    const dt = 1 / tuning.world.tickRate;
    const d = dist(me.x, me.y, enemy.x, enemy.y);

    // ---- Aim: lead the target a bit, plus some wobble ----
    this.noiseT -= dt;
    if (this.noiseT <= 0) {
      this.noiseT = 0.25 + this.rng() * 0.25;
      this.noiseX = (this.rng() * 2 - 1) * skill.aimJitter;
      this.noiseY = (this.rng() * 2 - 1) * skill.aimJitter;
    }
    const lead = (d / weaponSpeed(me.classId, tuning)) * skill.leadFactor;
    input.aimX = enemy.x + enemy.vx * lead + this.noiseX;
    input.aimY = enemy.y + enemy.vy * lead + this.noiseY;

    // ---- Move: keep the preferred range, strafe, avoid walls ----
    this.strafeT -= dt;
    if (this.strafeT <= 0) {
      this.strafeT = b.strafeMin + this.rng() * (b.strafeMax - b.strafeMin);
      this.strafeDir = this.rng() < skill.pauseChance ? 0 : this.rng() < 0.5 ? -1 : 1;
    }
    const toX = (enemy.x - me.x) / (d || 1);
    const toY = (enemy.y - me.y) / (d || 1);
    const range = preferredRange(me.classId, tuning);
    const radial = d > range + 60 ? 1 : d < range - 60 ? -1 : 0;
    let mx = toX * radial + -toY * this.strafeDir;
    let my = toY * radial + toX * this.strafeDir;
    const size = tuning.world.arenaSize;
    if (me.x < b.wallMargin) mx += 1.5;
    if (me.x > size - b.wallMargin) mx -= 1.5;
    if (me.y < b.wallMargin) my += 1.5;
    if (me.y > size - b.wallMargin) my -= 1.5;

    // ---- Dodge: step out of the path of a shot coming at us ----
    const threat = this.findThreat(world, tuning, me, skill.reactionTime);
    let speed = skill.moveSpeed;
    if (threat && this.decide(this.dodgeDecisions, threat.p.id, skill.dodgeChance)) {
      mx = threat.sideX;
      my = threat.sideY;
      speed = 1;
    }
    const len = Math.hypot(mx, my);
    if (len > 0.01) {
      input.moveX = (mx / len) * speed;
      input.moveY = (my / len) * speed;
    }

    // ---- A planned multi-tick move (placing a structure) takes over ----
    const step = this.script.shift();
    if (step) {
      step(input, me, enemy);
      return input;
    }

    // ---- Use abilities ----
    const tryAbility = () => this.rng() < skill.abilityRate * dt;
    const urgent = threat && threat.time < 0.3 && this.decide(this.defendDecisions, threat.p.id, skill.defendChance);
    if (me.classId === 'mage') this.playMage(world, tuning, input, me, enemy, d, urgent ? threat : null, tryAbility);
    else if (me.classId === 'sheriff') this.playSheriff(tuning, input, me, d, urgent ? threat : null, tryAbility);
    else if (me.classId === 'refractor') this.playRefractor(world, tuning, input, me, enemy, d, urgent ? threat : null, tryAbility, dt);
    else if (me.classId === 'builder') this.playBuilder(world, tuning, input, me, enemy, d, urgent ? threat : null, tryAbility);
    return input;
  }

  // ------------------------------------------------------------- classes ----

  private playMage(world: World, tuning: Tuning, input: PlayerInput, me: Fighter, enemy: Fighter, d: number, threat: Threat | null, tryAbility: () => boolean): void {
    // Staff: keep firing.
    if (d < 950) input.buttons.primary = true;
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
    const incoming = world.projectiles.filter((p) => p.ownerId !== me.id && approaching(p, me) && dist(p.x, p.y, me.x, me.y) < 350).length;
    if (incoming >= 2 && isReady(me, 'ability2')) input.buttons.ability2 = true;
    // Watchtower: press C, then click a spot between us.
    if (isReady(me, 'ability1') && d < 650 && tryAbility()) {
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

  private playSheriff(tuning: Tuning, input: PlayerInput, me: Fighter, d: number, threat: Threat | null, tryAbility: () => boolean): void {
    // The revolver fires once per click, so click about 6 times a second.
    me.vars.botClick = ((me.vars.botClick ?? 0) + 1) % 10;
    if (d < 750 && me.vars.botClick < 5) input.buttons.primary = true;
    if (threat && isReady(me, 'mobility')) {
      input.moveX = threat.sideX;
      input.moveY = threat.sideY;
      input.buttons.mobility = true; // roll out of the way
    }
    if (!tryAbility()) return;
    if (isReady(me, 'secondary') && d > 150 && d < tuning.sheriff.lasso.range * 0.85) input.buttons.secondary = true;
    else if (isReady(me, 'ability1') && d < 320) input.buttons.ability1 = true;
    else if (isReady(me, 'ability2')) input.buttons.ability2 = true;
  }

  private playBuilder(world: World, tuning: Tuning, input: PlayerInput, me: Fighter, enemy: Fighter, d: number, threat: Threat | null, tryAbility: () => boolean): void {
    if (d < 700) input.buttons.primary = true; // nail gun
    if (threat && isReady(me, 'mobility')) input.buttons.mobility = true; // dash out of the way
    const reach = me.radius + tuning.builder.hammer.range;
    // Hammer: when the enemy is close, or to fling a piece of our furniture that's between us.
    const furniture = world.objects.find((o) => o.ownerId === me.id && o.kind.startsWith('builder_furniture') && dist(o.x, o.y, me.x, me.y) < reach + o.radius);
    if (isReady(me, 'secondary') && (d < reach + enemy.radius || furniture)) input.buttons.secondary = true;
    // Furniture: build some cover towards the enemy.
    if (isReady(me, 'ability2') && d < 600 && tryAbility()) input.buttons.ability2 = true;
  }

  private playRefractor(world: World, tuning: Tuning, input: PlayerInput, me: Fighter, enemy: Fighter, d: number, threat: Threat | null, tryAbility: () => boolean, dt: number): void {
    // Mind Ray in short bursts, shotgun otherwise.
    this.rayT -= dt;
    if (this.rayT > 0) input.buttons.secondary = true;
    else if (d < 560) input.buttons.primary = true;
    if (this.rayT <= 0 && d < 700 && (me.vars.rayPool ?? tuning.refractor.ray.pool) > 50 && this.rng() < 0.6 * dt) this.rayT = 0.6 + this.rng() * 0.6;

    if (threat && isReady(me, 'mobility')) input.buttons.mobility = true; // dash out of the way
    // Shatter when the enemy stands near a mirror.
    const mirrors = world.placeables.filter((p) => p.kind === 'refractor_mirror' && p.ownerId === me.id);
    if (isReady(me, 'ability2') && mirrors.some((m) => distanceTo(m, enemy.x, enemy.y) < tuning.refractor.shatter.radius * 0.8)) input.buttons.ability2 = true;

    // Mirror: enter mirror mode, drag one out across the line between us, leave.
    if (isReady(me, 'ability1') && mirrors.length < 2 && tryAbility()) {
      const midX = me.x + ((enemy.x - me.x) / d) * 140;
      const midY = me.y + ((enemy.y - me.y) / d) * 140;
      const tilt = (this.rng() - 0.5) * 1.2;
      const ang = Math.atan2(enemy.y - me.y, enemy.x - me.x) + Math.PI / 2 + tilt;
      const half = tuning.refractor.mirror.maxLength * 0.4;
      const ax = midX + Math.cos(ang) * half;
      const ay = midY + Math.sin(ang) * half;
      const bx = midX - Math.cos(ang) * half;
      const by = midY - Math.sin(ang) * half;
      this.script = [
        (i) => (i.buttons.ability1 = true),
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
          if (m.placing) i.buttons.ability1 = true; // leave mirror mode
        },
        () => {},
      ];
    }
  }

  // ------------------------------------------------------------- helpers ----

  /** Make a yes/no decision once per projectile, then stick to it. */
  private decide(memory: Map<number, boolean>, id: number, chance: number): boolean {
    let yes = memory.get(id);
    if (yes === undefined) {
      yes = this.rng() < chance;
      memory.set(id, yes);
      if (memory.size > 200) memory.delete(memory.keys().next().value!);
    }
    return yes;
  }

  /** The enemy shot that will pass closest to us soon, if it would hit. */
  private findThreat(world: World, tuning: Tuning, me: Fighter, reactionTime: number): Threat | null {
    let best: Threat | null = null;
    // Forget shots that no longer exist.
    for (const id of this.firstSeen.keys()) if (!world.projectiles.some((p) => p.id === id)) this.firstSeen.delete(id);
    for (const p of world.projectiles) {
      if (p.ownerId === me.id) continue;
      // Reaction time: a shot is ignored until the bot has 'seen' it for long enough.
      if (!this.firstSeen.has(p.id)) this.firstSeen.set(p.id, world.time);
      if (world.time - this.firstSeen.get(p.id)! < reactionTime) continue;
      const speed2 = p.vx * p.vx + p.vy * p.vy;
      if (speed2 < 1) continue;
      const rx = me.x - p.x;
      const ry = me.y - p.y;
      const t = (rx * p.vx + ry * p.vy) / speed2; // time of closest approach
      if (t <= 0 || t > 0.7) continue;
      const cx = p.x + p.vx * t - me.x;
      const cy = p.y + p.vy * t - me.y;
      const miss = Math.hypot(cx, cy);
      if (miss > tuning.player.projectileHitRadius + p.radius * tuning.projectiles.hitboxScale + 18) continue;
      if (best && best.time <= t) continue;
      // Step sideways, away from where the shot will pass.
      const sp = Math.sqrt(speed2);
      let sx = -p.vy / sp;
      let sy = p.vx / sp;
      if (sx * cx + sy * cy > 0) {
        sx = -sx;
        sy = -sy;
      }
      best = { p, time: t, sideX: sx, sideY: sy };
    }
    return best;
  }
}

function approaching(p: Projectile, f: Fighter): boolean {
  return (f.x - p.x) * p.vx + (f.y - p.y) * p.vy > 0;
}

function preferredRange(classId: string, t: Tuning): number {
  if (classId === 'mage') return t.bot.rangeMage;
  if (classId === 'sheriff') return t.bot.rangeSheriff;
  if (classId === 'builder') return t.bot.rangeBuilder;
  return t.bot.rangeRefractor;
}

/** Roughly how fast this class's main weapon flies (for leading shots). */
function weaponSpeed(classId: string, t: Tuning): number {
  if (classId === 'mage') return t.mage.staff.speed;
  if (classId === 'sheriff') return t.sheriff.gun.speed;
  if (classId === 'builder') return t.builder.nailgun.speed;
  return t.refractor.shotgun.speed;
}
