/**
 * SHERIFF - C - Bramble (instant, object)
 * Summons a tumbleweed next to the Sheriff, rolling towards the crosshair.
 * Shooting it knocks it around; it bounces off walls and structures.
 * Touching it hurts and stuns anyone, the Sheriff too, and it crumbles.
 * Numbers: tuning.sheriff.bramble
 */
import type { AbilityDef, ObjectKindDef } from '../../abilities.ts';
import { isReady, startCooldown } from '../../abilities.ts';
import { spawnObject } from '../../objects.ts';
import { applyDamage } from '../../damage.ts';
import { emitFx, emitSound } from '../../events.ts';

export const bramble: AbilityDef = {
  id: 'sheriff_bramble',
  name: 'Bramble',
  type: 'object',
  activation: 'instant',
  icon: 'icon_sheriff_bramble',
  cooldown: (t) => t.sheriff.bramble.cooldown,

  update({ world, tuning, fighter: f, slot, pressed }) {
    if (!pressed || !isReady(f, slot)) return;
    const b = tuning.sheriff.bramble;
    const dirX = Math.cos(f.aimAngle);
    const dirY = Math.sin(f.aimAngle);
    spawnObject(world, {
      ownerId: f.id,
      kind: 'sheriff_bramble',
      x: f.x + dirX * b.spawnDistance,
      y: f.y + dirY * b.spawnDistance,
      vx: dirX * b.tossSpeed,
      vy: dirY * b.tossSpeed,
      radius: b.size,
      life: b.life,
    });
    startCooldown(world, f, slot, b.cooldown);
    emitSound(world, 'bramble_spawn', f.x, f.y);
  },
};

/** How a tumbleweed behaves as a physics object. */
export const brambleObject: ObjectKindDef = {
  kind: 'sheriff_bramble',
  restitution: (t) => t.sheriff.bramble.restitution,
  friction: (t) => t.sheriff.bramble.friction,
  onTouch(world, tuning, o, f) {
    const b = tuning.sheriff.bramble;
    applyDamage(world, f, b.damage, o.ownerId);
    f.stunT = Math.max(f.stunT, b.stun);
    emitSound(world, 'bramble_hit', o.x, o.y);
    emitFx(world, 'burst', o.x, o.y, '#c8a060', o.radius * 2, 0.35);
    return true; // the tumbleweed crumbles
  },
};
