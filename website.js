'use strict';

const http = require('http');
const url = require('url');
const got = require('got');

let logger = require('./logger');
let config = require('./config');
let database = require('./database');
let chatbot = require('./chatbot');

module.exports.startWebsite = function () {
    logger.info("Website listening on port " + config.config['websiteport'] + "...");
    http.createServer(((req, res) => {
        let q = url.parse(req.url, true);
        if (websiteEndpoints.hasOwnProperty(q.pathname.substring(1))) {
            websiteEndpoints[q.pathname.substring(1)](req, res, q);
        } else {
            defaultWebsiteEndpoint(req, res);
        }
    })).listen(parseInt(config.config['websiteport']));
}

function httpError(res, code, reason, body, headers) {
    if (!body) {
        body = JSON.stringify({error: "default error."});
    }
    if (typeof body !== 'string') {
        body = JSON.stringify(body);
    }
    if (!headers) {
        headers = {'Content-Type': 'application/json'};
    }
    if (!headers.hasOwnProperty('Content-Type')) {
        try {
            JSON.parse(body);
            headers['Content-Type'] = 'application/json';
        } catch (e) {
            headers['Content-Type'] = 'text/plain';
        }
    }
    res.writeHead(code, reason, headers);
    res.end(body);
}

const websiteEndpoints = {
    'twitchcallback': twitchCallback
}

async function twitchCallback(req, res, q) {
    let state = q.query.state;
    let code = q.query.code;
    let error = q.query.error;
    let error_description = q.query.error_description;
    if (error && error_description) {
        httpError(res, 400, 'Client Error', 'Error Authorizing with Twitch: ' + error_description + "\nError Code: " + error);
    } else if (!state || !code) {
        httpError(res, 400, 'Client Error', 'Missing required parameter. You shouldn\'t see this.');
    } else if (state !== 'chatToken') {
        httpError(res, 400, 'Client Error', 'Invalid state. You shouldn\'t see this.');
    } else {
        res.writeHead(200, 'OK');
        res.end("Got your token, checking with Twitch and saving to Database. You may close this tab.");
        let token;
        let refresh_token;
        try {
            let myURL = new URL((config.config['http'] === 'true' ? 'http' : 'https') + '://' + req.headers.host + req.url)
            logger.info(encodeURIComponent(myURL.origin + myURL.pathname));
            let response = await got({
                method: 'POST', url: `https://id.twitch.tv/oauth2/token?client_id=${
                    encodeURIComponent(config.config['clientID'])}&client_secret=${
                    encodeURIComponent(config.config['clientSecret'])}&code=${
                    encodeURIComponent(code)}&grant_type=authorization_code&redirect_uri=${
                    encodeURIComponent(myURL.origin + myURL.pathname)}`,
                responseType: "json"
            });
            token = response.body.access_token;
            refresh_token = response.body.refresh_token;
        } catch (e) {
            logger.error("Error getting token from twitch:");
            logger.error(e);
            logger.error(e.response.body);
            return
        }
        logger.info("Got token from Twitch - checking username for expected value...");
        try {
            let userResponse = await got({
                method: "GET",
                url: "https://api.twitch.tv/helix/users",
                responseType: "json",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Client-ID": config.config['clientID']
                }
            });
            if (userResponse.body.data.length !== 1) {
                logger.error("Unexpected response length for user verification - not setting token.");
                return
            }
            if (userResponse.body.data[0].login !== config.config["userName"]) {
                logger.error("Username of token did not match acquired token - not setting token");
                return
            }
        } catch (e) {
            logger.error("Error verifying user from token on twitch:");
            logger.error(e);
            logger.error(e.response.body);
            return
        }
        logger.info("New Token verified - updating database...");
        await database.setChatToken(token, refresh_token);
        let hadChatToken = config.config['hasChatToken'];
        await config.refreshConfigFromDB();
        if (hadChatToken) {
            logger.info("Note: the updated chatToken will only take effect upon re-login, but will be used for requests already.");
        } else {
            await chatbot.joinChat();
        }
    }

}


function defaultWebsiteEndpoint(req, res) {
    httpError(res, 404, 'Not Found');
}
