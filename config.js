'use strict';
let db = require('./database');
let logger = require('./logger');

let fs = require('fs');
module.exports.config = {hasChatToken: false};

module.exports.refreshConfigFromDB = async function () {
    logger.info("Reloading Config values...");
    let [rows,] = await db.db.execute("SELECT * FROM config");
    for (let row of rows) {
        module.exports.config[row.name] = row.value;
    }
    if (module.exports.config['chatToken'] === null || module.exports.config['chatToken'] === undefined) {
        logger.warn("No Chat Token available yet, entering setup mode.");
    } else {
        module.exports.config['hasChatToken'] = true;
    }
}

let cfgfile = fs.readFileSync('hdnbot.cfg', 'utf8');
let cfglines = cfgfile.matchAll(/(?<key>\w+)=(?<value>[^\r\n]+)/g);
for (let line of cfglines) {
    module.exports.config[line.groups.key] = line.groups.value;
}
if (!module.exports.config.hasOwnProperty("dbhost")) {
    logger.error("Missing required Config Parameter dbhost. Please add it to the config.");
    process.exit(1);
}
if (!module.exports.config.hasOwnProperty("dbport")) {
    logger.error("Missing required Config Parameter dbport. Please add it to the config.");
    process.exit(1);
}
if (!module.exports.config.hasOwnProperty("dbuser")) {
    logger.error("Missing required Config Parameter dbuser. Please add it to the config.");
    process.exit(1);
}
if (!module.exports.config.hasOwnProperty("dbpass")) {
    logger.error("Missing required Config Parameter dbpass. Please add it to the config.");
    process.exit(1);
}
if (!module.exports.config.hasOwnProperty("dbname")) {
    logger.error("Missing required Config Parameter dbname. Please add it to the config.");
    process.exit(1);
}
if (!module.exports.config.hasOwnProperty("websiteport")) {
    logger.error("Missing required Config Parameter websiteport. Please add it to the config.");
    process.exit(1);
}
