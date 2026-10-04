# Distributed Key-Value Store with Consistent Hashing and Caching

## Project Overview

This project is a Node.js simulation of a basic distributed key-value storage system.

It demonstrates the following distributed-system concepts:

- Consistent hashing
- Dynamic node join and leave
- Minimal key movement after topology changes
- LRU caching with TTL
- Data replication for limited availability
- Node failure and recovery
- Transparent access to distributed data

No external npm dependencies are required.

## Requirements

- Node.js 18+ recommended
- npm

## Project Structure

```text
distributed-kv-store-consistent-hashing/
├── src/
│   ├── DistributedKVStore.js
│   ├── HashRing.js
│   ├── LRUCache.js
│   └── StorageNode.js
├── tests/
│   └── test.js
├── index.js
├── package.json
├── package-lock.json
├── .gitignore
└── README.md
```

## Core Design

### 1. Consistent Hashing

The system maps both nodes and keys onto a logical hash ring.

Virtual nodes are used so that each physical node owns multiple positions on the ring. A key is routed to the first ring position at or after the key's hash.

When a node joins or leaves, only part of the key space needs a new primary owner rather than reassigning every key.

### 2. Replication

The store uses a replication factor of `2`.

For every key:

```text
Primary replica
Secondary replica
```

This gives the simulation limited availability when a node fails.

The user does not need to know which nodes hold the data.

### 3. Caching

An in-memory **LRU cache** stores recently requested values.

The cache also supports **TTL (Time-To-Live)**. Entries expire after the configured duration.

The example configuration is:

```text
Cache size: 3
TTL: 60 seconds
```

The cache records:

- Hits
- Misses
- Hit rate

### 4. Failure Handling

A node can be marked as unhealthy without being removed from the ring.

When the primary node for a key fails, the `get()` operation tries the replica nodes and returns the value from a healthy replica.

After recovery, the system rebalances data where required.

## Supplied Dataset

The checkpoint dataset is loaded by `index.js`:

```text
user:101 → {"name": "Alice"}
user:102 → {"name": "Bob"}
user:103 → {"name": "Charlie"}
user:104 → {"name": "Diana"}
user:105 → {"name": "Eve"}
user:106 → {"name": "Frank"}
```

## API of the Simulation

The main class is `DistributedKVStore`.

### Add a Node

```js
store.addNode("Node-D");
```

### Remove a Node

```js
store.removeNode("Node-D");
```

### Simulate Failure

```js
store.stopNode("Node-B");
```

### Recover a Node

```js
store.startNode("Node-B");
```

### Store Data

```js
store.put("user:101", { name: "Alice" });
```

### Retrieve Data

```js
store.get("user:101");
```

### Delete Data

```js
store.delete("user:101");
```

### Inspect Distribution

```js
store.distribution();
```

### Inspect Cache

```js
store.cacheStats();
```

## Running the Project

Install dependencies (none are currently required):

```bash
npm install
```

Run the simulation:

```bash
npm start
```

or:

```bash
node index.js
```

The console demonstrates:

1. Initial distribution of users across nodes
2. Cache miss followed by a cache hit
3. Node join and primary-key movement
4. Node failure
5. Successful read through a replica
6. Node recovery
7. Node leave and redistribution
8. Final distribution and cache statistics

## Testing

Run:

```bash
npm test
```

Expected result:

```text
✅ All distributed key-value store tests passed.
```

## How the Requirements Are Demonstrated

| Checkpoint Requirement | Implementation |
|---|---|
| Consistent hashing | `HashRing.js` |
| Dynamic node join | `store.addNode()` |
| Dynamic node leave | `store.removeNode()` |
| Observe minimal movement | `movedPrimaryKeys` reported after topology changes |
| Caching | `LRUCache.js` |
| LRU policy | Map recency ordering |
| TTL policy | Cache expiration timestamps |
| Node failure | `store.stopNode()` |
| Limited availability | Replica fallback during `get()` |
| Transparency | `put/get/delete` hide node-level routing |
| Sample data | `index.js` |
| Automated verification | `tests/test.js` |

## Transparency Example

A client only needs to call:

```js
store.get("user:101");
```

The client does not need to know:

```text
Which node is primary?
Which node is the replica?
Which node failed?
```

The distributed store handles routing and fallback internally.

## Scalability and Availability

Consistent hashing reduces the amount of key reassignment required when nodes are added or removed.

Replication improves availability because another healthy node can answer a read when the primary node is unavailable.

This is a simplified educational simulation rather than a production storage engine. It focuses on demonstrating the distributed-system concepts required by the checkpoint.

## Submission Checklist

- [x] Consistent hashing implemented
- [x] Node join implemented
- [x] Node leave implemented
- [x] Minimal primary-key movement measured
- [x] LRU cache implemented
- [x] TTL expiration implemented
- [x] Node failure simulation implemented
- [x] Replica fallback implemented
- [x] Node recovery implemented
- [x] Transparent `put/get/delete` interface implemented
- [x] Provided six-user dataset included
- [x] Test script included
- [x] README included

Author 

Aliyu Mubarak