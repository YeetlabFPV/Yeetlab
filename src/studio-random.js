// Deliberately paired filament colours. The first colour sets the canopy.
const colours = {
  Aubergine: '#65338c', Aqua: '#00bbac', Blueberry: '#354cab', Bone: '#e2d9c4',
  Bordeaux: '#92223e', Cobalt: '#1955bb', Coral: '#ec5959', Denim: '#41658c',
  Emerald: '#00875e', Flame: '#f55514', Graphite: '#41434b', Ice: '#acdeec',
  Indigo: '#50379c', Lagoon: '#007e92', Lemon: '#ead20a', Lime: '#9ad51b',
  Magenta: '#cd167c', Navy: '#172e51', Olive: '#76823e', Pearl: '#ecebe5',
  Petrol: '#075f66', Pine: '#225c49', Raspberry: '#b91f57', Red: '#ce2635',
  Sand: '#c6a26c', Silver: '#9ea5ad', Sky: '#309fcf', Yellow: '#efb918',
};
const pairings = [
  ['Emerald', 'Bone'], ['Emerald', 'Lemon'], ['Emerald', 'Graphite'], ['Emerald', 'Ice'], ['Emerald', 'Navy'],
  ['Navy', 'Flame'], ['Navy', 'Ice'], ['Navy', 'Coral'], ['Navy', 'Lime'], ['Navy', 'Sand'],
  ['Raspberry', 'Petrol'], ['Raspberry', 'Pearl'], ['Raspberry', 'Denim'], ['Raspberry', 'Lemon'], ['Raspberry', 'Silver'],
  ['Cobalt', 'Aqua'], ['Cobalt', 'Bone'], ['Cobalt', 'Flame'], ['Cobalt', 'Coral'], ['Cobalt', 'Silver'],
  ['Graphite', 'Lime'], ['Graphite', 'Red'], ['Graphite', 'Yellow'], ['Graphite', 'Aqua'], ['Graphite', 'Magenta'],
  ['Lagoon', 'Sand'], ['Lagoon', 'Pearl'], ['Lagoon', 'Yellow'], ['Lagoon', 'Coral'], ['Lagoon', 'Blueberry'],
  ['Pearl', 'Pine'], ['Pearl', 'Indigo'], ['Pearl', 'Sky'], ['Pearl', 'Bordeaux'], ['Pearl', 'Graphite'],
  ['Aubergine', 'Ice'], ['Aubergine', 'Lime'], ['Aubergine', 'Emerald'], ['Aubergine', 'Silver'], ['Aubergine', 'Magenta'],
  ['Flame', 'Denim'], ['Flame', 'Bone'], ['Flame', 'Petrol'], ['Flame', 'Graphite'], ['Flame', 'Sky'],
  ['Lime', 'Blueberry'], ['Sand', 'Olive'], ['Bordeaux', 'Sand'], ['Red', 'Denim'], ['Yellow', 'Pine'],
];
const variants = pairings.map(([a, b]) => [a + ' & ' + b, colours[a], colours[b]]);
let deck = [];
let previous;

export function nextRandomPreset() {
  if (!deck.length) {
    deck = [...variants];
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    const last = deck.length - 1;
    if (deck[last] === previous) [deck[last], deck[0]] = [deck[0], deck[last]];
  }
  previous = deck.pop();
  return { preset: previous, position: variants.length - deck.length, total: variants.length };
}
