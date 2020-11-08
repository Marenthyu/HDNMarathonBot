'use strict';
let bot = require('../../chatbot');

module.exports = async function() {
    try {
        await bot.reloadAnnouncements();
        return "Announcements Reloaded!";
    } catch {
        return "Error reloading Announcements";
    }
}
