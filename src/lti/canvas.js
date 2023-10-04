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

exports.handleLaunch = (page) => function(req, res) {
    log.debug("LTI Launch start.");

    if (!req.body) {
        log.error("No request body.");
        return res.status(400).json('No request body.')
    }

    log.debug("Request body: " + JSON.stringify(req.body));

    const consumerKey = req.body.oauth_consumer_key;

    if (!consumerKey) {
        return res.status(422).json('No consumer key.')
    }

    getSecret(consumerKey, (err, consumerSecret) => {
        if (err) {
            log.error(err);
        }

        const provider = new lti.Provider(consumerKey, consumerSecret); // Include nonceStore for custom store, default memory store

        provider.valid_request(req, (err, isValid) => {
            if (err) {
                log.error(err);
            }
            if (isValid) {
                log.debug("Request is valid, LTI Data:" + JSON.stringify(provider.body));

                // Fix so we have a full locale, ie "en-GB" or "sv-SE", even if Canvas states "en" or "sv" as the locale
                if (req.session.launch_presentation_locale && req.session.lti.launch_presentation_locale.toString().length < 3 && locales.any(x => x.lang == req.session.lti.launch_presentation_locale)) {
                    req.session.lti.locale_full = locales.filter(x => x.lang == req.session.lti.launch_presentation_locale)[0].full;
                }
                else {
                    req.session.lti.locale_full = req.session.lti.launch_presentation_locale + "-XX";
                }
                req.session.lti.locale_original = req.session.lti.launch_presentation_locale;

                // Only save relevant LTI information in session LTI object
                req.session.lti = {
                    context_id: provider.body.context_id,
                    context_title: provider.body.context_title,
                    custom_canvas_course_id: provider.body.custom_canvas_course_id,
                    custom_canvas_enrollment_state: provider.body.custom_canvas_enrollment_state,
                    custom_canvas_roles: provider.body.custom_canvas_roles,
                    custom_canvas_groups_context: provider.body.custom_canvas_groups_context,
                    custom_canvas_user_id: provider.body.custom_canvas_user_id,
                    lti_message_type: provider.body.lti_message_type,
                    lti_version: provider.body.lti_version,
                    resource_link_id: provider.body.resource_link_id,
                    resource_link_title: provider.body.resource_link_title,
                    tool_consumer_info_product_family_code: provider.body.tool_consumer_info_product_family_code,
                    tool_consumer_info_version: provider.body.tool_consumer_info_version,
                    tool_consumer_instance_guid: provider.body.tool_consumer_instance_guid,
                    tool_consumer_instance_name: provider.body.tool_consumer_instance_name,
                    launch_presentation_locale: provider.body.launch_presentation_locale
                };

                // TODO: remove this, only to force Azure log
                log.info(req.session.lti);

                req.session.save(function(err) {
                    if (err) {
                        log.error("Saving session after LTI launch", err);
                    }

                    log.debug("Session saved with LTI object.", req.session);
                });
            }
            else {
                log.error("The request is NOT valid.", req);
                return res.status(500).json('LTI request is not valid.');
            }
        });
    });

    log.debug("LTI Launch done.");

    return res.redirect("/");
}
