'use strict';

const log = require('./logging');
const lti = require('./lti/canvas');

/*
 * What this instance is configured to be, for one line at startup.
 *
 * Every value here is set per deployment, and a wrong one does not announce itself: the
 * application starts normally and serves normally against another Canvas, another database or
 * nowhere at all. Deployment platforms that move settings between environments can change any of
 * them without the code being touched, so the running process is the only thing that knows what
 * it actually got, and it is the only place the answer can be recorded.
 *
 * Hosts and names only. Nothing here may carry a credential.
 */
const summary = () => ({
    environment: process.env.NODE_ENV ? process.env.NODE_ENV : "(unset)",
    node_version: process.version,
    canvas_api_domains: lti.servedApiDomains(),
    enforce_api_domain: lti.enforceApiDomain(),
    auth_redirect_callback: process.env.AUTH_REDIRECT_CALLBACK ? process.env.AUTH_REDIRECT_CALLBACK : "(unset)",
    database: process.env.PGDATABASE ? process.env.PGDATABASE : "(unset)",
    logstash_source: log.logstashTarget() ? log.logstashTarget() : "(not shipping)"
});

/* The same thing as one sentence, because a log message is read before its detail is. */
const summaryLine = () => {
    const configured = summary();
    const domains = configured.canvas_api_domains.length ? configured.canvas_api_domains.join(", ") : "(none)";

    return `Configured for Canvas ${domains}, database ${configured.database}, ` +
        `environment ${configured.environment}, logstash ${configured.logstash_source}.`;
};

/*
 * The Content-Security-Policy this instance serves.
 *
 * `frame-src` governs what the tool is allowed to embed, so anything it needs to show in an
 * iframe of its own has to be named here. A CSP source list is space separated, so
 * CSP_FRAME_SRC_ALLOW may hold several hosts separated by spaces, and wildcards are permitted in
 * the leftmost label.
 *
 * Deliberately no frame-ancestors directive: that one governs who may embed the tool, and the
 * tool is only ever reached inside an iframe in Canvas. Naming an origin there, or letting a
 * default supply 'self', locks every user out.
 */
const contentSecurityPolicy = () =>
    "default-src 'self'; script-src 'self' cdn.jsdelivr.net unpkg.com; " +
    "style-src 'self' 'unsafe-inline' cdn.jsdelivr.net fonts.googleapis.com; " +
    "font-src 'self' cdn.jsdelivr.net fonts.gstatic.com; img-src 'self' data:; frame-src 'self'" +
    (process.env.CSP_FRAME_SRC_ALLOW ? " " + process.env.CSP_FRAME_SRC_ALLOW : "");

module.exports = {
    summary,
    summaryLine,
    contentSecurityPolicy
}
