/**
 * Cloud feature types, presets, and utilities for AINOW.
 *
 * This module defines all shared types used by the new cloud features:
 * stream quality presets, auto-reconnect, bandwidth monitoring,
 * network diagnostics, session history, and data usage tracking.
 */

import type { VideoCodec, ColorQuality } from "./gfn";

// ── Stream Quality Presets ──────────────────────────────────────────

export type StreamPresetId = "low-bandwidth" | "balanced" | "high-quality" | "ultra" | "custom";

export interface StreamPreset {
  id: StreamPresetId;
  label: string;
  description: string;
  resolution: string;
  fps: number;
  maxBitrateMbps: number;
  codec: VideoCodec;
  colorQuality: ColorQuality;
}

export const STREAM_PRESETS: readonly StreamPreset[] = [
  {
    id: "low-bandwidth",
    label: "Low Bandwidth",
    description: "Best for slow or metered connections",
    resolution: "1280x720",
    fps: 30,
    maxBitrateMbps: 10,
    codec: "H264",
    colorQuality: "8bit_420",
  },
  {
    id: "balanced",
    label: "Balanced",
    description: "Good quality with moderate bandwidth use",
    resolution: "1920x1080",
    fps: 60,
    maxBitrateMbps: 35,
    codec: "H264",
    colorQuality: "8bit_420",
  },
  {
    id: "high-quality",
    label: "High Quality",
    description: "Sharp visuals for fast connections",
    resolution: "2560x1440",
    fps: 60,
    maxBitrateMbps: 75,
    codec: "H265",
    colorQuality: "10bit_420",
  },
  {
    id: "ultra",
    label: "Ultra",
    description: "Maximum fidelity — requires a strong connection",
    resolution: "3840x2160",
    fps: 120,
    maxBitrateMbps: 150,
    codec: "AV1",
    colorQuality: "10bit_444",
  },
] as const;

export function findPresetById(id: StreamPresetId): StreamPreset | undefined {
  return STREAM_PRESETS.find((p) => p.id === id);
}

export function detectActivePreset(
  resolution: string,
  fps: number,
  maxBitrateMbps: number,
  codec: VideoCodec,
  colorQuality: ColorQuality,
): StreamPresetId {
  for (const preset of STREAM_PRESETS) {
    if (
      preset.resolution === resolution &&
      preset.fps === fps &&
      preset.maxBitrateMbps === maxBitrateMbps &&
      preset.codec === codec &&
      preset.colorQuality === colorQuality
    ) {
      return preset.id;
    }
  }
  return "custom";
}

// ── Auto-Reconnect ──────────────────────────────────────────────────

export interface AutoReconnectConfig {
  enabled: boolean;
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export const DEFAULT_AUTO_RECONNECT: Readonly<AutoReconnectConfig> = Object.freeze({
  enabled: false,
  maxRetries: 5,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
});

export function computeReconnectDelay(attempt: number, config: AutoReconnectConfig): number {
  const delay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt);
  return Math.min(delay, config.maxDelayMs);
}

// ── Bandwidth Monitor ───────────────────────────────────────────────

export interface BandwidthMonitorConfig {
  enabled: boolean;
  /** Monthly data cap in GB (0 = unlimited) */
  monthlyCapGb: number;
  /** Warn when usage exceeds this percentage of the cap */
  warnAtPercent: number;
}

export const DEFAULT_BANDWIDTH_MONITOR: Readonly<BandwidthMonitorConfig> = Object.freeze({
  enabled: false,
  monthlyCapGb: 0,
  warnAtPercent: 80,
});

export interface BandwidthSnapshot {
  timestampMs: number;
  bytesReceived: number;
  bytesSent: number;
  currentBitrateMbps: number;
}

export interface DataUsageSummary {
  sessionId: string;
  totalBytesReceived: number;
  totalBytesSent: number;
  durationMs: number;
  averageBitrateMbps: number;
}

// ── Network Diagnostics ─────────────────────────────────────────────

export type DiagnosticStatus = "idle" | "running" | "completed" | "error";

export interface NetworkDiagnosticsResult {
  timestampMs: number;
  status: DiagnosticStatus;
  /** Average round-trip latency in milliseconds */
  latencyMs: number;
  /** Jitter (variance in latency) in milliseconds */
  jitterMs: number;
  /** Packet loss as a percentage (0–100) */
  packetLossPercent: number;
  /** Estimated download bandwidth in Mbps */
  downloadMbps: number;
  /** Estimated upload bandwidth in Mbps */
  uploadMbps: number;
  /** DNS resolution time in milliseconds */
  dnsResolutionMs: number;
  /** Error message if status is "error" */
  errorMessage?: string;
}

export const EMPTY_DIAGNOSTICS: Readonly<NetworkDiagnosticsResult> = Object.freeze({
  timestampMs: 0,
  status: "idle",
  latencyMs: 0,
  jitterMs: 0,
  packetLossPercent: 0,
  downloadMbps: 0,
  uploadMbps: 0,
  dnsResolutionMs: 0,
});

export interface NetworkHealthRating {
  score: number;
  label: string;
  color: string;
}

export function rateNetworkHealth(diag: NetworkDiagnosticsResult): NetworkHealthRating {
  if (diag.status !== "completed") {
    return { score: 0, label: "Unknown", color: "#6b7280" };
  }

  let score = 100;

  if (diag.latencyMs > 100) score -= 30;
  else if (diag.latencyMs > 50) score -= 15;
  else if (diag.latencyMs > 30) score -= 5;

  if (diag.jitterMs > 20) score -= 20;
  else if (diag.jitterMs > 10) score -= 10;
  else if (diag.jitterMs > 5) score -= 3;

  if (diag.packetLossPercent > 5) score -= 30;
  else if (diag.packetLossPercent > 1) score -= 15;
  else if (diag.packetLossPercent > 0.1) score -= 5;

  if (diag.downloadMbps < 15) score -= 20;
  else if (diag.downloadMbps < 35) score -= 10;

  score = Math.max(0, Math.min(100, score));

  if (score >= 80) return { score, label: "Excellent", color: "#22c55e" };
  if (score >= 60) return { score, label: "Good", color: "#84cc16" };
  if (score >= 40) return { score, label: "Fair", color: "#eab308" };
  if (score >= 20) return { score, label: "Poor", color: "#f97316" };
  return { score, label: "Bad", color: "#ef4444" };
}

// ── Session History ─────────────────────────────────────────────────

export interface SessionHistoryEntry {
  id: string;
  gameTitle: string;
  appId: string;
  startedAtMs: number;
  endedAtMs: number;
  durationMs: number;
  region: string;
  resolution: string;
  fps: number;
  codec: VideoCodec;
  bytesReceived: number;
  bytesSent: number;
  averageLatencyMs: number;
  disconnectReason: string;
}

export interface SessionHistorySummary {
  totalSessions: number;
  totalPlaytimeMs: number;
  totalBytesReceived: number;
  totalBytesSent: number;
  averageSessionDurationMs: number;
  mostPlayedGame: string;
  mostPlayedGameSessions: number;
}

export function computeSessionSummary(entries: SessionHistoryEntry[]): SessionHistorySummary {
  if (entries.length === 0) {
    return {
      totalSessions: 0,
      totalPlaytimeMs: 0,
      totalBytesReceived: 0,
      totalBytesSent: 0,
      averageSessionDurationMs: 0,
      mostPlayedGame: "",
      mostPlayedGameSessions: 0,
    };
  }

  let totalPlaytimeMs = 0;
  let totalBytesReceived = 0;
  let totalBytesSent = 0;
  const gameCounts = new Map<string, number>();

  for (const entry of entries) {
    totalPlaytimeMs += entry.durationMs;
    totalBytesReceived += entry.bytesReceived;
    totalBytesSent += entry.bytesSent;
    gameCounts.set(entry.gameTitle, (gameCounts.get(entry.gameTitle) ?? 0) + 1);
  }

  let mostPlayedGame = "";
  let mostPlayedGameSessions = 0;
  for (const [game, count] of gameCounts) {
    if (count > mostPlayedGameSessions) {
      mostPlayedGame = game;
      mostPlayedGameSessions = count;
    }
  }

  return {
    totalSessions: entries.length,
    totalPlaytimeMs,
    totalBytesReceived,
    totalBytesSent,
    averageSessionDurationMs: Math.round(totalPlaytimeMs / entries.length),
    mostPlayedGame,
    mostPlayedGameSessions,
  };
}

// ── Cloud Settings (extension of main Settings interface) ───────────

export interface CloudSettings {
  /** Active stream quality preset */
  streamPreset: StreamPresetId;
  /** Auto-reconnect configuration */
  autoReconnectEnabled: boolean;
  autoReconnectMaxRetries: number;
  /** Bandwidth monitoring */
  bandwidthMonitorEnabled: boolean;
  bandwidthMonthlyCapGb: number;
  bandwidthWarnAtPercent: number;
  /** Whether to record session history locally */
  sessionHistoryEnabled: boolean;
  /** Maximum number of session history entries to keep */
  sessionHistoryMaxEntries: number;
}

export const DEFAULT_CLOUD_SETTINGS: Readonly<CloudSettings> = Object.freeze({
  streamPreset: "balanced",
  autoReconnectEnabled: false,
  autoReconnectMaxRetries: 5,
  bandwidthMonitorEnabled: false,
  bandwidthMonthlyCapGb: 0,
  bandwidthWarnAtPercent: 80,
  sessionHistoryEnabled: true,
  sessionHistoryMaxEntries: 500,
});

// ── IPC channel names for cloud features ────────────────────────────

export const CLOUD_IPC_CHANNELS = {
  CLOUD_APPLY_PRESET: "cloud:apply-preset",
  CLOUD_GET_SESSION_HISTORY: "cloud:get-session-history",
  CLOUD_GET_SESSION_SUMMARY: "cloud:get-session-summary",
  CLOUD_CLEAR_SESSION_HISTORY: "cloud:clear-session-history",
  CLOUD_RUN_NETWORK_DIAGNOSTICS: "cloud:run-network-diagnostics",
  CLOUD_GET_LAST_DIAGNOSTICS: "cloud:get-last-diagnostics",
  CLOUD_GET_DATA_USAGE: "cloud:get-data-usage",
} as const;

export type CloudIpcChannel = (typeof CLOUD_IPC_CHANNELS)[keyof typeof CLOUD_IPC_CHANNELS];

// ── Formatting helpers ──────────────────────────────────────────────

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
