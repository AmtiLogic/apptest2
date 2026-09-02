// cards.js
// Deck construction, card parsing and a seven card hand evaluator.
// Everything else in the app depends on this file being correct.

export const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
export const SUITS = ['s', 'h', 'd', 'c'];

export const RANK_CHARS = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8',
  9: '9', 10: 'T', 11: 'J', 12: 'Q', 13: 'K', 14: 'A'
};

export const RANK_WORDS = {
  2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight',
  9: 'nine', 10: 'ten', 11: 'jack', 12: 'queen', 13: 'king', 14: 'ace'
};

export const RANK_WORDS_PLURAL = {
  2: 'twos', 3: 'threes', 4: 'fours', 5: 'fives', 6: 'sixes', 7: 'sevens',
  8: 'eights', 9: 'nines', 10: 'tens', 11: 'jacks', 12: 'queens',
  13: 'kings', 14: 'aces'
};

export const SUIT_SYMBOLS = { s: '♠', h: '♥', d: '♦', c: '♣' };
export const SUIT_NAMES = { s: 'spades', h: 'hearts', d: 'diamonds', c: 'clubs' };

const CHAR_TO_RANK = {};
for (const r of RANKS) CHAR_TO_RANK[RANK_CHARS[r]] = r;

export function makeCard(rank, suit) {
  return { rank, suit };
}

// Parse "As", "Td", "7h" into a card object.
export function parseCard(text) {
  const t = String(text).trim();
  const rank = CHAR_TO_RANK[t[0].toUpperCase()];
  const suit = t[1].toLowerCase();
  if (!rank || !SUITS.includes(suit)) throw new Error('bad card: ' + text);
  return { rank, suit };
}

export function parseCards(text) {
  return String(text).trim().split(/\s+/).filter(Boolean).map(parseCard);
}

export function cardToString(card) {
  return RANK_CHARS[card.rank] + card.suit;
}

export function cardLabel(card) {
  return RANK_CHARS[card.rank] + SUIT_SYMBOLS[card.suit];
}

export function isRed(card) {
  return card.suit === 'h' || card.suit === 'd';
}

export function newDeck() {
  const deck = [];
  for (const s of SUITS) for (const r of RANKS) deck.push({ rank: r, suit: s });
  return deck;
}

// Mulberry32, so shuffles can be seeded for tests and replays.
export function makeRng(seed) {
  let a = (seed >>> 0) || 1;
  return function rng() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(deck, rng = Math.random) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = deck[i];
    deck[i] = deck[j];
    deck[j] = tmp;
  }
  return deck;
}

export const CATEGORY = {
  HIGH_CARD: 0,
  PAIR: 1,
  TWO_PAIR: 2,
  TRIPS: 3,
  STRAIGHT: 4,
  FLUSH: 5,
  FULL_HOUSE: 6,
  QUADS: 7,
  STRAIGHT_FLUSH: 8
};

export const CATEGORY_NAMES = [
  'High card',
  'One pair',
  'Two pair',
  'Three of a kind',
  'Straight',
  'Flush',
  'Full house',
  'Four of a kind',
  'Straight flush'
];

// Given a descending, de-duplicated list of ranks, return the high card of the
// best five card straight inside it, or 0 when there is none. Aces play low
// for the wheel (A2345).
function straightHigh(sortedUniqueDesc) {
  const present = new Set(sortedUniqueDesc);
  if (present.has(14)) present.add(1);
  const ranks = Array.from(present).sort((a, b) => b - a);
  let run = 1;
  for (let i = 1; i < ranks.length; i++) {
    if (ranks[i] === ranks[i - 1] - 1) {
      run += 1;
      if (run >= 5) return ranks[i] + 4;
    } else {
      run = 1;
    }
  }
  return 0;
}

function straightCards(cards, high) {
  const wanted = [];
  for (let r = high; r > high - 5; r--) wanted.push(r === 1 ? 14 : r);
  const out = [];
  for (const want of wanted) {
    const found = cards.find((c) => c.rank === want);
    if (found) out.push(found);
  }
  return out;
}

/**
 * Evaluate any five to seven cards. Returns:
 *   { category, tiebreak, name, best, value }
 * `tiebreak` is a descending array of rank values. Two results compare by
 * category first, then element by element through the tiebreak arrays.
 */
export function evaluate(cards) {
  if (!Array.isArray(cards) || cards.length < 5) {
    throw new Error('evaluate needs at least five cards');
  }

  const bySuit = { s: [], h: [], d: [], c: [] };
  const byRank = new Map();
  for (const c of cards) {
    bySuit[c.suit].push(c);
    if (!byRank.has(c.rank)) byRank.set(c.rank, []);
    byRank.get(c.rank).push(c);
  }

  let flushSuit = null;
  for (const s of SUITS) if (bySuit[s].length >= 5) flushSuit = s;

  const allRanksDesc = Array.from(new Set(cards.map((c) => c.rank))).sort((a, b) => b - a);

  // Straight flush.
  if (flushSuit) {
    const suited = bySuit[flushSuit];
    const suitedRanks = Array.from(new Set(suited.map((c) => c.rank))).sort((a, b) => b - a);
    const sfHigh = straightHigh(suitedRanks);
    if (sfHigh) {
      return finish(CATEGORY.STRAIGHT_FLUSH, [sfHigh], straightCards(suited, sfHigh));
    }
  }

  // Group ranks by how many copies there are.
  const groups = Array.from(byRank.entries())
    .map(([rank, cs]) => ({ rank, count: cs.length, cards: cs }))
    .sort((a, b) => (b.count - a.count) || (b.rank - a.rank));

  const quads = groups.filter((g) => g.count === 4);
  const trips = groups.filter((g) => g.count === 3);
  const pairs = groups.filter((g) => g.count === 2);

  if (quads.length) {
    const q = quads[0];
    const kicker = allRanksDesc.find((r) => r !== q.rank);
    const kickerCard = cards.find((c) => c.rank === kicker);
    return finish(CATEGORY.QUADS, [q.rank, kicker], q.cards.concat([kickerCard]));
  }

  if (trips.length && (trips.length > 1 || pairs.length)) {
    const t = trips[0];
    const pairRank = trips.length > 1
      ? Math.max(trips[1].rank, pairs.length ? pairs[0].rank : 0)
      : pairs[0].rank;
    const pairCards = byRank.get(pairRank).slice(0, 2);
    return finish(CATEGORY.FULL_HOUSE, [t.rank, pairRank], t.cards.concat(pairCards));
  }

  if (flushSuit) {
    const suited = bySuit[flushSuit].slice().sort((a, b) => b.rank - a.rank).slice(0, 5);
    return finish(CATEGORY.FLUSH, suited.map((c) => c.rank), suited);
  }

  const sHigh = straightHigh(allRanksDesc);
  if (sHigh) {
    return finish(CATEGORY.STRAIGHT, [sHigh], straightCards(cards, sHigh));
  }

  if (trips.length) {
    const t = trips[0];
    const kickers = allRanksDesc.filter((r) => r !== t.rank).slice(0, 2);
    const kickerCards = kickers.map((r) => byRank.get(r)[0]);
    return finish(CATEGORY.TRIPS, [t.rank].concat(kickers), t.cards.concat(kickerCards));
  }

  if (pairs.length >= 2) {
    const hi = pairs[0];
    const lo = pairs[1];
    const kicker = allRanksDesc.find((r) => r !== hi.rank && r !== lo.rank);
    const kickerCard = byRank.get(kicker)[0];
    return finish(
      CATEGORY.TWO_PAIR,
      [hi.rank, lo.rank, kicker],
      hi.cards.concat(lo.cards, [kickerCard])
    );
  }

  if (pairs.length === 1) {
    const p = pairs[0];
    const kickers = allRanksDesc.filter((r) => r !== p.rank).slice(0, 3);
    const kickerCards = kickers.map((r) => byRank.get(r)[0]);
    return finish(CATEGORY.PAIR, [p.rank].concat(kickers), p.cards.concat(kickerCards));
  }

  const top5 = allRanksDesc.slice(0, 5);
  return finish(CATEGORY.HIGH_CARD, top5, top5.map((r) => byRank.get(r)[0]));
}

function finish(category, tiebreak, best) {
  // A single integer so results can be compared or sorted cheaply. Each
  // tiebreak slot gets four bits of headroom above rank 14.
  let value = category;
  for (let i = 0; i < 5; i++) {
    value = value * 16 + (tiebreak[i] || 0);
  }
  return {
    category,
    tiebreak: tiebreak.slice(),
    name: CATEGORY_NAMES[category],
    best: best.slice(0, 5),
    value
  };
}

// Negative when a is worse, positive when a is better, zero for a tie.
export function compareHands(a, b) {
  if (a.category !== b.category) return a.category - b.category;
  const len = Math.max(a.tiebreak.length, b.tiebreak.length);
  for (let i = 0; i < len; i++) {
    const av = a.tiebreak[i] || 0;
    const bv = b.tiebreak[i] || 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

// A short plain words description, for example "Pair of kings, ace kicker".
export function describeHand(result) {
  const t = result.tiebreak;
  switch (result.category) {
    case CATEGORY.STRAIGHT_FLUSH:
      return t[0] === 14
        ? 'Royal flush'
        : 'Straight flush, ' + RANK_WORDS[t[0]] + ' high';
    case CATEGORY.QUADS:
      return 'Four ' + RANK_WORDS_PLURAL[t[0]];
    case CATEGORY.FULL_HOUSE:
      return 'Full house, ' + RANK_WORDS_PLURAL[t[0]] + ' full of ' + RANK_WORDS_PLURAL[t[1]];
    case CATEGORY.FLUSH:
      return 'Flush, ' + RANK_WORDS[t[0]] + ' high';
    case CATEGORY.STRAIGHT:
      return t[0] === 5 ? 'Straight, five high' : 'Straight, ' + RANK_WORDS[t[0]] + ' high';
    case CATEGORY.TRIPS:
      return 'Three ' + RANK_WORDS_PLURAL[t[0]];
    case CATEGORY.TWO_PAIR:
      return 'Two pair, ' + RANK_WORDS_PLURAL[t[0]] + ' and ' + RANK_WORDS_PLURAL[t[1]];
    case CATEGORY.PAIR:
      return 'Pair of ' + RANK_WORDS_PLURAL[t[0]];
    default:
      return RANK_WORDS[t[0]].charAt(0).toUpperCase() + RANK_WORDS[t[0]].slice(1) + ' high';
  }
}

// "AKs", "QQ", "T9o" for a two card starting hand.
export function handCode(hole) {
  const [a, b] = hole;
  const hi = Math.max(a.rank, b.rank);
  const lo = Math.min(a.rank, b.rank);
  if (hi === lo) return RANK_CHARS[hi] + RANK_CHARS[lo];
  return RANK_CHARS[hi] + RANK_CHARS[lo] + (a.suit === b.suit ? 's' : 'o');
}

export function handWords(hole) {
  const [a, b] = hole;
  const hi = Math.max(a.rank, b.rank);
  const lo = Math.min(a.rank, b.rank);
  if (hi === lo) return 'a pair of ' + RANK_WORDS_PLURAL[hi];
  const suited = a.suit === b.suit ? ' suited' : ' offsuit';
  return RANK_WORDS[hi] + ' ' + RANK_WORDS[lo] + suited;
}
