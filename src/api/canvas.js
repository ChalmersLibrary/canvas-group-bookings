'use strict';

require('dotenv').config();

const crypto = require('crypto');
const LinkHeader = require('http-link-header');
const axios = require('axios');
const FormData = require('form-data');
const auth = require('../auth/oauth2');
const log = require('../logging');
const cache = require('../cache');

/* Canvas API */
const API_PER_PAGE = 25;
const API_PATH = "/api/v1";
const API_HOST = process.env.API_HOST ? process.env.API_HOST : process.env.AUTH_HOST;
const API_GROUPS_ONLY_OWN_GROUPS = true;
const API_MAX_ERROR_COUNT = 1;

/**
 * Get information about groups in a given course the user belongs to, using user's access token for API call.
 * This method uses GET /api/v1/users/self/groups and manually filters out group category and course id.
 * It seems to work better for all students.
 * 
 * @param {courseId} Numerical Course id in Canvas
 * @param {groupCategoryFilter} Array Group category ids to filter
 * @param {token} Object Token object
 * @returns JSON data from Canvas API
 */
async function getCourseGroupsSelfReference(courseId, groupCategoryFilter, token) {
    let md5key = crypto.createHash('md5').update(token.access_token).digest("hex");
    const cacheKey = `${courseId}:${md5key}`;

    try {
        const cachedData = await cache.getCache('courseGroupsCache', cacheKey);

        if (cachedData !== undefined) {
            log.debug("Using found NodeCache entry for key " + cacheKey);
            log.debug("Cache value: " + typeof(cachedData) === 'Object' ? JSON.stringify(cachedData) : cachedData);
            log.debug("Cache statistics: " + JSON.stringify(await cache.getCacheStats('courseGroupsCache')));
        
            await cache.addCacheRead('courseGroupsCache');
    
            return cachedData;
        }
        else {
            let thisApiPath = API_HOST + API_PATH + "/users/self/groups?context_type=Course&per_page=200";
            let apiData = new Array();
            let returnedApiData = new Array();
            let errorCount = 0;

            while (errorCount < API_MAX_ERROR_COUNT && thisApiPath && token) {
                log.debug("GET " + thisApiPath);
            
                try {
                    const response = await axios.get(thisApiPath, {
                        headers: {
                            "User-Agent": "Chalmers/Azure/Request",
                            "Authorization": token.token_type + " " + token.access_token
                        }
                    });
        
                    apiData.push(response.data);

                    if (response.headers["X-Request-Cost"]) {
                        log.debug("Request cost: " + response.headers["X-Request-Cost"]);
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
                        log.error("HTTP error 401, with www-authenticate header. Trying to refresh token.");

                        if (errorCount == API_MAX_ERROR_COUNT) {
                            log.error("HTTP error 401 from API: tried refreshing API token, max retries reached in getCourseGroupsSelfReference.");
                            throw error;
                        }
                        else {
                            await auth.refreshAccessToken(token.user_id).then((result) => {
                                log.debug(result);
                                if (result.success) {
                                    log.debug("Refreshed access token in 401, with www-authenticate header.");
                                }
                                else {
                                    log.error("Error refreshing access token in 401, with www-authenticate header.");
                                    log.debug(result);
                                }
                            })
                            .catch(error => {
                                log.error("Error: " + error.message);
                                log.debug(error);
                            });    
                        }
                    }
                    else if (error.response.status == 401 && !error.response.headers['www-authenticate']) { // no access, redirect to auth
                        log.error("HTTP error 401, not authorized in Canvas for use of this API endpoint.");
                        throw error;
                    }
                    else {
                        log.error("HTTP error: " + error.message);
                        log.debug(error);
                        throw error;
                    }
                }
            }

            // Compile new object from all pages.
            apiData.forEach((page) => {
                page.forEach((record) => {
                    if (groupCategoryFilter && groupCategoryFilter.length) {
                        if (groupCategoryFilter.includes(record.group_category_id)) {
                            returnedApiData.push(record);
                        }
                    }
                    else {
                        if (record.course_id == courseId) {
                            returnedApiData.push(record);
                        }
                    }
                });
            });

            /* Save to cache */
            await cache.setCache('courseGroupsCache', cacheKey, returnedApiData);
            await cache.addCacheWrite('courseGroupsCache');

            return returnedApiData;
        }
    }
    catch (error) {
        log.debug(error);
        log.error("Error in getCourseGroupsSelfReference: " + error.message);
        throw error;
    }
}

/**
 * Post a message in Conversations (Inbox) for specific group(s) or user.
 * The posting account is supposed to have an API token created manually by an administrator in Canvas,
 * we use "Canvas Conversation Robot": login and create an access token, then use this in CONVERSATION_ROBOT_API_TOKEN.
 * Note that the user account for this robot has to be added in the course as Administrator, or added as account level admins.
 * Also note, if added in course, the user account must accept the invitation in order to send messages to groups.
 *
 * @param {number} recipients List of recipients according to API
 * @param {string} subject Message subject
 * @param {string} body Message body
 * @param {object} token Valid API token with token_type and access_token properties
 */
async function createConversation(recipients, subject, body, token) {
    try {
        let thisApiPath = API_HOST + API_PATH + "/conversations";
        let apiData;
        let errorCount = 0;

        while (errorCount < API_MAX_ERROR_COUNT && thisApiPath && token) {
            log.debug("POST " + thisApiPath);
            log.debug("Subject: " + subject);
            
            try {
                let bodyFormData = new FormData();

                if (typeof(recipients) == "string" || typeof(recipients) == "number") {
                    bodyFormData.append('recipients[]', recipients);

                    if (typeof(recipients) == "string" && recipients.includes("group_")) {
                        bodyFormData.append('group_conversation', 'true');
                    }
                    else {
                        bodyFormData.append('group_conversation', 'false');
                        bodyFormData.append('force_new', 'true');
                    }
                }
                else {
                    for (const r of recipients) {
                        bodyFormData.append('recipients[]', r);
                        log.debug("Added recipients[]: " + r);
                    }

                    bodyFormData.append('group_conversation', 'true');
                }

                bodyFormData.append('subject', subject);
                bodyFormData.append('body', body);

                const response = await axios({
                    method: "post",
                    url: thisApiPath,
                    headers: {
                        "User-Agent": "Chalmers/CanvasConversationRobot",
                        "Authorization": token.token_type + " " + token.access_token,
                        ...bodyFormData.getHeaders()
                    },
                    data: bodyFormData
                });
    
                apiData = response.data;
    
                if (response.headers["X-Request-Cost"]) {
                    log.debug("Request cost: " + response.headers["X-Request-Cost"]);
                }
    
                thisApiPath = false;
            }
            catch (error) {
                errorCount++;

                // Refresh token, then try again
                if (error.response.status == 401 && error.response.headers['www-authenticate']) {
                    throw new Error("401, with www-authenticate header. Can't refresh this token, must be done manually for integration account.");
                }
                // No access, redirect to auth (www-authenticate)
                else if (error.response.status == 401 && !error.response.headers['www-authenticate']) {
                    throw new Error("401, without www-authenticate header. Integration account not authorized in Canvas for use of this API endpoint.");
                }
                // Bad Request, often this means attribute "recipients" is invalid because integration account is not added so it has access to the recipients.
                // It could also be that the group doing a DELETE /reservation is deleted in Canvas.
                else if (error.response.status == 400) {
                    log.error("Response data from Canvas Conversation API: " + JSON.stringify(error.response.data));
                    throw new Error("400, Bad Request. Integration account most likely not added to Canvas course or recipient group is missing.");
                }
                else {
                    log.error(error.code, error.message, error.response.data);
                }

                throw error;
            }
        }    

        return apiData;
    }
    catch (error) {
        throw error;
    }
}

/**
 * Get group categories in a given course, used for filtering in admin pages
 * @param {number} courseId Numerical Course id in Canvas
 * @param {object} token Valid API token with token_type and access_token properties
 * @returns JSON data from Canvas API
 */
async function getCourseGroupCategories(courseId, token) {
    try {
        const cachedData = await cache.getCache('courseGroupCategoriesCache', courseId);

        if (cachedData !== undefined) {
            log.debug("Using found NodeCache entry for key " + courseId);
            log.debug("Cache value: " + typeof(cachedData) === 'Object' ? JSON.stringify(cachedData) : cachedData);
            log.debug("Cache statistics: " + JSON.stringify(await cache.getCacheStats('courseGroupsCache')));
        
            await cache.addCacheRead('courseGroupCategoriesCache');
    
            return cachedData;
        }
        else {
            let thisApiPath = API_HOST + API_PATH + "/courses/" + courseId + "/group_categories?per_page=" + API_PER_PAGE;
            let apiData = new Array();
            let returnedApiData = new Array();
            let errorCount = 0;

            while (errorCount < API_MAX_ERROR_COUNT && thisApiPath && token) {
                log.debug("GET " + thisApiPath);
            
                try {
                    const response = await axios.get(thisApiPath, {
                        headers: {
                            "User-Agent": "Chalmers/Azure/Request",
                            "Authorization": token.token_type + " " + token.access_token
                        }
                    });
        
                    apiData.push(response.data);

                    if (response.headers["X-Request-Cost"]) {
                        log.debug("Request cost: " + response.headers["X-Request-Cost"]);
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
                        log.error("HTTP error 401, with www-authenticate header. Trying to refresh token.");

                        if (errorCount == API_MAX_ERROR_COUNT) {
                            log.error("HTTP error 401 from API: tried refreshing API token, max retries reached in getCourseGroupCategories.");
                            throw error;
                        }
                        else {
                            await auth.refreshAccessToken(token.user_id).then((result) => {
                                log.debug(result);
                                if (result.success) {
                                    log.debug("Refreshed access token in 401, with www-authenticate header.");
                                }
                                else {
                                    log.error("Error refreshing access token in 401, with www-authenticate header.");
                                    log.debug(result);
                                }
                            })
                            .catch(error => {
                                log.error("Error: " + error.message);
                                log.debug(error);
                            });    
                        }
                    }
                    else if (error.response.status == 401 && !error.response.headers['www-authenticate']) { // no access, redirect to auth
                        log.error("HTTP error 401, not authorized in Canvas for use of this API endpoint.");
                        throw error;
                    }
                    else {
                        log.error("HTTP error: " + error.message);
                        log.debug(error);
                        throw error;
                    }
                }
            }

            // Compile new object from all pages.
            apiData.forEach((page) => {
                page.forEach((record) => {
                    returnedApiData.push({
                        id: record.id, 
                        name: record.name
                    });
                });
            });

            /* Save to cache */
            await cache.setCache('courseGroupCategoriesCache', courseId, returnedApiData);
            await cache.addCacheWrite('courseGroupCategoriesCache');

            return returnedApiData;
        }
    }
    catch (error) {
        log.debug(error);
        log.error("Error in getCourseGroupCategories: " + error.message);
        throw error;
    }
}

/**
 * Returns all persons in a course that are enrolled as teachers.
 * @param {number} courseId Numerical Course id in Canvas
 * @param {object} token Valid API token with token_type and access_token properties
 * @returns JSON data from Canvas API
 */
async function getCourseTeacherEnrollments(courseId, token) {
    try {
        const cachedData = await cache.getCache('courseTeacherEnrollmentsCache', courseId);

        if (cachedData !== undefined) {
            log.debug("Using found NodeCache entry for key " + courseId);
            log.debug("Cache value: " + typeof(cachedData) === 'Object' ? JSON.stringify(cachedData) : cachedData);
            log.debug("Cache statistics: " + JSON.stringify(await cache.getCacheStats('courseTeacherEnrollmentsCache')));
        
            await cache.addCacheRead('courseTeacherEnrollmentsCache');

            return cachedData;
        }
        else {
            let thisApiPath = API_HOST + API_PATH + "/courses/" + courseId + "/search_users?enrollment_type[]=teacher&enrollment_state[]=active&include[]=avatar_url&per_page=" + API_PER_PAGE;
            let apiData = new Array();
            let returnedApiData = new Array();
            let errorCount = 0;

            while (errorCount < API_MAX_ERROR_COUNT && thisApiPath && token) {
                log.debug("GET " + thisApiPath);
            
                try {
                    const response = await axios.get(thisApiPath, {
                        headers: {
                            "User-Agent": "Chalmers/Azure/Request",
                            "Authorization": token.token_type + " " + token.access_token
                        }
                    });
        
                    apiData.push(response.data);

                    if (response.headers["X-Request-Cost"]) {
                        log.debug("Request cost: " + response.headers["X-Request-Cost"]);
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
                        log.error("HTTP error 401, with www-authenticate header. Trying to refresh token.");

                        if (errorCount == API_MAX_ERROR_COUNT) {
                            log.error("HTTP error 401 from API: tried refreshing API token, max retries reached in getCourseTeacherEnrollments.");
                            throw error;
                        }
                        else {
                            await auth.refreshAccessToken(token.user_id).then((result) => {
                                log.debug(result);
                                if (result.success) {
                                    log.debug("Refreshed access token in 401, with www-authenticate header.");
                                }
                                else {
                                    log.error("Error refreshing access token in 401, with www-authenticate header.");
                                    log.debug(result);
                                }
                            })
                            .catch(error => {
                                log.error("Error: " + error.message);
                                log.debug(error);
                            });    
                        }
                    }
                    else if (error.response.status == 401 && !error.response.headers['www-authenticate']) { // no access, redirect to auth
                        log.error("HTTP error 401, not authorized in Canvas for use of this API endpoint.");
                        throw error;
                    }
                    else {
                        log.error("HTTP error: " + error.message);
                        log.debug(error);
                        throw error;
                    }
                }
            }

            // Compile new object from all pages.
            apiData.forEach((page) => {
                page.forEach((record) => {
                    returnedApiData.push({
                        id: record.id, 
                        name: record.name,
                        email: record.email,
                        avatar_url: record.avatar_url
                    });
                });
            });

            /* Save to cache */
            await cache.setCache('courseTeacherEnrollmentsCache', courseId, returnedApiData);
            await cache.addCacheWrite('courseTeacherEnrollmentsCache');

            return returnedApiData;
        }
    }
    catch (error) {
        log.debug(error);
        log.error("Error in getCourseTeacherEnrollments: " + error.message);
        throw error;
    }
}

module.exports = {
    createConversation,
    getCourseGroupsSelfReference,
    getCourseGroupCategories,
    getCourseTeacherEnrollments
}
