// live.js
// Ties a glossary term to the hand actually being played. Tapping "position"
// should not only say what position means, it should say where you are
// sitting right now and what that means for this hand.
//
// Every note returns a short piece of copy, or null when the term has
// nothing useful to say about the current table.

import { RANK_WORDS, RANK_WORDS_PLURAL, SUIT_NAMES } from './cards.js';
import { positionName, POSITION_FULL_NAMES, legalActions } from './engine.js';
import { classifyMade, classifyDraws, TIER } from './coach.js';

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
  if (c.after === 0) {
    return 'Nobody still in the hand acts after you, which is the spot you want to be in.';
  }
  const who = c.after === 1 ? 'One player' : capitalise(numberWord(c.after)) + ' players';
  const verb = c.after === 1 ? 'acts' : 'act';
  return who + ' still in the hand ' + verb + ' after you on every round from the flop on.';
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
    let line = 'Your two cards this hand are ' + hole + '.';
    if (c.made && c.board.length) {
      line += ' With the [[board]] as it stands, your best five card hand is ' +
        c.made.label.toLowerCase() + '.';
    }
    return line;
  },

  position: (c) => {
    if (c.isButton) {
      return 'You are on the button right now, which is the best seat at the table. ' +
        'You act last on every round after the flop, so you get to see what everyone ' +
        'else does first. It moves to the next player after this hand.';
    }
    return 'You are ' + distanceToButton(c) + ', which ' + c.buttonName +
      ' has, so this hand you are ' + c.posLong + '. ' + afterLine(c);
  },

  'in-position': (c) => (c.after === 0
    ? 'You are in position right now, so everyone still in the hand has to act before you do.'
    : 'You are not in position right now. ' + afterLine(c)),

  'out-of-position': (c) => (c.after > 0
    ? 'You are out of position right now. ' + afterLine(c) +
      ' They get to react to whatever you do.'
    : 'You are not out of position right now. Everyone still in acts before you do.'),

  button: (c) => buttonLine(c) + (c.isButton
    ? ''
    : ' Look for the white D badge under their chips.'),

  dealer: (c) => buttonLine(c),

  blinds: (c) => {
    if (!c.sbName) return null;
    return 'This hand ' + c.sbName + ' posted the small blind of ' + chips(c.smallBlind) +
      ' and ' + c.bbName + ' posted the big blind of ' + chips(c.bigBlind) +
      '. Both were put in before anyone saw a card.';
  },

  'small-blind': (c) => {
    if (!c.sbName) return null;
    return c.isSB
      ? 'You are the small blind this hand, so ' + chips(c.smallBlind) +
        ' of yours is already in the pot.'
      : c.sbName + ' is the small blind this hand, marked SB under their chips.';
  },

  'big-blind': (c) => {
    if (!c.bbName) return null;
    const unit = 'One big blind is ' + chips(c.bigBlind) + ' right now, so your ' +
      chips(c.stack) + ' is about ' + Math.round(c.stack / c.bigBlind) + ' big blinds.';
    return (c.isBB
      ? 'You are the big blind this hand, so ' + chips(c.bigBlind) + ' of yours is already in. '
      : c.bbName + ' is the big blind this hand, marked BB under their chips. ') + unit;
  },

  stakes: (c) => 'You are playing ' + c.smallBlind + ' and ' + c.bigBlind +
    ' right now. You can change that under Setup.',

  stack: (c) => 'Your stack is ' + chips(c.stack) + ' right now, which is about ' +
    Math.round(c.stack / c.bigBlind) + ' [[big-blind|big blinds]].',

  pot: (c) => 'The pot right now is ' + chips(c.pot) + '. That is the number next to the ' +
    'cards in the middle.',

  'community-cards': (c) => {
    const words = boardWords(c);
    return words
      ? 'The community cards so far are ' + words + '. ' +
        (c.board.length < 5 ? 'More are still to come.' : 'That is all five.')
      : 'None have been dealt yet this hand. The first three come after this round of betting.';
  },

  board: (c) => {
    const words = boardWords(c);
    return words
      ? 'The board right now is ' + words + '.'
      : 'The board is empty right now. Nothing has been dealt in the middle yet.';
  },

  street: (c) => 'You are on the ' + (c.street === 'preflop' ? 'first betting round, before the flop' : c.street) + ' right now.',

  preflop: (c) => (c.street === 'preflop'
    ? 'You are before the flop right now. Nothing is in the middle yet, so all you know is your own two cards and your [[position]].'
    : 'Before the flop is over for this hand. You are on the ' + c.street + ' now.'),

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
      return 'You cannot check right now. There is a bet of ' + chips(c.toCall) +
        ' to you, so your choices are fold, call or raise.';
    }
    return c.legal
      ? 'You can check right now, because nobody has bet on this round. It costs you nothing.'
      : 'Nobody has bet on this round so far, so checking is free when the turn reaches you.';
  },

  call: (c) => (c.toCall > 0
    ? 'Calling right now would cost you ' + chips(c.toCall) + ' and keep you in the hand.'
    : 'There is nothing to call right now, because nobody has bet on this round.'),

  bet: (c) => (c.table.currentBet === 0
    ? 'Nobody has bet on this round, so the first chips in would be a bet. The smallest one allowed is ' +
      chips(c.bigBlind) + '.'
    : 'Somebody has already bet ' + chips(c.table.currentBet) +
      ' this round, so putting in more is called a raise, not a bet.'),

  raise: (c) => {
    if (c.legal && c.legal.canRaise) {
      return 'The smallest raise you can make right now is to ' + chips(c.legal.minRaiseTo) +
        ', and the largest is your whole ' + chips(c.legal.maxRaiseTo) + '.';
    }
    return c.table.currentBet > 0
      ? 'The bet to match right now is ' + chips(c.table.currentBet) +
        '. A raise means putting in more than that, which forces everyone else to match your number or fold.'
      : 'Nobody has bet this round yet, so there is nothing to raise. The first chips in would be a bet.';
  },

  fold: (c) => (c.hero.committed > 0
    ? 'If you fold right now you give up the ' + chips(c.hero.committed) +
      ' you have already put in this round, and you cannot lose any more.'
    : 'Folding right now costs you nothing, because you have not put anything in this round.'),

  'all-in': (c) => 'Going all in right now would be ' + chips(c.stack) +
    ', everything you have left.',

  showdown: (c) => (c.live.length > 1
    ? capitalise(plural(c.live.length, 'player')) + ' are still in this hand, so if the betting finishes they turn their cards up and the best hand wins.'
    : 'Everyone else has folded, so this hand ends without a showdown.'),

  kicker: (c) => {
    if (!c.made || !c.board.length) return null;
    if (c.made.label === 'Top pair' || c.made.label === 'Second pair' || c.made.label === 'Bottom pair') {
      return 'You have ' + c.made.label.toLowerCase() + ' right now, so your other card is your kicker and it may decide a tie.';
    }
    return null;
  },

  'pot-odds': (c) => {
    if (c.toCall <= 0) return 'There is no bet to you right now, so you are not being offered a price.';
    const after = c.pot + c.toCall;
    return 'Right now you would pay ' + chips(c.toCall) + ' to win a pot of ' + chips(after) +
      '. That is ' + Math.round((c.toCall / after) * 100) + ' percent, so you need to win at least that often for the call to be worth it.';
  },

  outs: (c) => {
    if (!c.board.length) return null;
    return c.draws.outs > 0
      ? 'Right now you have ' + countOf(c.draws.outs, 'out') + ': cards still to come that would give you a hand worth having.'
      : 'Right now you have no real outs. No single card turns what you have into a strong hand.';
  },

  'rule-of-two-and-four': (c) => {
    if (!c.draws.outs) return null;
    const cardsToCome = c.board.length === 3 ? 2 : (c.board.length === 4 ? 1 : 0);
    if (!cardsToCome) return null;
    const multiplier = cardsToCome === 2 ? 4 : 2;
    return 'Right now you have ' + c.draws.outs + ' outs with ' + countOf(cardsToCome, 'card') +
      ' to come, so roughly ' + c.draws.outs + ' times ' + multiplier + ', about ' +
      Math.min(95, c.draws.outs * multiplier) + ' percent.';
  },

  equity: (c) => {
    if (!c.draws.outs || c.board.length >= 5) return null;
    const multiplier = c.board.length === 3 ? 4 : 2;
    return 'A rough read right now: ' + c.draws.outs + ' outs is about ' +
      Math.min(95, c.draws.outs * multiplier) + ' percent to get there.';
  },

  range: (c) => {
    const raiser = c.table.lastAggressor;
    if (raiser === undefined || raiser < 0 || raiser === c.seat) {
      return 'Nobody has raised this hand yet, so everyone still in could have almost anything.';
    }
    const pos = positionName(raiser, c.table.buttonIndex, c.n);
    return c.nameOf(raiser) + ' put in the last raise, from ' +
      (POSITION_FULL_NAMES[pos] || pos) + '. Think about every hand they would do that with, not one guess.';
  },

  draw: (c) => {
    if (!c.board.length) return null;
    return c.draws.isDraw
      ? 'You have a draw right now: ' + c.draws.label + ', with ' + countOf(c.draws.outs, 'out') + '.'
      : 'You do not have a draw right now.';
  },

  'flush-draw': (c) => {
    if (!c.board.length) return null;
    return c.draws.flushDraw
      ? 'You have a flush draw right now. One more card of that suit makes your flush.'
      : 'You do not have a flush draw right now.';
  },

  'open-ended-straight-draw': (c) => {
    if (!c.board.length) return null;
    return c.draws.openEnded
      ? 'You have an open ended straight draw right now, so a card at either end makes your straight.'
      : 'You do not have an open ended straight draw right now.';
  },

  gutshot: (c) => {
    if (!c.board.length) return null;
    return c.draws.gutshot
      ? 'You have a gutshot right now, so only one rank of card completes your straight.'
      : 'You do not have a gutshot right now.';
  },

  'made-hand': (c) => (c.made && c.board.length
    ? 'Right now you have ' + c.made.label.toLowerCase() + '.'
    : null),

  'high-card': (c) => {
    if (!c.made || !c.board.length) return null;
    return c.made.tier <= TIER.WEAK && c.made.category === 0
      ? 'That is what you have right now: ' + c.made.label.toLowerCase() +
        '. Nothing in the middle has paired either of your cards.'
      : 'You have better than high card right now. You have ' + c.made.label.toLowerCase() + '.';
  },

  'showdown-value': (c) => (c.made && c.board.length
    ? (c.made.tier === TIER.MEDIUM || c.made.tier === TIER.WEAK
      ? 'Your ' + c.made.label.toLowerCase() + ' right now is a good example: worth seeing the end with, not worth betting hard.'
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
      ? capitalise(plural(allIn.length, 'player')) + ' at the table ' +
        (allIn.length === 1 ? 'is' : 'are') + ' all in this hand, so a side pot may be built.'
      : 'Nobody is all in this hand, so there is only one pot right now.';
  },

  limp: (c) => {
    if (c.street !== 'preflop') return null;
    const limpers = c.table.log.filter((e) => e.type === 'action' && e.action === 'call').length;
    return limpers > 0
      ? capitalise(plural(limpers, 'player')) + ' ' + (limpers === 1 ? 'has' : 'have') +
        ' just called the big blind this hand rather than raising.'
      : 'Nobody has limped this hand so far.';
  },

  'under-the-gun': (c) => seatHolder(c, 'UTG', 'under the gun'),
  cutoff: (c) => seatHolder(c, 'CO', 'the cutoff'),
  hijack: (c) => seatHolder(c, 'HJ', 'the hijack')
};

function nameWithStyle(c, personality, description) {
  const player = c.table.players.find((p) => p.personality === personality);
  if (!player) return null;
  return 'At your table, ' + player.name + ' ' + description + '. Tap their seat for a read once you have played twenty hands against them.';
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
