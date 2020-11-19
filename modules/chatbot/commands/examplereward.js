'use strict';
let api = require('../../twitchapi');
let db = require('../../database');
let logger = require('../../logger');

module.exports = async function(args, tags) {
    if (!await db.isAdmin(tags['user-id'], true)) {
        return "This is an Admin-only command.";
    }
    try {
        await api.createReward({
            title: "An Example Reward",
            cost: 1,
            is_enabled: true
        });
        return "Created!"
    } catch (e) {
        logger.error(e.response ? e.response.body : e);
        if (e.response && e.response.body.message === "CREATE_CUSTOM_REWARD_DUPLICATE_REWARD") {
            return "Reward already existed!";
        } else {
            return "Error setting Creating example reward."
        }
    }
}
