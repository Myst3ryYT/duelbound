/**
 * Draws the game. Reads the World, never changes it.
 */
import type { Tuning } from '../config/tuning.ts';
import type { Fighter, GameEvent, Placeable, Projectile, World } from '../sim/types.ts';
import type { PlacementPreview } from '../sim/abilities.ts';
import { getClass } from '../sim/classes/registry.ts';
import { findSprite, getSprite, type Sprite } from './sprites.ts';
import { SCREEN_H, SCREEN_W, View } from './view.ts';
import { drawHud, type HudInfo } from './hud.ts';

interface FloatingNumber {
  x: number;
  y: number;
  text: string;
  age: number;
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

/** Per-fighter visual state that the simulation doesn't care about. */
interface FighterFx {
  trailHp: number; // the white "recent damage" part of the HP bar
  trailHold: number; // seconds before the trail starts shrinking
}

/** What the renderer needs to know about the local player, beyond the World. */
export interface LocalView {
  playerId: number;
  preview: PlacementPreview | null; // ghost of a structure being placed
}

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private numbers: FloatingNumber[] = [];
  private effects: Effect[] = [];
  private fx = new Map<number, FighterFx>();
  private clock = 0; // seconds, for pulsing animations

  constructor(
    canvas: HTMLCanvasElement,
    readonly view: View,
  ) {
    this.ctx = canvas.getContext('2d')!;
  }

  /** React to simulation events with visual effects. */
  onEvent(e: GameEvent, world: World): void {
    if (e.type === 'damage') {
      const jitter = (Math.random() - 0.5) * 30;
      const target = world.fighters.find((f) => f.id === e.targetId);
      this.numbers.push({
        x: e.x + jitter,
        y: e.y - (target?.radius ?? 20) - 10,
        text: String(Math.round(e.amount)),
        age: 0,
        color: '#ffffff',
      });
      const fx = this.fx.get(e.targetId);
      if (fx) fx.trailHold = 0;
    } else if (e.type === 'fx') {
      this.effects.push({ ...e, age: 0 });
    }
  }

  /** Forget visual state (e.g. when a new match starts). */
  reset(): void {
    this.numbers = [];
    this.effects = [];
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

    const lerpPos = (id: number, x: number, y: number) => {
      const p = prev.get(id);
      return p ? { x: p.x + (x - p.x) * alpha, y: p.y + (y - p.y) * alpha } : { x, y };
    };

    // ---- World space (arena) ----
    ctx.save();
    ctx.translate(view.arenaX, view.arenaY);
    this.drawArena(tuning.world.arenaSize);
    for (const p of world.placeables) this.drawPlaceable(p, tuning);
    for (const f of world.fighters) {
      const pos = lerpPos(f.id, f.x, f.y);
      this.drawFighter(f, pos.x, pos.y, tuning);
    }
    for (const p of world.projectiles) {
      const pos = lerpPos(p.id, p.x, p.y);
      this.drawProjectile(p, pos.x, pos.y, tuning);
    }
    if (local.preview) this.drawPreview(local.preview);
    this.drawEffects(dt);
    this.drawNumbers(tuning, dt);
    ctx.restore();

    // ---- Screen space (HUD) ----
    this.updateHpTrails(world, tuning, dt);
    drawHud(ctx, world, hud, (id) => this.fx.get(id)?.trailHp ?? 0);

    if (crosshair) this.drawSprite(getSprite('crosshair'), crosshair.x, crosshair.y, 0);
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

  private drawFighter(f: Fighter, x: number, y: number, tuning: Tuning): void {
    const { ctx } = this;
    // Soft shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(x, y + f.radius * 0.7, f.radius * 0.9, f.radius * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Mage teleport: show the landing marker, and shrink while casting.
    let alpha = 1;
    if (f.vars.tpActive) {
      const k = 1 - Math.max(0, f.vars.tpTime) / Math.max(0.001, tuning.mage.teleport.castTime);
      this.drawSprite(getSprite('teleport_marker'), f.vars.tpX, f.vars.tpY, this.clock * 4, 0.5 + 0.5 * k);
      alpha = 1 - k * 0.8;
    }

    const spriteName = f.kind === 'dummy' ? 'dummy' : (getClass(f.classId)?.sprite ?? 'fighter_default');
    const sprite = findSprite(spriteName) ?? getSprite('fighter_default');
    this.drawSprite(sprite, x, y, f.kind === 'dummy' ? 0 : f.aimAngle, alpha);

    // Mage staff charging: a growing orb at the staff tip.
    if (f.vars.staffCharging) {
      const s = tuning.mage.staff;
      const k = s.chargeTime > 0 ? Math.min(1, f.vars.staffCharge / s.chargeTime) : 1;
      const r = s.sizeMin + (s.sizeMax - s.sizeMin) * k;
      const tipX = x + Math.cos(f.aimAngle) * (f.radius + r);
      const tipY = y + Math.sin(f.aimAngle) * (f.radius + r);
      const pulse = k >= 1 ? 1 + 0.15 * Math.sin(this.clock * 30) : 1;
      this.drawSprite(getSprite('mage_bolt'), tipX, tipY, 0, 0.6 + 0.4 * k, r * 2.5 * pulse);
    }

    // Reflective shield bubble
    if (f.shieldT > 0) {
      const fade = Math.min(1, f.shieldT / 0.25); // fades out in the last quarter second
      this.drawSprite(getSprite('mage_shield'), x, y, 0, fade, f.shieldRadius * 2);
    }
  }

  private drawProjectile(p: Projectile, x: number, y: number, tuning: Tuning): void {
    const sprite = findSprite(p.kind);
    // Drawn 20% bigger than its radius because of the glow; the hitbox is set by tuning.
    const size = p.radius * 2 * 1.25;
    if (sprite) this.drawSprite(sprite, x, y, Math.atan2(p.vy, p.vx), 1, size);
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

  private drawPlaceable(p: Placeable, tuning: Tuning): void {
    const { ctx } = this;
    const sprite = findSprite(p.kind);
    // Watchtower build-up: fades in while building, with a progress ring.
    let alpha = 1;
    let progress = 1;
    if (p.kind === 'mage_watchtower') {
      progress = Math.min(1, p.age / Math.max(0.001, tuning.mage.watchtower.startup));
      alpha = 0.35 + 0.65 * progress;
    }
    if (sprite) this.drawSprite(sprite, p.x, p.y, p.angle, alpha);
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
    if (sprite) this.drawSprite(sprite, pv.x, pv.y, pv.angle, 0.45);
    ctx.strokeStyle = pv.valid ? 'rgba(80,230,120,0.9)' : 'rgba(240,70,70,0.9)';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.arc(pv.x, pv.y, pv.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
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
  private drawSprite(s: Sprite, x: number, y: number, angle: number, alpha = 1, size = s.size): void {
    const w = size;
    const h = size * s.aspect;
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    if (angle) ctx.rotate(angle);
    ctx.drawImage(s.image, -w / 2, -h / 2, w, h);
    ctx.restore();
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
      const t = Math.min(1, n.age / life);
      const y = n.y - tuning.visuals.damageNumberRise * t;
      ctx.globalAlpha = 1 - t * t;
      ctx.strokeText(n.text, n.x, y);
      ctx.fillStyle = n.color;
      ctx.fillText(n.text, n.x, y);
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

