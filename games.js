/* ============================================================================
   GAME CATALOG — the single source of truth for the site.

   TO ADD A GAME (two steps, no other files to touch):
     1. Put the game at:  games/<slug>/index.html
     2. Add one entry to the GAMES array below.

   Field reference:
     slug     (required) folder name under games/  ->  URL is  /games/<slug>/
     title    (required) name shown on the card
     tagline  (required) one short line describing the game
     emoji    (required) the big icon on the card
     accent   (required) card colour: grape | coral | leaf | sun | sky
     ageGroup (required) recommended starting age, shown on the card as "Age: X+", e.g. "6+"
     skills   (optional) tags shown on the card + used by the search filter
     badge    (optional) small ribbon, e.g. "New"  (leave out for none)

   The card, its link, and the search filter are all generated from this list,
   so you never edit the page layout to add a game.
   (These fields are also everything a future toy-store page would need, so the
   same catalog can drive product-style listings later.)
============================================================================ */
window.GAMES = [
  { slug: "matchstick-math",     title: "Matchstick Math",     emoji: "🔥", accent: "sky",    ageGroup: "6+",
    tagline: "Move one matchstick to make the sum true.",      skills: ["Math", "Logic"] },

  { slug: "guess-the-capital",   title: "Guess the Capital",   emoji: "📌", accent: "coral",  ageGroup: "9+",
    tagline: "Pick the right capital city.",                   skills: ["Geography"] },

  { slug: "number-detective",    title: "Number Detective",    emoji: "🕵️", accent: "grape",  ageGroup: "6+",
    tagline: "Crack the secret number from the clues.",        skills: ["Math", "Logic"] },

  { slug: "number-builder",      title: "Number Builder",      emoji: "🧱", accent: "leaf",   ageGroup: "6+",
    tagline: "Build numbers with place-value blocks.",         skills: ["Math"] },

  { slug: "race-to-100",         title: "Race to 100",         emoji: "🏁", accent: "sun",    ageGroup: "9+",
    tagline: "Use + − × ÷ to land exactly on the target.",     skills: ["Math"] },

  { slug: "robot-instructions",  title: "Robot Instructions",  emoji: "🤖", accent: "sky",    ageGroup: "6+",
    tagline: "Program the robot to reach the treasure.",       skills: ["Coding", "Directions"] },

  { slug: "shopping-adventure",  title: "Shopping Adventure",  emoji: "🛒", accent: "coral",  ageGroup: "6+",
    tagline: "Fill your cart as close to the budget as you can.", skills: ["Money", "Math"] },

  { slug: "coin-counter",        title: "Coin Counter",        emoji: "🪙", accent: "grape",  ageGroup: "6+",
    tagline: "Make the amount with the fewest coins.",         skills: ["Money"] },

  { slug: "times-table-pop",     title: "Times Table Pop",     emoji: "🎈", accent: "leaf",   ageGroup: "9+",
    tagline: "Pop the balloons that equal the product.",       skills: ["Math"] },

  { slug: "pizza-party",         title: "Pizza Party",         emoji: "🍕", accent: "sun",    ageGroup: "6+",
    tagline: "Serve the right fraction of pizza.",             skills: ["Fractions"] },

  { slug: "set-the-clock",       title: "Set the Clock",       emoji: "🕐", accent: "sky",    ageGroup: "6+",
    tagline: "Drag the hands to show the time.",               skills: ["Time"] },

  { slug: "what-comes-next",     title: "What Comes Next",     emoji: "🧩", accent: "coral",  ageGroup: "3+",
    tagline: "Spot the pattern and finish it.",                skills: ["Patterns"] },

  { slug: "word-guess",          title: "Guess the Word",      emoji: "💭", accent: "leaf",   ageGroup: "6+",
    tagline: "Guess the hidden word, one letter at a time.",   skills: ["Spelling", "Vocabulary"] },

  { slug: "math-monsters",       title: "Math Monsters",       emoji: "👾", accent: "grape",  ageGroup: "6+",
    tagline: "Feed the monster the right answer!",             skills: ["Math"] },

  { slug: "shape-sorter",        title: "Shape Sorter",        emoji: "🔷", accent: "sky",    ageGroup: "3+",
    tagline: "Find and tap the matching shapes.",              skills: ["Spatial reasoning"] },

  { slug: "color-match",         title: "Color Match",         emoji: "🎨", accent: "sun",    ageGroup: "3+",
    tagline: "Tap the colours that match.",                    skills: ["Colours"] },

  { slug: "calendar-quest",      title: "Calendar Quest",      emoji: "📅", accent: "coral",  ageGroup: "9+",
    tagline: "Answer riddles about days, weeks, and months.",  skills: ["Calendar", "Logic"] },

  { slug: "sentence-doctor",     title: "Sentence Doctor",     emoji: "🩺", accent: "leaf",   ageGroup: "9+",
    tagline: "Heal the sick sentence!",                        skills: ["Grammar", "Punctuation"] },

  { slug: "spell-a-bee",         title: "Spell-a-Bee",         emoji: "🐝", accent: "grape",  ageGroup: "6+",
    tagline: "Listen to the word and spell it, letter by letter.", skills: ["Spelling", "Listening"] },

  { slug: "shape-math",          title: "Shape Math",          emoji: "🔷", accent: "sky",    ageGroup: "6+",
    tagline: "Add and subtract shapes to find the answer!",    skills: ["Math", "Logic"] },

  { slug: "what-am-i",           title: "What Am I?",          emoji: "🤔", accent: "sun",    ageGroup: "6+",
    tagline: "Solve the riddle — what am I?",                  skills: ["Riddles", "Logic"] },

  { slug: "mouse-maze",          title: "Mouse Maze",          emoji: "🐭", accent: "coral",  ageGroup: "6+",
    tagline: "Guide the mouse through the maze to the cheese!", skills: ["Logic", "Spatial reasoning"] },

  { slug: "sneak-peek",          title: "Sneak Peek",          emoji: "🧠", accent: "leaf",   ageGroup: "6+",
    tagline: "Take a sneak peek, then remember what you saw!", skills: ["Memory", "Attention"] },

  { slug: "mystery-word",        title: "Mystery Word",        emoji: "🔍", accent: "sky",    ageGroup: "12+",
    tagline: "Crack the secret 5-letter word in 6 tries!",     skills: ["Vocabulary", "Logic"] },

  { slug: "tick-tock-toe",       title: "Tick Tock Toe",       emoji: "⏳", accent: "grape",  ageGroup: "9+",
    tagline: "Three in a row — but your oldest mark fades away!", skills: ["Strategy", "Memory"], badge: "New" },

  { slug: "tic-tac-trek",        title: "Tic Tac Trek",        emoji: "🧭", accent: "sun",    ageGroup: "15+",
    tagline: "Nine boards in one — your move sends the owl!",  skills: ["Strategy", "Planning"], badge: "New" },

  { slug: "lights-out",          title: "Lights Out",          emoji: "💡", accent: "coral",  ageGroup: "6+",
    tagline: "Put the whole town to sleep.",                   skills: ["Logic", "Planning"], badge: "New" },

  { slug: "spot-the-words",      title: "Spot the Words",      emoji: "🔤", accent: "leaf",   ageGroup: "6+",
    tagline: "Hunt down the hidden words in a themed letter grid.", skills: ["Vocabulary", "Attention"], badge: "New" },
];
