const crypto = require('crypto');
const { INTENTS, INTENT_DEFINITIONS } = require('./intentTaxonomy');

const RULES = Object.freeze([
  { intent: INTENTS.EVIDENCE_REQUEST, weight: 7, patterns: [/\bwhy do you think\b/i, /\bshow (me )?(the )?evidence\b/i, /\bprove\b/i, /\bevidence\b/i] },
  { intent: INTENTS.DIAGNOSTIC, weight: 3, patterns: [/\bwhy\b/i, /\bcause\b/i, /\breason\b/i, /\bdrop(ped)?\b/i, /\bmistake\b/i, /\bpanic\b/i, /\bweak(ness|est)?\b/i] },
  { intent: INTENTS.COMPARATIVE, weight: 4, patterns: [/\bcompare\b/i, /\bversus\b/i, /\bvs\b/i, /\bdifference\b/i, /\blast \d+\b/i, /\bbetter than\b/i] },
  { intent: INTENTS.TREND_ANALYSIS, weight: 3, patterns: [/\bimprov(ing|e|ed)\b/i, /\btrend\b/i, /\bprogress\b/i, /\bregress(ing|ion)?\b/i, /\bgetting better\b/i, /\bover time\b/i] },
  { intent: INTENTS.COACHING, weight: 3, patterns: [/\bwhat should i practice\b/i, /\bcoach\b/i, /\bimprove\b/i, /\bpractice\b/i, /\btrain\b/i, /\bfix\b/i, /\btopic(s)?\b/i, /\bsingle most important\b/i, /\bbridge (the )?gap\b/i] },
  { intent: INTENTS.PREDICTIVE, weight: 2, patterns: [/\bwill i\b/i, /\bcan i\b/i, /\bshould i\b/i, /\bpredict\b/i, /\blikely\b/i, /\breadiness\b/i, /\bchance\b/i] },
  { intent: INTENTS.REFLECTIVE, weight: 2, patterns: [/\bwhat kind of\b/i, /\bmy style\b/i, /\bstrength|strongest\b/i, /\bweakness|weakest\b/i, /\bpattern\b/i, /\bhabit\b/i] },
  { intent: INTENTS.HISTORICAL_REVIEW, weight: 2, patterns: [/\blast\b/i, /\bpast\b/i, /\bhistory\b/i, /\breview\b/i, /\bprevious\b/i, /\bmonth\b/i, /\bweek\b/i, /\bcontest(s)?\b/i, /\brating\b/i] },
  { intent: INTENTS.GOAL_PLANNING, weight: 3, patterns: [/\bgoal\b/i, /\bplan\b/i, /\breach\b/i, /\btarget\b/i, /\broadmap\b/i, /\bby next\b/i, /\bbridge (the )?gap\b/i, /\bbetween\s+\d{3,4}\s+and\s+\d{3,4}\b/i] },
  { intent: INTENTS.EXPLORATORY, weight: 1, patterns: [/\bshow me\b/i, /\bdiscover\b/i, /\binteresting\b/i, /\bexplore\b/i, /\banything\b/i] }
]);

function normalizeQuestion(question) {
  return String(question || '').trim().replace(/\s+/g, ' ');
}

function classify(question) {
  const normalized = normalizeQuestion(question);
  const hash = crypto.createHash('sha256').update(normalized.toLowerCase()).digest('hex');
  if (!normalized) {
    return {
      question: normalized,
      questionHash: hash,
      primaryIntent: INTENTS.UNKNOWN,
      secondaryIntents: [],
      confidence: 0,
      intents: [{ intent: INTENTS.UNKNOWN, confidence: 0, score: 0 }],
      ambiguous: false
    };
  }

  const scored = RULES.map((rule) => {
    const matches = rule.patterns.filter((pattern) => pattern.test(normalized)).length;
    return { intent: rule.intent, score: matches * rule.weight, matches };
  }).filter((item) => item.score > 0);

  if (!scored.length) {
    return {
      question: normalized,
      questionHash: hash,
      primaryIntent: INTENTS.UNKNOWN,
      secondaryIntents: [INTENTS.EXPLORATORY],
      confidence: 0.2,
      intents: [{ intent: INTENTS.UNKNOWN, confidence: 0.2, score: 0 }],
      ambiguous: true
    };
  }

  scored.sort((a, b) => b.score - a.score || a.intent.localeCompare(b.intent));
  const maxScore = scored[0].score;
  const total = scored.reduce((sum, item) => sum + item.score, 0);
  const intents = scored.slice(0, 4).map((item) => ({
    intent: item.intent,
    score: item.score,
    confidence: Number(Math.min(0.99, Math.max(0.35, item.score / total)).toFixed(4))
  }));

  return {
    question: normalized,
    questionHash: hash,
    primaryIntent: intents[0].intent,
    secondaryIntents: intents.slice(1).map((item) => item.intent),
    confidence: intents[0].confidence,
    intents,
    ambiguous: intents.length > 1 && intents[1].score >= maxScore * 0.75
  };
}

module.exports = { classify, INTENT_DEFINITIONS };
