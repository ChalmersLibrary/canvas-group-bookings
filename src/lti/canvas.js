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

const getSecret = (consumerKey, callback) => {
    if (consumerKeys && secrets.length == 0) {
        for (const key of consumerKeys.split(',')) {
            secrets.push({
                "consumerKey": key.split(':')[0],
                "secret": key.split(':')[1]
            });

            log.info("Added consumer key for '" + key.split(':')[0] + "'.");
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
    log.info("LTI Launch start.");

    if (!req.body) {
        log.error("No request body.");
        return res.status(400).json('No request body.')
    }

    log.info("Request body: " + JSON.stringify(req.body));

    const consumerKey = req.body.oauth_consumer_key;

    if (!consumerKey) {
        return res.status(422).json('No consumer key.')
    }

    getSecret(consumerKey, (err, consumerSecret) => {
        if (err) {
            log.error(err);
        }

        const provider = new lti.Provider(consumerKey, consumerSecret); // Include nonceStore for custom store, default memory store

        log.info(provider);

        provider.valid_request(req, (err, isValid) => {
            if (err) {
                log.error(err);
            }
            if (isValid) {
                log.info("Request is valid, LTI Data:" + JSON.stringify(provider.body));

                req.session.lti = provider.body;

                req.session.save(function(err) {
                    if (err) {
                        log.error(err);
                    }

                    log.info(req.session);
                    log.info("Session saved with LTI object.");
                });
            }
            else {
                log.error("The request is NOT valid.");
                return res.status(500).json('LTI request is not valid.')
            }
        });
    });

    log.info("LTI Launch done.");

    return res.redirect("/");
}

