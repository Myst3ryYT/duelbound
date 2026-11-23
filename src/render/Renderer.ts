/**
 * Draws the game. Reads the World, never changes it.
 */
import type { Tuning } from '../config/tuning.ts';
import type { SpriteId } from '../config/assets.ts';
import type { Fighter, GameEvent, World } from '../sim/types.ts';
import { getSprite } from './sprites.ts';
import { SCREEN_H, SCREEN_W, View } from './view.ts';
import { drawHud, type HudInfo } from './hud.ts';

interface FloatingNumber {
  x: number;
  y: number;
  text: string;
  age: number;
  color: string;
}

/** Per-fighter visual state that the simulation doesn't care about. */
interface FighterFx {
  trailHp: number; // the white "recent damage" part of the HP bar
  trailHold: number; // seconds before the trail starts shrinking
}

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private numbers: FloatingNumber[] = [];
  private fx = new Map<number, FighterFx>();

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
    }
  }

  /** Forget visual state (e.g. when a new match starts). */
  reset(): void {
    this.numbers = [];
    this.fx.clear();
  }

  /**
   * Draw one frame.
   * @param prev   fighter positions from the previous tick, to smooth motion between ticks
   * @param alpha  how far we are between the previous tick (0) and the current one (1)
   */
  render(world: World, tuning: Tuning, prev: Map<number, { x: number; y: number }>, alpha: number, dt: number, hud: HudInfo, crosshair: { x: number; y: number } | null): void {
    const { ctx, view } = this;
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

    // ---- World space (arena) ----
    ctx.save();
    ctx.translate(view.arenaX, view.arenaY);
    this.drawArena(tuning.world.arenaSize);
    for (const f of world.fighters) {
      const p = prev.get(f.id);
      const x = p ? p.x + (f.x - p.x) * alpha : f.x;
      const y = p ? p.y + (f.y - p.y) * alpha : f.y;
      this.drawFighter(f, x, y);
    }
    this.drawNumbers(tuning, dt);
    ctx.restore();

    // ---- Screen space (HUD) ----
    this.updateHpTrails(world, tuning, dt);
    drawHud(ctx, world, hud, (id) => this.fx.get(id)?.trailHp ?? 0);

    if (crosshair) this.drawSprite('crosshair', crosshair.x, crosshair.y, 0);
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

  private drawFighter(f: Fighter, x: number, y: number): void {
    const { ctx } = this;
    // Soft shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(x, y + f.radius * 0.7, f.radius * 0.9, f.radius * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    const id: SpriteId = f.kind === 'dummy' ? 'dummy' : 'fighter_default';
    this.drawSprite(id, x, y, f.kind === 'dummy' ? 0 : f.aimAngle);
  }

  /** Draw a sprite centred on (x, y), rotated by `angle` radians. */
  private drawSprite(id: SpriteId, x: number, y: number, angle: number): void {
    const s = getSprite(id);
    const w = s.size;
    const h = s.size * s.aspect;
    const { ctx } = this;
    ctx.save();
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
