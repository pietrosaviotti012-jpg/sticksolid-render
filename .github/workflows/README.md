# I workflow di render

Si scrivono nella **fase 3** (la nuova catena). L'idea, dalle lezioni della guida:

- **`render.yml`**: riceve un progetto video (copione, voce, `shots.js`) dal repository privato `sticksolid-studio`, lo legge con un token di sola lettura salvato nei segreti, fa il render diviso su più macchine, mescola voce e suoni, fa il foglio dei provini e il controllo qualità, e mette il video finito in una Release.
- **Il render pesante sta qui, non nella routine di Claude** (lezione 2): la routine scrive soltanto copione e scene, e non consuma le 5 ore dell'abbonamento.
- **Si salva a metà** (lezione 1): la voce e le parti di render diventano artifact appena sono pronte.
- **Gli eventi verso l'Ufficio** partono da qui, con i segreti di GitHub (lezione 5).
