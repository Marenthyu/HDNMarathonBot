'use strict';
let config = require('./config');
let logger = require('./logger');
let mysql = require('mysql2/promise');
let api = require('./twitchapi');

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

module.exports.setBroadcasterToken = async function (broadcasterToken, broadcasterRefreshToken) {
    await module.exports.db.execute('REPLACE INTO config(name, value) VALUES (\'broadcasterToken\', ?), (\'broadcasterRefreshToken\', ?)', [broadcasterToken, broadcasterRefreshToken]);
    logger.info("broadcasterToken and broadcasterRefreshToken updated!");
}

module.exports.isAdmin = async function (userID) {
    let [rows] = await module.exports.db.execute('SELECT * FROM admins WHERE id = ?', [userID]);
    return rows.length === 1;
}

module.exports.addFreeVotes = async function (userID, votes) {
    try {
        let [result] = await module.exports.db.execute('UPDATE users SET votes = votes + ? WHERE id = ?', [votes, userID]);
        if (result.affectedRows === 0) {
            logger.error("Rows were not 1 for updating user votes! Creating user...");
            // noinspection ExceptionCaughtLocallyJS
            throw new Error("Only affected 0 users");
        }
        return result.affectedRows === 1;
    } catch {
        logger.info("Had to fall back to create user...");
        try {
            await module.exports.addUser(userID, (await api.getUserInfo(userID, true))['login']);
            let [result] = await module.exports.db.execute('UPDATE users SET votes = votes + ? WHERE id = ?', [votes, userID]);
            return result.affectedRows === 1;
        } catch {
            logger.error("Error adding votes to user, even after trying to create it!");
            return false;
        }
    }
}

module.exports.getFreeVotes = async function (userID) {
    let [rows] = await module.exports.db.execute('SELECT votes FROM users WHERE id = ?', [userID]);
    try {
        return rows[0].votes;
    } catch {
        return 0;
    }
}

module.exports.getTopFreeVotes = async function (limit) {
    let [rows] = await module.exports.db.execute('SELECT * FROM users ORDER BY votes DESC LIMIT ?', [limit.toString()]);
    try {
        return rows;
    } catch {
        return [];
    }
}

module.exports.addUser = async function (userID, name) {
    let [rows] = await module.exports.db.execute('REPLACE INTO `users` (`id`, `name`) VALUES (?, ?)', [userID, name]);
    return rows;
}
