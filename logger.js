'use strict';

const winston = require('winston');
const util = require('util');

function pad(pad, str, padLeft) {
    if (typeof str === 'undefined')
        return pad;
    if (padLeft) {
        return (pad + str).slice(-pad.length);
    } else {
        return (str + pad).substring(0, pad.length);
    }
}

module.exports = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss.SSS'
        }),
        winston.format.printf(info => `[${info.timestamp}][${info.service}][${
            pad('     ', info.level)}] ${
            typeof info.message === 'string' ? info.message : util.inspect(info.message)
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
