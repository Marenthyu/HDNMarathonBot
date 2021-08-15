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

module.exports.createChoice = async function (name, description, hasOpenEntry) {
    return module.exports.db.execute('INSERT INTO `choices` (`name`, `description`, `hasOpenEntry`) VALUES (?, ?, ?)', [name, description, hasOpenEntry ? 1 : 0]);
}

module.exports.getAllChoices = async function () {
    let [rows] = await module.exports.db.execute('SELECT * FROM choices');
    let retObject = [];
    for (let row of rows) {
        let [optionsRows] = await module.exports.db.execute('SELECT * FROM choice_options WHERE choiceID = ? ORDER BY votes DESC', [row.id]);
        row['options'] = optionsRows;
        retObject.push(row);
    }
    return retObject;
}

module.exports.getChoiceByRewardID = async function (rewardID) {
    let [rows] = await module.exports.db.execute('SELECT * FROM choices WHERE rewardID = ?', [rewardID]);
    if (rows.length !== 1) {
        return false
    } else {
        return rows[0];
    }
}

module.exports.setOptionRewardID = async function (id, rewardID) {
    try {
        let [result] = await module.exports.db.execute('UPDATE choice_options SET rewardID = ? WHERE id = ?', [rewardID, id]);
        return result.affectedRows === 1;
    } catch (e) {
        logger.error(e);
        return false
    }
}

module.exports.setChoiceRewardID = async function (id, rewardID) {
    try {
        let [result] = await module.exports.db.execute('UPDATE choices SET rewardID = ? WHERE id = ?', [rewardID, id]);
        return result.affectedRows === 1;
    } catch (e) {
        logger.error(e);
        return false
    }
}

/***
 * Add votes to a free entry option
 * @param rewardID The reward ID of the Choice that was redeemed
 * @param votes The number of votes to add to the option
 * @param user_input The "name" of the option to add/increase/vote for or create
 * @returns {Promise<boolean|number>} Returns false on error,
 * returns number of affected rows on success - 1 row means new option added, 2 means option updated.
 */
module.exports.addVotesToFreeEntry = async function (rewardID, votes, user_input) {
    let choice = await module.exports.getChoiceByRewardID(rewardID);
    try {
        let [result] = await module.exports.db.execute('INSERT INTO `choice_options`(`choiceID`, `name`, `votes`) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE `votes` = `votes` + ?', [choice.id, user_input, votes]);
        return result.affectedRows;
    } catch (e) {
        logger.error(e);
        return false
    }
}

module.exports.addVotesToOption = async function (rewardID, votes) {
    try {
        let [result] = await module.exports.db.execute('UPDATE choice_options SET votes = votes + ? WHERE rewardID = ?', [votes, rewardID]);
        return result.affectedRows === 1;
    } catch (e) {
        logger.error(e);
        return false
    }
}

module.exports.getChoiceByDatabaseID = async function (id) {
    let [rows] = await module.exports.db.execute('SELECT * FROM choices WHERE id = ?', [id]);
    if (rows.length !== 1) {
        logger.error("[database] Found not exactly 1 Choice for id " + id);
        return null
    } else {
        rows[0].options = await module.exports.getOptionsByDatabaseChoiceID(id);
        return rows[0]
    }
}

module.exports.getOptionsByDatabaseChoiceID = async function (databaseChoiceID) {
    let [rows] = await module.exports.db.execute('SELECT * FROM choice_options WHERE choiceID = ?', [databaseChoiceID]);
    return rows
}

module.exports.addOptionToChoice = async function (databaseChoiceID, optionName) {
    try {
        let [result] = await module.exports.db.execute('INSERT INTO `choice_options`(`choiceID`, `name`) VALUES (?, ?)', [databaseChoiceID, optionName]);
        return result.affectedRows;
    } catch (e) {
        logger.error(e);
        return false
    }
}

module.exports.setChoiceClosed = async function (id, closed) {
    try {
        let [result] = await module.exports.db.execute('UPDATE choices SET isClosed = ? WHERE id = ?', [closed, id]);
        return result.affectedRows === 1;
    } catch (e) {
        logger.error(e);
        return false
    }
}

module.exports.deleteChoice = async function (databaseID) {
    try {
        let [rows] = await module.exports.db.execute('DELETE FROM choices WHERE id = ?', [databaseID]);
        return rows.affectedRows === 1;
    } catch (e) {
        logger.error(e);
        return false
    }
}
