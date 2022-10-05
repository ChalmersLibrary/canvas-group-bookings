'use strict';

require('dotenv').config();

const LinkHeader = require('http-link-header');
const NodeCache = require('node-cache');
const axios = require('axios');
const auth = require('../auth/oauth2');
const log = require('../logging')

/* Canvas API */
const API_PER_PAGE = 25;
const API_PATH = "/api/v1";
const API_HOST = process.env.API_HOST ? process.env.API_HOST : process.env.AUTH_HOST;
const API_GROUPS_ONLY_OWN_GROUPS = true;

/* Cache API calls that don't change often to speed up requests */
const CACHE_TTL = (parseInt(process.env.canvasApiCacheSecondsTTL) > 0 ? parseInt(process.env.canvasApiCacheSecondsTTL) : 180);
const CACHE_CHECK_EXPIRE = 200;
const userDetailsCache = new NodeCache({ errorOnMissing:true, stdTTL: CACHE_TTL, checkperiod: CACHE_CHECK_EXPIRE });
const groupDetailsCache = new NodeCache({ errorOnMissing:true, stdTTL: CACHE_TTL, checkperiod: CACHE_CHECK_EXPIRE });

/* Setup caches with read/write stats */
const caches = [
    {
        name: "groupDetailsCache",
        writes: 0,
        reads: 0,
        bucket: groupDetailsCache
    },
    {
        name: "userDetailsCache",
        writes: 0,
        reads: 0,
        bucket: userDetailsCache
    }
];

/* Log when caches expire */
groupDetailsCache.on('expired', function(key) {
    log.info("[Cache] Expired NodeCache entry for groupDetailsCache key '" + key + "'.");
});
userDetailsCache.on('expired', function(key) {
    log.info("[Cache] Expired NodeCache entry for userDetailsCachekey '" + key + "'.");
});

/* Cache statistics */
async function addCacheRead(cacheName) {
    caches.filter(cache => {
        if (cache.name == cacheName) {
            cache.reads++;
        }
    })
}
async function addCacheWrite(cacheName) {
    caches.filter(cache => {
        if (cache.name == cacheName) {
            cache.writes++;
        }
    })
}

/* Get details for a specified user in course */
async function getUserDetails(courseId, userId, user_id) {
    try {
        const cachedData = userDetailsCache.get(user_id);

        if (cachedData !== undefined) {
            log.info("[Cache] Using found NodeCache entry for userId " + user_id);
            log.info("[Cache] Statistics: " + JSON.stringify(userDetailsCache.getStats()));
        
            await addCacheRead('userDetailsCache');
    
            return new Promise((resolve) => {
                resolve(cachedData);
            });    
        }
        else {
            let thisApiPath = API_HOST + API_PATH + "/courses/" + courseId + "/users/" + user_id;
            let apiData;
            let errorCount = 0;

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
            
                        apiData = response.data;
            
                        if (response.headers["X-Request-Cost"]) {
                            log.info("Request cost: " + response.headers["X-Request-Cost"]);
                        }
            
                        thisApiPath = false;
                    }
                    catch (error) {
                        errorCount++;
                    
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

            /* Save to cache */
            userDetailsCache.set(user_id, apiData);
            await addCacheWrite('userDetailsCache');

            return new Promise((resolve) => {
                resolve(apiData);
            });
        }
    }
    catch (error) {
        return new Promise((reject) => {
            reject(error);
        }); 
    }
}

/* Details (with members) for a given group (global id, not bound to course) */
async function getGroupDetails(courseId, userId, group_id) {
    try {
        const cachedData = groupDetailsCache.get(group_id);

        if (cachedData !== undefined) {
            log.info("[Cache] Using found NodeCache entry for group_id " + group_id);
            log.info("[Cache] Statistics: " + JSON.stringify(groupDetailsCache.getStats()));
        
            await addCacheRead('groupDetailsCache');
    
            return new Promise((resolve) => {
                resolve(cachedData);
            });    
        }
        else {
            let thisApiPath = API_HOST + API_PATH + "/groups/" + group_id;
            let apiData;
            let errorCount = 0;
        
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
            
                        apiData = response.data;
            
                        if (response.headers["X-Request-Cost"]) {
                            log.info("Request cost: " + response.headers["X-Request-Cost"]);
                        }
            
                        thisApiPath = false;
                    }
                    catch (error) {
                        errorCount++;
                    
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
        
                // Add the members
                apiData.members = await getGroupMembers(userId, group_id);
            }).catch((error) => {
                log.error(error);
                return (error);
            });
    
            /* Save to cache */
            groupDetailsCache.set(group_id, apiData);
            await addCacheWrite('groupDetailsCache');
    
            return new Promise((resolve) => {
                resolve(apiData);
            });
        }
    }
    catch (error) {
        return new Promise((reject) => {
            reject(error);
        });
    }
}

/* Members of a given group */
async function getGroupMembers(userId, group_id) {
    let thisApiPath = API_HOST + API_PATH + "/groups/" + group_id + "/users?per_page=" + API_PER_PAGE;
    let apiData = new Array();
    let returnedApiData = new Array();
    let errorCount = 0;

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
            returnedApiData.push(record);
        });
    });

    return new Promise((resolve) => {
        resolve(returnedApiData);
    });
}

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
    getUserDetails,
    getGroupDetails,
    getCourseGroups
}