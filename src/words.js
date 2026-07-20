// Dictionary access. The full 12.5k-word list loads lazily; random picks and
// suggestions draw from a curated common-word pool so they stay guessable.
let dictPromise = null

export function loadDict() {
  if (!dictPromise) {
    dictPromise = import('./data/words.json').then((m) => new Set(m.default))
  }
  return dictPromise
}

export async function isValidWord(word) {
  const dict = await loadDict()
  return dict.has(word.toLowerCase())
}

export async function searchWords(query, limit = 60) {
  const dict = await loadDict()
  const q = query.toLowerCase()
  const starts = []
  const contains = []
  for (const w of dict) {
    if (w.startsWith(q)) starts.push(w)
    else if (w.includes(q)) contains.push(w)
    if (starts.length >= limit) break
  }
  return [...starts, ...contains].slice(0, limit)
}

export function randomCommonWord(exclude = []) {
  const pool = COMMON.filter((w) => !exclude.includes(w))
  return pool[Math.floor(Math.random() * pool.length)]
}

export const COMMON = [
  'about', 'above', 'actor', 'adopt', 'after', 'again', 'agent', 'agree', 'alarm', 'album',
  'alert', 'alien', 'alive', 'allow', 'alone', 'along', 'amber', 'angel', 'anger', 'angle',
  'ankle', 'apple', 'apron', 'arena', 'argue', 'armor', 'aroma', 'arrow', 'aside', 'atlas',
  'audio', 'avoid', 'awake', 'award', 'badge', 'bacon', 'baker', 'basic', 'basil', 'beach',
  'beard', 'beast', 'began', 'begin', 'bench', 'berry', 'birth', 'black', 'blade', 'blame',
  'blank', 'blast', 'blaze', 'blend', 'bless', 'blind', 'block', 'bloom', 'blues', 'blunt',
  'board', 'bonus', 'boost', 'booth', 'bound', 'brain', 'brand', 'brave', 'bread', 'break',
  'brick', 'bride', 'brief', 'bring', 'broad', 'brook', 'broom', 'brown', 'brush', 'build',
  'bunch', 'burst', 'buyer', 'cabin', 'cable', 'camel', 'candy', 'cargo', 'carol', 'carry',
  'catch', 'cause', 'chain', 'chair', 'chalk', 'charm', 'chart', 'chase', 'cheap', 'check',
  'cheek', 'cheer', 'chess', 'chest', 'chief', 'child', 'chill', 'choir', 'chose', 'cider',
  'cigar', 'civil', 'claim', 'clash', 'class', 'clean', 'clear', 'clerk', 'click', 'cliff',
  'climb', 'cloak', 'clock', 'close', 'cloth', 'cloud', 'clown', 'coach', 'coast', 'cobra',
  'cocoa', 'color', 'comet', 'comic', 'coral', 'couch', 'count', 'court', 'cover', 'crack',
  'craft', 'crane', 'crash', 'crawl', 'crazy', 'cream', 'creek', 'crime', 'crisp', 'cross',
  'crowd', 'crown', 'crumb', 'crush', 'curve', 'cycle', 'daily', 'dairy', 'dance', 'delay',
  'delta', 'demon', 'dense', 'depth', 'devil', 'diary', 'digit', 'diner', 'dirty', 'ditch',
  'dodge', 'donut', 'doubt', 'dough', 'dozen', 'draft', 'drain', 'drama', 'dream', 'dress',
  'drift', 'drill', 'drink', 'drive', 'drone', 'drove', 'dusty', 'dwarf', 'eagle', 'early',
  'earth', 'eight', 'elbow', 'elder', 'elect', 'email', 'empty', 'enemy', 'enjoy', 'enter',
  'equal', 'error', 'event', 'every', 'exact', 'exam', 'exist', 'extra', 'fable', 'faith',
  'false', 'fancy', 'feast', 'fence', 'ferry', 'fever', 'field', 'fifty', 'fight', 'final',
  'first', 'flame', 'flash', 'fleet', 'flesh', 'float', 'flock', 'floor', 'flour', 'fluid',
  'flute', 'focus', 'force', 'forge', 'forth', 'forty', 'forum', 'found', 'frame', 'fraud',
  'fresh', 'front', 'frost', 'fruit', 'fudge', 'funny', 'ghost', 'giant', 'given', 'glass',
  'globe', 'glory', 'glove', 'going', 'goose', 'grace', 'grade', 'grain', 'grand', 'grant',
  'grape', 'graph', 'grasp', 'grass', 'grave', 'great', 'greed', 'green', 'greet', 'grill',
  'grind', 'group', 'grove', 'guard', 'guess', 'guest', 'guide', 'happy', 'harsh', 'heart',
  'heavy', 'hedge', 'hello', 'hobby', 'honey', 'honor', 'horse', 'hotel', 'house', 'human',
  'humor', 'hurry', 'ideal', 'image', 'index', 'inner', 'input', 'irony', 'issue', 'ivory',
  'jeans', 'jelly', 'jewel', 'joint', 'jolly', 'judge', 'juice', 'jumbo', 'kayak', 'knife',
  'knock', 'known', 'koala', 'label', 'labor', 'lance', 'large', 'laser', 'latch', 'later',
  'laugh', 'layer', 'learn', 'lease', 'least', 'leave', 'legal', 'lemon', 'level', 'light',
  'lilac', 'limit', 'linen', 'liver', 'lobby', 'local', 'lodge', 'logic', 'loose', 'lower',
  'loyal', 'lucky', 'lunar', 'lunch', 'lyric', 'magic', 'major', 'mango', 'maple', 'march',
  'match', 'maybe', 'mayor', 'medal', 'media', 'melon', 'mercy', 'merge', 'merit', 'merry',
  'metal', 'meter', 'micro', 'might', 'mimic', 'minor', 'minus', 'mixed', 'model', 'money',
  'month', 'moral', 'motel', 'motor', 'mount', 'mouse', 'mouth', 'movie', 'music', 'naval',
  'nerve', 'never', 'night', 'ninja', 'noble', 'noise', 'north', 'novel', 'nurse', 'nylon',
  'ocean', 'offer', 'often', 'olive', 'onion', 'opera', 'orbit', 'order', 'organ', 'other',
  'otter', 'ounce', 'outer', 'owner', 'oxide', 'ozone', 'paint', 'panda', 'panel', 'panic',
  'paper', 'party', 'pasta', 'patch', 'pause', 'peace', 'peach', 'pearl', 'pedal', 'penny',
  'phase', 'phone', 'photo', 'piano', 'piece', 'pilot', 'pinch', 'pitch', 'pixel', 'pizza',
  'place', 'plain', 'plane', 'plant', 'plate', 'plaza', 'point', 'polar', 'porch', 'pound',
  'power', 'press', 'price', 'pride', 'prime', 'print', 'prize', 'proof', 'proud', 'prove',
  'pulse', 'punch', 'pupil', 'puppy', 'purse', 'queen', 'query', 'quest', 'quick', 'quiet',
  'quilt', 'quota', 'quote', 'radar', 'radio', 'raise', 'ranch', 'range', 'rapid', 'ratio',
  'reach', 'ready', 'realm', 'rebel', 'refer', 'reign', 'relax', 'reply', 'rhyme', 'rider',
  'ridge', 'rifle', 'right', 'rigid', 'risky', 'rival', 'river', 'roast', 'robin', 'robot',
  'rocky', 'rogue', 'roman', 'rough', 'round', 'route', 'royal', 'rugby', 'ruler', 'rumor',
  'rural', 'salad', 'salsa', 'sandy', 'sauce', 'scale', 'scarf', 'scene', 'scent', 'scoop',
  'scope', 'score', 'scout', 'scrap', 'seven', 'shade', 'shaft', 'shake', 'shall', 'shape',
  'share', 'shark', 'sharp', 'sheep', 'sheet', 'shelf', 'shell', 'shift', 'shine', 'shiny',
  'shirt', 'shock', 'shore', 'short', 'shout', 'shrug', 'sight', 'silly', 'since', 'siren',
  'sixty', 'skate', 'skill', 'skirt', 'skull', 'slate', 'sleep', 'slice', 'slide', 'slope',
  'small', 'smart', 'smile', 'smoke', 'snack', 'snake', 'solar', 'solid', 'solve', 'sonic',
  'sound', 'south', 'space', 'spare', 'spark', 'speak', 'speed', 'spell', 'spend', 'spice',
  'spicy', 'spike', 'spine', 'spoon', 'sport', 'spray', 'squad', 'stack', 'staff', 'stage',
  'stain', 'stair', 'stake', 'stamp', 'stand', 'stare', 'start', 'state', 'steak', 'steal',
  'steam', 'steel', 'steep', 'stick', 'still', 'sting', 'stock', 'stone', 'stool', 'store',
  'storm', 'story', 'stove', 'strap', 'straw', 'strip', 'study', 'stuff', 'style', 'sugar',
  'suite', 'sunny', 'super', 'surge', 'sushi', 'swamp', 'swarm', 'sweat', 'sweep', 'sweet',
  'swift', 'swing', 'sword', 'syrup', 'table', 'taste', 'teach', 'thank', 'theme', 'thick',
  'thief', 'thing', 'think', 'third', 'thorn', 'three', 'throw', 'thumb', 'tiger', 'tight',
  'title', 'toast', 'today', 'token', 'torch', 'total', 'touch', 'tough', 'towel', 'tower',
  'trace', 'track', 'trade', 'trail', 'train', 'treat', 'trend', 'trial', 'tribe', 'trick',
  'troop', 'truck', 'trunk', 'trust', 'truth', 'tulip', 'tumor', 'tutor', 'twist', 'ultra',
  'uncle', 'union', 'unite', 'unity', 'upper', 'urban', 'usage', 'usual', 'vague', 'valid',
  'value', 'vapor', 'vault', 'venue', 'verse', 'video', 'vigor', 'villa', 'vinyl', 'viola',
  'virus', 'visit', 'vital', 'vivid', 'vocal', 'vodka', 'voice', 'voter', 'wagon', 'waist',
  'watch', 'water', 'weave', 'wedge', 'weird', 'whale', 'wheat', 'wheel', 'where', 'which',
  'while', 'white', 'whole', 'width', 'windy', 'witch', 'woman', 'world', 'worry', 'worth',
  'wound', 'woven', 'wrist', 'write', 'wrong', 'yacht', 'yeast', 'yield', 'young', 'youth',
  'zebra', 'zesty'
].filter((w) => w.length === 5)
