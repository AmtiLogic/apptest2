// live.js
// Ties a glossary term to the hand actually being played. Tapping "position"
// should not only say what position means, it should say where you are
// sitting right now and what that means for this hand.
//
// Every note returns a short piece of copy, or null when the term has
// nothing useful to say about the current table.

import { RANK_WORDS, RANK_WORDS_PLURAL, SUIT_NAMES } from './cards.js';
import { positionName, POSITION_FULL_NAMES, legalActions } from './engine.js';
import { classifyMade, classifyDraws, outsToEquity, TIER } from './coach.js';

function capitalise(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function cardWords(card) {
  return 'the ' + RANK_WORDS[card.rank] + ' of ' + SUIT_NAMES[card.suit];
}

function listWords(items) {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  return items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];
}

function chips(n) {
  return n + (n === 1 ? ' chip' : ' chips');
}

// Prose counts read as words ("two players").
function plural(n, word) {
  return numberWord(n) + ' ' + word + (n === 1 ? '' : 's');
}

// Counts you do arithmetic with stay as digits ("12 outs"), matching how the
// coach banner writes them.
function countOf(n, word) {
  return n + ' ' + word + (n === 1 ? '' : 's');
}

// Counts in prose read better as words. Chip amounts stay as digits, because
// that is how they are shown on the table.
const NUMBER_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five',
  'six', 'seven', 'eight', 'nine', 'ten'
];

function numberWord(n) {
  return NUMBER_WORDS[n] || String(n);
}

function seatWord(count) {
  return numberWord(count) + (count === 1 ? ' seat' : ' seats');
}

// Where each seat sits in the order of play after the flop: the small blind
// acts first and the button acts last.
function postflopOrder(offset, n) {
  return offset === 0 ? n - 1 : offset - 1;
}

function buildContext(table, seat) {
  const hero = table.players[seat];
  const n = table.players.length;
  const offset = ((seat - table.buttonIndex) % n + n) % n;
  const pos = positionName(seat, table.buttonIndex, n);
  const blinds = table.blindSeats || {};
  const legal = (!table.handOver && table.toAct === seat) ? legalActions(table) : null;

  const nameOf = (index) => (index === seat ? 'you' : (table.players[index] || {}).name);

  const live = table.players.filter((p) => p.hasCards && !p.folded);
  const myOrder = postflopOrder(offset, n);
  const after = live.filter((p) => {
    const o = ((p.index - table.buttonIndex) % n + n) % n;
    return postflopOrder(o, n) > myOrder;
  }).length;

  const hasCards = hero.hole && hero.hole.length === 2;
  const made = hasCards ? classifyMade(hero.hole, table.board) : null;
  const draws = hasCards && table.board.length >= 3
    ? classifyDraws(hero.hole, table.board)
    : { outs: 0, isDraw: false, flushDraw: false, openEnded: false, gutshot: false };

  const toCall = Math.max(0, Math.min(table.currentBet - hero.committed, hero.stack));

  return {
    table, hero, seat, n, offset, pos, legal, live, after, hasCards, made, draws, toCall,
    posLong: POSITION_FULL_NAMES[pos] || pos,
    isButton: table.buttonIndex === seat,
    buttonName: nameOf(table.buttonIndex),
    sbName: blinds.sb === undefined ? null : nameOf(blinds.sb),
    bbName: blinds.bb === undefined ? null : nameOf(blinds.bb),
    isSB: blinds.sb === seat,
    isBB: blinds.bb === seat,
    smallBlind: table.smallBlind,
    bigBlind: table.bigBlind,
    board: table.board,
    street: table.street,
    pot: table.pot,
    stack: hero.stack,
    nameOf
  };
}

function boardWords(c) {
  if (!c.board.length) return null;
  return listWords(c.board.map(cardWords));
}

function holeWords(c) {
  if (!c.hasCards) return null;
  return listWords(c.hero.hole.map(cardWords));
}

// How far you are from the button, said plainly.
function buttonLine(c) {
  if (c.isButton) return 'You have the button this hand, so you act last after the flop.';
  return c.buttonName + ' has the button this hand, and you are ' + distanceToButton(c) + '.';
}

function afterLine(c) {
  if (c.after === 0) return 'Nobody left acts after you.';
  const who = c.after === 1 ? 'One player' : capitalise(numberWord(c.after)) + ' players';
  const verb = c.after === 1 ? 'acts' : 'act';
  return who + ' ' + verb + ' after you from the flop on.';
}

// Say the distance to the button the short way round, so the cutoff hears
// "one seat to the right" rather than "five seats to the left".
function distanceToButton(c) {
  const left = c.offset;
  const right = c.n - c.offset;
  return left <= right
    ? seatWord(left) + ' to the left of the button'
    : seatWord(right) + ' to the right of the button';
}

const NOTES = {
  hand: (c) => {
    const hole = holeWords(c);
    if (!hole) return null;
    let line = 'You hold ' + hole + '.';
    if (c.made && c.board.length) {
      line += ' Best five right now: ' + c.made.label.toLowerCase() + '.';
    }
    return line;
  },

  position: (c) => {
    if (c.isButton) {
      return 'You have the button, so you act last from the flop on. Best seat at the table, and it moves on after this hand.';
    }
    return 'You are ' + distanceToButton(c) + ' (' + c.buttonName + ' has it), so this hand you are ' +
      c.posLong + '. ' + afterLine(c);
  },

  'in-position': (c) => (c.after === 0
    ? 'You are in position right now, so everyone still in the hand has to act before you do.'
    : 'You are not in position right now. ' + afterLine(c)),

  'out-of-position': (c) => (c.after > 0
    ? 'You are out of position right now. ' + afterLine(c) +
      ' They get to react to whatever you do.'
    : 'You are not out of position right now. Everyone still in acts before you do.'),

  button: (c) => buttonLine(c) + (c.isButton ? '' : ' Look for the white D badge.'),

  dealer: (c) => buttonLine(c),

  blinds: (c) => {
    if (!c.sbName) return null;
    return c.sbName + ' put in ' + chips(c.smallBlind) + ' and ' + c.bbName + ' put in ' +
      chips(c.bigBlind) + ' this hand, before anybody saw a card.';
  },

  'small-blind': (c) => {
    if (!c.sbName) return null;
    return c.isSB
      ? 'You are the small blind, so ' + chips(c.smallBlind) + ' of yours is already in.'
      : c.sbName + ' is the small blind this hand, marked SB.';
  },

  'big-blind': (c) => {
    if (!c.bbName) return null;
    const unit = 'One big blind is ' + chips(c.bigBlind) + ', so your stack is about ' +
      Math.round(c.stack / c.bigBlind) + ' of them.';
    return (c.isBB
      ? 'You are the big blind, so ' + chips(c.bigBlind) + ' of yours is already in. '
      : c.bbName + ' is the big blind this hand, marked BB. ') + unit;
  },

  stakes: (c) => 'You are playing ' + c.smallBlind + ' and ' + c.bigBlind + ', changeable under Setup.',

  stack: (c) => 'You have ' + chips(c.stack) + ', about ' +
    Math.round(c.stack / c.bigBlind) + ' [[big-blind|big blinds]].',

  pot: (c) => 'The pot is ' + chips(c.pot) + ' right now, sitting next to the cards in the middle.',

  'community-cards': (c) => {
    const words = boardWords(c);
    return words
      ? words + (c.board.length < 5 ? ', with more to come.' : ', all five of them.')
      : 'None yet. The first three come after this round of betting.';
  },

  board: (c) => {
    const words = boardWords(c);
    return words
      ? 'The board right now is ' + words + '.'
      : 'The board is empty right now. Nothing has been dealt in the middle yet.';
  },

  street: (c) => 'You are on the ' + (c.street === 'preflop' ? 'first round, before the flop' : c.street) + '.',

  preflop: (c) => (c.street === 'preflop'
    ? 'You are here now. Nothing in the middle yet, so it is your two cards and your [[position]].'
    : 'Done for this hand. You are on the ' + c.street + ' now.'),

  flop: (c) => {
    if (c.board.length < 3) return 'The flop has not come yet this hand.';
    return 'The flop this hand was ' + listWords(c.board.slice(0, 3).map(cardWords)) + '.';
  },

  turn: (c) => (c.board.length >= 4
    ? 'The turn this hand was ' + cardWords(c.board[3]) + '.'
    : 'The turn has not come yet this hand.'),

  river: (c) => (c.board.length >= 5
    ? 'The river this hand was ' + cardWords(c.board[4]) + '.'
    : 'The river has not come yet this hand.'),

  check: (c) => {
    if (c.toCall > 0) {
      return 'Not available: there is ' + chips(c.toCall) + ' to you, so it is fold, call or raise.';
    }
    return c.legal
      ? 'Nobody has bet, so checking is free right now.'
      : 'Nobody has bet this round, so checking is free when it reaches you.';
  },

  call: (c) => (c.toCall > 0
    ? 'Calling costs you ' + chips(c.toCall) + ' right now.'
    : 'Nothing to call right now, nobody has bet.'),

  bet: (c) => (c.table.currentBet === 0
    ? 'Nobody has bet yet, so the smallest one allowed right now is ' + chips(c.bigBlind) + '.'
    : chips(c.table.currentBet) + ' is already bet this round, so more would be a raise, not a bet.'),

  raise: (c) => {
    if (c.legal && c.legal.canRaise) {
      return 'Right now you can raise to anywhere from ' + c.legal.minRaiseTo + ' up to ' +
        chips(c.legal.maxRaiseTo) + '.';
    }
    return c.table.currentBet > 0
      ? chips(c.table.currentBet) + ' is the bet to match right now, so a raise means more than that.'
      : 'Nothing to raise right now, nobody has bet.';
  },

  fold: (c) => (c.hero.committed > 0
    ? 'Folding gives up the ' + chips(c.hero.committed) + ' you already put in, and no more.'
    : 'Folding costs you nothing right now, you have not put anything in.'),

  'all-in': (c) => 'All in right now is ' + chips(c.stack) + ', everything you have left.',

  showdown: (c) => (c.live.length > 1
    ? capitalise(plural(c.live.length, 'player')) + ' are still in, so cards go face up if the betting finishes.'
    : 'Everyone else folded, so this hand ends without one.'),

  kicker: (c) => {
    if (!c.made || !c.board.length) return null;
    if (c.made.label === 'Top pair' || c.made.label === 'Second pair' || c.made.label === 'Bottom pair') {
      return 'You have ' + c.made.label.toLowerCase() + ', so your other card is the kicker if somebody else pairs the same one.';
    }
    return null;
  },

  'pot-odds': (c) => {
    if (c.toCall <= 0) return 'There is no bet to you right now, so you are not being offered a price.';
    const after = c.pot + c.toCall;
    return 'You would pay ' + chips(c.toCall) + ' to win ' + chips(after) + ', so you need to win ' +
      Math.round((c.toCall / after) * 100) + ' percent of the time.';
  },

  outs: (c) => {
    if (!c.board.length) return null;
    return c.draws.outs > 0
      ? 'You have ' + countOf(c.draws.outs, 'out') + ' right now.'
      : 'You have no real outs right now. No single card makes this strong.';
  },

  'rule-of-two-and-four': (c) => {
    if (!c.draws.outs || c.board.length > 4) return null;
    const next = outsToEquity(c.draws.outs, c.board.length, false);
    let line = c.draws.outs + ' outs times 2 is about ' + next.equity + ' percent on the next card.';
    if (c.board.length === 3) {
      const all = outsToEquity(c.draws.outs, 3, true);
      line += ' Times 4 (' + all.equity + ' percent) only counts if you are all in.';
    }
    return line;
  },

  equity: (c) => {
    if (!c.draws.outs || c.board.length > 4) return null;
    const read = outsToEquity(c.draws.outs, c.board.length, c.toCall > 0 && c.toCall >= c.hero.stack);
    return 'Rough read: ' + c.draws.outs + ' outs is about ' + read.equity + ' percent to get there.';
  },

  range: (c) => {
    const raiser = c.table.lastAggressor;
    if (raiser === undefined || raiser < 0 || raiser === c.seat) {
      return 'Nobody has raised yet, so everyone left could have almost anything.';
    }
    const pos = positionName(raiser, c.table.buttonIndex, c.n);
    return c.nameOf(raiser) + ' raised from ' + (POSITION_FULL_NAMES[pos] || pos) +
      '. Think about everything they would do that with, not one guess.';
  },

  draw: (c) => {
    if (!c.board.length) return null;
    return c.draws.isDraw
      ? 'You have one right now: ' + c.draws.label + ', ' + countOf(c.draws.outs, 'out') + '.'
      : 'You do not have one right now.';
  },

  'flush-draw': (c) => {
    if (!c.board.length) return null;
    return c.draws.flushDraw
      ? 'You have one right now. One more of that suit and you are there.'
      : 'You do not have one right now.';
  },

  'open-ended-straight-draw': (c) => {
    if (!c.board.length) return null;
    return c.draws.openEnded
      ? 'You have one right now, so either end makes your straight.'
      : 'You do not have one right now.';
  },

  gutshot: (c) => {
    if (!c.board.length) return null;
    return c.draws.gutshot
      ? 'You have one right now, so only one rank completes your straight.'
      : 'You do not have one right now.';
  },

  'made-hand': (c) => (c.made && c.board.length
    ? 'You have ' + c.made.label.toLowerCase() + ' right now.'
    : null),

  'high-card': (c) => {
    if (!c.made || !c.board.length) return null;
    return c.made.tier <= TIER.WEAK && c.made.category === 0
      ? 'That is you right now: ' + c.made.label.toLowerCase() + ', nothing paired.'
      : 'You are better than that right now. You have ' + c.made.label.toLowerCase() + '.';
  },

  'showdown-value': (c) => (c.made && c.board.length
    ? (c.made.tier === TIER.MEDIUM || c.made.tier === TIER.WEAK
      ? 'Your ' + c.made.label.toLowerCase() + ' is exactly this: worth seeing the end with, not worth betting hard.'
      : null)
    : null),

  tight: (c) => nameWithStyle(c, 'rock', 'plays very few hands'),
  loose: (c) => nameWithStyle(c, 'drifter', 'plays far too many hands'),
  passive: (c) => nameWithStyle(c, 'drifter', 'would rather call than raise'),
  aggressive: (c) => nameWithStyle(c, 'blaze', 'raises and bluffs constantly'),
  'calling-station': (c) => nameWithStyle(c, 'anchor', 'calls with almost anything'),

  'side-pot': (c) => {
    const allIn = c.live.filter((p) => p.allIn);
    return allIn.length
      ? capitalise(plural(allIn.length, 'player')) + ' ' + (allIn.length === 1 ? 'is' : 'are') +
        ' all in, so a side pot may be built.'
      : 'Nobody is all in, so there is just the one pot right now.';
  },

  limp: (c) => {
    if (c.street !== 'preflop') return null;
    const limpers = c.table.log.filter((e) => e.type === 'action' && e.action === 'call').length;
    return limpers > 0
      ? capitalise(plural(limpers, 'player')) + ' ' + (limpers === 1 ? 'has' : 'have') +
        ' just called rather than raising this hand.'
      : 'Nobody has limped this hand.';
  },

  'under-the-gun': (c) => seatHolder(c, 'UTG', 'under the gun'),
  cutoff: (c) => seatHolder(c, 'CO', 'the cutoff'),
  hijack: (c) => seatHolder(c, 'HJ', 'the hijack')
};

function nameWithStyle(c, personality, description) {
  const player = c.table.players.find((p) => p.personality === personality);
  if (!player) return null;
  return player.name + ' at your table ' + description + '.';
}

function seatHolder(c, code, longName) {
  const n = c.n;
  // "in the cutoff", but "under the gun" without the preposition.
  const where = longName.indexOf('the ') === 0 ? 'in ' + longName : longName;
  for (let i = 0; i < n; i++) {
    if (positionName(i, c.table.buttonIndex, n) !== code) continue;
    return i === c.seat
      ? 'You are ' + where + ' this hand.'
      : c.table.players[i].name + ' is ' + where + ' this hand.';
  }
  return null;
}

/**
 * The line shown at the top of a definition, tying it to this hand. Returns
 * null when the term has nothing to say about the table as it stands.
 */
export function liveNote(slug, table, seat) {
  const note = NOTES[slug];
  if (!note) return null;
  if (!table || !table.players || !table.players[seat]) return null;
  try {
    const text = note(buildContext(table, seat));
    return text || null;
  } catch (err) {
    // A definition is never worth breaking the sheet over.
    return null;
  }
}

export function hasLiveNote(slug) {
  return Object.prototype.hasOwnProperty.call(NOTES, slug);
}
