// replay.js
// Rebuilds a finished hand as a series of table snapshots, so it can be
// stepped through afterwards and watched happening rather than read about.
//
// The engine's log says what happened and handStartStacks says what everyone
// had before it did. Between them the whole hand can be reconstructed without
// storing a copy of the table at every step.

import { RANK_WORDS, SUIT_NAMES } from './cards.js';
import { positionName, POSITION_FULL_NAMES } from './engine.js';

function cardWords(card) {
  return RANK_WORDS[card.rank] + ' of ' + SUIT_NAMES[card.suit];
}

function listWords(items) {
  if (items.length <= 1) return items.join('');
  return items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];
}

function chips(n) {
  return n + (n === 1 ? ' chip' : ' chips');
}

/**
 * Turn a finished hand into frames. Each frame carries a table shaped object
 * the normal renderers already understand, plus a line saying what just
 * happened and, on the player's own turns, the grade they were given.
 *
 * `verdicts` is a list of { logIndex, verdict } recorded as the hand was
 * played, so a replay shows the same coaching the second time round.
 */
export function buildFrames(table, verdicts, heroSeat) {
  if (!table || !table.handStartStacks || !table.log || !table.log.length) return [];
  const seat = heroSeat === undefined ? 0 : heroSeat;
  const n = table.players.length;
  const gradeAt = new Map();
  for (const entry of verdicts || []) gradeAt.set(entry.logIndex, entry.verdict);

  const players = table.players.map((p, i) => ({
    index: i,
    name: p.name,
    avatar: p.avatar,
    isHuman: p.isHuman,
    personality: p.personality,
    stack: table.handStartStacks[i],
    hole: p.hole ? p.hole.slice() : [],
    folded: false,
    allIn: false,
    committed: 0,
    totalCommitted: 0,
    acted: false,
    hasCards: true,
    lastAction: null,
    wonLast: 0
  }));

  let pot = 0;
  let boardCount = 0;
  let street = 'preflop';
  let currentBet = 0;
  let lastAggressor = -1;
  // The log as far as this frame, so notes that read it (who has limped, who
  // put in the last raise) are right for the moment being looked at.
  const logSoFar = [];
  const frames = [];

  const nameOf = (index) => (index === seat ? 'You' : players[index].name);
  // "You fold" but "Ada folds".
  const verb = (index, base) => (index === seat ? base : base + 's');
  const seatWhere = (index) => {
    const pos = positionName(index, table.buttonIndex, n);
    return POSITION_FULL_NAMES[pos] || pos;
  };

  function push(caption, options) {
    const settings = options || {};
    frames.push({
      caption,
      verdict: settings.verdict || null,
      result: settings.result || null,
      table: {
        players: players.map((p) => Object.assign({}, p)),
        board: table.board.slice(0, boardCount),
        pot,
        currentBet,
        buttonIndex: table.buttonIndex,
        handNumber: table.handNumber,
        blindSeats: table.blindSeats,
        smallBlind: table.smallBlind,
        bigBlind: table.bigBlind,
        street,
        toAct: settings.toAct === undefined ? -1 : settings.toAct,
        streetFirstActor: -1,
        lastAggressor,
        handOver: !!settings.handOver,
        results: settings.results || null,
        log: logSoFar.slice()
      }
    });
  }

  let pendingBlinds = [];

  function flushBlinds() {
    if (!pendingBlinds.length) return;
    push('Blinds are posted before any cards: ' + listWords(pendingBlinds) + '.');
    pendingBlinds = [];
  }

  for (let i = 0; i < table.log.length; i++) {
    const entry = table.log[i];

    if (entry.type === 'blind') {
      logSoFar.push(entry);
      const player = players[entry.seat];
      player.stack -= entry.amount;
      player.committed += entry.amount;
      player.totalCommitted += entry.amount;
      pot += entry.amount;
      currentBet = Math.max(currentBet, player.committed);
      pendingBlinds.push(nameOf(entry.seat) + ' ' + chips(entry.amount) + ' (' + entry.label + ')');
      continue;
    }

    // Emitted before this entry joins the log, so the blinds frame does not
    // already know about the action that follows it.
    flushBlinds();
    logSoFar.push(entry);

    if (entry.type === 'action') {
      const player = players[entry.seat];
      const who = nameOf(entry.seat);
      let caption;

      if (entry.action === 'fold') {
        player.folded = true;
        player.lastAction = 'Fold';
        caption = who + ' ' + verb(entry.seat, 'fold') + ' from ' + seatWhere(entry.seat) + '.';
      } else if (entry.action === 'check') {
        player.lastAction = 'Check';
        caption = who + ' ' + verb(entry.seat, 'check') + '.';
      } else if (entry.action === 'call') {
        player.stack -= entry.amount;
        player.committed += entry.amount;
        player.totalCommitted += entry.amount;
        pot += entry.amount;
        player.lastAction = entry.amount === 0 ? 'Check' : 'Call';
        caption = entry.amount === 0
          ? who + ' ' + verb(entry.seat, 'check') + '.'
          : who + ' ' + verb(entry.seat, 'call') + ' ' + chips(entry.amount) + '.';
      } else {
        const paid = entry.amount - player.committed;
        player.stack -= paid;
        player.committed = entry.amount;
        player.totalCommitted += paid;
        pot += paid;
        const opening = currentBet === 0;
        currentBet = Math.max(currentBet, entry.amount);
        lastAggressor = entry.seat;
        player.lastAction = opening ? 'Bet ' + entry.amount : 'Raise ' + entry.amount;
        caption = who + ' ' + verb(entry.seat, opening ? 'bet' : 'raise') +
          (opening ? ' ' : ' to ') + chips(entry.amount) + (entry.allIn ? ', all in.' : '.');
      }
      if (player.stack <= 0) player.allIn = true;

      push(caption, { toAct: entry.seat, verdict: gradeAt.get(i) || null });
      continue;
    }

    if (entry.type === 'street') {
      for (const p of players) {
        p.committed = 0;
        p.lastAction = null;
      }
      currentBet = 0;
      lastAggressor = -1;
      const before = boardCount;
      boardCount = entry.street === 'flop' ? 3 : boardCount + 1;
      street = entry.street;
      const fresh = table.board.slice(before, boardCount).map(cardWords);
      push(capitalise(entry.street) + ': ' + listWords(fresh) + '.');
      continue;
    }

    if (entry.type === 'settle') {
      for (const p of players) {
        p.committed = 0;
        p.lastAction = null;
      }
      const results = table.results;
      const collected = (results && results.winnings) || players.map(() => 0);
      for (let k = 0; k < players.length; k++) {
        players[k].stack += collected[k];
        players[k].wonLast = collected[k];
      }
      pot = 0;
      push(showdownCaption(table, results, nameOf, seat), {
        handOver: true,
        results,
        result: true
      });
    }
  }

  flushBlinds();
  return frames;
}

function showdownCaption(table, results, nameOf, seat) {
  if (!results) return 'The hand is over.';
  const collected = results.winnings || [];
  let best = -1;
  let bestAmount = 0;
  for (let i = 0; i < collected.length; i++) {
    if (collected[i] > bestAmount) {
      bestAmount = collected[i];
      best = i;
    }
  }
  if (best < 0) return 'The hand is over.';
  const who = nameOf(best);
  const verb = best === seat ? 'take' : 'takes';
  const hand = (results.hands || []).find((h) => h.seat === best);
  return who + ' ' + verb + ' ' + chips(bestAmount) +
    (results.showdown && hand ? ' with ' + hand.description.toLowerCase() + '.' : '.');
}

function capitalise(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}
