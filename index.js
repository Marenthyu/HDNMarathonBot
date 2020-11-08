'use strict';
const async = require('async');

let database = require('./modules/database');
let config = require('./modules/config');
let logger = require('./modules/logger');
let website = require('./modules/website');
let chatbot = require('./modules/chatbot');

async.series([database.connectToDB, config.refreshConfigFromDB, chatbot.joinChat, website.startWebsite]).catch((error) => {
    logger.error("Unhandled top-level exception:");
    logger.error(error);
    process.exit(2);
}).then(() => {
    logger.info("Startup done!");
});
