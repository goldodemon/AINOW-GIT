/**
 * Persistent session history service.
 *
 * Stores completed GFN session metadata (game title, duration, data usage,
 * region, codec) in a local JSON file and provides query/summary helpers.
 */

import { app } from "electron";
import { join } from "node:path";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import type { VideoCodec } from "@shared/gfn";
import type { SessionHistoryEntry, SessionHistorySummary } from "@shared/cloudFeatures";
import { computeSessionSummary } from "@shared/cloudFeatures";

const MAX_DEFAULT_ENTRIES = 500;

interface SessionHistoryFile {
  version: 1;
  entries: SessionHistoryEntry[];
}

class SessionHistoryService {
  private entries: SessionHistoryEntry[] = [];
  private readonly filePath: string;
  private maxEntries: number = MAX_DEFAULT_ENTRIES;

  constructor() {
    const dir = join(app.getPath("userData"), "ainow");
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    this.filePath = join(dir, "session-history.json");
    this.load();
  }

  setMaxEntries(max: number): void {
    this.maxEntries = Math.max(1, max);
    this.trim();
  }

  private load(): void {
    try {
      if (!existsSync(this.filePath)) {
        this.entries = [];
        return;
      }
      const raw = readFileSync(this.filePath, "utf-8");
      const parsed = JSON.parse(raw) as SessionHistoryFile;
      if (parsed.version === 1 && Array.isArray(parsed.entries)) {
        this.entries = parsed.entries;
      } else {
        this.entries = [];
      }
    } catch {
      console.error("[SessionHistory] Failed to load history, starting fresh.");
      this.entries = [];
    }
  }

  private save(): void {
    try {
      const data: SessionHistoryFile = { version: 1, entries: this.entries };
      writeFileSync(this.filePath, JSON.stringify(data, null, 2), "utf-8");
    } catch (error) {
      console.error("[SessionHistory] Failed to save history:", error);
    }
  }

  private trim(): void {
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
      this.save();
    }
  }

  recordSession(params: {
    gameTitle: string;
    appId: string;
    startedAtMs: number;
    endedAtMs: number;
    region: string;
    resolution: string;
    fps: number;
    codec: VideoCodec;
    bytesReceived: number;
    bytesSent: number;
    averageLatencyMs: number;
    disconnectReason: string;
  }): SessionHistoryEntry {
    const entry: SessionHistoryEntry = {
      id: randomUUID(),
      gameTitle: params.gameTitle,
      appId: params.appId,
      startedAtMs: params.startedAtMs,
      endedAtMs: params.endedAtMs,
      durationMs: params.endedAtMs - params.startedAtMs,
      region: params.region,
      resolution: params.resolution,
      fps: params.fps,
      codec: params.codec,
      bytesReceived: params.bytesReceived,
      bytesSent: params.bytesSent,
      averageLatencyMs: params.averageLatencyMs,
      disconnectReason: params.disconnectReason,
    };

    this.entries.push(entry);
    this.trim();
    this.save();
    return entry;
  }

  getAll(): SessionHistoryEntry[] {
    return [...this.entries];
  }

  getRecent(count: number): SessionHistoryEntry[] {
    return this.entries.slice(-count).reverse();
  }

  getSummary(): SessionHistorySummary {
    return computeSessionSummary(this.entries);
  }

  clear(): void {
    this.entries = [];
    this.save();
  }

  getMonthlyDataUsage(): { bytesReceived: number; bytesSent: number } {
    const now = Date.now();
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const startMs = startOfMonth.getTime();

    let bytesReceived = 0;
    let bytesSent = 0;
    for (const entry of this.entries) {
      if (entry.startedAtMs >= startMs && entry.startedAtMs <= now) {
        bytesReceived += entry.bytesReceived;
        bytesSent += entry.bytesSent;
      }
    }

    return { bytesReceived, bytesSent };
  }
}

let instance: SessionHistoryService | null = null;

export function getSessionHistoryService(): SessionHistoryService {
  if (!instance) {
    instance = new SessionHistoryService();
  }
  return instance;
}
