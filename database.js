'use strict';
let config = require('./config');
let logger = require('./logger');
let mysql = require('mysql2/promise');

module.exports.connectToDB = async function () {
    logger.info("Connecting to database...")
    module.exports.db = await mysql.createConnection({
        host: config.config['dbhost'], user: config.config['dbuser'], database: config.config['dbname'],
        port: config.config['dbport'], password: config.config['dbpass']
    });
    logger.info("Connected to Database!");
}

module.exports.setChatToken = async function (chatToken, chatRefreshToken) {
    await module.exports.db.execute('REPLACE INTO config(name, value) VALUES (\'chatToken\', ?), (\'chatRefreshToken\', ?)', [chatToken, chatRefreshToken]);
    logger.info("chatToken and chatRefreshToken updated!");
}
