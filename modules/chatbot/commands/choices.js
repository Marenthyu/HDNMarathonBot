'use strict';
let db = require('../../database');
let choices = require('../../choices');

module.exports = async function (args, tags) {
    if (args.length === 0) {
        if (await db.isAdmin(tags['user-id'], true)) {
            return "Available Admin commands: close, delete, info"
        }
        return "For choices, check the Channel Points Menu! Use their IDs to find out more: !choices info ID"
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
                    return await deleteChoice(args[1]);
                }
            }
            default: return "Unknown subcommand."
        }
    }
}

async function getInfo(id) {
    let choice = null;
    try {
        choice = await choices.getChoice(id);
        if (choice) {
            let retstring = "Choice " + choice.name + ": " + choice.description + " ["
            console.log("[debug] choices: " + JSON.stringify(choice.options));
            let optionstrings = [];
            for (const option of choice.options) {
                optionstrings.push(option.name + " (" + option.votes + ")");
            }
            if (optionstrings.length === 0) {
                optionstrings = ["No Options yet!"]
            }
            retstring += optionstrings.join(", ") + "]";
            return retstring
        }
    } catch {
        // no need to duplicate code, just swallow it.
    }
    return "Choice not found!";

}

async function create(args) {
    let combinedargs = args.join(" ");
    let commandargs = combinedargs.split(" | ");
    if (commandargs.length < 2) {
        return "Please provide at least a NAME and DESCRIPTION seperated by |"
    }
    let name = commandargs[0];
    let description = commandargs[1];
    let openEntry = false;
    let options = [];
    if (commandargs.length === 2 || commandargs[2] === "true") {
        openEntry = true;
    } else {
        options = commandargs.splice(2);
    }
    let IDOrReward = await choices.createChoice(name, description, openEntry);
    if (openEntry) {
        return "Open Entry Choice created with rewardID " + IDOrReward.id
    } else {
        await choices.addOptionsToChoice(IDOrReward, options);
        await choices.resyncRewards()
        return "Created Choice with Options and resynced rewards!"
    }
}

async function close(id) {
    await choices.closeChoice(id);
    return "Done."
}

async function deleteChoice(id) {
    await choices.deleteChoice(id);
    return "Done."
}
