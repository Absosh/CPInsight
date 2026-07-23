class ContestReconstructor {
  reconstruct(session) {
    if (session.sessionType !== 'contest') return null;
    const duration = Math.max(1, session.durationMs);
    const phases = [
      { name: 'opening', startRatio: 0, endRatio: 0.2 },
      { name: 'middle', startRatio: 0.2, endRatio: 0.75 },
      { name: 'late', startRatio: 0.75, endRatio: 1 }
    ].map((phase) => ({
      ...phase,
      startedAtOffsetMs: Math.round(duration * phase.startRatio),
      endedAtOffsetMs: Math.round(duration * phase.endRatio)
    }));

    const problemSequence = session.problemTimeline.map((item, index) => ({
      index,
      problemId: item.problemId,
      startedAt: item.startedAt,
      durationMs: item.durationMs
    }));
    const tabHidden = session.focusTimeline.filter((item) => item.type === 'TAB_HIDDEN').length;
    const tabVisible = session.focusTimeline.filter((item) => item.type === 'TAB_VISIBLE').length;
    const idlePeriods = [];
    for (let index = 1; index < session.events.length; index += 1) {
      const gap = Date.parse(session.events[index].timestamp) - Date.parse(session.events[index - 1].timestamp);
      if (gap >= 5 * 60 * 1000) {
        idlePeriods.push({
          startedAt: session.events[index - 1].timestamp,
          endedAt: session.events[index].timestamp,
          durationMs: gap
        });
      }
    }

    return Object.freeze({
      sourceSessionId: session.sourceSessionId,
      contestId: session.contestId,
      phases,
      problemSequence,
      timeAllocation: session.problemTimeline.map((item) => ({
        problemId: item.problemId,
        durationMs: item.durationMs,
        ratio: item.durationMs / duration
      })),
      navigationHistory: session.navigationTimeline,
      submissionChronology: session.submissionTimeline,
      attentionShifts: Math.min(tabHidden, tabVisible) + Math.abs(tabHidden - tabVisible),
      idlePeriods,
      recoveryPeriods: idlePeriods.filter((item) => item.durationMs <= 15 * 60 * 1000),
      pressurePeriods: phases.filter((phase) => phase.name === 'late')
    });
  }
}

module.exports = { ContestReconstructor };
