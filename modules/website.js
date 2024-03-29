'use strict';

const http = require('http');
const url = require('url');
const got = require('got');
const fs = require("fs");

let logger = require('./logger');
let config = require('./config');
let chatbot = require('./chatbot');
let auth = require("./auth");
let choices = require('./choices');
let incentives = require('./incentives');
let db = require('./database');

const trackertemplate = fs.readFileSync('modules/html/tracker.html', 'utf-8');


const httpstring = config['http'] ? 'http://' : 'https://';

module.exports.startWebsite = function () {
    logger.info("[website] Website listening on port " + config.config['websiteport'] + "...");
    http.createServer(((req, res) => {
        let q = url.parse(req.url, true);
        if (websiteEndpoints.hasOwnProperty(q.pathname.substring(1))) {
            websiteEndpoints[q.pathname.substring(1)](req, res, q);
        } else {
            defaultWebsiteEndpoint(req, res);
        }
    })).listen(parseInt(config.config['websiteport']));
}

function httpError(res, code, reason, body, headers) {
    if (!body) {
        body = JSON.stringify({error: "default error."});
    }
    if (typeof body !== 'string') {
        body = JSON.stringify(body);
    }
    if (!headers) {
        headers = {'Content-Type': 'application/json'};
    }
    if (!headers.hasOwnProperty('Content-Type')) {
        try {
            JSON.parse(body);
            headers['Content-Type'] = 'application/json';
        } catch (e) {
            headers['Content-Type'] = 'text/plain';
        }
    }
    res.writeHead(code, reason, headers);
    res.end(body);
}

const websiteEndpoints = {
    'twitchcallback': twitchCallback,
    'chatlogin': chatlogin,
    'broadcasterlogin': broadcasterlogin,
    'tracker': tracker
}

async function twitchCallback(req, res, q) {
    let state = q.query.state;
    let code = q.query.code;
    let error = q.query.error;
    let error_description = q.query.error_description;
    if (error && error_description) {
        httpError(res, 400, 'Client Error', 'Error Authorizing with Twitch: ' + error_description + "\nError Code: " + error);
    } else if (!state || !code) {
        httpError(res, 400, 'Client Error', 'Missing required parameter. You shouldn\'t see this.');
    } else if (state === 'chatToken' || state === 'broadcasterToken') {
        res.writeHead(200, 'OK');
        res.end("Got your token, checking with Twitch and saving to Database. You may close this tab.");
        let token;
        let refresh_token;
        let expires_in;
        try {
            let myURL = new URL((config.config['http'] === 'true' ? 'http' : 'https') + '://' + (req.headers['x-forwarded-host'] ? req.headers['x-forwarded-host'] : req.headers['host']) + req.url)
            let response = await got({
                method: 'POST', url: `https://id.twitch.tv/oauth2/token?client_id=${
                    encodeURIComponent(config.config['clientID'])}&client_secret=${
                    encodeURIComponent(config.config['clientSecret'])}&code=${
                    encodeURIComponent(code)}&grant_type=authorization_code&redirect_uri=${
                    encodeURIComponent(myURL.origin + myURL.pathname)}`,
                responseType: "json"
            });
            token = response.body.access_token;
            refresh_token = response.body.refresh_token;
            expires_in = response.body.expires_in;
        } catch (e) {
            logger.error("[website] Error getting token from twitch:");
            logger.error(e);
            logger.error(e.response.body);
            return
        }
        logger.info("[website] Got token from Twitch - checking username for expected value...");
        let isChatToken = state === 'chatToken';
        try {
            let userResponse = await got({
                method: "GET",
                url: "https://api.twitch.tv/helix/users",
                responseType: "json",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Client-ID": config.config['clientID']
                }
            });
            if (userResponse.body.data.length !== 1) {
                logger.error("[website] Unexpected response length for user verification - not setting token.");
                return
            }
            let nameToCompare = isChatToken ? config.config["userName"] : config.config["channelName"];
            if (userResponse.body.data[0].login !== nameToCompare) {
                logger.error("[website] Username of token did not match acquired token - not setting token");
                return
            }
        } catch (e) {
            logger.error("[website] Error verifying user from token on twitch:");
            logger.error(e);
            logger.error(e.response.body);
            return
        }
        logger.info("[website] New Token verified - updating database...");
        if (isChatToken) {
            await auth.setChatToken(token, refresh_token, expires_in)
        } else {
            await auth.setBroadcasterToken(token, refresh_token, expires_in);
        }

        let hadChatToken = config.config['hasChatToken'];
        await config.refreshConfigFromDB();
        if (hadChatToken) {
            if (isChatToken) {
                logger.info("[website] Note: the updated chatToken will only take effect upon re-login, but will be used for requests already.");
            }
        } else {
            await chatbot.joinChat();
        }
    } else {
        httpError(res, 400, 'Client Error', 'Invalid state. You shouldn\'t see this.');
    }

}

async function chatlogin(req, res) {
    let redirectURI = `${httpstring}${req.headers['x-forwarded-host'] ? req.headers['x-forwarded-host'] : req.headers['host']}/twitchcallback`;
    httpError(res, 302, 'Redirect', 'You should get redirected.', {'Location': `https://id.twitch.tv/oauth2/authorize?client_id=${config.config['clientID']}&redirect_uri=${redirectURI}&response_type=code&scope=chat:read%20chat:edit%20whispers:read%20whispers:edit&state=chatToken`});
}

async function broadcasterlogin(req, res) {
    let redirectURI = `${httpstring}${req.headers['x-forwarded-host'] ? req.headers['x-forwarded-host'] : req.headers['host']}/twitchcallback`;
    httpError(res, 302, 'Redirect', 'You should get redirected.', {'Location': `https://id.twitch.tv/oauth2/authorize?client_id=${config.config['clientID']}&redirect_uri=${redirectURI}&response_type=code&scope=chat%3Aread+chat%3Aedit+whispers%3Aread+whispers%3Aedit+user%3Aedit%3Abroadcast+channel%3Aread%3Aredemptions+channel%3Amanage%3Aredemptions+channel%3Amanage%3Aschedule&state=broadcasterToken`});
}

function defaultWebsiteEndpoint(req, res) {
    httpError(res, 404, 'Not Found');
}

async function tracker(req, res, query) {
    let currentChoices = await choices.getAllChoices();
    let currentIncentives = await incentives.getAllIncentives();
    if (query.query.type === "tracker") {
        // Dabom's Java Tracker
        let wars = [];
        for (let choice of currentChoices) {
            let parsedOptions = [];
            for (let option of choice.options) {
                parsedOptions.push({
                    choice: option.name,
                    amount: option.votes
                });
            }
            wars.push({
                id: choice.id,
                title: choice.name,
                description: choice.description,
                status: choice.isClosed ? "closed" : "open",
                openEntry: choice.hasOpenEntry,
                choices: parsedOptions
            });
        }
        let incentives = [];
        for (let incentive of currentIncentives) {
            incentives.push({
                id: incentive.id,
                title: incentive.name,
                status: incentive.isClosed ? "closed" : "open",
                amount: incentive.currentVotes,
                required: incentive.maxVotes
            });
        }
        let cpuwar = await db.getCPUWar();
        let cpus = [];
        for (let cpu of cpuwar) {
            cpus.push({cpu: cpu.name, votes: cpu.votes});
        }
        res.writeHead(200, "OK", {"Content-Type": "application/json;charset=utf-8"});
        res.end(JSON.stringify({wars: wars, incentives: incentives, cpuwar: cpus}));
    } else {
        let retString = "<h1>The Slightly Less Lazy Tracker™</h1><br><div><h2>INCENTIVES:</h2><br>";

        for (let incentive of currentIncentives) {
            retString += "<div class=\"p-3 border bg-light incentive\"><div class=\"badge rounded-pill bg-primary\">ID " + incentive.id + "</div> " + incentive.name + " - " + incentive.description + ": <div class=\"badge bg-" + (incentive.currentVotes < incentive.maxVotes ? "warning" : "success") + "\">" + incentive.currentVotes + "/" + incentive.maxVotes + "</div>" + (incentive.isClosed ? " <div class=\"badge bg-danger\">CLOSED</div><br>" : "<br>");
            retString += "</div>"
        }

        retString += "</div><div><br><h2>CHOICES:</h2><br>";

        for (let choice of currentChoices) {
            retString += "<div class=\"p-3 border bg-light choice\"><div class=\"badge rounded-pill bg-primary\">ID " + choice.id + "</div> " + choice.name + " - " + choice.description + " " + (choice.hasOpenEntry ? " <div class=\"badge bg-success\">OPEN ENTRY</div>" : "") + (choice.isClosed ? " <div class=\"badge bg-danger\">CLOSED</div><br>" : "<br>");
            retString += "<div class=\"row\">";
            let first = true;
            for (let option of choice.options) {
                retString += "<div class=\"m-2 p-2 border light choice\">" + option.name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;') + " <div class=\"badge bg-" + (first ? "success" : "warning") + "\">" + option.votes + "</div></div>";
                first = false;
            }
            retString += "</div></div>";
        }

        retString += "</div>"

        res.writeHead(200, "OK", {"Content-Type": "text/html;charset=utf-8"});
        res.end(trackertemplate.replace("{{body}}", retString));
    }

}
