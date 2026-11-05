# PlayGround

<!-- omgithub:readme:start -->
## 🚀 Build, play, and remix with OMGithub

**Created using [OMGithub.com](https://omgithub.com).**

[![OMGithub](https://img.shields.io/badge/OMGithub-Open%20project-orange?style=for-the-badge)](https://omgithub.com/AeronCow/PlayGround)
[![GitHub](https://img.shields.io/badge/GitHub-Source-181717?logo=github&style=for-the-badge)](https://github.com/AeronCow/PlayGround)

- 🎮 [Open the project](https://omgithub.com/AeronCow/PlayGround).
- ✨ [Remix this project](https://omgithub.com/?remix=AeronCow%2FPlayGround).
- 💻 [Explore the source](https://github.com/AeronCow/PlayGround).
- 🛠️ [Check build runs](https://github.com/AeronCow/PlayGround/actions).
- 🐛 [Report an issue](https://github.com/AeronCow/PlayGround/issues).
- 👤 [Explore the creator's projects](https://omgithub.com/AeronCow).
- 🌍 [Create with OMGithub](https://omgithub.com).
<!-- omgithub:readme:end -->

## 🌌 STARFALL: NEON SIEGE

A self-contained neon arcade shooter that runs in any modern browser. No build step, no dependencies — just open `index.html` or serve the folder.

Survive **10 waves** of incoming drones, dodge dense bullet patterns, and take down a boss at **wave 5** and a two-phase final boss at **wave 10**. Your ship auto-fires at the nearest target, so you can focus on movement and timing.

### Controls

| Action | Desktop | Mobile |
| --- | --- | --- |
| Move | `WASD` / arrow keys | Drag anywhere |
| Pulse bomb | `Space` | `PULSE` button |
| Pause | `P` / `Esc` | Pause button |
| Mute | Sound button | Sound button |

Pulse bombs clear enemy bullets and damage everything on screen. Collect glowing pickups to restore shield and pulse charges, chain kills quickly to build a score multiplier, and chase your best score (saved locally).

### Run locally

Simply open `index.html` in a browser, or serve the folder with any static server:

```bash
python3 -m http.server 3002   # http://localhost:3002
```

Add `?debug=1` to expose test helpers on `window.__starfall`.
