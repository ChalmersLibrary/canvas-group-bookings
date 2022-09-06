'use strict';

require('dotenv').config();
const db = require('../db');

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

function createApplication(app, callbackUrl) {
    // Authorization uri definition
    const authorizationUri = client.authorizeURL({
        redirect_uri: callbackUrl,
        state: 'CatDogMouseKey'
    });
    
    // Initial page redirecting to Canvas
    app.get('/auth', (req, res) => {
        console.log(authorizationUri);
        res.redirect(authorizationUri);
    });
    
    // Callback service parsing the authorization token and asking for the access token
    app.get('/callback', async (req, res) => {
        const { code } = req.query;
        const options = {
          code,
          redirect_uri: callbackUrl,
        };
    
        try {
            const accessToken = await client.getToken(options);
            const accessTokenJSONString = JSON.stringify(accessToken);

            console.log(accessToken);

            console.log('The resulting token: ', accessToken.token);
            
            await db.query("select now()");

            // Add the access token to db
            await db.query("INSERT INTO user_token (canvas_user_id, canvas_domain, data) VALUES ($1, $2, $3)", [
                accessToken.token.user.id, 
                request.session.lti.custom_canvas_api_domain ? request.session.lti.custom_canvas_api_domain : new URL(process.env.AUTH_HOST).hostname,
                accessToken.token
            ]).then((result) => {
                console.log("Access token persisted to db, bound to user id " + accessToken.token.user.id);
                req.session.accessToken = accessToken.token;
                res.redirect("/");

            }).catch((error) => {
                console.log(error);
                return res.status(500).json(error);
            });
        } 
        catch (error) {
            console.error('Access Token Error', error.message);
            return res.status(500).json('Authentication failed');
        }
    });
};

async function checkToken(req, res) {
    if (!req.session.accessToken) {
        console.error("No access token, redirecting to OAuth flow...");
        return new TokenResult(false, "No access token, init OAuth2 flow");
    }
    else {
        let accessToken = client.createToken(req.session.accessToken);

        if (accessToken.expired()) {
            console.error("Access token has expired.");
    
            try {
                const refreshParams = {};
                let newAccessToken = await accessToken.refresh(refreshParams);
                req.session.accessToken = newAccessToken;
                console.log("Access token refreshed.");
                return new TokenResult(true);
            }
            catch (error) {
              console.error('Error refreshing access token: ', error.message);
              return new TokenResult(false, "Error refreshing access token");
            }
        }
        else {
            console.log("Access token is ok, not expired.");
            return new TokenResult(true);
        }
    }
}

async function providerRefreshToken(req) {
    let accessToken = client.createToken(req.session.accessToken);

    try {
        const refreshParams = {};
        newAccessToken = await accessToken.refresh(refreshParams);
        req.session.accessToken = newAccessToken;
        console.log("Access token refreshed.");
        return new TokenResult(true);
    }
    catch (error) {
      console.error('Error refreshing access token: ', error.message);
      return new TokenResult(false, "Error refreshing access token");
    }
}

module.exports = {
    createApplication,
    checkToken,
    providerRefreshToken
}
