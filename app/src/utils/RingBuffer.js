/**
 * A simple, efficient, fixed-size ring buffer implementation.
 */
class RingBuffer {
  /**
   * @param {number} capacity The maximum number of items the buffer can hold.
   */
  constructor(capacity = 200) {
    if (capacity < 1) throw new Error('RingBuffer capacity must be at least 1.');
    this.capacity = capacity;
    this.buffer = new Array(capacity);
    this.head = 0; // Points to the next slot to write to
    this.tail = 0; // Points to the oldest item
    this.isFull = false;
  }

  /**
   * Adds an item to the buffer, overwriting the oldest item if full.
   * @param {*} item The item to add.
   */
  push(item) {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.capacity;

    if (this.isFull) {
      this.tail = (this.tail + 1) % this.capacity;
    } else if (this.head === this.tail) {
      this.isFull = true;
    }
  }

  /**
   * Returns all items in the buffer in order from oldest to newest.
   * @returns {Array<*>}
   */
  getAll() {
    const result = [];
    if (this.isFull) {
      for (let i = 0; i < this.capacity; i++) {
        result.push(this.buffer[(this.tail + i) % this.capacity]);
      }
    } else {
      for (let i = this.tail; i !== this.head; i = (i + 1) % this.capacity) {
        result.push(this.buffer[i]);
      }
    }
    return result;
  }

  /**
   * Clears the buffer.
   */
  clear() {
    this.buffer = new Array(this.capacity);
    this.head = 0;
    this.tail = 0;
    this.isFull = false;
  }
}

module.exports = RingBuffer;
