/**
 * PLATFORM LAYER: browser-to-browser connections using PeerJS (WebRTC).
 *
 * The host opens a room with a short code; the guest connects to that code.
 * PeerJS's free public server only introduces the two browsers; after that
 * they talk directly. Free STUN servers help them find each other. Some strict
 * networks need a TURN relay (not free), so joining can fail there; the
 * error message says so.
 *
 * The rest of the game only sees `NetLink` (send messages / receive messages),
 * so a desktop build or a dedicated server can swap this file out.
 */
import Peer, { type DataConnection } from 'peerjs';

const ID_PREFIX = 'rebound-room-';
const CODE_LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I/L mix-ups
const CODE_LENGTH = 5;

/** A two-way message pipe to the other player. */
export interface NetLink {
  send(msg: unknown): void;
  close(): void;
  readonly open: boolean;
  onMessage: (msg: unknown) => void;
  onClose: () => void;
}

class PeerLink implements NetLink {
  onMessage: (msg: unknown) => void = () => {};
  onClose: () => void = () => {};
  private closed = false;
  private conn: DataConnection;

  constructor(conn: DataConnection) {
    this.conn = conn;
    conn.on('data', (d) => this.onMessage(d));
    const closed = () => {
      if (this.closed) return;
      this.closed = true;
      this.onClose();
    };
    conn.on('close', closed);
    conn.on('error', closed);
    // Also notice if the underlying connection dies without a clean close.
    conn.peerConnection?.addEventListener('connectionstatechange', () => {
      const s = conn.peerConnection?.connectionState;
      if (s === 'failed' || s === 'closed' || s === 'disconnected') closed();
    });
  }
  get open(): boolean {
    return !this.closed && this.conn.open;
  }
  send(msg: unknown): void {
    if (this.open) this.conn.send(msg);
  }
  close(): void {
    this.closed = true;
    this.conn.close();
  }
}

function makeCode(): string {
  let s = '';
  for (let i = 0; i < CODE_LENGTH; i++) s += CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)];
  return s;
}

export function normalizeCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** A hosted room. New guests arrive through `onGuest`. */
export class HostRoom {
  readonly code: string;
  onGuest: (link: NetLink) => void = () => {};
  private peer: Peer;

  private constructor(peer: Peer, code: string) {
    this.peer = peer;
    this.code = code;
    peer.on('connection', (conn) => {
      conn.on('open', () => this.onGuest(new PeerLink(conn)));
    });
    // Lost the signalling server (not the guest): quietly reconnect so rejoins still work.
    peer.on('disconnected', () => {
      if (!peer.destroyed) peer.reconnect();
    });
  }

  /** Open a room with a fresh random code (retries if the code is taken). */
  static async create(): Promise<HostRoom> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = makeCode();
      try {
        const peer = await openPeer(ID_PREFIX + code);
        return new HostRoom(peer, code);
      } catch (err) {
        if ((err as { type?: string }).type !== 'unavailable-id') throw friendlyError(err);
      }
    }
    throw new Error('Could not create a room. Please try again.');
  }

  close(): void {
    this.peer.destroy();
  }
}

/** A guest's connection: keeps its own PeerJS identity so it can rejoin after a drop. */
export class GuestPeer {
  private peer: Peer | null = null;

  /** Connect to a room code. Rejects with a readable message on failure. */
  async join(code: string, timeoutMs = 12000): Promise<NetLink> {
    if (!this.peer || this.peer.destroyed) this.peer = await openPeer();
    if (this.peer.disconnected) this.peer.reconnect();
    const peer = this.peer;
    return new Promise<NetLink>((resolve, reject) => {
      const conn = peer.connect(ID_PREFIX + normalizeCode(code), { reliable: true, serialization: 'json' });
      const timer = window.setTimeout(() => {
        cleanup();
        conn.close();
        reject(new Error('Could not connect. The room may be gone, or your network may block direct connections (a TURN relay would be needed, which this free setup does not have).'));
      }, timeoutMs);
      const onError = (err: unknown) => {
        cleanup();
        reject(friendlyError(err));
      };
      const cleanup = () => {
        window.clearTimeout(timer);
        peer.off('error', onError);
      };
      peer.on('error', onError);
      conn.on('open', () => {
        cleanup();
        resolve(new PeerLink(conn));
      });
    });
  }

  close(): void {
    this.peer?.destroy();
    this.peer = null;
  }
}

function openPeer(id?: string): Promise<Peer> {
  return new Promise((resolve, reject) => {
    const peer = id ? new Peer(id) : new Peer();
    const onError = (err: unknown) => {
      peer.destroy();
      reject(err);
    };
    peer.once('open', () => {
      peer.off('error', onError);
      resolve(peer);
    });
    peer.once('error', onError);
  });
}

function friendlyError(err: unknown): Error {
  const type = (err as { type?: string })?.type;
  switch (type) {
    case 'peer-unavailable':
      return new Error('No room with that code. Check the code and try again.');
    case 'network':
    case 'server-error':
    case 'socket-error':
    case 'socket-closed':
      return new Error('Could not reach the matchmaking server. Check your internet connection.');
    case 'browser-incompatible':
      return new Error('This browser does not support online play (WebRTC).');
    default:
      return new Error('Could not connect: ' + ((err as Error)?.message ?? String(err)));
  }
}
