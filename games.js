/* ============================================================================
   GAME CATALOG — the single source of truth for the site.

   TO ADD A GAME (two steps, no other files to touch):
     1. Put the game at:  games/<slug>/index.html
     2. Add one entry to the GAMES array below.

   Field reference:
     slug     (required) folder name under games/  ->  URL is  /games/<slug>/
     title    (required) name shown on the card
     tagline  (required) one short line describing the game, shown on the hub card
     subtitle (optional) the livelier line the GAME'S OWN start screen shows under its title;
                         falls back to `tagline` when left out. The page never writes this text
                         itself: site.js reads it from here (see "the page's own catalog entry")
     emoji    (required) the big icon on the card — and, via <i class="gemoji">, the glyph the
                         game's own start screen leads with
     accent   (required) card colour: grape | coral | leaf | sun | sky
     ageGroup (required) recommended starting age, shown on the card as "Age: X+", e.g. "6+"
     skills   (optional) tags shown on the card + used by the search filter
     badge    (optional) small ribbon, e.g. "New"  (leave out for none)

   The card, its link, and the search filter are all generated from this list,
   so you never edit the page layout to add a game. The GAME PAGE reads its own entry back
   from here too — every game links this file just before assets/site.js, and site.js fills in
   the title, the card emoji and the subtitle — so a game's words live in exactly one place.
   (These fields are also everything a future toy-store page would need, so the
   same catalog can drive product-style listings later.)
============================================================================ */
window.GAMES = [
  { slug: "matchstick-math",     title: "Matchstick Math",     emoji: "🔥", accent: "sky",    ageGroup: "6+",
    tagline: "Move one matchstick to make the sum true.",      skills: ["Math", "Logic"],
    subtitle: "The sum is wrong. Move just ONE stick to fix it!" },

  { slug: "guess-the-capital",   title: "Guess the Capital",   emoji: "📌", accent: "coral",  ageGroup: "9+",
    tagline: "Pick the right capital city.",                   skills: ["Geography"],
    subtitle: "Pick the right capital city — can you get them all?" },

  { slug: "number-detective",    title: "Number Detective",    emoji: "🕵️", accent: "grape",  ageGroup: "6+",
    tagline: "Crack the secret number from the clues.",        skills: ["Math", "Logic"],
    subtitle: "Read the clues. Which secret number am I?" },

  { slug: "number-builder",      title: "Number Builder",      emoji: "🧱", accent: "leaf",   ageGroup: "6+",
    tagline: "Build numbers with place-value blocks.",         skills: ["Math"],
    subtitle: "Slide the number tiles into place to hit the goal!" },

  { slug: "race-to-100",         title: "Race to 100",         emoji: "🏁", accent: "sun",    ageGroup: "9+",
    tagline: "Use + − × ÷ to land exactly on the target.",     skills: ["Math"],
    subtitle: "Roll, then choose + − × or ÷ to land exactly on the target." },

  { slug: "robot-instructions",  title: "Robot Instructions",  emoji: "🤖", accent: "sky",    ageGroup: "6+",
    tagline: "Program the robot to reach the treasure.",       skills: ["Coding", "Directions"],
    subtitle: "Guide the robot to the treasure 💎" },

  { slug: "shopping-adventure",  title: "Shopping Adventure",  emoji: "🛒", accent: "coral",  ageGroup: "6+",
    tagline: "Fill your cart as close to the budget as you can.", skills: ["Money", "Math"],
    subtitle: "Fill your cart as close to the budget as you can — no going over!" },

  { slug: "coin-counter",        title: "Coin Counter",        emoji: "🪙", accent: "grape",  ageGroup: "6+",
    tagline: "Make the amount with the fewest coins.",         skills: ["Money"],
    subtitle: "Tap coins and notes to make the exact amount!" },

  { slug: "times-table-pop",     title: "Times Table Pop",     emoji: "🎈", accent: "leaf",   ageGroup: "9+",
    tagline: "Pop the balloons that equal the product.",       skills: ["Math"],
    subtitle: "Pop the balloon with the correct answer!" },

  { slug: "pizza-party",         title: "Pizza Party",         emoji: "🍕", accent: "sun",    ageGroup: "6+",
    tagline: "Serve the right fraction of pizza.",             skills: ["Fractions"],
    subtitle: "Read the order and serve the right fraction of pizza!" },

  { slug: "set-the-clock",       title: "Set the Clock",       emoji: "🕐", accent: "sky",    ageGroup: "6+",
    tagline: "Drag the hands to show the time.",               skills: ["Time"],
    subtitle: "Read the time in words, then drag the hands to show it!" },

  { slug: "what-comes-next",     title: "What Comes Next",     emoji: "🧩", accent: "coral",  ageGroup: "3+",
    tagline: "Spot the pattern and finish it.",                skills: ["Patterns"],
    subtitle: "Spot the pattern and pick what comes next!" },

  { slug: "word-guess",          title: "Guess the Word",      emoji: "💭", accent: "leaf",   ageGroup: "6+",
    tagline: "Guess the hidden word, one letter at a time.",   skills: ["Spelling", "Vocabulary"],
    subtitle: "Guess the hidden word, one letter at a time!" },

  { slug: "math-monsters",       title: "Math Monsters",       emoji: "👾", accent: "grape",  ageGroup: "6+",
    tagline: "Feed the monster the right answer!",             skills: ["Math"],
    subtitle: "Feed the hungry monster the right answer!" },

  { slug: "shape-sorter",        title: "Shape Sorter",        emoji: "🪁", accent: "sky",    ageGroup: "3+",
    tagline: "Find and tap the matching shapes.",              skills: ["Spatial reasoning"],
    subtitle: "Find and tap the matching shapes!" },

  { slug: "color-match",         title: "Color Match",         emoji: "🎨", accent: "sun",    ageGroup: "3+",
    tagline: "Tap the colours that match.",                    skills: ["Colours"],
    subtitle: "Tap the colours that match!" },

  { slug: "calendar-quest",      title: "Calendar Quest",      emoji: "📅", accent: "coral",  ageGroup: "9+",
    tagline: "Answer riddles about days, weeks, and months.",  skills: ["Calendar", "Logic"],
    subtitle: "Answer calendar riddles about days, weeks, and months!" },

  { slug: "sentence-doctor",     title: "Sentence Doctor",     emoji: "🩺", accent: "leaf",   ageGroup: "9+",
    tagline: "Heal the sick sentence!",                        skills: ["Grammar", "Punctuation"],
    subtitle: "Help Doc Owl's helper heal the sick sentence!" },

  { slug: "spell-a-bee",         title: "Spell-a-Bee",         emoji: "🐝", accent: "grape",  ageGroup: "6+",
    tagline: "Listen to the word and spell it, letter by letter.", skills: ["Spelling", "Listening"],
    subtitle: "Listen closely and spell the word, letter by letter!" },

  { slug: "shape-math",          title: "Shape Math",          emoji: "🧮", accent: "sky",    ageGroup: "6+",
    tagline: "Add and subtract shapes to find the answer!",    skills: ["Math", "Logic"],
    subtitle: "Add and subtract shapes to find the answer!" },

  { slug: "what-am-i",           title: "What Am I?",          emoji: "🤔", accent: "sun",    ageGroup: "6+",
    tagline: "Solve the riddle — what am I?",                  skills: ["Riddles", "Logic"],
    subtitle: "Listen to the riddle and tap what it's describing!" },

  { slug: "mouse-maze",          title: "Mouse Maze",          emoji: "🐭", accent: "leaf",   ageGroup: "6+",
    tagline: "Guide the mouse through the maze to the cheese!", skills: ["Logic", "Spatial reasoning"],
    subtitle: "Help the mouse find the cheese!" },

  { slug: "sneak-peek",          title: "Sneak Peek",          emoji: "🧠", accent: "coral",  ageGroup: "6+",
    tagline: "Take a sneak peek, then remember what you saw!", skills: ["Memory", "Attention"],
    subtitle: "Take a sneak peek, then remember what you saw!" },

  { slug: "mystery-word",        title: "Mystery Word",        emoji: "🔍", accent: "sky",    ageGroup: "12+",
    tagline: "Crack the secret 5-letter word in 6 tries!",     skills: ["Vocabulary", "Logic"],
    subtitle: "Crack the secret 5-letter word in 6 tries!" },

  { slug: "lights-out",          title: "Lights Out",          emoji: "💡", accent: "grape",  ageGroup: "6+",
    tagline: "Put the whole town to sleep.",                   skills: ["Logic", "Planning"], badge: "New",
    subtitle: "Tap the windows and put the whole town to sleep!" },

  { slug: "spot-the-words",      title: "Spot the Words",      emoji: "🔤", accent: "leaf",   ageGroup: "6+",
    tagline: "Hunt down the hidden words in a themed letter grid.", skills: ["Vocabulary", "Attention"], badge: "New",
    subtitle: "Find every hidden word in the letter grid!" },

  { slug: "juice-jumble",        title: "Juice Jumble",        emoji: "🧃", accent: "coral",  ageGroup: "6+",
    tagline: "Pour the juices until every glass is one flavour.", skills: ["Logic", "Planning"], badge: "New",
    subtitle: "The juice bar got jumbled — pour until every glass is one flavour!" },

  { slug: "dino-dig",            title: "Dino Dig",            emoji: "🥚", accent: "sun",    ageGroup: "9+",
    tagline: "Read the numbers, find the dino eggs, don't wake them.", skills: ["Logic", "Counting"], badge: "New",
    subtitle: "Read the numbers, find the dino eggs — and don't wake them!" },

  { slug: "mirror-draw",         title: "Mirror Draw",         emoji: "🦋", accent: "grape",  ageGroup: "6+",
    tagline: "Finish the picture so both halves match.",       skills: ["Symmetry", "Spatial reasoning"], badge: "New",
    subtitle: "Finish the picture so both halves match!" },

  { slug: "tally-chart",         title: "Tally & Chart",       emoji: "📊", accent: "leaf",   ageGroup: "6+",
    tagline: "Count them, tally them, chart them, then answer the question.", skills: ["Counting", "Data"], badge: "New",
    subtitle: "Count it, tally it, chart it — then answer the question!" },

  { slug: "balance-scales",      title: "Balance Scales",      emoji: "⚖️", accent: "sky",    ageGroup: "6+",
    tagline: "Add weights until both sides sit level — then find the mystery box.", skills: ["Measurement", "Math"], badge: "New",
    subtitle: "Make both sides level — then find the mystery box!" },

  { slug: "tic-tac-toe",         title: "Tic Tac Toe",         emoji: "❌", accent: "coral",  ageGroup: "6+",
    tagline: "Classic, reverse, vanishing and nine-boards-in-one — beat the owl!", skills: ["Strategy", "Logic"], badge: "New",
    subtitle: "Four ways to play noughts and crosses — can you beat the owl?" },

  { slug: "circuit-builder",     title: "Circuit Builder",     emoji: "💡", accent: "sun",    ageGroup: "9+",
    tagline: "Wire it up and make the bulb light.",            skills: ["Science", "Logic"], badge: "New",
    subtitle: "Wire up a circuit and make the bulb light!" },

  { slug: "connect-four",        title: "Connect Four",        emoji: "🎯", accent: "grape",  ageGroup: "6+",
    tagline: "Drop your discs and get four in a row before the owl does!", skills: ["Strategy", "Logic"], badge: "New",
    subtitle: "Drop your discs and get four in a row before the owl does!" },

  { slug: "checkers",            title: "Checkers",            emoji: "👑", accent: "leaf",   ageGroup: "9+",
    tagline: "Jump the owl's pieces, crown your kings, and take the board!", skills: ["Strategy", "Logic"], badge: "New",
    subtitle: "Jump the owl's pieces before it jumps yours!" },

  { slug: "gomoku",              title: "Gomoku",              emoji: "🌟", accent: "sky",    ageGroup: "9+",
    tagline: "Five in a row wins — line them up before the owl does!", skills: ["Strategy", "Logic"], badge: "New",
    subtitle: "Line up five in a row before the owl does!" },

  { slug: "crazy-eights",        title: "Crazy Eights",        emoji: "🃏", accent: "coral",  ageGroup: "6+",
    tagline: "Match the suit or the number — and save your wild eights!", skills: ["Strategy", "Planning"], badge: "New",
    subtitle: "Match the suit or the number — and be first to empty your hand!" },

  { slug: "battleship",          title: "Battleship",          emoji: "🚢", accent: "sun",    ageGroup: "6+",
    tagline: "Hide your fleet, call the squares, and sink the owl's boats!", skills: ["Strategy", "Logic"], badge: "New",
    subtitle: "Hide your fleet and sink the owl's before it sinks yours!" },

  { slug: "paper-punch",         title: "Paper Punch",         emoji: "📄", accent: "grape",  ageGroup: "9+",
    tagline: "Fold it, punch it, and picture where the holes land.", skills: ["Logic", "Spatial reasoning"], badge: "New",
    subtitle: "Fold the paper, punch a hole, and guess where the holes pop up when you open it!" },
];
