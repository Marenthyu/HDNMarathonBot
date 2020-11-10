'use strict';
const async = require('async');

let database = require('./modules/database');
let config = require('./modules/config');
let logger = require('./modules/logger');
let website = require('./modules/website');
let chatbot = require('./modules/chatbot');
let auth = require('./modules/auth');
let pubsub = require('./modules/pubsub');

async.series([database.connectToDB, config.refreshConfigFromDB, auth.checkTokenValidity, chatbot.joinChat,
    pubsub.restart, website.startWebsite]).catch((error) => {
    logger.error("Unhandled top-level exception:");
    logger.error(error);
    process.exit(2);
}).then(() => {
    logger.info("Startup done!");
});
