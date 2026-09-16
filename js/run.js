// run.js
// The game around the game. A run is a climb through a handful of tables with
// the blinds going up at every step, and your stack carried the whole way.
// Bust and the run is over. That pressure is the point: you cannot fold your
// way through, because standing still costs you a blind at a time.
//
// Nothing in here touches the DOM or the engine. It decides what a run is,
// where you are in one, and what the next step looks like.

export const HANDS_PER_SECTOR = 10;

/**
 * Five steps, each one harder than the last and each one about a single idea.
 * The focus is not a gate on the coach, which always grades everything. It is
 * what the debrief at the end of the step scores you on, and what has to go
 * well for the step to be marked as learned.
 */
export const SECTORS = [
  {
    key: 'soft',
    name: 'The soft game',
    focus: 'starting-hands',
    focusName: 'Which hands to play',
    brief: 'Loose players who call too much. The only thing that matters here is not playing rubbish before the flop.',
    lesson: {
      rule: 'Before the flop, fold most hands. Play pairs, two big cards, and cards that are close together and share a suit. Everything else loses money over time, even on the nights it wins.',
      watch: 'Every choice you make about entering a pot before the flop.',
      term: 'range',
      termName: 'range'
    },
    bigBlind: 2,
    pool: ['drifter', 'anchor', 'marlow']
  },
  {
    key: 'seats',
    name: 'Seats start to matter',
    focus: 'position',
    focusName: 'Where you are sitting',
    brief: 'The same hand is worth more when you act last. Play more of them late and fewer of them early.',
    lesson: {
      rule: 'The later you act, the more you know before you have to decide. Play more hands from the button and the seat before it, and fewer from the first seats to act. The same two cards are worth more late than early.',
      watch: 'Hands that are fine to open from a late seat but not an early one. Opening one from the wrong seat, or folding one from the right seat.',
      term: 'position',
      termName: 'position'
    },
    bigBlind: 4,
    pool: ['drifter', 'anchor', 'marlow', 'rock']
  },
  {
    key: 'price',
    name: 'Paying the price',
    focus: 'pot-odds',
    focusName: 'What a call costs',
    brief: 'People bet at you now. A draw is only worth chasing when the pot is paying you enough to chase it.',
    lesson: {
      rule: 'A call is a price. Compare what you have to put in against what is already in the pot. Chase a draw only when the pot is paying you enough for how often the draw actually comes in.',
      watch: 'Every call you make with a hand that still needs to improve to win.',
      term: 'pot-odds',
      termName: 'pot odds'
    },
    bigBlind: 8,
    pool: ['rock', 'blaze', 'anchor', 'marlow']
  },
  {
    key: 'board',
    name: 'Reading the board',
    focus: 'board-reading',
    focusName: 'What the board did to your hand',
    brief: 'Top pair is not the same hand on every flop. What beats you is written in the middle of the table.',
    lesson: {
      rule: 'Your hand is only as good as the board lets it be. Top pair on a dry flop is strong. Top pair on a board where a flush or a straight is already possible is not, and a big bet there is telling you so.',
      watch: 'Calls and raises with a made hand after the board has changed what that hand is worth.',
      term: 'board-texture',
      termName: 'board texture'
    },
    bigBlind: 15,
    pool: ['rock', 'blaze', 'marlow', 'anchor']
  },
  {
    key: 'final',
    name: 'The last table',
    focus: 'aggression',
    focusName: 'Betting rather than calling',
    brief: 'Short stacks and big blinds. Waiting is losing here, and the players left will punish a passive hand.',
    lesson: {
      rule: 'A bet can win two ways: they fold, or they call with worse. A call can only win one way. With a hand worth playing, bet it. Checking with nothing gives up the first way for free.',
      watch: 'Times you checked or called with a hand that should have bet, and bluffs with no reason to work.',
      term: 'aggressive',
      termName: 'aggression'
    },
    bigBlind: 30,
    pool: ['blaze', 'rock', 'marlow']
  }
];

export const CONCEPTS = {
  'starting-hands': 'Which hands to play',
  position: 'Where you are sitting',
  'pot-odds': 'What a call costs',
  'board-reading': 'What the board did to your hand',
  aggression: 'Betting rather than calling'
};

export const STARTING_STACK = 200;

/** A step is cleared when most of its graded decisions were not mistakes. */
export const CLEAR_RATE = 0.7;
/** And learned, which is permanent, when they were mostly good. */
export const MASTER_RATE = 0.85;

export function newRun(seedHands) {
  return {
    startedAt: Date.now(),
    sector: 0,
    handsThisSector: 0,
    handsPlayed: 0,
    stack: STARTING_STACK,
    peakStack: STARTING_STACK,
    table: null,
    sectorScores: [],
    decisions: 0,
    good: 0,
    fine: 0,
    mistake: 0,
    focusDecisions: 0,
    focusGood: 0,
    focusMistake: 0,
    leaks: {},
    // Every idea, not only the step's own. The step is scored on its focus;
    // this is what lets the stats say how each idea has gone over time.
    concepts: {},
    // How the hands went, as opposed to how the decisions were graded: pots
    // won, money in, bets against calls. Filled in by the app at each hand's
    // end so the record can say what style the run was played in.
    play: null,
    handsAtStart: seedHands || 0,
    over: false,
    won: false,
    endedBy: null
  };
}

export function sectorOf(run) {
  return SECTORS[Math.min(run.sector, SECTORS.length - 1)];
}

export function isLastSector(run) {
  return run.sector >= SECTORS.length - 1;
}

export function handsLeftInSector(run) {
  return Math.max(0, HANDS_PER_SECTOR - run.handsThisSector);
}

/**
 * The two tables on offer at the start of a step. Short handed means more
 * hands you are forced to play and a faster swing in both directions; full
 * ring means more waiting and smaller mistakes. The blinds are the same
 * either way, so the choice is about how much of the step you spend in a
 * hand rather than about the price of it.
 */
export function tableChoices(sectorIndex) {
  const sector = SECTORS[Math.min(sectorIndex, SECTORS.length - 1)];
  return [
    {
      key: 'full',
      seats: 6,
      name: 'Full table',
      note: 'Six seats. You are dealt out of more pots, so the blinds bite harder but a bad hand costs less.',
      pool: sector.pool
    },
    {
      key: 'short',
      seats: 4,
      name: 'Short handed',
      note: 'Four seats. You are in far more hands, so the swings are bigger in both directions and the blinds come round fast.',
      pool: sector.pool
    }
  ];
}

/**
 * Which idea a graded decision belongs to. The coach grades everything at
 * every step; this is only used to score the step against its own focus.
 */
export function conceptOfVerdict(verdict) {
  if (!verdict) return null;
  return verdict.concept || null;
}

export function recordDecision(run, verdict) {
  if (!verdict) return;
  run.decisions += 1;
  if (verdict.verdict === 'good') run.good += 1;
  else if (verdict.verdict === 'fine') run.fine += 1;
  else if (verdict.verdict === 'mistake') run.mistake += 1;
  if (verdict.leak) run.leaks[verdict.leak] = (run.leaks[verdict.leak] || 0) + 1;

  const concept = conceptOfVerdict(verdict);
  if (concept) {
    if (!run.concepts) run.concepts = {};
    const c = run.concepts[concept] || (run.concepts[concept] = { n: 0, good: 0, mistake: 0 });
    c.n += 1;
    if (verdict.verdict === 'good') c.good += 1;
    if (verdict.verdict === 'mistake') c.mistake += 1;
  }

  const focus = sectorOf(run).focus;
  if (concept === focus) {
    run.focusDecisions += 1;
    if (verdict.verdict === 'good') run.focusGood += 1;
    if (verdict.verdict === 'mistake') run.focusMistake += 1;
  }
}

/** True when a graded decision is on the idea the current step is about. */
export function onLesson(run, verdict) {
  return !!run && !run.over && conceptOfVerdict(verdict) === sectorOf(run).focus;
}

/** Where the step stands on its own idea, for the tally on screen. */
export function focusTally(run) {
  const n = run.focusDecisions || 0;
  return {
    n,
    good: run.focusGood || 0,
    mistake: run.focusMistake || 0,
    clean: n - (run.focusMistake || 0),
    // The step clears on a share, so what "enough" means in whole decisions
    // depends on how many there have been. Three right of four is enough;
    // three right of five is not.
    onTrack: n === 0 || (n - (run.focusMistake || 0)) / n >= CLEAR_RATE
  };
}

/**
 * Close the step off and say how it went. A step with nothing to judge counts
 * as cleared but never as learned, because surviving is not the same as
 * showing you can do it.
 */
export function scoreSector(run) {
  const sector = sectorOf(run);
  const n = run.focusDecisions;
  const clean = n - run.focusMistake;
  const rate = n > 0 ? clean / n : 1;
  const goodRate = n > 0 ? run.focusGood / n : 0;
  return {
    sector: run.sector,
    key: sector.key,
    name: sector.name,
    focus: sector.focus,
    focusName: sector.focusName,
    decisions: n,
    good: run.focusGood,
    mistakes: run.focusMistake,
    cleared: rate >= CLEAR_RATE,
    // Three is the fewest decisions that can say anything. Some ideas, pot
    // odds most of all, simply do not come up often, and a step where one
    // came up twice and you got both right is not proof of anything.
    mastered: n >= 3 && goodRate >= MASTER_RATE
  };
}

/** Move to the next step, or finish the run when there is no next step. */
export function advanceSector(run) {
  const score = scoreSector(run);
  run.sectorScores.push(score);
  run.focusDecisions = 0;
  run.focusGood = 0;
  run.focusMistake = 0;
  run.handsThisSector = 0;
  if (isLastSector(run)) {
    run.over = true;
    run.won = true;
    run.endedBy = 'cleared the last table';
    return { score, finished: true };
  }
  run.sector += 1;
  return { score, finished: false };
}

export function bustRun(run, reason) {
  run.over = true;
  run.won = false;
  run.endedBy = reason || 'ran out of chips';
  run.sectorScores.push(scoreSector(run));
  return run;
}

/** What gets kept forever once a run ends. Small enough to hold hundreds of. */
export function runRecord(run) {
  return {
    at: run.startedAt,
    ended: Date.now(),
    sector: run.sector,
    sectorName: sectorOf(run).name,
    won: !!run.won,
    endedBy: run.endedBy,
    hands: run.handsPlayed,
    stack: Math.max(0, Math.round(run.stack)),
    peak: Math.round(run.peakStack),
    decisions: run.decisions,
    good: run.good,
    fine: run.fine,
    mistake: run.mistake,
    leaks: Object.assign({}, run.leaks),
    concepts: JSON.parse(JSON.stringify(run.concepts || {})),
    play: run.play ? Object.assign({}, run.play) : null,
    net: Math.round(run.stack) - STARTING_STACK,
    learned: run.sectorScores.filter((s) => s.mastered).map((s) => s.focus)
  };
}

export const MAX_RUNS_KEPT = 300;

/** Newest first, and old runs are never rewritten, only pushed off the end. */
export function addRunRecord(history, record) {
  const next = [record].concat(history || []);
  return next.slice(0, MAX_RUNS_KEPT);
}

export function historySummary(history) {
  const runs = history || [];
  const best = runs.reduce((b, r) => (r.sector > b ? r.sector : b), -1);
  return {
    runs: runs.length,
    wins: runs.filter((r) => r.won).length,
    bestSector: best,
    bestSectorName: best >= 0 ? SECTORS[Math.min(best, SECTORS.length - 1)].name : null,
    bestStack: runs.reduce((b, r) => Math.max(b, r.peak || 0), 0),
    handsPlayed: runs.reduce((n, r) => n + (r.hands || 0), 0)
  };
}
