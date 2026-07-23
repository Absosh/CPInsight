const HttpError = require('../utils/httpError');
const repository = require('../repositories/contestReviewRepository');

class ContestReviewService {
  constructor({ repo = repository } = {}) {
    this.repo = repo;
  }

  async getJob(userId, jobId) {
    const job = await this.repo.getJob(userId, jobId);
    if (!job) throw new HttpError(404, 'Contest review job not found', null, 'REVIEW_JOB_NOT_FOUND');
    return job;
  }

  listJobs(userId, query = {}) {
    return this.repo.listJobs(userId, {
      limit: Number(query.limit) || 50,
      status: query.status || null
    });
  }

  async latest(userId) {
    const review = await this.repo.latestReview(userId);
    if (!review) throw new HttpError(404, 'Contest review not found', null, 'REVIEW_NOT_FOUND');
    return review;
  }

  async statusByContest(userId, contestId) {
    const status = await this.repo.statusByContest(userId, contestId);
    if (!status) throw new HttpError(404, 'Contest review status not found', null, 'REVIEW_STATUS_NOT_FOUND');
    return status;
  }
}

module.exports = new ContestReviewService();
module.exports.ContestReviewService = ContestReviewService;
