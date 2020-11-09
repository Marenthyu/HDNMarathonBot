'use strict';
const got = require('got');

let logger = require('./logger');
let config = require('./config');
const MAIN_TOKEN_TYPE = 'Chat';
const BC_TOKEN_TYPE = 'Broadcaster';

module.exports.getUserInfo = async function(nameOrID, isID) {
    hasToken(MAIN_TOKEN_TYPE);
    let typeToUse = 'id';
    if (!isID) {
        typeToUse = 'login';
    }
    let response = await got({
        method: 'GET', url: `https://api.twitch.tv/helix/users?${typeToUse}=${encodeURIComponent(nameOrID)}`,
        headers: {
            "Client-ID": config.config['clientID'],
            "Authorization": `Bearer ${config.config['chatToken']}`
        },
        responseType: "json"
    }).catch((e) => {
        logger.error("Error getting user:");
        logger.error(e.response.body);
        logger.error("Used URL:");
        logger.error(`https://api.twitch.tv/helix/users?${typeToUse}=${encodeURIComponent(nameOrID)}`);
        throw e;
    });
    if (response.body.data.length !== 1) {
        logger.error("Invalid data length returned trying to get user info for " + nameOrID + " - returning null");
        logger.error("Returned body: ");
        logger.error(response.body);
        logger.error("Used URL:");
        logger.error(`https://api.twitch.tv/helix/users?${typeToUse}=${encodeURIComponent(nameOrID)}`);
        return null;
    } else {
        return response.body.data[0];
    }
}

function hasToken(type) {
    if (!config.config['has' + type + 'Token']) {
        throw new Error("Twitch API Called without token available!");
    }
}
