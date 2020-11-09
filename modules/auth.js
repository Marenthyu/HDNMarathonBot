'use strict';
const got = require('got');

let database = require('./database');
let config = require('./config');
let logger = require('./logger');

module.exports.refreshChatToken = async function () {
    logger.info("Refreshing chat token...");
    let response = await got({
        method: 'POST', url: `https://id.twitch.tv/oauth2/token?client_id=${
            encodeURIComponent(config.config['clientID'])}&client_secret=${
            encodeURIComponent(config.config['clientSecret'])}&refresh_token=${
            encodeURIComponent(config.config['chatRefreshToken'])}&grant_type=refresh_token`,
        responseType: "json"
    }).catch((e) => {
        logger.error("Error refreshing token:");
        logger.error(e.response.body);
        throw e;
    });
    let token = response.body.access_token;
    let refresh_token = response.body.refresh_token;
    await database.setChatToken(token, refresh_token);
    return config.refreshConfigFromDB()
}

module.exports.refreshBroadcasterToken = async function () {
    logger.info("Refreshing broadcaster token...");
    let response = await got({
        method: 'POST', url: `https://id.twitch.tv/oauth2/token?client_id=${
            encodeURIComponent(config.config['clientID'])}&client_secret=${
            encodeURIComponent(config.config['clientSecret'])}&refresh_token=${
            encodeURIComponent(config.config['chatRefreshToken'])}&grant_type=refresh_token`,
        responseType: "json"
    }).catch((e) => {
        logger.error("Error refreshing token:");
        logger.error(e.response.body);
        throw e;
    });
    let token = response.body.access_token;
    let refresh_token = response.body.refresh_token;
    await database.setBroadcasterToken(token, refresh_token);
    return config.refreshConfigFromDB()
}

module.exports.checkTokenValidity = async function() {
    try {
        if (!config.config['chatRefreshToken']) {
            logger.error("No chat refresh Token available! Expecting tokenless mode.");
            config.config['hasChatToken'] = false;
        } else {
            let response = await got({
                method: 'GET', url: "https://id.twitch.tv/oauth2/validate",
                headers: {
                    "Authorization": `OAuth ${config.config['chatToken']}`
                },
                responseType: "json"
            });
            let hasChatReadScope = false;
            let hasEditScope = false;
            for (let scope of response.body.scopes) {
                if (scope === "chat:edit") {
                    hasEditScope = true;
                } else if (scope === "chat:read") {
                    hasChatReadScope = true;
                }
            }
            if (hasChatReadScope && hasEditScope) {
                config.config['hasChatToken'] = true;
            } else {
                logger.error("Required scopes not on Chat token. Expecting tokenless mode.");
                config.config['hasChatToken'] = false;
                logger.error("Available scopes:");
                logger.error(response.body.scopes);
            }
        }
    } catch (e) {
        if (!e.hasOwnProperty('response')) {
            logger.error("Got no response trying to check chatToken Validity.");
            logger.error(e);
        } else {
            logger.error("chatToken was invalid:");
            logger.error(e.response.body);
            await module.exports.refreshChatToken();
        }
        config.config['hasChatToken'] = false;
    }
    try {
        if (!config.config['broadcasterRefreshToken']) {
            logger.error("No broadcaster refresh Token available! Expecting tokenless mode.");
            config.config['hasBroadcasterToken'] = false;
        } else {
            let response = await got({
                method: 'GET', url: "https://id.twitch.tv/oauth2/validate",
                headers: {
                    "Authorization": `OAuth ${config.config['broadcasterToken']}`
                },
                responseType: "json"
            });
            let hasRedemptionScope = false;
            let hasEditScope = false;
            let hasChatEditScope = false;
            let hasChatReadScope = false;
            for (let scope of response.body.scopes) {
                if (scope === "user:edit:broadcast") {
                    hasEditScope = true;
                } else if (scope === "channel:read:redemptions") {
                    hasRedemptionScope = true;
                } else if (scope === "chat:edit") { // Needed for FFZ verification
                    hasChatEditScope = true;
                } else if (scope === "chat:read") {
                    hasChatReadScope = true;
                }
            }
            if (hasRedemptionScope && hasEditScope && hasChatEditScope && hasChatReadScope) {
                config.config['hasBroadcasterToken'] = true;
            } else {
                logger.error("Required scopes not on Broadcaster token. Expecting tokenless mode.");
                config.config['hasBroadcasterToken'] = false;
                logger.error("Available scopes:");
                logger.error(response.body.scopes);
            }
        }
    } catch (e) {
        if (!e.hasOwnProperty('response')) {
            logger.error("Got no response trying to check broadcasterToken Validity. Can't refresh.");
            logger.error(e);
        } else {
            logger.error("broadcasterToken was invalid:");
            logger.error(e.response.body);
            await module.exports.refreshBroadcasterToken();
        }
        config.config['hasBroadcasterToken'] = false;
    }
    logger.info("Token verification procedure complete.");
}
