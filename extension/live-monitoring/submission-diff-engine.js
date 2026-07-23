const verdictEventMap = Object.freeze({
  OK: 'accepted',
  WRONG_ANSWER: 'wrong_answer',
  TIME_LIMIT_EXCEEDED: 'time_limit',
  RUNTIME_ERROR: 'runtime_error',
  COMPILATION_ERROR: 'compilation_error'
});

function problemId(submission) {
  const problem = submission.problem || {};
  return [problem.contestId || submission.contestId, problem.index].filter(Boolean).join('-');
}

export class SubmissionDiffEngine {
  diff(previous = {}, snapshot = {}) {
    const previousSubmissions = new Map((previous.submissions || []).map((submission) => [submission.id, submission]));
    const events = [];
    for (const submission of snapshot.submissions || []) {
      const existing = previousSubmissions.get(submission.id);
      const verdict = submission.verdict || 'TESTING';
      const id = String(submission.id);
      if (!existing) {
        events.push({
          dedupeKey: `submission-created:${id}`,
          eventType: 'submission_created',
          problemId: problemId(submission),
          timestamp: new Date((submission.creationTimeSeconds || Date.now() / 1000) * 1000).toISOString(),
          metadata: { submissionId: id, verdict, language: submission.programmingLanguage || null }
        });
      }
      if (!existing || existing.verdict !== verdict) {
        events.push({
          dedupeKey: `submission-verdict:${id}:${verdict}`,
          eventType: 'submission_verdict',
          problemId: problemId(submission),
          timestamp: new Date().toISOString(),
          metadata: { submissionId: id, verdict }
        });
        if (verdictEventMap[verdict]) {
          events.push({
            dedupeKey: `submission-result:${id}:${verdict}`,
            eventType: verdictEventMap[verdict],
            problemId: problemId(submission),
            timestamp: new Date().toISOString(),
            metadata: { submissionId: id, verdict }
          });
        }
        if (verdict === 'OK') {
          events.push({
            dedupeKey: `problem-solved:${problemId(submission)}`,
            eventType: 'problem_solved',
            problemId: problemId(submission),
            timestamp: new Date().toISOString(),
            metadata: { submissionId: id }
          });
        }
      }
    }
    const previousRank = previous.standings?.rank;
    const nextRank = snapshot.standings?.rank;
    if (nextRank && previousRank && nextRank !== previousRank) {
      events.push({
        dedupeKey: `rank-changed:${nextRank}:${snapshot.standings?.points || 0}`,
        eventType: 'rank_changed',
        timestamp: new Date().toISOString(),
        metadata: { previousRank, rank: nextRank, points: snapshot.standings?.points || 0 }
      });
    }
    return events;
  }
}
