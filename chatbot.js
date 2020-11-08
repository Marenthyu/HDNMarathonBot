'use strict';

const tmi = require('tmi.js');

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
        commands[command](channel, tags, args);
    } else {
        logger.info(`[unknown command][${channel}][${tags.username}] ${message}`);
    }
}


let commands = {
    'echo': echoCommand
}

async function echoCommand(channel, tags, args) {
    chatClient.say(channel, args.join(' '));
}
