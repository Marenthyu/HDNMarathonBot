'use strict';
let db = require('../../database');
let pubsub = require('../../pubsub');
let logger = require('../../logger');

const SUBCOMMANDS_MESSAGE = "Supported subcommands: reconnect";

module.exports = async function(args, tags) {
    if (!await db.isAdmin(tags['user-id'], true)) {
        return "This is an Admin-only command.";
    }
    if (args.length < 1) {
        return SUBCOMMANDS_MESSAGE;
    }
    switch (args[0]) {
        case "reconnect": {
            try {
                await pubsub.restart();
                return "Pubsub connection restarted."
            } catch (e) {
                logger.error(e);
                return "Error During reconnect."
            }
        }

        default: {
            return SUBCOMMANDS_MESSAGE;
        }
    }
}
