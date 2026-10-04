const DistributedKVStore = require("./src/DistributedKVStore");

function print(title, value) {
  console.log(`\n=== ${title} ===`);
  console.log(typeof value === "string" ? value : JSON.stringify(value, null, 2));
}

// Create the distributed store.
// Consistent hashing uses 10 virtual nodes per physical node.
// Two replicas are kept for better availability during node failure.
// The cache uses LRU eviction with a 60-second TTL.
const store = new DistributedKVStore({
  virtualNodes: 10,
  replicationFactor: 2,
  cacheSize: 3,
  cacheTTL: 60_000,
});

// Initial cluster.
["Node-A", "Node-B", "Node-C"].forEach((node) => store.addNode(node));

const seedData = {
  "user:101": { name: "Alice" },
  "user:102": { name: "Bob" },
  "user:103": { name: "Charlie" },
  "user:104": { name: "Diana" },
  "user:105": { name: "Eve" },
  "user:106": { name: "Frank" },
};

for (const [key, value] of Object.entries(seedData)) {
  store.put(key, value);
}

print("Initial Node Distribution", store.distribution());

print("Read user:101 (first read = cache miss)", store.get("user:101"));
print("Read user:101 (second read = cache hit)", store.get("user:101"));
print("Cache Statistics", store.cacheStats());

// Add a node and observe how many primary owners change.
const joinResult = store.addNode("Node-D");
print("Node Join: Node-D", joinResult);
print("Distribution After Join", store.distribution());

// Demonstrate failure tolerance by finding a key whose primary is a node
// we can safely stop, then reading it through its replica.
const targetKey = "user:101";
const primaryBeforeFailure = store.ring.getNode(targetKey);
store.get(targetKey); // warm the cache

// Remove the cached value so the following read proves replica fallback.
store.cache.delete(targetKey);

store.stopNode(primaryBeforeFailure);
print(`Simulated Failure: ${primaryBeforeFailure}`, store.nodeStatus());

const failureRead = store.get(targetKey);
print(`Read ${targetKey} During Node Failure`, failureRead);

// Recover the failed node and repair missing replica data.
const recoveryResult = store.startNode(primaryBeforeFailure);
print(`Recovered ${primaryBeforeFailure}`, recoveryResult);

// Demonstrate node leave.
const leaveCandidate = store.nodeStatus()
  .map((item) => item.name)
  .find((name) => name !== primaryBeforeFailure);

const leaveResult = store.removeNode(leaveCandidate);
print(`Node Leave: ${leaveCandidate}`, leaveResult);
print("Final Node Distribution", store.distribution());

print("Final Cache Statistics", store.cacheStats());
