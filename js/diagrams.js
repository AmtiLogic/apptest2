// diagrams.js
// Some things in poker are a picture, not a sentence. Turn order, the price
// you are being offered, how many cards can save you: each of those takes a
// paragraph to write down and one glance to see.
//
// This module works out WHAT to draw from the live hand and returns plain
// data. Drawing it is ui.js's job, so this file stays testable without a DOM.

import { positionName } from './engine.js';
import { classifyMade, classifyDraws, outsToEquity, CATEGORY_LADDER } from './coach.js';

// Which picture helps which word.
const ORDER_TERMS = [
  'position', 'in-position', 'out-of-position', 'button', 'dealer', 'blinds',
  'small-blind', 'big-blind', 'under-the-gun', 'cutoff', 'hijack', 'street',
  'preflop'
];

const ODDS_TERMS = ['pot-odds', 'equity', 'expected-value', 'pot-sized-bet'];

const OUTS_TERMS = [
  'outs', 'draw', 'flush-draw', 'open-ended-straight-draw', 'gutshot',
  'rule-of-two-and-four', 'backdoor-draw', 'semi-bluff'
];

const LADDER_TERMS = [
  'hand', 'pair', 'two-pair', 'three-of-a-kind', 'straight', 'flush',
  'full-house', 'four-of-a-kind', 'straight-flush', 'high-card', 'top-pair',
  'middle-pair', 'bottom-pair', 'overpair', 'pocket-pair', 'showdown',
  'made-hand', 'kicker'
];

/**
 * The order every live player acts in on the current street, left to right.
 * This is the picture behind "position", "the button" and "who goes first".
 */
export function orderData(table, seat) {
  if (!table || !table.players || table.streetFirstActor === undefined) return null;
  const n = table.players.length;
  const first = table.streetFirstActor >= 0 ? table.streetFirstActor : table.buttonIndex;

  const seats = [];
  for (let i = 0; i < n; i++) {
    const index = (first + i) % n;
    const player = table.players[index];
    if (!player.hasCards) continue;
    seats.push({
      name: index === seat ? 'You' : player.name,
      isMe: index === seat,
      isButton: table.buttonIndex === index,
      isFirst: index === first,
      folded: !!player.folded,
      acting: table.toAct === index && !table.handOver
    });
  }
  if (!seats.length) return null;
  return {
    kind: 'order',
    seats,
    caption: table.street === 'preflop'
      ? 'Order before the flop. Blinds paid first, so they act last.'
      : 'Order after the flop. The button always acts last.'
  };
}

/**
 * The price you are being offered against your actual chance of getting
 * there. One bar makes a call or fold obvious without any arithmetic.
 */
export function oddsData(table, seat) {
  if (!table || !table.players) return null;
  const hero = table.players[seat];
  if (!hero || !hero.hole || hero.hole.length !== 2) return null;
  const toCall = Math.max(0, Math.min(table.currentBet - hero.committed, hero.stack));
  if (toCall <= 0) return null;

  const potAfter = table.pot + toCall;
  const need = Math.round((toCall / potAfter) * 100);

  const draws = table.board.length >= 3 && table.board.length <= 4
    ? classifyDraws(hero.hole, table.board)
    : { outs: 0 };
  // Exactly the sum the coach shows, so the picture and the words can never
  // disagree about the same decision.
  const equity = draws.outs > 0
    ? outsToEquity(draws.outs, table.board.length, toCall >= hero.stack).equity
    : null;

  return {
    kind: 'odds',
    need,
    equity,
    toCall,
    pot: potAfter,
    good: equity !== null && equity >= need
  };
}

/**
 * How many of the cards nobody has seen would rescue the hand. Nine out of
 * forty seven means far more as a picture than as a number.
 */
export function outsData(table, seat) {
  if (!table || !table.players) return null;
  const hero = table.players[seat];
  if (!hero || !hero.hole || hero.hole.length !== 2) return null;
  if (table.board.length < 3 || table.board.length > 4) return null;

  const draws = classifyDraws(hero.hole, table.board);
  const unseen = 52 - 2 - table.board.length;
  return {
    kind: 'outs',
    outs: draws.outs,
    unseen,
    label: draws.label,
    percent: Math.round((draws.outs / unseen) * 100)
  };
}

/**
 * Where the hand you are holding sits among the nine things it could be.
 */
export function ladderData(table, seat) {
  if (!table || !table.players) return null;
  const hero = table.players[seat];
  if (!hero || !hero.hole || hero.hole.length !== 2) return null;
  if (!table.board.length) return null;

  const made = classifyMade(hero.hole, table.board);
  const current = made.category;
  return {
    kind: 'ladder',
    current,
    label: made.label,
    rows: CATEGORY_LADDER.map((name, index) => ({
      name,
      current: index === current,
      beaten: index < current
    }))
  };
}

/**
 * The picture for a term, or null when a sentence is already enough.
 */
export function diagramData(slug, table, seat) {
  if (!table || !table.players || !table.players[seat]) return null;
  try {
    if (ORDER_TERMS.includes(slug)) return orderData(table, seat);
    if (ODDS_TERMS.includes(slug)) return oddsData(table, seat);
    if (OUTS_TERMS.includes(slug)) return outsData(table, seat);
    if (LADDER_TERMS.includes(slug)) return ladderData(table, seat);
  } catch (err) {
    // A picture is never worth breaking the sheet over.
    return null;
  }
  return null;
}

export function hasDiagram(slug) {
  return ORDER_TERMS.includes(slug) || ODDS_TERMS.includes(slug) ||
    OUTS_TERMS.includes(slug) || LADDER_TERMS.includes(slug);
}
