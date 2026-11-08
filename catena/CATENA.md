# La catena di StickSolid

Dal progetto di un video al file finito e controllato, con un comando solo:

```bash
python catena/produci.py ../studio/productions/<id>          # tutto
python catena/produci.py ../studio/productions/<id> --da suoni   # da un passo in poi
python catena/produci.py ../studio/productions/<id> --solo didascalie
```

Si lancia con il Python del kit, dove ci sono Kokoro, Parakeet e numpy. La prima volta la provata è stata What If #1, il 7 novembre 2026: **7 minuti sul PC**, di cui 6 per il render 3D.

## I passi

| Passo | Cosa fa | Con cosa | Controllo |
|---|---|---|---|
| `voce` | la voce del copione (`project/script.json`), con il testo corretto (numeri, anni, sigle), **la regia** (sotto) e il suono "da creator" o "cupo" | `voce/voce.py`, `voce/regia.py`, Kokoro, Praat | |
| `parole` | i tempi di ogni parola | `skills/kit/words.py`, Parakeet | |
| `didascalie` | didascalie di 1-3 parole (Solid) o 1-2 (Stick). Le paroline (the, of, in, and…) non contano e vanno con la parola dopo, quindi una didascalia non finisce mai su una di loro; due parole con la maiuscola di fila sono un nome e restano insieme ("New England"); i numeri in giallo | | |
| `tempi` | `catena.json`: didascalie, durata e la **curva dei tempi**, che fa andare le scene, disegnate su una voce vecchia, al passo della voce nuova | | |
| `render` | i fotogrammi, 30 al secondo: Solid a 720×1280, Stick a 1080×1920 | `engines/solid/render.mjs` (Chromium, WebGL) o `engines/stick/render.mjs` (Chromium, disegno 2D), secondo `who` in `meta.json` | |
| `mix` | immagine a 1080×1920 più la voce | ffmpeg | |
| `suoni` | gli effetti: quelli scritti in `project/suoni.json`, ognuno legato a una parola, più un fruscio leggero su ogni taglio. Li sceglie e mescola la skill **Real SFX** dalle librerie `lanternfox` (CC0) ed `earshot` (fatta con il codice) | Real SFX | **la critica di Real SFX**: ogni voce deve arrivare a 8. Fino a 4 giri di autocorrezione automatica |
| `finale` | aggiunge la chiusura con il pugno e il suono firma (`studio/identita/chiusura/`) | ffmpeg | |
| `copertina` | la copertina, dalla scheda del video (`meta.json` → `copertina`) | `kit/cover.html` | |
| `provini` | 12 fotogrammi da guardare prima di Approva | ffmpeg | gli occhi di una persona |
| `controllo` | la voce riascoltata (parole sbagliate, velocità, pause, melodia), il volume, il formato e **i flash** del file finito | `voce/controllo.py`, Praat | scrive **passa** o **NON PASSA** con il motivo: 0% parole sbagliate, melodia almeno 4,2, nessun flash, -16,5…-13 LUFS, picco sotto -1 dB; per True story e What if almeno 2 fonti in `copione.md` (QC-09). Scrive anche **il ritmo**: tagli ogni 10 s, primo taglio, inquadratura mediana, movimento nei primi 3 s, con i consigli (QC-11). Il ritmo non blocca mai il video |

Gli errori trovati nei video e i controlli che li bloccano sono in `sticksolid-studio/office/CONTROLLO-QUALITA.md`.

## La regia della voce

Kokoro legge ogni frase allo stesso modo. La regia (`voce/regia.py`) decide come dire ogni frase, poi modifica l'audio con Praat: allarga la melodia, accenta le parole chiave (più alte, un po' più lunghe e più forti), accelera o rallenta pezzi di frase e mette brevi silenzi a effetto.
- **I toni**: `gancio`, `normale`, `svolta` (il "But": pausa prima, più basso), `fatto` (il numero lento e accentato), `elenco` (veloce), `climax`, `calmo`, `domanda`, `cta`, `cupo`.
- **Chi la scrive**: la routine del copione, in `project/regia.json` (una riga per frase: `tono`, `enfasi`, `veloci`, `lenti`, `beat`, `velocita`…). Se il file manca, decide la regia automatica, che segue regole sul testo. Quello che è stato usato davvero finisce in `out/regia.json`.
- **I limiti**: velocità massima 1,2, perché oltre Kokoro mangia le sillabe. `"regia": false` in `meta.voce` torna alla lettura piatta.
- **Il risultato su What If #1**: la melodia passa da 3,75 a 4,6 semitoni, sempre con 0% di parole sbagliate.

## I flash neri (risolti)

Nel render 3D a volte un punto dell'immagine esce "rotto" (NaN), e il bloom lo allarga a un rettangolo nero per un fotogramma. `adatta_solid.py` mette in ogni progetto un passaggio "pulisci" prima del bloom. Il controllo finale cerca comunque i flash, e se ne trova uno il video non passa.

## Le regole dei suoni (imparate sul primo video)

- **Ogni suono è legato a una parola, non a un secondo** (`"parola": "stopped", "n": 2`): se la voce cambia, i suoni la seguono.
- **Niente tonfi profondi** (`drop`, `thump`) se non li chiede apposta il video (`"bassi": true`): la voce Puck + Onyx ha già molti bassi, e la critica li segnava come "fango".
- **I colpi perdono i bassi sotto i 180 Hz**; gli effetti stanno 6 dB sopra il livello di partenza di Real SFX.
- **L'acqua**: nelle due librerie oggi non c'è un suono d'acqua adatto (`water` resta muto). Da aggiungere alla libreria `earshot` (famiglia `drip`) o da Wikimedia Commons (CC0).

## Portare un video vecchio nella catena

**Stick:** `python catena/adatta_stick.py <project> --stick FARMER`. La cartella `web/` della skill diventa `src/`; le scene usano `lib.js` e `chars.js` del kit (gli stessi disegni, più gambe spesse, capelli, occhiali, cappelli); `kit/lib/catena-stick.js` legge `catena.json` (tempi sulla voce nuova, durata, didascalie nel nostro stile) e dà a tutti gambe e braccia spesse; il personaggio indicato con `--stick` diventa Stick (rosso, niente cappello). I file della skill che non servono più vanno in `originale/`. È così che è stato rifatto Strange Days #1 (`storia-1`).

**Solid:** `python catena/adatta_solid.py <project> --cieli '{"0x4f7fae": "cupo"}'`: Solid al posto dell'omino della skill, le 12 espressioni, il cielo e le luci del tema "giorno", le didascalie nel nostro stile, `catena.json`. Le scene che si fanno il loro cielo prendono un tema (`--cieli`). È così che è stato rifatto What If #1.

## Su GitHub (`.github/workflows/render.yml`)

La stessa catena, divisa su più macchine.
- **`voce`**: `produci.py --fino tempi`.
- **`frames`**: 6 macchine. Ognuna fa un pezzo dei fotogrammi con `FRAME_FROM` e `FRAME_TO`, che funzionano nei due motori.
- **`finale`**: unisce i pezzi in `muto.mp4`, poi `produci.py --da mix`.

`catena/ci_suoni.py` prepara Real SFX sulla macchina di GitHub. L'elenco dei suoni sta in `sticksolid-studio/skills-esterne/real-sfx/library_index.portable.json`, che si rifà sul PC con `--portabile` quando si aggiungono suoni. Servono i token descritti in `sticksolid-studio/routines/README.md`.

## I video nuovi, scritti dalle routine

- **I tempi**: `catena/tempi_stimati.py <project>` stima i tempi delle parole dal copione e li scrive in `audio/rif.words.json`. La routine disegna le scene su questi tempi, e il passo `tempi` le adatta alla voce vera.
- **Stick**: si parte dal modello della skill stick-figure, poi `adatta_stick.py`.
- **Solid**: si parte da `engines/solid/modello/`, cioè il progetto di What If #1 già adattato.

Le istruzioni sono in `sticksolid-studio/routines/COPIONE-E-SCENE.md`.

**L'Ufficio** (StickSolid Studio) sa tutto da `catena/ufficio.py`, che `render.yml` chiama a ogni passo: l'inizio, la voce, ognuna delle 6 macchine, i suoni, il video in Approva e dove si è fermato. Il video finito va anche in una **release in bozza**, privata, da cui l'Ufficio lo prende con la sua chiave; diventa pubblico solo dopo Approva. Servono i segreti `OFFICE_URL` e `STUDIO_SECRET`; senza, l'Ufficio resta zitto e il render va avanti uguale.

**Provato il 7 novembre su True Story #1**: circa 7 minuti per video (voce 2, fotogrammi 1-1,5 su 6 macchine, finale 3-4), con gli stessi numeri del PC. Funziona sia avviato a mano sia avviato da `avvia-render` del repository privato.

## La fase 3 è finita (7 novembre 2026)

Le routine Ricerca e Copione e Scene sono accese (`sticksolid-studio/routines/README.md`). Il passo dopo è la fase 4, il virality predictor.

## Fase 4: il ritmo, in attesa del predittore

Il voto del gancio di youtube-agent-skill non ha messo i nostri 20 video vecchi nell'ordine giusto; il ritmo delle immagini sì (`sticksolid-studio/research/predictor/RISULTATO.md`). Per questo il passo `controllo` misura il ritmo di ogni video. La routine Analisi raccoglie ogni settimana le misure insieme ai numeri veri, e con 25 video StickSolid propone il predittore e la soglia.
