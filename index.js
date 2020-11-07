'use strict';
const got = require('got');
const tmi = require('tmi.js');
const mysql = require('mysql2/promise');
const async = require('async');
const fs = require('fs');

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
            typeof info.message === 'string' ? info.message : JSON.stringify(info.message)
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

let db;

async function connectToDB() {
    db = await mysql.createConnection({
        host: config['dbhost'], user: config['dbuser'], database: config['dbname'],
        port: config['dbport'], password: config['dbpass']
    });
}

async function readConfig() {
    let [rows,] = await db.execute("SELECT * FROM config");
    for (let row of rows) {
        config[row.name] = row.value;
    }
    if (config['chatToken'] === null) {
        logger.warn("No Chat Token available yet, entering setup mode.");
    } else {
        hasChatToken = true;
    }
}

async function joinChat() {
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
    await chatClient.connect();
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

async.series([connectToDB, readConfig, joinChat]).catch((error) => {
    logger.error("Unhandled top-level exception:");
    logger.error(error);
    process.exit(2);
}).then(() => {
    logger.info("Startup done!");
});
