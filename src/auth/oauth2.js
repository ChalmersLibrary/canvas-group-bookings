'use strict';

require('dotenv').config();
const db = require('../db');
const log = require('../logging')
const user = require('../user');
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

function TokenResult(success, message, access_token, token_type, user_id) {
    this.success = success;
    this.message = message;
    this.access_token = access_token;
    this.token_type = token_type;
    this.user_id = user_id;
};

function setupAuthEndpoints(app, callbackUrl) {
    // Authorization uri definition
    const authorizationUri = client.authorizeURL({
        redirect_uri: callbackUrl,
        state: 'CatDogMouseKey'
    });
    
    // Initial page redirecting to Canvas
    app.get('/auth', (req, res) => {
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
            log.debug("The resulting token from client.getToken(): " + JSON.stringify(accessToken.token));

            // Persist the access token to db
            await persistAccessToken(accessToken.token).then(async (result) => {
                // Save the user object to session for faster access
                let userData = await user.createSessionUserdataFromToken(req, accessToken.token);
                log.debug(userData);

                // If we set it before redirect we must persist it with session.save()
                await req.session.save(function(err) {
                    if (err) {
                        log.error(err);
                        return res.status(500).json(err);
                    }

                    log.debug("Session saved with user object from OAuth2 callback.", req.session);
                });
            }).catch((error) => {
                log.error(error);
                return res.status(500).json(error);
            });
        }
        catch (error) {
            log.error('Access Token Error: ', error.message);
            return res.status(500).json(error);
        }

        log.debug("OAuth callback finished, redirecting to root app.");

        res.location("/?from=callback");
        return res.redirect("/?from=callback");
    });
};

/**
 * Check if there is an access token for the user id in the request.
 * First checks LTI for canvas user id, then checks user object.
 * 
 * If we have "Anonymous" LTI access, this may force another approval for this app.
 * The recommended setting is running "Public" LTI access so we get "custom_canvas_user_id",
 * or run "Anonymous" but provide this id in custom fields when adding the LTI integration.
 * 
 * Uses 'simple-oauth2' to check if token has expired, and refreshes it. Note the refresh
 * token notes in the code below.
 * 
 * If there is no token at all, the calling code should redirect into the OAuth2 flow.
 */
async function checkAccessToken(req) {
    let tokenResult = new TokenResult();
    let userId;

    if (req.session.lti && req.session.lti.custom_canvas_user_id) {
        userId = req.session.lti.custom_canvas_user_id;
        log.debug("UserId found in LTI session object: " + req.session.lti.custom_canvas_user_id);
    }
    else if (req.session.user && req.session.user.id) {
        userId = req.session.user.id;
        log.debug("UserId found in user session object: " + req.session.user.id);
    }
    else {
        log.debug("No user object in session or in LTI, seems like we have no session!");
        tokenResult.success = false;
        tokenResult.message = "Can't find any user id in session.";
    }

    if (userId !== undefined) {
        await findAccessToken(userId).then(async (token) => {
            if (token !== undefined) {
                let accessToken = await client.createToken(token);
    
                if (accessToken.expired()) {
                    log.debug("Access token has expired, refreshing.", { service: 'oauth2'});

                    try {
                        let newAccessToken = await accessToken.refresh();
                        await log.debug("accessToken.refresh: ", newAccessToken);

                        const newAccessTokenWithRefreshToken = JSON.parse(JSON.stringify(newAccessToken));
                        newAccessTokenWithRefreshToken.refresh_token = accessToken.token.refresh_token; // https://canvas.instructure.com/doc/api/file.oauth.html#using-refresh-tokens

                        await persistAccessToken(newAccessTokenWithRefreshToken);
    
                        // Save the user object to session for faster access
                        let userData = await user.createSessionUserdataFromToken(req, newAccessTokenWithRefreshToken).then((result) => {
                            log.debug(result);
                        });

                        req.session.save(function(err) {
                            if (err) {
                                log.error(err);
                                throw new Error("Saving session.", { cause: err });
                            }
        
                            log.debug("Access token refreshed, session saved.");
                        });
    
                        tokenResult.success = true;
                        tokenResult.message = "Refreshed expired token.";
                        tokenResult.access_token = newAccessTokenWithRefreshToken.access_token;
                        tokenResult.token_type = newAccessTokenWithRefreshToken.token_type;
                        tokenResult.user_id = userId;
                    }
                    catch (error) {
                        if (error.data && error.data.payload) {
                            log.error("Refreshing access token", error.data.payload);

                            if (error.data.payload.error == 'invalid_grant') {
                                throw new Error("invalid_grant");
                            }
                        }
                        else {
                            log.error("Refreshing access token", error);
                            throw new Error(error);
                        }
                    }
                }
                else {
                    log.debug("Access token is ok, not expired.");

                    // Save the user object to session for faster access
                    await user.createSessionUserdataFromToken(req, token);

                    req.session.save(function(err) {
                        if (err) {
                            log.error(err);
                            throw new Error("Saving session after user object.", { cause: err });
                        }
                    });

                    tokenResult.success = true;
                    tokenResult.message = "Access token is ok, not expired.";
                    tokenResult.access_token = token.access_token;
                    tokenResult.token_type = token.token_type;
                    tokenResult.user_id = userId;

                }
            }
            else {
                tokenResult.success = false;
                tokenResult.message = "No token found for user in db.";
            }
        }).catch((err) => {
            log.error(err);
            throw new Error(err);
        })
    }

    return tokenResult;
}

// TODO: This is a copy of refresh in checkAccessToken, should be generalized!
async function refreshAccessToken(canvas_user_id) {
    let thisResult = new TokenResult(true, "Token is refreshed.");

    await findAccessToken(canvas_user_id).then(async (result) => {
        let accessToken = client.createToken(result);

        try {
            const refreshParams = {};
            const newAccessToken = await accessToken.refresh(refreshParams);

            const newAccessTokenWithRefreshToken = JSON.parse(JSON.stringify(newAccessToken));
            newAccessTokenWithRefreshToken.refresh_token = accessToken.token.refresh_token; // https://canvas.instructure.com/doc/api/file.oauth.html#using-refresh-tokens

            await persistAccessToken(newAccessTokenWithRefreshToken);
        }
        catch (error) {
            log.error(error);

            let message = "Error refreshing access token in refreshAccessToken()";

            if (error.data && error.data.payload && error.data.payload.error) {
                message = message + ": " + error.data.payload.error + ", " + error.data.payload.error_description;
            }

            thisResult.success = false;
            thisResult.message = message;
        }
    }).catch((error) => {
        thisResult.success = false;
        thisResult.message = error;
    });

    if (thisResult.success) {
        return new Promise(resolve => {
            resolve(thisResult);
        });
    }
    else {
        return new Promise(reject => {
            reject(thisResult);
        });
    }    
}

async function persistAccessToken(token) {
    let domain = new URL(process.env.AUTH_HOST).hostname;
    let client = process.env.AUTH_CLIENT_ID;
    let userId = token.user.global_id && process.env.USERID_PREFIX_FORCE_GLOBAL_ID && token.user.global_id.startsWith(process.env.USERID_PREFIX_FORCE_GLOBAL_ID) ? token.user.global_id : token.user.id;

    log.debug("Persisting access token for user " + userId + ", domain " + domain + ", client " + client + ": " + JSON.stringify(token));

    if (token.user.global_id.startsWith(process.env.USERID_PREFIX_FORCE_GLOBAL_ID)) {
        token.user.id = token.user.global_id;
        log.debug("Fixed user.id in token, copied from user.global_id: " + JSON.stringify(token));
    }

    await db.query("INSERT INTO user_token (canvas_user_id, canvas_domain, canvas_client_id, data, updated_at) VALUES ($1, $2, $3, $4, now()) ON CONFLICT (canvas_user_id, canvas_domain, canvas_client_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()", [
        userId,
        domain,
        client,
        token
    ]).then((result) => {
        log.debug("Access token persisted to db, bound to user id " + userId + " for domain " + domain);
    }).catch((error) => {
        log.error("Persisting access token", token, error);
    });
}

async function findAccessToken(canvas_user_id) {
    let foundToken;
    let domain = new URL(process.env.AUTH_HOST).hostname;
    let client = process.env.AUTH_CLIENT_ID;

    log.debug("Locating access token for user " + canvas_user_id + ", domain " + domain + ", client " + client);

    try {
        await db.query("SELECT data FROM user_token WHERE canvas_user_id=$1 AND canvas_domain=$2 AND canvas_client_id=$3", [
            canvas_user_id,
            domain,
            client
        ]).then((res) => {
            if (res.rows.length) {
                foundToken = res.rows[0].data;
            }
            else {
                log.debug(`No access token found for Canvas user id [${canvas_user_id}]`);
            }
        });
    }
    catch (error) {
        log.error("Finding access token", canvas_user_id, error);
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
