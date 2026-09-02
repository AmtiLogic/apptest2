// ui.js
// All DOM rendering. Nothing in here decides anything about poker, it just
// draws whatever the app hands it.

import { RANK_CHARS, SUIT_SYMBOLS, isRed } from './cards.js';
import { parseMarkup, getTerm } from './glossary.js';

export const dom = {};

export function cacheDom() {
  const ids = [
    'hand-number', 'coach-state', 'opponents', 'board', 'pot-amount',
    'table-message', 'coach-banner', 'action-area', 'hero-cards', 'hero-stack',
    'hero-readout', 'sheet', 'sheet-title', 'sheet-body', 'screen',
    'screen-title', 'screen-body'
  ];
  for (const id of ids) {
    dom[camel(id)] = document.getElementById(id);
  }
}

function camel(id) {
  return id.replace(/-([a-z])/g, (m, c) => c.toUpperCase());
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
  if (options.dealt) node.classList.add('dealt');
  if (options.mini) {
    node.textContent = RANK_CHARS[card.rank] + SUIT_SYMBOLS[card.suit];
    return node;
  }
  node.appendChild(el('span', 'rank', RANK_CHARS[card.rank]));
  node.appendChild(el('span', 'suit', SUIT_SYMBOLS[card.suit]));
  return node;
}

let lastBoardCount = 0;

export function renderBoard(board) {
  clear(dom.board);
  for (let i = 0; i < 5; i++) {
    const card = board[i];
    if (!card) {
      dom.board.appendChild(cardEl(null, { faceDown: true }));
      continue;
    }
    dom.board.appendChild(cardEl(card, { dealt: i >= lastBoardCount }));
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

export function renderSeats(table, options = {}) {
  clear(dom.opponents);
  dom.opponents.classList.toggle('many', table.players.length > 6);
  for (const player of table.players) {
    if (player.isHuman) continue;
    dom.opponents.appendChild(seatEl(table, player, options));
  }
}

function seatEl(table, player, options) {
  const seat = el('div', 'seat');
  seat.dataset.seat = String(player.index);
  if (player.folded || !player.hasCards) seat.classList.add('folded');
  if (table.toAct === player.index && !table.handOver) seat.classList.add('acting');
  if (options.winners && options.winners.includes(player.index)) seat.classList.add('winner');

  seat.appendChild(el('div', 'seat-marker'));

  seat.appendChild(el('div', 'seat-avatar', player.avatar));
  seat.appendChild(el('div', 'seat-name', player.name));
  seat.appendChild(el('div', 'seat-stack', player.stack));

  // Dealer button, blind marker and the last action share one row, so
  // nothing sits on top of the avatar.
  const meta = el('div', 'seat-meta');
  if (table.buttonIndex === player.index) {
    const badge = el('span', 'seat-tag dealer', 'D');
    badge.title = 'Dealer button';
    meta.appendChild(badge);
  }
  const blind = blindLabel(table, player.index);
  if (blind) {
    const badge = el('span', 'seat-tag blind' + (blind === 'BB' ? ' big' : ''), blind);
    badge.title = blind === 'BB' ? 'Big blind' : 'Small blind';
    meta.appendChild(badge);
  }
  if (player.lastAction) {
    meta.appendChild(el('span', 'seat-action', player.lastAction.split(' ')[0]));
  }
  seat.appendChild(meta);

  const hole = el('div', 'seat-hole');
  if (player.hasCards && !player.folded) {
    const reveal = options.reveal && options.reveal.includes(player.index);
    for (const card of player.hole) {
      hole.appendChild(cardEl(card, { mini: true, faceDown: !reveal }));
    }
  }
  seat.appendChild(hole);

  // Always present so a bet appearing does not shift the row.
  const bet = el('div', 'seat-bet' + (player.committed > 0 ? '' : ' empty'),
    player.committed > 0 ? player.committed : '0');
  seat.appendChild(bet);
  return seat;
}

// "SB" or "BB" for the seat, when it posted one this hand.
export function blindLabel(table, seatIndex) {
  const blinds = table.blindSeats;
  if (!blinds) return null;
  if (blinds.bb === seatIndex) return 'BB';
  if (blinds.sb === seatIndex) return 'SB';
  return null;
}

// -------------------------------------------------------------------- hero

export function renderHero(table, hero, readout) {
  clear(dom.heroCards);
  dom.heroCards.classList.toggle('folded', !!hero.folded);
  if (hero.hasCards && hero.hole.length) {
    for (const card of hero.hole) dom.heroCards.appendChild(cardEl(card));
  } else {
    dom.heroCards.appendChild(cardEl(null));
    dom.heroCards.appendChild(cardEl(null));
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
  stack.appendChild(el('strong', null, hero.stack));
  stack.appendChild(document.createTextNode(' chips'));
  if (hero.committed > 0) {
    stack.appendChild(document.createTextNode(', ' + hero.committed + ' in'));
  }
  dom.heroStack.appendChild(stack);

  clear(dom.heroReadout);
  if (readout && readout.markup) {
    dom.heroReadout.appendChild(el('span', 'readout-label', 'You have'));
    dom.heroReadout.appendChild(renderMarkup(readout.markup));
  }
}

export function setPot(amount) {
  dom.potAmount.textContent = amount;
}

export function setHandNumber(n) {
  dom.handNumber.textContent = n;
}

export function setCoachState(on) {
  dom.coachState.textContent = on ? 'Coach on' : 'Coach off';
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
  const row = el('div', 'action-row');
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

export function renderWaiting(text) {
  clear(dom.actionArea);
  dom.actionArea.appendChild(el('div', 'waiting', text || ''));
}

export function renderNextHand(onNext, label) {
  clear(dom.actionArea);
  const btn = el('button', 'next-btn', label || 'Next hand');
  btn.type = 'button';
  btn.addEventListener('click', onNext);
  dom.actionArea.appendChild(btn);
}

// ------------------------------------------------------------------- sheet

// Set by the app. Given a term, it returns a sentence about the hand being
// played right now, or null when the term has nothing to say about it.
let liveNoteFor = null;

export function setLiveNoteProvider(provider) {
  liveNoteFor = provider;
}

// Tapping a term inside a definition replaces the sheet with that term, so
// one panel can walk through as many words as it takes.
export function openTermSheet(slug) {
  const term = getTerm(slug);
  if (!term) return;
  dom.sheetTitle.textContent = term.title;
  clear(dom.sheetBody);

  // What this word means at your table, right now, before the general
  // definition. This is usually the part that makes it click.
  const live = liveNoteFor ? liveNoteFor(term.slug) : null;
  if (live) {
    const box = el('div', 'live-note');
    box.appendChild(el('div', 'live-note-label', 'At your table'));
    const body = el('div', 'live-note-text');
    body.appendChild(renderMarkup(live));
    box.appendChild(body);
    dom.sheetBody.appendChild(box);
  }

  for (const sense of term.senses) {
    const wrap = el('div', 'sense');
    if (sense.label) wrap.appendChild(el('div', 'sense-label', sense.label));
    const text = el('div', 'sense-text');
    text.appendChild(renderMarkup(sense.text));
    wrap.appendChild(text);
    if (sense.example) {
      const example = el('div', 'sense-example');
      example.appendChild(el('em', null, 'Example'));
      const body = el('span');
      body.appendChild(renderMarkup(sense.example));
      example.appendChild(body);
      wrap.appendChild(example);
    }
    dom.sheetBody.appendChild(wrap);
  }
  dom.sheet.hidden = false;
  dom.sheet.querySelector('.sheet-panel').scrollTop = 0;
}

export function openInfoSheet(title, markup, extra) {
  dom.sheetTitle.textContent = title;
  clear(dom.sheetBody);
  const wrap = el('div', 'sense');
  const text = el('div', 'sense-text');
  text.appendChild(renderMarkup(markup));
  wrap.appendChild(text);
  if (extra) {
    const example = el('div', 'sense-example');
    example.appendChild(el('em', null, 'Note'));
    const body = el('span');
    body.appendChild(renderMarkup(extra));
    example.appendChild(body);
    wrap.appendChild(example);
  }
  dom.sheetBody.appendChild(wrap);
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
