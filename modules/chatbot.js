'use strict';

const tmi = require('tmi.js');
const path = require('path');
const fs = require('fs');

let logger = require('./logger');
let config = require('./config');
let auth = require('./auth');

let chatClient;

module.exports.joinChat = async function () {
    if (chatClient) {
        logger.info("chatClient already exists, quitting it and rejoining.");
        try {
            await chatClient.disconnect();
        } catch (e) {
            logger.error("Expected Error disconnecting preexisting connection. Ignoring.");
        }

    }
    if (config.config['hasChatToken']) {
        chatClient = new tmi.Client({
            connection: {
                secure: true,
                reconnect: true
            },
            identity: {
                username: config.config['userName'],
                password: 'oauth:' + config.config['chatToken']
            },
            channels: [config.config['channelName']]
        });
    } else {
        chatClient = new tmi.Client({
            connection: {
                secure: true,
                reconnect: true
            },
            channels: [config.config['channelName']]
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
        if (config.config['hasChatToken']) {
            logger.info("There was a chatToken found, but an error occured connecting to chat - trying to refresh Token...");
            try {
                await auth.refreshChatToken();
                return module.exports.joinChat();
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
        if (self || !config.config['hasChatToken']) return;

        if (message.startsWith('!')) {
            handleCommands(channel, tags, message).then();
        } else {
            logger.info(`[chat][${channel}][${tags.username}] ${message}`);
        }
    });
}

async function handleCommands(channel, tags, message) {
    let parts = message.split(" ");
    let command = parts[0].substring(1);
    let args = parts.slice(1);
    if (commands.hasOwnProperty(command)) {
        logger.info(`[command][${channel}][${tags.username}] ${message}`)
        let reply = await commands[command](args, tags, channel);
        chatClient.say(channel, reply.toString());
        logger.info(`[command Reply][${channel}][${config.config['userName']}] ${reply}`)
    } else {
        logger.info(`[unknown command][${channel}][${tags.username}] ${message}`);
    }
}

let commands = {};
module.exports.reloadCommands = async function () {
    let normalizedPath = path.join(__dirname, "chatbot", "commands");
    commands = {};
    fs.readdirSync(normalizedPath).forEach((file) => {
        let fileNoExt = file.split('.')[0];
        try {
            let name = require.resolve("./chatbot/commands/" + file);
            delete require.cache[name];
        } finally {
            commands[fileNoExt] = require("./chatbot/commands/" + file);
        }

    });
}

let announcements = [];
let activeAnnouncements = [];
module.exports.reloadAnnouncements = async function () {
    let content = fs.readFileSync(path.join(__dirname, "chatbot", "announcements.json")).toString("utf-8");
    announcements = JSON.parse(content);
    logger.info("New Announcements:");
    logger.info(announcements);
    for (let a of activeAnnouncements) {
        clearInterval(a);
    }
    activeAnnouncements = [];
    for (let announcement of announcements) {
        activeAnnouncements.push(setInterval(async () => {
            try {
                chatClient.say('#' + config.config['channelName'], announcement.message);
                logger.info(`[announcement][${'#' + config.config['channelName']}][${config.config['userName']}] ${announcement.message}`)
            } catch {
                logger.warning("Swallowing error sending Announcement.");
            }
        }, announcement.interval * 1000));
    }
}

// Initialization

module.exports.reloadCommands().then(() => {
    logger.info("Commands loaded");
}).catch((e) => {
    logger.error("Error loading commands");
    logger.error(e);
});

module.exports.reloadAnnouncements().then(() => {
    logger.info("Announcements loaded");
}).catch((e) => {
    logger.error("Error loading Announcements");
    logger.error(e);
});
