// coach.js
// Grades the human player's decisions. Everything here is an explicit rule:
// work out the recommended action from the game state, then compare the
// action that was actually taken against it.

import {
  evaluate, describeHand, handCode, handWords, newDeck, cardToString,
  RANK_CHARS, RANK_WORDS, RANK_WORDS_PLURAL, CATEGORY
} from './cards.js';
import { positionName, chartPosition, positionRank, POSITION_FULL_NAMES } from './engine.js';

// ---------------------------------------------------------------------------
// Starting hand charts
// ---------------------------------------------------------------------------

export const OPENING_CHARTS = {
  UTG: '66+, A8s+, KTs+, QTs+, J9s+, T9s, 98s, ATo+, KQo',
  HJ: '55+, A7s+, K9s+, Q9s+, J9s+, T8s+, 98s, 87s, ATo+, KJo+',
  CO: '22+, A2s+, K8s+, Q8s+, J8s+, T8s+, 97s+, 87s, 76s, 65s, A9o+, KTo+, QJo',
  BTN: '22+, A2s+, K2s+, Q5s+, J7s+, T7s+, 96s+, 86s+, 75s+, 64s+, 54s, A2o+, K8o+, Q9o+, J9o+, T9o, 98o',
  SB: '22+, A2s+, K5s+, Q7s+, J8s+, T8s+, 97s+, 86s+, 75s+, 65s, A5o+, K9o+, QTo+, JTo'
};

// Facing somebody else's raise.
const THREE_BET_RANGE = 'QQ+, AKs, AKo, A5s, A4s';
const CALL_RAISE_RANGE = '22+, AQs, AJs, ATs, KQs, KJs, KTs, QJs, QTs, JTs, T9s, 98s, 87s, 76s, 65s, AQo, AJo, KQo';
const CALL_RAISE_EXTRA_BB = 'A9s, A8s, A7s, A6s, A5s, A4s, A3s, A2s, K9s, Q9s, J9s, T8s, 97s, 86s, 54s, ATo, KJo, QJo, JTo';
const CALL_RAISE_EXTRA_LATE = 'A9s, A8s, K9s, Q9s, J9s, 54s, ATo, KJo, QJo';

const RANK_ORDER = { 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, T: 10, J: 11, Q: 12, K: 13, A: 14 };

function rankValue(ch) {
  return RANK_ORDER[ch.toUpperCase()];
}

// Turn one chart token ("A8s+", "66+", "T9o") into the list of hand codes it covers.
export function expandToken(token) {
  const t = token.trim();
  if (!t) return [];
  const plus = t.endsWith('+');
  const body = plus ? t.slice(0, -1) : t;
  const hi = rankValue(body[0]);
  const lo = rankValue(body[1]);
  const suffix = body.length > 2 ? body[2].toLowerCase() : '';
  const out = [];
  if (hi === lo) {
    const from = plus ? hi : hi;
    const to = plus ? 14 : hi;
    for (let r = from; r <= to; r++) out.push(RANK_CHARS[r] + RANK_CHARS[r]);
    return out;
  }
  const from = plus ? lo : lo;
  const to = plus ? hi - 1 : lo;
  for (let k = from; k <= to; k++) {
    out.push(RANK_CHARS[hi] + RANK_CHARS[k] + suffix);
  }
  return out;
}

const rangeCache = new Map();

export function expandRange(rangeText) {
  if (rangeCache.has(rangeText)) return rangeCache.get(rangeText);
  const set = new Set();
  for (const token of String(rangeText).split(',')) {
    for (const code of expandToken(token)) set.add(code);
  }
  rangeCache.set(rangeText, set);
  return set;
}

export function inRange(code, rangeText) {
  return expandRange(rangeText).has(code);
}

// ---------------------------------------------------------------------------
// Reading the board
// ---------------------------------------------------------------------------

export const TIER = { NOTHING: 0, WEAK: 1, MEDIUM: 2, STRONG: 3, MONSTER: 4 };

// Which glossary term a finished hand should link to, so tapping the readout
// explains the hand you actually have rather than a generic word.
const TERM_FOR_CATEGORY = {
  [CATEGORY.HIGH_CARD]: 'high-card',
  [CATEGORY.PAIR]: 'pair',
  [CATEGORY.TWO_PAIR]: 'two-pair',
  [CATEGORY.TRIPS]: 'three-of-a-kind',
  [CATEGORY.STRAIGHT]: 'straight',
  [CATEGORY.FLUSH]: 'flush',
  [CATEGORY.FULL_HOUSE]: 'full-house',
  [CATEGORY.QUADS]: 'four-of-a-kind',
  [CATEGORY.STRAIGHT_FLUSH]: 'straight-flush'
};

export function handTermSlug(category) {
  return TERM_FOR_CATEGORY[category] || 'made-hand';
}

function linkHand(result) {
  return '[[' + handTermSlug(result.category) + '|' + describeHand(result) + ']]';
}

function unseenCards(known) {
  const seen = new Set(known.map(cardToString));
  return newDeck().filter((c) => !seen.has(cardToString(c)));
}

function sameCard(a, b) {
  return a.rank === b.rank && a.suit === b.suit;
}

/**
 * What the player actually has right now, in tiers the rest of the coach can
 * reason about, plus a short label for the readout.
 */
export function classifyMade(hole, board) {
  if (board.length === 0) {
    const code = handCode(hole);
    const pair = hole[0].rank === hole[1].rank;
    const high = Math.max(hole[0].rank, hole[1].rank);
    return {
      tier: pair ? (high >= 10 ? TIER.STRONG : TIER.MEDIUM) : (high >= 13 ? TIER.MEDIUM : TIER.NOTHING),
      label: pair
        ? 'Pocket ' + RANK_WORDS_PLURAL[high]
        : capitalize(handWords(hole)),
      markup: pair
        ? '[[pocket-pair|Pocket ' + RANK_WORDS_PLURAL[high] + ']]'
        : linkSuitedness(capitalize(handWords(hole))),
      code,
      category: null
    };
  }

  const cards = hole.concat(board);
  const result = evaluate(cards);
  const boardRanks = board.map((c) => c.rank).sort((a, b) => b - a);
  const holeRanks = hole.map((c) => c.rank);
  const pocketPair = holeRanks[0] === holeRanks[1];
  const usesHole = result.best.some((c) => hole.some((h) => sameCard(h, c)));

  const base = { code: handCode(hole), category: result.category, evaluation: result };

  if (result.category >= CATEGORY.STRAIGHT) {
    return Object.assign(base, {
      tier: usesHole ? TIER.MONSTER : TIER.MEDIUM,
      label: describeHand(result),
      markup: usesHole
        ? linkHand(result)
        : describeHand(result) + ' (on the [[board]], everybody has it)'
    });
  }

  if (result.category === CATEGORY.TRIPS || result.category === CATEGORY.FULL_HOUSE ||
      result.category === CATEGORY.QUADS) {
    return Object.assign(base, {
      tier: usesHole ? TIER.MONSTER : TIER.MEDIUM,
      label: describeHand(result),
      markup: usesHole
        ? linkHand(result)
        : describeHand(result) + ' (all on the [[board]])'
    });
  }

  // Ranks the player has actually paired with one of their own cards.
  const heroPairedRanks = Array.from(new Set(holeRanks.filter((r) => boardRanks.includes(r))));

  // A pair the player made themselves, sorted into top, second or bottom by
  // how many board cards beat it. Pocket pairs are measured against distinct
  // board ranks instead, since a paired board is only one threat.
  function pairResult(pairRank, kicker, fromPocket) {
    if (fromPocket) {
      const higherRanks = Array.from(new Set(boardRanks.filter((r) => r > pairRank))).length;
      if (higherRanks === 0) {
        return Object.assign({}, base, {
          tier: TIER.STRONG,
          label: 'Overpair',
          markup: '[[overpair|Overpair]], ' + RANK_WORDS_PLURAL[pairRank]
        });
      }
      return Object.assign({}, base, {
        tier: higherRanks === 1 ? TIER.MEDIUM : TIER.WEAK,
        label: 'Pocket ' + RANK_WORDS_PLURAL[pairRank] + ' under the board',
        markup: '[[pocket-pair|Pocket ' + RANK_WORDS_PLURAL[pairRank] + ']] under the [[board]]'
      });
    }
    const higherCards = boardRanks.filter((r) => r > pairRank).length;
    if (higherCards === 0) {
      const goodKicker = kicker >= 12 || kicker >= pairRank;
      return Object.assign({}, base, {
        tier: goodKicker ? TIER.STRONG : TIER.MEDIUM,
        label: 'Top pair',
        markup: '[[top-pair|Top pair]], ' + RANK_WORDS[kicker] + ' [[kicker]]'
      });
    }
    if (higherCards === 1) {
      return Object.assign({}, base, {
        tier: TIER.MEDIUM,
        label: 'Second pair',
        markup: '[[middle-pair|Second pair]], ' + RANK_WORDS_PLURAL[pairRank]
      });
    }
    return Object.assign({}, base, {
      tier: TIER.WEAK,
      label: 'Bottom pair',
      markup: '[[bottom-pair|Bottom pair]], ' + RANK_WORDS_PLURAL[pairRank]
    });
  }

  if (result.category === CATEGORY.TWO_PAIR) {
    // Two pair only counts as a big hand when both pairs came from the
    // player's own cards. When one of them is sitting on the board, everybody
    // has it, so the real strength is whatever single pair they made.
    if (heroPairedRanks.length === 2) {
      return Object.assign(base, {
        tier: TIER.MONSTER,
        label: 'Two pair',
        markup: '[[two-pair|Two pair]], ' + RANK_WORDS_PLURAL[result.tiebreak[0]] +
          ' and ' + RANK_WORDS_PLURAL[result.tiebreak[1]]
      });
    }
    if (pocketPair && !heroPairedRanks.length) {
      return pairResult(holeRanks[0], holeRanks[0], true);
    }
    if (heroPairedRanks.length === 1) {
      const kicker = holeRanks.find((r) => r !== heroPairedRanks[0]);
      return pairResult(heroPairedRanks[0], kicker === undefined ? heroPairedRanks[0] : kicker, false);
    }
    return Object.assign(base, {
      tier: TIER.WEAK,
      label: 'Two pair on the board',
      markup: '[[two-pair|Two pair]] on the [[board]], your [[kicker]] plays'
    });
  }

  if (result.category === CATEGORY.PAIR) {
    const pairRank = result.tiebreak[0];
    if (pocketPair && holeRanks[0] === pairRank) {
      return pairResult(pairRank, pairRank, true);
    }
    if (heroPairedRanks.includes(pairRank)) {
      const kicker = holeRanks.find((r) => r !== pairRank);
      return pairResult(pairRank, kicker === undefined ? pairRank : kicker, false);
    }
    // The pair is entirely on the board, so it helps everyone equally.
    const boardHigh = Math.max(holeRanks[0], holeRanks[1]);
    return Object.assign(base, {
      tier: boardHigh === 14 ? TIER.WEAK : TIER.NOTHING,
      label: RANK_WORDS[boardHigh] + ' high',
      markup: '[[pair|Pair]] on the [[board]], you hold ' + RANK_WORDS[boardHigh] + ' high'
    });
  }

  // "Four high" is a confusing thing to tell somebody when there is an ace on
  // the board that everybody shares. Only call it X high when the X is
  // actually theirs.
  const high = Math.max(holeRanks[0], holeRanks[1]);
  const boardTop = boardRanks[0] || 0;
  if (high > boardTop) {
    const words = capitalize(RANK_WORDS[high]) + ' high';
    return Object.assign(base, {
      tier: high === 14 ? TIER.WEAK : TIER.NOTHING,
      label: words,
      markup: '[[high-card|' + words + ']]'
    });
  }
  return Object.assign(base, {
    tier: TIER.NOTHING,
    label: 'No pair',
    markup: '[[high-card|No pair]], your best card is ' + withArticle(RANK_WORDS[high])
  });
}

/**
 * Count the cards left in the deck that would turn this into a hand worth
 * having, and work out which kind of draw it is.
 */
export function classifyDraws(hole, board) {
  const empty = {
    outs: 0, outCards: [], flushDraw: false, backdoorFlush: false,
    openEnded: false, gutshot: false, straightOuts: 0, isDraw: false,
    label: null, markup: null
  };
  if (board.length < 3 || board.length > 4) return empty;

  const known = hole.concat(board);
  const current = evaluate(known);
  if (current.category >= CATEGORY.STRAIGHT) return empty;

  const suitCounts = {};
  for (const c of known) suitCounts[c.suit] = (suitCounts[c.suit] || 0) + 1;
  let flushSuit = null;
  let backdoorSuit = null;
  for (const suit of Object.keys(suitCounts)) {
    const heroHas = hole.some((c) => c.suit === suit);
    if (!heroHas) continue;
    if (suitCounts[suit] === 4) flushSuit = suit;
    else if (suitCounts[suit] === 3 && board.length === 3) backdoorSuit = suit;
  }

  const outCards = [];
  const straightRanks = new Set();
  for (const card of unseenCards(known)) {
    const after = evaluate(known.concat([card]));
    if (after.category <= current.category && after.value <= current.value) continue;
    const helpsHero = after.best.some((c) => hole.some((h) => sameCard(h, c)));
    if (!helpsHero) continue;

    let isOut = false;
    if (after.category >= CATEGORY.STRAIGHT) {
      isOut = true;
      if (after.category === CATEGORY.STRAIGHT) straightRanks.add(card.rank);
    } else if (after.category >= CATEGORY.TRIPS && current.category < CATEGORY.TRIPS) {
      isOut = true;
    } else if (after.category === CATEGORY.TWO_PAIR && current.category < CATEGORY.TWO_PAIR) {
      isOut = true;
    } else if (after.category === CATEGORY.PAIR && current.category === CATEGORY.HIGH_CARD) {
      // Only pairing a hole card above every board card really counts.
      const boardTop = Math.max.apply(null, board.map((c) => c.rank));
      if (hole.some((h) => h.rank === card.rank && h.rank >= boardTop)) isOut = true;
    }
    if (isOut) outCards.push(card);
  }

  const straightOuts = outCards.filter((c) => straightRanks.has(c.rank)).length;
  const openEnded = straightRanks.size >= 2;
  const gutshot = straightRanks.size === 1;

  const parts = [];
  if (flushSuit) parts.push('[[flush-draw|flush draw]]');
  if (openEnded) parts.push('[[open-ended-straight-draw|open ended straight draw]]');
  else if (gutshot) parts.push('[[gutshot]]');
  if (!parts.length && backdoorSuit) parts.push('[[backdoor-draw|backdoor flush draw]]');

  return {
    outs: outCards.length,
    outCards,
    flushDraw: !!flushSuit,
    backdoorFlush: !!backdoorSuit && !flushSuit,
    openEnded,
    gutshot,
    straightOuts,
    // Cards that merely improve a made hand are not a draw. Only a real
    // flush or straight draw makes the pot odds arithmetic the right tool.
    isDraw: !!flushSuit || openEnded || gutshot,
    label: parts.length ? parts.join(' and ') : null,
    markup: parts.length ? parts.join(' and ') : null
  };
}

// A board is good for the player who raised before the flop when it is high
// and not very connected.
export function boardFavoursRaiser(board) {
  if (board.length < 3) return false;
  const ranks = board.map((c) => c.rank).sort((a, b) => b - a);
  const suits = {};
  for (const c of board) suits[c.suit] = (suits[c.suit] || 0) + 1;
  const maxSuit = Math.max.apply(null, Object.values(suits));
  const connected = ranks[0] - ranks[Math.min(2, ranks.length - 1)] <= 4;
  return ranks[0] >= 12 && maxSuit < 3 && !connected;
}

export function boardIsWet(board) {
  if (board.length < 3) return false;
  const ranks = Array.from(new Set(board.map((c) => c.rank))).sort((a, b) => b - a);
  const suits = {};
  for (const c of board) suits[c.suit] = (suits[c.suit] || 0) + 1;
  const maxSuit = Math.max.apply(null, Object.values(suits));
  const span = ranks[0] - ranks[ranks.length - 1];
  return maxSuit >= 2 && (span <= 5 || maxSuit >= 3);
}

export function describeBoard(board) {
  if (!board.length) return 'no cards yet';
  return board.map((c) => RANK_WORDS[c.rank]).join(' ');
}

// ---------------------------------------------------------------------------
// Reading the spot
// ---------------------------------------------------------------------------

export function readSpot(table, seat) {
  const hero = table.players[seat];
  const n = table.players.length;
  const pos = positionName(seat, table.buttonIndex, n);
  const toCall = Math.max(0, Math.min(table.currentBet - hero.committed, hero.stack));
  const potBefore = table.pot;
  const potAfterCall = potBefore + toCall;
  const potOdds = toCall > 0 ? toCall / potAfterCall : 0;

  let raiserSeat = -1;
  let raiseCount = 0;
  let limpers = 0;
  if (table.street === 'preflop') {
    for (const entry of table.log) {
      if (entry.type !== 'action') continue;
      if (entry.action === 'raise' || entry.action === 'bet') {
        raiseCount += 1;
        raiserSeat = entry.seat;
      } else if (entry.action === 'call' && raiseCount === 0) {
        limpers += 1;
      }
    }
  } else {
    raiserSeat = table.lastAggressor;
  }

  const made = classifyMade(hero.hole, table.board);
  const draws = classifyDraws(hero.hole, table.board);

  const bigBlind = table.bigBlind;
  const raiserPos = raiserSeat >= 0 ? positionName(raiserSeat, table.buttonIndex, n) : null;

  return {
    seat,
    hero,
    street: table.street,
    board: table.board.slice(),
    hole: hero.hole.slice(),
    code: handCode(hero.hole),
    position: pos,
    positionLong: POSITION_FULL_NAMES[pos] || pos,
    chartPos: chartPosition(pos),
    bigBlind,
    pot: potBefore,
    toCall,
    potOdds,
    needPct: Math.round(potOdds * 100),
    canCheck: toCall === 0,
    facingRaise: table.street === 'preflop' && raiseCount > 0,
    raiseCount,
    limpers,
    raiserSeat,
    raiserPos,
    raiserName: raiserSeat >= 0 ? table.players[raiserSeat].name : null,
    raiseTo: raiserSeat >= 0 ? table.players[raiserSeat].committed : 0,
    heroWasAggressor: table.preflopAggressor === seat,
    made,
    draws,
    stack: hero.stack,
    effectiveStack: Math.min.apply(null, table.players
      .filter((p) => p.hasCards && !p.folded)
      .map((p) => p.stack + p.committed)),
    opponents: table.players.filter((p) => p.hasCards && !p.folded && p.index !== seat).length,
    wet: boardIsWet(table.board),
    favoursRaiser: boardFavoursRaiser(table.board)
  };
}

// ---------------------------------------------------------------------------
// Mistake categories, used by the stats screen
// ---------------------------------------------------------------------------

export const LEAKS = {
  foldedTooMuchPreflop: 'Folded too much before the flop',
  calledTooWidePreflop: 'Played too many weak hands before the flop',
  chasedDraw: 'Chased a draw at a bad price',
  missedValue: 'Missed a value bet with a strong hand',
  badBluff: 'Bluffed into the wrong board',
  overfoldedPostflop: 'Folded after the flop when the price was right',
  paidOffTooLight: 'Called after the flop with nothing'
};

// ---------------------------------------------------------------------------
// The rules
// ---------------------------------------------------------------------------

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// "an eight", "an ace", but "a four".
function withArticle(word) {
  return (/^[aeiou]/i.test(word) ? 'an ' : 'a ') + word;
}

// "king three offsuit" becomes tappable without changing how it reads.
function linkSuitedness(text) {
  return text.replace(/ suited/g, ' [[suited]]').replace(/ offsuit/g, ' [[offsuit]]');
}

function chips(n) {
  return n + (n === 1 ? ' chip' : ' chips');
}

function banner(verdict, text, extra) {
  return Object.assign({ verdict, text }, extra || {});
}

/**
 * Grade one decision. `table` must be the state as it was immediately before
 * the action was applied. Returns a banner object, or null when there is
 * nothing worth saying.
 */
export function gradeAction(table, seat, action) {
  const spot = readSpot(table, seat);
  action = normalizeAction(action, spot);
  if (spot.street === 'preflop') {
    return spot.facingRaise ? gradePreflopFacingRaise(spot, action) : gradePreflopFirstIn(spot, action);
  }
  return gradePostflop(spot, action);
}

// The engine accepts a few equivalent shapes. Reduce them to check, call,
// raise and fold so the rules below only have four cases to think about.
function normalizeAction(action, spot) {
  const type = action.type === 'bet' ? 'raise' : action.type;
  if (type === 'call' && spot.toCall === 0) {
    return { type: 'check', amount: 0 };
  }
  return { type, amount: action.amount || 0 };
}

function handPhrase(spot) {
  return linkSuitedness(handWords(spot.hole)) + ' (' + spot.code + ')';
}

function seatPhrase(spot) {
  return '[[position|' + spot.positionLong + ']]';
}

// --- Preflop, nobody has raised -------------------------------------------

function gradePreflopFirstIn(spot, action) {
  const chart = OPENING_CHARTS[spot.chartPos];
  const isBB = spot.position === 'BB';
  const inChart = chart ? inRange(spot.code, chart) : false;
  // The button chart is the widest, so anything outside it is far too loose
  // from any seat.
  const defensible = inRange(spot.code, OPENING_CHARTS.BTN);
  const where = seatPhrase(spot);
  const hand = handPhrase(spot);
  const limpNote = spot.limpers > 0
    ? ' There ' + (spot.limpers === 1 ? 'is one [[limp|limper]]' : 'are ' + spot.limpers + ' [[limp|limpers]]') + ' already in.'
    : '';

  if (isBB && spot.canCheck) {
    if (action.type === 'check') {
      return banner('good', 'Checking is free from ' + where + ', you already have ' +
        chips(spot.bigBlind) + ' in and nobody raised. Take the [[flop]] with ' + hand + '.');
    }
    if (action.type === 'raise') {
      const strong = inRange(spot.code, 'TT+, AQs, AKs, AQo, AKo');
      return strong
        ? banner('good', 'Raising ' + hand + ' from ' + where + ' over ' +
            (spot.limpers || 'the') + ' [[limp|limpers]] is right, this hand is much better than a [[limp|limping]] [[range]].')
        : banner('fine', 'Raising ' + hand + ' from ' + where + ' is playable, though checking and seeing a free [[flop]] is the simpler line with a hand this size.');
    }
    return banner('fine', 'You had a free look at the [[flop]] from ' + where + '.');
  }

  if (inChart) {
    if (action.type === 'raise') {
      return banner('good', 'Raising ' + hand + ' from ' + where + ' is a standard [[open]]. It is in the opening [[range]] for this seat and there are only ' +
        (spot.opponents) + ' players left to act behind you.' + limpNote);
    }
    if (action.type === 'fold') {
      return banner('mistake', 'Folding ' + hand + ' from ' + where + ' is too [[tight]]. This hand is inside the opening [[range]] for this seat, so folding it throws away a spot you are supposed to be playing.' + limpNote, {
        leak: 'foldedTooMuchPreflop',
        better: 'Raise to ' + chips(spot.bigBlind * 3)
      });
    }
    return banner('fine', '[[limp|Limping]] ' + hand + ' from ' + where + ' is not a disaster, but raising is better. Raising wins the [[blinds]] sometimes and takes the lead in the [[hand]].', {
      better: 'Raise to ' + chips(spot.bigBlind * 3)
    });
  }

  if (action.type === 'fold') {
    return banner('good', 'Folding ' + hand + ' from ' + where + ' is correct. It is outside the opening [[range]] for this seat, and hands like this lose money played [[out-of-position|out of position]].' + limpNote);
  }
  if (action.type === 'raise' || action.type === 'call') {
    const word = action.type === 'raise' ? 'Raising' : '[[limp|Limping]]';
    if (defensible) {
      return banner('fine', word + ' ' + hand + ' from ' + where + ' is on the loose side. This hand plays fine from the [[button]] but from here there are too many players still to act.', {
        better: 'Fold'
      });
    }
    return banner('mistake', word + ' ' + hand + ' from ' + where + ' plays too many weak hands. This hand is outside even the widest [[button]] opening [[range]], so it is losing money from every seat.', {
      leak: 'calledTooWidePreflop',
      better: 'Fold'
    });
  }
  return null;
}

// --- Preflop, facing a raise ----------------------------------------------

function gradePreflopFacingRaise(spot, action) {
  const hand = handPhrase(spot);
  const where = seatPhrase(spot);
  const raiserLate = spot.raiserPos && positionRank(spot.raiserPos) >= positionRank('CO');
  const isBB = spot.position === 'BB';
  const raiserWord = spot.raiserName +
    ' in ' + '[[position|' + (POSITION_FULL_NAMES[spot.raiserPos] || spot.raiserPos) + ']]';
  const priceLine = 'It costs you ' + chips(spot.toCall) + ' to [[call]] into a [[pot]] of ' + chips(spot.pot) + '.';

  let callRange = CALL_RAISE_RANGE;
  if (isBB) callRange += ', ' + CALL_RAISE_EXTRA_BB;
  if (raiserLate) callRange += ', ' + CALL_RAISE_EXTRA_LATE;

  const shouldThreeBet = inRange(spot.code, THREE_BET_RANGE);
  const shouldCall = !shouldThreeBet && inRange(spot.code, callRange);

  if (shouldThreeBet) {
    if (action.type === 'raise') {
      return banner('good', 'Re-raising ' + hand + ' over ' + raiserWord +
        ' is right. This is one of the few hands strong enough to [[three-bet]], and it is comfortably ahead of the [[range]] they open there.');
    }
    if (action.type === 'call') {
      return banner('fine', 'Calling with ' + hand + ' keeps you in the [[hand]], but this is strong enough to [[three-bet]]. Re-raising builds a [[pot]] while you are ahead and stops the players behind you from coming along cheaply.', {
        better: 'Raise to ' + chips(Math.max(spot.raiseTo * 3, spot.bigBlind * 8))
      });
    }
    return banner('mistake', 'Folding ' + hand + ' to a raise from ' + raiserWord +
      ' throws away one of the best hands you can be dealt. ' + priceLine, {
      leak: 'foldedTooMuchPreflop',
      better: 'Raise to ' + chips(Math.max(spot.raiseTo * 3, spot.bigBlind * 8))
    });
  }

  if (shouldCall) {
    if (action.type === 'call') {
      const bbNote = isBB
        ? ' You are in ' + where + ', so you are getting a discount on the [[call]] because your [[blinds|blind]] is already in.'
        : '';
      return banner('good', 'Calling ' + hand + ' against ' + raiserWord + ' is right. ' + priceLine + bbNote);
    }
    if (action.type === 'fold') {
      return banner('mistake', 'Folding ' + hand + ' to a raise from ' + raiserWord +
        ' is too [[tight]], that hand is comfortably ahead of what they [[open]] there. ' + priceLine, {
        leak: 'foldedTooMuchPreflop',
        better: 'Call ' + chips(spot.toCall)
      });
    }
    return banner('fine', 'Re-raising ' + hand + ' is playable as a [[bluff]], but calling is the simpler line. This hand does well seeing a [[flop]] and badly in a re-raised [[pot]].', {
      better: 'Call ' + chips(spot.toCall)
    });
  }

  if (action.type === 'fold') {
    return banner('good', 'Folding ' + hand + ' to a raise from ' + raiserWord + ' is correct. ' + priceLine +
      ' Hands like this are often [[dominated]] by what they raise with.');
  }
  if (action.type === 'call') {
    return banner('mistake', 'Calling a raise from ' + raiserWord + ' with ' + hand +
      ' plays too wide. ' + priceLine + ' This hand is behind their opening [[range]] and it is often [[dominated]].', {
      leak: 'calledTooWidePreflop',
      better: 'Fold'
    });
  }
  return banner('mistake', 'Re-raising ' + hand + ' over ' + raiserWord +
    ' turns a weak hand into a big [[pot]]. ' + priceLine, {
    leak: 'calledTooWidePreflop',
    better: 'Fold'
  });
}

// --- Postflop --------------------------------------------------------------

function drawArithmetic(spot, twoCards) {
  const outs = spot.draws.outs;
  const multiplier = twoCards ? 4 : 2;
  const equity = Math.min(95, outs * multiplier);
  return {
    outs,
    equity,
    twoCards,
    line: 'You have ' + outs + ' [[outs]], so about ' + outs + ' times ' + multiplier +
      ' equals ' + equity + ' percent to get there' +
      (twoCards ? ' with two cards to come' : ' on the next card') +
      '. You are paying ' + chips(spot.toCall) + ' into a [[pot]] of ' +
      chips(spot.pot + spot.toCall) + ', so you need ' + spot.needPct +
      ' percent ([[pot-odds|pot odds]]).'
  };
}

function boardPhrase(spot) {
  return 'The [[board]] is ' + describeBoard(spot.board);
}

function gradePostflop(spot, action) {
  const made = spot.made;
  const draws = spot.draws;
  const hand = handPhrase(spot);

  if (spot.toCall > 0) return facingBet(spot, action, made, draws, hand);
  return noBetToFace(spot, action, made, draws, hand);
}

function facingBet(spot, action, made, draws, hand) {
  const twoCards = spot.street === 'flop' && spot.toCall >= spot.stack;
  const bigDraw = draws.isDraw && draws.outs >= 8;
  const anyDraw = draws.isDraw && draws.outs >= 4;
  const price = 'You are being asked for ' + chips(spot.toCall) + ' into a [[pot]] of ' +
    chips(spot.pot) + '.';

  // Strong made hands raise for value.
  if (made.tier >= TIER.MONSTER || (made.tier === TIER.STRONG && spot.street !== 'river')) {
    if (action.type === 'raise') {
      return withSizing(spot, action, banner('good', 'Raising with ' + made.label.toLowerCase() +
        ' is right. ' + boardPhrase(spot) + ' and you hold ' + hand +
        '. A [[raise]] gets more money in while you are ahead, which is a [[value-bet]].'));
    }
    if (action.type === 'call') {
      return banner('fine', 'Calling with ' + made.label.toLowerCase() + ' keeps weaker hands in, but raising wins more. ' +
        price + ' Worse hands will pay you off here.', {
        better: 'Raise'
      });
    }
    return banner('mistake', 'Folding ' + made.label.toLowerCase() + ' with ' + hand + ' on ' +
      describeBoard(spot.board) + ' throws away a hand that is winning most of the time. ' + price, {
      leak: 'overfoldedPostflop',
      better: 'Raise'
    });
  }

  // Draws: the price decides it.
  if (anyDraw && made.tier <= TIER.MEDIUM) {
    const math = drawArithmetic(spot, twoCards);
    const gettingOdds = math.equity >= spot.needPct;
    if (gettingOdds) {
      if (action.type === 'call') {
        return banner('good', 'Calling with your ' + (draws.markup || 'draw') + ' is right. ' + math.line);
      }
      if (action.type === 'fold') {
        return banner('mistake', 'Folding a ' + (draws.markup || 'draw') + ' at this price gives up too easily. ' + math.line, {
          leak: 'overfoldedPostflop',
          better: 'Call ' + chips(spot.toCall)
        });
      }
      return banner('fine', 'Raising with your ' + (draws.markup || 'draw') + ' is a [[semi-bluff]], which is defensible. You win right away when they fold and you still have outs when they call. ' + math.line, {
        better: 'Call ' + chips(spot.toCall)
      });
    }
    if (action.type === 'fold') {
      return banner('good', 'Folding is right, the price is wrong. ' + math.line);
    }
    if (action.type === 'call') {
      return banner('mistake', 'Calling here chases a draw at a bad price. ' + math.line +
        ' You are paying more than the draw is worth.', {
        leak: 'chasedDraw',
        better: 'Fold'
      });
    }
    return bigDraw
      ? banner('fine', 'Raising as a [[semi-bluff]] is defensible with ' + draws.outs + ' [[outs]], since calling alone is not profitable here. ' + math.line, { better: 'Fold' })
      : banner('mistake', 'Raising with ' + draws.outs + ' [[outs]] and no [[made-hand|made hand]] is a [[bluff]] with too little behind it. ' + math.line, {
        leak: 'badBluff',
        better: 'Fold'
      });
  }

  // Medium made hands can call at a reasonable price.
  if (made.tier === TIER.MEDIUM || (made.tier === TIER.STRONG && spot.street === 'river')) {
    if (action.type === 'call') {
      return banner('good', 'Calling with ' + made.label.toLowerCase() + ' is right. ' + price +
        ' The hand is not strong enough to [[raise]], but it has [[showdown-value|showdown value]] and this price is fine.');
    }
    if (action.type === 'fold') {
      return spot.needPct >= 40
        ? banner('good', 'Folding ' + made.label.toLowerCase() + ' to a bet this large is fine. ' + price +
            ' You would need to win ' + spot.needPct + ' percent of the time ([[pot-odds|pot odds]]), and a hand this size does not get there.')
        : banner('fine', 'Folding ' + made.label.toLowerCase() + ' here is on the [[tight]] side. ' + price +
            ' You only need to be good ' + spot.needPct + ' percent of the time ([[pot-odds|pot odds]]).', { better: 'Call ' + chips(spot.toCall) });
    }
    return banner('fine', 'Raising with ' + made.label.toLowerCase() + ' turns a hand with [[showdown-value|showdown value]] into a [[bluff]]. Calling keeps the [[pot]] a size your hand can handle.', {
      better: 'Call ' + chips(spot.toCall)
    });
  }

  // Nothing and no draw.
  if (action.type === 'fold') {
    return banner('good', 'Folding is right. You have ' + made.label.toLowerCase() + ' with no [[draw]], and ' +
      boardPhrase(spot).toLowerCase() + '. ' + price + ' There is nothing here worth ' + chips(spot.toCall) + '.');
  }
  if (action.type === 'call') {
    if (made.tier === TIER.WEAK && spot.needPct <= 25) {
      return banner('fine', 'Calling with ' + made.label.toLowerCase() + ' is thin, but the bet is small enough that it is not a real error. ' +
        price + ' You only need to be good ' + spot.needPct + ' percent of the time ([[pot-odds|pot odds]]), and a weak [[pair]] does get there sometimes.', {
        better: 'Fold'
      });
    }
    return banner('mistake', 'Calling with ' + made.label.toLowerCase() + ' and no [[draw]] is money thrown away. ' +
      price + ' You cannot win at [[showdown]] and you have no [[outs]] to improve.', {
      leak: 'paidOffTooLight',
      better: 'Fold'
    });
  }
  const canBluff = spot.favoursRaiser && spot.opponents === 1;
  return canBluff
    ? banner('fine', 'Raising as a [[bluff]] is defensible on ' + describeBoard(spot.board) +
        ', which fits the hands you would have raised with. It is a thin spot against one opponent.', { better: 'Fold' })
    : banner('mistake', 'Raising with ' + made.label.toLowerCase() + ' is a [[bluff]] into a [[board]] that does not fit your story. ' +
        capitalize(describeBoard(spot.board)) + ' hits the hands that already bet into you, and you are up against ' +
        spot.opponents + ' opponent' + (spot.opponents === 1 ? '' : 's') + '.', {
      leak: 'badBluff',
      better: 'Fold'
    });
}

function noBetToFace(spot, action, made, draws, hand) {
  const potNote = 'The [[pot]] is ' + chips(spot.pot) + ' and ' + boardPhrase(spot).toLowerCase() + '.';

  if (made.tier >= TIER.STRONG) {
    if (action.type === 'bet' || action.type === 'raise') {
      return withSizing(spot, action, banner('good', 'Betting ' + made.label.toLowerCase() + ' is right. ' + potNote +
        ' This is a [[value-bet]]: worse hands will call you and you want their money in now.'));
    }
    return banner('mistake', 'Checking ' + made.label.toLowerCase() + ' with ' + hand + ' misses a [[value-bet]]. ' +
      potNote + ' Weaker hands would have paid you, and checking gives them a free card instead.', {
      leak: 'missedValue',
      better: 'Bet ' + chips(Math.round(spot.pot * 0.6))
    });
  }

  if (draws.isDraw && draws.outs >= 8) {
    if (action.type === 'bet' || action.type === 'raise') {
      return banner('good', 'Betting your ' + (draws.markup || 'draw') + ' is a [[semi-bluff]] and it is a good one. You have ' +
        draws.outs + ' [[outs]], so you win the [[pot]] now when they fold and you still improve often when they call.');
    }
    return banner('fine', 'Checking a ' + (draws.markup || 'draw') + ' is fine, you keep the [[pot]] small and see the next card for free. Betting is the more profitable line with ' +
      draws.outs + ' [[outs]].', { better: 'Bet ' + chips(Math.round(spot.pot * 0.6)) });
  }

  if (made.tier === TIER.MEDIUM || made.tier === TIER.WEAK) {
    if (action.type === 'check') {
      return banner('good', 'Checking is right. ' + made.label + ' has [[showdown-value|showdown value]] but it is not strong enough to [[value-bet]], and betting only gets called by better. ' + potNote);
    }
    return banner('fine', 'Betting ' + made.label.toLowerCase() + ' is thin. It can get called by worse, but hands that call are often ahead of you. ' + potNote, {
      better: 'Check'
    });
  }

  // Nothing at all.
  if (action.type === 'check') {
    return banner('good', 'Checking is right with ' + made.label.toLowerCase() + '. ' + potNote +
      ' There is no [[value-bet]] here and no [[draw]] to protect.');
  }
  if (spot.favoursRaiser && spot.opponents === 1) {
    return banner('fine', 'Betting here is a reasonable [[continuation-bet]]. ' + potNote +
      ' That [[board]] is high and disconnected, so it fits the strong hands you would have raised with more than it fits their calling [[range]].');
  }
  return banner('mistake', 'Betting with ' + made.label.toLowerCase() + ' into a [[pot]] of ' +
    chips(spot.pot) + ' is a [[bluff]] that will not work. ' + capitalize(describeBoard(spot.board)) +
    ' connects with plenty of the hands that call you, so they are not folding, and you have no [[outs]] when they do not.', {
    leak: 'badBluff',
    better: 'Check'
  });
}

// Sizing is graded loosely. Only clearly wrong sizes get a note, and the
// verdict never drops below "fine" when the action itself was right.
function withSizing(spot, action, result) {
  if (action.type !== 'bet' && action.type !== 'raise') return result;
  const total = action.amount || 0;
  const added = Math.max(0, total - (spot.hero.committed || 0));
  const pot = Math.max(1, spot.pot);
  const fraction = added / pot;
  if (spot.made.tier >= TIER.MONSTER && spot.wet && fraction < 0.35) {
    return Object.assign({}, result, {
      verdict: 'fine',
      text: result.text + ' The size is too small though. On a [[board-texture|wet board]] like this, ' +
        chips(added) + ' into ' + chips(pot) + ' lets every [[draw]] call cheaply. Bet closer to ' +
        chips(Math.round(pot * 0.75)) + '.',
      better: 'Bet ' + chips(Math.round(pot * 0.75))
    });
  }
  if (fraction > 3 && spot.made.tier < TIER.MONSTER) {
    return Object.assign({}, result, {
      verdict: 'fine',
      text: result.text + ' The size is far larger than the [[pot]], which only gets called when you are beaten.',
      better: 'Bet ' + chips(Math.round(pot * 0.66))
    });
  }
  return result;
}

// ---------------------------------------------------------------------------
// The plain words readout under the player's cards
// ---------------------------------------------------------------------------

export function holdingReadout(hole, board) {
  if (!hole || hole.length < 2) return { label: '', markup: '' };
  const made = classifyMade(hole, board);
  if (board.length === 0) {
    return { label: made.label, markup: made.markup };
  }
  const draws = classifyDraws(hole, board);
  let markup = made.markup;
  let label = made.label;
  if (draws.markup) {
    markup += ', ' + draws.markup;
    label += ', ' + draws.label.replace(/\[\[[^|\]]*\|?/g, '').replace(/\]\]/g, '');
  }
  return { label, markup, tier: made.tier, outs: draws.outs };
}
