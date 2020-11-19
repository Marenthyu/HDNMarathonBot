'use strict';
let api = require('../../twitchapi');
let db = require('../../database');
let logger = require('../../logger');

module.exports = async function (args, tags) {
    if (!await db.isAdmin(tags['user-id'], true)) {
        return "This is an Admin-only command.";
    }
    try {
        return JSON.stringify(await api.getAllRewards());
    } catch (e) {
        logger.error(e.response ? e.response.body : e);
        return "Error getting all rewards."
    }
}
