/**
 * Round flow for a real match (bot match now, online later):
 *
 *   countdown (3 s, nobody moves) -> fight (90 s clock) -> round result -> countdown ...
 *
 * A round ends when someone reaches 0 HP, or when the clock runs out (more HP
 * wins). An exact tie (same HP, or both at 0 together) shows the tie screen and
 * replays the same round. First to win `roundsToWin` rounds wins the match.
 * Numbers: tuning.match
 */
import type { Tuning } from '../config/tuning.ts';
import { perAction, type Fighter, type MatchState, type World } from './types.ts';
import { emitSound } from './events.ts';

export function newMatchState(tuning: Tuning): MatchState {
  return {
    phase: 'countdown',
    phaseT: tuning.match.countdown,
    roundTime: tuning.match.roundTime,
    round: 1,
    wins: [0, 0],
    roundWinner: -1,
    matchWinner: -1,
  };
}

/** Where each side starts a round. */
export function spawnPoint(tuning: Tuning, side: 0 | 1): { x: number; y: number } {
  const c = tuning.world.arenaSize / 2;
  return { x: side === 0 ? c - tuning.player.spawnDistance : c + tuning.player.spawnDistance, y: c };
}

/** Put a fighter back to a fresh start (same id, class and name). */
export function resetFighter(f: Fighter, tuning: Tuning): void {
  const p = spawnPoint(tuning, f.side);
  Object.assign(f, {
    x: p.x,
    y: p.y,
    vx: 0,
    vy: 0,
    aimAngle: f.side === 0 ? 0 : Math.PI,
    hp: f.maxHp,
    cooldowns: perAction(0),
    cooldownTotals: perAction(0),
    charges: perAction(0),
    chargeMax: perAction(0),
    placing: null,
    rootedT: 0,
    stunT: 0,
    kickCd: 0,
    kbVx: 0,
    kbVy: 0,
    hitstunT: 0,
    invulnT: 0,
    pullById: 0,
    pullT: 0,
    vars: {},
  });
}

/** Clear the arena and reset both players for the next (or replayed) round. */
function resetRound(world: World, tuning: Tuning): void {
  world.projectiles = [];
  world.placeables = [];
  world.objects = [];
  for (const f of world.fighters) resetFighter(f, tuning);
}

/**
 * Advance the round flow. Returns true if the fight is on (the rest of the
 * simulation should run this tick), false while frozen (countdown / results).
 */
export function updateMatch(world: World, tuning: Tuning, dt: number): boolean {
  const m = world.match;
  if (!m) return true;
  switch (m.phase) {
    case 'countdown': {
      const before = Math.ceil(m.phaseT);
      m.phaseT -= dt;
      if (Math.ceil(m.phaseT) < before && m.phaseT > 0) emitSound(world, 'countdown', 0, 0);
      if (m.phaseT <= 0) {
        m.phase = 'fight';
        emitSound(world, 'fight_start', 0, 0);
      }
      return false;
    }
    case 'fight':
      m.roundTime = Math.max(0, m.roundTime - dt);
      return true;
    case 'roundOver':
    case 'tie':
      m.phaseT -= dt;
      if (m.phaseT > 0) return false;
      if (m.matchWinner >= 0) {
        m.phase = 'matchOver';
        return false;
      }
      if (m.phase === 'roundOver') m.round++;
      resetRound(world, tuning);
      m.phase = 'countdown';
      m.phaseT = tuning.match.countdown;
      m.roundTime = tuning.match.roundTime;
      return false;
    case 'matchOver':
      return false;
  }
}

/** After the fight has run for a tick: did the round just end? */
export function checkRoundEnd(world: World, tuning: Tuning): void {
  const m = world.match;
  if (!m || m.phase !== 'fight') return;
  const a = world.fighters.find((f) => f.side === 0);
  const b = world.fighters.find((f) => f.side === 1);
  if (!a || !b) return;

  let winner: -1 | 0 | 1 | null = null; // null = round continues, -1 = tie
  if (a.hp <= 0 && b.hp <= 0) winner = -1;
  else if (a.hp <= 0) winner = 1;
  else if (b.hp <= 0) winner = 0;
  else if (m.roundTime <= 0) winner = a.hp === b.hp ? -1 : a.hp > b.hp ? 0 : 1;
  if (winner === null) return;

  if (winner === -1) {
    m.phase = 'tie';
    m.phaseT = tuning.match.tieTime;
    m.roundWinner = -1;
    emitSound(world, 'round_tie', 0, 0);
    return;
  }
  m.wins[winner]++;
  m.roundWinner = winner;
  m.phase = 'roundOver';
  m.phaseT = tuning.match.resultTime;
  if (m.wins[winner] >= tuning.match.roundsToWin) m.matchWinner = winner;
  emitSound(world, m.matchWinner >= 0 ? 'match_win' : 'round_win', 0, 0);
}
