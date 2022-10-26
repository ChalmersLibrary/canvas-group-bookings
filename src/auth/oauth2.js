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
            log.info('The resulting token: ', accessToken.token);

            // Persist the access token to db
            await persistAccessToken(accessToken.token).then(async (result) => {
                // Save the user object to session for faster access
                let userData = await user.createSessionUserdataFromToken(req, accessToken.token);
                log.info(userData);

                // If we set it before redirect we must persist it with session.save()
                await req.session.save(function(err) {
                    if (err) {
                        log.error(err);
                        return res.status(500).json(err);
                    }

                    console.log(req.session);
                    log.info("Session saved with user object from OAuth2 callback.");
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

        log.info("Callback finished, redirecting to root app.");

        return res.redirect("/");
    });
};

async function checkAccessToken(req) {
    let tokenResult = new TokenResult();

    // TODO: The problem here is that if the session cookie disappears, and we have Anonymous LTI access,
    //       we won't know the user id. The user id could still be in the db with an Access Token that has
    //       a valid Refresh Token, but we can't reach it. Then the user will have to approve the OAuth2
    //       access once more and gets another approved integration key in Canvas. Should we force Public LTI?

    if (!req.session.user) {
        log.error("No user object in session, redirecting to OAuth flow...");
        tokenResult.success = false;
        tokenResult.message = "No user object in session.";
    }
    else {
        await findAccessToken(req.session.user.id).then(async (token) => {
            if (token !== undefined) {
                let accessToken = await client.createToken(token);
                await log.info("Token from findAccessToken: ", token);
                await log.info("client.createToken: ", accessToken);
    
                if (accessToken.expired()) {
                    log.error("Access token has expired, refreshing.", { service: 'oauth2'});

                    try {
                        let newAccessToken = await accessToken.refresh();
                        await log.info("accessToken.refresh: ", newAccessToken);

                        const newAccessTokenWithRefreshToken = JSON.parse(JSON.stringify(newAccessToken));
                        newAccessTokenWithRefreshToken.refresh_token = accessToken.token.refresh_token; // https://canvas.instructure.com/doc/api/file.oauth.html#using-refresh-tokens

                        await persistAccessToken(newAccessTokenWithRefreshToken);
    
                        // Save the user object to session for faster access
                        let userData = await user.createSessionUserdataFromToken(req, newAccessTokenWithRefreshToken).then((result) => {
                            console.log(result);
                        });

                        req.session.save(function(err) {
                            if (err) {
                                log.error(err);
                                throw new Error("Saving session.", { cause: err });
                            }
        
                            log.info("Access token refreshed, session saved.");
                        });
    
                        tokenResult.success = true;
                        tokenResult.message = "Refreshed expired token.";
                    }
                    catch (error) {
                        if (error.data.payload) {
                            log.error(error.data.payload);

                            if (error.data.payload.error == 'invalid_grant') {
                                throw new Error("invalid_grant");
                            }
                        }
                        else {
                            log.error(error);
                            throw new Error(error);
                        }
                    }
                }
                else {
                    log.info("Access token is ok, not expired.");

                    // Save the user object to session for faster access
                    user.createSessionUserdataFromToken(req, token);

                    req.session.save(function(err) {
                        if (err) {
                            log.error(err);
                            throw new Error("Saving session after user object.", { cause: err });
                        }
                    });

                    tokenResult.success = true;
                    tokenResult.message = "Access token is ok, not expired.";
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
    log.info("Persisting access token for user " + token.user.id + ", domain " + domain);
    log.info(token);

    await db.query("INSERT INTO user_token (canvas_user_id, canvas_domain, data, updated_at) VALUES ($1, $2, $3, now()) ON CONFLICT (canvas_user_id, canvas_domain) DO UPDATE SET data = EXCLUDED.data, updated_at = now()", [
        token.user.id,
        domain,
        token
    ]).then((result) => {
        log.info("Access token persisted to db, bound to user id " + token.user.id + " for domain " + domain);
    }).catch((error) => {
        console.error(error); // throw new Error(error)???
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
