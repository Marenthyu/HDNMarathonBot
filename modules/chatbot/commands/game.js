'use strict';
let api = require('../../twitchapi');
let db = require('../../database');
let logger = require('../../logger');

module.exports = async function(args, tags) {
    if (!await db.isAdmin(tags['user-id'], true)) {
        return "This is an Admin-only command.";
    }
    if (args.length < 1) {
        return "You need to specify a Game.";
    }
    try {
        await api.setStreamGame(args.join(' '));
        return "Game Set!"
    } catch (e) {
        logger.error(e);
        return "Error setting Game. Try again."
    }
}
