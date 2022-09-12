'use strict';

require('dotenv').config();
const db = require('../db');
const log = require('../logging')
const { AuthorizationCode } = require('simple-oauth2');

const clientConfig = {
    client: {
        id: process.env.AUTH_CLIENT_ID,
        secret: process.env.AUTH_CLIENT_SECRET
    },
    auth: {
        tokenHost: process.env.AUTH_HOST,
        tokenPath: '/login/oauth2/token',
        authorizePath: '/login/oauth2/auth'
    }
};

const client = new AuthorizationCode(clientConfig);

function TokenResult(success, message) {
    this.success = success;
    this.message = message;
};

function setupAuthEndpoints(app, callbackUrl) {
    // Authorization uri definition
    const authorizationUri = client.authorizeURL({
        redirect_uri: callbackUrl,
        state: 'CatDogMouseKey'
    });
    
    // Initial page redirecting to Canvas
    app.get('/auth', (req, res) => {
        log.info(authorizationUri);
        return res.redirect(authorizationUri);
    });
    
    // Callback service parsing the authorization token and asking for the access token
    // If denied, we get parameter "error" with "access_denied" and should present some useful information.
    app.get('/callback', async (req, res) => {
        const { code } = req.query;
        const options = {
          code,
          redirect_uri: callbackUrl,
        };
    
        try {
            const accessToken = await client.getToken(options);
            log.info('The resulting token: ' + accessToken.token);

            // Persist the access token to db
            await persistAccessToken(accessToken.token).then((result) => {
                // Save the user object to session for faster access
                req.session.user = accessToken.token.user;
                
                // If we set it before redirect we must persist it with session.save()
                req.session.save(function(err) {
                    if (err) {
                        log.error(err);
                        return res.status(500).json(err);
                    }

                    log.info("Session saved from OAuth2 callback, redirecting.");
                    
                    return res.redirect("/");
                });
            }).catch((error) => {
                console.error(error);
                return res.status(500).json(error);
            });
        }
        catch (error) {
            log.error('Access Token Error: ', error.message);
            return res.status(500).json(error);
        }
    });
};

async function checkAccessToken(req) {
    if (!req.session.user) {
        log.error("No user object in session, redirecting to OAuth flow...");
        return new TokenResult(false, "No user object in session, init OAuth2 flow to get one");
    }
    else {
        await findAccessToken(req.session.user.id).then(async (token) => {
            log.info("Got access token: " + token);

            if (token !== undefined) {
                let accessToken = await client.createToken(token);
                console.log(accessToken);
    
                if (accessToken.expired()) {
                    log.error("Access token has expired, refreshing.");

                    try {
                        const refreshParams = {};
                        let newAccessToken = await accessToken.refresh(refreshParams);
                        console.log(newAccessToken);
                        persistAccessToken(newAccessToken.token);
    
                        req.session.user = newAccessToken.token.user;

                        req.session.save(function(err) {
                            if (err) {
                                log.error(err);
                                return new TokenResult(false, err);
                            }
        
                            log.info("Access token refreshed, session saved.");
                        });
    
                        return new TokenResult(true);
                    }
                    catch (error) {
                      log.error('Error refreshing access token: ', error.message);
                      log.error(error);
                      return new TokenResult(false, "Error refreshing access token");
                    }
                }
                else {
                    log.info("Access token is ok, not expired.");
                }
            }
            else {
                return new TokenResult(false, "No token in db for user, init OAuth2 flow.");
            }
        }).catch((err) => {
            log.error(err);
            return new TokenResult(false, err);
        })
    }

    return new TokenResult(true);
}

// TODO: This is a copy of refresh in checkAccessToken, should be generalized!
async function refreshAccessToken(canvas_user_id) {
    await findAccessToken(canvas_user_id).then(async (result) => {
        let accessToken = client.createToken(result);

        try {
            const refreshParams = {};
            newAccessToken = await accessToken.refresh(refreshParams);
            await persistAccessToken(newAccessToken.token);

            req.session.user = newAccessToken.token.user;

            await req.session.save(function(err) {
                if (err) {
                    log.error(err);
                    return new TokenResult(false, err);
                }

                log.info("Access token refreshed, session saved.");
            });

            return new TokenResult(true);
        }
        catch (error) {
          log.error('Error refreshing access token: ', error.message);
          return new TokenResult(false, "Error refreshing access token");
        }
    }).catch((error) => {
        log.error(error);
        return (error);
    });
}

async function persistAccessToken(token) {
    let domain = new URL(process.env.AUTH_HOST).hostname;
    log.info("Persisting access token for user " + token.user.id + ", domain " + domain);

    await db.query("INSERT INTO user_token (canvas_user_id, canvas_domain, data) VALUES ($1, $2, $3) ON CONFLICT (canvas_user_id, canvas_domain) DO UPDATE SET data = EXCLUDED.data", [
        token.user.id,
        domain,
        token
    ]).then((result) => {
        log.info("Access token persisted to db, bound to user id " + token.token.user.id + " for domain " + domain);
    }).catch((error) => {
        console.error(error);
    });
}

async function findAccessToken(canvas_user_id) {
    let foundToken;
    let domain = new URL(process.env.AUTH_HOST).hostname;
    log.info("Locating access token for user " + canvas_user_id + ", domain " + domain);

    try {
        await db.query("SELECT data FROM user_token WHERE canvas_user_id=$1 AND canvas_domain=$2", [
            canvas_user_id,
            domain
        ]).then((res) => {
            if (res.rows.length) {
                log.info(JSON.stringify(res.rows));
                foundToken = res.rows[0].data;
            }
        });
    }
    catch (error) {
        console.error(error);
    }

    return foundToken;
}

module.exports = {
    setupAuthEndpoints,
    checkAccessToken,
    refreshAccessToken,
    persistAccessToken,
    findAccessToken
}
