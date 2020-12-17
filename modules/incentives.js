'use strict';
let logger = require('./logger');
let db = require('./database');
let config = require('./config');
let api = require('./twitchapi');
let pubsub = require('./pubsub');
let bot = require('./chatbot');

module.exports.initialize = async function () {
    await module.exports.resyncRewards();
}

module.exports.resyncRewards = async function () {
    if (!config.config['hasBroadcasterToken']) {
        logger.error("[incentives] Can't reasonably check Rewards without Broadcaster token. Skipping Resync.");
        return
    }
    let rewards = await api.getAllRewards();
    let rewardIDs = [];
    let rewardsByIDs = {};
    for (let reward of rewards) {
        rewardIDs.push(reward.id);
        rewardsByIDs[reward.id] = reward;
    }
    let incentives = await db.getAllIncentives();
    for (let incentive of incentives) {
        if (incentive.rewardID === "0" || !rewardIDs.includes(incentive.rewardID)) {
            let newReward = await api.createReward(
                {
                    'title': incentive.name,
                    'prompt': incentive.description + ' - ID: ' + incentive.id,
                    'cost': 100,
                    'is_disabled': incentive.currentVotes >= incentive.maxVotes || incentive.isClosed,
                    'should_redemptions_skip_request_queue': true
                });
            await db.setIncentiveRewardID(incentive.id, newReward.id);
            incentive.rewardID = newReward.id;
            logger.info("[incentives] Created Reward " + newReward.id + " for incentive " + incentive.name);
        } else {
            if (incentive.currentVotes >= incentive.maxVotes || incentive.isClosed) {
                if (!rewardsByIDs[incentive.rewardID].is_paused) {
                    await api.pauseReward(incentive.rewardID);
                }
            } else if (rewardsByIDs[incentive.rewardID].is_paused && !incentive.isClosed) {
                await api.resumeReward(incentive.rewardID);
            }
            logger.info("[incentives] Found Reward for Incentive " + incentive.name);
        }
        await pubsub.addChannelPointsListener(incentive.rewardID, 'incentiveshandler', voteRedemptionHandler);
    }
    logger.info("[incentives] All Incentives Synced with Rewards");
};

module.exports.createIncentive = async function (name, description) {
    let newID = (await db.createIncentive(name, description))[0].insertId;
    let newReward = await api.createReward({'title': name, 'prompt': description + ' - ID: ' + newID, 'cost': 100,
        'should_redemptions_skip_request_queue': true});
    await db.setIncentiveRewardID(newID, newReward.id);
    await pubsub.addChannelPointsListener(newReward.id, 'incentiveshandler', voteRedemptionHandler);
    return newReward
}

async function voteRedemptionHandler(redemption) {
    let success = await db.addVotesToIncentive(redemption.reward.id, 1);
    if (!success) {
        logger.info("[incentives] Failed to cast vote.");
    } else {
        logger.info("[incentives] Vote Casted!");
        let currentStatus = await db.getIncentiveByRewardID(redemption.reward.id);
        if (currentStatus.currentVotes >= currentStatus.maxVotes) {
            await api.pauseReward(redemption.reward.id);
            logger.info("[incentive] Incentive " + currentStatus.name + " has been met!");
            await bot.tell("The " + currentStatus.name + " incentive has been met!");
        } else {
            let percent = (currentStatus.currentVotes / currentStatus.maxVotes) * 100;
            let oldPercent = ((currentStatus.currentVotes-1) / currentStatus.maxVotes) * 100;
            let percentages = [25, 50, 75];
            for (let perc of percentages) {
                if (oldPercent < perc && percent >= perc) {
                    await bot.tell(currentStatus.name + " is " + percent + "% complete! Use Channel Points to push it forward!");
                }
            }
        }
    }
}

module.exports.getIncentive = async function(id) {
    return db.getIncentiveByDatabaseID(id);
}

module.exports.closeIncentive = async function(databaseID) {
    let rewardID = (await db.getIncentiveByDatabaseID(databaseID)).rewardID;
    await api.pauseReward(rewardID);
    return db.setIncentiveClosed(databaseID, true);
}

module.exports.deleteIncentive = async function(databaseID) {
    let rewardID = (await db.getIncentiveByDatabaseID(databaseID)).rewardID;
    await api.deleteReward(rewardID);
    return db.deleteIncentive(databaseID);
}

module.exports.getAllIncentives = async function() {
    return db.getAllIncentives();
}
