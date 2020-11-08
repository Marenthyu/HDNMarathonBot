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
