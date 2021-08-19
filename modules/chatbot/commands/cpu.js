'use strict';
let db = require('../../database');
let bot = require('../../chatbot');
let voters = [];
let timeoutDuration = 1000 * 60 * 60;
let voterTimeout = setTimeout(clearVoters, timeoutDuration); // once per hour. Cleared on reload, effectively.

module.exports = async function (args, tags) {
    if (args.length !== 1) {
        return "Vote for your favourite CPU once per hour by appending their name to this command! (Like this: !cpu vert)"
    } else {
        if (voters.includes(tags['user-id'])) {
            return "You already voted this hour! Try again later!";
        } else {
            if (args[0].toLowerCase().startsWith("hdn")) {
                args[0] = args[0].substring(3);
            }
            if (!["neptune", "blanc", "vert", "noire"].includes(args[0].toLowerCase())) {
                return "Hmm, I don't know that CPU. Are they from another Dimension?";
            } else {
                await db.addToCPUWar(args[0].toLowerCase());
                voters.push(tags['user-id']);
                return "Vote Cast for " + args[0] + "!"
            }
        }
    }
}

async function clearVoters() {
    voters = [];
    await bot.tell("You can now recast your votes for your favourite CPU! Shares are power!");
    voterTimeout = setTimeout(clearVoters, timeoutDuration);
}
