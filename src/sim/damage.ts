/** Health changes. Only the simulation (the host, when online) changes HP. */
import type { Fighter, World } from './types.ts';

export function applyDamage(world: World, target: Fighter, amount: number, sourceId: number): void {
  if (amount <= 0 || target.hp <= 0) return;
  const dealt = Math.min(target.hp, amount);
  target.hp -= dealt;
  world.events.push({ type: 'damage', targetId: target.id, sourceId, amount: dealt, x: target.x, y: target.y });
}

/** Refill a fighter's HP (training dummy reset, dev tools). */
export function resetHp(world: World, target: Fighter): void {
  target.hp = target.maxHp;
  world.events.push({ type: 'hpReset', targetId: target.id });
}
