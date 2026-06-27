// src/stats/core/StatsCache.js

const CACHE_TTL = 5 * 60 * 1000; // 5 دقائق

class StatsCache {
    constructor() {
        this.cache = new Map();
    }

    set(key, data) {
        this.cache.set(key, {
            data: JSON.parse(JSON.stringify(data)),
            timestamp: Date.now()
        });
    }

    get(key) {
        const entry = this.cache.get(key);
        if (!entry) return null;
        if (Date.now() - entry.timestamp > CACHE_TTL) {
            this.cache.delete(key);
            return null;
        }
        return entry.data;
    }

    invalidate(key) {
        this.cache.delete(key);
    }

    clear() {
        this.cache.clear();
    }

    renew(key) {
        const entry = this.cache.get(key);
        if (entry) {
            entry.timestamp = Date.now();
            this.cache.set(key, entry);
        }
    }
}

export const statsCache = new StatsCache();