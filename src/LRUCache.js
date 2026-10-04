/**
 * Small in-memory LRU cache with TTL support.
 * Map insertion order is used to track least-recently-used entries.
 */
class LRUCache {
  constructor(maxSize = 3, ttlMs = 30_000) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
    this.cache = new Map();

    this.hits = 0;
    this.misses = 0;
  }

  get(key) {
    const item = this.cache.get(key);

    if (!item) {
      this.misses += 1;
      return undefined;
    }

    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      this.misses += 1;
      return undefined;
    }

    // Refresh recency by moving the entry to the end.
    this.cache.delete(key);
    this.cache.set(key, item);

    this.hits += 1;
    return item.value;
  }

  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs,
    });

    while (this.cache.size > this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
  }

  delete(key) {
    this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }

  stats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate:
        this.hits + this.misses === 0
          ? 0
          : Number((this.hits / (this.hits + this.misses) * 100).toFixed(2)),
    };
  }
}

module.exports = LRUCache;
