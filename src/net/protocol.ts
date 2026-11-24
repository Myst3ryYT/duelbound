/**
 * Messages between the host and the guest in an online match.
 *
 * The host runs the real game. The guest only sends what it presses
 * (inputs) and draws what the host sends back (snapshots).
 * No browser code here: a future dedicated server can use the same messages.
 */
import type { GameEvent, MatchState, PhysObject, Placeable, PlayerInput, Projectile, Fighter, World, Zone } from '../sim/types.ts';

/** Everything the guest needs to draw one moment of the match. */
export interface Snapshot {
  tick: number; // host simulation tick
  ack: number; // last guest input (seq) the host has applied
  time: number;
  nextId: number; // the host's next free id (the guest's prediction numbers its own new things after it)
  fighters: Fighter[];
  projectiles: Projectile[];
  placeables: Placeable[];
  objects: PhysObject[];
  zones: Zone[];
  match: MatchState | null;
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
  | { t: 'inputs'; inputs: PlayerInput[] } // the newest few ticks of input (repeated, in case some packets get lost)
  | { t: 'ping'; at: number }
  | { t: 'pong'; at: number }
  | { t: 'rematch' } // wants a rematch
  | { t: 'leave' }; // leaving on purpose

/** Host -> guest */
export type HostMsg =
  | { t: 'lobby'; lobby: LobbyState }
  | { t: 'start'; tuning: unknown; classes: [string, string] } // match begins (host's tuning is used by both)
  | { t: 'snap'; s: Snapshot } // sent on the fast channel (may be lost: the next one replaces it)
  | { t: 'events'; events: GameEvent[] } // sounds, damage numbers... (reliable: never lost)
  | { t: 'ping'; at: number }
  | { t: 'pong'; at: number }
  | { t: 'rematch'; host: boolean; guest: boolean } // who has asked for a rematch
  | { t: 'toLobby' } // both want a rematch: back to character select
  | { t: 'leave' };

export function makeSnapshot(world: World, ack: number): Snapshot {
  return {
    tick: world.tick,
    ack,
    time: world.time,
    nextId: world.nextId,
    fighters: world.fighters,
    projectiles: world.projectiles,
    placeables: world.placeables,
    objects: world.objects,
    zones: world.zones,
    match: world.match,
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
    zones: s.zones,
    match: s.match,
    events: [],
    nextId: s.nextId,
    options: { cooldownsDisabled: false, dummyFires: false },
  };
}
