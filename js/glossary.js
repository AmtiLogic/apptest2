// glossary.js
// Every poker word the interface uses, with a plain definition and one
// concrete example. Definitions may reference other terms with [[slug|text]]
// markup, which the interface turns into tappable spans. A definition never
// leans on a word that is not itself in here.

export const TERMS = {
  hand: {
    title: 'Hand',
    senses: [
      {
        label: 'Your two cards',
        text: 'The two private cards dealt to you at the start. Nobody else sees them.',
        example: 'If you are dealt the ace of spades and the king of spades, people say your hand is ace king suited.'
      },
      {
        label: 'One round of play',
        text: 'One complete deal, from the cards going out to somebody winning the [[pot]]. A session is made of many of them.',
        example: 'Six players sit down and play forty hands in an hour.'
      },
      {
        label: 'Your five card combination',
        text: 'The best five card combination you can make out of your two cards and the [[board|community cards]]. This is what gets compared at the [[showdown]].',
        example: 'You hold two kings and the board has a third king, so your hand is three of a kind.'
      }
    ]
  },

  position: {
    title: 'Position',
    senses: [{
      text: 'Where you sit relative to the [[button|dealer button]], which decides when it is your turn to act. Acting later is better, because you have watched what everyone else did before you decide.',
      example: 'On the button you act last on every round after the first, so you have the most information.'
    }]
  },

  'in-position': {
    title: 'In position',
    senses: [{
      text: 'Acting after your opponent on every remaining round. You see what they do before you have to decide.',
      example: 'You are on the [[button]] and they are in the [[big-blind|big blind]], so you are in position on them.'
    }]
  },

  'out-of-position': {
    title: 'Out of position',
    senses: [{
      text: 'Acting before your opponent on every remaining round. You have to commit first and they get to react.',
      example: 'You are in the [[small-blind|small blind]] against the [[button]], so you are out of position for the whole [[hand]].'
    }]
  },

  blinds: {
    title: 'Blinds',
    senses: [{
      text: 'Two forced bets posted before any cards are dealt, so there is always money worth playing for. The [[small-blind|small blind]] is half the size of the [[big-blind|big blind]].',
      example: 'At blinds of one and two, the player left of the [[button]] puts in one chip and the next player puts in two, before anyone has looked at their cards.'
    }]
  },

  'small-blind': {
    title: 'Small blind',
    senses: [{
      text: 'The forced bet posted by the seat immediately left of the [[button]], normally half a [[big-blind|big blind]]. Also the name of that seat.',
      example: 'You are in the small blind, so you have already put one chip in before seeing your cards.'
    }]
  },

  'big-blind': {
    title: 'Big blind',
    senses: [
      {
        label: 'The seat',
        text: 'The seat two to the left of the [[button]], which posts the larger of the two [[blinds]]. It acts last before the [[flop]] and first after it.',
        example: 'You are in the big blind and everybody folds, so you win the [[blinds]] without playing.'
      },
      {
        label: 'A unit of measurement',
        text: 'The size of the big blind is also how poker players measure money, written BB. Counting in big blinds means a bet is the same size whatever the [[stakes]] are.',
        example: 'A 200 chip [[stack]] at blinds of one and two is 100 big blinds. A raise to 6 is a raise to 3BB.'
      }
    ]
  },

  stakes: {
    title: 'Stakes',
    senses: [{
      text: 'How large the [[blinds]] are, which sets how much money is at risk in a typical [[hand]].',
      example: 'Blinds of one and two are lower stakes than blinds of five and ten.'
    }]
  },

  button: {
    title: 'Button',
    senses: [{
      text: 'A marker showing which seat is the nominal [[dealer]] for this [[hand]]. That seat acts last after the [[flop]], which is the best [[position]] at the table. It moves one seat to the left every hand.',
      example: 'The small "D" badge on a seat means that player is on the button this hand.'
    }]
  },

  dealer: {
    title: 'Dealer',
    senses: [{
      text: 'The seat holding the [[button]] this [[hand]]. In a home game that player would physically deal the cards. Here the app deals, and the badge just marks who acts last.',
      example: 'The dealer badge moves one seat clockwise after every hand so everyone gets the good seats equally often.'
    }]
  },

  pot: {
    title: 'Pot',
    senses: [{
      text: 'All the chips bet so far in this [[hand]], sitting in the middle. Whoever wins the hand takes it.',
      example: 'Three players each put in 10, so the pot is 30.'
    }]
  },

  'side-pot': {
    title: 'Side pot',
    senses: [{
      text: 'A second [[pot]] made when one player is [[all-in|all in]] for less than the others. They can only win the part everyone matched, and the extra goes into a side pot the remaining players fight over.',
      example: 'You are all in for 20 and two others keep betting to 100. You can win the first 60 and they play for the rest.'
    }]
  },

  stack: {
    title: 'Stack',
    senses: [{
      text: 'The chips a player has in front of them. You can only ever win or lose the smaller of your stack and theirs in a [[hand]].',
      example: 'You start with a 200 chip stack, which is 100 [[big-blind|big blinds]].'
    }]
  },

  'community-cards': {
    title: 'Community cards',
    senses: [{
      text: 'The cards dealt face up in the middle that every player uses. There are five by the end, and they belong to everyone.',
      example: 'You have two hearts and three more hearts come as community cards, so you have a flush.'
    }]
  },

  board: {
    title: 'Board',
    senses: [{
      text: 'Another word for the [[community-cards|community cards]] currently face up. People also talk about how a board "looks", meaning which hands it makes likely.',
      example: 'The board is king, seven, two with two spades, so somebody could already have a [[flush-draw|flush draw]].'
    }]
  },

  'board-texture': {
    title: 'Board texture',
    senses: [{
      text: 'How connected and dangerous the [[board]] is. A dry board barely helps anyone. A wet board makes lots of [[draw|draws]] and strong hands possible.',
      example: 'King, seven, two of three different suits is dry. Nine, eight, seven with two hearts is wet.'
    }]
  },

  street: {
    title: 'Street',
    senses: [{
      text: 'One round of betting. There are four: [[preflop]], [[flop]], [[turn]] and [[river]].',
      example: 'You bet on two streets and then checked the [[river]].'
    }]
  },

  preflop: {
    title: 'Preflop',
    senses: [{
      text: 'The first betting round, before any [[community-cards|community cards]] are dealt. All you know is your own two cards and your [[position]].',
      example: 'Preflop you raise to 6 and only the [[big-blind|big blind]] calls.'
    }]
  },

  flop: {
    title: 'Flop',
    senses: [{
      text: 'The first three [[community-cards|community cards]], dealt at once, followed by a betting round.',
      example: 'The flop comes ace, nine, four and you have suddenly made [[top-pair|top pair]].'
    }]
  },

  turn: {
    title: 'Turn',
    senses: [{
      text: 'The fourth [[community-cards|community card]], dealt after the [[flop]] betting round, followed by another betting round.',
      example: 'The turn brings a third heart, so anybody holding two hearts now has a flush.'
    }]
  },

  river: {
    title: 'River',
    senses: [{
      text: 'The fifth and last [[community-cards|community card]]. After the betting on the river, any remaining players go to [[showdown]].',
      example: 'You missed your [[draw]] on the river, so you have nothing and should give up.'
    }]
  },

  check: {
    title: 'Check',
    senses: [{
      text: 'Passing the action without betting, which you may only do when nobody has bet on this [[street]]. It keeps you in the [[hand]] for free.',
      example: 'You check, the next player checks too, and the [[turn]] card comes with no money added.'
    }]
  },

  call: {
    title: 'Call',
    senses: [{
      text: 'Matching the current bet to stay in the [[hand]], without raising it.',
      example: 'They bet 10, you call 10, and the [[pot]] grows by 20.'
    }]
  },

  bet: {
    title: 'Bet',
    senses: [{
      text: 'Putting chips in when nobody has yet on this [[street]]. Once there is a bet, other players must [[fold]], [[call]] or [[raise]].',
      example: 'Everyone checked on the [[flop]], so on the [[turn]] you bet 12 into a [[pot]] of 20.'
    }]
  },

  raise: {
    title: 'Raise',
    senses: [{
      text: 'Increasing a bet that is already there, which forces everyone else to put in more or [[fold]].',
      example: 'They bet 10 and you raise to 30, so calling now costs them 20 more.'
    }]
  },

  'three-bet': {
    title: 'Three-bet',
    senses: [{
      text: 'The second [[raise]] in a betting round. The [[big-blind|big blind]] counts as the first bet, so the first raise is a two-bet and re-raising it is a three-bet.',
      example: 'They open to 6, you three-bet to 20 with two queens.'
    }]
  },

  fold: {
    title: 'Fold',
    senses: [{
      text: 'Giving up your [[hand]] and any chips already in the [[pot]]. You cannot win it, and you cannot lose any more.',
      example: 'You have seven two offsuit facing a raise, so you fold.'
    }]
  },

  limp: {
    title: 'Limp',
    senses: [{
      text: 'Just [[call|calling]] the [[big-blind|big blind]] [[preflop]] instead of raising. It is usually weak, because it lets everyone in cheaply.',
      example: 'Two players limp for 2 each and the [[button]] raises to 12.'
    }]
  },

  open: {
    title: 'Open',
    senses: [{
      text: 'To be the first player to [[raise]] [[preflop]]. The hands you would open with from a given seat are your opening [[range]].',
      example: 'It folds to you in the [[cutoff]] and you open to 5.'
    }]
  },

  'all-in': {
    title: 'All in',
    senses: [{
      text: 'Betting every chip you have left. You cannot be forced out of the [[hand]] after that, but you also cannot win more than your [[stack]] from each opponent.',
      example: 'You have 40 left, they bet 60, and you call all in for your last 40.'
    }]
  },

  showdown: {
    title: 'Showdown',
    senses: [{
      text: 'The end of a [[hand]] where the remaining players turn their cards face up and the best five card [[hand]] wins the [[pot]].',
      example: 'Two players reach showdown, one has a pair of kings, the other has a [[flush]], and the flush wins.'
    }]
  },

  'showdown-value': {
    title: 'Showdown value',
    senses: [{
      text: 'A [[hand]] that is not strong enough to [[bet]] for value but might still win if you get to the [[showdown]] cheaply.',
      example: 'A weak middle pair on the [[river]] has showdown value, so you [[check]] instead of betting.'
    }]
  },

  pair: {
    title: 'Pair',
    senses: [{
      text: 'Two cards of the same rank inside your best five. It is the most common winning [[hand]] in Hold\'em, and which pair it is matters a great deal.',
      example: 'You hold a king, a king comes on the [[board]], so you have a pair of kings.'
    }]
  },

  'pocket-pair': {
    title: 'Pocket pair',
    senses: [{
      text: 'Being dealt two cards of the same rank. You start with a [[pair]] before any [[community-cards|community cards]] arrive, which is why pocket pairs are strong starting [[hand|hands]].',
      example: 'You are dealt two nines, which is a pocket pair.'
    }]
  },

  'bottom-pair': {
    title: 'Bottom pair',
    senses: [{
      text: 'Pairing the lowest card on the [[board]]. It is the weakest kind of [[pair]] and rarely worth more than one [[call]].',
      example: 'You hold nine three on a king eight three [[board]], so your threes are bottom pair.'
    }]
  },

  'three-of-a-kind': {
    title: 'Three of a kind',
    senses: [{
      text: 'Three cards of the same rank. When you make it with a [[pocket-pair|pocket pair]] plus a [[board]] card it is also called a set, and it is very well hidden.',
      example: 'You hold two sevens and a seven comes on the [[flop]].'
    }]
  },

  'full-house': {
    title: 'Full house',
    senses: [{
      text: '[[three-of-a-kind|Three of a kind]] plus a [[pair]], five cards in total. It beats a [[flush]] and a [[straight]].',
      example: 'You hold two nines on a nine four four [[board]], so you have nines full of fours.'
    }]
  },

  'four-of-a-kind': {
    title: 'Four of a kind',
    senses: [{
      text: 'All four cards of the same rank. It only loses to a [[straight-flush|straight flush]].',
      example: 'You hold two jacks and two more jacks come on the [[board]].'
    }]
  },

  'straight-flush': {
    title: 'Straight flush',
    senses: [{
      text: 'Five cards in a row, all of the same suit. It is the best possible [[hand]]. Ten through ace is called a royal flush.',
      example: 'You hold the eight and nine of hearts on a five six seven of hearts [[board]].'
    }]
  },

  kicker: {
    title: 'Kicker',
    senses: [{
      text: 'A side card used to break a tie when two players have the same pair or the same three of a kind.',
      example: 'You both have a pair of aces, but your other card is a king and theirs is a nine, so your kicker wins.'
    }]
  },

  'pot-odds': {
    title: 'Pot odds',
    senses: [{
      text: 'The price you are being offered on a [[call]]. Divide what the call costs by the size of the [[pot]] after your call. That percentage is how often you need to win for the call to break even.',
      example: 'The pot is 30 and they bet 10, so you pay 10 to win 40. That is 25 percent, so you need to win at least one time in four.'
    }]
  },

  outs: {
    title: 'Outs',
    senses: [{
      text: 'The cards still in the deck that would turn your [[hand]] into a winner. Counting them tells you how likely you are to get there.',
      example: 'You have four hearts and there are thirteen hearts in a deck, so nine hearts are left. You have nine outs.'
    }]
  },

  'rule-of-two-and-four': {
    title: 'Rule of two and four',
    senses: [{
      text: 'A quick way to turn [[outs]] into a percentage. Multiply your outs by two for one card to come, or by four when two cards are still to come and you are [[all-in|all in]].',
      example: 'Nine outs on the [[turn]] is about eighteen percent to hit on the [[river]].'
    }]
  },

  equity: {
    title: 'Equity',
    senses: [{
      text: 'Your share of the [[pot]] on average, written as a percentage. It is how often your [[hand]] would win if the rest of the cards were dealt many times.',
      example: 'A [[flush-draw|flush draw]] against one pair has roughly 35 percent equity with two cards to come.'
    }]
  },

  range: {
    title: 'Range',
    senses: [{
      text: 'All the different [[hand|hands]] a player could have right now, rather than one guess. You never know their exact cards, so you think about the whole set.',
      example: 'They raised from early [[position]], so their range is mostly big pairs and big cards.'
    }]
  },

  draw: {
    title: 'Draw',
    senses: [{
      text: 'A [[hand]] that is not good yet but becomes strong if the right card comes. You are drawing to something.',
      example: 'You have four cards to a [[flush]] on the [[flop]], so you have a draw with two cards still to come.'
    }]
  },

  'flush-draw': {
    title: 'Flush draw',
    senses: [{
      text: 'Four cards of the same suit, needing one more of that suit to make a [[flush]]. There are nine cards left that finish it, so nine [[outs]].',
      example: 'You hold two spades, the [[board]] has two spades, and one more spade gives you a flush.'
    }]
  },

  flush: {
    title: 'Flush',
    senses: [{
      text: 'Five cards of the same suit. It beats a [[straight]] and loses to a full house.',
      example: 'You hold two diamonds and three more diamonds are on the [[board]].'
    }]
  },

  straight: {
    title: 'Straight',
    senses: [{
      text: 'Five cards in a row of any suits, for example five six seven eight nine. An ace can be the top or the bottom of one.',
      example: 'You hold six seven and the [[board]] is five eight nine, so you have a nine high straight.'
    }]
  },

  'open-ended-straight-draw': {
    title: 'Open ended straight draw',
    senses: [{
      text: 'Four cards in a row, where a card at either end completes a [[straight]]. There are eight cards that finish it, so eight [[outs]].',
      example: 'You have six seven eight nine, so a five or a ten makes your straight.'
    }]
  },

  gutshot: {
    title: 'Gutshot',
    senses: [{
      text: 'A [[straight]] [[draw]] missing one card in the middle. Only four cards complete it, so four [[outs]], half as good as an [[open-ended-straight-draw|open ended draw]].',
      example: 'You have six seven and the [[board]] is nine ten. Only an eight makes your straight.'
    }]
  },

  'backdoor-draw': {
    title: 'Backdoor draw',
    senses: [{
      text: 'A [[draw]] that needs both the [[turn]] and the [[river]] to arrive. It is worth very little on its own.',
      example: 'You have three hearts on the [[flop]], so two more hearts would give you a [[flush]].'
    }]
  },

  'top-pair': {
    title: 'Top pair',
    senses: [{
      text: 'Pairing the highest card on the [[board]] with one of your own cards. It is a decent made [[hand]] on most flops.',
      example: 'You hold ace nine, the [[flop]] is nine six two, so you have top pair with an ace [[kicker]].'
    }]
  },

  'middle-pair': {
    title: 'Middle pair',
    senses: [{
      text: 'Pairing a [[board]] card that is neither the highest nor the lowest. It often has [[showdown-value|showdown value]] but is not worth big bets.',
      example: 'You hold seven six on a king seven three [[board]], so your sevens are middle pair.'
    }]
  },

  overpair: {
    title: 'Overpair',
    senses: [{
      text: 'A pair in your own two cards that is higher than every card on the [[board]]. It is usually a strong [[hand]].',
      example: 'You hold two queens and the [[flop]] is nine six two, so your queens are an overpair.'
    }]
  },

  'two-pair': {
    title: 'Two pair',
    senses: [{
      text: 'Two separate pairs inside your best five cards. It beats one pair and loses to three of a kind.',
      example: 'You hold ace nine on an ace nine four [[board]].'
    }]
  },

  'made-hand': {
    title: 'Made hand',
    senses: [{
      text: 'A [[hand]] that is already worth something without needing another card, as opposed to a [[draw]].',
      example: 'A pair of kings is a made hand. Four cards to a [[flush]] is not.'
    }]
  },

  'high-card': {
    title: 'High card',
    senses: [{
      text: 'No pair and no [[draw]], so your [[hand]] is only worth its highest card. It almost never wins at [[showdown]].',
      example: 'You hold king four on a nine seven two [[board]], so you have king high.'
    }]
  },

  'continuation-bet': {
    title: 'Continuation bet',
    senses: [{
      text: 'A [[bet]] on the [[flop]] by the player who raised [[preflop]], continuing the story that they have a big [[hand]]. It works often because most flops miss most hands.',
      example: 'You raised before the flop, the flop comes king seven two, and you bet again even with ace queen.'
    }]
  },

  'value-bet': {
    title: 'Value bet',
    senses: [{
      text: 'Betting a strong [[hand]] hoping to get [[call|called]] by worse. You are not trying to make them [[fold]], you are trying to get paid.',
      example: 'You have [[two-pair|two pair]] on the [[river]] and bet, because a single pair will often call you.'
    }]
  },

  bluff: {
    title: 'Bluff',
    senses: [{
      text: 'Betting or raising with a weak [[hand]] to make better hands [[fold]]. It only works when the story you are telling is believable.',
      example: 'You have nothing on an ace high [[board]] and bet, hoping they fold a small pair.'
    }]
  },

  'semi-bluff': {
    title: 'Semi-bluff',
    senses: [{
      text: 'Betting with a [[draw]] rather than nothing. You can win right away if they [[fold]], and you still have [[outs]] if they [[call]].',
      example: 'You bet with a [[flush-draw|flush draw]] on the [[turn]], so you win now or hit your [[flush]] later.'
    }]
  },

  dominated: {
    title: 'Dominated',
    senses: [{
      text: 'Sharing a card with a better [[hand]], so when you pair up you are still losing. Dominated hands lose far more money than they look like they should.',
      example: 'Ace five against ace king. When an ace comes you both pair, and their [[kicker]] beats yours.'
    }]
  },

  suited: {
    title: 'Suited',
    senses: [{
      text: 'Your two cards are the same suit, which makes a [[flush]] possible. Written with an s, as in AKs.',
      example: 'The king and the nine of hearts is king nine suited.'
    }]
  },

  offsuit: {
    title: 'Offsuit',
    senses: [{
      text: 'Your two cards are different suits, so you cannot make a [[flush]] with both of them. Written with an o, as in AKo.',
      example: 'The ace of clubs with the queen of hearts is ace queen offsuit.'
    }]
  },

  connectors: {
    title: 'Connectors',
    senses: [{
      text: 'Two cards next to each other in rank, which can make a [[straight]]. They are much better when they are also [[suited]].',
      example: 'Eight seven of hearts is a suited connector.'
    }]
  },

  broadway: {
    title: 'Broadway cards',
    senses: [{
      text: 'The five highest cards: ten, jack, queen, king and ace. Two of them together make a strong starting [[hand]].',
      example: 'King queen is two broadway cards, so it makes [[top-pair|top pair]] with a good [[kicker]] often.'
    }]
  },

  'cutoff': {
    title: 'Cutoff',
    senses: [{
      text: 'The seat directly right of the [[button]], the second best [[position]] at the table.',
      example: 'You are in the cutoff, so only the button acts after you.'
    }]
  },

  hijack: {
    title: 'Hijack',
    senses: [{
      text: 'The seat directly right of the [[cutoff]], two seats right of the [[button]]. A middle [[position]] seat.',
      example: 'From the hijack there are still three players left to act behind you.'
    }]
  },

  'under-the-gun': {
    title: 'Under the gun',
    senses: [{
      text: 'The first seat to act [[preflop]], directly left of the [[big-blind|big blind]]. The worst [[position]], because everybody acts after you.',
      example: 'Under the gun at a six handed table you should only play strong hands.'
    }]
  },

  steal: {
    title: 'Steal',
    senses: [{
      text: 'Raising from a late seat mostly to win the [[blinds]] without a fight, rather than because your [[hand]] is strong.',
      example: 'It folds to you on the [[button]] and you raise with nine seven suited to steal.'
    }]
  },

  'check-raise': {
    title: 'Check-raise',
    senses: [{
      text: 'Checking, letting an opponent [[bet]], and then [[raise|raising]] them. It builds a bigger [[pot]] with strong hands.',
      example: 'You check your [[two-pair|two pair]], they bet 10, and you raise to 35.'
    }]
  },

  'pot-sized-bet': {
    title: 'Pot sized bet',
    senses: [{
      text: 'A [[bet]] equal to the whole [[pot]]. It charges [[draw|draws]] the most while still giving them a reason to [[call]].',
      example: 'The pot is 30, so a pot sized bet is 30.'
    }]
  },

  'expected-value': {
    title: 'Expected value',
    senses: [{
      text: 'What a decision is worth on average if you made it many times. A good decision has positive expected value even when it loses this once.',
      example: 'Calling 10 to win 40 with a one in three chance is profitable in the long run, whatever happens this [[hand]].'
    }]
  },

  tight: {
    title: 'Tight',
    senses: [{
      text: 'Playing few [[hand|hands]] and folding often. A tight player who bets usually has something.',
      example: 'The tight player raised, so your marginal hand is probably beaten.'
    }]
  },

  loose: {
    title: 'Loose',
    senses: [{
      text: 'Playing many [[hand|hands]], including weak ones. A loose player has a much wider [[range]] than a [[tight]] one.',
      example: 'They call raises with any two cards, which is very loose.'
    }]
  },

  passive: {
    title: 'Passive',
    senses: [{
      text: 'Preferring to [[check]] and [[call]] rather than [[bet]] and [[raise]]. Passive players rarely put pressure on you.',
      example: 'A passive opponent calls three streets with a weak pair but never raises.'
    }]
  },

  aggressive: {
    title: 'Aggressive',
    senses: [{
      text: 'Betting and raising often instead of calling. Aggression wins pots that checking would not.',
      example: 'The aggressive player raises your [[flop]] bet with a [[draw]].'
    }]
  },

  'calling-station': {
    title: 'Calling station',
    senses: [{
      text: 'A player who [[call|calls]] almost anything and almost never [[fold|folds]]. [[bluff|Bluffing]] them does not work, so [[value-bet|value bet]] them relentlessly.',
      example: 'Against a calling station you bet your [[top-pair|top pair]] on every [[street]].'
    }]
  },

  leak: {
    title: 'Leak',
    senses: [{
      text: 'A mistake you keep making. Fixing one leak is worth more than learning a new trick.',
      example: 'Calling too many raises from the [[small-blind|small blind]] is a common leak.'
    }]
  }
};

// Terms that mean the same thing, so copy can use natural wording.
export const ALIASES = {
  'community cards': 'community-cards',
  'big blind': 'big-blind',
  'small blind': 'small-blind',
  'pot odds': 'pot-odds',
  'flush draw': 'flush-draw',
  'top pair': 'top-pair',
  'middle pair': 'middle-pair',
  'two pair': 'two-pair',
  'all in': 'all-in',
  'in position': 'in-position',
  'out of position': 'out-of-position',
  'open ended straight draw': 'open-ended-straight-draw',
  'continuation bet': 'continuation-bet',
  'value bet': 'value-bet',
  'semi bluff': 'semi-bluff',
  'made hand': 'made-hand',
  'high card': 'high-card',
  'showdown value': 'showdown-value',
  'side pot': 'side-pot',
  'board texture': 'board-texture',
  'expected value': 'expected-value',
  'check raise': 'check-raise',
  'pot sized bet': 'pot-sized-bet',
  'rule of two and four': 'rule-of-two-and-four',
  'backdoor draw': 'backdoor-draw',
  'calling station': 'calling-station',
  'under the gun': 'under-the-gun',
  'three bet': 'three-bet',
  'pocket pair': 'pocket-pair',
  'bottom pair': 'bottom-pair',
  'three of a kind': 'three-of-a-kind',
  set: 'three-of-a-kind',
  'full house': 'full-house',
  'four of a kind': 'four-of-a-kind',
  'straight flush': 'straight-flush',
  'royal flush': 'straight-flush'
};

export function resolveSlug(key) {
  if (!key) return null;
  const direct = String(key).trim();
  if (TERMS[direct]) return direct;
  const lower = direct.toLowerCase();
  if (TERMS[lower]) return lower;
  if (ALIASES[lower]) return ALIASES[lower];
  const dashed = lower.replace(/\s+/g, '-');
  if (TERMS[dashed]) return dashed;
  return null;
}

export function getTerm(key) {
  const slug = resolveSlug(key);
  return slug ? Object.assign({ slug }, TERMS[slug]) : null;
}

/**
 * Split copy written with [[slug|display text]] markup into a token list the
 * renderer can turn into tappable spans.
 */
export function parseMarkup(text) {
  const tokens = [];
  const pattern = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
  let last = 0;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      tokens.push({ type: 'text', text: text.slice(last, match.index) });
    }
    const slug = resolveSlug(match[1]);
    const display = match[2] || (slug ? TERMS[slug].title.toLowerCase() : match[1]);
    if (slug) {
      tokens.push({ type: 'term', slug, text: display });
    } else {
      tokens.push({ type: 'text', text: display });
    }
    last = pattern.lastIndex;
  }
  if (last < text.length) tokens.push({ type: 'text', text: text.slice(last) });
  return tokens;
}

export function allTerms() {
  return Object.keys(TERMS)
    .map((slug) => Object.assign({ slug }, TERMS[slug]))
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function searchTerms(query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return allTerms();
  return allTerms().filter((term) => {
    if (term.title.toLowerCase().includes(q)) return true;
    if (term.slug.includes(q)) return true;
    return term.senses.some((s) => s.text.toLowerCase().includes(q));
  });
}
