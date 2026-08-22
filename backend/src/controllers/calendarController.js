const contestService = require("../services/contestService");

async function getContests(req, res, next) {
    try {
        const forceRefresh = req.query.fresh === "1" || req.query.fresh === "true";
        const contests =
            await contestService.getCombinedContestCalendar({ forceRefresh });

        res.json(contests);
    } catch (err) {
        next(err);
    }
}

module.exports = {
    getContests
};
