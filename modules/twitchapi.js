'use strict';
const got = require('got');

let logger = require('./logger');
let config = require('./config');
const MAIN_TOKEN_TYPE = 'Chat';
const BC_TOKEN_TYPE = 'Broadcaster';

async function doRequest(method, endpoint, body, TOKEN_TYPE, queryParams, expectedBodyDataLength, defaultObject) {
    const params = new URLSearchParams(queryParams);
    hasToken(TOKEN_TYPE);
    let endpointURL = `https://api.twitch.tv/helix/${endpoint}?${params.toString()}`;
    let response;
    if (method === 'GET' || body === null) {
        response = await got({
            method: method, url: endpointURL,
            headers: {
                "Client-ID": config.config['clientID'],
                "Authorization": `Bearer ${config.config[TOKEN_TYPE.toLowerCase() + 'Token']}`
            },
            responseType: "json"
        }).catch((e) => {
            logger.error("Error on request:");
            logger.error(e.response ? e.response.body : e);
            logger.error("Used URL:");
            logger.error(endpointURL);
            throw e;
        });
    } else {
        response = await got({
            method: method, url: endpointURL,
            headers: {
                "Client-ID": config.config['clientID'],
                "Authorization": `Bearer ${config.config[TOKEN_TYPE.toLowerCase() + 'Token']}`
            },
            responseType: "json",
            json: body
        }).catch((e) => {
            logger.error("Error on request:");
            logger.error(e.response ? e.response.body : e);
            logger.error("Used URL:");
            logger.error(endpointURL);
            throw e;
        });
    }
    if (expectedBodyDataLength && response.body.data.length !== expectedBodyDataLength) {
        logger.error("Invalid data length returned for request to " + endpoint + " - returning default object");
        logger.error("Returned body: ");
        logger.error(response.body);
        return defaultObject;
    } else {
        if (expectedBodyDataLength !== 1) {
            return response.body;
        } else {
            return response.body.data[0];
        }
    }
}

module.exports.getUserInfo = async function (nameOrID, isID) {
    let typeToUse = 'id';
    if (!isID) {
        typeToUse = 'login';
    }
    let queryParam = {};
    queryParam[typeToUse] = nameOrID;
    return doRequest('GET', 'users', null, MAIN_TOKEN_TYPE, queryParam, 1, null);
}

function hasToken(type) {
    if (!config.config['has' + type + 'Token']) {
        throw new Error("Twitch API Called without required token available!");
    }
}

module.exports.getGameInfo = async function (name) {
    let exactMatch = await module.exports.getGameInfoExact(name);
    if (exactMatch.id !== 0) {
        return exactMatch;
    }
    return doRequest('GET', 'search/categories', null, MAIN_TOKEN_TYPE, {first: 1, query: name},
        1, {"name": "Unknown Game", "id": 0});
}

module.exports.getGameInfoExact = async function (name) {
    return doRequest('GET', 'games', null, MAIN_TOKEN_TYPE, {name: name},
        1, {"name": "Unknown Game", "id": 0});
}

module.exports.setStreamTitle = async function (title) {
    return doRequest('PATCH', 'channels', {title: title}, BC_TOKEN_TYPE,
        {broadcaster_id: (await module.exports.getUserInfo(config.config['channelName'])).id});
}

module.exports.setStreamGame = async function (gameName) {
    let gameID = (await module.exports.getGameInfo(gameName)).id;
    if (gameID === 0) {
        throw new Error("Invalid Game Name Specified!");
    }
    return doRequest('PATCH', 'channels', {game_id: gameID}, BC_TOKEN_TYPE,
        {broadcaster_id: (await module.exports.getUserInfo(config.config['channelName'])).id});
}

module.exports.setStreamBoth = async function (title, gameName) {
    let gameID = (await module.exports.getGameInfo(gameName)).id;
    if (gameID === 0) {
        throw new Error("Invalid Game Name Specified!");
    }
    return doRequest('PATCH', 'channels', {game_id: gameID, title: title}, BC_TOKEN_TYPE,
        {broadcaster_id: (await module.exports.getUserInfo(config.config['channelName'])).id});
}

module.exports.createReward = async function (reward) {
    hasToken(BC_TOKEN_TYPE);
    return doRequest('POST', 'channel_points/custom_rewards', reward, BC_TOKEN_TYPE,
        {broadcaster_id: (await module.exports.getUserInfo(config.config['channelName'])).id},
        1, {"id": "0", "title": "An Unknown Reward."});
}

