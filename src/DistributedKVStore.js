const HashRing = require("./HashRing");
const LRUCache = require("./LRUCache");
const StorageNode = require("./StorageNode");

/**
 * Transparent distributed key-value store.
 *
 * Users interact with put/get/delete without knowing which node stores a key.
 * Internally, consistent hashing selects a primary and replica nodes.
 */
class DistributedKVStore {
  constructor({
    virtualNodes = 10,
    replicationFactor = 2,
    cacheSize = 3,
    cacheTTL = 30_000,
  } = {}) {
    this.ring = new HashRing(virtualNodes);
    this.nodes = new Map();
    this.tombstones = new Set();
    this.cache = new LRUCache(cacheSize, cacheTTL);
    this.replicationFactor = replicationFactor;
  }

  addNode(name) {
    if (this.nodes.has(name)) {
      throw new Error(`Node "${name}" already exists.`);
    }

    this.nodes.set(name, new StorageNode(name));

    const previousAssignments = this.primaryAssignments();

    this.ring.addNode(name);

    const movedKeys = this.rebalance();
    const currentAssignments = this.primaryAssignments();

    return {
      action: "join",
      node: name,
      movedPrimaryKeys: this.countAssignmentChanges(
        previousAssignments,
        currentAssignments
      ),
      replicaMoves: movedKeys,
    };
  }

  removeNode(name) {
    const node = this.getNodeOrThrow(name);
    const previousAssignments = this.primaryAssignments();

    this.nodes.delete(name);
    this.ring.removeNode(name);

    const movedKeys = this.rebalance();
    const currentAssignments = this.primaryAssignments();

    // Keep a tombstone for removed-node keys only through rebalance;
    // all surviving copies have already been redistributed.
    node.data.clear();

    return {
      action: "leave",
      node: name,
      movedPrimaryKeys: this.countAssignmentChanges(
        previousAssignments,
        currentAssignments
      ),
      replicaMoves: movedKeys,
    };
  }

  stopNode(name) {
    const node = this.getNodeOrThrow(name);
    node.healthy = false;

    return {
      action: "failure",
      node: name,
      healthyNodes: this.healthyNodeNames(),
    };
  }

  startNode(name) {
    const node = this.getNodeOrThrow(name);
    node.healthy = true;

    const movedKeys = this.rebalance();

    return {
      action: "recovery",
      node: name,
      replicaMoves: movedKeys,
    };
  }

  put(key, value) {
    if (value === undefined) {
      throw new Error("A value is required.");
    }

    this.tombstones.delete(key);

    const replicaNames = this.ring.getNodes(key, this.replicationFactor);
    let successfulWrites = 0;

    for (const name of replicaNames) {
      const node = this.nodes.get(name);

      if (node && node.healthy) {
        node.put(key, value);
        successfulWrites += 1;
      }
    }

    if (successfulWrites === 0) {
      throw new Error("No healthy replica is available for this key.");
    }

    this.cache.set(key, value);

    return {
      key,
      value,
      primary: replicaNames[0],
      replicas: replicaNames,
      successfulWrites,
    };
  }

  get(key) {
    if (this.tombstones.has(key)) {
      return null;
    }

    const cachedValue = this.cache.get(key);

    if (cachedValue !== undefined) {
      return {
        key,
        value: cachedValue,
        source: "cache",
      };
    }

    const replicaNames = this.ring.getNodes(key, this.replicationFactor);

    for (const name of replicaNames) {
      const node = this.nodes.get(name);

      if (node && node.healthy && node.has(key)) {
        const value = node.get(key);
        this.cache.set(key, value);

        return {
          key,
          value,
          source: name,
          fallback: name !== replicaNames[0],
        };
      }
    }

    return null;
  }

  delete(key) {
    this.tombstones.add(key);
    this.cache.delete(key);

    for (const node of this.nodes.values()) {
      node.delete(key);
    }

    return {
      key,
      deleted: true,
    };
  }

  primaryAssignments() {
    const keys = this.allKeys();
    return this.ring.snapshotAssignments(keys);
  }

  allKeys() {
    const keys = new Set();

    for (const node of this.nodes.values()) {
      for (const key of node.data.keys()) {
        if (!this.tombstones.has(key)) {
          keys.add(key);
        }
      }
    }

    return Array.from(keys);
  }

  rebalance() {
    const allData = new Map();

    for (const node of this.nodes.values()) {
      for (const [key, value] of node.data.entries()) {
        if (!this.tombstones.has(key)) {
          if (!allData.has(key)) {
            allData.set(key, value);
          }
        }
      }
    }

    let replicaMoves = 0;

    for (const [key, value] of allData.entries()) {
      const desiredReplicas = new Set(
        this.ring.getNodes(key, this.replicationFactor)
      );

      // Add missing copies where possible.
      for (const desiredName of desiredReplicas) {
        const node = this.nodes.get(desiredName);

        if (node && node.healthy && !node.has(key)) {
          node.put(key, value);
          replicaMoves += 1;
        }
      }

      // Remove copies that are no longer part of the desired replica set.
      for (const node of this.nodes.values()) {
        if (!desiredReplicas.has(node.name) && node.has(key) && node.healthy) {
          node.delete(key);
          replicaMoves += 1;
        }
      }
    }

    return replicaMoves;
  }

  distribution() {
    const result = {};

    for (const [name, node] of this.nodes.entries()) {
      result[name] = {
        healthy: node.healthy,
        keys: Array.from(node.data.keys()).filter(
          (key) => !this.tombstones.has(key)
        ),
        count: node.size(),
      };
    }

    return result;
  }

  cacheStats() {
    return this.cache.stats();
  }

  nodeStatus() {
    return this.healthyNodeNames().map((name) => ({
      name,
      healthy: this.nodes.get(name).healthy,
    }));
  }

  healthyNodeNames() {
    return Array.from(this.nodes.values())
      .filter((node) => node.healthy)
      .map((node) => node.name);
  }

  getNodeOrThrow(name) {
    const node = this.nodes.get(name);

    if (!node) {
      throw new Error(`Node "${name}" does not exist.`);
    }

    return node;
  }

  countAssignmentChanges(before, after) {
    const allKeys = new Set([
      ...Object.keys(before),
      ...Object.keys(after),
    ]);

    let changes = 0;

    for (const key of allKeys) {
      if (before[key] && after[key] && before[key] !== after[key]) {
        changes += 1;
      }
    }

    return changes;
  }
}

module.exports = DistributedKVStore;
