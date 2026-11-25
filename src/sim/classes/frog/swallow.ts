/**
 * FROG - V - Swallow (instant, defensive projectile)
 * The Frog opens his mouth for a moment: any enemy shot that comes into the cone
 * in front of him is swallowed and gone. Press V again later to spit everything
 * out as one slow slime glob that does the swallowed damage times damageMult
 * (capped at maxStored, so a huge volley can't one-shot anybody).
 * The cooldown starts after spitting (or right away if nothing was swallowed).
 * Enemy physics objects in the cone (brambles, flung furniture) are swallowed too
 * (each stores objectValue). Beams (Mind Ray) and placeables (walls...) can't be.
 * Numbers: tuning.frog.swallow
 */
import type { AbilityDef } from '../../abilities.ts';
import { isReady, startCooldown } from '../../abilities.ts';
import { damageOf, spawnProjectile } from '../../projectiles.ts';
import { emitFx, emitSound } from '../../events.ts';
import { dist, lerp } from '../../math.ts';

export const swallow: AbilityDef = {
  id: 'frog_swallow',
  name: 'Swallow',
  type: 'projectile',
  activation: 'instant',
  icon: 'icon_frog_swallow',
  cooldown: (t) => t.frog.swallow.cooldown,

  update({ world, tuning, fighter: f, slot, pressed, dt }) {
    const s = tuning.frog.swallow;

    // Mouth open: gulp enemy shots in the cone.
    if (f.vars.mouthT > 0) {
      f.vars.mouthT -= dt;
      const half = (s.coneDegrees * Math.PI) / 360;
      const before = world.projectiles.length;
      world.projectiles = world.projectiles.filter((p) => {
        if (p.ownerId === f.id) return true;
        if (dist(f.x, f.y, p.x, p.y) > f.radius + s.range + p.radius) return true;
        let diff = Math.atan2(p.y - f.y, p.x - f.x) - f.aimAngle;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        if (Math.abs(diff) > half) return true;
        f.vars.stored = Math.min(s.maxStored, (f.vars.stored ?? 0) + damageOf(p));
        return false; // swallowed
      });
      // Enemy physics objects too (brambles, flung furniture), but never placeables (walls, turrets...).
      const objBefore = world.objects.length;
      world.objects = world.objects.filter((o) => {
        if (o.ownerId === f.id) return true;
        if (dist(f.x, f.y, o.x, o.y) > f.radius + s.range + o.radius) return true;
        let diff = Math.atan2(o.y - f.y, o.x - f.x) - f.aimAngle;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        if (Math.abs(diff) > half) return true;
        f.vars.stored = Math.min(s.maxStored, (f.vars.stored ?? 0) + s.objectValue);
        return false; // swallowed
      });
      if (world.projectiles.length < before || world.objects.length < objBefore) emitSound(world, 'frog_swallow', f.x, f.y);
      if (f.vars.mouthT <= 0 && !(f.vars.stored > 0)) startCooldown(world, f, slot, s.cooldown); // ate nothing
      return;
    }

    if (!pressed) return;

    // Something stored: spit it out.
    if (f.vars.stored > 0) {
      const k = f.vars.stored / Math.max(1, s.maxStored);
      const size = lerp(s.spitMinSize, s.spitMaxSize, k);
      spawnProjectile(world, tuning, {
        ownerId: f.id,
        kind: 'frog_glob',
        x: f.x + Math.cos(f.aimAngle) * (f.radius + size + 4),
        y: f.y + Math.sin(f.aimAngle) * (f.radius + size + 4),
        angle: f.aimAngle,
        speed: s.spitSpeed,
        radius: size,
        damage: f.vars.stored * s.damageMult,
        hitstun: tuning.hitstun.glob,
        physics: 2,
        from: { x: f.x, y: f.y },
      });
      f.vars.stored = 0;
      startCooldown(world, f, slot, s.cooldown);
      emitSound(world, 'frog_spit', f.x, f.y);
      return;
    }

    // Open wide.
    if (!isReady(f, slot)) return;
    f.vars.mouthT = s.window;
    f.vars.stored = 0;
    emitFx(world, 'ring', f.x, f.y, '#7ad05a', f.radius + s.range * 0.5, 0.2);
    emitSound(world, 'frog_mouth', f.x, f.y);
  },
};
