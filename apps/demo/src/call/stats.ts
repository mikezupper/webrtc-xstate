/** The connection report the stats dialog shows, summarized from one native `getStats()` sample. */
export interface CallStats {
  readonly at: number;
  readonly roundTripMs: number | null;
  readonly packetLossPercent: number | null;
  readonly jitterMs: number | null;
  readonly route: string | null;
  readonly outgoingVideo: string | null;
  readonly incomingVideo: string | null;
  readonly bytesSent: number;
  readonly bytesReceived: number;
  readonly sentKbps: number | null;
  readonly receivedKbps: number | null;
}
type Entry = Readonly<Record<string, unknown>>;
type StatsSource = Pick<ReadonlyMap<string, unknown>, "forEach" | "get">;
const numberOf = (entry: Entry | undefined, key: string) =>
  typeof entry?.[key] === "number" ? (entry[key] as number) : undefined;
const textOf = (entry: Entry | undefined, key: string) =>
  typeof entry?.[key] === "string" ? (entry[key] as string) : undefined;
function video(entry: Entry | undefined): string | null {
  const width = numberOf(entry, "frameWidth");
  const height = numberOf(entry, "frameHeight");
  if (!width || !height) return null;
  const fps = numberOf(entry, "framesPerSecond");
  return `${width} × ${height}${fps ? ` · ${Math.round(fps)} fps` : ""}`;
}
const kbps = (bytes: number, before: number, ms: number) =>
  ms > 0 && bytes >= before ? Math.round(((bytes - before) * 8) / ms) : null;

/** Pure: reads a stats report (or any map of stats dictionaries) into the dialog's summary. */
export function summarizeStats(report: StatsSource, previous?: CallStats): CallStats {
  const entries: Entry[] = [];
  report.forEach((value) => {
    if (value && typeof value === "object") entries.push(value as Entry);
  });
  const pair =
    entries.find(
      (entry) =>
        entry.type === "candidate-pair" && entry.state === "succeeded" && entry.nominated === true,
    ) ?? entries.find((entry) => entry.type === "candidate-pair" && entry.state === "succeeded");
  const candidate = (key: string) => {
    const id = textOf(pair, key);
    const value = id ? report.get(id) : undefined;
    return value && typeof value === "object" ? (value as Entry) : undefined;
  };
  const local = candidate("localCandidateId");
  const remote = candidate("remoteCandidateId");
  const inbound = entries.filter((entry) => entry.type === "inbound-rtp");
  const outbound = entries.filter((entry) => entry.type === "outbound-rtp");
  const sum = (list: Entry[], key: string) =>
    list.reduce((total, entry) => total + (numberOf(entry, key) ?? 0), 0);
  const lost = sum(inbound, "packetsLost");
  const received = sum(inbound, "packetsReceived");
  const jitters = inbound.map((entry) => numberOf(entry, "jitter")).filter((n) => n !== undefined);
  const rtt = numberOf(pair, "currentRoundTripTime");
  const at =
    numberOf(pair, "timestamp") ??
    entries.reduce((latest, entry) => Math.max(latest, numberOf(entry, "timestamp") ?? 0), 0);
  const bytesSent = sum(outbound, "bytesSent");
  const bytesReceived = sum(inbound, "bytesReceived");
  const elapsed = previous ? at - previous.at : 0;
  return {
    at,
    roundTripMs: rtt === undefined ? null : Math.round(rtt * 1000),
    packetLossPercent:
      lost + received > 0 ? Math.round((lost / (lost + received)) * 1000) / 10 : null,
    jitterMs: jitters.length ? Math.round(Math.max(...jitters) * 1000) : null,
    route:
      local && remote
        ? `${textOf(local, "candidateType") ?? "?"} → ${textOf(remote, "candidateType") ?? "?"} · ${
            textOf(local, "protocol") ?? textOf(remote, "protocol") ?? "?"
          }`
        : null,
    outgoingVideo: video(outbound.find((entry) => entry.kind === "video")),
    incomingVideo: video(inbound.find((entry) => entry.kind === "video")),
    bytesSent,
    bytesReceived,
    sentKbps: previous ? kbps(bytesSent, previous.bytesSent, elapsed) : null,
    receivedKbps: previous ? kbps(bytesReceived, previous.bytesReceived, elapsed) : null,
  };
}
