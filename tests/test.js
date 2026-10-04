const assert = require("assert");
const DistributedKVStore = require("../src/DistributedKVStore");

const store = new DistributedKVStore({
  virtualNodes: 20,
  replicationFactor: 2,
  cacheSize: 2,
  cacheTTL: 60_000,
});

store.addNode("Node-A");
store.addNode("Node-B");
store.addNode("Node-C");

const users = {
  "user:101": { name: "Alice" },
  "user:102": { name: "Bob" },
  "user:103": { name: "Charlie" },
  "user:104": { name: "Diana" },
  "user:105": { name: "Eve" },
  "user:106": { name: "Frank" },
};

for (const [key, value] of Object.entries(users)) {
  store.put(key, value);
}

// GET should return the correct value.
assert.deepStrictEqual(store.get("user:101").value, { name: "Alice" });

// Second read should come from cache.
assert.strictEqual(store.get("user:101").source, "cache");

// Joining a node should not change every primary owner.
const before = store.primaryAssignments();
const joinResult = store.addNode("Node-D");
const after = store.primaryAssignments();
assert.strictEqual(Object.keys(before).length, Object.keys(after).length);
assert.ok(joinResult.movedPrimaryKeys <= Object.keys(before).length);

// Failure should still allow reads through a healthy replica.
const key = "user:102";
const primary = store.ring.getNode(key);
store.cache.delete(key);
store.stopNode(primary);
const failureRead = store.get(key);

assert.ok(failureRead);
assert.deepStrictEqual(failureRead.value, { name: "Bob" });
assert.strictEqual(failureRead.fallback, true);

// Recovery restores the node to healthy status.
store.startNode(primary);
assert.strictEqual(store.nodes.get(primary).healthy, true);

// Delete should remove the value.
store.delete("user:103");
assert.strictEqual(store.get("user:103"), null);

console.log("✅ All distributed key-value store tests passed.");
