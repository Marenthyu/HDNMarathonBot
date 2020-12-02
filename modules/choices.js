'use strict';
let logger = require('./logger');
let db = require('./database');
let config = require('./config');
let api = require('./twitchapi');
let pubsub = require('./pubsub');

module.exports.initialize = async function () {
    await module.exports.resyncRewards();
}

module.exports.resyncRewards = async function () {
    if (!config.config['hasBroadcasterToken']) {
        logger.error("[choices] Can't reasonably check Rewards without Broadcaster token. Skipping Resync.");
        return
    }
    let rewards = await api.getAllRewards();
    let rewardIDs = [];
    let rewardsByIDs = {};
    for (let reward of rewards) {
        rewardIDs.push(reward.id);
        rewardsByIDs[reward.id] = reward;
    }
    let choices = await db.getAllChoices();
    for (let choice of choices) {

        if (!choice.hasOpenEntry) {
            for (let option of choice.options) {
                if (option.rewardID === "0" || !rewardIDs.includes(option.rewardID)) {
                    let newReward = await api.createReward(
                        {
                            'title': choice.name + ' - ' + option.name,
                            'prompt': 'Vote for "' + option.description + '" in the ' + choice.name + ' choice - ID: ' + option.id,
                            'cost': 100,
                            'is_disabled': choice.isClosed === 1,
                            'should_redemptions_skip_request_queue': true
                        });
                    await db.setOptionRewardID(option.id, newReward.id);
                    option.rewardID = newReward.id;
                    logger.info("[choices] Created Reward " + newReward.id + " for option " + option.name);
                } else {
                    if (!choice.isClosed) {
                        if (rewardsByIDs[option.rewardID].is_paused) {
                            await api.resumeReward(option.rewardID);
                        }
                    } else {
                        if (!rewardsByIDs[option.rewardID].is_paused) {
                            await api.pauseReward(option.rewardID);
                        }
                    }
                    logger.info("[choices] Found Reward for Option " + option.name);
                }
                await pubsub.addChannelPointsListener(option.rewardID, 'optionshandler', voteRedemptionHandler);
            }
        } else {
            if (choice.rewardID === "0" || !rewardIDs.includes(choice.rewardID)) {
                let newReward = await api.createReward(
                    {
                        'title': choice.name + ' - open Entry!',
                        'prompt': choice.description + ' - open Entry! ID: ' + choice.id,
                        'cost': 100,
                        'is_user_input_required': true,
                        'is_disabled': choice.isClosed === 1,
                        'should_redemptions_skip_request_queue': true
                    });
                await db.setChoiceRewardID(choice.id, newReward.id);
                choice.rewardID = newReward.id;
                logger.info("[choices] Created Reward " + newReward.id + " for Open Entry Choice " + choice.name);
            } else {
                if (!choice.isClosed) {
                    if (rewardsByIDs[choice.rewardID].is_paused) {
                        await api.resumeReward(choice.rewardID);
                    }
                } else {
                    if (!rewardsByIDs[choice.rewardID].is_paused) {
                        await api.pauseReward(choice.rewardID);
                    }
                }
                logger.info("[choices] Found Reward for Choice " + choice.name);
            }
            await pubsub.addChannelPointsListener(choice.rewardID, 'choiceshandler', voteRedemptionHandler);
        }
    }
    logger.info("[choices] All Choices Synced with Rewards");
};

module.exports.createChoice = async function (name, description, hasOpenEntry) {
    let newID = (await db.createChoice(name, description, hasOpenEntry))[0].insertId;
    if (hasOpenEntry) {
        let newReward = await api.createReward({
            'title': name + ' - open Entry!',
            'prompt': description + ' - open Entry! ID: ' + newID,
            'cost': 100,
            'is_user_input_required': true,
            'is_disabled': false,
            'should_redemptions_skip_request_queue': true
        });
        await db.setChoiceRewardID(newID, newReward.id);
        await pubsub.addChannelPointsListener(newReward.id, 'choiceshandler', voteRedemptionHandler);
        return newReward
    } else {
        return newID
    }
}

async function voteRedemptionHandler(redemption) {
    let isFreeEntry = redemption.reward.is_user_input_required;
    let success;
    success =
        isFreeEntry ?
            await db.addVotesToFreeEntry(redemption.reward.id, 1, redemption.user_input) :
            await db.addVotesToOption(redemption.reward.id, 1);
    if (!success) {
        logger.info("[choices] Failed to cast vote.");
    } else {
        logger.info("[choices] Vote Casted!");
    }
}

module.exports.getChoice = async function (id) {
    return db.getChoiceByDatabaseID(id);
}

module.exports.closeChoice = async function (databaseID) {
    let choice = await db.getChoiceByDatabaseID(databaseID);
    let rewardIDs = [];
    if (choice.hasOpenEntry === 1) {
        rewardIDs = [choice.rewardID];
    } else {
        let options = await db.getOptionsByDatabaseChoiceID(databaseID);
        for (let option of options) {
            rewardIDs.push(option.rewardID);
        }
    }
    for (let rewardID of rewardIDs) {
        await api.pauseReward(rewardID);
    }
    return db.setChoiceClosed(databaseID, true);
}

module.exports.deleteChoice = async function (databaseID) {
    let choice = await db.getChoiceByDatabaseID(databaseID);
    let rewardIDs = [];
    if (choice.hasOpenEntry === 1) {
        rewardIDs = [choice.rewardID];
    } else {
        let options = await db.getOptionsByDatabaseChoiceID(databaseID);
        for (let option of options) {
            rewardIDs.push(option.rewardID);
        }
    }
    for (let rewardID of rewardIDs) {
        await api.deleteReward(rewardID);
    }
    return db.deleteChoice(databaseID);
}
