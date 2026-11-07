# sticksolid-render

*The render side of the StickSolid shorts channel: characters, moves, colour themes, voice and sound tools, and the GitHub Actions that turn a video project into an MP4. Free and open (MIT), no keys inside.*

Il repository **pubblico** di StickSolid: qui gira il render dei video, perché su GitHub i minuti delle Actions sono gratis per i repository pubblici. Le idee, i copioni, le note e l'Ufficio stanno nel repository **privato** `sticksolid-studio`.

## Cosa c'è

| Cartella | Cosa |
|---|---|
| `kit/` | La grafica di StickSolid. **Stick**: `lib/chars.js`, il disegno 2D della skill stick-figure, con le gambe spesse, i capelli, gli occhiali, i cappelli e la testa scalabile. **Solid**: `lib/human.js` e `man.js`, l'omino 3D della skill zach-d-films, con la faccia gentile `setFace`, 12 espressioni, il corpo uniforme e la maglietta lunga. **Movimenti**: `lib/moves-stick.js` e `lib/moves-solid.js`. **Temi di colore**: `temi.json` e `lib/temi-stick.js`. Poi le pagine per foto profilo, copertine, schede, chiusura e didascalie, e `render.mjs` (immagini) e `video.mjs` (video fotogramma per fotogramma) |
| `voce/` | `normalizza.py` porta numeri, anni, orari e sigle a parole leggibili; `voce.py` fa la voce con Kokoro, con radio, telefono, sussurro e il suono "da creator" o "cupo"; `controllo.py` riascolta con Parakeet e misura gli errori; `catalogo.py` fa il catalogo delle voci |
| `skills/` | Le skill **stick-figure** e **zach-d-films** di Artem Novitckii (licenza MIT, in `skills/LICENSE-claude-animation-skills`) e il loro `kit` (Python, Node, font) |
| `sounds/` | La libreria di effetti sonori, tutti CC0 o di pubblico dominio (`sounds/LICENZE.md`) |
| `tools/` | Gli strumenti del canale vecchio, da adattare nella fase 3: controllo qualità, mix, ascolto, foglio dei provini (`tools/README.md`) |
| `.github/workflows/` | I workflow di render, scritti nella fase 3 |

## Come si usa sul PC

```bash
cd skills/kit && bash setup.sh && bash setup.sh --voice     # pacchetti Node, Python, modelli Kokoro e Parakeet (~1 GB, una volta)
cd ../../kit && node render.mjs lavori/scheda.json          # un'immagine
node video.mjs lavori/chiusura-video.json                   # un video
cd ../voce && python voce.py copione.json voce.mp3 "am_puck+am_onyx:0.7" 1.15
python controllo.py voce.mp3
```

Il kit si trova da solo: prima `$STICKSOLID_KIT`, poi `skills/kit` in questo repository, poi `~/tools/claude-animation-skills/kit`. Su Windows si usa il Chromium di Playwright (`chromium-1234`) se c'è.

## Regole

- **Niente chiavi, password o token** in questo repository: è pubblico. I segreti stanno nei segreti di GitHub e nel Worker dell'Ufficio.
- **Niente skill senza licenza**: stanno solo nel repository privato.
- **I video non si caricano nel repository** (`*.mp4` è escluso): i video finiti vanno nelle Releases. GitHub rifiuta i file sopra i 100 MB.
- Licenze: il codice di StickSolid è MIT (`LICENSE`); quelle di terzi sono in `NOTICE.md`.
