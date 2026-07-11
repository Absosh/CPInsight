const express = require("express");
const controller = require("../controllers/calendarController");

const router = express.Router();

router.get("/calendar/contests", controller.getContests);

module.exports = router;