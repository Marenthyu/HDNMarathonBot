'use strict';
const got = require('got');
const tmi = require('tmi.js');
const mysql = require('mysql2/promise');
const async = require('async');
const fs = require('fs');
const http = require('http');
const url = require('url');
const util = require('util')

const winston = require('winston');

function pad(pad, str, padLeft) {
    if (typeof str === 'undefined')
        return pad;
    if (padLeft) {
        return (pad + str).slice(-pad.length);
    } else {
        return (str + pad).substring(0, pad.length);
    }
}

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss.ms'
        }),
        winston.format.printf(info => `[${info.timestamp}][${info.service}][${
            pad('     ', info.level)}] ${
            typeof info.message === 'string' ? info.message : util.inspect(info.message)
        }`)
    ),
    defaultMeta: {service: 'hdnbot'},
    transports: [
        //
        // - Write all logs with level `error` and below to `error.log`
        // - Write all logs with level `info` and below to `combined.log`
        //
        new winston.transports.File({filename: 'hdn-error.log', level: 'error'}),
        new winston.transports.File({filename: 'hdn-combined.log'}),
        new winston.transports.Console({level: 'debug'})
    ],
});

let hasChatToken = false;
let chatClient;

let cfgfile = fs.readFileSync('hdnbot.cfg', 'utf8');
let cfglines = cfgfile.matchAll(/(?<key>\w+)=(?<value>[^\r\n]+)/g);
let config = {};
for (let line of cfglines) {
    config[line.groups.key] = line.groups.value;
}
if (!config.hasOwnProperty("dbhost")) {
    logger.error("Missing required Config Parameter dbhost. Please add it to the config.");
    process.exit(1);
}
if (!config.hasOwnProperty("dbport")) {
    logger.error("Missing required Config Parameter dbport. Please add it to the config.");
    process.exit(1);
}
if (!config.hasOwnProperty("dbuser")) {
    logger.error("Missing required Config Parameter dbuser. Please add it to the config.");
    process.exit(1);
}
if (!config.hasOwnProperty("dbpass")) {
    logger.error("Missing required Config Parameter dbpass. Please add it to the config.");
    process.exit(1);
}
if (!config.hasOwnProperty("dbname")) {
    logger.error("Missing required Config Parameter dbname. Please add it to the config.");
    process.exit(1);
}
if (!config.hasOwnProperty("websiteport")) {
    logger.error("Missing required Config Parameter websiteport. Please add it to the config.");
    process.exit(1);
}

let db;

async function connectToDB() {
    db = await mysql.createConnection({
        host: config['dbhost'], user: config['dbuser'], database: config['dbname'],
        port: config['dbport'], password: config['dbpass']
    });
    logger.info("Connected to Database!");
}

async function readConfig() {
    logger.info("Reloading Config values...");
    let [rows,] = await db.execute("SELECT * FROM config");
    for (let row of rows) {
        config[row.name] = row.value;
    }
    if (config['chatToken'] === null || config['chatToken'] === undefined) {
        logger.warn("No Chat Token available yet, entering setup mode.");
    } else {
        hasChatToken = true;
    }
}

async function joinChat() {
    if (chatClient) {
        logger.info("chatClient already exists, quitting it and rejoining.");
        try {
            await chatClient.disconnect();
        } catch (e) {
            logger.error("Expected Error disconnecting preexisting connection. Ignoring.");
        }

    }
    if (hasChatToken) {
        chatClient = new tmi.Client({
            connection: {
                secure: true,
                reconnect: true
            },
            identity: {
                username: config['userName'],
                password: 'oauth:' + config['chatToken']
            },
            channels: [config['channelName']]
        });
    } else {
        chatClient = new tmi.Client({
            connection: {
                secure: true,
                reconnect: true
            },
            channels: [config['channelName']]
        });
    }
    chatClient.on('connected', () => {
        logger.info("Connected to Twitch Chat!");
    });
    try {
        await chatClient.connect();
    } catch (e) {
        logger.error("Error connecting to chat.");
        logger.error(e);
        if (hasChatToken) {
            logger.info("There was a chatToken found, but an error occured connecting to chat - trying to refresh Token...");
            try {
                await refreshToken();
                return joinChat();
            } catch (e) {
                logger.error("Error refreshing token, failing.");
                logger.error(e);
                process.exit(4);
            }
        } else {
            process.exit(3);
        }
    }

    chatClient.on('message', (channel, tags, message, self) => {
        // Ignore echoed messages.
        if (self || !hasChatToken) return;

        if (message.startsWith('!')) {
            handleCommands(channel, tags, message).then();
        } else {
            logger.info(`[chat][${channel}][${tags.username}] ${message}`);
        }
    });
}

let commands = {
    'echo': echoCommand
}

async function handleCommands(channel, tags, message) {
    let parts = message.split(" ");
    let command = parts[0].substring(1);
    let args = parts.slice(1);
    if (commands.hasOwnProperty(command)) {
        logger.info(`[command][${channel}][${tags.username}] ${message}`)
        commands[command](channel, tags, args);
    } else {
        logger.info(`[unknown command][${channel}][${tags.username}] ${message}`);
    }
}

async function echoCommand(channel, tags, args) {
    chatClient.say(channel, args.join(' '));
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
            let myURL = new URL((config['http'] === 'true' ? 'http' : 'https') + '://' + req.headers.host + req.url)
            logger.info(encodeURIComponent(myURL.origin + myURL.pathname));
            let response = await got({
                method: 'POST', url: `https://id.twitch.tv/oauth2/token?client_id=${
                    encodeURIComponent(config['clientID'])}&client_secret=${
                    encodeURIComponent(config['clientSecret'])}&code=${
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
                    "Client-ID": config['clientID']
                }
            });
            if (userResponse.body.data.length !== 1) {
                logger.error("Unexpected response length for user verification - not setting token.");
                return
            }
            if (userResponse.body.data[0].login !== config["userName"]) {
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
        await db.execute('REPLACE INTO config(name, value) VALUES (\'chatToken\', ?), (\'chatRefreshToken\', ?)', [token, refresh_token]);
        logger.info("chatToken and chatRefreshToken updated!");
        let hadChatToken = hasChatToken;
        await readConfig();
        if (hadChatToken) {
            logger.info("Note: the updated chatToken will only take effect upon re-login, but will be used for requests already.");
        } else {
            await joinChat();
        }
    }

}

async function refreshToken() {
    logger.info("Refreshing chat token...");
    let response = await got({
        method: 'POST', url: `https://id.twitch.tv/oauth2/token?client_id=${
            encodeURIComponent(config['clientID'])}&client_secret=${
            encodeURIComponent(config['clientSecret'])}&refresh_token=${
            encodeURIComponent(config['chatRefreshToken'])}&grant_type=refresh_token`,
        responseType: "json"
    }).catch((e) => {
        logger.error("Error refreshing token:");
        logger.error(e.response.body);
        throw e;
    });
    let token = response.body.access_token;
    let refresh_token = response.body.refresh_token;
    await db.execute('REPLACE INTO config(name, value) VALUES (\'chatToken\', ?), (\'chatRefreshToken\', ?)', [token, refresh_token]);
    logger.info("chatToken and chatRefreshToken updated!");
    return readConfig()
}

const websiteEndpoints = {
    'twitchcallback': twitchCallback
}

function defaultWebsiteEndpoint(req, res) {
    httpError(res, 404, 'Not Found');
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

function startWebsite() {
    logger.info("Website listening on port " + config['websiteport'] + "...");
    http.createServer(((req, res) => {
        let q = url.parse(req.url, true);
        if (websiteEndpoints.hasOwnProperty(q.pathname.substring(1))) {
            websiteEndpoints[q.pathname.substring(1)](req, res, q);
        } else {
            defaultWebsiteEndpoint(req, res);
        }
    })).listen(parseInt(config['websiteport']));
}

async.series([connectToDB, readConfig, joinChat, startWebsite]).catch((error) => {
    logger.error("Unhandled top-level exception:");
    logger.error(error);
    process.exit(2);
}).then(() => {
    logger.info("Startup done!");
});
