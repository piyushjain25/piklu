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
  { slug: "matchstick-math",    title: "Matchstick Math",     emoji: "🔥", accent: "coral",  ageGroup: "6+",
    tagline: "Move one matchstick to make the sum true.",     skills: ["Arithmetic", "Logic"] },

  { slug: "guess-the-capital",   title: "Guess the Capital",  emoji: "📌", accent: "sun",    ageGroup: "7+",
    tagline: "Pick the right capital city.",                  skills: ["Geography"] },

  { slug: "number-detective",   title: "Number Detective",    emoji: "🕵️", accent: "grape",  ageGroup: "6+",
    tagline: "Crack the secret number from the clues.",       skills: ["Number sense", "Logic"] },

  { slug: "number-builder",     title: "Number Builder",      emoji: "🧱", accent: "sky",    ageGroup: "5+",
    tagline: "Build numbers with place-value blocks.",        skills: ["Place value"] },

  { slug: "race-to-100",        title: "Race to 100",         emoji: "🏁", accent: "leaf",   ageGroup: "7+",
    tagline: "Use + − × ÷ to land exactly on the target.",    skills: ["Mental math"] },

  { slug: "robot-instructions", title: "Robot Instructions",  emoji: "🤖", accent: "sky",    ageGroup: "5+",
    tagline: "Program the robot to reach the treasure.",      skills: ["Coding", "Directions"] },

  { slug: "shopping-adventure", title: "Shopping Adventure",  emoji: "🛒", accent: "leaf",   ageGroup: "6+",
    tagline: "Fill your cart as close to the budget as you can.", skills: ["Money", "Arithmetic"] },

  { slug: "coin-counter",       title: "Coin Counter",        emoji: "🪙", accent: "sun",    ageGroup: "6+",
    tagline: "Make the amount with the fewest coins.",        skills: ["Money"] },

  { slug: "times-table-pop",    title: "Times Table Pop",     emoji: "🎈", accent: "sky",    ageGroup: "7+",
    tagline: "Pop the balloons that equal the product.",      skills: ["Arithmetic"] },

  { slug: "pizza-party",        title: "Pizza Party",         emoji: "🍕", accent: "coral",  ageGroup: "6+",
    tagline: "Serve the right fraction of pizza.",            skills: ["Fractions"] },

  { slug: "set-the-clock",      title: "Set the Clock",       emoji: "🕐", accent: "grape",  ageGroup: "5+",
    tagline: "Drag the hands to show the time.",              skills: ["Telling time"] },

  { slug: "what-comes-next",    title: "What Comes Next",     emoji: "🧩", accent: "sun",    ageGroup: "4+",
    tagline: "Spot the pattern and finish it.",               skills: ["Patterns"] },

  { slug: "word-guess",   title: "Guess the Word",            emoji: "💭", accent: "sky",    ageGroup: "6+",
    tagline: "Guess the hidden word, one letter at a time.",  skills: ["Spelling", "Vocabulary"] },

  { slug: "math-monsters", title: "Math Monsters",            emoji: "👾", accent: "leaf",   ageGroup: "5+",
    tagline: "Feed the monster the right answer!",            skills: ["Arithmetic"],                             badge:"New"},

  { slug: "shape-sorter",  title: "Shape Sorter",             emoji: "🔷", accent: "sky",    ageGroup: "4+",
    tagline: "Find and tap the matching shapes.",             skills: ["Shapes"],                                 badge:"New"},

  { slug: "color-match",   title: "Color Match",              emoji: "🎨", accent: "coral",  ageGroup: "4+",
    tagline: "Tap the colours that match.",                   skills: ["Colours"],                                badge:"New"},
];
