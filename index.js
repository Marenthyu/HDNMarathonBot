'use strict';
const got = require('got');
const tmi = require('tmi');
const mysql = require('mysql2/promise');
const async = require('async');
const fs = require('fs');

const winston = require('winston');

function pad(pad, str, padLeft) {
    if (typeof str === 'undefined')
        return pad;
    if (padLeft) {
        return (pad + str).slice(-pad.length);
    } else {
        return (str + pad).substring(0, pad.length);
    }
}

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss.ms'
        }),
        winston.format.printf(info => `[${info.timestamp}][${info.service}][${
            pad('     ', info.level)}] ${
            typeof info.message === 'string' ? info.message : JSON.stringify(info.message)
        }`)
    ),
    defaultMeta: {service: 'hdnbot'},
    transports: [
        //
        // - Write all logs with level `error` and below to `error.log`
        // - Write all logs with level `info` and below to `combined.log`
        //
        new winston.transports.File({filename: 'hdn-error.log', level: 'error'}),
        new winston.transports.File({filename: 'hdn-combined.log'}),
        new winston.transports.Console({level: 'debug'})
    ],
});

let cfgfile = fs.readFileSync('hdnbot.cfg', 'utf8');
let cfglines = cfgfile.matchAll(/(?<key>\w+)=(?<value>[^\r\n]+)/g);
let config = {};
for (let line of cfglines) {
    config[line.groups.key] = line.groups.value;
}
if (!config.hasOwnProperty("dbhost")) {
    logger.error("Missing required Config Parameter dbhost. Please add it to the config.");
    process.exit(1);
}
if (!config.hasOwnProperty("dbport")) {
    logger.error("Missing required Config Parameter dbport. Please add it to the config.");
    process.exit(1);
}
if (!config.hasOwnProperty("dbuser")) {
    logger.error("Missing required Config Parameter dbuser. Please add it to the config.");
    process.exit(1);
}
if (!config.hasOwnProperty("dbpass")) {
    logger.error("Missing required Config Parameter dbpass. Please add it to the config.");
    process.exit(1);
}
if (!config.hasOwnProperty("dbname")) {
    logger.error("Missing required Config Parameter dbname. Please add it to the config.");
    process.exit(1);
}

let db;

async function connectToDB() {
    db = await mysql.createConnection({
        host: config['dbhost'], user: config['dbuser'], database: config['dbname'],
        port: config['dbport'], password: config['dbpass']
    });
}

async function readConfig() {
    let [rows,] = await db.execute("SELECT * FROM config");
    for (let row of rows) {
        config[row.name] = row.value;
    }
    logger.debug("Config Loaded:");
    logger.debug(config);
}

async.series([connectToDB, readConfig]).catch((error) => {
    logger.error("Unhandled top-level exception:");
    logger.error(error);
    process.exit(2);
}).then(() => {
    logger.info("All done!");
    process.exit(0);
});
