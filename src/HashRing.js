const crypto = require("crypto");

/**
 * HashRing implements consistent hashing with virtual nodes.
 * A key is assigned to the first ring position at or after its hash.
 * If the end of the ring is reached, the lookup wraps to position 0.
 */
class HashRing {
  constructor(virtualNodes = 10) {
    this.virtualNodes = virtualNodes;
    this.ring = [];
    this.nodes = new Set();
  }

  hash(value) {
    const digest = crypto.createHash("sha1").update(String(value)).digest();
    return digest.readUInt32BE(0);
  }

  addNode(nodeName) {
    if (this.nodes.has(nodeName)) {
      throw new Error(`Node "${nodeName}" already exists.`);
    }

    this.nodes.add(nodeName);

    for (let index = 0; index < this.virtualNodes; index += 1) {
      const virtualName = `${nodeName}#${index}`;
      this.ring.push({
        hash: this.hash(virtualName),
        nodeName,
        virtualName,
      });
    }

    this.sortRing();
  }

  removeNode(nodeName) {
    if (!this.nodes.has(nodeName)) {
      throw new Error(`Node "${nodeName}" does not exist.`);
    }

    this.nodes.delete(nodeName);
    this.ring = this.ring.filter((entry) => entry.nodeName !== nodeName);
  }

  sortRing() {
    this.ring.sort((a, b) => a.hash - b.hash);
  }

  getNode(key) {
    if (this.ring.length === 0) {
      throw new Error("Cannot route a key: no nodes are available.");
    }

    const keyHash = this.hash(key);

    let left = 0;
    let right = this.ring.length - 1;

    while (left <= right) {
      const middle = Math.floor((left + right) / 2);

      if (this.ring[middle].hash >= keyHash) {
        right = middle - 1;
      } else {
        left = middle + 1;
      }
    }

    const index = left % this.ring.length;
    return this.ring[index].nodeName;
  }

  /**
   * Return a unique ordered replica list beginning with the primary owner.
   */
  getNodes(key, count) {
    if (this.ring.length === 0) {
      throw new Error("Cannot route a key: no nodes are available.");
    }

    const keyHash = this.hash(key);
    let startIndex = this.ring.findIndex((entry) => entry.hash >= keyHash);

    if (startIndex === -1) {
      startIndex = 0;
    }

    const result = [];
    const seen = new Set();

    for (let offset = 0; offset < this.ring.length && result.length < count; offset += 1) {
      const entry = this.ring[(startIndex + offset) % this.ring.length];

      if (!seen.has(entry.nodeName)) {
        seen.add(entry.nodeName);
        result.push(entry.nodeName);
      }
    }

    return result;
  }

  getNodeNames() {
    return Array.from(this.nodes);
  }

  snapshotAssignments(keys) {
    const snapshot = {};

    for (const key of keys) {
      snapshot[key] = this.getNode(key);
    }

    return snapshot;
  }
}

module.exports = HashRing;
