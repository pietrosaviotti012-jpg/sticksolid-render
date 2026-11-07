# Gli strumenti del canale vecchio

Copiati da `lanternfox-studio/tools` il 7 novembre 2026. Erano fatti per il motore a carta intagliata di Lantern Fox, e **vanno adattati nella fase 3**, quando si costruisce la nuova catena: Ricerca, Copione, Voce, Scene, Render, Suono, Controllo, Predictor, Approva.

| File | Cosa faceva | Cosa serve per StickSolid |
|---|---|---|
| `quality.py` | il controllo qualità automatico: volume, gancio, didascalie, ritmo | aggiungere i controlli "Fatti" (ogni frase ha una fonte) ed "Espressione" (la faccia segue la frase), e leggere i progetti delle due skill |
| `ground_check.mjs` | le figure con i piedi a terra | adattare a Stick (2D) e a Solid (3D) |
| `mix.py`, `packs.py` | il mix della musica e degli effetti, i pacchetti di suoni per tipo di video | collegarli ai temi di colore (`kit/temi.json` ha musica e suoni per umore) |
| `score.py`, `look.py`, `analyze.py` | il confronto con i video virali e le misure dai provini | alla base del virality predictor (fase 4) |
| `earshot_check.py`, `sounds_listen.py` | l'ascolto dei suoni con Earshot | servono così come sono |
| `sounds_fetch.py`, `sounds_list.json` | lo scaricamento dei suoni da Wikimedia Commons, con 10 secondi tra un file e l'altro | servono così come sono; Openverse resta escluso (lezione 12) |
| `voice.py`, `align.py`, `subs.py` | la voce Chatterbox e i tempi delle parole di Lantern Fox | sostituiti da `voce/` (Kokoro + Parakeet) e da `skills/kit/words.py` |
| `office.mjs` | gli eventi verso l'Ufficio | da riscrivere per il nuovo Ufficio (fase 5): niente chiavi nei prompt, gli eventi passano da un workflow con i segreti (lezione 5) |
| `build.sh`, `check.sh`, `stills.sh`, `segment.mjs`, `themes_check.mjs` | build, controlli e foglio dei provini di Lantern Fox | da rifare per le due skill |
