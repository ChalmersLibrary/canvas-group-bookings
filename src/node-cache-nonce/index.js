(function() {
    var EXPIRE_IN_SEC, NonceStore, NodeCacheNonceStore, exports,
      extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
      hasProp = {}.hasOwnProperty;
  
    NonceStore = require('../../node_modules/ims-lti/lib/nonce-store');
  
    EXPIRE_IN_SEC = 5 * 60;
  
    NodeCacheNonceStore = (function(superClass) {
      extend(NodeCacheNonceStore, superClass);
  
      function NodeCacheNonceStore(nodeCache) {
        if (typeof nodeCache === 'string' && arguments.length === 2) {
          nodeCache = arguments[1];
        }
        this.cache = nodeCache;
      }
  
      NodeCacheNonceStore.prototype.isNew = function(nonce, timestamp, next) {
        var currentTime, freshTimestamp;
        if (next == null) {
          next = function() {};
        }
        if (typeof nonce === 'undefined' || nonce === null || typeof nonce === 'function' || typeof timestamp === 'function' || typeof timestamp === 'undefined') {
          return next(new Error('Invalid parameters'), false);
        }
        if (typeof timestamp === 'undefined' || timestamp === null) {
          return next(new Error('Timestamp required'), false);
        }
        currentTime = Math.round(Date.now() / 1000);
        freshTimestamp = (currentTime - parseInt(timestamp, 10)) <= EXPIRE_IN_SEC;
        if (!freshTimestamp) {
          return next(new Error('Expired timestamp'), false);
        }
        return this.cache.get(nonce, (function(_this) {
          return function(err, seen) {
            if (seen) {
              return next(new Error('Nonce already seen'), false);
            }
            _this.setUsed(nonce, timestamp);
            return next(null, true);
          };
        })(this));
      };
  
      NodeCacheNonceStore.prototype.setUsed = function(nonce, timestamp, next) {
        if (next == null) {
          next = function() {};
        }
        this.cache.set(nonce, timestamp, EXPIRE_IN_SEC);
        return next(null);
      };
  
      return NodeCacheNonceStore;
  
    })(NonceStore);
  
    exports = module.exports = NodeCacheNonceStore;
  
  }).call(this);
  