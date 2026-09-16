// stats.js
// What a hand says about how you play, and what a pile of runs says about how
// that is changing. Nothing in here touches the DOM or the engine's rules: it
// reads a finished table and a history and hands back numbers.

/**
 * Everything worth keeping about one finished hand, from the log the engine
 * wrote and the result it settled. Read once at the end rather than tracked
 * as it happens, so a hand that was skipped or resumed from a save counts the
 * same as one that was watched.
 */
export function handSummary(t, heroSeat) {
  const hero = t.players[heroSeat];
  const results = t.results || null;
  const net = results ? (results.net[heroSeat] || 0) : 0;
  const out = {
    net,
    won: net > 0,
    // At showdown means still holding cards when the hand was settled. Folded
    // hands never reach one, whatever the others did.
    showdown: !!(results && results.showdown && hero && hero.hasCards && !hero.folded),
    showdownWon: false,
    vpip: false,
    pfr: false,
    bets: 0,
    raises: 0,
    calls: 0
  };
  out.showdownWon = out.showdown && out.won;
  for (const entry of t.log || []) {
    if (entry.type !== 'action' || entry.seat !== heroSeat) continue;
    if (entry.action === 'bet') out.bets += 1;
    else if (entry.action === 'raise') out.raises += 1;
    else if (entry.action === 'call') out.calls += 1;
    if (entry.street === 'preflop') {
      // Posting a blind is not a choice and checking behind one is free, so
      // neither counts as putting money in on purpose.
      if (entry.action === 'call' || entry.action === 'raise' || entry.action === 'bet') out.vpip = true;
      if (entry.action === 'raise' || entry.action === 'bet') out.pfr = true;
    }
  }
  return out;
}

/** Fresh counters for a run or for the lifetime totals. */
export function emptyPlay() {
  return {
    hands: 0, handsWon: 0, showdowns: 0, showdownsWon: 0, net: 0,
    vpipHands: 0, pfrHands: 0, bets: 0, raises: 0, calls: 0
  };
}

export function addHand(play, hand) {
  play.hands += 1;
  if (hand.won) play.handsWon += 1;
  if (hand.showdown) play.showdowns += 1;
  if (hand.showdownWon) play.showdownsWon += 1;
  play.net += hand.net;
  if (hand.vpip) play.vpipHands += 1;
  if (hand.pfr) play.pfrHands += 1;
  play.bets += hand.bets;
  play.raises += hand.raises;
  play.calls += hand.calls;
  return play;
}

/** The three numbers that describe a style, as rates, from the counters. */
export function styleOf(play) {
  const hands = play.hands || 0;
  const passive = play.calls || 0;
  const active = (play.bets || 0) + (play.raises || 0);
  return {
    hands,
    vpip: hands ? (play.vpipHands || 0) / hands : 0,
    pfr: hands ? (play.pfrHands || 0) / hands : 0,
    // Bets and raises for every call. Nobody to divide by reads as very
    // aggressive rather than as an error, capped so a single raise with no
    // calls at all does not print as infinity.
    aggression: passive ? active / passive : (active ? 9 : 0),
    winRate: hands ? (play.handsWon || 0) / hands : 0,
    showdownRate: (play.showdowns || 0) ? (play.showdownsWon || 0) / play.showdowns : 0,
    perHand: hands ? (play.net || 0) / hands : 0
  };
}

/** The fewest hands before a style is worth naming at all. */
export const STYLE_MIN_HANDS = 20;

/**
 * Two words and a sentence. The lines are the ones every poker book draws:
 * tight is entering fewer than about a quarter of pots, aggressive is betting
 * and raising more than calling.
 */
export function styleRead(style) {
  if (!style || style.hands < STYLE_MIN_HANDS) {
    return {
      label: 'Too early to say',
      note: 'A style shows after about twenty hands. Play some more and it will be named here.'
    };
  }
  const tight = style.vpip < 0.26;
  const aggressive = style.aggression >= 1.2;
  if (tight && aggressive) {
    return {
      label: 'Tight and aggressive',
      note: 'You enter few pots and bet when you do. That is the shape to aim for. The next thing to check is whether the few pots you enter are the right ones.'
    };
  }
  if (tight && !aggressive) {
    return {
      label: 'Tight and passive',
      note: 'You wait for good hands and then call with them. The hands are right; the calling gives up money. Bet them instead and let worse hands pay you.'
    };
  }
  if (!tight && aggressive) {
    return {
      label: 'Loose and aggressive',
      note: 'You play a lot of hands and you bet them. Against players who fold that wins, and against players who call it bleeds. Fold more before the flop and the betting starts to work.'
    };
  }
  return {
    label: 'Loose and passive',
    note: 'You play a lot of hands and mostly call with them. That is the most expensive way to play poker. Fold more before the flop, and bet the hands you keep.'
  };
}

/** The last `window` values against the `window` before them. */
export function trend(values, window) {
  const w = window || 5;
  const clean = (values || []).filter((v) => typeof v === 'number' && !Number.isNaN(v));
  if (clean.length < 2) return { recent: null, earlier: null, delta: null, enough: false };
  const recent = clean.slice(-w);
  const earlier = clean.slice(-2 * w, -w);
  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const r = mean(recent);
  const e = earlier.length ? mean(earlier) : null;
  return {
    recent: r,
    earlier: e,
    delta: e === null ? null : r - e,
    // Two windows with something in each is the least that can be called a
    // trend. One window is a level, not a direction.
    enough: earlier.length >= 2 && recent.length >= 2
  };
}

/** A calendar day as a sortable key, in the phone's own time zone. */
export function dayKey(stamp) {
  const d = new Date(stamp);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + m + '-' + day;
}

export const DAYS_KEPT = 90;

/**
 * Add to the day's bucket and drop the oldest once there are more than are
 * worth keeping. Days are what "over time" means for somebody playing the
 * endless table, where there is no run to hang a number on.
 */
export function addToDay(days, key, delta) {
  const d = days[key] || (days[key] = { hands: 0, won: 0, net: 0, decisions: 0, good: 0, mistake: 0 });
  for (const k of Object.keys(delta)) d[k] = (d[k] || 0) + (delta[k] || 0);
  const keys = Object.keys(days).sort();
  while (keys.length > DAYS_KEPT) delete days[keys.shift()];
  return days;
}

/** Days with anything graded in them, oldest first. */
export function daySeries(days) {
  return Object.keys(days || {}).sort().map((key) => Object.assign({ key }, days[key]))
    .filter((d) => d.decisions > 0 || d.hands > 0);
}

/** Every idea across every run that recorded them, plus the run in hand. */
export function conceptTotals(history, current) {
  const out = {};
  const fold = (concepts) => {
    for (const key of Object.keys(concepts || {})) {
      const c = concepts[key];
      const o = out[key] || (out[key] = { n: 0, good: 0, mistake: 0 });
      o.n += c.n || 0;
      o.good += c.good || 0;
      o.mistake += c.mistake || 0;
    }
  };
  for (const r of history || []) fold(r.concepts);
  if (current) fold(current.concepts);
  return out;
}

/**
 * How one idea has gone run by run, newest last, as the share of decisions
 * that were not mistakes. Runs with nothing to say about it are skipped
 * rather than counted as zero.
 */
export function conceptSeries(history, concept) {
  const runs = (history || []).slice().reverse();
  const out = [];
  for (const r of runs) {
    const c = r.concepts && r.concepts[concept];
    if (!c || !c.n) continue;
    out.push((c.n - (c.mistake || 0)) / c.n);
  }
  return out;
}

/** The step each run reached, oldest first, 1 based; complete is one past the last. */
export function stepSeries(history, steps) {
  return (history || []).slice().reverse().map((r) => (r.won ? steps + 1 : Math.min((r.sector || 0) + 1, steps)));
}
