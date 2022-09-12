'use strict';

require('dotenv').config();

const LinkHeader = require('http-link-header');
const NodeCache = require('node-cache');
const axios = require('axios');
const oauth = require('../auth/oauth2');

const API_PER_PAGE = 25;
const API_PATH = "/api/v1";
const API_HOST = process.env.API_HOST ? process.env.API_HOST : process.env.AUTH_HOST;
const API_GROUPS_ONLY_OWN_GROUPS = true;

async function getCourseGroups(courseId, req) {
    let thisApiPath = API_HOST + API_PATH + "/courses/" + courseId + "/groups?per_page=" + API_PER_PAGE;
    let apiData = new Array();
    let returnedApiData = new Array();
    let errorCount = 0;

    if (API_GROUPS_ONLY_OWN_GROUPS) {
        thisApiPath = thisApiPath + "&only_own_groups=true";
    }

    await oauth.findAccessToken(req.session.user.id).then(async (token) => {
        while (errorCount < 4 && thisApiPath && token) {
            console.log("GET " + thisApiPath);
        
            try {
                const response = await axios.get(thisApiPath, {
                    headers: {
                        "User-Agent": "Chalmers/Azure/Request",
                        "Authorization": token.token_type + " " + token.access_token
                    }
                });
    
                apiData.push(response.data);
    
                if (response.headers["X-Request-Cost"]) {
                    console.log("Request cost: " + response.headers["X-Request-Cost"]);
                }
    
                if (response.headers["link"]) {
                    let link = LinkHeader.parse(response.headers["link"]);
            
                    if (link.has("rel", "next")) {
                        thisApiPath = link.get("rel", "next")[0].uri;
                    }
                    else {
                        thisApiPath = false;
                    }
                }
                else {
                    thisApiPath = false;
                }
            }
            catch (error) {
                errorCount++;
                console.error(error);
            
                if (error.response.status == 401 && error.response.headers['www-authenticate']) { // refresh token, then try again
                    await oauth.refreshAccessToken(req.session.user.id).then((result) => {
                        if (result.success) {
                            console.log("Refreshed access token.");
                        }
                    });
                }
                else if (error.response.status == 401 && !error.response.headers['www-authenticate']) { // no access, redirect to auth
                    console.error("Not authorized in Canvas for use of this API endpoint.");
                    console.error(JSON.stringify(error));
                    return(error);
                }
                else {
                    console.error(error);
                    return(error);
                }
            }
        }    
    }).catch((error) => {
        console.error(error);
        return (error);
    });


    // Compile new object from all pages.
    apiData.forEach((page) => {
        page.forEach((record) => {
            if (API_GROUPS_ONLY_OWN_GROUPS) {
                returnedApiData.push(record);
            }
            else {
                returnedApiData.push({
                    id: record.id, 
                    name: record.name, 
                    group_category_id: record.group_category_id, 
                    created_at: record.created_at, 
                    members_count: record.members_count
                });
            }
        });
    });

    return new Promise((resolve) => {
        resolve(returnedApiData);
    })
};

module.exports = {
    getCourseGroups
}