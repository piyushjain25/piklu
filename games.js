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
     skills   (optional) tags shown on the card + used by the search filter
     badge    (optional) small ribbon, e.g. "New"  (leave out for none)

   The card, its link, and the search filter are all generated from this list,
   so you never edit the page layout to add a game.
   (These fields are also everything a future toy-store page would need, so the
   same catalog can drive product-style listings later.)
============================================================================ */
window.GAMES = [
  { slug: "matchstick-math",    title: "Matchstick Math",     emoji: "🔥", accent: "coral",
    tagline: "Move one matchstick to make the sum true.",     skills: ["Arithmetic", "Logic"] },

  { slug: "guess-capital",   title: "Guess the Capital",      emoji: "📌", accent: "sun",
    tagline: "Pick the right capital city.",                  skills: ["Memory"],                       badge:"New"},

  { slug: "number-detective",   title: "Number Detective",    emoji: "🕵️", accent: "grape",
    tagline: "Crack the secret number from the clues.",       skills: ["Number sense", "Logic"] },

  { slug: "number-builder",     title: "Number Builder",      emoji: "🧱", accent: "sky",
    tagline: "Build numbers with place-value blocks.",        skills: ["Place value"] },

  { slug: "race-to-100",        title: "Race to 100",         emoji: "🏁", accent: "leaf",
    tagline: "Use + − × ÷ to land exactly on 100.",           skills: ["Mental math"] },

  { slug: "robot-instructions", title: "Robot Instructions",  emoji: "🤖", accent: "sky",
    tagline: "Program the robot to reach the treasure.",      skills: ["Coding", "Directions"] },

  { slug: "shopping-adventure", title: "Shopping Adventure",  emoji: "🛒", accent: "leaf",
    tagline: "Fill your cart as close to the budget as you can.", skills: ["Money", "Addition"] },

  { slug: "coin-counter",       title: "Coin Counter",        emoji: "🪙", accent: "sun",
    tagline: "Make the amount with the fewest coins.",        skills: ["Money"] },

  { slug: "times-table-pop",    title: "Times Table Pop",     emoji: "🎈", accent: "coral",
    tagline: "Pop the balloons that equal the product.",      skills: ["Multiplication"] },

  { slug: "pizza-party",        title: "Pizza Party",         emoji: "🍕", accent: "coral",
    tagline: "Serve the right fraction of pizza.",            skills: ["Fractions"] },

  { slug: "set-the-clock",      title: "Set the Clock",       emoji: "🕐", accent: "grape",
    tagline: "Drag the hands to show the time.",              skills: ["Telling time"] },

  { slug: "what-comes-next",    title: "What Comes Next",     emoji: "🧩", accent: "sun",
    tagline: "Spot the pattern and finish it.",               skills: ["Patterns"] },
];
