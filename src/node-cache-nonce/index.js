'use strict';

/* The window ims-lti allows a launch timestamp, and so how long a nonce has to be remembered. */
const EXPIRE_IN_SEC = 5 * 60;

/**
 * A nonce store for ims-lti, backed by a NodeCache that lives as long as the process so that one
 * store can be shared by every launch.
 *
 * The provider builds its own store when none is passed to it, and a store that only ever sees one
 * launch cannot know that the launch before it used the same nonce. Sharing this one is what makes
 * a nonce single use, and a nonce that can be used twice means a captured launch can be posted
 * again for as long as its timestamp stays fresh, each time producing a session as that user.
 *
 * ims-lti asks a store for isNonceStore() and calls isNew(nonce, timestamp, next). Both are
 * implemented here rather than inherited from the library's own NonceStore, which would mean
 * requiring a file from inside a dependency by path.
 */
class NodeCacheNonceStore {
    constructor(cache) {
        this.cache = cache;
    }

    isNonceStore() {
        return true;
    }

    /**
     * Answers next(null, true) the first time a nonce is seen with a fresh timestamp, and an error
     * every time after that. The provider refuses the launch on anything but a true here.
     */
    isNew(nonce, timestamp, next = () => {}) {
        if (!nonce || typeof nonce === 'function' || !timestamp || typeof timestamp === 'function') {
            return next(new Error('Invalid parameters'), false);
        }

        /* Written so that a timestamp which is not a number fails this comparison rather than
           passing it: any comparison against NaN is false. */
        const age = Math.round(Date.now() / 1000) - parseInt(timestamp, 10);

        if (!(age <= EXPIRE_IN_SEC)) {
            return next(new Error('Expired timestamp'), false);
        }

        if (this.cache.get(nonce) !== undefined) {
            return next(new Error('Nonce already seen'), false);
        }

        this.setUsed(nonce, timestamp);

        return next(null, true);
    }

    /**
     * Remembers a nonce for as long as a launch carrying it could still be considered fresh. After
     * that the timestamp check refuses it, so there is nothing left to remember.
     */
    setUsed(nonce, timestamp, next = () => {}) {
        this.cache.set(nonce, timestamp, EXPIRE_IN_SEC);

        return next(null);
    }
}

module.exports = NodeCacheNonceStore;
