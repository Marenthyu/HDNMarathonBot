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

module.exports.getGameInfo = async function(name) {
    hasToken(MAIN_TOKEN_TYPE);
    let exactMatch = await module.exports.getGameInfoExact(name);
    if (exactMatch.id !== 0) {
        return exactMatch;
    }
    let response = await got({
        method: 'GET', url: `https://api.twitch.tv/helix/search/categories?first=1&query=${encodeURIComponent(name)}`,
        headers: {
            "Client-ID": config.config['clientID'],
            "Authorization": `Bearer ${config.config['chatToken']}`
        },
        responseType: "json"
    }).catch((e) => {
        logger.error("Error searching game:");
        logger.error(e.response.body);
        throw e;
    });
    if (!response.body.data || response.body.data.length !== 1) {
        logger.error("Invalid data length returned trying to get game - returning unknown game");
        logger.error("Returned body: ");
        logger.error(response.body);
        return {"name": "Unknown Game", "id":0};
    } else {
        return response.body.data[0];
    }
}

module.exports.getGameInfoExact = async function(name) {
    hasToken(MAIN_TOKEN_TYPE);
    let response = await got({
        method: 'GET', url: `https://api.twitch.tv/helix/games?name=${encodeURIComponent(name)}`,
        headers: {
            "Client-ID": config.config['clientID'],
            "Authorization": `Bearer ${config.config['chatToken']}`
        },
        responseType: "json"
    }).catch((e) => {
        logger.error("Error getting exact game:");
        logger.error(e.response.body);
        return {"name": "Unknown Game", "id":0};
    });
    if (response.body.data.length !== 1) {
        logger.error("Invalid data length returned trying to get exact game - returning unknown game");
        logger.error("Returned body: ");
        logger.error(response.body);
        return {"name": "Unknown Game", "id":0};
    } else {
        return response.body.data[0];
    }
}

module.exports.setStreamTitle = async function(title) {
    hasToken(BC_TOKEN_TYPE);
    await got({
        method: 'PATCH', url: `https://api.twitch.tv/helix/channels?broadcaster_id=${encodeURIComponent((await module.exports.getUserInfo(config.config['channelName'])).id)}`,
        headers: {
            "Client-ID": config.config['clientID'],
            "Authorization": `Bearer ${config.config['broadcasterToken']}`
        },
        responseType: "json",
        json: {
            title: title
        }
    }).catch((e) => {
        logger.error("Error setting title:");
        logger.error(e.response.body);
        throw e;
    });
}

module.exports.setStreamGame = async function(gameName) {
    hasToken(BC_TOKEN_TYPE);
    let gameID = (await module.exports.getGameInfo(gameName)).id;
    if (gameID === 0) {
        throw new Error("Invalid Game Name Specified!");
    }
    await got({
        method: 'PATCH', url: `https://api.twitch.tv/helix/channels?broadcaster_id=${encodeURIComponent((await module.exports.getUserInfo(config.config['channelName'])).id)}`,
        headers: {
            "Client-ID": config.config['clientID'],
            "Authorization": `Bearer ${config.config['broadcasterToken']}`
        },
        responseType: "json",
        json: {
            game_id: gameID
        }
    }).catch((e) => {
        logger.error("Error setting game:");
        logger.error(e.response.body);
        throw e;
    });
}

module.exports.setStreamBoth = async function(title, gameName) {
    hasToken(BC_TOKEN_TYPE);
    let gameID = (await module.exports.getGameInfo(gameName)).id;
    if (gameID === 0) {
        throw new Error("Invalid Game Name Specified!");
    }
    await got({
        method: 'PATCH', url: `https://api.twitch.tv/helix/channels?broadcaster_id=${encodeURIComponent((await module.exports.getUserInfo(config.config['channelName'])).id)}`,
        headers: {
            "Client-ID": config.config['clientID'],
            "Authorization": `Bearer ${config.config['broadcasterToken']}`
        },
        responseType: "json",
        json: {
            game_id: gameID,
            title: title
        }
    }).catch((e) => {
        logger.error("Error setting game:");
        logger.error(e.response.body);
        throw e;
    });
}
