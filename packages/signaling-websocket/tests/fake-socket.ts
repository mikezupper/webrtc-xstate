export class FakeSocket extends EventTarget {
  bufferedAmount = 0;
  sent: string[] = [];
  closes = 0;
  sendFailure: Error | undefined;
  send(message: string) {
    if (this.sendFailure) throw this.sendFailure;
    this.sent.push(message);
  }
  close() {
    this.closes++;
  }
  open() {
    this.dispatchEvent(new Event("open"));
  }
  message(value: unknown) {
    this.dispatchEvent(new MessageEvent("message", { data: JSON.stringify(value) }));
  }
  raw(data: unknown) {
    this.dispatchEvent(new MessageEvent("message", { data }));
  }
  asSocket() {
    return this as unknown as WebSocket;
  }
}
