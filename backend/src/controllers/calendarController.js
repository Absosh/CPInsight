const contestService = require("../services/contestService");

async function getContests(req, res, next) {
    try {
        console.log("=== DEBUGGING CONTEST SERVICE ===", contestService);
        const contests =
            await contestService.getCombinedContestCalendar();

        res.json(contests);
    } catch (err) {
        next(err);
    }
}

module.exports = {
    getContests
};