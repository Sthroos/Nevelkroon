# Nevelkroon

Een galactische strategie in beurten voor de browser: verkennen, uitbreiden, uitbuiten en uitroeien in de Ardennevel. Eén HTML-bestand, geen afhankelijkheden, speelbaar op telefoon en computer.

> Duizend jaar geleden viel de Kroon stil: het netwerk van relais dat de nevel bijeenhield. Nu zoemen de relais weer. Vijf beschavingen reiken tegelijk naar de sterren. Wie de Kroon wekt, heerst over de nevel. Maar iets in de leegte heeft haar ooit doen vallen…

## Spelen

Open `index.html` in een browser, of zet GitHub Pages aan (Settings → Pages → *Deploy from a branch* → `main` / root).

**Besturing:** sleep om te bewegen, knijp of scroll om te zoomen, tik op een stelsel voor informatie. Tik op een eigen schip en daarna op een stelsel om het te sturen. Op de computer: rechtsklik verplaatst, Enter/spatie = volgende beurt, R = onderzoek, D = diplomatie, E = rijk, L = logboek, H = hoofdstad.

Het spel slaat automatisch op in de browser (`localStorage`) en kan worden geëxporteerd/geïmporteerd via het menu.

## Inhoud

- **Vijf facties:** Aurelisch Verbond, Kh'arak Zwerm, Lumen Synode, Vrije Kartels van Tyr, IJzeren Hegemonie, elk met eigen bonussen en AI-karakter.
- **Economie:** energie, mineralen, onderzoek en invloed; kolonies met bevolking, gebouwen en scheepswerven; buitenposten, sterrenbases en citadellen.
- **Onderzoek:** 36 technologieën (steeds keuze uit drie), daarna herhaalbare doorbraken.
- **Oorlog:** korvetten tot titanen, automatische gevechten, belegeringen, planetaire garnizoenen en schilden, onrust na verovering.
- **Diplomatie:** oorlog, vrede, niet-aanvalsverdragen, geschenken, wapenstilstanden en coalities tegen wie te machtig wordt.
- **Verkennen:** elk schip brengt de stelsels in kaart waar het doorheen vliegt; verkenners springen 2 stelsels per beurt en zijn de enige die anomalieën kunnen onderzoeken.
- **Piraten:** verborgen piratenbases sturen rovers op zwak verdedigde stelsels af om te plunderen; een vernietigde basis levert buit op.
- **Gebeurtenissen:** anomalieën met keuzes, monsters met buit, Oude Wachters bij de Kroonrelais, en rond beurt 125 de Leegte-crisis.
- **Overwinning:** wek de Kroon, beheers 60% van de nevel gedurende 12 beurten, verover alle rivalen, of heb de hoogste score na beurt 250.
- **Beeld en geluid:** canvas-renderer met nevels, gloeiende rijksgrenzen en gevechtsanimaties; live gegenereerde muziek (WebAudio) die meegroeit met oorlog en crisis.

## Ontwikkelen

De bron staat in `src/`. Na een wijziging:

```sh
python3 build.py          # bouwt index.html en build/logic_node.js
```

| Bestand | Inhoud |
|---|---|
| `src/data.js` | Facties, planeten, gebouwen, schepen, technologie, gebeurtenissen, regels |
| `src/logic_core.js` | RNG, stelselgeneratie, grafen, gevechtskracht |
| `src/logic_game.js` | Spelopzet, economie, commando's, diplomatie, edicten, Kroon |
| `src/logic_turn.js` | Beurtverwerking: beweging, gevechten, belegering, economie, crisis, overwinning |
| `src/logic_ai.js` | Computertegenstanders |
| `src/render.js` | Canvas-renderer en animaties |
| `src/audio.js` | Generatieve muziek en geluidseffecten |
| `src/ui.js` | Interface, invoer, opslaan |
| `src/shell.html`, `src/style.css` | HTML-skelet en opmaak |

De spellogica bevat geen DOM-code en draait ook in Node. De spelstatus is deterministisch (vaste seed) en JSON-serialiseerbaar.

### Tests

```sh
node test/sim.js 1,2,3 middel -v        # AI tegen AI: balans en crashes
node test/playersim.js 1,2,3 middel     # spelerspad met automatische keuzes
node test/ships.js                      # mechanische controle van alle scheepseigenschappen
python3 test/browser.py desk 30         # browsertest met screenshots (Playwright)
python3 test/fuzz.py 1 d                # willekeurige interactie in de UI
```

Voor de Playwright-tests: `pip install playwright && playwright install chromium`. Een eigen Chrome kan via de omgevingsvariabele `CHROME`.

## Licentie

GPL-3.0, zie [LICENSE](LICENSE).
