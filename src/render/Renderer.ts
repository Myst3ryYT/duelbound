/**
 * Draws the game. Reads the World, never changes it.
 *
 * The simulation runs at a fixed 60 ticks per second. To look smooth on fast
 * monitors, moving things are drawn part-way between their last two tick
 * positions, and the local player's facing and placement previews follow the
 * mouse every frame instead of every tick.
 *
 * Anything that belongs to the OTHER side (shots, structures, objects, beams)
 * is tinted red, so you can always tell at a glance what can hurt you.
 */
import type { Tuning } from '../config/tuning.ts';
import type { Fighter, GameEvent, PhysObject, Placeable, Projectile, World } from '../sim/types.ts';
import type { PlacementPreview } from '../sim/abilities.ts';
import { getClass } from '../sim/classes/registry.ts';
import { tracePath } from '../sim/trace.ts';
import { traceRay } from '../sim/classes/refractor/ray.ts';
import { ART_PIXEL } from '../config/assets.ts';
import { findSprite, getFacings, getSprite, type Facings, type Sprite } from './sprites.ts';
import { SCREEN_H, SCREEN_W, View } from './view.ts';
import { drawHud, type HudInfo } from './hud.ts';

interface FloatingNumber {
  targetId: number;
  amount: number;
  x: number;
  y: number;
  age: number;
  lastHit: number; // renderer clock time of the latest hit added to this number
  pop: number; // 1 right after a hit is added, fades to 0 (makes it bump bigger)
  color: string;
}

/** A short-lived visual effect (expanding ring or burst), in world space. */
interface Effect {
  fx: 'ring' | 'burst';
  x: number;
  y: number;
  color: string;
  radius: number;
  duration: number;
  age: number;
}

/** A tiny spark flying out of a hit or burst (looks only). */
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  color: string;
}

/** A fading line left behind a fast projectile (looks only). */
interface Trail {
  points: { x: number; y: number; t: number }[];
  life: number; // seconds each point stays visible
  color: string;
  alive: boolean; // the projectile still exists
}

/** Per-fighter visual state that the simulation doesn't care about. */
interface FighterFx {
  trailHp: number; // the white "recent damage" part of the HP bar
  trailHold: number; // seconds before the trail starts shrinking
}

/** What the renderer needs to know about the local player, beyond the World. */
export interface LocalView {
  playerId: number;
  aim: { x: number; y: number } | null; // crosshair position in world units, this frame
  preview: PlacementPreview | null; // ghost of a structure being placed
}

const TRAIL_COLORS: Record<string, string> = { sheriff_pierce: '#ffd27a' };
const ENEMY_TINT = 'rgba(255,40,40,0.55)'; // red wash over enemy sprites
const ENEMY_TRAIL = '#ff4a4a';

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private numbers: FloatingNumber[] = [];
  private effects: Effect[] = [];
  private trails = new Map<number, Trail>();
  private fx = new Map<number, FighterFx>();
  private clock = 0; // seconds, for animations
  private mergeWindow = 0.35; // copied from tuning.visuals.damageNumberMerge every frame
  private localId = 0; // the local player's fighter id (anything owned by someone else is "enemy")
  private tintCache = new Map<CanvasImageSource, HTMLCanvasElement>();
  private whiteCache = new Map<CanvasImageSource, HTMLCanvasElement>();
  private vis: Tuning['visuals'] | null = null; // copied from tuning every frame (the juice settings)
  private flash = new Map<number, number>(); // fighter id -> seconds left of the white hit flash
  private shakeAmp = 0; // current screen shake strength (pixels), fades to 0
  private particles: Particle[] = [];

  constructor(
    canvas: HTMLCanvasElement,
    readonly view: View,
  ) {
    this.ctx = canvas.getContext('2d')!;
  }

  /** React to simulation events with visual effects. */
  onEvent(e: GameEvent, world: World): void {
    if (e.type === 'damage') {
      const target = world.fighters.find((f) => f.id === e.targetId);
      const y = e.y - (target?.radius ?? 20) - 10;
      // Rapid hits on the same target add up into one number instead of a pile of small ones.
      const recent = this.numbers.find((n) => n.targetId === e.targetId && this.clock - n.lastHit <= this.mergeWindow);
      if (recent) {
        recent.amount += e.amount;
        recent.age = 0;
        recent.lastHit = this.clock;
        recent.pop = 1;
        recent.x = e.x;
        recent.y = y;
      } else {
        this.numbers.push({ targetId: e.targetId, amount: e.amount, x: e.x + (Math.random() - 0.5) * 30, y, age: 0, lastHit: this.clock, pop: 1, color: '#ffffff' });
      }
      const fx = this.fx.get(e.targetId);
      if (fx) fx.trailHold = 0;
      this.hitJuice(e.targetId, e.amount, e.x, e.y);
    } else if (e.type === 'fx') {
      this.effects.push({ ...e, age: 0 });
      if (this.vis) this.sparks(e.x, e.y, e.fx === 'burst' ? 5 : 3, e.color, e.radius * 2);
    } else if (e.type === 'bounce') {
      this.trails.get(e.projectileId)?.points.push({ x: e.x, y: e.y, t: this.clock });
    }
  }

  /** Juice for a hit: white flash on most hits, screen shake on big ones, sparks on all. */
  private hitJuice(targetId: number, amount: number, x: number, y: number): void {
    const v = this.vis;
    if (!v) return;
    if (amount >= v.flashMinDamage) this.flash.set(targetId, v.flashTime);
    if (amount >= v.shakeMinDamage) this.shakeAmp = Math.max(this.shakeAmp, Math.min(v.shakeMax, v.shakeBase + amount * v.shakePerDamage));
    this.sparks(x, y, Math.min(12, 3 + Math.round(amount / 10)), '#ffffff', 220);
  }

  /** Spawn `n` little sparks flying out from (x, y). */
  private sparks(x: number, y: number, n: number, color: string, speed: number): void {
    const v = this.vis;
    if (!v || v.particles <= 0) return;
    const count = Math.max(1, Math.round(n * v.particles));
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.6);
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, age: 0, life: 0.2 + Math.random() * 0.25, size: 3 + Math.random() * 3, color: i % 3 === 0 ? '#ffd34d' : color });
    }
    if (this.particles.length > 300) this.particles.splice(0, this.particles.length - 300);
  }

  /** Blank the screen (used behind the menus). */
  clear(): void {
    this.view.fit();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.fillStyle = '#0b0c10';
    this.ctx.fillRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
  }

  /** Forget visual state (e.g. when a new match starts). */
  reset(): void {
    this.numbers = [];
    this.effects = [];
    this.particles = [];
    this.flash.clear();
    this.shakeAmp = 0;
    this.trails.clear();
    this.fx.clear();
  }

  /**
   * Draw one frame.
   * @param prev   positions from the previous tick, to smooth motion between ticks
   * @param alpha  how far we are between the previous tick (0) and the current one (1)
   */
  render(
    world: World,
    tuning: Tuning,
    prev: Map<number, { x: number; y: number }>,
    alpha: number,
    dt: number,
    local: LocalView,
    hud: HudInfo,
    crosshair: { x: number; y: number } | null,
  ): void {
    const { ctx, view } = this;
    this.clock += dt;
    this.localId = local.playerId;
    this.mergeWindow = tuning.visuals.damageNumberMerge;
    this.vis = tuning.visuals;
    view.arenaSize = tuning.world.arenaSize;
    view.fit();

    // Clear the whole window to black, then switch to 1920x1080 screen units.
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.setTransform(view.scale * dpr, 0, 0, view.scale * dpr, view.offsetX * dpr, view.offsetY * dpr);
    ctx.imageSmoothingEnabled = false; // chunky pixels

    ctx.fillStyle = '#14151b';
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

    const pos = (id: number, x: number, y: number) => {
      const p = prev.get(id);
      return p ? { x: p.x + (x - p.x) * alpha, y: p.y + (y - p.y) * alpha } : { x, y };
    };
    const fighterPos = new Map<number, { x: number; y: number }>();
    for (const f of world.fighters) fighterPos.set(f.id, pos(f.id, f.x, f.y));

    // ---- World space (arena) ----
    ctx.save();
    // Screen shake: the arena jumps around a little, then settles. (The HUD stays still.)
    this.shakeAmp = Math.max(0, this.shakeAmp - tuning.visuals.shakeDecay * dt);
    const shakeX = (Math.random() * 2 - 1) * this.shakeAmp;
    const shakeY = (Math.random() * 2 - 1) * this.shakeAmp;
    ctx.translate(view.arenaX + shakeX, view.arenaY + shakeY);
    for (const [id, t] of this.flash) {
      if (t - dt <= 0) this.flash.delete(id);
      else this.flash.set(id, t - dt);
    }
    this.drawArena(tuning.world.arenaSize);
    for (const p of world.placeables) this.drawPlaceable(p, tuning);
    for (const o of world.objects) {
      const op = pos(o.id, o.x, o.y);
      this.drawObject(o, op.x, op.y);
    }
    this.drawRopes(world, fighterPos, pos);
    for (const f of world.fighters) {
      const fp = fighterPos.get(f.id)!;
      // The local player faces the crosshair every frame, not just every tick.
      const angle = f.id === local.playerId && local.aim ? Math.atan2(local.aim.y - fp.y, local.aim.x - fp.x) : f.aimAngle;
      this.drawFighter(world, f, fp.x, fp.y, angle, tuning);
    }
    this.updateTrails(world);
    this.drawTrails();
    for (const p of world.projectiles) {
      // Trail shots are too fast to blend between ticks (they may have bounced in between).
      const pp = p.trail > 0 ? { x: p.x, y: p.y } : pos(p.id, p.x, p.y);
      this.drawProjectile(p, pp.x, pp.y, tuning);
    }
    if (local.preview) this.drawPreview(local.preview);
    this.drawEffects(dt);
    this.drawParticles(dt);
    this.drawNumbers(tuning, dt);
    ctx.restore();

    // ---- Screen space (HUD) ----
    this.updateHpTrails(world, tuning, dt);
    drawHud(ctx, world, hud, (id) => this.fx.get(id)?.trailHp ?? 0);

    if (crosshair) {
      const me = world.fighters.find((f) => f.id === local.playerId);
      if (me?.placing) this.drawPlacingCrosshair(me, crosshair);
      else this.drawSprite(getSprite('crosshair'), crosshair.x, crosshair.y, 0);
      this.drawCrosshairBar(world, tuning, local, crosshair, alpha);
    }
  }

  private drawArena(size: number): void {
    const { ctx } = this;
    // Floor: repeat the floor tile.
    const floor = getSprite('floor_tile');
    for (let y = 0; y < size; y += floor.size)
      for (let x = 0; x < size; x += floor.size) {
        const w = Math.min(floor.size, size - x);
        const h = Math.min(floor.size, size - y);
        ctx.drawImage(floor.image, x, y, w, h);
      }
    // Border wall: repeat the wall tile around the outside edge.
    const wall = getSprite('wall_tile');
    const t = wall.size;
    for (let i = -t; i < size + t; i += t) {
      ctx.drawImage(wall.image, i, -t, t, t);
      ctx.drawImage(wall.image, i, size, t, t);
    }
    for (let i = 0; i < size; i += t) {
      ctx.drawImage(wall.image, -t, i, t, t);
      ctx.drawImage(wall.image, size, i, t, t);
    }
  }

  private drawFighter(world: World, f: Fighter, x: number, y: number, angle: number, tuning: Tuning): void {
    const { ctx } = this;
    // Soft shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(x, y + f.radius * 0.7, f.radius * 0.9, f.radius * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Sheriff piercing bullet: show the predicted path, bounces included, during the delay.
    if (f.vars.pierceT > 0) {
      const pc = tuning.sheriff.pierce;
      const start = f.radius + pc.size + 4;
      const path = tracePath(world, tuning, x + Math.cos(angle) * start, y + Math.sin(angle) * start, angle, {
        ownerId: f.id,
        length: pc.previewLength,
        radius: pc.size * tuning.projectiles.hitboxScale,
        bounces: 0,
        wallsBounce: false,
        maxMirrors: 20,
      });
      const pulse = 0.5 + 0.5 * Math.sin(this.clock * 40);
      ctx.strokeStyle = `rgba(255,80,60,${0.35 + 0.4 * pulse})`;
      ctx.lineWidth = 3;
      ctx.setLineDash([14, 10]);
      ctx.beginPath();
      path.points.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
      ctx.stroke();
      ctx.setLineDash([]);
      for (const pt of path.points.slice(1, -1)) {
        ctx.fillStyle = 'rgba(255,120,90,0.9)';
        ctx.fillRect(pt.x - 4, pt.y - 4, 8, 8); // bounce points
      }
    }

    // Refractor Mind Ray: the beam.
    if (f.vars.rayOn) {
      const beam = traceRay(world, tuning, f, angle);
      const base = tuning.refractor.ray.width;
      const flicker = 1 + 0.15 * Math.sin(this.clock * 50);
      ctx.lineCap = 'round';
      for (let i = 1; i < beam.points.length; i++) {
        const a = beam.points[i - 1];
        const b = beam.points[i];
        const w = base * flicker;
        const enemy = this.isEnemy(f.id);
        for (const [color, width] of [
          [enemy ? 'rgba(255,60,60,0.35)' : 'rgba(197,140,255,0.35)', w * 2.6],
          [enemy ? '#ff5050' : '#c58cff', w],
          ['#ffffff', w * 0.35],
        ] as const) {
          ctx.strokeStyle = color;
          ctx.lineWidth = width;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
      ctx.lineCap = 'butt';
    }

    // Mage teleport: show the landing marker, and shrink while casting.
    let alpha = 1;
    if (f.vars.tpActive) {
      const k = 1 - Math.max(0, f.vars.tpTime) / Math.max(0.001, tuning.mage.teleport.castTime);
      this.drawSprite(getSprite('teleport_marker'), f.vars.tpX, f.vars.tpY, this.clock * 4, 0.5 + 0.5 * k);
      alpha = 1 - k * 0.8;
    }

    // Sheriff roll: spin once over the roll, see-through while invincible.
    let spin = 0;
    if (f.vars.rollT > 0) spin = (1 - f.vars.rollT / Math.max(0.001, tuning.sheriff.roll.duration)) * Math.PI * 2;
    if (f.invulnT > 0) alpha *= 0.5;

    const spriteName = f.kind === 'dummy' ? 'dummy' : (getClass(f.classId)?.sprite ?? 'fighter_default');
    const sprite = findSprite(spriteName) ?? getSprite('fighter_default');
    // Dash: a few fading after-images behind.
    if (f.vars.dashT > 0) {
      for (let i = 1; i <= 3; i++) this.drawSprite(sprite, x - f.vars.dashDX * i * 18, y - f.vars.dashDY * i * 18, angle, 0.25 / i);
    }
    // Hit flash: solid white for a moment after most hits, and shaking + white for the whole hitstun.
    const stunned = f.hitstunT > 0;
    const white = stunned || (this.flash.get(f.id) ?? 0) > 0;
    const jx = stunned ? (Math.random() - 0.5) * 8 : 0;
    const jy = stunned ? (Math.random() - 0.5) * 8 : 0;
    const dirs = f.kind === 'dummy' ? undefined : getFacings(spriteName);
    if (dirs) {
      this.drawFacingCharacter(dirs, x + jx, y + jy, angle, spin, alpha, white);
    } else this.drawSprite(sprite, x + jx, y + jy, f.kind === 'dummy' ? 0 : angle + spin, alpha, sprite.size, false, white);


    // Builder hammer swing: a quick sweeping arc in front.
    if (f.vars.swingT > 0) {
      const h = tuning.builder.hammer;
      const k = 1 - f.vars.swingT / Math.max(0.001, h.swingTime); // 0 -> 1 over the swing
      const half = (h.arcDegrees * Math.PI) / 360;
      const a0 = f.vars.swingAngle - half;
      const reach = f.radius + h.range;
      ctx.fillStyle = this.isEnemy(f.id) ? `rgba(255,80,80,${0.35 * (1 - k)})` : `rgba(255,220,160,${0.35 * (1 - k)})`;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.arc(x, y, reach, a0, a0 + 2 * half * Math.min(1, k * 1.5));
      ctx.closePath();
      ctx.fill();
    }

    // Stunned: little stars circling over the head.
    if (f.stunT > 0) {
      ctx.fillStyle = '#ffe27a';
      for (let i = 0; i < 3; i++) {
        const a = this.clock * 6 + (i * Math.PI * 2) / 3;
        ctx.fillRect(x + Math.cos(a) * f.radius * 0.9 - 3, y - f.radius - 6 + Math.sin(a) * 6 - 3, 6, 6);
      }
    }
  }

  /** Lasso ropes: from the Sheriff to a flying lasso, or to whoever is being dragged. */
  private drawRopes(world: World, fighterPos: Map<number, { x: number; y: number }>, pos: (id: number, x: number, y: number) => { x: number; y: number }): void {
    const { ctx } = this;
    ctx.strokeStyle = '#d8b880';
    ctx.lineWidth = 3;
    const line = (a: { x: number; y: number }, b: { x: number; y: number }) => {
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    };
    for (const p of world.projectiles) {
      if (p.behavior !== 'lasso') continue;
      const owner = fighterPos.get(p.ownerId);
      if (owner) line(owner, pos(p.id, p.x, p.y));
    }
    for (const f of world.fighters) {
      if (!f.pullById) continue;
      const a = fighterPos.get(f.pullById);
      const b = fighterPos.get(f.id);
      if (a && b) line(a, b);
    }
  }

  private drawProjectile(p: Projectile, x: number, y: number, tuning: Tuning): void {
    const sprite = findSprite(p.kind);
    // Drawn a bit bigger than its radius because of the glow; the hitbox is set by tuning.
    const size = p.radius * 2 * 1.25;
    if (sprite) this.drawSprite(sprite, x, y, p.behavior === 'lasso' ? 0 : Math.atan2(p.vy, p.vx), 1, size, this.isEnemy(p.ownerId));
    else {
      this.ctx.fillStyle = '#fff';
      this.ctx.beginPath();
      this.ctx.arc(x, y, p.radius, 0, Math.PI * 2);
      this.ctx.fill();
    }
    // Projectiles that are being Switched get a gold outline so players can react.
    if (p.switchT > 0) {
      this.ctx.strokeStyle = 'rgba(255,211,77,0.9)';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(x, y, p.radius * tuning.projectiles.hitboxScale + 4, 0, Math.PI * 2);
      this.ctx.stroke();
    }
  }

  private drawObject(o: PhysObject, x: number, y: number): void {
    const { ctx } = this;
    const sprite = findSprite(o.kind);
    // Flung furniture: a motion streak behind it.
    if (o.armed && Math.hypot(o.vx, o.vy) > 200) {
      const sp = Math.hypot(o.vx, o.vy);
      ctx.strokeStyle = this.isEnemy(o.ownerId) ? 'rgba(255,80,80,0.5)' : 'rgba(255,220,160,0.5)';
      ctx.lineWidth = o.radius;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - (o.vx / sp) * o.radius * 2.5, y - (o.vy / sp) * o.radius * 2.5);
      ctx.stroke();
    }
    if (sprite) this.drawSprite(sprite, x, y, o.spin, o.life < 1 ? 0.4 + 0.6 * o.life : 1, o.radius * 2, this.isEnemy(o.ownerId));
    if (o.maxHp > 0 && o.hp < o.maxHp) {
      const w = o.radius * 2;
      ctx.fillStyle = '#000';
      ctx.fillRect(x - w / 2 - 2, y - o.radius - 16, w + 4, 8);
      ctx.fillStyle = '#e05050';
      ctx.fillRect(x - w / 2, y - o.radius - 14, w * Math.max(0, o.hp / o.maxHp), 4);
    }
    if (o.switchT > 0) {
      this.ctx.strokeStyle = 'rgba(255,211,77,0.9)';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(x, y, o.radius + 5, 0, Math.PI * 2);
      this.ctx.stroke();
    }
  }

  /** Record the head of every trail-leaving projectile, and let finished trails fade. */
  private updateTrails(world: World): void {
    for (const t of this.trails.values()) t.alive = false;
    for (const p of world.projectiles) {
      if (p.trail <= 0) continue;
      let t = this.trails.get(p.id);
      if (!t) {
        t = { points: [], life: p.trail, color: this.isEnemy(p.ownerId) ? ENEMY_TRAIL : (TRAIL_COLORS[p.kind] ?? '#ffffff'), alive: true };
        this.trails.set(p.id, t);
      }
      t.alive = true;
      t.points.push({ x: p.x, y: p.y, t: this.clock });
    }
    for (const [id, t] of this.trails) {
      t.points = t.points.filter((pt) => this.clock - pt.t < t.life);
      if (!t.alive && t.points.length === 0) this.trails.delete(id);
    }
  }

  private drawTrails(): void {
    const { ctx } = this;
    ctx.lineCap = 'round';
    for (const t of this.trails.values()) {
      for (let i = 1; i < t.points.length; i++) {
        const a = t.points[i - 1];
        const b = t.points[i];
        const fade = 1 - (this.clock - a.t) / t.life;
        ctx.strokeStyle = t.color;
        ctx.globalAlpha = Math.max(0, fade);
        ctx.lineWidth = 2 + 4 * fade;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    ctx.lineCap = 'butt';
  }

  /** Draw a sprite stretched along a line from (x1, y1) to (x2, y2). */
  private drawStretched(s: Sprite, x1: number, y1: number, x2: number, y2: number, thickness: number, alpha = 1, enemy = false): void {
    const { ctx } = this;
    const len = Math.hypot(x2 - x1, y2 - y1);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate((x1 + x2) / 2, (y1 + y2) / 2);
    ctx.rotate(Math.atan2(y2 - y1, x2 - x1));
    ctx.drawImage(enemy ? this.tinted(s.image) : s.image, -len / 2, -thickness / 2, len, thickness);
    ctx.restore();
  }

  private drawPlaceable(p: Placeable, tuning: Tuning): void {
    const { ctx } = this;
    const sprite = findSprite(p.kind);
    if (p.shape === 'segment') {
      // Mirrors / shield pieces: flash white in their last moments.
      const flash = p.breakT >= 0 && p.breakT < 0.6 ? 0.5 + 0.5 * Math.sin(this.clock * 40) : 0;
      if (sprite) this.drawStretched(sprite, p.x1, p.y1, p.x2, p.y2, p.radius * 2 * 1.4, 1, this.isEnemy(p.ownerId));
      if (flash) {
        ctx.strokeStyle = `rgba(255,255,255,${flash})`;
        ctx.lineWidth = p.radius * 2;
        ctx.beginPath();
        ctx.moveTo(p.x1, p.y1);
        ctx.lineTo(p.x2, p.y2);
        ctx.stroke();
      }
      if (p.hp < p.maxHp) {
        const w = 50;
        ctx.fillStyle = '#000';
        ctx.fillRect(p.x - w / 2 - 2, p.y - 22, w + 4, 8);
        ctx.fillStyle = '#e05050';
        ctx.fillRect(p.x - w / 2, p.y - 20, w * Math.max(0, p.hp / p.maxHp), 4);
      }
      return;
    }
    // Watchtower build-up: fades in while building, with a progress ring.
    let alpha = 1;
    let progress = 1;
    if (p.kind === 'mage_watchtower') {
      progress = Math.min(1, p.age / Math.max(0.001, tuning.mage.watchtower.startup));
      alpha = 0.35 + 0.65 * progress;
      // Its aura (the area where the Mage fires faster), once built.
      if (progress >= 1) {
        const enemy = this.isEnemy(p.ownerId);
        const pulse = 0.5 + 0.5 * Math.sin(this.clock * 3);
        ctx.fillStyle = enemy ? 'rgba(255,60,60,0.06)' : 'rgba(255,211,77,0.07)';
        ctx.strokeStyle = enemy ? `rgba(255,80,80,${0.35 + 0.25 * pulse})` : `rgba(255,211,77,${0.35 + 0.25 * pulse})`;
        ctx.lineWidth = 3;
        ctx.setLineDash([12, 8]);
        ctx.beginPath();
        ctx.arc(p.x, p.y, tuning.mage.watchtower.auraRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    if (sprite) this.drawSprite(sprite, p.x, p.y, p.angle, alpha, sprite.size, this.isEnemy(p.ownerId));
    if (progress < 1) {
      ctx.strokeStyle = '#ffd34d';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius + 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
      ctx.stroke();
    }
    // Small HP bar once damaged
    if (p.hp < p.maxHp) {
      const w = p.radius * 2;
      ctx.fillStyle = '#000';
      ctx.fillRect(p.x - w / 2 - 2, p.y - p.radius - 16, w + 4, 8);
      ctx.fillStyle = '#e05050';
      ctx.fillRect(p.x - w / 2, p.y - p.radius - 14, w * Math.max(0, p.hp / p.maxHp), 4);
    }
  }

  /** Ghost of a structure being placed: green outline if it fits, red if not. */
  private drawPreview(pv: PlacementPreview): void {
    const { ctx } = this;
    const sprite = findSprite(pv.sprite);
    const color = pv.valid ? 'rgba(80,230,120,0.9)' : 'rgba(240,70,70,0.9)';
    if (pv.x2 !== undefined && pv.y2 !== undefined) {
      // A line structure (mirror) being dragged out.
      if (sprite) this.drawStretched(sprite, pv.x, pv.y, pv.x2, pv.y2, pv.radius * 2 * 1.4, 0.5);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.moveTo(pv.x, pv.y);
      ctx.lineTo(pv.x2, pv.y2);
      ctx.stroke();
      ctx.setLineDash([]);
      return;
    }
    if (!sprite) {
      // Just a start-point marker.
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(pv.x, pv.y, 10, 0, Math.PI * 2);
      ctx.stroke();
      return;
    }
    if (sprite) this.drawSprite(sprite, pv.x, pv.y, pv.angle, 0.45);
    ctx.strokeStyle = pv.valid ? 'rgba(80,230,120,0.9)' : 'rgba(240,70,70,0.9)';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.arc(pv.x, pv.y, pv.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  /** Small bar under the crosshair for the local player's class (charge, resource...). */
  private drawCrosshairBar(world: World, tuning: Tuning, local: LocalView, at: { x: number; y: number }, alpha: number): void {
    const me = world.fighters.find((f) => f.id === local.playerId);
    const cls = me ? getClass(me.classId) : undefined;

    // Ammo pips (Sheriff revolver), just under the crosshair.
    const ammo = me && cls?.ammo?.(me, tuning);
    if (ammo && ammo.max > 12) {
      // Lots of ammo (Builder nails): a thin bar instead of pips.
      const w = 56;
      this.ctx.fillStyle = '#000';
      this.ctx.fillRect(at.x - w / 2 - 1, at.y + 39, w + 2, 9);
      this.ctx.fillStyle = '#2a2c36';
      this.ctx.fillRect(at.x - w / 2, at.y + 40, w, 7);
      this.ctx.fillStyle = ammo.reloading ? '#555a66' : '#e0b030';
      this.ctx.fillRect(at.x - w / 2, at.y + 40, w * (ammo.reloading ? 1 : ammo.current / ammo.max), 7);
    } else if (ammo) {
      const size = 7;
      const gap = 4;
      const total = ammo.max * size + (ammo.max - 1) * gap;
      for (let i = 0; i < ammo.max; i++) {
        const px = at.x - total / 2 + i * (size + gap);
        const py = at.y + 40;
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(px - 1, py - 1, size + 2, size + 2);
        this.ctx.fillStyle = ammo.reloading ? '#555a66' : i < ammo.current ? '#e0b030' : '#2a2c36';
        this.ctx.fillRect(px, py, size, size);
      }
    }

    // Stored uses of one ability (e.g. Refractor mirrors), as diamonds above the crosshair.
    const slot = cls?.crosshairCharges;
    if (me && slot && me.chargeMax[slot] > 0) {
      const max = me.chargeMax[slot];
      const n = me.charges[slot];
      const gap = 16;
      const recharge = me.cooldownTotals[slot] > 0 ? 1 - me.cooldowns[slot] / me.cooldownTotals[slot] : 0;
      for (let i = 0; i < max; i++) {
        const px = at.x - ((max - 1) * gap) / 2 + i * gap;
        const py = at.y - 30;
        const diamond = (size: number) => {
          this.ctx.beginPath();
          this.ctx.moveTo(px, py - size);
          this.ctx.lineTo(px + size, py);
          this.ctx.lineTo(px, py + size);
          this.ctx.lineTo(px - size, py);
          this.ctx.closePath();
        };
        diamond(7);
        this.ctx.fillStyle = '#000';
        this.ctx.fill();
        diamond(5);
        this.ctx.fillStyle = i < n ? '#bfe8ff' : '#2a2c36';
        this.ctx.fill();
        if (i === n && recharge > 0) {
          // the one coming back: grows as it recharges
          diamond(5 * recharge);
          this.ctx.fillStyle = '#5a7a90';
          this.ctx.fill();
        }
      }
    }

    const bar = me ? cls?.crosshairBar?.(me, tuning) : null;
    if (!bar) return;
    // Grow the bar smoothly between ticks.
    const fill = Math.max(0, Math.min(1, bar.fill + (bar.rate ?? 0) * (alpha / tuning.world.tickRate)));
    const w = 56;
    const h = 7;
    const x = at.x - w / 2;
    const y = at.y + 24;
    const { ctx } = this;
    ctx.fillStyle = '#000';
    ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    ctx.fillStyle = '#2a2c36';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = bar.color;
    ctx.fillRect(x, y, w * fill, h);
  }

  private drawParticles(dt: number): void {
    const { ctx } = this;
    for (const p of this.particles) {
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
      const k = Math.min(1, p.age / p.life);
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = p.color;
      const s = p.size * (1 - 0.5 * k);
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
    this.particles = this.particles.filter((p) => p.age < p.life);
  }

  private drawEffects(dt: number): void {
    const { ctx } = this;
    for (const e of this.effects) {
      e.age += dt;
      const k = Math.min(1, e.age / e.duration);
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = e.color;
      ctx.fillStyle = e.color;
      if (e.fx === 'ring') {
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius * k, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // burst: 8 little squares flying outwards
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4 + 0.3;
          const r = e.radius * k;
          ctx.fillRect(e.x + Math.cos(a) * r - 3, e.y + Math.sin(a) * r - 3, 6, 6);
        }
      }
    }
    ctx.globalAlpha = 1;
    this.effects = this.effects.filter((e) => e.age < e.duration);
  }

  /** Draw a sprite centred on (x, y), rotated by `angle` radians. `size` overrides the asset-map size. */
  private drawSprite(s: Sprite, x: number, y: number, angle: number, alpha = 1, size = s.size, enemy = false, white = false): void {
    const w = size;
    const h = size * s.aspect;
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    if (angle) ctx.rotate(angle);
    ctx.drawImage(white ? this.whitened(s.image) : enemy ? this.tinted(s.image) : s.image, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  /**
   * A sprite-sheet character: the body frame follows the aim direction (front / side / back, side flipped for left)
   * and a gun is drawn on top, pointing exactly where you aim. The gun is a TEMPORARY stand-in until there's gun art.
   */
  private drawFacingCharacter(d: Facings, x: number, y: number, aim: number, spin: number, alpha: number, white: boolean): void {
    const { ctx } = this;
    const deg = (aim * 180) / Math.PI; // screen coordinates: +90 is down
    const down = deg > 45 && deg < 135;
    const up = deg < -45 && deg > -135;
    const left = !down && !up && Math.abs(deg) > 90;
    const frame = down ? d.front : up ? d.back : d.side;
    // Snap the body to whole art pixels so its pixels line up with each other.
    const px = Math.round(x / ART_PIXEL) * ART_PIXEL;
    const py = Math.round(y / ART_PIXEL) * ART_PIXEL;

    const drawGun = () => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(px, py + 8);
      ctx.rotate(aim);
      ctx.fillStyle = white ? '#ffffff' : '#2b2b33';
      ctx.fillRect(10, -4, 28, 8); // barrel
      ctx.fillRect(6, -2, 8, 14); // grip
      ctx.restore();
    };
    if (up) drawGun(); // aiming up: the gun is in front of the body's back, so it goes behind
    ctx.save();
    ctx.translate(px, py);
    if (spin) ctx.rotate(spin);
    if (left) ctx.scale(-1, 1);
    ctx.globalAlpha = alpha;
    const w = frame.size;
    const h = frame.size * frame.aspect;
    ctx.drawImage(white ? this.whitened(frame.image) : frame.image, -w / 2, -h / 2, w, h);
    ctx.restore();
    if (!up) drawGun();
  }

  /** Does this belong to the other side? */
  private isEnemy(ownerId: number): boolean {
    return ownerId !== this.localId;
  }

  /** A solid-white copy of an image (for hit flashes; made once, then reused). */
  private whitened(image: CanvasImageSource): HTMLCanvasElement {
    let c = this.whiteCache.get(image);
    if (c) return c;
    const src = image as HTMLCanvasElement | HTMLImageElement;
    const w = (src as HTMLImageElement).naturalWidth || src.width;
    const h = (src as HTMLImageElement).naturalHeight || src.height;
    c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d')!;
    g.drawImage(image, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, w, h);
    this.whiteCache.set(image, c);
    return c;
  }

  /** A red-washed copy of an image (made once, then reused). */
  private tinted(image: CanvasImageSource): HTMLCanvasElement {
    let c = this.tintCache.get(image);
    if (c) return c;
    const src = image as HTMLCanvasElement | HTMLImageElement;
    const w = (src as HTMLImageElement).naturalWidth || src.width;
    const h = (src as HTMLImageElement).naturalHeight || src.height;
    c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d')!;
    g.drawImage(image, 0, 0);
    g.globalCompositeOperation = 'source-atop'; // only colour the sprite's own pixels
    g.fillStyle = ENEMY_TINT;
    g.fillRect(0, 0, w, h);
    this.tintCache.set(image, c);
    return c;
  }

  /**
   * Crosshair while in placing mode (mirrors, walls, watchtower...): a corner-bracket
   * "build" reticle with the ability's icon, so it's obvious you won't shoot.
   */
  private drawPlacingCrosshair(me: Fighter, at: { x: number; y: number }): void {
    const { ctx } = this;
    const r = 18;
    const c = 7;
    const pulse = 0.75 + 0.25 * Math.sin(this.clock * 8);
    const brackets = () => {
      for (const [sx, sy] of [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ]) {
        ctx.beginPath();
        ctx.moveTo(at.x + sx * r, at.y + sy * (r - c));
        ctx.lineTo(at.x + sx * r, at.y + sy * r);
        ctx.lineTo(at.x + sx * (r - c), at.y + sy * r);
        ctx.stroke();
      }
    };
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 6;
    brackets();
    ctx.strokeStyle = `rgba(80,230,120,${pulse})`;
    ctx.lineWidth = 3;
    brackets();
    ctx.fillStyle = '#50e678';
    ctx.fillRect(at.x - 2, at.y - 2, 4, 4);
    const icon = me.placing ? findSprite(getClass(me.classId)?.abilities[me.placing].icon ?? '') : undefined;
    if (icon) {
      ctx.fillStyle = '#000';
      ctx.fillRect(at.x + r + 4, at.y - r - 26, 28, 28);
      ctx.drawImage(icon.image, at.x + r + 6, at.y - r - 24, 24, 24);
    }
  }

  private drawNumbers(tuning: Tuning, dt: number): void {
    const { ctx } = this;
    const life = tuning.visuals.damageNumberLife;
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#000';
    for (const n of this.numbers) {
      n.age += dt;
      n.pop = Math.max(0, n.pop - dt * 6);
      const t = Math.min(1, n.age / life);
      const y = n.y - tuning.visuals.damageNumberRise * t;
      const text = String(Math.round(n.amount));
      ctx.font = `bold ${Math.round(28 * (1 + 0.35 * n.pop))}px monospace`;
      ctx.globalAlpha = 1 - t * t;
      ctx.strokeText(text, n.x, y);
      ctx.fillStyle = n.color;
      ctx.fillText(text, n.x, y);
    }
    ctx.globalAlpha = 1;
    this.numbers = this.numbers.filter((n) => n.age < life);
  }

  /** The white chunk on an HP bar waits briefly, then shrinks down to the real HP. */
  private updateHpTrails(world: World, tuning: Tuning, dt: number): void {
    for (const f of world.fighters) {
      let fx = this.fx.get(f.id);
      if (!fx) {
        fx = { trailHp: f.hp, trailHold: 0 };
        this.fx.set(f.id, fx);
      }
      if (f.hp >= fx.trailHp) {
        fx.trailHp = f.hp; // healed: no trail
        continue;
      }
      fx.trailHold += dt;
      if (fx.trailHold >= tuning.visuals.hpTrailDelay) fx.trailHp = Math.max(f.hp, fx.trailHp - tuning.visuals.hpTrailSpeed * dt);
    }
  }
}
