/**
 * Messages between the host and the guest in an online match.
 *
 * The host runs the real game. The guest only sends what it presses
 * (inputs) and draws what the host sends back (snapshots).
 * No browser code here: a future dedicated server can use the same messages.
 */
import type { GameEvent, MatchState, PhysObject, Placeable, PlayerInput, Projectile, Fighter, World } from '../sim/types.ts';

/** Everything the guest needs to draw one moment of the match. */
export interface Snapshot {
  tick: number; // host simulation tick
  ack: number; // last guest input (seq) the host has applied
  time: number;
  fighters: Fighter[];
  projectiles: Projectile[];
  placeables: Placeable[];
  objects: PhysObject[];
  match: MatchState | null;
  events: GameEvent[]; // things that happened since the last snapshot (sounds, damage numbers...)
}

/** Lobby state: what each player has picked. */
export interface LobbyState {
  hostClass: string;
  hostReady: boolean;
  guestClass: string;
  guestReady: boolean;
}

/** Guest -> host */
export type GuestMsg =
  | { t: 'pick'; classId: string; ready: boolean } // character select
  | { t: 'input'; input: PlayerInput } // one tick of input
  | { t: 'rematch' } // wants a rematch
  | { t: 'leave' }; // leaving on purpose

/** Host -> guest */
export type HostMsg =
  | { t: 'lobby'; lobby: LobbyState }
  | { t: 'start'; tuning: unknown; classes: [string, string] } // match begins (host's tuning is used by both)
  | { t: 'snap'; s: Snapshot }
  | { t: 'rematch'; host: boolean; guest: boolean } // who has asked for a rematch
  | { t: 'toLobby' } // both want a rematch: back to character select
  | { t: 'leave' };

export function makeSnapshot(world: World, ack: number, events: GameEvent[]): Snapshot {
  return {
    tick: world.tick,
    ack,
    time: world.time,
    fighters: world.fighters,
    projectiles: world.projectiles,
    placeables: world.placeables,
    objects: world.objects,
    match: world.match,
    events,
  };
}

/** Turn a received snapshot back into a World the renderer can draw. */
export function worldFromSnapshot(s: Snapshot): World {
  return {
    mode: 'online',
    tick: s.tick,
    time: s.time,
    fighters: s.fighters,
    projectiles: s.projectiles,
    placeables: s.placeables,
    objects: s.objects,
    match: s.match,
    events: [],
    nextId: 0,
    options: { cooldownsDisabled: false, dummyFires: false },
  };
}
