// ui.js
// All DOM rendering. Nothing in here decides anything about poker, it just
// draws whatever the app hands it.

import { RANK_CHARS, SUIT_SYMBOLS, isRed, cardToString } from './cards.js';
import { parseMarkup, getTerm } from './glossary.js';

export const dom = {};

export function cacheDom() {
  const ids = [
    'hand-number', 'opponents', 'board', 'pot-amount',
    'table-message', 'hand-result', 'coach-banner', 'action-area', 'hero-cards',
    'hero-stack', 'hero-readout', 'sheet', 'sheet-title', 'sheet-body',
    'screen', 'screen-title', 'screen-body',
    'level-label', 'streak-label', 'level-fill', 'fold-hint'
  ];
  for (const id of ids) {
    dom[camel(id)] = document.getElementById(id);
  }
}

function camel(id) {
  return id.replace(/-([a-z])/g, (m, c) => c.toUpperCase());
}

// One place to ask whether motion is wanted, so every animated path can bail
// out together for anybody who has asked their phone to stop moving things.
let reducedMotion = false;
try {
  const query = window.matchMedia('(prefers-reduced-motion: reduce)');
  reducedMotion = query.matches;
  if (query.addEventListener) {
    query.addEventListener('change', (event) => { reducedMotion = event.matches; });
  }
} catch (err) {
  reducedMotion = false;
}

export function prefersReducedMotion() {
  return reducedMotion;
}

/**
 * Count a number up or down instead of snapping to it. Chip counts changing
 * by a visible amount is most of what makes a table feel alive.
 */
export function tweenNumber(node, value, duration) {
  const target = Math.round(value);
  const from = node.dataset.value === undefined ? target : Number(node.dataset.value);
  node.dataset.value = String(target);
  if (node.tweenFrame) cancelAnimationFrame(node.tweenFrame);
  if (from === target || reducedMotion) {
    node.textContent = String(target);
    return;
  }
  const ms = duration || 460;
  const started = performance.now();
  const step = (now) => {
    const progress = Math.min(1, (now - started) / ms);
    // Ease out cubic: quick off the mark, gentle landing.
    const eased = 1 - Math.pow(1 - progress, 3);
    node.textContent = String(Math.round(from + (target - from) * eased));
    if (progress < 1) node.tweenFrame = requestAnimationFrame(step);
    else node.tweenFrame = null;
  };
  node.tweenFrame = requestAnimationFrame(step);
}

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

/**
 * Turn copy written with [[slug|text]] markup into text nodes and tappable
 * term spans.
 */
export function renderMarkup(markup) {
  const frag = document.createDocumentFragment();
  for (const token of parseMarkup(String(markup || ''))) {
    if (token.type === 'term') {
      const span = el('span', 'term', token.text);
      span.dataset.term = token.slug;
      span.setAttribute('role', 'button');
      span.setAttribute('tabindex', '0');
      frag.appendChild(span);
    } else {
      frag.appendChild(document.createTextNode(token.text));
    }
  }
  return frag;
}

export function setMarkup(node, markup) {
  clear(node);
  node.appendChild(renderMarkup(markup));
}

// ------------------------------------------------------------------- cards

export function cardEl(card, options = {}) {
  const node = el('div', 'card');
  if (options.mini) node.className = 'mini-card face';
  if (options.faceDown) {
    node.className = options.mini ? 'mini-card' : 'card back';
    return node;
  }
  if (!card) {
    node.className = options.mini ? 'mini-card' : 'card empty';
    return node;
  }
  if (isRed(card)) node.classList.add('red');
  if (options.mini) {
    node.textContent = RANK_CHARS[card.rank] + SUIT_SYMBOLS[card.suit];
    return node;
  }
  node.appendChild(el('span', 'rank', RANK_CHARS[card.rank]));
  node.appendChild(el('span', 'suit', SUIT_SYMBOLS[card.suit]));
  return node;
}

let lastBoardCount = 0;
let boardSlots = null;

// A card is two faces on one hinge. Keeping the slots in the DOM is what
// lets a card actually turn over instead of being swapped out.
function buildBoardSlots() {
  clear(dom.board);
  boardSlots = [];
  for (let i = 0; i < 5; i++) {
    const root = el('div', 'slot');
    const inner = el('div', 'slot-inner');
    const back = el('div', 'slot-face back');
    const front = el('div', 'slot-face front');
    front.appendChild(el('span', 'rank'));
    front.appendChild(el('span', 'suit'));
    inner.appendChild(back);
    inner.appendChild(front);
    root.appendChild(inner);
    dom.board.appendChild(root);
    boardSlots.push({ root, inner, front });
  }
}

function paintFace(slot, card) {
  slot.front.firstChild.textContent = RANK_CHARS[card.rank];
  slot.front.lastChild.textContent = SUIT_SYMBOLS[card.suit];
  slot.front.classList.toggle('red', isRed(card));
}

export function renderBoard(board) {
  if (!boardSlots) buildBoardSlots();
  const previous = lastBoardCount;
  for (let i = 0; i < 5; i++) {
    const slot = boardSlots[i];
    const card = board[i];
    if (card) {
      paintFace(slot, card);
      // Cards arriving together turn over one after another.
      const delay = reducedMotion ? 0 : Math.max(0, i - previous) * 110;
      slot.inner.style.transitionDelay = delay + 'ms';
      slot.root.classList.add('revealed');
    } else {
      slot.inner.style.transitionDelay = '0ms';
      slot.root.classList.remove('revealed');
    }
  }
  lastBoardCount = board.length;
}

export function resetBoardAnimation() {
  lastBoardCount = 0;
}

// Treat this many board cards as already on the table, so a restored hand
// does not replay the deal.
export function primeBoard(count) {
  lastBoardCount = count;
}

// ------------------------------------------------------------------- seats

// Seats are built once and then updated in place. Rebuilding them on every
// action, which is what used to happen, made every transition impossible:
// nothing can ease from a value it never had.
let seatCache = { signature: null, nodes: new Map() };

export function renderSeats(table, options = {}) {
  const signature = table.players.map((p) => p.name).join('|');
  if (seatCache.signature !== signature) {
    clear(dom.opponents);
    seatCache = { signature, nodes: new Map() };
    for (const player of table.players) {
      if (player.isHuman) continue;
      const parts = buildSeat(player);
      seatCache.nodes.set(player.index, parts);
      dom.opponents.appendChild(parts.root);
    }
  }
  dom.opponents.classList.toggle('many', table.players.length > 6);
  for (const player of table.players) {
    if (player.isHuman) continue;
    updateSeat(seatCache.nodes.get(player.index), table, player, options);
  }
}

function buildSeat(player) {
  const root = el('div', 'seat');
  root.dataset.seat = String(player.index);
  const marker = el('div', 'seat-marker');
  const avatar = el('div', 'seat-avatar', player.avatar);
  const name = el('div', 'seat-name', player.name);
  const stack = el('div', 'seat-stack');
  const meta = el('div', 'seat-meta');
  const hole = el('div', 'seat-hole');
  const bet = el('div', 'seat-bet empty');
  root.appendChild(marker);
  root.appendChild(avatar);
  root.appendChild(name);
  root.appendChild(stack);
  root.appendChild(meta);
  root.appendChild(hole);
  root.appendChild(bet);
  return { root, avatar, name, stack, meta, hole, bet };
}

function updateSeat(parts, table, player, options) {
  if (!parts) return;
  const { root, stack, meta, hole, bet } = parts;

  root.classList.toggle('folded', player.folded || !player.hasCards);
  root.classList.toggle('acting', table.toAct === player.index && !table.handOver);
  root.classList.toggle('winner',
    !!(options.winners && options.winners.includes(player.index)));

  tweenNumber(stack, player.stack);

  // The tags are tiny and change rarely, so a signature check keeps the DOM
  // still unless something really moved.
  const blind = blindLabel(table, player.index);
  const tags = [
    table.streetFirstActor === player.index && !table.handOver ? 'start' : '',
    table.buttonIndex === player.index ? 'dealer' : '',
    blind || '',
    player.lastAction ? player.lastAction.split(' ')[0] : ''
  ].join(',');
  if (meta.dataset.tags !== tags) {
    meta.dataset.tags = tags;
    clear(meta);
    if (table.streetFirstActor === player.index && !table.handOver) {
      const badge = el('span', 'seat-tag start', '1ST');
      badge.title = 'Acts first this round';
      meta.appendChild(badge);
    }
    if (table.buttonIndex === player.index) {
      const badge = el('span', 'seat-tag dealer', 'D');
      badge.title = 'Dealer button';
      meta.appendChild(badge);
    }
    if (blind) {
      const badge = el('span', 'seat-tag blind' + (blind === 'BB' ? ' big' : ''), blind);
      badge.title = blind === 'BB' ? 'Big blind' : 'Small blind';
      meta.appendChild(badge);
    }
    if (player.lastAction) {
      meta.appendChild(el('span', 'seat-action', player.lastAction.split(' ')[0]));
    }
  }

  const reveal = !!(options.reveal && options.reveal.includes(player.index));
  const holeState = (player.hasCards && !player.folded)
    ? player.hole.map((c) => (reveal ? cardToString(c) : 'x')).join('')
    : '';
  if (hole.dataset.state !== holeState) {
    hole.dataset.state = holeState;
    clear(hole);
    if (holeState) {
      for (const card of player.hole) {
        hole.appendChild(cardEl(card, { mini: true, faceDown: !reveal }));
      }
    }
  }

  // The chip in front of a player: their bet during the hand, then what the
  // hand cost or made them once it is settled.
  const net = options.nets ? options.nets[player.index] : null;
  if (net !== null && net !== undefined && net !== 0) {
    bet.className = 'seat-bet ' + (net > 0 ? 'win' : 'lose');
    bet.textContent = (net > 0 ? '+' : '') + net;
    delete bet.dataset.value;
  } else if (player.committed > 0) {
    const appearing = bet.classList.contains('empty');
    bet.className = 'seat-bet';
    tweenNumber(bet, player.committed, 280);
    if (appearing && !reducedMotion) {
      bet.classList.remove('pop');
      void bet.offsetWidth;
      bet.classList.add('pop');
    }
  } else {
    bet.className = 'seat-bet empty';
    bet.textContent = '0';
    delete bet.dataset.value;
  }
}

/**
 * Where every bet chip is sitting right now, measured before the table is
 * redrawn. Handed straight to flyChipsToPot.
 */
export function captureBets() {
  if (reducedMotion || !seatCache.nodes.size) return [];
  const chips = [];
  for (const parts of seatCache.nodes.values()) {
    if (parts.bet.classList.contains('empty')) continue;
    const rect = parts.bet.getBoundingClientRect();
    if (!rect.width) continue;
    chips.push({ rect, text: parts.bet.textContent });
  }
  return chips;
}

/**
 * Slide the chips people just bet into the middle when a street closes, so
 * the pot growing is something you watch rather than a number that changes.
 */
export function flyChipsToPot(chips) {
  if (!chips || !chips.length || reducedMotion) return;
  const target = dom.potAmount.getBoundingClientRect();
  for (const chip of chips) {
    const ghost = el('div', 'chip-ghost', chip.text);
    ghost.style.left = chip.rect.left + 'px';
    ghost.style.top = chip.rect.top + 'px';
    ghost.style.width = chip.rect.width + 'px';
    ghost.style.height = chip.rect.height + 'px';
    document.body.appendChild(ghost);
    const dx = (target.left + target.width / 2) - (chip.rect.left + chip.rect.width / 2);
    const dy = (target.top + target.height / 2) - (chip.rect.top + chip.rect.height / 2);
    requestAnimationFrame(() => {
      ghost.style.transform = 'translate(' + dx + 'px, ' + dy + 'px) scale(0.5)';
      ghost.style.opacity = '0';
    });
    setTimeout(() => {
      if (ghost.parentNode) ghost.parentNode.removeChild(ghost);
    }, 620);
  }
}

// "SB" or "BB" for the seat, when it posted one this hand.
export function blindLabel(table, seatIndex) {
  const blinds = table.blindSeats;
  if (!blinds) return null;
  if (blinds.bb === seatIndex) return 'BB';
  if (blinds.sb === seatIndex) return 'SB';
  return null;
}

/**
 * Deal the cards out from the middle of the table, one at a time, in the
 * order they really go round: everybody gets one, then everybody gets a
 * second. Returns how long the whole thing takes so the game can wait for it.
 */
export function dealHandout(order, heroSeat) {
  if (reducedMotion || !order || !order.length) return 0;
  const deck = dom.board.getBoundingClientRect();
  if (!deck.width) return 0;
  const originX = deck.left + deck.width / 2;
  const originY = deck.top + deck.height / 2;
  const stagger = 42;
  let dealt = 0;

  for (let round = 0; round < 2; round++) {
    for (const seat of order) {
      const source = seat === heroSeat
        ? dom.heroCards
        : (seatCache.nodes.get(seat) || {}).hole;
      const node = source && source.children[round];
      if (!node) continue;
      const rect = node.getBoundingClientRect();
      if (!rect.width) continue;
      node.style.setProperty('--deal-x', (originX - (rect.left + rect.width / 2)) + 'px');
      node.style.setProperty('--deal-y', (originY - (rect.top + rect.height / 2)) + 'px');
      node.style.animationDelay = (dealt * stagger) + 'ms';
      node.classList.remove('handout');
      // Forces the animation to start again for a card that is being reused.
      void node.offsetWidth;
      node.classList.add('handout');
      dealt += 1;
    }
  }
  return dealt ? dealt * stagger + 360 : 0;
}

// ------------------------------------------------------------ fold gesture

// How far the cards have to travel before letting go throws the hand away.
const FOLD_DISTANCE = 66;

const foldDrag = {
  enabled: false,
  onFold: null,
  active: false,
  pointerId: null,
  startY: 0,
  distance: 0,
  wired: false
};

/**
 * Turned on only while folding is actually one of the choices, so the cards
 * are never draggable at a moment when throwing them away would do nothing.
 */
export function setFoldGesture(enabled, onFold) {
  foldDrag.enabled = !!enabled;
  foldDrag.onFold = onFold || null;
  if (!foldDrag.wired) wireFoldGesture();
  if (!enabled) {
    foldDrag.active = false;
    clearFoldDrag();
  }
  dom.heroCards.classList.toggle('draggable', !!enabled);
  dom.foldHint.classList.toggle('showing', !!enabled && !reducedMotion);
}

function wireFoldGesture() {
  foldDrag.wired = true;
  const node = dom.heroCards;

  node.addEventListener('pointerdown', (event) => {
    if (!foldDrag.enabled) return;
    foldDrag.active = true;
    foldDrag.pointerId = event.pointerId;
    foldDrag.startY = event.clientY;
    foldDrag.distance = 0;
    node.classList.add('dragging');
    document.body.classList.add('folding');
    try { node.setPointerCapture(event.pointerId); } catch (err) { /* mouse is fine without */ }
  });

  node.addEventListener('pointermove', (event) => {
    if (!foldDrag.active || event.pointerId !== foldDrag.pointerId) return;
    // Only upward counts. Dragging down does nothing at all.
    foldDrag.distance = Math.max(0, foldDrag.startY - event.clientY);
    paintFoldDrag(foldDrag.distance);
    event.preventDefault();
  });

  const finish = (event) => {
    if (!foldDrag.active) return;
    if (event && event.pointerId !== undefined && event.pointerId !== foldDrag.pointerId) return;
    foldDrag.active = false;
    node.classList.remove('dragging');
    document.body.classList.remove('folding');
    try { node.releasePointerCapture(foldDrag.pointerId); } catch (err) { /* already gone */ }
    if (foldDrag.distance >= FOLD_DISTANCE && foldDrag.enabled && foldDrag.onFold) {
      throwHandAway();
    } else {
      clearFoldDrag();
    }
  };
  node.addEventListener('pointerup', finish);
  node.addEventListener('pointercancel', finish);
}

function paintFoldDrag(distance) {
  const lift = Math.min(distance, 130);
  const ready = distance >= FOLD_DISTANCE;
  dom.heroCards.style.transform =
    'translate3d(0, ' + (-lift) + 'px, 0) rotate(' + (-lift * 0.05) + 'deg)';
  dom.heroCards.style.opacity = String(1 - Math.min(0.5, lift / 240));
  // The label rides up with the cards instead of being left behind.
  dom.foldHint.style.transform = 'translate3d(0, ' + (-lift) + 'px, 0)';
  dom.foldHint.style.opacity = String(Math.min(1, 0.35 + distance / FOLD_DISTANCE));
  dom.foldHint.classList.toggle('ready', ready);
  dom.foldHint.textContent = ready ? 'Let go to fold' : 'Swipe up to fold';
}

function clearFoldDrag() {
  document.body.classList.remove('folding');
  dom.heroCards.classList.remove('mucked');
  dom.heroCards.style.transform = '';
  dom.heroCards.style.opacity = '';
  dom.foldHint.style.transform = '';
  dom.foldHint.style.opacity = '';
  dom.foldHint.classList.remove('ready');
  dom.foldHint.textContent = 'Swipe up to fold';
}

// The cards carry on the way they were thrown, then the fold is played.
function throwHandAway() {
  const onFold = foldDrag.onFold;
  dom.foldHint.style.opacity = '';
  if (reducedMotion) {
    clearFoldDrag();
    if (onFold) onFold();
    return;
  }
  dom.heroCards.style.transform = '';
  dom.heroCards.style.opacity = '';
  dom.foldHint.style.transform = '';
  dom.heroCards.classList.add('mucked');
  setTimeout(() => {
    clearFoldDrag();
    if (onFold) onFold();
  }, 230);
}

// -------------------------------------------------------------------- hero

let heroCardState = '';

export function renderHero(table, hero, readout, heroNet) {
  dom.heroCards.classList.toggle('folded', !!hero.folded);
  const state = hero.hasCards && hero.hole.length
    ? hero.hole.map(cardToString).join('')
    : '';
  // Only rebuilt when the cards actually change, so they deal in once rather
  // than flickering on every action.
  if (heroCardState !== state) {
    heroCardState = state;
    clear(dom.heroCards);
    if (state) {
      for (const card of hero.hole) dom.heroCards.appendChild(cardEl(card));
    } else {
      dom.heroCards.appendChild(cardEl(null));
      dom.heroCards.appendChild(cardEl(null));
    }
  }

  clear(dom.heroStack);
  const marks = el('div', 'hero-marks');
  if (table.buttonIndex === hero.index) {
    const badge = el('span', 'hero-mark dealer', 'D');
    badge.title = 'You are the dealer this hand';
    marks.appendChild(badge);
  }
  const blind = blindLabel(table, hero.index);
  if (blind) {
    const badge = el('span', 'hero-mark' + (blind === 'BB' ? ' big' : ''), blind);
    badge.title = blind === 'BB' ? 'You posted the big blind' : 'You posted the small blind';
    marks.appendChild(badge);
  }
  if (marks.childNodes.length) dom.heroStack.appendChild(marks);

  const stack = el('span', null, '');
  const amount = el('strong');
  amount.dataset.value = String(hero.stack);
  amount.textContent = String(hero.stack);
  stack.appendChild(amount);
  stack.appendChild(document.createTextNode(' chips'));
  if (hero.committed > 0) {
    stack.appendChild(document.createTextNode(', ' + hero.committed + ' in'));
  }
  dom.heroStack.appendChild(stack);
  if (heroNet !== null && heroNet !== undefined && heroNet !== 0) {
    dom.heroStack.appendChild(el(
      'span', 'hero-net ' + (heroNet > 0 ? 'win' : 'lose'),
      (heroNet > 0 ? '+' : '') + heroNet
    ));
  }

  clear(dom.heroReadout);
  if (readout && readout.markup) {
    dom.heroReadout.appendChild(el('span', 'readout-label', 'You have'));
    dom.heroReadout.appendChild(renderMarkup(readout.markup));
  }
}

/**
 * The scoreboard at the end of a hand: who won, how much, and what it cost
 * or made you. Shown instead of the running commentary.
 */
export function showResult(result) {
  const node = dom.handResult;
  clear(node);
  node.hidden = false;
  // Lets the stylesheet claw back room from the board while the scoreboard
  // and the last grade are both on screen.
  document.body.classList.add('showing-result');
  node.className = 'hand-result ' +
    (result.net > 0 ? 'won' : (result.net < 0 ? 'lost' : 'even'));

  const top = el('div', 'result-top');
  top.appendChild(el('div', 'result-who', result.headline));
  const delta = el('div', 'result-delta');
  delta.textContent = result.net > 0
    ? '+' + result.net
    : (result.net < 0 ? String(result.net) : 'even');
  top.appendChild(delta);
  node.appendChild(top);

  if (result.detail) {
    const detail = el('div', 'result-detail');
    detail.appendChild(renderMarkup(result.detail));
    node.appendChild(detail);
  }
}

export function hideResult() {
  dom.handResult.hidden = true;
  clear(dom.handResult);
  document.body.classList.remove('showing-result');
}

export function setPot(amount) {
  tweenNumber(dom.potAmount, amount);
}

export function setHandNumber(n) {
  dom.handNumber.textContent = n;
}

export function setCoachState(on) {
  // The coach toggle now shares its line with the level, so it only speaks up
  // when it is off and the player might be wondering where the grades went.
  dom.streakLabel.dataset.coachOff = on ? '' : 'yes';
  refreshStreakLabel();
}

let streakValue = 0;

function refreshStreakLabel() {
  const node = dom.streakLabel;
  if (node.dataset.coachOff === 'yes') {
    node.textContent = 'coach off';
    node.className = 'streak-label muted';
    node.hidden = false;
    return;
  }
  if (streakValue >= 3) {
    node.textContent = streakValue + ' clean in a row';
    node.className = 'streak-label';
    node.hidden = false;
    return;
  }
  node.hidden = true;
}

export function setProgress(progress) {
  dom.levelLabel.textContent = 'Level ' + progress.level;
  dom.levelFill.style.width =
    Math.round((progress.intoLevel / progress.perLevel) * 100) + '%';
  streakValue = progress.streak;
  refreshStreakLabel();
}

/**
 * A small reward floating up from the banner. Points are for playing well,
 * so this fires on the decision, not on winning the pot.
 */
export function flashReward(reward) {
  if (!reward || (!reward.xp && !reward.levelUp)) return;
  const node = el('div', 'reward');
  if (reward.levelUp) {
    node.classList.add('level-up');
    node.textContent = 'Level ' + reward.levelUp;
  } else {
    node.textContent = '+' + reward.xp;
  }
  dom.coachBanner.appendChild(node);
  setTimeout(() => { if (node.parentNode) node.parentNode.removeChild(node); }, 1400);
}

export function setMessage(markup) {
  if (!markup) {
    clear(dom.tableMessage);
    return;
  }
  setMarkup(dom.tableMessage, markup);
}

// ------------------------------------------------------------------ banner

export function showBanner(result) {
  const node = dom.coachBanner;
  clear(node);
  node.className = 'coach-banner ' + result.verdict;
  node.hidden = false;
  const label = result.verdict === 'good' ? 'Good' : result.verdict === 'fine' ? 'Fine' : 'Mistake';
  node.appendChild(el('div', 'coach-verdict', label));
  const text = el('div', 'coach-text');
  text.appendChild(renderMarkup(result.text));
  node.appendChild(text);
  if (result.diagram) {
    const picture = renderDiagram(result.diagram);
    if (picture) node.appendChild(picture);
  }
  if (result.better) {
    const better = el('div', 'coach-better');
    better.appendChild(document.createTextNode('Better: '));
    better.appendChild(el('strong', null, result.better));
    node.appendChild(better);
  }
  node.scrollTop = 0;
  updateBannerFade(node);
  node.onscroll = () => updateBannerFade(node);
}

// Fade the bottom edge while there is more to scroll to, so a long banner on
// a short screen reads as scrollable rather than cut off.
function updateBannerFade(node) {
  const more = node.scrollHeight - node.scrollTop - node.clientHeight > 4;
  node.classList.toggle('scrolls', more);
}

export function hideBanner() {
  dom.coachBanner.hidden = true;
  clear(dom.coachBanner);
}

// ------------------------------------------------------------ action area

/**
 * options: { legal, bigBlind, onFold, onCheckCall, onRaise, onOpenSizer }
 */
export function renderActionRow(options) {
  const area = dom.actionArea;
  clear(area);
  setFoldGesture(true, options.onFold);
  const row = el('div', 'action-row');
  if (!reducedMotion) row.classList.add('enter');
  const legal = options.legal;

  const fold = el('button', 'act-btn fold', 'Fold');
  fold.type = 'button';
  fold.addEventListener('click', options.onFold);
  row.appendChild(fold);

  const callBtn = el('button', 'act-btn');
  callBtn.type = 'button';
  if (legal.canCheck) {
    callBtn.appendChild(el('span', null, 'Check'));
  } else {
    callBtn.appendChild(el('span', null, 'Call'));
    callBtn.appendChild(el('small', null, legal.toCall + (legal.toCall >= legal.maxRaiseTo ? ' all in' : '')));
  }
  callBtn.addEventListener('click', options.onCheckCall);
  row.appendChild(callBtn);

  if (legal.canRaise) {
    const raise = el('button', 'act-btn primary');
    raise.type = 'button';
    const quick = options.quickRaiseTo;
    raise.appendChild(el('span', null, legal.isBet ? 'Bet' : 'Raise'));
    raise.appendChild(el('small', null, quick >= legal.maxRaiseTo ? 'all in ' + quick : String(quick)));
    raise.addEventListener('click', () => options.onRaise(quick));
    row.appendChild(raise);

    const sizer = el('button', 'sizer-btn', '↑');
    sizer.type = 'button';
    sizer.setAttribute('aria-label', 'Choose a bet size');
    sizer.addEventListener('click', options.onOpenSizer);
    row.appendChild(sizer);
  }

  area.appendChild(row);
}

/**
 * options: { legal, pot, bigBlind, start, onConfirm, onCancel }
 */
export function renderBetSizer(options) {
  const area = dom.actionArea;
  clear(area);
  setFoldGesture(false);
  const legal = options.legal;
  const box = el('div', 'bet-sizer');

  const top = el('div', 'sizer-top');
  const amount = el('div', 'sizer-amount');
  const value = el('span', null, String(options.start));
  const unit = el('small', null, '');
  amount.appendChild(value);
  amount.appendChild(unit);
  top.appendChild(amount);
  const cancel = el('button', 'sizer-cancel', '✕');
  cancel.type = 'button';
  cancel.setAttribute('aria-label', 'Cancel');
  cancel.addEventListener('click', options.onCancel);
  top.appendChild(cancel);
  box.appendChild(top);

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = String(legal.minRaiseTo);
  slider.max = String(legal.maxRaiseTo);
  slider.step = '1';
  slider.value = String(options.start);
  slider.setAttribute('aria-label', 'Bet size');
  box.appendChild(slider);

  const presets = el('div', 'sizer-presets');
  // A raise "to" number counts what is already in front of you, so each preset
  // is: what you have in, plus the call, plus a share of the pot as it would
  // stand after that call.
  const committed = options.committed || 0;
  const afterCall = options.pot + legal.toCall;
  const base = committed + legal.toCall;
  const presetDefs = [
    { label: '1 BB', value: committed + Math.round(options.bigBlind) },
    { label: '1/2 Pot', value: base + Math.round(afterCall / 2) },
    { label: 'Pot', value: base + afterCall },
    { label: 'All in', value: legal.maxRaiseTo }
  ];
  const presetButtons = [];
  for (const def of presetDefs) {
    const btn = el('button', 'preset-btn', def.label);
    btn.type = 'button';
    btn.addEventListener('click', () => {
      setValue(def.value);
    });
    presets.appendChild(btn);
    presetButtons.push(btn);
  }
  box.appendChild(presets);

  const confirm = el('button', 'sizer-confirm', '');
  confirm.type = 'button';
  box.appendChild(confirm);

  function clampValue(v) {
    return Math.max(legal.minRaiseTo, Math.min(legal.maxRaiseTo, Math.round(v)));
  }

  function setValue(v) {
    const clamped = clampValue(v);
    slider.value = String(clamped);
    value.textContent = String(clamped);
    const inBB = Math.round((clamped / options.bigBlind) * 10) / 10;
    unit.textContent = inBB + 'BB';
    confirm.textContent = (legal.isBet ? 'Bet ' : 'Raise to ') + clamped +
      (clamped >= legal.maxRaiseTo ? ' (all in)' : '');
    for (let i = 0; i < presetButtons.length; i++) {
      presetButtons[i].classList.toggle('on', clampValue(presetDefs[i].value) === clamped);
    }
  }

  slider.addEventListener('input', () => setValue(Number(slider.value)));
  confirm.addEventListener('click', () => options.onConfirm(clampValue(Number(slider.value))));
  setValue(options.start);

  area.appendChild(box);
}

export function renderWaiting(text, onSkip) {
  setFoldGesture(false);
  clear(dom.actionArea);
  if (!onSkip) {
    dom.actionArea.appendChild(el('div', 'waiting', text || ''));
    return;
  }
  // Once you are out of the hand there is nothing to decide, so there is a
  // way to stop waiting for it.
  const row = el('div', 'action-row');
  row.appendChild(el('div', 'waiting grow', text || ''));
  const skip = el('button', 'act-btn skip', 'Skip');
  skip.type = 'button';
  skip.addEventListener('click', onSkip);
  row.appendChild(skip);
  dom.actionArea.appendChild(row);
}

export function renderNextHand(onNext) {
  setFoldGesture(false);
  clear(dom.actionArea);
  const btn = el('button', 'next-btn', 'Next hand');
  btn.type = 'button';
  btn.addEventListener('click', onNext);
  dom.actionArea.appendChild(btn);
}

// --------------------------------------------------------------- diagrams

/**
 * Turn the data from diagrams.js into a small picture. Every one of these is
 * built from the hand actually being played.
 */
export function renderDiagram(data) {
  if (!data) return null;
  if (data.kind === 'order') return orderDiagram(data);
  if (data.kind === 'odds') return oddsDiagram(data);
  if (data.kind === 'outs') return outsDiagram(data);
  if (data.kind === 'ladder') return ladderDiagram(data);
  return null;
}

function orderDiagram(data) {
  const box = el('div', 'dg dg-order');
  const strip = el('div', 'dg-strip');
  if (!reducedMotion) strip.classList.add('enter');
  data.seats.forEach((seatData, i) => {
    if (i > 0) strip.appendChild(el('span', 'dg-arrow', '\u203a'));
    const chip = el('div', 'dg-seat' +
      (seatData.isMe ? ' me' : '') +
      (seatData.folded ? ' folded' : '') +
      (seatData.acting ? ' acting' : ''));
    if (!reducedMotion) chip.style.animationDelay = (i * 55) + 'ms';
    chip.appendChild(el('span', 'dg-num', String(i + 1)));
    chip.appendChild(el('span', 'dg-name', seatData.name));
    // The same D badge the table uses, so it needs no explaining.
    if (seatData.isButton) chip.appendChild(el('span', 'dg-d', 'D'));
    strip.appendChild(chip);
  });
  box.appendChild(strip);
  box.appendChild(el('div', 'dg-caption', data.caption));
  return box;
}

function oddsDiagram(data) {
  const box = el('div', 'dg dg-odds' + (data.good ? ' good' : ' bad'));
  const track = el('div', 'dg-track');
  if (data.equity !== null) {
    const fill = el('div', 'dg-fill');
    const target = Math.min(100, data.equity) + '%';
    fill.style.width = '0%';
    track.appendChild(fill);
    // Grown on the next frame so the bar visibly reaches for the price.
    requestAnimationFrame(() => { fill.style.width = target; });
  }
  const tick = el('div', 'dg-tick');
  tick.style.left = Math.min(100, data.need) + '%';
  track.appendChild(tick);
  box.appendChild(track);

  const legend = el('div', 'dg-legend');
  legend.appendChild(el('span', 'dg-have',
    data.equity === null ? 'no draw' : 'you get there ' + data.equity + '%'));
  legend.appendChild(el('span', 'dg-need', 'need ' + data.need + '%'));
  box.appendChild(legend);
  box.appendChild(el('div', 'dg-caption',
    'Pay ' + data.toCall + ' to win ' + data.pot + '.' +
    (data.equity === null ? '' : (data.good ? ' Worth it.' : ' Not worth it.'))));
  return box;
}

function outsDiagram(data) {
  const box = el('div', 'dg dg-outs');
  const grid = el('div', 'dg-grid');
  for (let i = 0; i < data.unseen; i++) {
    const card = el('span', 'dg-card' + (i < data.outs ? ' out' : ''));
    // The winning cards fill in one after another, so the count is felt
    // rather than read.
    if (i < data.outs) card.style.animationDelay = (i * 45) + 'ms';
    grid.appendChild(card);
  }
  box.appendChild(grid);
  box.appendChild(el('div', 'dg-caption',
    data.outs === 0
      ? 'None of the ' + data.unseen + ' cards left saves this hand.'
      : data.outs + ' of the ' + data.unseen + ' cards left win it, about ' +
        data.percent + ' percent per card.'));
  return box;
}

function ladderDiagram(data) {
  const box = el('div', 'dg dg-ladder');
  // Strongest at the top, the way hand rankings are always drawn.
  for (let i = data.rows.length - 1; i >= 0; i--) {
    const row = data.rows[i];
    const line = el('div', 'dg-rung' +
      (row.current ? ' current' : '') + (row.beaten ? ' beaten' : ''));
    line.appendChild(el('span', 'dg-rung-name', row.name));
    if (row.current) line.appendChild(el('span', 'dg-rung-you', 'you'));
    box.appendChild(line);
  }
  return box;
}

// ------------------------------------------------------------------- sheet

// Set by the app. Given a term, it returns a sentence about the hand being
// played right now, or null when the term has nothing to say about it.
let liveNoteFor = null;
let diagramFor = null;

export function setLiveNoteProvider(provider) {
  liveNoteFor = provider;
}

export function setDiagramProvider(provider) {
  diagramFor = provider;
}

// Tapping a term inside a definition replaces the sheet with that term, so
// one panel can walk through as many words as it takes.
export function openTermSheet(slug) {
  const term = getTerm(slug);
  if (!term) return;
  dom.sheetTitle.textContent = term.title;
  clear(dom.sheetBody);

  // What the word means for the hand in front of you comes first and gets the
  // most weight. The general definition is the small print under it.
  const picture = diagramFor ? renderDiagram(diagramFor(term.slug)) : null;
  if (picture) dom.sheetBody.appendChild(picture);

  const live = liveNoteFor ? liveNoteFor(term.slug) : null;
  if (live) {
    const box = el('div', 'live-note');
    box.appendChild(renderMarkup(live));
    dom.sheetBody.appendChild(box);
  }

  for (const sense of term.senses) {
    const wrap = el('div', 'sense');
    if (sense.label) wrap.appendChild(el('div', 'sense-label', sense.label));
    const text = el('div', 'sense-text' + (live ? ' secondary' : ''));
    text.appendChild(renderMarkup(sense.text));
    wrap.appendChild(text);
    // The live line already is an example, so only fall back to the written
    // one when there is nothing to say about this hand.
    if (sense.example && !live) {
      const example = el('div', 'sense-example');
      example.appendChild(renderMarkup(sense.example));
      wrap.appendChild(example);
    }
    dom.sheetBody.appendChild(wrap);
  }
  dom.sheet.hidden = false;
  dom.sheet.querySelector('.sheet-panel').scrollTop = 0;
}

export function closeSheet() {
  dom.sheet.hidden = true;
}

export function sheetIsOpen() {
  return !dom.sheet.hidden;
}

// ------------------------------------------------------------------ screen

export function openScreen(title, build) {
  dom.screenTitle.textContent = title;
  clear(dom.screenBody);
  build(dom.screenBody);
  dom.screen.hidden = false;
  dom.screenBody.scrollTop = 0;
}

export function closeScreen() {
  dom.screen.hidden = true;
  clear(dom.screenBody);
}

export function screenIsOpen() {
  return !dom.screen.hidden;
}

export { clear };
