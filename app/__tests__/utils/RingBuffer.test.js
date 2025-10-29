const RingBuffer = require('../../src/utils/RingBuffer');

describe('RingBuffer', () => {
  describe('constructor', () => {
    it('should create a ring buffer with default capacity', () => {
      const buffer = new RingBuffer();
      
      expect(buffer.capacity).toBe(200);
      expect(buffer.head).toBe(0);
      expect(buffer.tail).toBe(0);
      expect(buffer.isFull).toBe(false);
    });

    it('should create a ring buffer with custom capacity', () => {
      const buffer = new RingBuffer(10);
      
      expect(buffer.capacity).toBe(10);
      expect(buffer.buffer.length).toBe(10);
    });

    it('should throw error for invalid capacity', () => {
      expect(() => new RingBuffer(0)).toThrow('RingBuffer capacity must be at least 1.');
      expect(() => new RingBuffer(-1)).toThrow('RingBuffer capacity must be at least 1.');
    });
  });

  describe('push', () => {
    it('should add items to buffer', () => {
      const buffer = new RingBuffer(3);
      
      buffer.push('item1');
      buffer.push('item2');
      
      expect(buffer.head).toBe(2);
      expect(buffer.tail).toBe(0);
      expect(buffer.isFull).toBe(false);
    });

    it('should mark buffer as full when capacity is reached', () => {
      const buffer = new RingBuffer(3);
      
      buffer.push('item1');
      buffer.push('item2');
      buffer.push('item3');
      
      expect(buffer.isFull).toBe(true);
      expect(buffer.head).toBe(0); // Wrapped around
    });

    it('should overwrite oldest items when buffer is full', () => {
      const buffer = new RingBuffer(3);
      
      buffer.push('item1');
      buffer.push('item2');
      buffer.push('item3');
      buffer.push('item4'); // Should overwrite item1
      
      expect(buffer.isFull).toBe(true);
      expect(buffer.head).toBe(1);
      expect(buffer.tail).toBe(1); // Tail advanced because buffer was full
    });

    it('should handle single capacity buffer', () => {
      const buffer = new RingBuffer(1);
      
      buffer.push('item1');
      expect(buffer.isFull).toBe(true);
      
      buffer.push('item2'); // Should overwrite item1
      expect(buffer.isFull).toBe(true);
      expect(buffer.getAll()).toEqual(['item2']);
    });
  });

  describe('getAll', () => {
    it('should return empty array for empty buffer', () => {
      const buffer = new RingBuffer(3);
      
      expect(buffer.getAll()).toEqual([]);
    });

    it('should return items in order when buffer is not full', () => {
      const buffer = new RingBuffer(5);
      
      buffer.push('item1');
      buffer.push('item2');
      buffer.push('item3');
      
      expect(buffer.getAll()).toEqual(['item1', 'item2', 'item3']);
    });

    it('should return items in order when buffer is full', () => {
      const buffer = new RingBuffer(3);
      
      buffer.push('item1');
      buffer.push('item2');
      buffer.push('item3');
      
      expect(buffer.getAll()).toEqual(['item1', 'item2', 'item3']);
    });

    it('should return items in correct order after wraparound', () => {
      const buffer = new RingBuffer(3);
      
      buffer.push('item1');
      buffer.push('item2');
      buffer.push('item3');
      buffer.push('item4'); // Overwrites item1
      buffer.push('item5'); // Overwrites item2
      
      expect(buffer.getAll()).toEqual(['item3', 'item4', 'item5']);
    });

    it('should handle complex wraparound scenarios', () => {
      const buffer = new RingBuffer(4);
      
      // Fill buffer
      buffer.push('a');
      buffer.push('b');
      buffer.push('c');
      buffer.push('d');
      expect(buffer.getAll()).toEqual(['a', 'b', 'c', 'd']);
      
      // Add more items causing wraparound
      buffer.push('e'); // Overwrites 'a'
      expect(buffer.getAll()).toEqual(['b', 'c', 'd', 'e']);
      
      buffer.push('f'); // Overwrites 'b'
      expect(buffer.getAll()).toEqual(['c', 'd', 'e', 'f']);
    });

    it('should handle different data types', () => {
      const buffer = new RingBuffer(3);
      
      buffer.push(1);
      buffer.push('string');
      buffer.push({ key: 'value' });
      
      expect(buffer.getAll()).toEqual([1, 'string', { key: 'value' }]);
    });
  });

  describe('clear', () => {
    it('should reset empty buffer', () => {
      const buffer = new RingBuffer(3);
      
      buffer.clear();
      
      expect(buffer.head).toBe(0);
      expect(buffer.tail).toBe(0);
      expect(buffer.isFull).toBe(false);
      expect(buffer.getAll()).toEqual([]);
    });

    it('should reset buffer with items', () => {
      const buffer = new RingBuffer(3);
      
      buffer.push('item1');
      buffer.push('item2');
      buffer.clear();
      
      expect(buffer.head).toBe(0);
      expect(buffer.tail).toBe(0);
      expect(buffer.isFull).toBe(false);
      expect(buffer.getAll()).toEqual([]);
    });

    it('should reset full buffer', () => {
      const buffer = new RingBuffer(3);
      
      buffer.push('item1');
      buffer.push('item2');
      buffer.push('item3');
      buffer.push('item4'); // Trigger wraparound
      
      buffer.clear();
      
      expect(buffer.head).toBe(0);
      expect(buffer.tail).toBe(0);
      expect(buffer.isFull).toBe(false);
      expect(buffer.getAll()).toEqual([]);
    });

    it('should allow adding items after clear', () => {
      const buffer = new RingBuffer(2);
      
      buffer.push('old1');
      buffer.push('old2');
      buffer.clear();
      
      buffer.push('new1');
      buffer.push('new2');
      
      expect(buffer.getAll()).toEqual(['new1', 'new2']);
    });
  });

  describe('edge cases', () => {
    it('should handle rapid push and getAll operations', () => {
      const buffer = new RingBuffer(2);
      
      buffer.push('a');
      expect(buffer.getAll()).toEqual(['a']);
      
      buffer.push('b');
      expect(buffer.getAll()).toEqual(['a', 'b']);
      
      buffer.push('c'); // Overwrites 'a'
      expect(buffer.getAll()).toEqual(['b', 'c']);
    });

    it('should maintain state consistency through multiple operations', () => {
      const buffer = new RingBuffer(2);
      
      // Test initial state
      expect(buffer.isFull).toBe(false);
      expect(buffer.getAll()).toEqual([]);
      
      // Add first item
      buffer.push(1);
      expect(buffer.isFull).toBe(false);
      expect(buffer.getAll()).toEqual([1]);
      
      // Fill buffer
      buffer.push(2);
      expect(buffer.isFull).toBe(true);
      expect(buffer.getAll()).toEqual([1, 2]);
      
      // Trigger wraparound
      buffer.push(3);
      expect(buffer.isFull).toBe(true);
      expect(buffer.getAll()).toEqual([2, 3]);
      
      // Clear and verify
      buffer.clear();
      expect(buffer.isFull).toBe(false);
      expect(buffer.getAll()).toEqual([]);
    });

    it('should handle null and undefined values', () => {
      const buffer = new RingBuffer(3);
      
      buffer.push(null);
      buffer.push(undefined);
      buffer.push(0);
      
      expect(buffer.getAll()).toEqual([null, undefined, 0]);
    });
  });
});