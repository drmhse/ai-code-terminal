import { vi } from 'vitest';
import { EventEmitter } from 'events';

class MockSocket extends EventEmitter {
  constructor() {
    super();
    this.id = 'mock-socket-id';
    this.connected = true;
    this.user = { id: 'test-user', username: 'test-user' };
  }

  emit(event, ...args) {
    super.emit(event, ...args);
    return this;
  }

  disconnect() {
    this.connected = false;
    this.emit('disconnect');
  }

  join(room) {
    // Mock room joining
  }

  leave(room) {
    // Mock room leaving
  }
}

class MockServer extends EventEmitter {
  constructor() {
    super();
    this.sockets = new Map();
  }

  use(middleware) {
    // Mock middleware registration
  }

  to(room) {
    return {
      emit: vi.fn(),
    };
  }

  emit(event, ...args) {
    super.emit(event, ...args);
    return this;
  }
}

export const mockSocketServer = new MockServer();
export const createMockSocket = () => new MockSocket();

vi.mock('socket.io', () => ({
  Server: vi.fn(() => mockSocketServer),
}));