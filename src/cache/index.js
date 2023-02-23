'use strict';

require('dotenv').config();

const log = require('../logging');
const NodeCache = require('node-cache');

/* Cache API calls that don't change often to speed up requests */
const CACHE_TTL_CANVAS = (parseInt(process.env.CACHE_CANVAS_API_SECONDS_TTL) > 0 ? parseInt(process.env.CACHE_CANVAS_API_SECONDS_TTL) : (60 * 10)); // 10m
const CACHE_TTL_DB = (parseInt(process.env.CACHE_DB_SECONDS_TTL) > 0 ? parseInt(process.env.CACHE_DB_SECONDS_TTL) : (60 * 5)); // 5m
const CACHE_CHECK_EXPIRE = 600; // 10m

/* Actual caches */
const courseGroupsCache = new NodeCache({ errorOnMissing:true, stdTTL: CACHE_TTL_CANVAS, checkperiod: CACHE_CHECK_EXPIRE });
const courseGroupCategoriesCache = new NodeCache({ errorOnMissing:true, stdTTL: CACHE_TTL_CANVAS, checkperiod: CACHE_CHECK_EXPIRE });
const courseTeacherEnrollmentsCache = new NodeCache({ errorOnMissing:true, stdTTL: CACHE_TTL_CANVAS, checkperiod: CACHE_CHECK_EXPIRE });

/* Setup caches with read/write stats */
let caches = [
    {
        name: "courseGroupsCache",
        writes: 0,
        reads: 0,
        bucket: courseGroupsCache
    },
    {
        name: "courseGroupCategoriesCache",
        writes: 0,
        reads: 0,
        bucket: courseGroupCategoriesCache
    },
    {
        name: "courseTeacherEnrollmentsCache",
        writes: 0,
        reads: 0,
        bucket: courseTeacherEnrollmentsCache
    }
];

/* Log when caches expire */
courseGroupsCache.on('expired', function(key) {
    log.debug("[Cache] Expired NodeCache entry for courseGroupsCache key '" + key + "'.");
});
courseGroupCategoriesCache.on('expired', function(key) {
    log.debug("[Cache] Expired NodeCache entry for courseGroupCategoriesCache key '" + key + "'.");
});
courseTeacherEnrollmentsCache.on('expired', function(key) {
    log.debug("[Cache] Expired NodeCache entry for courseTeacherEnrollmentsCache key '" + key + "'.");
});

/* Debug log when cache is set */
courseGroupsCache.on('set', function(key, value) {
    log.debug("[Cache] Set entry for courseGroupsCache key '" + key + "': " + typeof(value) === 'Object' ? JSON.stringify(value) : value);
});
courseGroupCategoriesCache.on('set', function(key, value) {
    log.debug("[Cache] Set entry for courseGroupCategoriesCache key '" + key + "': " + typeof(value) === 'Object' ? JSON.stringify(value) : value);
});
courseTeacherEnrollmentsCache.on('set', function(key, value) {
    log.debug("[Cache] Set entry for courseTeacherEnrollmentsCache key '" + key + "': " + typeof(value) === 'Object' ? JSON.stringify(value) : value);
});

/* Cache statistics */
async function addCacheRead(cacheName) {
    caches.filter(cache => {
        if (cache.name == cacheName) {
            cache.reads++;
        }
    });
}
async function addCacheWrite(cacheName) {
    caches.filter(cache => {
        if (cache.name == cacheName) {
            cache.writes++;
        }
    });
}

async function getCacheStats(cacheName) {
    let cacheStats;

    caches.filter(cache => {
        if (cache.name == cacheName) {
            cacheStats = cache.bucket.getStats();
        }
    });

    return cacheStats;
}

/* Set a cached value */
async function setCache(cacheName, key, value) {
    caches.filter(cache => {
        if (cache.name == cacheName) {
            cache.bucket.set(key, value);
        }
    });
}

/* Get a cached value */
async function getCache(cacheName, key) {
    let cacheValue;

    caches.filter(cache => {
        if (cache.name == cacheName) {
            cacheValue = cache.bucket.get(key);
        }
    });

    return cacheValue;
}

module.exports = {
    addCacheRead,
    addCacheWrite,
    setCache,
    getCache,
    getCacheStats
}
