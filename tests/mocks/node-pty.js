import { vi } from 'vitest';
import { EventEmitter } from 'events';

class MockPty extends EventEmitter {
  constructor() {
    super();
    this.pid = 12345;
    this.exitCode = null;
    this._killed = false;
    this._dataHandlers = [];
    this._exitHandlers = [];
  }

  write(data) {
    // Mock writing to terminal
    this._dataHandlers.forEach(handler => handler(`echo: ${data}`));
  }

  resize(cols, rows) {
    // Mock terminal resize
  }

  kill(signal = 'SIGTERM') {
    this._killed = true;
    this.exitCode = signal === 'SIGKILL' ? 9 : 0;
    setTimeout(() => {
      this._exitHandlers.forEach(handler => handler(this.exitCode, signal));
    }, 10);
  }

  onData(handler) {
    this._dataHandlers.push(handler);
  }

  onExit(handler) {
    this._exitHandlers.push(handler);
  }

  get killed() {
    return this._killed;
  }
}

export const mockNodePty = {
  spawn: vi.fn(() => new MockPty()),
};

vi.mock('node-pty', () => mockNodePty);