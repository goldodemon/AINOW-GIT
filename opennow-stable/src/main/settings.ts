import { app } from "electron";
import { join } from "node:path";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import type { VideoCodec, ColorQuality, VideoAccelerationPreference, MicrophoneMode, GameLanguage, AspectRatio, KeyboardLayout, StreamQualityPreset, ReflexMode, FrameBufferDepth, ForceCodecMode } from "@shared/gfn";
import type { StreamPresetId } from "@shared/cloudFeatures";
import { DEFAULT_KEYBOARD_LAYOUT, getDefaultStreamPreferences, normalizeStreamPreferences } from "@shared/gfn";
import { DEFAULT_CLOUD_SETTINGS } from "@shared/cloudFeatures";

export interface Settings {
  /** Video resolution (e.g., "1920x1080") */
  resolution: string;
  /** Aspect ratio (16:9, 16:10, 21:9, 32:9) */
  aspectRatio: AspectRatio;
  /** Game poster size multiplier used by the renderer */
  posterSizeScale: number;
  /** Target FPS (30, 60, 120, etc.) */
  fps: number;
  /** Maximum bitrate in Mbps (cap at 150) */
  maxBitrateMbps: number;
  /** Preferred video codec */
  codec: VideoCodec;
  /** Preferred video decode acceleration mode */
  decoderPreference: VideoAccelerationPreference;
  /** Preferred video encode acceleration mode */
  encoderPreference: VideoAccelerationPreference;
  /** Color quality (bit depth + chroma subsampling) */
  colorQuality: ColorQuality;
  /** Preferred region URL (empty = auto) */
  region: string;
  /** Enable clipboard paste into stream */
  clipboardPaste: boolean;
  /** Mouse sensitivity multiplier */
  mouseSensitivity: number;
  /** Software mouse acceleration strength percentage (1-150) */
  mouseAcceleration: number;
  /** Toggle stats overlay shortcut */
  shortcutToggleStats: string;
  /** Toggle pointer lock shortcut */
  shortcutTogglePointerLock: string;
  /** Toggle fullscreen shortcut */
  shortcutToggleFullscreen: string;
  /** Stop stream shortcut */
  shortcutStopStream: string;
  /** Toggle anti-AFK shortcut */
  shortcutToggleAntiAfk: string;
  /** Toggle microphone shortcut */
  shortcutToggleMicrophone: string;
  /** Take screenshot shortcut */
  shortcutScreenshot: string;
  /** Toggle stream recording shortcut */
  shortcutToggleRecording: string;
  /** How often to re-show the session timer while streaming (0 = off) */
  sessionClockShowEveryMinutes: number;
  /** How long the session timer stays visible when it appears */
  sessionClockShowDurationSeconds: number;
  /** Microphone mode: disabled, push-to-talk, or voice-activity */
  microphoneMode: MicrophoneMode;
  /** Preferred microphone device ID (empty = default) */
  microphoneDeviceId: string;
  /** Hide stream buttons (mic/fullscreen/end-session) while streaming */
  hideStreamButtons: boolean;
  /** Show the Anti-AFK indicator badge while streaming */
  showAntiAfkIndicator: boolean;
  /** Show the stats overlay automatically when a stream launches */
  showStatsOnLaunch: boolean;
  /** Skip the free-tier queue server selection modal and launch with default routing */
  hideServerSelector: boolean;
  /** Enable controller-first media bar layout for library browsing */
  controllerMode: boolean;
  /** Play subtle sounds in controller library mode */
  controllerUiSounds: boolean;
  /** Enable animated background visuals for controller-mode loading screens */
  controllerBackgroundAnimations: boolean;
  /** Auto-load controller library at startup when controller mode is enabled */
  autoLoadControllerLibrary: boolean;
  /** Automatically enter fullscreen when controller-mode triggers it */
  autoFullScreen: boolean;
  favoriteGameIds: string[];
  /** Enable the live elapsed session counter */
  sessionCounterEnabled: boolean;
  /** Window width */
  windowWidth: number;
  /** Window height */
  windowHeight: number;
  /** Keyboard layout for mapping physical keys inside the remote session */
  keyboardLayout: KeyboardLayout;
  /** In-game language setting (sent to GFN servers via languageCode parameter) */
  gameLanguage: GameLanguage;
  /** Experimental request for Low Latency, Low Loss, Scalable throughput on new sessions */
  enableL4S: boolean;
  /** Request Cloud G-Sync / Variable Refresh Rate on new sessions */
  enableCloudGsync: boolean;
  /** Show the currently streaming game as Discord Rich Presence activity */
  discordRichPresence: boolean;
  /** Automatically check GitHub Releases for app updates in the background */
  autoCheckForUpdates: boolean;
  /** Custom resolution mode — when true, the custom resolution string is used instead of presets */
  customResolutionEnabled: boolean;
  /** Custom resolution string (e.g. "2560x1080") used when customResolutionEnabled is true */
  customResolution: string;
  /** Custom FPS mode — when true, the custom FPS value is used instead of presets */
  customFpsEnabled: boolean;
  /** Custom FPS value used when customFpsEnabled is true */
  customFps: number;
  /** Resolution scaling percentage (50–200). Applied as a multiplier to the effective resolution */
  resolutionScale: number;
  /** NVIDIA Reflex mode: auto (enabled at >=120fps), on (always), off (never) */
  reflexMode: ReflexMode;
  /** Enable HDR streaming (may cause resolution downscaling on some servers) */
  enableHdr: boolean;
  /** Active stream quality preset (custom = manual settings) */
  streamQualityPreset: StreamQualityPreset;
  /** Frame buffer depth: 0 = lowest latency, 2 = smoothest */
  frameBufferDepth: FrameBufferDepth;
  /** Smooth out UDP packet bursts (helps unstable Wi-Fi) */
  udpPacketPacing: boolean;
  /** Force a specific codec instead of auto-negotiation */
  forceCodec: ForceCodecMode;
  /** LAN Mode: unlock bitrate ceiling to 200 Mbps */
  lanMode: boolean;
  /** Super-sampling: request higher resolution than local display for AA boost */
  superSampling: boolean;
  /** Super-sampling target resolution (e.g. "3840x2160") */
  superSamplingResolution: string;
  /** Show frame-time variance graph overlay */
  showFrameTimeGraph: boolean;
  /** Show decode latency counter overlay */
  showDecodeLatency: boolean;
  /** Show network jitter indicator overlay */
  showNetworkJitter: boolean;
  /** Integer scaling: sharp pixel-perfect upscale instead of bilinear */
  integerScaling: boolean;
  /** Target display refresh rate hint for the server (0 = auto) */
  targetRefreshRate: number;
  /** Client-side FPS limiter (0 = unlimited) */
  fpsLimiter: number;
  /** Active stream quality preset (AINOW cloud feature) */
  streamPreset: StreamPresetId;
  /** Enable automatic reconnection after connection drops */
  autoReconnectEnabled: boolean;
  /** Maximum reconnect attempts before giving up */
  autoReconnectMaxRetries: number;
  /** Enable bandwidth usage monitoring */
  bandwidthMonitorEnabled: boolean;
  /** Monthly data cap in GB (0 = unlimited) */
  bandwidthMonthlyCapGb: number;
  /** Warn when monthly usage exceeds this percentage */
  bandwidthWarnAtPercent: number;
  /** Record session history locally */
  sessionHistoryEnabled: boolean;
  /** Maximum session history entries to retain */
  sessionHistoryMaxEntries: number;
}

const defaultStopShortcut = "Ctrl+Shift+Q";
const defaultAntiAfkShortcut = "Ctrl+Shift+K";
const defaultMicShortcut = "Ctrl+Shift+M";
const LEGACY_STOP_SHORTCUTS = new Set(["META+SHIFT+Q", "CMD+SHIFT+Q"]);
const LEGACY_ANTI_AFK_SHORTCUTS = new Set(["META+SHIFT+F10", "CMD+SHIFT+F10", "CTRL+SHIFT+F10"]);
const DEFAULT_STREAM_PREFERENCES = getDefaultStreamPreferences();

const DEFAULT_SETTINGS: Settings = {
  resolution: "1920x1080",
  aspectRatio: "16:9",
  posterSizeScale: 1,
  fps: 60,
  maxBitrateMbps: 75,
  codec: DEFAULT_STREAM_PREFERENCES.codec,
  decoderPreference: "auto",
  encoderPreference: "auto",
  colorQuality: DEFAULT_STREAM_PREFERENCES.colorQuality,
  region: "",
  clipboardPaste: false,
  mouseSensitivity: 1,
  mouseAcceleration: 1,
  shortcutToggleStats: "F3",
  shortcutTogglePointerLock: "F8",
  shortcutToggleFullscreen: "F10",
  shortcutStopStream: defaultStopShortcut,
  shortcutToggleAntiAfk: defaultAntiAfkShortcut,
  shortcutToggleMicrophone: defaultMicShortcut,
  shortcutScreenshot: "F11",
  shortcutToggleRecording: "F12",
  microphoneMode: "disabled",
  microphoneDeviceId: "",
  hideStreamButtons: false,
  showAntiAfkIndicator: true,
  showStatsOnLaunch: false,
  hideServerSelector: false,
  controllerMode: false,
  controllerUiSounds: false,
  controllerBackgroundAnimations: false,
  autoLoadControllerLibrary: false,
  autoFullScreen: false,
  favoriteGameIds: [],
  sessionCounterEnabled: false,
  sessionClockShowEveryMinutes: 60,
  sessionClockShowDurationSeconds: 30,
  windowWidth: 1400,
  windowHeight: 900,
  keyboardLayout: DEFAULT_KEYBOARD_LAYOUT,
  gameLanguage: "en_US",
  enableL4S: false,
  enableCloudGsync: false,
  discordRichPresence: false,
  autoCheckForUpdates: true,
  customResolutionEnabled: false,
  customResolution: "1920x1080",
  customFpsEnabled: false,
  customFps: 60,
  resolutionScale: 100,
  reflexMode: "auto",
  enableHdr: false,
  streamQualityPreset: "custom",
  frameBufferDepth: 1,
  udpPacketPacing: true,
  forceCodec: "auto",
  lanMode: false,
  superSampling: false,
  superSamplingResolution: "3840x2160",
  showFrameTimeGraph: false,
  showDecodeLatency: false,
  showNetworkJitter: false,
  integerScaling: false,
  targetRefreshRate: 0,
  fpsLimiter: 0,
  streamPreset: DEFAULT_CLOUD_SETTINGS.streamPreset,
  autoReconnectEnabled: DEFAULT_CLOUD_SETTINGS.autoReconnectEnabled,
  autoReconnectMaxRetries: DEFAULT_CLOUD_SETTINGS.autoReconnectMaxRetries,
  bandwidthMonitorEnabled: DEFAULT_CLOUD_SETTINGS.bandwidthMonitorEnabled,
  bandwidthMonthlyCapGb: DEFAULT_CLOUD_SETTINGS.bandwidthMonthlyCapGb,
  bandwidthWarnAtPercent: DEFAULT_CLOUD_SETTINGS.bandwidthWarnAtPercent,
  sessionHistoryEnabled: DEFAULT_CLOUD_SETTINGS.sessionHistoryEnabled,
  sessionHistoryMaxEntries: DEFAULT_CLOUD_SETTINGS.sessionHistoryMaxEntries,
};

export class SettingsManager {
  private settings: Settings;
  private readonly settingsPath: string;

  constructor() {
    this.settingsPath = join(app.getPath("userData"), "settings.json");
    this.settings = this.load();
  }

  /**
   * Load settings from disk or return defaults if file doesn't exist
   */
  private load(): Settings {
    try {
      if (!existsSync(this.settingsPath)) {
        const defaults = { ...DEFAULT_SETTINGS };
        this.enforceCompatibility(defaults);
        return defaults;
      }

      const content = readFileSync(this.settingsPath, "utf-8");
      const parsed = JSON.parse(content) as Partial<Settings>;

      // Merge with defaults to ensure all fields exist
      const merged: Settings = {
        ...DEFAULT_SETTINGS,
        ...parsed,
      };

      let migrated = this.migrateLegacyShortcutDefaults(merged);
      migrated = this.enforceCompatibility(merged) || migrated;

      // Migrate legacy boolean accelerator setting to percentage slider.
      if (typeof (parsed as { mouseAcceleration?: unknown }).mouseAcceleration === "boolean") {
        merged.mouseAcceleration = (parsed as { mouseAcceleration?: boolean }).mouseAcceleration ? 100 : 1;
        migrated = true;
      }

      merged.mouseAcceleration = Math.max(1, Math.min(150, Math.round(merged.mouseAcceleration)));
      if (migrated) {
        writeFileSync(this.settingsPath, JSON.stringify(merged, null, 2), "utf-8");
      }

      return merged;
    } catch (error) {
      console.error("Failed to load settings, using defaults:", error);
      const defaults = { ...DEFAULT_SETTINGS };
      this.enforceCompatibility(defaults);
      return defaults;
    }
  }

  private enforceCompatibility(settings: Settings): boolean {
    const normalized = normalizeStreamPreferences(settings.codec, settings.colorQuality);
    if (!normalized.migrated) {
      return false;
    }

    console.warn(
      `[Settings] Migrating unsupported stream settings codec="${settings.codec}" colorQuality="${settings.colorQuality}" to ${normalized.codec}/${normalized.colorQuality}`,
    );
    settings.codec = normalized.codec;
    settings.colorQuality = normalized.colorQuality;
    return true;
  }

  private migrateLegacyShortcutDefaults(settings: Settings): boolean {
    let migrated = false;

    const normalizeShortcut = (value: string): string => value.replace(/\s+/g, "").toUpperCase();
    const stopShortcut = normalizeShortcut(settings.shortcutStopStream);
    const antiAfkShortcut = normalizeShortcut(settings.shortcutToggleAntiAfk);

    if (LEGACY_STOP_SHORTCUTS.has(stopShortcut)) {
      settings.shortcutStopStream = defaultStopShortcut;
      migrated = true;
    }

    if (LEGACY_ANTI_AFK_SHORTCUTS.has(antiAfkShortcut)) {
      settings.shortcutToggleAntiAfk = defaultAntiAfkShortcut;
      migrated = true;
    }

    return migrated;
  }

  /**
   * Save current settings to disk
   */
  private save(): void {
    try {
      const dir = join(app.getPath("userData"));
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      writeFileSync(this.settingsPath, JSON.stringify(this.settings, null, 2), "utf-8");
    } catch (error) {
      console.error("Failed to save settings:", error);
    }
  }

  /**
   * Get all current settings
   */
  getAll(): Settings {
    return { ...this.settings };
  }

  /**
   * Get a specific setting value
   */
  get<K extends keyof Settings>(key: K): Settings[K] {
    return this.settings[key];
  }

  /**
   * Update a specific setting value
   */
  set<K extends keyof Settings>(key: K, value: Settings[K]): void {
    this.settings[key] = value;
    this.enforceCompatibility(this.settings);
    this.save();
  }

  /**
   * Update multiple settings at once
   */
  setMultiple(updates: Partial<Settings>): void {
    this.settings = {
      ...this.settings,
      ...updates,
    };
    this.enforceCompatibility(this.settings);
    this.save();
  }

  /**
   * Reset all settings to defaults
   */
  reset(): Settings {
    this.settings = { ...DEFAULT_SETTINGS };
    this.enforceCompatibility(this.settings);
    this.save();
    return { ...this.settings };
  }

  /**
   * Get the default settings
   */
  getDefaults(): Settings {
    const defaults = { ...DEFAULT_SETTINGS };
    this.enforceCompatibility(defaults);
    return defaults;
  }
}

// Singleton instance
let settingsManager: SettingsManager | null = null;

export function getSettingsManager(): SettingsManager {
  if (!settingsManager) {
    settingsManager = new SettingsManager();
  }
  return settingsManager;
}

export { DEFAULT_SETTINGS };
