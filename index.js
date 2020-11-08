'use strict';
const async = require('async');

let database = require('./database');
let config = require('./config');
let logger = require('./logger');
let website = require('./website');
let chatbot = require('./chatbot');

async.series([database.connectToDB, config.refreshConfigFromDB, chatbot.joinChat, website.startWebsite]).catch((error) => {
    logger.error("Unhandled top-level exception:");
    logger.error(error);
    process.exit(2);
}).then(() => {
    logger.info("Startup done!");
});
