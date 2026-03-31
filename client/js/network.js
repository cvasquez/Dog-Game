import { MSG } from '../../shared/constants.js';

export class Network {
  constructor() {
    this.ws = null;
    this.connected = false;
    this.handlers = {};
    this.lastInputState = null;
  }

  connect(roomId, playerName, breedId) {
    return new Promise((resolve, reject) => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      this.ws = new WebSocket(`${protocol}//${window.location.host}`);

      this.ws.onopen = () => {
        this.connected = true;
        // Send join message
        this.send({
          type: MSG.JOIN,
          name: playerName,
          breedId: breedId || 0,
          roomId: roomId || undefined,
        });
      };

      this.ws.onmessage = (event) => {
        let msg;
        try {
          msg = JSON.parse(event.data);
        } catch { return; }

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
    // Only send if input changed
    const s = JSON.stringify(inputState);
    if (s !== this.lastInputState) {
      this.lastInputState = s;
      this.send({ type: MSG.INPUT, ...inputState });
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

  sendSave() {
    this.send({ type: MSG.SAVE });
  }

  sendLoadWorldList() {
    this.send({ type: MSG.LOAD_WORLD });
  }

  disconnect() {
    if (this.ws) this.ws.close();
  }
}
