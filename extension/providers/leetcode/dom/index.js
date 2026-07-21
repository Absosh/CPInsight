import { ActivityExtractor } from './activity-extractor.js';
import { ContestExtractor } from './contest-extractor.js';
import { ProfileExtractor } from './profile-extractor.js';
import { StatsExtractor } from './stats-extractor.js';
import { SubmissionExtractor } from './submission-extractor.js';
import { waitForDomSettled } from './mutation-observer.js';

export class LeetCodeDomExtractionService {
  constructor({ domReadyTimeoutMs } = {}) {
    this.domReadyTimeoutMs = domReadyTimeoutMs;
    this.extractors = {
      profile: new ProfileExtractor(),
      submissions: new SubmissionExtractor(),
      contests: new ContestExtractor(),
      stats: new StatsExtractor(),
      activity: new ActivityExtractor()
    };
  }

  async extractAll() {
    await waitForDomSettled({ timeoutMs: this.domReadyTimeoutMs });
    return {
      profile: this.extractors.profile.extract(),
      submissions: this.extractors.submissions.extract(),
      contests: this.extractors.contests.extract(),
      stats: this.extractors.stats.extract(),
      activity: this.extractors.activity.extract()
    };
  }
}
