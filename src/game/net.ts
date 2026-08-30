import Peer from "peerjs";
import type { DataConnection } from "peerjs";

export type NetStatus = "idle" | "connecting" | "hosting" | "joining" | "connected" | "error" | "closed";
export type NetMsg = { t: string; [k: string]: unknown };

const PREFIX = "nc77-bl-";

/**
 * P2P link over WebRTC (PeerJS cloud signaling).
 * Host = authoritative simulation; guests send state/shots, receive snapshots.
 */
export class NetLink {
  peer: Peer | null = null;
  conns = new Map<string, DataConnection>();
  conn: DataConnection | null = null;
  role: "host" | "guest" | null = null;
  roomCode = "";
  status: NetStatus = "idle";
  ping = 0;

  onStatus: (s: NetStatus, info?: string) => void = () => undefined;
  onData: (from: string, msg: NetMsg) => void = () => undefined;
  onJoin: (pid: string) => void = () => undefined;
  onLeave: (pid: string) => void = () => undefined;

  private hb: number | null = null;

  private mkRoomCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let s = "";
    for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }

  host() {
    this.cleanup();
    this.role = "host";
    this.setStatus("connecting", "Регистрация комнаты на сигнальном сервере…");
    this.roomCode = this.mkRoomCode();
    this.peer = new Peer(PREFIX + this.roomCode, { debug: 0 });
    this.bindErrors();
    this.peer.on("open", () => {
      this.setStatus("hosting");
      this.startHb();
    });
    this.peer.on("connection", (c) => this.setupConn(c, true));
  }

  join(code: string) {
    this.cleanup();
    this.role = "guest";
    this.roomCode = code.trim().toUpperCase();
    if (!this.roomCode) {
      this.setStatus("error", "Введите код комнаты");
      return;
    }
    this.setStatus("joining", "Поиск комнаты…");
    this.peer = new Peer(undefined as unknown as string, { debug: 0 });
    this.bindErrors();
    this.peer.on("open", () => {
      const c = this.peer!.connect(PREFIX + this.roomCode, { reliable: true });
      this.setupConn(c, false);
    });
  }

  private setupConn(c: DataConnection, isHost: boolean) {
    c.on("open", () => {
      if (isHost) {
        this.conns.set(c.peer, c);
        this.onJoin(c.peer);
      } else {
        this.conn = c;
        this.setStatus("connected");
        this.startHb();
      }
    });
    c.on("data", (d) => {
      const m = d as NetMsg;
      if (!m || typeof m.t !== "string") return;
      if (m.t === "ping") {
        this.sendTo(c.peer, { t: "pong", v: m.v });
        return;
      }
      if (m.t === "pong") {
        this.ping = Math.round(performance.now() - (m.v as number));
        return;
      }
      this.onData(c.peer, m);
    });
    c.on("close", () => {
      if (isHost) {
        this.conns.delete(c.peer);
        this.onLeave(c.peer);
      } else if (this.status !== "idle") {
        this.setStatus("closed", "Связь с хостом потеряна");
      }
    });
    c.on("error", () => undefined);
  }

  private bindErrors() {
    if (!this.peer) return;
    this.peer.on("error", (err: Error & { type?: string }) => {
      const type = err?.type ?? "";
      if (type === "unavailable-id") {
        // code collision — host retries with a fresh code
        if (this.role === "host") {
          try { this.peer?.destroy(); } catch { /* noop */ }
          this.host();
        }
        return;
      }
      if (type === "peer-unavailable") {
        this.setStatus("error", "Комната не найдена — проверьте код");
        return;
      }
      if (type === "network" || type === "server-error" || type === "socket-error") {
        this.setStatus("error", "Сигнальный сервер недоступен (нужен интернет)");
        return;
      }
      this.setStatus("error", "Ошибка сети: " + (type || "неизвестно"));
    });
    this.peer.on("disconnected", () => {
      try { if (this.peer && !this.peer.destroyed) this.peer.reconnect(); } catch { /* noop */ }
    });
  }

  private startHb() {
    if (this.hb !== null) return;
    this.hb = window.setInterval(() => {
      const v = performance.now();
      if (this.role === "guest") this.send({ t: "ping", v });
      else this.conns.forEach((_c, pid) => this.sendTo(pid, { t: "ping", v }));
    }, 1500);
  }

  send(m: unknown) {
    try { if (this.conn && this.conn.open) this.conn.send(m); } catch { /* noop */ }
  }
  sendTo(pid: string, m: unknown) {
    const c = this.conns.get(pid);
    try { if (c && c.open) c.send(m); } catch { /* noop */ }
  }
  broadcast(m: unknown) {
    this.conns.forEach((_c, pid) => this.sendTo(pid, m));
  }

  private setStatus(s: NetStatus, info?: string) {
    this.status = s;
    this.onStatus(s, info);
  }

  close() {
    this.cleanup();
    this.setStatus("idle");
  }
  private cleanup() {
    if (this.hb !== null) { clearInterval(this.hb); this.hb = null; }
    this.conns.forEach((c) => { try { c.close(); } catch { /* noop */ } });
    this.conns.clear();
    try { this.conn?.close(); } catch { /* noop */ }
    this.conn = null;
    try { this.peer?.destroy(); } catch { /* noop */ }
    this.peer = null;
    this.ping = 0;
  }
}
