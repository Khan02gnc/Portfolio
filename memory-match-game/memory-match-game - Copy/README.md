# 🃏 Memory Match — 30 Levels

A browser-based memory card matching game with user accounts, 30 levels across 3 difficulties, and a star-rating system.

---

## Files

```
memory-match-game/
├── index.html   ← Main HTML structure (auth, level select, game board, overlays)
├── style.css    ← All styles and animations
├── game.js      ← All game logic, auth, level data, and state management
└── README.md    ← This file
```

---

## How to Play

1. Open `index.html` in any modern web browser — **no server needed**.
2. Register a new account or sign in with an existing one.
3. Pick a difficulty (Easy / Medium / Hard) and select a level.
4. Click cards to flip them and find matching pairs.
5. Match all pairs before running out of moves to complete the level!
6. Earn up to ⭐⭐⭐ stars per level based on how efficiently you play.

---

## Levels

| Difficulty | Levels | Pairs range | Special challenge |
|------------|--------|-------------|-------------------|
| Easy       | 1–10   | 4 → 10 pairs | Great for beginners |
| Medium     | 1–10   | 8 → 18 pairs | More pairs, tighter limits |
| Hard       | 1–10   | 10 → 20 pairs | Large grids, strict move limits |

- Levels unlock sequentially — complete level N to unlock level N+1.
- Your best star rating per level is saved automatically in your browser.

---

## Star Ratings

Each level has two move thresholds:
- **★★★** — finish within the tight (gold) threshold
- **★★**  — finish within the generous threshold
- **★**   — finish before the move limit runs out
- **Fail** — run out of moves before finding all pairs

---

## Account System

- Accounts and progress are stored in your browser's `localStorage`.
- Multiple accounts can be registered on the same browser.
- Passwords are limited to a **maximum of 6 characters**.
- Both the login and register forms include a **show/hide password toggle**.

---

## Browser Compatibility

Works in all modern browsers: Chrome, Firefox, Edge, Safari.  
No internet connection required after the Google Fonts stylesheet loads (fonts will fall back to system sans-serif if offline).
