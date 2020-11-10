'use strict';
const ws = require('websocket');

let logger = require('./logger');
let config = require('./config');
let api = require('./twitchapi');
let db = require('./database');

const TWITCH_PUBSUB_URL = "wss://pubsub-edge.twitch.tv";

let client;
let connection;
let pingTimeout;

module.exports.restart = async function () {
    if (!config.config['hasBroadcasterToken']) {
        logger.error("[pubsub] Can't reasonably connect to Pubsub without broadcaster Token. Try again later.");
        return
    }
    if (client) {
        try {
            connection.close(0, "Restarting");
        } catch {
            try {
                client.abort();
            } catch {
            }
        } finally {
            logger.info("[pubsub] Previous connection terminated if it existed.");
        }
    }
    let broadcasterID = (await api.getUserInfo(config.config['channelName'], false)).id;
    client = new ws.client();
    client.on('connect', (con) => {
        logger.info("[pubsub] Connected to Twitch PubSub.");
        connection = con;
        if (pingTimeout) {
            clearTimeout(pingTimeout);
        }
        pingTimeout = setTimeout(pingHandler, 280000 + (Math.random() * 10000));
        connection.on('close', () => {
            clearTimeout(pingTimeout);
        });
        connection.send(JSON.stringify({
            type: "LISTEN",
            data: {
                topics: [`channel-points-channel-v1.${broadcasterID}`],
                auth_token: config.config['broadcasterToken']
            }
        }));
        connection.on('message', (message) => {
            if (message.type === 'utf8') {
                let msg = JSON.parse(message.utf8Data);
                if (msg.type === "PONG") {
                    logger.info("[pubsub][PONG]");
                } else if (msg.type === "RECONNECT") {
                    logger.info("[pubsub][RECONNECT] Received reconnect request. Reconnecting...");
                    setTimeout(() => {
                        module.exports.restart().catch((e) => {
                            logger.error("[pubsub][RECONNECT] Error Reconnecting:");
                            logger.error(e);
                        });
                    }, Math.random() * 5000);
                    try {
                        con.disconnect();
                    } catch {
                    }
                } else if (msg.type === "MESSAGE") {
                    let data = msg.data;
                    if (data.topic.startsWith("channel-points")) {
                        let cpMessage = JSON.parse(data.message);
                        let cpData = cpMessage.data;
                        let redemption = cpData.redemption;
                        logger.info(`[pubsub][message][redemption] ${
                            redemption.user['display_name']} redeemed ${
                            redemption.reward.title} for ${
                            redemption.reward.cost} points!`);
                        db.addPoints(redemption.user['id'], redemption.reward.cost).then((result)=> {
                            if (!result) {
                                logger.error("Error awarding points for the above rdemption");
                            }
                        }).catch((e) => {
                            logger.error("Error awarding points for the above rdemption:");
                            logger.error(e);
                        });
                    } else {
                        logger.info("[pubsub][message] Unparsed Topic Response: " + JSON.stringify(data));
                    }
                } else if (msg.type === "RESPONSE") {
                    if (msg.error === "") {
                        logger.info("[pubsub][message][RESPONSE][SUCCESS] No Error.");
                    } else {
                        logger.error("[pubsub][message][RESPONSE][ERROR] " + msg.error);
                    }
                } else {
                    logger.info("[pubsub][message] Unparsed Message: " + JSON.stringify(msg));
                }
            } else {
                logger.info("[pubsub][message] BINARY MESSAGE IGNORED");
            }
        });
    })
    client.connect(TWITCH_PUBSUB_URL);
}

function pingHandler() {
    logger.info("[pubsub][PING]");
    connection.send(JSON.stringify({
        type: "PING"
    }));
    pingTimeout = setTimeout(pingHandler, 300000 + (Math.random() * 1000));
}
