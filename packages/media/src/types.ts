export interface MediaPlatform {
  userMedia(constraints: MediaStreamConstraints): Promise<MediaStream>;
  displayMedia(options: DisplayMediaStreamOptions): Promise<MediaStream>;
  devices(): Promise<MediaDeviceInfo[]>;
}

export interface CaptureOptions {
  readonly signal?: AbortSignal;
  readonly platform?: MediaPlatform;
}

export interface MediaCapture {
  readonly stream: MediaStream;
  readonly disposed: boolean;
  onEnded(listener: (track: MediaStreamTrack) => void): () => void;
  dispose(): void;
}
