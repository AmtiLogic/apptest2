// glossary.js
// Every poker word the interface uses, written for somebody who has never
// heard any of them before.
//
// Rules for the copy in here:
//   1. Say what the thing literally is before saying why it matters.
//   2. Short sentences. Everyday words.
//   3. Any poker word inside a definition is written as [[slug|text]] so the
//      interface turns it into a tappable span. A definition never leans on
//      a word that is not itself defined here.
//   4. Every entry ends with one concrete example, with real cards or real
//      numbers rather than a restatement of the rule.

export const TERMS = {
  hand: {
    title: 'Hand',
    senses: [
      {
        label: 'Your two cards',
        text: 'The two cards dealt face down to you at the start. Only you can see them. They are yours for this one round and then they are thrown away.',
        example: 'You are dealt the ace of spades and the king of spades. People would say your hand is ace king suited.'
      },
      {
        label: 'One round of play',
        text: 'One whole round, from the cards being dealt to somebody winning the [[pot]]. Then the cards are collected, the [[button]] moves one seat, and the next one starts. Sitting and playing for an hour means playing a lot of these.',
        example: 'The counter at the top left of the screen says which hand you are on.'
      },
      {
        label: 'Your five card combination',
        text: 'The best five cards you can put together out of your two and the five in the middle. This is the thing that gets compared to everyone else at the end. You do not choose it, the best five is simply the one that counts.',
        example: 'You hold two kings, and a third king comes in the middle. Your hand is three of a kind, made from your two kings and the one on the [[board]].'
      }
    ]
  },

  position: {
    title: 'Position',
    senses: [{
      text: 'Where you are sitting compared to the [[button]]. That is what decides when your turn comes. Everyone acts one at a time, going clockwise, and the further you are past the button the earlier you have to act. Acting late is a real advantage, because you have already watched what everybody else did before you have to commit. Your position changes every [[hand]], because the button moves one seat every time.',
      example: 'Sitting on the button, you act last on every round after the first. Sitting just after the button, you act first, with five people still to react to you.'
    }]
  },

  'in-position': {
    title: 'In position',
    senses: [{
      text: 'Being the player who acts after the other one on every round left in the [[hand]]. You get to see what they do before you decide anything. This is the good side to be on.',
      example: 'You are on the [[button]] and only the [[big-blind|big blind]] is still in. They act, then you act, on every remaining round. You are in position on them.'
    }]
  },

  'out-of-position': {
    title: 'Out of position',
    senses: [{
      text: 'Being the player who has to act first on every round left in the [[hand]]. You commit to something and then they get to react, knowing what you did. This is the bad side to be on, and it is a reason to play fewer hands from the early seats.',
      example: 'You are in the [[small-blind|small blind]] against the [[button]]. You act first every round for the rest of the hand.'
    }]
  },

  blinds: {
    title: 'Blinds',
    senses: [{
      text: 'Two bets that two players are forced to put in before any cards are dealt. They exist so there is always money in the middle worth playing for. Without them everybody could just fold every hand for free forever. The two seats that pay them move one place to the left each hand, so everybody pays their share.',
      example: 'At blinds of 1 and 2, the player left of the [[button]] puts in 1 and the next player puts in 2, before anybody has looked at a card. That 3 is what the first player to act is trying to win.'
    }]
  },

  'small-blind': {
    title: 'Small blind',
    senses: [{
      text: 'The smaller of the two forced bets, and also the name of the seat that pays it. It is the seat directly to the left of the [[button]]. It is usually half the size of the [[big-blind|big blind]]. It is a bad seat, because after the first round it acts first every time.',
      example: 'You are in the small blind, so 1 chip of yours is in the middle before you have seen your cards. Look for the SB badge under a player.'
    }]
  },

  'big-blind': {
    title: 'Big blind',
    senses: [
      {
        label: 'The seat',
        text: 'The seat two to the left of the [[button]], which pays the larger of the two [[blinds]]. Because its money is already in, it gets to act last before the [[flop]], and it does not have to put in anything more if nobody raises.',
        example: 'You are the big blind with 2 already in. Everybody folds, so you win the [[small-blind|small blind]] without playing a card. Look for the BB badge under a player.'
      },
      {
        label: 'A way of counting money',
        text: 'Poker players measure everything in big blinds instead of chips, written BB. It is a way of saying how big something is without caring what the [[stakes]] are. A bet of 3BB means the same thing in a small game and a huge one.',
        example: 'At blinds of 1 and 2, one big blind is 2 chips. A 200 chip [[stack]] is 100 big blinds, and a raise to 6 is a raise to 3BB.'
      }
    ]
  },

  stakes: {
    title: 'Stakes',
    senses: [{
      text: 'How big the [[blinds]] are, which sets how much money moves around in a typical [[hand]]. Everything else scales off them.',
      example: 'Blinds of 1 and 2 are smaller stakes than blinds of 5 and 10. You can change this under Setup.'
    }]
  },

  button: {
    title: 'Button',
    senses: [{
      text: 'A marker showing whose turn it is to be the nominal [[dealer]] this [[hand]]. It matters because that seat acts last on every round after the first, which is the best seat at the table. It moves one place to the left after every hand, so everybody gets it equally often.',
      example: 'The small white D badge under a player means they have the button this hand. If it is under your own chips, you have it.'
    }]
  },

  dealer: {
    title: 'Dealer',
    senses: [{
      text: 'The player holding the [[button]] this [[hand]]. In a game at somebody home that player would physically shuffle and deal. Here the app deals every time, so the badge is only there to mark the seat that acts last.',
      example: 'The D badge moves one seat clockwise every hand, so the good seat keeps changing.'
    }]
  },

  pot: {
    title: 'Pot',
    senses: [{
      text: 'All the chips that everybody has bet so far this [[hand]], sitting in the middle. Once a chip is in the pot it is not yours any more, whoever put it in. Whoever wins the hand takes the whole thing.',
      example: 'Three players each put in 10, so the pot is 30. The number beside the cards in the middle of the screen is the pot.'
    }]
  },

  'side-pot': {
    title: 'Side pot',
    senses: [{
      text: 'A second pile that gets made when one player runs out of chips partway through. They can only win as much as they themselves put in from each opponent. Anything the others bet on top of that goes into a separate pile that only they can win. The app builds these for you.',
      example: 'You go [[all-in|all in]] for your last 20 while two others keep betting up to 100 each. You can win 60, the 20 you put in plus 20 from each of them. They play for the rest between themselves.'
    }]
  },

  stack: {
    title: 'Stack',
    senses: [{
      text: 'The chips a player has in front of them. It is the most they can win or lose this [[hand]]. If they have fewer chips than you, the extra you have cannot be won or lost against them.',
      example: 'You start with 200 chips, which at blinds of 1 and 2 is 100 [[big-blind|big blinds]]. Your stack is shown under your cards.'
    }]
  },

  'community-cards': {
    title: 'Community cards',
    senses: [{
      text: 'The cards dealt face up in the middle of the table. They belong to everybody at once, and every player uses them along with their own two. Five come out in total, three at once and then one at a time.',
      example: 'You have two hearts, and three more hearts come out in the middle. Those three are shared, but only you can use them with your two to make a [[flush]].'
    }]
  },

  board: {
    title: 'Board',
    senses: [{
      text: 'Another word for the [[community-cards|community cards]] that are face up right now. People also talk about what a board "looks like", meaning which hands it could have given somebody.',
      example: 'The board is king, seven, two with two spades. Anyone holding two spades is one card away from a [[flush]].'
    }]
  },

  'board-texture': {
    title: 'Board texture',
    senses: [{
      text: 'How dangerous the cards in the middle are. A dry board has cards that do not connect, so it is hard for anyone to have much. A wet board has cards close in rank or matching in suit, so lots of people could have a big hand or be one card away from one.',
      example: 'King, seven, two in three different suits is dry. Nine, eight, seven with two hearts is wet, because straights and [[flush|flushes]] are everywhere.'
    }]
  },

  street: {
    title: 'Street',
    senses: [{
      text: 'One round of betting. There are four in every [[hand]], and they have names: [[preflop]], [[flop]], [[turn]] and [[river]]. On each one, every player still in gets a turn to act.',
      example: 'You bet on the flop and the turn, then checked the river. That is betting two streets.'
    }]
  },

  preflop: {
    title: 'Preflop',
    senses: [{
      text: 'The first round of betting, before any cards are dealt in the middle. All you have to go on is your own two cards and your [[position]]. Most of the decisions you make in poker happen here, and most of them are folds.',
      example: 'Preflop you raise to 6 and only the [[big-blind|big blind]] calls. The two of you go on to see the [[flop]].'
    }]
  },

  flop: {
    title: 'Flop',
    senses: [{
      text: 'The first three [[community-cards|community cards]], turned over together, followed by a round of betting. This is the moment where most hands either become something or become nothing.',
      example: 'You hold ace nine. The flop comes nine, six, four, so you just paired your nine and now have [[top-pair|top pair]].'
    }]
  },

  turn: {
    title: 'Turn',
    senses: [{
      text: 'The fourth [[community-cards|community card]], dealt one at a time after the [[flop]] betting is done, followed by another round of betting. Bets tend to get bigger here because the [[pot]] is bigger.',
      example: 'The turn brings a third heart. Anybody who was holding two hearts has just made a [[flush]].'
    }]
  },

  river: {
    title: 'River',
    senses: [{
      text: 'The fifth and last [[community-cards|community card]]. After the betting on the river, anybody still in shows their cards. Nothing can improve after this, so a hand that is behind here is simply behind.',
      example: 'You needed one more spade and the river was a club. Your [[draw]] missed, so you have nothing and should stop putting money in.'
    }]
  },

  check: {
    title: 'Check',
    senses: [{
      text: 'Passing your turn without putting any money in, and staying in the [[hand]]. You can only do this when nobody has bet yet on this round. It is free.',
      example: 'You check, everyone behind you checks too, and the next card comes with nothing added to the [[pot]].'
    }]
  },

  call: {
    title: 'Call',
    senses: [{
      text: 'Putting in exactly enough to match the current bet, so you stay in without raising it. The button in the app shows how much it will cost you.',
      example: 'They bet 10. You call, which costs you 10, and the [[pot]] grows by 20 in total.'
    }]
  },

  bet: {
    title: 'Bet',
    senses: [{
      text: 'Being the first to put chips in on a round. Once you have bet, everybody after you must either match it, put in more, or give up their [[hand]]. If somebody has already bet, putting in more is called a [[raise]] instead.',
      example: 'Everyone checked on the [[flop]]. On the [[turn]] you bet 12 into a [[pot]] of 20.'
    }]
  },

  raise: {
    title: 'Raise',
    senses: [{
      text: 'Increasing a bet that is already out there. Everyone still in then has to match your new, bigger number or fold. Raising does two things at once: it wins more when you are ahead, and it can make better hands give up.',
      example: 'They bet 10 and you raise to 30. Calling now costs them 20 more than they had planned.'
    }]
  },

  'three-bet': {
    title: 'Three-bet',
    senses: [{
      text: 'The second [[raise]] in a round. It is counted oddly: the [[big-blind|big blind]] counts as the first bet, so the first raise is the second bet and re-raising that is the third. It usually means a very strong [[hand]].',
      example: 'They raise to 6 and you make it 20 with two queens. That is a three-bet.'
    }]
  },

  fold: {
    title: 'Fold',
    senses: [{
      text: 'Giving up. You throw your cards away and take no further part in this [[hand]]. Anything you already put in stays in the [[pot]] and is gone. This is the right answer far more often than beginners expect, and folding costs you nothing you can still save.',
      example: 'You hold seven two and somebody raises. You fold, and you have lost nothing except any [[blinds]] you were forced to post.'
    }]
  },

  limp: {
    title: 'Limp',
    senses: [{
      text: 'Coming into the [[pot]] before the [[flop]] by only calling the [[big-blind|big blind]] instead of raising. It is usually a weak choice, because it lets everybody behind you in cheaply and you never win the [[blinds]] outright.',
      example: 'Two players limp for 2 each, and then the [[button]] raises to 12 and both of them have a problem.'
    }]
  },

  open: {
    title: 'Open',
    senses: [{
      text: 'Being the first player to [[raise]] before the [[flop]]. The set of hands you would do that with from a given seat is called your opening [[range]], and this app grades yours against a chart every time.',
      example: 'Everybody folds to you in the [[cutoff]] and you raise to 5. You have opened the pot.'
    }]
  },

  'all-in': {
    title: 'All in',
    senses: [{
      text: 'Putting every chip you have left into the [[pot]]. After that you cannot be forced out of the [[hand]], because you have nothing left to be bet at. You also cannot win more than your own [[stack]] from each opponent.',
      example: 'You have 40 left and they bet 60. You call all in for your 40. The extra 20 of theirs comes back to them.'
    }]
  },

  showdown: {
    title: 'Showdown',
    senses: [{
      text: 'The end of a [[hand]], when the players still in turn their cards face up and the best five cards win the [[pot]]. Most hands never get here, because everybody but one has already folded.',
      example: 'Two players reach showdown. One has a pair of kings, the other has a [[flush]]. The flush wins the whole pot.'
    }]
  },

  'showdown-value': {
    title: 'Showdown value',
    senses: [{
      text: 'A [[hand]] that is not good enough to bet with, but is good enough that it might win if you get to the end cheaply. The right move with these is almost always to [[check]] and see what happens.',
      example: 'You have a small pair on the [[river]]. Betting only gets called by better hands, so you check, and it beats their missed [[draw]].'
    }]
  },

  kicker: {
    title: 'Kicker',
    senses: [{
      text: 'A spare card that settles a tie when two players have the same pair. Both hands are five cards, so if the pairs match, the next highest card in each hand decides it. This is how the same pair can win or lose a big [[pot]].',
      example: 'You both have a pair of aces. Your other card is a king and theirs is a nine, so your kicker plays and you win.'
    }]
  },

  'pot-odds': {
    title: 'Pot odds',
    senses: [{
      text: 'The price you are being offered on a [[call]]. Take what the call costs you and divide it by the size the [[pot]] would be after you call. That gives a percentage, and that percentage is how often you need to end up winning for the call to break even. It is the single most useful sum in poker.',
      example: 'The pot is 30 and they bet 10. You pay 10 to win 40, which is 25 percent, so calling is worth it if you win more than one time in four.'
    }]
  },

  outs: {
    title: 'Outs',
    senses: [{
      text: 'The cards still left in the deck that would turn your [[hand]] into a good one. You count them, and the number tells you how likely you are to get there. Counting outs is how you turn a hopeful feeling into a number you can act on.',
      example: 'You have four hearts and need one more. A deck has thirteen hearts, you can see four, so nine are left. You have nine outs.'
    }]
  },

  'rule-of-two-and-four': {
    title: 'Rule of two and four',
    senses: [{
      text: 'A shortcut for turning [[outs]] into a percentage in your head. Multiply your outs by two if one more card is coming, or by four if two more are coming and no more money can be bet. It is close enough to be useful at the table.',
      example: 'Nine outs with one card to come is about nine times two, so roughly eighteen percent.'
    }]
  },

  equity: {
    title: 'Equity',
    senses: [{
      text: 'Your share of the [[pot]] on average, as a percentage. Another way to say it: if the rest of the cards were dealt out a thousand times from this exact spot, this is how often you would end up winning.',
      example: 'Four cards to a [[flush]] against one pair is roughly 35 percent with two cards still to come. So you win about one time in three.'
    }]
  },

  range: {
    title: 'Range',
    senses: [{
      text: 'All the different [[hand|hands]] somebody could be holding right now, thought about as a group instead of one guess. You never get to know their exact cards, so guessing one is a waste of time. What you can do is narrow the group down from what they have done so far.',
      example: 'They raised from the very first seat. That is a narrow range: mostly big pairs and big cards, almost never seven two.'
    }]
  },

  draw: {
    title: 'Draw',
    senses: [{
      text: 'A [[hand]] that is worth nothing yet but becomes strong if the right card shows up. You are drawing to something. The whole question with a draw is whether the price you are being asked to pay is worth the chance of hitting it.',
      example: 'You have four cards toward a [[flush]] on the [[flop]]. Right now you have nothing at all, but two more cards are still to come.'
    }]
  },

  'flush-draw': {
    title: 'Flush draw',
    senses: [{
      text: 'Having four cards of the same suit, needing one more of that suit to make a [[flush]]. Nine cards of that suit are still unseen, so it is a strong [[draw]], worth nine [[outs]].',
      example: 'You hold two spades and two more spades are on the [[board]]. Any spade to come makes your flush.'
    }]
  },

  flush: {
    title: 'Flush',
    senses: [{
      text: 'Five cards all of the same suit. The ranks do not have to connect. It beats a [[straight]] and loses to a [[full-house|full house]]. When two people have one, the highest card in it wins.',
      example: 'You hold two diamonds and three more diamonds come in the middle, so you have five diamonds in total.'
    }]
  },

  straight: {
    title: 'Straight',
    senses: [{
      text: 'Five cards in a row by rank, in any mix of suits. An ace can sit at the top, above the king, or at the bottom below the two, but it cannot wrap around from one to the other.',
      example: 'You hold six seven and the [[board]] has five, eight, nine. Five six seven eight nine is a straight.'
    }]
  },

  'open-ended-straight-draw': {
    title: 'Open ended straight draw',
    senses: [{
      text: 'Four cards in a row, where a card at either end finishes the [[straight]]. Two ranks work, four cards of each, so eight [[outs]]. That is twice as good as a [[gutshot]].',
      example: 'You have six, seven, eight, nine. Either a five or a ten makes your straight.'
    }]
  },

  gutshot: {
    title: 'Gutshot',
    senses: [{
      text: 'A [[straight]] [[draw]] with a hole in the middle. Only one rank fills it, so four cards, so four [[outs]]. It is a weak draw and usually not worth paying much for.',
      example: 'You have six seven and the [[board]] shows nine, ten. Only an eight completes six seven eight nine ten.'
    }]
  },

  'backdoor-draw': {
    title: 'Backdoor draw',
    senses: [{
      text: 'Needing both of the last two cards to go your way. It almost never happens, so on its own it is worth very little. It is a small bonus on top of a real reason to keep playing, not a reason by itself.',
      example: 'You have three hearts on the [[flop]]. Two more hearts in a row would give you a [[flush]], which is a long shot.'
    }]
  },

  'top-pair': {
    title: 'Top pair',
    senses: [{
      text: 'Matching the highest card in the middle with one of your own two. On most flops this is a genuinely good [[hand]], and it is the one you will win the most ordinary pots with.',
      example: 'You hold ace nine and the [[flop]] is nine, six, two. Your nine matches the highest card there, and your ace is your [[kicker]].'
    }]
  },

  'middle-pair': {
    title: 'Middle pair',
    senses: [{
      text: 'Matching a card in the middle that is neither the highest nor the lowest. It often wins if you get to the end cheaply, but it is not worth putting a lot of money in with.',
      example: 'You hold seven six and the [[board]] is king, seven, three. Your sevens are not the top card there, so they are middle pair.'
    }]
  },

  overpair: {
    title: 'Overpair',
    senses: [{
      text: 'Holding a pair in your own two cards that is higher than every card in the middle. Nobody can have [[top-pair|top pair]] and beat you, so it is usually a strong [[hand]] worth betting.',
      example: 'You hold two queens and the [[flop]] comes nine, six, two. Your queens beat any pair made from that board.'
    }]
  },

  'bottom-pair': {
    title: 'Bottom pair',
    senses: [{
      text: 'Matching the lowest card in the middle. It is the weakest kind of [[pair]] and it beats almost nothing that is going to keep betting at you. Rarely worth more than one [[call]].',
      example: 'You hold nine three and the [[board]] is king, eight, three. Your threes are bottom pair.'
    }]
  },

  pair: {
    title: 'Pair',
    senses: [{
      text: 'Two cards of the same rank inside your best five. It is the most common winning [[hand]] in this game, so most pots are won with something quite ordinary. Which pair it is matters enormously.',
      example: 'You hold a king and a king comes in the middle. You have a pair of kings.'
    }]
  },

  'pocket-pair': {
    title: 'Pocket pair',
    senses: [{
      text: 'Being dealt two cards of the same rank, so you already have a [[pair]] before anything comes out in the middle. These are strong starting hands, and the higher the pair the stronger it is.',
      example: 'You are dealt two nines. That is a pocket pair, and you are already ahead of anybody holding two unpaired cards.'
    }]
  },

  'two-pair': {
    title: 'Two pair',
    senses: [{
      text: 'Two separate [[pair|pairs]] inside your best five cards. It beats one pair and loses to [[three-of-a-kind|three of a kind]]. Watch out: if both pairs are sitting in the middle, everybody has them, and only your [[kicker]] is really yours.',
      example: 'You hold ace nine on a board of ace, nine, four. Your aces and nines are both made with your own cards.'
    }]
  },

  'three-of-a-kind': {
    title: 'Three of a kind',
    senses: [{
      text: 'Three cards of the same rank. When you make it by holding a [[pocket-pair|pocket pair]] and hitting a third in the middle it is also called a set, and it is very hard for anybody to see coming.',
      example: 'You hold two sevens and a seven comes on the [[flop]]. Nobody expects that, which is why it wins big pots.'
    }]
  },

  'full-house': {
    title: 'Full house',
    senses: [{
      text: '[[three-of-a-kind|Three of a kind]] plus a [[pair]], five cards in all. It beats a [[flush]] and a [[straight]], so it is a very big hand.',
      example: 'You hold two nines on a board of nine, four, four. Three nines and two fours is a full house.'
    }]
  },

  'four-of-a-kind': {
    title: 'Four of a kind',
    senses: [{
      text: 'All four cards of one rank. Almost nothing beats it. Only a [[straight-flush|straight flush]] does.',
      example: 'You hold two jacks and two more jacks come out in the middle.'
    }]
  },

  'straight-flush': {
    title: 'Straight flush',
    senses: [{
      text: 'Five cards in a row that are also all the same suit, so a [[straight]] and a [[flush]] at once. It is the best possible hand. Ten through ace is the top version of it and gets called a royal flush.',
      example: 'You hold the eight and nine of hearts, and the five, six and seven of hearts are in the middle.'
    }]
  },

  'made-hand': {
    title: 'Made hand',
    senses: [{
      text: 'A [[hand]] that is already worth something without needing any more cards. The opposite of a [[draw]], which is only worth something if the right card arrives.',
      example: 'A pair of kings is a made hand. Four cards toward a [[flush]] is not, it is a draw.'
    }]
  },

  'high-card': {
    title: 'High card',
    senses: [{
      text: 'No [[pair]], no [[draw]], nothing. Your hand is worth only its highest card. This is what most hands look like most of the time, and it is almost always a fold when somebody bets.',
      example: 'You hold king four and the board is nine, seven, two. You have king high, which beats nothing that is going to call you.'
    }]
  },

  'continuation-bet': {
    title: 'Continuation bet',
    senses: [{
      text: 'Betting on the [[flop]] after you were the one who raised before it, continuing the story that you have something big. It works often, because three random cards miss most hands, so your opponent usually has nothing either.',
      example: 'You raised before the flop with ace queen. The flop is king, seven, two and you missed, but you bet anyway and they fold.'
    }]
  },

  'value-bet': {
    title: 'Value bet',
    senses: [{
      text: 'Betting a strong [[hand]] because you want to be called. You are not trying to make them fold, you are trying to get paid. Beginners lose more money by not doing this than by anything else.',
      example: 'You have [[two-pair|two pair]] on the [[river]]. You bet, because somebody with one pair will often call you and you win extra.'
    }]
  },

  bluff: {
    title: 'Bluff',
    senses: [{
      text: 'Betting with a weak [[hand]] to make a better one fold. It only works when the story adds up: the cards in the middle have to look like they could have helped you, and the person you are bluffing has to be capable of folding.',
      example: 'You have nothing on a board of ace, king, four. You bet, and they let go of a small pair because an ace could easily be in your hand.'
    }]
  },

  'semi-bluff': {
    title: 'Semi-bluff',
    senses: [{
      text: 'Betting with a [[draw]] rather than with nothing. It is the best of both: they might fold right away, and if they call you still have [[outs]] to make the best hand later.',
      example: 'You bet with four cards toward a [[flush]]. Either they fold now, or you hit your flush and get paid.'
    }]
  },

  dominated: {
    title: 'Dominated',
    senses: [{
      text: 'Having one card the same as a better hand, so that when you pair up you are still losing. This is the quiet way beginners lose big pots, because your hand looks like it is winning right up until the money goes in.',
      example: 'You have ace five, they have ace king. An ace comes and you both pair, but their king beats your five, so you pay them off.'
    }]
  },

  suited: {
    title: 'Suited',
    senses: [{
      text: 'Your two cards are the same suit, which means a [[flush]] is possible for you. It is worth a bit more than the same two cards in different suits. Written with an s, as in AKs.',
      example: 'The king of hearts with the nine of hearts is king nine suited.'
    }]
  },

  offsuit: {
    title: 'Offsuit',
    senses: [{
      text: 'Your two cards are different suits, so you cannot make a [[flush]] using both. Slightly worse than the same cards [[suited]]. Written with an o, as in AKo.',
      example: 'The ace of clubs with the queen of hearts is ace queen offsuit.'
    }]
  },

  connectors: {
    title: 'Connectors',
    senses: [{
      text: 'Two cards next to each other in rank, which can make a [[straight]]. They are much more useful when they are also [[suited]], because then they can make a [[flush]] too.',
      example: 'The eight and seven of hearts is a suited connector.'
    }]
  },

  broadway: {
    title: 'Broadway cards',
    senses: [{
      text: 'The five highest cards: ten, jack, queen, king and ace. Two of them together is a strong starting [[hand]], because when you pair one you often have [[top-pair|top pair]] with a good [[kicker]].',
      example: 'King queen is two broadway cards. On a queen high board you have top pair and a king to go with it.'
    }]
  },

  cutoff: {
    title: 'Cutoff',
    senses: [{
      text: 'The seat immediately to the right of the [[button]], so it acts second to last. It is the second best seat at the table, and you can play a lot of hands from it.',
      example: 'From the cutoff only one player, the button, still acts after you on each round.'
    }]
  },

  hijack: {
    title: 'Hijack',
    senses: [{
      text: 'The seat immediately to the right of the [[cutoff]], two to the right of the [[button]]. A middle seat: not terrible, not great.',
      example: 'From the hijack there are still three players who act after you, so you want a decent hand to get involved.'
    }]
  },

  'under-the-gun': {
    title: 'Under the gun',
    senses: [{
      text: 'The first seat to act before the [[flop]], directly to the left of the [[big-blind|big blind]]. It is the worst seat at the table, because everybody else acts after you and any one of them can raise. Play very few hands from here.',
      example: 'Under the gun at a six handed table, five players still get to act behind you.'
    }]
  },

  steal: {
    title: 'Steal',
    senses: [{
      text: 'Raising from one of the late seats mainly to win the [[blinds]] without a fight, rather than because your cards are good. It works because the two players left to act have usually been dealt nothing.',
      example: 'Everybody folds to you on the [[button]] and you raise with nine seven suited, hoping the blinds give up.'
    }]
  },

  'check-raise': {
    title: 'Check-raise',
    senses: [{
      text: 'Checking, letting somebody else bet, and then raising them in the same round. It gets more money in than betting yourself would have, because they have already committed.',
      example: 'You check your [[two-pair|two pair]], they bet 10 thinking you are weak, and you raise to 35.'
    }]
  },

  'pot-sized-bet': {
    title: 'Pot sized bet',
    senses: [{
      text: 'A bet the same size as the [[pot]]. It is about the largest bet that still gives somebody with a [[draw]] a reason to call, so it charges them the most without simply ending the hand.',
      example: 'The pot is 30 and you bet 30. Calling costs them 30 to win 90, so they need to win one time in three.'
    }]
  },

  'expected-value': {
    title: 'Expected value',
    senses: [{
      text: 'What a decision is worth on average if you made it over and over. This is the only sensible way to judge whether you played well, because a good decision loses plenty of the time and a bad one often wins.',
      example: 'Calling 10 to win 40 when you get there one time in three makes money in the long run, no matter what the next card is this once.'
    }]
  },

  tight: {
    title: 'Tight',
    senses: [{
      text: 'Playing very few [[hand|hands]] and folding most of the time. When a tight player finally puts money in, they usually have something real, so believe them.',
      example: 'The tight player has folded twenty hands in a row and has now raised. Your middle pair is probably beaten.'
    }]
  },

  loose: {
    title: 'Loose',
    senses: [{
      text: 'Playing lots of [[hand|hands]], including weak ones. A loose player could have almost anything, so their bets tell you much less than a [[tight]] player.',
      example: 'They have called raises with seven three twice already. That is loose.'
    }]
  },

  passive: {
    title: 'Passive',
    senses: [{
      text: 'Preferring to [[check]] and [[call]] rather than to [[bet]] and [[raise]]. Passive players rarely put you under pressure, so when one does raise, pay attention.',
      example: 'They called all the way down with a weak pair and never once raised.'
    }]
  },

  aggressive: {
    title: 'Aggressive',
    senses: [{
      text: 'Betting and raising often rather than calling. It wins pots that checking would not, because the other player has to fold or commit. Most beginners are not aggressive enough.',
      example: 'They raise your [[flop]] bet holding only a [[draw]], which puts the decision back on you.'
    }]
  },

  'calling-station': {
    title: 'Calling station',
    senses: [{
      text: 'Somebody who calls with almost anything and will not fold a [[pair]]. There is no point trying to [[bluff]] them, because they are not folding. Instead, bet your good hands hard and let them pay you.',
      example: 'Against a calling station you bet [[top-pair|top pair]] on all three rounds and get called every time.'
    }]
  },

  leak: {
    title: 'Leak',
    senses: [{
      text: 'A mistake you keep making without noticing. Fixing one leak is worth more than learning any new trick. The Stats screen in this app lists yours with the worst at the top.',
      example: 'Calling too many raises from the [[small-blind|small blind]] is a very common leak.'
    }]
  }
};

// Different ways the same thing gets written, so copy can read naturally.
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

// Plain text with the markup stripped, for search and for list previews.
export function plainText(markup) {
  return parseMarkup(String(markup || '')).map((token) => token.text).join('');
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
    return term.senses.some((s) => plainText(s.text).toLowerCase().includes(q));
  });
}
