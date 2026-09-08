'use strict';

/*
 * Which course this page belongs to, carried on everything it asks the server for.
 *
 * The session cookie is per origin rather than per tab, so the server cannot tell two tabs apart
 * by their session. The page therefore names its own launch: the key is rendered into a meta tag,
 * sent as a header on every api call, and added to urls the page navigates to. A request without
 * it is refused rather than answered from whichever launch was most recent, so a link or a call
 * that has not been given the key fails visibly instead of acting on the wrong course.
 *
 * fetch is wrapped once here rather than at each call site, so a call site added later carries the
 * header without anybody remembering to add it. Navigations cannot be intercepted the same way and
 * use ctxUrl() explicitly.
 */

(function () {
    const meta = document.querySelector('meta[name="lti-context"]');
    const key = meta ? meta.getAttribute('content') : '';

    /* Same-origin only: the header names a launch in this application's session and has no meaning
       anywhere else, and a relative url is same-origin by definition. */
    const sameOrigin = (input) => {
        try {
            const url = new URL(typeof input === 'string' ? input : input.url, window.location.href);

            return url.origin === window.location.origin;
        }
        catch (error) {
            return false;
        }
    };

    const originalFetch = window.fetch;

    window.fetch = function (input, init) {
        if (!key || !sameOrigin(input)) {
            return originalFetch.call(this, input, init);
        }

        const options = Object.assign({}, init);
        const headers = new Headers(options.headers || (input instanceof Request ? input.headers : undefined));

        headers.set('X-LTI-Context', key);
        options.headers = headers;

        return originalFetch.call(this, input, options);
    };

    /* A url the page navigates to, with the key added. Mirrors withKey() in src/lti/context.js. */
    window.ctxUrl = function (url) {
        if (!key) {
            return url;
        }

        return url + (url.indexOf('?') === -1 ? '?' : '&') + 'ctx=' + encodeURIComponent(key);
    };

    window.ltiContextKey = key;
})();
