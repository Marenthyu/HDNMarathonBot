'use strict';
let config = require('./config');
let logger = require('./logger');
let mysql = require('mysql2/promise');
let api = require('./twitchapi');

module.exports.connectToDB = async function () {
    logger.info("[database] Connecting to database...")
    module.exports.db = await mysql.createConnection({
        host: config.config['dbhost'], user: config.config['dbuser'], database: config.config['dbname'],
        port: config.config['dbport'], password: config.config['dbpass']
    });
    logger.info("[database] Connected to Database!");
}

module.exports.setChatToken = async function (chatToken, chatRefreshToken) {
    await module.exports.db.execute('REPLACE INTO config(name, value) VALUES (\'chatToken\', ?), (\'chatRefreshToken\', ?)', [chatToken, chatRefreshToken]);
    logger.info("[database] chatToken and chatRefreshToken updated!");
}

module.exports.setBroadcasterToken = async function (broadcasterToken, broadcasterRefreshToken) {
    await module.exports.db.execute('REPLACE INTO config(name, value) VALUES (\'broadcasterToken\', ?), (\'broadcasterRefreshToken\', ?)', [broadcasterToken, broadcasterRefreshToken]);
    logger.info("[database] broadcasterToken and broadcasterRefreshToken updated!");
}

module.exports.isAdmin = async function (userID) {
    let [rows] = await module.exports.db.execute('SELECT * FROM admins WHERE id = ?', [userID]);
    return rows.length === 1;
}

module.exports.addFreeVotes = async function (userID, votes) {
    try {
        let [result] = await module.exports.db.execute('UPDATE users SET votes = votes + ? WHERE id = ?', [votes, userID]);
        if (result.affectedRows === 0) {
            logger.error("[database] Rows were not 1 for updating user votes! Creating user...");
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
            logger.error("[database] Error adding votes to user, even after trying to create it!");
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

module.exports.createIncentive = async function (name, description) {
    return module.exports.db.execute('INSERT INTO `incentives` (`name`, `description`) VALUES (?, ?)', [name, description]);
}

module.exports.addVotesToIncentive = async function (rewardID, votes) {
    try {
        let [result] = await module.exports.db.execute('UPDATE incentives SET currentVotes = currentVotes + ? WHERE rewardID = ?', [votes, rewardID]);
        return result.affectedRows === 1;
    } catch (e) {
        logger.error(e);
        return false
    }
}

module.exports.addVotesToIncentiveByID = async function (id, votes) {
    try {
        let [result] = await module.exports.db.execute('UPDATE incentives SET currentVotes = currentVotes + ? WHERE id = ?', [votes, id]);
        return result.affectedRows === 1;
    } catch (e) {
        logger.error(e);
        return false
    }
}

module.exports.setIncentiveRewardID = async function (id, rewardID) {
    try {
        let [result] = await module.exports.db.execute('UPDATE incentives SET rewardID = ? WHERE id = ?', [rewardID, id]);
        return result.affectedRows === 1;
    } catch (e) {
        logger.error(e);
        return false
    }
}

module.exports.getIncentiveByRewardID = async function (rewardID) {
    let [rows] = await module.exports.db.execute('SELECT * FROM incentives WHERE rewardID = ?', [rewardID]);
    if (rows.length !== 1) {
        logger.error("[database] Found not exactly 1 Incentive for rewardID " + rewardID);
        return null
    } else {
        return rows[0]
    }
}

module.exports.getIncentiveByDatabaseID = async function (id) {
    let [rows] = await module.exports.db.execute('SELECT * FROM incentives WHERE id = ?', [id]);
    if (rows.length !== 1) {
        logger.error("[database] Found not exactly 1 Incentive for id " + id);
        return null
    } else {
        return rows[0]
    }
}

module.exports.getAllIncentives = async function () {
    let [rows] = await module.exports.db.execute('SELECT * FROM incentives');
    return rows;
}

module.exports.setIncentiveClosed = async function (id, closed) {
    try {
        let [result] = await module.exports.db.execute('UPDATE incentives SET isClosed = ? WHERE id = ?', [closed, id]);
        return result.affectedRows === 1;
    } catch (e) {
        logger.error(e);
        return false
    }
}

module.exports.deleteIncentive = async function (databaseID) {
    try {
        let [rows] = await module.exports.db.execute('DELETE FROM incentives WHERE id = ?', [databaseID]);
        return rows.affectedRows === 1;
    } catch (e) {
        logger.error(e);
        return false
    }
}
