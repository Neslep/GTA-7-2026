# GTA 7 2026

> Cruise, sprint, and survive inside a glowing open-world city sandbox.

**GTA 7 2026** is a browser-based Three.js joyride inspired by neon-noir arcade worlds — featuring an explorable city grid, drivable cars, pedestrians, traffic, minimap, and a punchy retro HUD. No build tools, no install. Just open the page and enter the city.

**Author:** **Nguyen Gia Anh Tuan** (a.k.a. **Neslep**)

🎮 **Play now:** [neslep.github.io/GTA-7-2026](https://neslep.github.io/GTA-7-2026/)

---

## ✨ Features

- **Open-world neon city** — procedural roads, sidewalks, parks, street lamps, and high-rise blocks.
- **On-foot exploration** — third-person movement with sprinting, jumping, collision, and camera orbit.
- **Drivable vehicles** — walk up to a parked car, press `F`, and switch into driving mode instantly.
- **Rideable motorbikes** — weave through the city on faster, tighter two-wheel vehicles.
- **Traffic carjacking** — get close to a moving traffic car and press `F` to take control.
- **Living traffic** — AI cars loop through city lanes while pedestrians wander around the districts.
- **Vehicle HUD** — speedometer, gear indicator, live mode label, and enter/exit prompts.
- **Minimap system** — tracks roads, buildings, nearby vehicles, traffic, and player direction.
- **Stylized visuals** — golden-hour lighting, shadows, lit-window textures, vignette, and synthwave UI.
- **Responsive canvas** — auto-resizes to the browser window.
- **No build step** — static HTML/CSS/JavaScript with Three.js loaded from CDN.

## 🕹️ Controls

| Action | Key / Input |
| --- | --- |
| Move | `WASD` |
| Sprint / Boost | `Shift` |
| Jump / Handbrake | `Space` |
| Enter / Exit vehicle | `F` |
| Hijack traffic vehicle | `F` near moving traffic |
| Hit / attack | `E` or left click |
| Hold gun | `1` |
| Hold object | `2` |
| Empty hands | `0` |
| Rotate camera | Mouse |
| Move on mobile | Left joystick |
| Sprint / Boost on mobile | `RUN` / `BOOST` |
| Jump / Handbrake on mobile | `JUMP` / `BRAKE` |
| Enter / Exit on mobile | `ENTER` / `EXIT` |
| Hit on mobile | `HIT` |
| Rotate camera on mobile | Drag the screen |
| Release pointer lock | `Esc` |

## 🚀 Running Locally

```bash
git clone https://github.com/Neslep/GTA-7-2026.git
cd GTA-7-2026

# Just open index.html in any modern browser
open index.html      # macOS
# or: xdg-open index.html  (Linux)
# or: start index.html     (Windows)
```

Want a local server? Any static server works:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## 🛠️ Tech Stack

- **Three.js** — 3D rendering, camera, lighting, meshes, and shadows
- **HTML5** — app shell and HUD markup
- **CSS3** — intro screen, HUD, minimap frame, prompts, neon styling
- **Vanilla JavaScript** — world generation, player controls, vehicles, AI traffic, and loop logic
- **Canvas 2D** — minimap rendering
- **Google Fonts** — `Bebas Neue` + `IBM Plex Mono`

## 🎯 Tips for the City

- Stay near roads if you want to find cars quickly.
- Use `Shift` while driving for higher top speed.
- Tap `Space` in a vehicle to slow down fast with the handbrake.
- Watch the minimap to track nearby parked cars and traffic flow.
- Wide turns are smoother than sharp turns at high speed.

## 📜 License

MIT — feel free to fork, remix, and learn from the code.

## 👤 Author

**Nguyen Gia Anh Tuan** — *Neslep*

- GitHub: [@Neslep](https://github.com/Neslep)
- Email: <neslepofficial@gmail.com>

Built with caffeine, neon, and a love for arcade city sandboxes. If you enjoy it, drop a ⭐ on the repo — it genuinely makes my day.

---

Made in Vietnam · © 2026 Neslep
