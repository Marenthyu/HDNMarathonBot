'use strict';
let bot = require('../../chatbot');
let db = require('../../database');

module.exports = async function(args, tags) {
    if (!await db.isAdmin(tags['user-id'], true)) {
        return "This is an Admin-only command.";
    }
    try {
        await bot.reloadCommands();
        return "Commands Reloaded!";
    } catch {
        return "Error reloading Commands";
    }
}
