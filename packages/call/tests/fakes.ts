import type { MediaCapture } from "@peerweave/media";
import type { Peer, PeerEvents, PeerState } from "@peerweave/peer";
export class FakePeer implements Peer {
  state: PeerState = {
    closed: false,
    connectionState: "new",
    signalingState: "stable",
    iceConnectionState: "new",
    iceGatheringState: "new",
  };
  observers = new Set<(state: PeerState) => void>();
  listeners: { [K in keyof PeerEvents]: Set<(v: PeerEvents[K]) => void> } = {
    track: new Set<(v: RTCTrackEvent) => void>(),
    datachannel: new Set<(v: RTCDataChannelEvent) => void>(),
    error: new Set<(v: Error) => void>(),
  };
  closes = 0;
  restarts = 0;
  received: unknown[] = [];
  senders: RTCRtpSender[] = [];
  getState() {
    return this.state;
  }
  subscribe(fn: (s: PeerState) => void) {
    this.observers.add(fn);
    fn(this.state);
    return () => {
      this.observers.delete(fn);
    };
  }
  change(connectionState: RTCPeerConnectionState) {
    this.state = { ...this.state, connectionState };
    for (const fn of this.observers) fn(this.state);
  }
  on<K extends keyof PeerEvents>(event: K, fn: (v: PeerEvents[K]) => void) {
    this.listeners[event].add(fn);
    return () => {
      this.listeners[event].delete(fn);
    };
  }
  async receiveSignal(input: unknown) {
    this.received.push(input);
  }
  addTrack(track: MediaStreamTrack) {
    const sender = {
      track: track as MediaStreamTrack | null,
      replaceTrack: async (t: MediaStreamTrack | null) => {
        sender.track = t;
      },
    };
    this.senders.push(sender as RTCRtpSender);
    return sender as RTCRtpSender;
  }
  removeTrack(sender: RTCRtpSender) {
    this.senders = this.senders.filter((s) => s !== sender);
  }
  addTransceiver() {
    return {} as RTCRtpTransceiver;
  }
  getTransceivers() {
    return [];
  }
  createDataChannel(label: string) {
    return { label } as RTCDataChannel;
  }
  async getStats() {
    return new Map() as RTCStatsReport;
  }
  restartIce() {
    this.restarts++;
  }
  close() {
    this.closes++;
    this.state = { ...this.state, closed: true, connectionState: "closed" };
  }
}
export function captureFixture(kind = "video") {
  const track = {
    kind,
    enabled: true,
    readyState: "live",
    stop() {
      track.readyState = "ended";
    },
  };
  const stream = {
    getTracks: () => [track as MediaStreamTrack],
    getVideoTracks: () => (kind === "video" ? [track as MediaStreamTrack] : []),
    getAudioTracks: () => (kind === "audio" ? [track as MediaStreamTrack] : []),
  } as unknown as MediaStream;
  const ended = new Set<(t: MediaStreamTrack) => void>();
  let disposals = 0;
  const capture: MediaCapture = {
    stream,
    get disposed() {
      return disposals > 0;
    },
    onEnded(fn) {
      ended.add(fn);
      return () => {
        ended.delete(fn);
      };
    },
    dispose() {
      if (disposals) return;
      disposals++;
      track.stop();
    },
  };
  return {
    track,
    capture,
    end() {
      for (const fn of ended) fn(track as MediaStreamTrack);
    },
    get disposals() {
      return disposals;
    },
  };
}
