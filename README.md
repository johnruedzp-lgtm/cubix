# CUBIX/LAB — 3D Rubik's Cube Simulator

A responsive browser-based Rubik's cube playground built with HTML, CSS, JavaScript, and Three.js.

## Features
- Interactive 3D cube with orbit drag and zoom
- 2×2, 3×3, 4×4 and 5×5 cube sizes
- Animated face turns and quick-move buttons
- Keyboard controls: `U D L R F B`; hold `Shift` for inverse moves
- Random scramble sequences
- Move history and undo
- Solve by reversing the moves recorded in the current session
- Session timer and local best-time storage
- Optional UI sound effects
- Responsive layout for desktop and mobile
- No build step or package installation required

## Run locally
Because the app uses JavaScript modules, open it through a local web server instead of double-clicking `index.html`.

### Python
```bash
python -m http.server 8000
```
Then visit `http://localhost:8000`.

### VS Code
Install the **Live Server** extension, right-click `index.html`, and choose **Open with Live Server**.

## Publish on GitHub Pages
1. Create a new GitHub repository, for example `cubix-rubiks`.
2. Upload `index.html`, `style.css`, `app.js`, and this README to the repository root.
3. Open **Settings → Pages**.
4. Under Build and deployment, select **Deploy from a branch**.
5. Choose the `main` branch and `/ (root)`, then save.
6. Wait for the deployment link to appear in the Pages section.

Three.js is loaded from jsDelivr, and fonts are loaded from Google Fonts, so the first load requires an internet connection.

## Notes
- This is a playable 3D cube simulator, not a competition-validated speedcubing timer.
- The Solve button reverses recorded moves; it is not a general-purpose Rubik's Cube solver for arbitrary imported cube states.
- Best time is stored in the current browser's local storage.
- No user account or backend is required.

## License
MIT — see `LICENSE`.
