import { MSG } from '../../shared/constants.js';

// msgpackr is loaded via UMD script tag — globalThis.msgpackr
const msgpackUnpack = globalThis.msgpackr
  ? new globalThis.msgpackr.Unpackr({ mapsAsObjects: true, useRecords: false })
  : null;

export class Network {
  constructor() {
    this.ws = null;
    this.connected = false;
    this.handlers = {};
    // Input dedup — track last sent values to avoid JSON.stringify each frame
    this._prevLeft = false;
    this._prevRight = false;
    this._prevUp = false;
    this._prevDown = false;
    this._prevJump = false;
    this._prevDig = false;
    this._prevSprint = false;
    // Input sequencing for server reconciliation
    this.inputSeq = 0;
    // Latency measurement
    this.rtt = 0;
    this._pingInterval = null;
  }

  connect(roomId, playerName, breedId) {
    return new Promise((resolve, reject) => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      this.ws = new WebSocket(`${protocol}//${window.location.host}`);
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => {
        this.connected = true;
        // Send join message
        this.send({
          type: MSG.JOIN,
          name: playerName,
          breedId: breedId || 0,
          roomId: roomId || undefined,
        });
        // Start latency measurement
        this._pingInterval = setInterval(() => {
          this.send({ type: MSG.NET_PING, t: performance.now() });
        }, 2000);
      };

      this.ws.onmessage = (event) => {
        let msg;
        try {
          if (event.data instanceof ArrayBuffer) {
            // Binary frame — msgpack-encoded STATE message
            msg = msgpackUnpack
              ? msgpackUnpack.unpack(new Uint8Array(event.data))
              : JSON.parse(new TextDecoder().decode(event.data));
          } else {
            msg = JSON.parse(event.data);
          }
        } catch { return; }

        // Latency measurement
        if (msg.type === MSG.NET_PONG) {
          const sample = performance.now() - msg.t;
          this.rtt = this.rtt === 0 ? sample : this.rtt * 0.8 + sample * 0.2;
          return;
        }

        // First message should be ROOM_JOINED
        if (msg.type === MSG.ROOM_JOINED) {
          resolve(msg);
        }

        if (msg.type === MSG.ERROR && !this.handlers[MSG.ERROR]) {
          reject(new Error(msg.message));
          return;
        }

        const handler = this.handlers[msg.type];
        if (handler) handler(msg);
      };

      this.ws.onclose = () => {
        this.connected = false;
        if (this.handlers['close']) this.handlers['close']();
      };

      this.ws.onerror = () => {
        reject(new Error('Connection failed'));
      };

      // Timeout
      setTimeout(() => reject(new Error('Connection timeout')), 5000);
    });
  }

  on(type, handler) {
    this.handlers[type] = handler;
  }

  send(msg) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  sendInput(inputState) {
    // Only send if any input field changed (avoids JSON.stringify per frame)
    if (inputState.left !== this._prevLeft || inputState.right !== this._prevRight ||
        inputState.up !== this._prevUp || inputState.down !== this._prevDown ||
        inputState.jump !== this._prevJump || inputState.dig !== this._prevDig ||
        inputState.sprint !== this._prevSprint) {
      this._prevLeft = inputState.left;
      this._prevRight = inputState.right;
      this._prevUp = inputState.up;
      this._prevDown = inputState.down;
      this._prevJump = inputState.jump;
      this._prevDig = inputState.dig;
      this._prevSprint = inputState.sprint;
      this.send({ type: MSG.INPUT, seq: ++this.inputSeq, ...inputState });
    }
  }

  sendEmote(emoteId) {
    this.send({ type: MSG.EMOTE, emoteId });
  }

  sendPlaceDecoration(decorationId, x, y) {
    this.send({ type: MSG.PLACE_DECORATION, decorationId, x, y });
  }

  sendBuyEmote(emoteId) {
    this.send({ type: MSG.BUY_EMOTE, emoteId });
  }

  sendBuyDecoration(decorationId) {
    this.send({ type: MSG.BUY_DECORATION, decorationId });
  }

  sendBuyUpgrade(upgradeId) {
    this.send({ type: MSG.BUY_UPGRADE, upgradeId });
  }

  sendSave() {
    this.send({ type: MSG.SAVE });
  }

  sendLoadWorldList() {
    this.send({ type: MSG.LOAD_WORLD });
  }

  disconnect() {
    if (this._pingInterval) clearInterval(this._pingInterval);
    if (this.ws) this.ws.close();
  }
}
