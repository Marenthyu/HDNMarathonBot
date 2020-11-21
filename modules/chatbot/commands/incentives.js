'use strict';
let db = require('../../database');
let incentives = require('../../incentives');

module.exports = async function (args, tags) {
    if (args.length === 0) {
        if (await db.isAdmin(tags['user-id'], true)) {
            return "Available Admin commands: create, close, delete"
        }
        return "For incentives, check the Channel Points Menu! Use their IDs to find out more: !incentives info ID"
    } else {
        switch (args[0].toLowerCase()) {
            case "info": {
                if (args.length !== 2) {
                    return "Please specify exactly one ID."
                } else {
                    return await getInfo(args[1]);
                }
            }
            case "create": {
                if (!await db.isAdmin(tags['user-id'], true)) {
                    return "Admin-Only Command.";
                }
                if (args.length < 3 || !args.includes('|')) {
                    return "Please specify: create NAME | DESCRIPTION"
                } else {
                    return await create(args.slice(1));
                }
            }
            case "close": {
                if (!await db.isAdmin(tags['user-id'], true)) {
                    return "Admin-Only Command.";
                }
                if (args.length !== 2) {
                    return "Please specify exactly 1 ID."
                } else {
                    return await close(args[1]);
                }
            }

            case "delete": {
                if (!await db.isAdmin(tags['user-id'], true)) {
                    return "Admin-Only Command.";
                }
                if (args.length !== 2) {
                    return "Please specify exactly 1 ID."
                } else {
                    return await deleteIncentive(args[1]);
                }
            }
        }
    }
}

async function getInfo(id) {
    let incentive = null;
    try {
        incentive = await incentives.getIncentive(id);
        if (incentive) {
            return "Incentive " + incentive.name + ": " + incentive.description +
                " [" + incentive.currentVotes + "/" + incentive.maxVotes + " Votes]";
        }
    } catch {
        // no need to duplicate code, just swallow it.
    }
    return "Incentive not found!";

}

async function create(args) {
    let combinedargs = args.join(" ");
    let [name, description] = combinedargs.split(" | ");
    let reward = await incentives.createIncentive(name, description);
    return "Created Incentive with rewardID " + reward.id;
}

async function close(id) {
    await incentives.closeIncentive(id);
    return "Done."
}

async function deleteIncentive(id) {
    await incentives.deleteIncentive(id);
    return "Done."
}
