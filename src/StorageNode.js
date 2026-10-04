/**
 * Represents a single storage node in the distributed system.
 */
class StorageNode {
  constructor(name) {
    this.name = name;
    this.healthy = true;
    this.data = new Map();
  }

  put(key, value) {
    this.data.set(key, value);
  }

  get(key) {
    return this.data.get(key);
  }

  has(key) {
    return this.data.has(key);
  }

  delete(key) {
    this.data.delete(key);
  }

  size() {
    return this.data.size;
  }
}

module.exports = StorageNode;
