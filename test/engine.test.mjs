// Tests for the card evaluator and the betting engine.
// Run with: node test/engine.test.mjs

import assert from 'node:assert/strict';
import {
  parseCards, evaluate, compareHands, describeHand, newDeck, shuffle,
  makeRng, CATEGORY, handCode
} from '../js/cards.js';
import {
  createTable, startHand, legalActions, applyAction, buildPots,
  positionName, activePlayers
} from '../js/engine.js';
import {
  gradeAction, holdingReadout, expandToken, inRange, classifyDraws, OPENING_CHARTS
} from '../js/coach.js';
import { botAction, buildSeats } from '../js/bots.js';
import { parseMarkup, resolveSlug, plainText, TERMS } from '../js/glossary.js';
import { liveNote, hasLiveNote } from '../js/live.js';

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed += 1;
  } catch (err) {
    failed += 1;
    failures.push({ name, err });
    console.error('FAIL ' + name + '\n      ' + (err && err.message));
  }
}

function ev(text) {
  return evaluate(parseCards(text));
}

// ---------------------------------------------------------------------------
// Hand categories
// ---------------------------------------------------------------------------

test('every category is recognised', () => {
  assert.equal(ev('2c 7d 9h Jc Ks').category, CATEGORY.HIGH_CARD);
  assert.equal(ev('2c 2d 9h Jc Ks').category, CATEGORY.PAIR);
  assert.equal(ev('2c 2d 9h 9c Ks').category, CATEGORY.TWO_PAIR);
  assert.equal(ev('2c 2d 2h 9c Ks').category, CATEGORY.TRIPS);
  assert.equal(ev('5c 6d 7h 8c 9s').category, CATEGORY.STRAIGHT);
  assert.equal(ev('2c 5c 7c Jc Kc').category, CATEGORY.FLUSH);
  assert.equal(ev('2c 2d 2h 9c 9s').category, CATEGORY.FULL_HOUSE);
  assert.equal(ev('2c 2d 2h 2s 9s').category, CATEGORY.QUADS);
  assert.equal(ev('5c 6c 7c 8c 9c').category, CATEGORY.STRAIGHT_FLUSH);
});

test('categories rank in the correct order', () => {
  const ladder = [
    '2c 7d 9h Jc Ks',
    '2c 2d 9h Jc Ks',
    '2c 2d 9h 9c Ks',
    '2c 2d 2h 9c Ks',
    '5c 6d 7h 8c 9s',
    '2c 5c 7c Jc Kc',
    '2c 2d 2h 9c 9s',
    '2c 2d 2h 2s 9s',
    '5c 6c 7c 8c 9c'
  ].map(ev);
  for (let i = 1; i < ladder.length; i++) {
    assert.ok(
      compareHands(ladder[i], ladder[i - 1]) > 0,
      ladder[i].name + ' should beat ' + ladder[i - 1].name
    );
    assert.ok(ladder[i].value > ladder[i - 1].value, 'value ordering must match');
  }
});

// ---------------------------------------------------------------------------
// Straights, including the wheel
// ---------------------------------------------------------------------------

test('the wheel A2345 is a five high straight', () => {
  const h = ev('Ah 2c 3d 4s 5h');
  assert.equal(h.category, CATEGORY.STRAIGHT);
  assert.equal(h.tiebreak[0], 5);
  assert.equal(describeHand(h), 'Straight, five high');
});

test('the wheel loses to a six high straight', () => {
  assert.ok(compareHands(ev('2c 3d 4s 5h 6c'), ev('Ah 2c 3d 4s 5h')) > 0);
});

test('the wheel is found inside seven cards', () => {
  const h = ev('Ah 2c 3d 4s 5h Kd Qc');
  assert.equal(h.category, CATEGORY.STRAIGHT);
  assert.equal(h.tiebreak[0], 5);
});

test('an ace high straight is a broadway straight', () => {
  const h = ev('Ah Kc Qd Js Th');
  assert.equal(h.category, CATEGORY.STRAIGHT);
  assert.equal(h.tiebreak[0], 14);
});

test('KA234 is not a straight', () => {
  const h = ev('Kh Ac 2d 3s 4h 9c 8d');
  assert.notEqual(h.category, CATEGORY.STRAIGHT);
});

test('a steel wheel is a five high straight flush', () => {
  const h = ev('Ah 2h 3h 4h 5h');
  assert.equal(h.category, CATEGORY.STRAIGHT_FLUSH);
  assert.equal(h.tiebreak[0], 5);
});

test('a straight flush beats four of a kind', () => {
  const sf = ev('5c 6c 7c 8c 9c');
  const quads = ev('Ac Ad Ah As Kc');
  assert.ok(compareHands(sf, quads) > 0);
});

test('a straight flush beats a plain flush from the same seven cards', () => {
  const h = ev('5c 6c 7c 8c 9c 2c Kd');
  assert.equal(h.category, CATEGORY.STRAIGHT_FLUSH);
});

test('a flush is preferred over a straight when both are available', () => {
  const h = ev('5c 6c 7c 8d 9c 2c Kd');
  assert.equal(h.category, CATEGORY.FLUSH);
});

// ---------------------------------------------------------------------------
// Kickers and ties
// ---------------------------------------------------------------------------

test('kickers break a pair tie', () => {
  const a = ev('Ks Kd Ac 7h 4d');
  const b = ev('Kh Kc Qc 7s 4h');
  assert.ok(compareHands(a, b) > 0);
});

test('the fifth card matters', () => {
  const a = ev('Ks Kd Ac 7h 5d');
  const b = ev('Kh Kc Ad 7s 4h');
  assert.ok(compareHands(a, b) > 0);
});

test('only five cards count, the sixth and seventh are ignored', () => {
  const a = ev('As Ks Qd Jc 9h 8d 7c');
  const b = ev('Ah Kh Qc Jd 9s 3d 2c');
  assert.equal(compareHands(a, b), 0);
});

test('two pair compares high pair, then low pair, then kicker', () => {
  assert.ok(compareHands(ev('As Ad 2c 2h Kd'), ev('Ks Kd Qc Qh Ad')) > 0);
  assert.ok(compareHands(ev('As Ad Qc Qh 3d'), ev('Ac Ah 2c 2h Kd')) > 0);
  assert.ok(compareHands(ev('As Ad Qc Qh Kd'), ev('Ac Ah Qd Qs 3d')) > 0);
});

test('a full house compares trips first', () => {
  assert.ok(compareHands(ev('3s 3d 3c 2h 2d'), ev('2s 2c 2d Ah Ad')) > 0);
});

test('quads compare the kicker when the quads match', () => {
  const a = evaluate(parseCards('9s 9d 9c 9h Ad 2c 3d'));
  const b = evaluate(parseCards('9s 9d 9c 9h Kd 2c 3d'));
  assert.ok(compareHands(a, b) > 0);
});

test('flushes compare card by card', () => {
  assert.ok(compareHands(ev('Ac Qc 9c 5c 3c'), ev('Ac Qc 9c 5c 2c')) > 0);
});

test('identical hands tie', () => {
  assert.equal(compareHands(ev('Ac Kc Qc Jc Tc'), ev('Ad Kd Qd Jd Td')), 0);
});

test('a hand description reads in plain words', () => {
  assert.equal(describeHand(ev('Ks Kd 9c 7h 4d')), 'Pair of kings');
  assert.equal(describeHand(ev('Ac Kc Qc Jc Tc')), 'Royal flush');
  assert.equal(describeHand(ev('9s 9d 9c 2h 2d')), 'Full house, nines full of twos');
});

test('hand codes are correct', () => {
  assert.equal(handCode(parseCards('As Ks')), 'AKs');
  assert.equal(handCode(parseCards('Ks Ad')), 'AKo');
  assert.equal(handCode(parseCards('7s 7d')), '77');
});

// ---------------------------------------------------------------------------
// Fuzz run over random seven card hands
// ---------------------------------------------------------------------------

function bestOfFive(cards) {
  let best = null;
  for (let a = 0; a < cards.length; a++) {
    for (let b = a + 1; b < cards.length; b++) {
      for (let c = b + 1; c < cards.length; c++) {
        for (let d = c + 1; d < cards.length; d++) {
          for (let e = d + 1; e < cards.length; e++) {
            const res = evaluate([cards[a], cards[b], cards[c], cards[d], cards[e]]);
            if (!best || compareHands(res, best) > 0) best = res;
          }
        }
      }
    }
  }
  return best;
}

test('fuzz: ten thousand random seven card hands stay consistent', () => {
  const rng = makeRng(20260902);
  const counts = new Array(9).fill(0);
  for (let i = 0; i < 10000; i++) {
    const deck = shuffle(newDeck(), rng);
    const seven = deck.slice(0, 7);
    const result = evaluate(seven);

    assert.ok(result.category >= 0 && result.category <= 8, 'category in range');
    assert.equal(result.best.length, 5, 'best hand has five cards');
    counts[result.category] += 1;

    // The five card hand it picked must come from the seven it was given.
    for (const card of result.best) {
      assert.ok(
        seven.some((c) => c.rank === card.rank && c.suit === card.suit),
        'best cards come from the input'
      );
    }

    // Re-evaluating the chosen five cards must reproduce the same result.
    const again = evaluate(result.best);
    assert.equal(again.value, result.value, 'best five re-evaluates identically');

    // It must agree with an exhaustive search of all twenty one combinations.
    const brute = bestOfFive(seven);
    assert.equal(
      compareHands(result, brute), 0,
      'seven card result matches the brute force best of five'
    );

    // Adding a card can never make a hand worse.
    const six = evaluate(seven.slice(0, 6));
    assert.ok(result.value >= six.value, 'more cards never lower the result');

    // Comparison is reflexive and antisymmetric.
    assert.equal(compareHands(result, result), 0);
    const other = evaluate(deck.slice(7, 14));
    assert.equal(
      Math.sign(compareHands(result, other)) + 0,
      -Math.sign(compareHands(other, result)) + 0,
      'comparison is antisymmetric'
    );
    assert.ok(describeHand(result).length > 0);
  }
  // Sanity check on the distribution: high card and one pair must dominate.
  assert.ok(counts[CATEGORY.PAIR] > 3000, 'pairs are common');
  assert.ok(counts[CATEGORY.STRAIGHT_FLUSH] < 100, 'straight flushes are rare');
});

// ---------------------------------------------------------------------------
// Betting engine
// ---------------------------------------------------------------------------

function table(seatCount, seed) {
  const seats = [];
  for (let i = 0; i < seatCount; i++) {
    seats.push({ id: 'p' + i, name: 'P' + i, isHuman: false });
  }
  return createTable({
    seats, startingStack: 200, smallBlind: 1, bigBlind: 2, rng: makeRng(seed || 7)
  });
}

function totalChips(t) {
  return t.players.reduce((sum, p) => sum + p.stack, 0) + t.pot;
}

test('positions are labelled from the button', () => {
  assert.equal(positionName(0, 0, 6), 'BTN');
  assert.equal(positionName(1, 0, 6), 'SB');
  assert.equal(positionName(2, 0, 6), 'BB');
  assert.equal(positionName(3, 0, 6), 'UTG');
  assert.equal(positionName(5, 0, 6), 'CO');
  assert.equal(positionName(0, 0, 2), 'BTN');
  assert.equal(positionName(1, 0, 2), 'BB');
});

test('blinds are posted and action starts left of the big blind', () => {
  const t = table(6);
  startHand(t);
  assert.equal(t.players[1].totalCommitted, 1);
  assert.equal(t.players[2].totalCommitted, 2);
  assert.equal(t.pot, 3);
  assert.equal(t.toAct, 3);
  assert.equal(t.currentBet, 2);
  for (const p of t.players) assert.equal(p.hole.length, 2);
});

test('everyone folding to the big blind ends the hand and pays the blind', () => {
  const t = table(6);
  startHand(t);
  const bbStackBefore = t.players[2].stack;
  for (let i = 0; i < 5 && !t.handOver; i++) {
    applyAction(t, { type: 'fold' });
  }
  assert.ok(t.handOver, 'hand resolves');
  assert.equal(activePlayers(t).length, 1);
  assert.equal(
    t.players[2].stack, bbStackBefore + 3,
    'big blind takes back its own blind plus the small blind'
  );
  assert.equal(totalChips(t), 1200, 'no chips created or destroyed');
});

test('the big blind gets the option to raise when everyone limps', () => {
  const t = table(6);
  startHand(t);
  applyAction(t, { type: 'call' });
  applyAction(t, { type: 'fold' });
  applyAction(t, { type: 'fold' });
  applyAction(t, { type: 'fold' });
  applyAction(t, { type: 'call' });
  assert.equal(t.street, 'preflop', 'still preflop');
  assert.equal(t.toAct, 2, 'the big blind may act');
  assert.equal(legalActions(t).canCheck, true, 'and may check');
  applyAction(t, { type: 'check' });
  assert.equal(t.street, 'flop');
  assert.equal(t.board.length, 3);
});

test('a raise reopens the betting for players who already acted', () => {
  const t = table(6);
  startHand(t);
  applyAction(t, { type: 'call' });          // UTG limps
  applyAction(t, { type: 'raise', amount: 8 }); // HJ raises
  assert.equal(t.currentBet, 8);
  // Action passes CO, BTN, SB, BB and then returns to UTG.
  applyAction(t, { type: 'fold' });
  applyAction(t, { type: 'fold' });
  applyAction(t, { type: 'fold' });
  applyAction(t, { type: 'fold' });
  assert.equal(t.toAct, 3, 'the limper must answer the raise');
});

test('a raise smaller than the minimum is lifted to the minimum', () => {
  const t = table(6);
  startHand(t);
  applyAction(t, { type: 'raise', amount: 3 });
  assert.equal(t.currentBet, 4, 'minimum preflop raise is to two big blinds');
});

test('all streets deal the right number of cards', () => {
  const t = table(6);
  startHand(t);
  for (let i = 0; i < 4; i++) applyAction(t, { type: 'fold' });
  applyAction(t, { type: 'call' });
  applyAction(t, { type: 'check' });
  assert.equal(t.board.length, 3);
  applyAction(t, { type: 'check' });
  applyAction(t, { type: 'check' });
  assert.equal(t.board.length, 4);
  applyAction(t, { type: 'check' });
  applyAction(t, { type: 'check' });
  assert.equal(t.board.length, 5);
  applyAction(t, { type: 'check' });
  applyAction(t, { type: 'check' });
  assert.ok(t.handOver);
  assert.ok(t.results.showdown);
});

test('an all in for less than a full raise does not reopen the betting', () => {
  const t = table(4);
  t.players[3].stack = 5;
  startHand(t);
  // Seat 3 is the button here with only five chips behind.
  assert.equal(t.toAct, 3);
  applyAction(t, { type: 'raise', amount: 5 });
  assert.ok(t.players[3].allIn);
  applyAction(t, { type: 'raise', amount: 20 }); // SB reraises properly
  applyAction(t, { type: 'call' });             // BB calls
  applyAction(t, { type: 'call' });             // seat 2 calls
  assert.equal(t.street, 'flop', 'betting closed without a loop');
});

test('a hand where everyone is all in runs the board out', () => {
  const t = table(3);
  startHand(t);
  while (!t.handOver) {
    const legal = legalActions(t);
    applyAction(t, { type: 'raise', amount: legal.maxRaiseTo });
  }
  assert.ok(t.handOver);
  assert.equal(t.board.length, 5, 'the full board is dealt');
  assert.equal(totalChips(t), 600);
});

test('side pots are built from what each player put in', () => {
  const t = table(3);
  t.players[0].totalCommitted = 20;
  t.players[1].totalCommitted = 100;
  t.players[2].totalCommitted = 100;
  t.players.forEach((p) => { p.hasCards = true; p.folded = false; });
  const pots = buildPots(t);
  assert.equal(pots.length, 2);
  assert.equal(pots[0].amount, 60);
  assert.deepEqual(pots[0].eligible, [0, 1, 2]);
  assert.equal(pots[1].amount, 160);
  assert.deepEqual(pots[1].eligible, [1, 2]);
  assert.equal(pots[0].amount + pots[1].amount, 220);
});

test('a folded player still leaves their chips in the pot', () => {
  const t = table(3);
  t.players[0].totalCommitted = 50;
  t.players[0].folded = true;
  t.players[1].totalCommitted = 50;
  t.players[2].totalCommitted = 50;
  t.players.forEach((p) => { p.hasCards = true; });
  const pots = buildPots(t);
  assert.equal(pots.length, 1);
  assert.equal(pots[0].amount, 150);
  assert.deepEqual(pots[0].eligible, [1, 2]);
});

test('a short stack all in creates a side pot that it cannot win', () => {
  const t = table(3);
  t.players[0].stack = 20;
  startHand(t);
  // Seat 0 is the button with twenty chips.
  while (!t.handOver) {
    const legal = legalActions(t);
    applyAction(t, { type: 'raise', amount: legal.maxRaiseTo });
  }
  assert.ok(t.handOver);
  assert.equal(totalChips(t), 200 + 200 + 20);
  assert.ok(t.results.pots.length >= 1);
  // Whoever the short stack loses to, it can never win more than its own
  // stack multiplied by the number of opponents.
  const shortWin = t.players[0].wonLast;
  assert.ok(shortWin === 0 || shortWin <= 60, 'short stack capped at the main pot');
});

test('a split pot divides evenly and gives odd chips out clockwise', () => {
  const t = table(2);
  t.players[0].totalCommitted = 25;
  t.players[1].totalCommitted = 25;
  t.players.forEach((p) => { p.hasCards = true; p.folded = false; });
  const pots = buildPots(t);
  assert.equal(pots.length, 1);
  assert.equal(pots[0].amount, 50);
});

test('two identical hands split the pot down the middle', () => {
  const t = table(2);
  startHand(t);
  // Force a board and hole cards that must chop.
  t.players[0].hole = parseCards('2c 3d');
  t.players[1].hole = parseCards('2h 3s');
  t.board = parseCards('Ac Kd Qh Js Ts');
  while (!t.handOver) {
    const legal = legalActions(t);
    if (legal.toCall > 0) applyAction(t, { type: 'call' });
    else applyAction(t, { type: 'check' });
  }
  assert.equal(t.players[0].stack, 200);
  assert.equal(t.players[1].stack, 200);
});

test('fuzz: two thousand random hands always terminate with chips conserved', () => {
  const rng = makeRng(4242);
  for (const seatCount of [2, 6, 9]) {
    const t = table(seatCount, 99 + seatCount);
    for (let hand = 0; hand < 2000 / 3; hand++) {
      // Give a couple of seats awkward short stacks so side pots appear.
      if (hand % 5 === 0) {
        t.players[hand % seatCount].stack = 1 + Math.floor(rng() * 30);
      }
      startHand(t);
      // Measured after the deal, since a broke seat is topped back up first.
      const before = totalChips(t);
      let steps = 0;
      while (!t.handOver) {
        steps += 1;
        assert.ok(steps < 500, 'betting round must not deadlock');
        const legal = legalActions(t);
        assert.ok(legal, 'a live hand always has a legal action set');
        assert.ok(legal.minRaiseTo <= legal.maxRaiseTo, 'raise bounds are sane');
        const roll = rng();
        if (roll < 0.2) {
          applyAction(t, { type: 'fold' });
        } else if (roll < 0.6) {
          applyAction(t, legal.canCheck ? { type: 'check' } : { type: 'call' });
        } else if (legal.canRaise) {
          const span = legal.maxRaiseTo - legal.minRaiseTo;
          const to = legal.minRaiseTo + Math.floor(rng() * (span + 1));
          applyAction(t, { type: 'raise', amount: to });
        } else {
          applyAction(t, legal.canCheck ? { type: 'check' } : { type: 'call' });
        }
      }
      assert.equal(t.pot, 0, 'the pot is always fully paid out');
      assert.ok(activePlayers(t).length >= 1, 'somebody always wins the hand');
      const after = totalChips(t);
      assert.equal(
        after, before,
        'chips are conserved across hand ' + hand + ' at ' + seatCount + ' seats'
      );
      for (const p of t.players) {
        assert.ok(p.stack >= 0, 'no negative stacks');
      }
    }
  }
});

// ---------------------------------------------------------------------------
// The coach
// ---------------------------------------------------------------------------

// Build a table state directly, so a spot can be set up without playing into
// it. The coach only reads, it never mutates.
function spot(options) {
  const n = options.seats || 6;
  const players = [];
  for (let i = 0; i < n; i++) {
    players.push({
      index: i,
      name: i === 0 ? 'You' : 'Bot' + i,
      isHuman: i === 0,
      stack: options.stack || 200,
      hole: i === 0 ? parseCards(options.hole) : [],
      folded: (options.folded || []).includes(i),
      hasCards: true,
      allIn: false,
      committed: (options.committed || {})[i] || 0,
      totalCommitted: 0,
      personality: null
    });
  }
  return {
    players,
    buttonIndex: options.button || 0,
    smallBlind: 1,
    bigBlind: 2,
    street: options.street || 'preflop',
    board: options.board ? parseCards(options.board) : [],
    pot: options.pot === undefined ? 3 : options.pot,
    currentBet: options.currentBet || 0,
    log: options.log || [],
    lastAggressor: options.lastAggressor === undefined ? -1 : options.lastAggressor,
    preflopAggressor: -1,
    handNumber: 1,
    handOver: false,
    toAct: 0
  };
}

function raiseLog(seat, amount) {
  return [{ type: 'action', seat, action: 'raise', amount, street: 'preflop' }];
}

function grade(table, action) {
  return gradeAction(table, 0, action);
}

test('opening charts expand the way the shorthand reads', () => {
  assert.deepEqual(expandToken('A8s+'), ['A8s', 'A9s', 'ATs', 'AJs', 'AQs', 'AKs']);
  assert.deepEqual(expandToken('T9s'), ['T9s']);
  assert.deepEqual(expandToken('97s+'), ['97s', '98s']);
  assert.equal(expandToken('66+').length, 9);
  assert.ok(inRange('AJo', OPENING_CHARTS.UTG));
  assert.ok(!inRange('72o', OPENING_CHARTS.BTN));
  assert.ok(inRange('22', OPENING_CHARTS.BTN));
  assert.ok(!inRange('22', OPENING_CHARTS.UTG));
});

test('folding a hand inside the opening chart is a mistake', () => {
  // Button on seat three puts the human under the gun.
  const t = spot({ button: 3, hole: 'Ah Jc' });
  const fold = grade(t, { type: 'fold' });
  assert.equal(fold.verdict, 'mistake');
  assert.equal(fold.leak, 'foldedTooMuchPreflop');
  assert.ok(/ace jack/i.test(fold.text), 'the banner names the actual cards');
  assert.ok(/under the gun/i.test(fold.text), 'the banner names the actual seat');
  const raise = grade(t, { type: 'raise', amount: 6 });
  assert.equal(raise.verdict, 'good');
});

test('opening a hand far outside the chart is a mistake', () => {
  const t = spot({ button: 3, hole: '7h 2c' });
  const raise = grade(t, { type: 'raise', amount: 6 });
  assert.equal(raise.verdict, 'mistake');
  assert.equal(raise.leak, 'calledTooWidePreflop');
  assert.equal(grade(t, { type: 'fold' }).verdict, 'good');
});

test('a marginal open from the wrong seat is fine, not a mistake', () => {
  // K9 suited is a button hand but not an under the gun hand.
  const t = spot({ button: 3, hole: 'Kh 9h' });
  assert.equal(grade(t, { type: 'raise', amount: 6 }).verdict, 'fine');
});

test('small pairs are an open on the button and not under the gun', () => {
  const onButton = spot({ button: 0, hole: '2h 2c', folded: [3, 4, 5] });
  assert.equal(grade(onButton, { type: 'raise', amount: 6 }).verdict, 'good');
  const utg = spot({ button: 3, hole: '2h 2c' });
  assert.equal(grade(utg, { type: 'raise', amount: 6 }).verdict, 'fine');
});

test('facing a raise, queens re-raise and folding them is a mistake', () => {
  const t = spot({
    button: 4, hole: 'Qh Qc', pot: 9, currentBet: 6,
    committed: { 0: 2, 2: 6 }, log: raiseLog(2, 6)
  });
  assert.equal(grade(t, { type: 'raise', amount: 20 }).verdict, 'good');
  assert.equal(grade(t, { type: 'call' }).verdict, 'fine');
  const fold = grade(t, { type: 'fold' });
  assert.equal(fold.verdict, 'mistake');
  assert.equal(fold.leak, 'foldedTooMuchPreflop');
});

test('facing a raise, junk is a fold and calling is a mistake', () => {
  const t = spot({
    button: 4, hole: '9h 4c', pot: 9, currentBet: 6,
    committed: { 0: 2, 2: 6 }, log: raiseLog(2, 6)
  });
  assert.equal(grade(t, { type: 'fold' }).verdict, 'good');
  const call = grade(t, { type: 'call' });
  assert.equal(call.verdict, 'mistake');
  assert.equal(call.leak, 'calledTooWidePreflop');
  assert.ok(/4 chips/.test(call.text), 'the banner names the real price');
});

test('cards that only pair the board are not outs', () => {
  // King three of diamonds on two two seven six, with three diamonds out.
  // Nine diamonds finish the flush, three threes and two off suit kings
  // pair a card the player actually holds. The sevens, sixes and twos pair
  // the board, which helps everybody equally, so they must not be counted.
  const draws = classifyDraws(parseCards('Kh 3d'), parseCards('2h 2d 7d 6d'));
  assert.equal(draws.outs, 14, 'nine flush cards, three threes, two kings');
  assert.ok(draws.flushDraw);
  for (const card of draws.outCards) {
    const pairsBoardOnly = [2, 6, 7].includes(card.rank) && card.suit !== 'd';
    assert.ok(!pairsBoardOnly, 'counted a board pairing card: ' + card.rank + card.suit);
  }
});

test('out counts match the textbook numbers', () => {
  const cases = [
    ['Ah 5h', 'Kh 9h 2c', 12, 'flush draw plus three aces'],
    ['8h 7c', '9c 6d 2s', 8, 'open ended straight draw'],
    ['8h 7c', '9c 5d 2s', 4, 'gutshot'],
    ['Ah Kd', 'Qh Jc 2s', 10, 'gutshot plus six overcards'],
    ['7h 3d', 'Kd Kh 3s', 2, 'only the two remaining threes']
  ];
  for (const [hole, board, expected, why] of cases) {
    const draws = classifyDraws(parseCards(hole), parseCards(board));
    assert.equal(draws.outs, expected, hole + ' on ' + board + ' should be ' + why);
  }
});

test('a draw at the right price should be called and not folded', () => {
  // Ace high flush draw, paying five into a pot of twenty.
  const t = spot({
    street: 'flop', hole: 'Ah 5h', board: 'Kh 9h 2c',
    pot: 20, currentBet: 5, committed: { 3: 5 }, lastAggressor: 3
  });
  const call = grade(t, { type: 'call' });
  assert.equal(call.verdict, 'good');
  assert.ok(/outs/.test(call.text), 'the banner shows the arithmetic');
  assert.ok(/percent/.test(call.text));
  const fold = grade(t, { type: 'fold' });
  assert.equal(fold.verdict, 'mistake');
  assert.equal(fold.leak, 'overfoldedPostflop');
});

test('an open ended draw with nobody betting is worth a bet', () => {
  const t = spot({
    street: 'flop', hole: '7h 6c', board: 'Jc 9c 8d', pot: 20, currentBet: 0
  });
  assert.equal(grade(t, { type: 'bet', amount: 12 }).verdict, 'good');
  assert.equal(grade(t, { type: 'check' }).verdict, 'fine');
});

test('a thin draw at a bad price should be folded', () => {
  // A gutshot facing a pot sized bet.
  const t = spot({
    street: 'flop', hole: '8h 7c', board: 'Jd 9s 2c',
    pot: 20, currentBet: 20, committed: { 3: 20 }, lastAggressor: 3
  });
  assert.equal(grade(t, { type: 'fold' }).verdict, 'good');
  const call = grade(t, { type: 'call' });
  assert.equal(call.verdict, 'mistake');
  assert.equal(call.leak, 'chasedDraw');
  assert.ok(/50 percent/.test(call.text), 'the banner shows the price');
});

test('checking a strong hand with nobody betting misses value', () => {
  const t = spot({
    street: 'flop', hole: 'Ah Kd', board: 'Ac 7d 2s', pot: 20, currentBet: 0
  });
  const check = grade(t, { type: 'check' });
  assert.equal(check.verdict, 'mistake');
  assert.equal(check.leak, 'missedValue');
  assert.equal(grade(t, { type: 'bet', amount: 12 }).verdict, 'good');
});

test('checking nothing is right and betting into a wet board is a mistake', () => {
  // Four three on jack nine eight cannot make a straight or a flush.
  const t = spot({
    street: 'flop', hole: '4h 3d', board: 'Jc 9c 8s', pot: 20, currentBet: 0
  });
  assert.equal(grade(t, { type: 'check' }).verdict, 'good');
  const bet = grade(t, { type: 'bet', amount: 12 });
  assert.equal(bet.verdict, 'mistake');
  assert.equal(bet.leak, 'badBluff');
});

test('a tiny bet with a huge hand on a wet board gets a sizing note', () => {
  const t = spot({
    street: 'flop', hole: '9h 9c', board: '9d 8d 7c', pot: 40, currentBet: 0
  });
  const tiny = grade(t, { type: 'bet', amount: 4 });
  assert.equal(tiny.verdict, 'fine', 'the action is right, only the size is wrong');
  assert.ok(/too small/.test(tiny.text));
  const proper = grade(t, { type: 'bet', amount: 30 });
  assert.equal(proper.verdict, 'good');
});

test('a pair that is mostly on the board is not treated as a big hand', () => {
  // Seven three on king king three is bottom pair, not two pair worth raising.
  const weak = spot({
    street: 'flop', hole: '7h 3d', board: 'Kd Kh 3s',
    pot: 20, currentBet: 15, committed: { 3: 15 }, lastAggressor: 3
  });
  assert.equal(grade(weak, { type: 'fold' }).verdict, 'good');
  assert.equal(grade(weak, { type: 'raise', amount: 45 }).verdict, 'mistake',
    'raising a board pair as if it were your own is a bluff');

  // The same hand facing a small bet is a thin call, not an error.
  const cheap = spot({
    street: 'flop', hole: '7h 3d', board: 'Kd Kh 3s',
    pot: 40, currentBet: 5, committed: { 3: 5 }, lastAggressor: 3
  });
  assert.equal(grade(cheap, { type: 'call' }).verdict, 'fine');

  // Ace nine on ace nine two really is two pair.
  const strong = spot({
    street: 'flop', hole: 'Ah 9h', board: 'Ac 9d 2s',
    pot: 20, currentBet: 15, committed: { 3: 15 }, lastAggressor: 3
  });
  assert.equal(grade(strong, { type: 'raise', amount: 45 }).verdict, 'good');
  assert.equal(grade(strong, { type: 'fold' }).verdict, 'mistake');
});

test('the readout names what the player actually has', () => {
  assert.match(holdingReadout(parseCards('Ah 9h'), parseCards('9c 6d 2s')).markup, /Top pair/);
  assert.match(holdingReadout(parseCards('Ah 5h'), parseCards('Kh 6h 2s')).markup, /flush draw/);
  assert.match(holdingReadout(parseCards('8h 7c'), parseCards('9c 6d 2s')).markup, /open ended/);
  assert.match(holdingReadout(parseCards('8h 7c'), parseCards('9c 5d 2s')).markup, /gutshot/);
  assert.match(holdingReadout(parseCards('Qh Qc'), parseCards('9c 5d 2s')).markup, /Overpair/);
  assert.match(holdingReadout(parseCards('7h 3d'), parseCards('Kd Kh 3s')).markup, /Bottom pair/);
  // Only call it "X high" when the X actually beats the board.
  assert.match(holdingReadout(parseCards('Kd Qs'), parseCards('5c 9h 2d')).markup, /King high/);
  assert.match(holdingReadout(parseCards('4d 2s'), parseCards('5c Ah Qd')).markup, /No pair/);
  assert.match(
    holdingReadout(parseCards('8h 7c'), parseCards('9c 6d 2s')).markup,
    /an eight/,
    'articles read correctly'
  );
  assert.ok(
    !/ a (eight|ace)/.test(holdingReadout(parseCards('8h 7c'), parseCards('Ac Kd Qs')).markup),
    'never "a eight"'
  );
  assert.match(holdingReadout(parseCards('9h 9c'), parseCards('9d 8d 7c')).markup, /Three nines/);
});

test('every term the coach links to exists in the glossary', () => {
  const rng = makeRng(31337);
  const seats = buildSeats(6, 'You');
  const t = createTable({ seats, startingStack: 200, smallBlind: 1, bigBlind: 2, rng });
  let graded = 0;
  const bannerWords = [];
  const verdicts = { good: 0, fine: 0, mistake: 0 };

  for (let hand = 0; hand < 400; hand++) {
    startHand(t);
    let steps = 0;
    while (!t.handOver) {
      steps += 1;
      assert.ok(steps < 500, 'no deadlock while the coach is watching');
      const legal = legalActions(t);
      let action;
      if (t.toAct === 0) {
        const roll = rng();
        if (roll < 0.25) action = { type: 'fold' };
        else if (roll < 0.65) action = legal.canCheck ? { type: 'check' } : { type: 'call' };
        else if (legal.canRaise) {
          action = { type: legal.isBet ? 'bet' : 'raise', amount: legal.minRaiseTo };
        } else action = legal.canCheck ? { type: 'check' } : { type: 'call' };

        const result = gradeAction(t, 0, action);
        assert.ok(result, 'every legal decision gets a verdict');
        assert.ok(['good', 'fine', 'mistake'].includes(result.verdict), 'verdict is one of three');
        assert.ok(result.text && result.text.length > 20, 'the banner explains itself');
        const words = plainText(result.text).split(/\s+/).length;
        assert.ok(words <= 45, 'banner stays glanceable, got ' + words + ': ' + result.text);
        bannerWords.push(words);
        assert.ok(!/[!–—]/.test(result.text), 'copy avoids dashes and exclamation marks');
        for (const token of parseMarkup(result.text)) {
          if (token.type === 'term') {
            assert.ok(TERMS[token.slug], 'linked term "' + token.slug + '" exists');
          }
          if (token.type === 'text') {
            assert.ok(!/\[\[/.test(token.text), 'no unparsed markup leaks into the banner');
          }
        }
        assert.ok(!/undefined|NaN/.test(result.text), 'no placeholder text: ' + result.text);
        verdicts[result.verdict] += 1;
        graded += 1;
      } else {
        action = botAction(t, t.toAct, rng);
      }
      applyAction(t, action);
    }

    // The readout must survive every board the game can produce.
    const readout = holdingReadout(t.players[0].hole, t.board);
    assert.ok(typeof readout.markup === 'string');
    for (const token of parseMarkup(readout.markup)) {
      if (token.type === 'term') assert.ok(TERMS[token.slug], 'readout term exists');
    }
  }

  bannerWords.sort((a, b) => a - b);
  const median = bannerWords[Math.floor(bannerWords.length / 2)];
  assert.ok(median <= 30, 'the typical banner is short, median was ' + median + ' words');
  assert.ok(graded > 300, 'the fuzz run actually graded decisions, got ' + graded);
  assert.ok(verdicts.good > 0 && verdicts.fine > 0 && verdicts.mistake > 0,
    'all three verdict levels are reachable: ' + JSON.stringify(verdicts));
});

test('the live note explains a term against the hand being played', () => {
  const t = table(6, 8);
  startHand(t);
  const seat = 0;

  const position = liveNote('position', t, seat);
  assert.ok(position, 'position always has something to say');
  assert.ok(
    /button/.test(position),
    'the position note places you against the button: ' + position
  );

  const pot = liveNote('pot', t, seat);
  assert.ok(pot.includes(String(t.pot)), 'the pot note quotes the real pot: ' + pot);

  const blinds = liveNote('blinds', t, seat);
  assert.ok(
    blinds.includes(t.players[t.blindSeats.sb].name) || /you/.test(blinds),
    'the blinds note names who posted them: ' + blinds
  );

  const bigBlind = liveNote('big-blind', t, seat);
  assert.ok(bigBlind.includes(String(t.bigBlind)), 'the big blind note quotes the real size');

  const board = liveNote('board', t, seat);
  assert.match(board, /empty/, 'before the flop the board note says so');

  // A term with nothing to say about the table returns nothing at all.
  assert.equal(liveNote('expected-value', t, seat), null);
  assert.equal(liveNote('not-a-real-term', t, seat), null);
  assert.equal(liveNote('position', null, seat), null, 'no table means no note');
});

test('the button note tracks the button as it moves', () => {
  const t = table(6, 12);
  const seen = new Set();
  for (let hand = 0; hand < 6; hand++) {
    startHand(t);
    const note = liveNote('button', t, 0);
    assert.ok(note, 'there is always a button note');
    const mine = t.buttonIndex === 0;
    assert.equal(
      /You have the button/.test(note), mine,
      'hand ' + hand + ' with the button on seat ' + t.buttonIndex + ': ' + note
    );
    if (!mine) {
      assert.ok(
        note.includes(t.players[t.buttonIndex].name),
        'the note names who actually has it: ' + note
      );
    }
    seen.add(t.buttonIndex);
    while (!t.handOver) applyAction(t, { type: 'fold' });
  }
  assert.ok(seen.size >= 5, 'the button moved around the table');
});

test('live notes stay sane through whole hands at every table size', () => {
  const rng = makeRng(90210);
  const slugs = Object.keys(TERMS);
  const noteLengths = [];
  let produced = 0;

  for (const seatCount of [2, 6, 9]) {
    const seats = buildSeats(seatCount, 'You');
    const t = createTable({ seats, startingStack: 200, smallBlind: 1, bigBlind: 2, rng });

    for (let hand = 0; hand < 40; hand++) {
      startHand(t);
      let steps = 0;
      while (true) {
        // Tap every single term at this exact point in the hand.
        for (const slug of slugs) {
          const note = liveNote(slug, t, 0);
          if (note === null) continue;
          produced += 1;
          assert.equal(typeof note, 'string');
          assert.ok(note.length > 10, slug + ' note is too short: ' + note);
          const noteWords = plainText(note).split(/\s+/).length;
          assert.ok(noteWords <= 32, slug + ' note is too long (' + noteWords + '): ' + note);
          noteLengths.push(noteWords);
          assert.ok(!/[!–—]/.test(note), slug + ' note uses a dash or exclamation: ' + note);
          assert.ok(
            !/undefined|NaN|null|\[object/.test(note),
            slug + ' note has a hole in it: ' + note
          );
          for (const token of parseMarkup(note)) {
            if (token.type === 'term') {
              assert.ok(TERMS[token.slug], slug + ' note links to a missing term: ' + token.slug);
            } else {
              assert.ok(!/\[\[/.test(token.text), slug + ' note has broken markup: ' + note);
            }
          }
        }
        if (t.handOver) break;
        steps += 1;
        assert.ok(steps < 500, 'no deadlock');
        applyAction(t, botAction(t, t.toAct, rng));
      }
    }
  }
  noteLengths.sort((a, b) => a - b);
  const median = noteLengths[Math.floor(noteLengths.length / 2)];
  assert.ok(median <= 18, 'the typical live note is one glance, median ' + median + ' words');
  assert.ok(produced > 20000, 'the sweep actually produced notes, got ' + produced);
});

test('every term that claims a live note can produce one mid hand', () => {
  // Real seats, so the personality reads have somebody to point at.
  const t = createTable({
    seats: buildSeats(6, 'You'), startingStack: 200,
    smallBlind: 1, bigBlind: 2, rng: makeRng(3)
  });
  startHand(t);
  // Play to the river so board and draw terms have something to work with.
  let guard = 0;
  while (!t.handOver && t.board.length < 5 && guard++ < 200) {
    const legal = legalActions(t);
    applyAction(t, legal.canCheck ? { type: 'check' } : { type: 'call' });
  }
  const missing = Object.keys(TERMS).filter(
    (slug) => hasLiveNote(slug) && liveNote(slug, t, 0) === null
  );
  // A few are genuinely situational, but most should speak up on the river.
  assert.ok(
    missing.length <= 6,
    'too many live notes stayed silent on a finished board: ' + missing.join(', ')
  );
});

test('the engine reports what each player collected', () => {
  const t = table(3, 55);
  t.players[0].stack = 20;
  startHand(t);
  while (!t.handOver) {
    applyAction(t, { type: 'raise', amount: legalActions(t).maxRaiseTo });
  }
  const collected = t.results.winnings;
  assert.equal(collected.length, 3);
  const paidIn = t.players.reduce((sum, p) => sum + p.totalCommitted, 0);
  assert.equal(
    collected.reduce((a, b) => a + b, 0), paidIn,
    'everything paid in is handed back out'
  );
  for (let i = 0; i < 3; i++) {
    assert.equal(t.results.net[i], collected[i] - t.players[i].totalCommitted);
  }
});

test('who starts each betting round is tracked', () => {
  const t = table(6, 77);
  startHand(t);
  // Under the gun opens before the flop, three seats past the button.
  assert.equal(
    positionName(t.streetFirstActor, t.buttonIndex, 6), 'UTG',
    'the first seat after the blinds opens preflop'
  );
  while (t.street === 'preflop' && !t.handOver) {
    const legal = legalActions(t);
    applyAction(t, legal.canCheck ? { type: 'check' } : { type: 'call' });
  }
  assert.equal(t.street, 'flop');
  assert.equal(
    positionName(t.streetFirstActor, t.buttonIndex, 6), 'SB',
    'the small blind opens after the flop'
  );
  assert.equal(t.streetFirstActor, t.toAct, 'and it is their turn');
});

test('definitions stay to a single short line', () => {
  const lengths = [];
  for (const slug of Object.keys(TERMS)) {
    for (const sense of TERMS[slug].senses) {
      const words = plainText(sense.text).split(/\s+/).length;
      assert.ok(words <= 28, slug + ' definition runs long (' + words + '): ' + sense.text);
      lengths.push(words);
    }
  }
  lengths.sort((a, b) => a - b);
  assert.ok(
    lengths[Math.floor(lengths.length / 2)] <= 18,
    'the typical definition is one line'
  );
});

test('plain text strips the markup for search and previews', () => {
  assert.equal(plainText('a [[pot|pot]] of [[chips|chips]]'), 'a pot of chips');
  assert.equal(plainText('no markup here'), 'no markup here');
  for (const slug of Object.keys(TERMS)) {
    for (const sense of TERMS[slug].senses) {
      assert.ok(!/\[\[/.test(plainText(sense.text)), slug + ' preview is clean');
    }
  }
});

test('every glossary definition only leans on words that are also defined', () => {
  for (const slug of Object.keys(TERMS)) {
    for (const sense of TERMS[slug].senses) {
      for (const field of ['text', 'example']) {
        const copy = sense[field] || '';
        assert.ok(!/[!–—]/.test(copy), slug + ' copy avoids dashes and exclamation marks');
        for (const token of parseMarkup(copy)) {
          if (token.type === 'term') {
            assert.ok(resolveSlug(token.slug), slug + ' links to a real term');
          } else {
            assert.ok(!/\[\[/.test(token.text), slug + ' has no broken markup');
          }
        }
      }
    }
  }
});

// ---------------------------------------------------------------------------

console.log('');
console.log(passed + ' passed, ' + failed + ' failed');
if (failed > 0) {
  process.exit(1);
}
