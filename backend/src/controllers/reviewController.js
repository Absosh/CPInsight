const service = require('../services/contestReviewService');

async function getJob(req, res) {
  const job = await service.getJob(req.user.id, req.params.id);
  res.json({ job });
}

async function listJobs(req, res) {
  const jobs = await service.listJobs(req.user.id, req.query);
  res.json({ jobs });
}

async function latest(req, res) {
  const review = await service.latest(req.user.id);
  res.json({ review });
}

async function byContest(req, res) {
  const review = await service.byContest(req.user.id, req.params.contestId, req.query);
  res.json({ review });
}

async function status(req, res) {
  const reviewStatus = await service.statusByContest(req.user.id, req.params.contestId, req.query);
  res.json({ status: reviewStatus });
}

module.exports = {
  getJob,
  listJobs,
  latest,
  byContest,
  status
};
