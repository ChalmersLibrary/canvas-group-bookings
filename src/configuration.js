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

module.exports = {
    summary,
    summaryLine
}
