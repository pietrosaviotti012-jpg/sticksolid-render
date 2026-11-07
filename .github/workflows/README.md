# I workflow di render

- **`render.yml`** (scritto il 7 novembre): riceve l'id di un video, legge la sua cartella dal repository privato `sticksolid-studio` con il token di sola lettura `STUDIO_READ_TOKEN`, e lo fa in tre parti:
  1. `voce`, su 1 macchina: voce, parole, didascalie, tempi;
  2. `frames`, su 6 macchine insieme: ognuna disegna un pezzo dei fotogrammi;
  3. `finale`, su 1 macchina: unisce i pezzi, poi mix, suoni Real SFX, chiusura, copertina, provini e controllo.
- **Il risultato** resta un artifact per 14 giorni. Va in una Release solo quando l'utente lo approva, perché questo repository è pubblico.
- **Parte** a mano (Actions → render → Run workflow, `video` = per esempio `storia-1`) oppure con un `repository_dispatch` di tipo `render`, che manda `avvia-render.yml` del repository privato quando una routine scrive `READY`.
- **Il render pesante sta qui, non nella routine di Claude** (lezione 2): la routine scrive soltanto copione e scene.
- **Si salva a metà** (lezione 1): la voce e ogni pezzo di fotogrammi diventano artifact appena sono pronti.
- **Attenzione**: i log di un repository pubblico si vedono. La catena stampa le frasi del copione, quindi chi apre il log di un render vede il copione prima che il video esca.
