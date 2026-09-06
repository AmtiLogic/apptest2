// engine.js
// Texas Hold'em state machine. Deals, runs the betting rounds, builds side
// pots and settles the showdown. It knows nothing about bots, the coach or
// the DOM.

import {
  newDeck, shuffle, evaluate, compareHands, describeHand
} from './cards.js';

export const STREETS = ['preflop', 'flop', 'turn', 'river'];

// Seat labels running clockwise from the button.
const POSITION_TABLES = {
  2: ['BTN', 'BB'],
  3: ['BTN', 'SB', 'BB'],
  4: ['BTN', 'SB', 'BB', 'CO'],
  5: ['BTN', 'SB', 'BB', 'HJ', 'CO'],
  6: ['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO'],
  7: ['BTN', 'SB', 'BB', 'UTG', 'LJ', 'HJ', 'CO'],
  8: ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'LJ', 'HJ', 'CO'],
  9: ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO']
};

export const POSITION_FULL_NAMES = {
  BTN: 'the button',
  SB: 'the small blind',
  BB: 'the big blind',
  UTG: 'under the gun',
  'UTG+1': 'under the gun plus one',
  'UTG+2': 'under the gun plus two',
  LJ: 'the lojack',
  HJ: 'the hijack',
  CO: 'the cutoff'
};

export function positionName(seatIndex, buttonIndex, playerCount) {
  const table = POSITION_TABLES[playerCount] || POSITION_TABLES[9];
  const offset = ((seatIndex - buttonIndex) % playerCount + playerCount) % playerCount;
  return table[offset] || 'MP';
}

// The five buckets the opening charts are written for.
export function chartPosition(pos) {
  if (pos === 'BTN') return 'BTN';
  if (pos === 'SB') return 'SB';
  if (pos === 'BB') return 'BB';
  if (pos === 'CO') return 'CO';
  if (pos === 'HJ' || pos === 'LJ') return 'HJ';
  return 'UTG';
}

// How late a seat acts, 0 for earliest. Used by the coach to loosen ranges.
export function positionRank(pos) {
  const order = ['UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
  const i = order.indexOf(pos);
  return i < 0 ? 3 : i;
}

export function createTable(options = {}) {
  const seats = options.seats || [];
  return {
    players: seats.map((seat, i) => ({
      index: i,
      id: seat.id,
      name: seat.name,
      avatar: seat.avatar || '🙂',
      isHuman: !!seat.isHuman,
      personality: seat.personality || null,
      stack: options.startingStack || 200,
      hole: [],
      folded: false,
      allIn: false,
      committed: 0,
      totalCommitted: 0,
      acted: false,
      hasCards: false,
      lastAction: null,
      wonLast: 0
    })),
    startingStack: options.startingStack || 200,
    smallBlind: options.smallBlind || 1,
    bigBlind: options.bigBlind || 2,
    buttonIndex: 0,
    handNumber: 0,
    deck: [],
    board: [],
    street: 'idle',
    pot: 0,
    currentBet: 0,
    lastRaiseSize: 0,
    toAct: -1,
    lastAggressor: -1,
    log: [],
    results: null,
    handOver: true,
    rng: options.rng || Math.random
  };
}

export function activePlayers(t) {
  return t.players.filter((p) => p.hasCards && !p.folded);
}

function canStillAct(p) {
  return p.hasCards && !p.folded && !p.allIn && p.stack > 0;
}

export function startHand(t) {
  t.handNumber += 1;
  if (t.handNumber > 1) {
    t.buttonIndex = (t.buttonIndex + 1) % t.players.length;
  }
  // A practice table never runs dry. Anyone broke is topped back up so the
  // session keeps going.
  for (const p of t.players) {
    if (p.stack <= 0) p.stack = t.startingStack;
    p.hole = [];
    p.folded = false;
    p.allIn = false;
    p.committed = 0;
    p.totalCommitted = 0;
    p.acted = false;
    p.hasCards = true;
    p.lastAction = null;
    p.wonLast = 0;
  }

  // Kept so a hand can be replayed afterwards: the log says what happened,
  // this says what everybody had before it did.
  t.handStartStacks = t.players.map((p) => p.stack);

  t.deck = shuffle(newDeck(), t.rng);
  t.board = [];
  t.pot = 0;
  t.currentBet = 0;
  t.lastRaiseSize = t.bigBlind;
  t.lastAggressor = -1;
  t.preflopAggressor = -1;
  t.streetFirstActor = -1;
  t.street = 'preflop';
  t.handOver = false;
  t.results = null;
  t.log = [];

  const n = t.players.length;
  for (let round = 0; round < 2; round++) {
    for (let i = 1; i <= n; i++) {
      const p = t.players[(t.buttonIndex + i) % n];
      p.hole.push(t.deck.pop());
    }
  }

  const sbSeat = n === 2 ? t.buttonIndex : (t.buttonIndex + 1) % n;
  const bbSeat = n === 2 ? (t.buttonIndex + 1) % n : (t.buttonIndex + 2) % n;
  postBlind(t, sbSeat, t.smallBlind, 'small blind');
  postBlind(t, bbSeat, t.bigBlind, 'big blind');
  t.currentBet = Math.max(t.players[sbSeat].committed, t.players[bbSeat].committed);
  t.blindSeats = { sb: sbSeat, bb: bbSeat };

  t.toAct = nextToAct(t, bbSeat);
  t.streetFirstActor = t.toAct;
  if (t.toAct === -1) settleIfDone(t);
  return t;
}

function postBlind(t, seat, amount, label) {
  const p = t.players[seat];
  const paid = Math.min(amount, p.stack);
  p.stack -= paid;
  p.committed += paid;
  p.totalCommitted += paid;
  t.pot += paid;
  if (p.stack === 0) p.allIn = true;
  t.log.push({ type: 'blind', seat, amount: paid, label });
}

function nextToAct(t, fromSeat) {
  const n = t.players.length;
  for (let i = 1; i <= n; i++) {
    const seat = (fromSeat + i) % n;
    const p = t.players[seat];
    if (!canStillAct(p)) continue;
    if (!p.acted || p.committed < t.currentBet) return seat;
  }
  return -1;
}

export function legalActions(t) {
  if (t.handOver || t.toAct < 0) return null;
  const p = t.players[t.toAct];
  const toCall = Math.min(t.currentBet - p.committed, p.stack);
  const canCheck = toCall === 0;
  // A raise has to at least match the size of the previous bet or raise,
  // unless the player is putting their whole stack in.
  const minRaiseTo = t.currentBet === 0
    ? Math.min(t.bigBlind, p.stack + p.committed)
    : Math.min(t.currentBet + Math.max(t.lastRaiseSize, t.bigBlind), p.stack + p.committed);
  const maxRaiseTo = p.stack + p.committed;
  return {
    seat: t.toAct,
    toCall,
    canCheck,
    canFold: true,
    canRaise: maxRaiseTo > t.currentBet,
    isBet: t.currentBet === 0,
    minRaiseTo,
    maxRaiseTo,
    pot: t.pot
  };
}

/**
 * action: { type: 'fold' | 'check' | 'call' | 'bet' | 'raise', amount }
 * For bet and raise, `amount` is the total this player will have committed on
 * the current street (a raise "to" number), not the extra chips added.
 */
export function applyAction(t, action) {
  if (t.handOver) throw new Error('hand is over');
  const seat = t.toAct;
  if (seat < 0) throw new Error('nobody to act');
  const p = t.players[seat];
  const legal = legalActions(t);
  let record = { type: 'action', seat, action: action.type, amount: 0, street: t.street };

  if (action.type === 'fold') {
    p.folded = true;
    p.acted = true;
    p.lastAction = 'Fold';
  } else if (action.type === 'check') {
    if (legal.toCall > 0) throw new Error('cannot check facing a bet');
    p.acted = true;
    p.lastAction = 'Check';
  } else if (action.type === 'call') {
    const paid = legal.toCall;
    p.stack -= paid;
    p.committed += paid;
    p.totalCommitted += paid;
    t.pot += paid;
    if (p.stack === 0) p.allIn = true;
    p.acted = true;
    p.lastAction = paid === 0 ? 'Check' : 'Call';
    record.amount = paid;
  } else if (action.type === 'bet' || action.type === 'raise') {
    let target = Math.round(action.amount);
    target = Math.min(target, legal.maxRaiseTo);
    if (target < legal.minRaiseTo && target < legal.maxRaiseTo) target = legal.minRaiseTo;
    if (target <= t.currentBet && target < legal.maxRaiseTo) {
      throw new Error('raise must be larger than the current bet');
    }
    const paid = target - p.committed;
    const increment = target - t.currentBet;
    p.stack -= paid;
    p.committed = target;
    p.totalCommitted += paid;
    t.pot += paid;
    if (p.stack === 0) p.allIn = true;

    const fullRaise = increment >= Math.max(t.lastRaiseSize, t.bigBlind) || t.currentBet === 0;
    if (increment > 0) {
      t.currentBet = target;
      if (fullRaise) {
        t.lastRaiseSize = increment;
        // A full sized raise reopens the betting for everyone behind.
        for (const other of t.players) {
          if (other !== p && canStillAct(other)) other.acted = false;
        }
      }
      t.lastAggressor = seat;
      if (t.street === 'preflop') t.preflopAggressor = seat;
    }
    p.acted = true;
    p.lastAction = legal.isBet ? 'Bet ' + target : 'Raise ' + target;
    record.amount = target;
    record.allIn = p.allIn;
  } else {
    throw new Error('unknown action: ' + action.type);
  }

  t.log.push(record);
  advance(t);
  return record;
}

function advance(t) {
  const live = activePlayers(t);
  if (live.length <= 1) {
    settle(t);
    return;
  }
  const next = nextToAct(t, t.toAct);
  if (next !== -1) {
    t.toAct = next;
    return;
  }
  closeStreet(t);
}

function closeStreet(t) {
  for (const p of t.players) {
    p.committed = 0;
    p.acted = false;
    p.lastAction = null;
  }
  t.currentBet = 0;
  t.lastRaiseSize = t.bigBlind;
  t.lastAggressor = -1;

  const idx = STREETS.indexOf(t.street);
  if (idx === STREETS.length - 1) {
    settle(t);
    return;
  }

  const nextStreet = STREETS[idx + 1];
  t.street = nextStreet;
  if (nextStreet === 'flop') {
    t.board.push(t.deck.pop(), t.deck.pop(), t.deck.pop());
  } else {
    t.board.push(t.deck.pop());
  }
  t.log.push({ type: 'street', street: nextStreet });

  const canAct = t.players.filter(canStillAct);
  if (canAct.length < 2) {
    // Everyone left is all in. Run the rest of the board out.
    if (activePlayers(t).length > 1) {
      while (t.board.length < 5) {
        const i = STREETS.indexOf(t.street);
        t.street = STREETS[i + 1] || 'river';
        t.board.push(t.deck.pop());
        t.log.push({ type: 'street', street: t.street });
      }
      settle(t);
    } else {
      settle(t);
    }
    return;
  }

  t.toAct = nextToAct(t, t.buttonIndex);
  t.streetFirstActor = t.toAct;
  if (t.toAct === -1) closeStreet(t);
}

function settleIfDone(t) {
  if (!t.handOver) settle(t);
}

/**
 * Build side pots from what each player put in across the whole hand, then
 * award each pot to the best hand eligible for it.
 */
export function buildPots(t) {
  const contributors = t.players.filter((p) => p.totalCommitted > 0);
  const levels = Array.from(new Set(contributors.map((p) => p.totalCommitted)))
    .sort((a, b) => a - b);
  const pots = [];
  let previous = 0;
  for (const level of levels) {
    let amount = 0;
    for (const p of contributors) {
      amount += Math.max(0, Math.min(p.totalCommitted, level) - previous);
    }
    const eligible = t.players.filter(
      (p) => p.hasCards && !p.folded && p.totalCommitted >= level
    );
    if (amount > 0) pots.push({ amount, eligible: eligible.map((p) => p.index) });
    previous = level;
  }
  // Merge neighbouring pots with identical eligibility so the log stays short.
  const merged = [];
  for (const pot of pots) {
    const last = merged[merged.length - 1];
    if (last && last.eligible.join(',') === pot.eligible.join(',')) {
      last.amount += pot.amount;
    } else {
      merged.push({ amount: pot.amount, eligible: pot.eligible.slice() });
    }
  }
  return merged;
}

function settle(t) {
  const live = activePlayers(t);
  const showdown = live.length > 1;
  const evaluations = new Map();
  if (showdown) {
    for (const p of live) {
      evaluations.set(p.index, evaluate(p.hole.concat(t.board)));
    }
  }

  const pots = buildPots(t);
  const winnings = new Map();
  const potResults = [];

  for (const pot of pots) {
    let eligible = pot.eligible;
    if (eligible.length === 0) {
      // Should not happen, but never lose chips if it does.
      eligible = live.map((p) => p.index);
    }
    let winners;
    if (!showdown || eligible.length === 1) {
      winners = [eligible[0]];
    } else {
      let best = null;
      winners = [];
      for (const idx of eligible) {
        const res = evaluations.get(idx);
        if (!best || compareHands(res, best) > 0) {
          best = res;
          winners = [idx];
        } else if (compareHands(res, best) === 0) {
          winners.push(idx);
        }
      }
    }
    const share = Math.floor(pot.amount / winners.length);
    let remainder = pot.amount - share * winners.length;
    // Odd chips go to the first winner clockwise from the button.
    const ordered = winners.slice().sort((a, b) => {
      const n = t.players.length;
      const oa = ((a - t.buttonIndex) % n + n) % n;
      const ob = ((b - t.buttonIndex) % n + n) % n;
      return oa - ob;
    });
    for (const idx of ordered) {
      let amount = share;
      if (remainder > 0) {
        amount += 1;
        remainder -= 1;
      }
      winnings.set(idx, (winnings.get(idx) || 0) + amount);
    }
    potResults.push({ amount: pot.amount, winners: ordered.slice() });
  }

  for (const [idx, amount] of winnings) {
    t.players[idx].stack += amount;
    t.players[idx].wonLast = amount;
  }

  t.street = 'showdown';
  t.handOver = true;
  t.toAct = -1;
  t.results = {
    showdown,
    pots: potResults,
    winnings: t.players.map((p) => winnings.get(p.index) || 0),
    winners: Array.from(winnings.keys()),
    hands: Array.from(evaluations.entries()).map(([idx, res]) => ({
      seat: idx,
      name: res.name,
      category: res.category,
      description: describeHand(res),
      value: res.value,
      best: res.best
    })),
    net: t.players.map((p) => (winnings.get(p.index) || 0) - p.totalCommitted)
  };
  t.log.push({ type: 'settle', pots: potResults });
  t.pot = 0;
}

// Chips a player would need to add to call right now.
export function amountToCall(t, seat) {
  const p = t.players[seat];
  return Math.min(t.currentBet - p.committed, p.stack);
}
