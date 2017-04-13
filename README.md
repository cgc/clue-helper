## Clue Helper

Inspired while playing Clue over holidays, I've written a solver using https://github.com/meteor/logic-solver (which uses MiniSat under the covers). I've taken lots of hints from this Gettysburg College [Clue Deduction](http://cs.gettysburg.edu/~tneller/nsf/clue/) assignment.

```javascript
const { ClueGame } = require('clue-helper');

// start a new game with the list of players in the order
// they will take turns
const game = new ClueGame([
  'scarlet',
  'mustard',
  'white',
  'green',
  'peacock',
  'plum',
]);

// set your hand
game.hand('green', ['white', 'library', 'study']);

// record each player's suggestion
game.suggest('scarlet', 'scarlet', 'rope', 'lounge', 'mustard', 'scarlet');

// you won't have an exact solution at first
game.hasExactSolution(); // -> false

// ... many suggestions later

// but eventually you will!
game.hasExactSolution(); // -> true!!

// so check out the solution
console.log(game.potentialSolution());
/*
-> {
  suspect: ['peacock'],
  weapon: ['lead pipe'],
  room: ['billiard room']
}
*/
```

#### api
##### ClueGame(array<string> players)
Construct a ClueGame instance with a list of players in the order they will take turns. This list must be in turn-order to appropriately constrain the hands of players that weren't able to refute a suggestion.

##### game.hand(string player, array<string> cards)
Set the hand of a player.

##### game.suggest(string suggester, string suspect, string weapon, string room, string? refuter, string? cardShown)
Record a suggestion of `suspect`, `weapon`, `room` from `suggester`. This suggestion may be refuted by `refuter`, and will be `null` if no one could refute it. If the current player was the suggester and the suggestion was refuted, `cardShown` will be the card shown by `refuter`.

##### game.hasExactSolution() -> boolean
Returns true when the solver has found one solution to the game. Will return false when there are many solutions.

##### game.potentialSolution() -> object<suspect: array<string>, weapon: array<string>, room: array<string>>
Returns the potential suspects, weapons, and rooms for the case.

#### todo
- add support for recording failed accusations
- test support for face-up cards
- web ui?
- make API keep track of turns
- Generate maximally-informative questions
