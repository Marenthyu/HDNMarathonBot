'use strict';
let bot = require('../../chatbot');

module.exports = async function() {
    try {
        await bot.reloadCommands();
        return "Commands Reloaded!";
    } catch {
        return "Error reloading commands";
    }
}
