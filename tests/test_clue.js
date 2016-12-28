const assert = require('assert');
const { ClueGame, _negatedMissingVars, _potentialCards } = require('../clue');
const Logic = require('logic-solver');

function assertPlayerCardsHaveSamePotentialValues(solver, playerCards) {
  const potentials = playerCards.map(c => _potentialCards(solver, c));
  const first = Array.from(potentials[0]).sort();
  for (const potentialSolution of potentials) {
    assert.deepEqual(first, Array.from(potentialSolution).sort());
  }
}

describe('clue', function() {
  it('base test from AI assignment', function() {
    const game = new ClueGame([
      'scarlet',
      'mustard',
      'white',
      'green',
      'peacock',
      'plum',
    ]);

    game.hand('scarlet', ['white', 'library', 'study']);
    game.suggest('scarlet', 'scarlet', 'rope', 'lounge', 'mustard', 'scarlet');
    game.suggest('mustard', 'peacock', 'lead pipe', 'dining room', 'peacock', null);
    game.suggest('white', 'mustard', 'revolver', 'ballroom', 'peacock', null);
    game.suggest('green', 'white', 'knife', 'ballroom', 'plum', null);
    game.suggest('peacock', 'green', 'candlestick', 'dining room', 'white', null);
    game.suggest('plum', 'white', 'wrench', 'study', 'scarlet', 'white');
    game.suggest('scarlet', 'plum', 'rope', 'conservatory', 'mustard', 'plum');
    game.suggest('mustard', 'peacock', 'rope', 'ballroom', 'white', null);
    game.suggest('white', 'mustard', 'candlestick', 'study', 'green', null);
    game.suggest('green', 'peacock', 'knife', 'dining room', 'peacock', null);
    game.suggest('peacock', 'mustard', 'lead pipe', 'dining room', 'plum', null);
    game.suggest('plum', 'green', 'knife', 'conservatory', 'white', null);
    game.suggest('scarlet', 'peacock', 'knife', 'lounge', 'mustard', 'lounge');
    game.suggest('mustard', 'peacock', 'knife', 'dining room', 'white', null);
    game.suggest('white', 'peacock', 'wrench', 'hall', 'green', null);
    game.suggest('green', 'white', 'lead pipe', 'conservatory', 'plum', null);
    game.suggest('peacock', 'scarlet', 'lead pipe', 'hall', 'mustard', null);
    game.suggest('plum', 'peacock', 'lead pipe', 'ballroom', null, null);
    game.suggest('scarlet', 'white', 'lead pipe', 'hall', 'peacock', 'hall');
    game.suggest('white', 'peacock', 'lead pipe', 'hall', 'peacock', null);
    game.suggest('peacock', 'peacock', 'lead pipe', 'hall', null, null);
    game.suggest('scarlet', 'green', 'lead pipe', 'study', 'white', 'green');
    game.suggest('mustard', 'peacock', 'lead pipe', 'ballroom', 'plum', null);
    game.suggest('white', 'peacock', 'lead pipe', 'study', 'scarlet', 'study');
    game.suggest('green', 'white', 'lead pipe', 'study', 'scarlet', 'white');
    game.suggest('peacock', 'white', 'lead pipe', 'study', 'scarlet', 'white');

    assert(!game.hasExactSolution());
    assert.deepEqual(game.potentialSolution(), {
      suspect: ['peacock'],
      weapon: ['lead pipe'],
      room: ['kitchen', 'billiard room']
    });
    for (const playerCards of game.cardLocations) {
      assertPlayerCardsHaveSamePotentialValues(game.solver, playerCards);
    }

    game.suggest('plum', 'peacock', 'lead pipe', 'kitchen', 'green', null);

    assert(game.hasExactSolution());
    assert(game.checkAccusation('peacock', 'lead pipe', 'billiard room'));
    assert.deepEqual(game.potentialSolution(), {
      suspect: ['peacock'],
      weapon: ['lead pipe'],
      room: ['billiard room']
    });
  });

  it('returns players between', function() {
    const game = new ClueGame([
      'scarlet',
      'mustard',
      'white',
      'green',
      'peacock',
      'plum',
    ]);

    // basic case
    assert.deepEqual(Array.from(game._playersBetween('scarlet', 'green')), [
      'mustard', 'white'
    ]);

    // wrap-around
    assert.deepEqual(Array.from(game._playersBetween('green', 'mustard')), [
      'peacock', 'plum', 'scarlet'
    ]);

    // no refuter
    assert.deepEqual(Array.from(game._playersBetween('white', null)), [
      'green', 'peacock', 'plum', 'scarlet', 'mustard'
    ]);
  });
});

describe('negatedMissingVars', function() {
  it('returns negated missing vars', function() {
    const solver = new Logic.Solver();
    solver.require(Logic.or('A', 'B'));
    const solution = solver.solve();
    const trueVars = solution.getTrueVars();
    assert.deepEqual(trueVars, ['A']);
    assert.deepEqual(_negatedMissingVars(solver, trueVars), [Logic.not('B')]);
  });
});
