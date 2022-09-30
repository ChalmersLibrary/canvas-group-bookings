'use strict';

require('dotenv').config();

const LinkHeader = require('http-link-header');
const NodeCache = require('node-cache');
const axios = require('axios');
const auth = require('../auth/oauth2');
const log = require('../logging')

const API_PER_PAGE = 25;
const API_PATH = "/api/v1";
const API_HOST = process.env.API_HOST ? process.env.API_HOST : process.env.AUTH_HOST;
const API_GROUPS_ONLY_OWN_GROUPS = true;

async function getCourseGroups(courseId, userId) {
    let thisApiPath = API_HOST + API_PATH + "/courses/" + courseId + "/groups?per_page=" + API_PER_PAGE;
    let apiData = new Array();
    let returnedApiData = new Array();
    let errorCount = 0;

    if (API_GROUPS_ONLY_OWN_GROUPS) {
        thisApiPath = thisApiPath + "&only_own_groups=true";
    }

    await auth.findAccessToken(userId).then(async (token) => {
        while (errorCount < 2 && thisApiPath && token) {
            log.info("GET " + thisApiPath);
        
            try {
                const response = await axios.get(thisApiPath, {
                    headers: {
                        "User-Agent": "Chalmers/Azure/Request",
                        "Authorization": token.token_type + " " + token.access_token
                    }
                });
    
                apiData.push(response.data);
    
                if (response.headers["X-Request-Cost"]) {
                    log.info("Request cost: " + response.headers["X-Request-Cost"]);
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
                // log.error(error);
            
                if (error.response.status == 401 && error.response.headers['www-authenticate']) { // refresh token, then try again
                    log.info("401, with www-authenticate header.");

                    await auth.refreshAccessToken(userId).then((result) => {
                        if (result.success) {
                            log.info("Refreshed access token.");
                        }
                        else {
                            log.info(result);
                        }
                    });
                }
                else if (error.response.status == 401 && !error.response.headers['www-authenticate']) { // no access, redirect to auth
                    log.error("Not authorized in Canvas for use of this API endpoint.");
                    return(error);
                }
                else {
                    log.error(error);
                    return(error);
                }
            }
        }    
    }).catch((error) => {
        log.error(error);
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