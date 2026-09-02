// bots.js
// Five opponents with simple, distinct personalities. Each one reads the
// same information the coach reads, then applies its own preferences to it.

import { legalActions, positionName, chartPosition } from './engine.js';
import { readSpot, OPENING_CHARTS, inRange, TIER } from './coach.js';

export const PERSONALITIES = {
  rock: {
    key: 'rock',
    name: 'Ada',
    avatar: '🪨',
    style: 'Tight',
    read: 'Ada plays very few hands and almost never bluffs. When she puts money in, believe her and get out of the way unless you have something real.',
    // Which opening chart it borrows, regardless of where it is sitting.
    chartOverride: 'UTG',
    limpChance: 0.05,
    threeBetRange: 'JJ+, AKs, AKo',
    callRaiseRange: '77+, AQs, AJs, ATs, KQs, QJs, JTs, AQo',
    aggression: 0.45,
    bluffChance: 0.05,
    callDownTier: TIER.MEDIUM,
    drawSlack: 0,
    betSize: 0.6
  },
  drifter: {
    key: 'drifter',
    name: 'Bo',
    avatar: '🌊',
    style: 'Loose and passive',
    read: 'Bo plays far too many hands and would rather call than raise. He rarely folds before the flop and rarely puts in a raise, so his bets mean something.',
    chartOverride: 'BTN',
    limpChance: 0.75,
    threeBetRange: 'AA, KK',
    callRaiseRange: '22+, A2s+, K7s+, Q8s+, J8s+, T8s+, 97s+, 86s+, 76s, 65s, A7o+, KTo+, QTo+, JTo',
    aggression: 0.2,
    bluffChance: 0.05,
    callDownTier: TIER.WEAK,
    drawSlack: 8,
    betSize: 0.45
  },
  blaze: {
    key: 'blaze',
    name: 'Rey',
    avatar: '🔥',
    style: 'Aggressive',
    read: 'Rey raises constantly and bluffs a lot, especially on scary boards. Stop folding to the pressure and let go of the idea that a raise means strength.',
    chartOverride: 'CO',
    limpChance: 0,
    threeBetRange: 'TT+, AQs+, AKo, A5s, A4s, KQs, 76s, 65s',
    callRaiseRange: '22+, A2s+, K9s+, Q9s+, J9s+, T9s, 98s, 87s, ATo+, KJo+',
    aggression: 0.85,
    bluffChance: 0.45,
    callDownTier: TIER.WEAK,
    drawSlack: 6,
    betSize: 0.85
  },
  anchor: {
    key: 'anchor',
    name: 'Juno',
    avatar: '⚓',
    style: 'Calls almost anything',
    read: 'Juno calls with almost any two cards and will not fold a pair. Never try to bluff her, and bet your good hands three times because she will pay every one.',
    chartOverride: 'BTN',
    limpChance: 0.9,
    threeBetRange: 'AA',
    callRaiseRange: '22+, A2s+, K2s+, Q4s+, J6s+, T6s+, 95s+, 85s+, 75s+, 64s+, 54s, A2o+, K6o+, Q8o+, J8o+, T8o+, 98o',
    aggression: 0.1,
    bluffChance: 0.02,
    callDownTier: TIER.NOTHING,
    drawSlack: 20,
    betSize: 0.4
  },
  marlow: {
    key: 'marlow',
    name: 'Kit',
    avatar: '🎯',
    style: 'Balanced',
    read: 'Kit plays close to correct poker: solid opening hands, value bets when ahead, and folds when the price is wrong. Treat her bets as honest and pick your spots.',
    chartOverride: null,
    limpChance: 0.05,
    threeBetRange: 'QQ+, AKs, AKo, A5s',
    callRaiseRange: '22+, AQs, AJs, ATs, KQs, KJs, QJs, JTs, T9s, 98s, AQo, AJo, KQo',
    aggression: 0.6,
    bluffChance: 0.2,
    callDownTier: TIER.MEDIUM,
    drawSlack: 3,
    betSize: 0.65
  }
};

export const PERSONALITY_LIST = Object.keys(PERSONALITIES).map((k) => PERSONALITIES[k]);

// Extra names and faces for the seventh, eighth and ninth seats at a nine
// handed table. They reuse the five personalities.
const EXTRA_SEATS = [
  { name: 'Nils', avatar: '🦉', personality: 'rock' },
  { name: 'Vera', avatar: '🍀', personality: 'blaze' },
  { name: 'Otto', avatar: '🐢', personality: 'drifter' }
];

export function buildSeats(tableSize, humanName) {
  const seats = [{ id: 'hero', name: humanName || 'You', avatar: '🫵', isHuman: true }];
  const order = ['marlow', 'blaze', 'anchor', 'rock', 'drifter'];
  const wanted = tableSize - 1;
  for (let i = 0; i < wanted; i++) {
    if (i < order.length) {
      const p = PERSONALITIES[order[i]];
      seats.push({ id: p.key, name: p.name, avatar: p.avatar, personality: p.key });
    } else {
      const extra = EXTRA_SEATS[(i - order.length) % EXTRA_SEATS.length];
      seats.push({
        id: extra.personality + '-' + i,
        name: extra.name,
        avatar: extra.avatar,
        personality: extra.personality
      });
    }
  }
  return seats;
}

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

/**
 * Decide what a bot does. Returns an action object the engine accepts.
 */
export function botAction(table, seat, rng) {
  const roll = rng || table.rng || Math.random;
  const player = table.players[seat];
  const persona = PERSONALITIES[player.personality] || PERSONALITIES.marlow;
  const legal = legalActions(table);
  if (!legal) return { type: 'check' };
  const spot = readSpot(table, seat);

  const decision = table.street === 'preflop'
    ? preflop(spot, persona, legal, roll)
    : postflop(spot, persona, legal, roll);

  return sanitize(decision, legal);
}

function sanitize(decision, legal) {
  if (!decision) return legal.canCheck ? { type: 'check' } : { type: 'fold' };
  if (decision.type === 'check' && !legal.canCheck) return { type: 'call' };
  if (decision.type === 'raise' || decision.type === 'bet') {
    if (!legal.canRaise) return legal.canCheck ? { type: 'check' } : { type: 'call' };
    const amount = clamp(Math.round(decision.amount || legal.minRaiseTo), legal.minRaiseTo, legal.maxRaiseTo);
    return { type: 'raise', amount };
  }
  if (decision.type === 'call' && legal.toCall === 0) return { type: 'check' };
  return decision;
}

// --- Preflop ---------------------------------------------------------------

function preflop(spot, persona, legal, roll) {
  const chartKey = persona.chartOverride || spot.chartPos;
  const chart = OPENING_CHARTS[chartKey] || OPENING_CHARTS.HJ;
  const bigBlind = spot.bigBlind;

  if (!spot.facingRaise) {
    const playable = inRange(spot.code, chart);
    if (!playable) {
      return legal.canCheck ? { type: 'check' } : { type: 'fold' };
    }
    if (legal.canCheck) {
      // In the big blind with nothing to call, raise only the good hands.
      const strong = inRange(spot.code, 'TT+, AQs, AKs, AQo, AKo');
      if (strong && roll() < persona.aggression) {
        return { type: 'raise', amount: bigBlind * 3 + spot.pot * 0.3 };
      }
      return { type: 'check' };
    }
    if (roll() < persona.limpChance) return { type: 'call' };
    const openTo = bigBlind * (spot.limpers > 0 ? 3 + spot.limpers : 2.5);
    return { type: 'raise', amount: Math.round(openTo) };
  }

  // Facing a raise.
  if (inRange(spot.code, persona.threeBetRange) && roll() < 0.2 + persona.aggression) {
    return { type: 'raise', amount: Math.round(Math.max(spot.raiseTo * 3, bigBlind * 8)) };
  }
  if (inRange(spot.code, persona.callRaiseRange)) {
    // Do not call off a huge part of the stack with a speculative hand.
    if (spot.toCall > spot.stack * 0.35 && !inRange(spot.code, 'TT+, AKs, AKo, AQs')) {
      return { type: 'fold' };
    }
    return { type: 'call' };
  }
  return legal.canCheck ? { type: 'check' } : { type: 'fold' };
}

// --- Postflop --------------------------------------------------------------

function postflop(spot, persona, legal, roll) {
  const made = spot.made;
  const draws = spot.draws;
  const pot = Math.max(spot.bigBlind, spot.pot);
  const sizeChips = Math.round(pot * persona.betSize);

  if (legal.toCall > 0) {
    const equity = draws.outs * (spot.street === 'flop' ? 4 : 2) + persona.drawSlack;
    const price = spot.needPct;

    if (made.tier >= TIER.MONSTER) {
      if (roll() < persona.aggression) {
        return { type: 'raise', amount: Math.round(spot.toCall + pot * persona.betSize + spot.hero.committed) };
      }
      return { type: 'call' };
    }
    if (made.tier >= TIER.STRONG) {
      if (roll() < persona.aggression * 0.5) {
        return { type: 'raise', amount: Math.round(spot.toCall + pot * persona.betSize + spot.hero.committed) };
      }
      return { type: 'call' };
    }
    if (draws.isDraw && draws.outs >= 4 && equity >= price) return { type: 'call' };
    if (made.tier >= persona.callDownTier) return { type: 'call' };
    if (made.tier >= TIER.WEAK && spot.needPct < 25 && roll() < 0.5) return { type: 'call' };
    if (draws.isDraw && draws.outs >= 8 && roll() < persona.bluffChance) {
      return { type: 'raise', amount: Math.round(spot.toCall + pot * persona.betSize + spot.hero.committed) };
    }
    return { type: 'fold' };
  }

  // Nothing to call.
  if (made.tier >= TIER.STRONG) {
    if (roll() < persona.aggression + 0.15) return { type: 'raise', amount: sizeChips };
    return { type: 'check' };
  }
  if (draws.isDraw && draws.outs >= 8 && roll() < persona.aggression) {
    return { type: 'raise', amount: sizeChips };
  }
  if (made.tier === TIER.MEDIUM && roll() < persona.aggression * 0.5) {
    return { type: 'raise', amount: Math.round(pot * 0.45) };
  }
  if (made.tier <= TIER.WEAK && roll() < persona.bluffChance && spot.opponents <= 2) {
    return { type: 'raise', amount: sizeChips };
  }
  return { type: 'check' };
}

export function personalityFor(player) {
  return PERSONALITIES[player.personality] || null;
}
