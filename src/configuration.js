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
    /* Named here because a value that omits a Canvas host in use denies every launch from it. */
    frame_ancestors: process.env.CSP_FRAME_ANCESTORS ? process.env.CSP_FRAME_ANCESTORS : "(any site may embed)",
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
 * Two directives here concern framing and they point in opposite directions.
 *
 * `frame-src` governs what the tool may embed, and CSP_FRAME_SRC_ALLOW extends it. A CSP source
 * list is space separated, so that variable may name several hosts, and a wildcard is allowed in
 * the leftmost label. Commas do not separate sources.
 *
 * `frame-ancestors` governs who may embed the tool, which is the one that matters for a tool
 * reached only from inside Canvas. It is omitted unless CSP_FRAME_ANCESTORS names the hosts that
 * embed this deployment, and omitting it permits any site to frame the tool. That default is
 * deliberate: a value that does not name every Canvas host in use denies every user at once, and
 * there is no other way into the tool, so it has to be something a deployment turns on and can
 * turn off again by clearing a variable rather than by deploying.
 */
const contentSecurityPolicy = () =>
    "default-src 'self'; script-src 'self' cdn.jsdelivr.net unpkg.com; " +
    "style-src 'self' 'unsafe-inline' cdn.jsdelivr.net fonts.googleapis.com; " +
    "font-src 'self' cdn.jsdelivr.net fonts.gstatic.com; img-src 'self' data:; frame-src 'self'" +
    (process.env.CSP_FRAME_SRC_ALLOW ? " " + process.env.CSP_FRAME_SRC_ALLOW : "") +
    (process.env.CSP_FRAME_ANCESTORS ? "; frame-ancestors " + process.env.CSP_FRAME_ANCESTORS : "");

module.exports = {
    summary,
    summaryLine,
    contentSecurityPolicy
}
