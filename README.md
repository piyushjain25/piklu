# Playful Minds — games site

A static site (plain HTML/CSS/JS — no build step, no dependencies) hosting the kids' learning games. Host it anywhere that serves static files (Netlify, Vercel, GitHub Pages, Cloudflare Pages, S3, or any web server), or just open `index.html` in a browser.

## Folder layout

```
site/
├── index.html                 root — redirects to /games/ (replace with the STORE later)
├── games.js                   THE CATALOG — the only file you edit to add a game
├── assets/
│   └── site.css               shared styles for the hub
└── games/
    ├── index.html             the games hub (auto-generates the grid from games.js)
    ├── matchstick-math/index.html
    ├── pizza-party/index.html
    └── … one folder per game …
```

## URLs (these never change)

| Page              | URL                        |
|-------------------|----------------------------|
| Home              | `/`                        |
| All games (hub)   | `/games/`                  |
| A game            | `/games/<slug>/`           |

Example: Pizza Party is always at `/games/pizza-party/`.

## Add a new game (2 steps)

1. **Drop the game in a folder** named after its slug:
   `games/your-new-game/index.html`
2. **Add one entry** to the `GAMES` array in `games.js`:

   ```js
   { slug: "your-new-game", title: "Your New Game", emoji: "🎯", accent: "sky",
     tagline: "One short line about it.", skills: ["Addition"], badge: "New" },
   ```

That's it — the hub card, its link (`/games/your-new-game/`), and the search filter all appear automatically. You never edit the hub's HTML or CSS to add a game.

- `accent` is one of: `grape`, `coral`, `leaf`, `sun`, `sky`.
- `badge` is optional (e.g. `"New"`); leave it out for none.
- `skills` are optional tags shown on the card and searchable.

## Turning this into a toy store later

The site is arranged so the store slots in around the games without disturbing them:

- **Replace `index.html`** (the root) with your store home page.
- **Add store sections** under new paths like `/shop/`, `/products/`, `/cart/`.
- **Leave `/games/` and every `/games/<slug>/` exactly where they are.** All game links and bookmarks keep working, and the free games can link into the store (and vice-versa).
- `games.js` already holds structured data (title, tagline, tags, accent) — the same catalog pattern can drive product listings, so you can reuse the approach for `products.js`.

## Notes

- Each game is fully self-contained (its own HTML/CSS/JS in one file); the only external calls are Google Fonts and a CDN for a couple of games. Nothing else is required to run them.
- Players return from a game to the hub with the browser's Back button. If you'd like an on-screen "← All games" link inside each game, that can be added later.
