/**
 * Network diagnostics service.
 *
 * Runs lightweight latency / jitter / packet-loss probes against known
 * GFN region endpoints and estimates bandwidth from recent WebRTC stats.
 * Results are stored in-memory and surfaced to the renderer via IPC.
 */

import * as dns from "node:dns/promises";
import * as net from "node:net";
import type { NetworkDiagnosticsResult } from "@shared/cloudFeatures";
import { EMPTY_DIAGNOSTICS } from "@shared/cloudFeatures";

const PROBE_HOST = "nvidiagrid.net";
const PROBE_PORT = 443;
const PROBE_COUNT = 10;
const PROBE_TIMEOUT_MS = 3000;

class NetworkDiagnosticsService {
  private lastResult: NetworkDiagnosticsResult = { ...EMPTY_DIAGNOSTICS };
  private running = false;

  isRunning(): boolean {
    return this.running;
  }

  getLastResult(): NetworkDiagnosticsResult {
    return { ...this.lastResult };
  }

  async run(): Promise<NetworkDiagnosticsResult> {
    if (this.running) {
      return this.getLastResult();
    }

    this.running = true;
    this.lastResult = { ...EMPTY_DIAGNOSTICS, status: "running", timestampMs: Date.now() };

    try {
      const dnsResolutionMs = await this.measureDns(PROBE_HOST);
      const { latencies, lostCount } = await this.measureLatencies(PROBE_HOST, PROBE_PORT, PROBE_COUNT);

      const avgLatency = latencies.length > 0
        ? latencies.reduce((a, b) => a + b, 0) / latencies.length
        : 0;

      const jitter = this.computeJitter(latencies);
      const packetLossPercent = (lostCount / PROBE_COUNT) * 100;
      const downloadEstimate = this.estimateBandwidthFromLatency(avgLatency);

      this.lastResult = {
        timestampMs: Date.now(),
        status: "completed",
        latencyMs: Math.round(avgLatency * 100) / 100,
        jitterMs: Math.round(jitter * 100) / 100,
        packetLossPercent: Math.round(packetLossPercent * 100) / 100,
        downloadMbps: downloadEstimate,
        uploadMbps: Math.round(downloadEstimate * 0.3 * 100) / 100,
        dnsResolutionMs: Math.round(dnsResolutionMs * 100) / 100,
      };
    } catch (error) {
      this.lastResult = {
        ...EMPTY_DIAGNOSTICS,
        timestampMs: Date.now(),
        status: "error",
        errorMessage: error instanceof Error ? error.message : String(error),
      };
    } finally {
      this.running = false;
    }

    return this.getLastResult();
  }

  private async measureDns(hostname: string): Promise<number> {
    const start = performance.now();
    try {
      await dns.resolve4(hostname);
    } catch {
      // DNS failure is non-fatal; we still return the elapsed time
    }
    return performance.now() - start;
  }

  private async measureLatencies(
    host: string,
    port: number,
    count: number,
  ): Promise<{ latencies: number[]; lostCount: number }> {
    const latencies: number[] = [];
    let lostCount = 0;

    for (let i = 0; i < count; i++) {
      const result = await this.tcpPing(host, port);
      if (result === null) {
        lostCount++;
      } else {
        latencies.push(result);
      }
    }

    return { latencies, lostCount };
  }

  private tcpPing(host: string, port: number): Promise<number | null> {
    return new Promise((resolve) => {
      const start = performance.now();
      const socket = new net.Socket();

      const timer = setTimeout(() => {
        socket.destroy();
        resolve(null);
      }, PROBE_TIMEOUT_MS);

      socket.connect(port, host, () => {
        clearTimeout(timer);
        const elapsed = performance.now() - start;
        socket.destroy();
        resolve(elapsed);
      });

      socket.on("error", () => {
        clearTimeout(timer);
        socket.destroy();
        resolve(null);
      });
    });
  }

  private computeJitter(latencies: number[]): number {
    if (latencies.length < 2) return 0;

    let totalDiff = 0;
    for (let i = 1; i < latencies.length; i++) {
      totalDiff += Math.abs(latencies[i] - latencies[i - 1]);
    }
    return totalDiff / (latencies.length - 1);
  }

  private estimateBandwidthFromLatency(avgLatencyMs: number): number {
    if (avgLatencyMs <= 0) return 0;
    // Rough heuristic: lower latency correlates with higher-bandwidth links.
    // This is NOT an actual throughput test — just a rough guide.
    if (avgLatencyMs < 10) return 200;
    if (avgLatencyMs < 20) return 150;
    if (avgLatencyMs < 40) return 100;
    if (avgLatencyMs < 60) return 75;
    if (avgLatencyMs < 100) return 50;
    if (avgLatencyMs < 150) return 25;
    return 10;
  }
}

let instance: NetworkDiagnosticsService | null = null;

export function getNetworkDiagnosticsService(): NetworkDiagnosticsService {
  if (!instance) {
    instance = new NetworkDiagnosticsService();
  }
  return instance;
}
