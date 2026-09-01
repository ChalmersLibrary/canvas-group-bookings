'use strict';

const log = require('../logging')
const lti = require('ims-lti');
const session = require('express-session');
const NodeCache = require('node-cache');
const nodeCacheNonceStore = require('../node-cache-nonce');
const myCache = new NodeCache();
const nonceStore = new nodeCacheNonceStore(myCache);

/* LTI Consumer Keys and Secrets with format "consumer:secret[,consumer2:secret2]". */
const consumerKeys = process.env.LTI_KEYS;
var secrets = [];

/* Default full locales, when Canvas only states language (two chars) (not complete) */
const locales = [
    { lang: 'sv', full: 'sv-SE' },
    { lang: 'en', full: 'en-US' },
    { lang: 'is', full: 'is-IS' },
    { lang: 'nb', full: 'nb-NO' },
    { lang: 'nn', full: 'nn-NO' },
    { lang: 'da', full: 'da-DK' },
    { lang: 'de', full: 'de-DE' },
    { lang: 'fi', full: 'fi-FI' },
    { lang: 'fr', full: 'fr-FR' },
    { lang: 'nl', full: 'nl-NL' },
    { lang: 'it', full: 'it-IT' },
];

const getSecret = (consumerKey, callback) => {
    if (consumerKeys && secrets.length == 0) {
        for (const key of consumerKeys.split(',')) {
            secrets.push({
                "consumerKey": key.split(':')[0],
                "secret": key.split(':')[1]
            });

            log.debug("Added consumer key for '" + key.split(':')[0] + "'.");
        }
    }

    for (const secret of secrets) {
        if (secret.consumerKey == consumerKey) {
            return callback(null, secret.secret);
        }
    }

    let err = new Error("Unknown consumer '" + consumerKey + "'.");
    err.status = 403;

    return callback(err);
};

/* The Canvas instances this deployment serves, from its own configuration. */
const servedApiDomains = () => {
    const hostOf = (value) => {
        try {
            return new URL(value).hostname;
        }
        catch {
            return value;
        }
    };

    const configured = [process.env.API_HOST, process.env.AUTH_HOST].filter((v) => v).map(hostOf);
    const alsoAllowed = (process.env.LTI_ALLOWED_API_DOMAINS || '').split(',')
        .map((v) => v.trim()).filter((v) => v.length);

    return [...new Set([...configured, ...alsoAllowed])];
};

exports.servedApiDomains = servedApiDomains;

/* Whether a launch from a Canvas this installation is not configured for is refused or merely
   reported. Reporting is the default: an installation whose configured host does not match the
   name Canvas reports for itself would refuse every launch, and there is no other way into the
   tool. Enable only after the log has shown the two agree. */
const enforceApiDomain = () => {
    const value = (process.env.LTI_ENFORCE_API_DOMAIN || '').trim().toLowerCase();

    return value === 'true' || value === '1' || value === 'yes';
};

exports.enforceApiDomain = enforceApiDomain;

/* Enough of a launch to diagnose one, and nothing personal. lis_person_sourcedid carries the
   personnummer; the name, the email and the login id are personal too, and ims-lti derives
   `username` from the given name. The opaque ids are what a launch is actually debugged with. */
const launchSummary = (body) => ({
    user_id: body.user_id,
    custom_canvas_user_id: body.custom_canvas_user_id,
    custom_canvas_course_id: body.custom_canvas_course_id,
    custom_canvas_api_domain: body.custom_canvas_api_domain,
    context_id: body.context_id,
    resource_link_id: body.resource_link_id,
    roles: body.roles,
    lti_message_type: body.lti_message_type,
    lti_version: body.lti_version,
    launch_presentation_locale: body.launch_presentation_locale
});

exports.handleLaunch = (page) => function(req, res) {
    log.debug("LTI Launch start.");

    if (!req.body) {
        log.error("No request body.");
        return res.status(400).json('No request body.')
    }

    log.debug("Launch received.", launchSummary(req.body));

    const consumerKey = req.body.oauth_consumer_key;

    if (!consumerKey) {
        return res.status(422).json('No consumer key.')
    }

    getSecret(consumerKey, (err, consumerSecret) => {
        if (err) {
            /* Returning here matters: without it the provider is built with an undefined secret
               and throws, so the launch is refused by an error handler rather than by this code,
               and the status set on the error is discarded. */
            log.error(err);

            return res.status(err.status ? err.status : 403).json('Unknown consumer.');
        }

        /* The store is passed rather than left to the provider, which would build a new one per
           launch. A store that has only ever seen this launch cannot refuse a replay of it, so
           without this a captured launch body can be posted repeatedly while its timestamp stays
           fresh, and each post yields a session as that user. */
        const provider = new lti.Provider(consumerKey, consumerSecret, nonceStore);

        provider.valid_request(req, (err, isValid) => {
            if (err) {
                log.error(err);
            }
            if (isValid) {
                log.debug("Request is valid.", launchSummary(req.body));

                /* A launch from a Canvas this deployment is not configured for would be answered
                   with this deployment's data, and its api calls would go to the configured
                   Canvas rather than the one launched from. Because non-production Canvas
                   environments are periodically reset from production, ids match across them, so
                   that mistake succeeds silently instead of failing. Refuse it.

                   Only checked when the launch says: a launch with a privacy level that omits the
                   api domain cannot be placed, and must not be rejected for that. */
                const launchDomain = req.body.custom_canvas_api_domain;
                const served = servedApiDomains();

                if (launchDomain && served.length && !served.includes(launchDomain)) {
                    /* Reported at info level, which survives NODE_ENV, because the two names an
                       instance answers to need not match what it reports here, and the only way to
                       learn what it reports is to see it in a log. */
                    log.info("Launch is from Canvas api domain '" + launchDomain +
                        "', and this installation is configured for '" + served.join("', '") +
                        "'. Enforcing: " + (enforceApiDomain() ? "yes, refusing it" : "no, serving it anyway") + ".");

                    /* Off by default, deliberately. A configured host that does not match what
                       Canvas reports would otherwise refuse every launch, and this tool has no
                       other way in: getting it wrong locks out everybody rather than degrading.
                       Turn it on once the log above has confirmed the two agree. */
                    if (enforceApiDomain()) {
                        return res.status(409).json('This installation does not serve the Canvas it was launched from.');
                    }
                }

                if (!launchDomain) {
                    log.debug("Launch carries no custom_canvas_api_domain, so which Canvas it came from cannot be checked.");
                }

                /* req.body, never provider.body: ims-lti defines `body` on the Provider
                   prototype rather than per instance, so every launch in the process merges into
                   one shared object and a field absent from this launch keeps the previous
                   launch's value. Reading it would mix one user's launch into another's. */
                // Only save relevant LTI information in session LTI object
                req.session.lti = {
                    context_id: req.body.context_id,
                    context_title: req.body.context_title,
                    custom_canvas_course_id: req.body.custom_canvas_course_id,
                    custom_canvas_enrollment_state: req.body.custom_canvas_enrollment_state,
                    custom_canvas_roles: req.body.custom_canvas_roles,
                    custom_canvas_groups_context: req.body.custom_canvas_groups_context,
                    custom_canvas_user_id: req.body.custom_canvas_user_id,
                    lti_message_type: req.body.lti_message_type,
                    lti_version: req.body.lti_version,
                    resource_link_id: req.body.resource_link_id,
                    resource_link_title: req.body.resource_link_title,
                    tool_consumer_info_product_family_code: req.body.tool_consumer_info_product_family_code,
                    tool_consumer_info_version: req.body.tool_consumer_info_version,
                    tool_consumer_instance_guid: req.body.tool_consumer_instance_guid,
                    tool_consumer_instance_name: req.body.tool_consumer_instance_name,
                    launch_presentation_locale: req.body.launch_presentation_locale
                };

                // Fix so we have a full locale, ie "en-GB" or "sv-SE", even if Canvas states "en" or "sv" as the locale
                /* A launch need not carry a locale at all, and reading the launch from req.body
                   means an absent one is now undefined rather than whatever the previous launch
                   had. Fall back to the default rather than throwing on toString(). */
                req.session.lti.locale_original = req.session.lti.launch_presentation_locale
                    ? req.session.lti.launch_presentation_locale
                    : 'en';

                if (req.session.lti.locale_original.toString().length < 3) {
                    if (locales.some(x => x.lang === req.session.lti.locale_original.toString())) {
                        req.session.lti.locale_full = locales.filter(x => x.lang === req.session.lti.locale_original.toString())[0].full;
                    }
                    else {
                        req.session.lti.locale_full = req.session.lti.locale_original + "-XX";
                    }
                }
                else {
                    req.session.lti.locale_full = req.session.lti.locale_original;
                }

                log.debug(req.session.lti);

                /* Answer from inside the save, not after it. The redirect used to sit at the end
                   of the outer function, so it was written whatever validation decided: a refused
                   launch was answered and then redirected, which threw ERR_HTTP_HEADERS_SENT on
                   every one, and a slower session store could redirect before the launch was
                   persisted. */
                return req.session.save(function(err) {
                    if (err) {
                        log.error("Saving session after LTI launch", err);

                        return res.status(500).json('Could not save the session after launch.');
                    }

                    log.debug("Session saved with LTI object, redirecting to " + page + ".");

                    return res.redirect(page);
                });
            }
            else {
                /* Not the request object: it carries the session cookie and the launch body, and
                   error level is not filtered by NODE_ENV. */
                log.error("The request is NOT valid.", launchSummary(req.body));

                return res.status(500).json('LTI request is not valid.');
            }
        });
    });
}
