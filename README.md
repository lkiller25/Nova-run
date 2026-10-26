# NOVA RUN

**Un jeu de plateforme néon, complet, dans un seul fichier HTML.**
5 mondes, double saut, dash, saut mural, musique synthétisée — zéro dépendance, zéro ressource externe.

[▶ **Jouer maintenant**](index.html) · [nova-run.html](nova-run.html) (même fichier, à partager tel quel)

![Menu du jeu](captures/apercu-menu.png)

---

## Jouer

Ouvre `index.html` (ou `nova-run.html`) dans un navigateur : ça joue, sans installation ni serveur.
Sur une téléphone, les boutons tactiles apparaissent automatiquement — mode paysage conseillé.

| Action | AZERTY | QWERTY | Manette |
|---|---|---|---|
| Courir | ← → ou Q / D | ← → ou A / D | stick / croix |
| Sauter, puis **double saut** en l'air | Espace, ↑, Z | Espace, ↑, W | A / croix |
| **Dash** (1 par saut) | Maj, E | Maj, E | X / carré |
| Chute rapide | ↓ / S | ↓ / S | bas |
| Pause · Son · Recommencer | Échap ou P · M · R | idem | Start |

**Objectif :** traverser les 5 mondes et franchir le **portail** de lumière. Jusqu'à **3 étoiles**
par monde : le terminer · ramasser 70 % des pièces · finir sous le temps objectif.

**Techniques de survie :** écrase les ennemis en leur sautant sur la tête · glisse le long des murs
et saute de mur en mur · enchaîne *saut + dash + saut* pour les grands gouffres · les dalles claires
s'effondrent, les plateformes mobiles ont un rythme à lire · les ressorts envoient très haut.

La sauvegarde (étoiles, records, mondes débloqués) utilise `localStorage`. Si le stockage est bloqué
(iframe sandbox), le jeu fonctionne quand même — simplement sans mémoire entre sessions.

---

## Les 5 mondes

| # | Monde | Taille | Objectif | Pièces | Gemmes | Spécificité |
|---|---|---|---|---|---|---|
| 01 | **Brise Matinale** | 126 tuiles | 0:55 | 31 | 2 | aube sur les toits, apprentissage |
| 02 | **Forêt de Néon** | 142 tuiles | 1:10 | 44 | 3 | introduction du saut mural |
| 03 | **Canyons de Verre** | 154 tuiles | 1:25 | 61 | 3 | ressorts, plateformes mobiles |
| 04 | **Glace Électrique** | 166 tuiles | 1:40 | 61 | 3 | dash, dalles friables, nuit polaire |
| 05 | **Cœur de l'Orage** | 182 tuiles | 2:00 | 75 | 4 | tout combiné, orage et éclairs |

Au total : **272 pièces, 15 gemmes, 36 ennemis** de 3 types (rôdeur, sauteur, œil volant).

![Canyons de Verre](captures/apercu-canyon.png)
![Glace Électrique](captures/apercu-glace.png)

---

## Le ressenti de jeu

- **Physique réglée** : accélération/décélération distinctes au sol et en l'air, hauteur de saut
  variable (relâche tôt = saut court), *coyote time* de 100 ms, *jump buffer* de 140 ms, collisions
  balayées axe par axe, plateformes traversables par le bas.
- **Mouvement expressif** : squash & stretch, écharpe physique, traînée de dash, rotation sur double
  saut, particules d'atterrissage, secousses de caméra dosées.
- **Caméra** : zoom 1,34×, anticipation dans la direction de course, suivi vertical amorti,
  parallaxe à 5 plans cuits dans des calques (coût de rendu quasi nul).
- **Audio 100 % synthèse WebAudio** : musique générative (gamme mineure, arpèges, basse, nappe,
  percussions, tonalité qui change selon le monde) + 15 bruitages. Aucun fichier audio.
- **Interface** : menu animé sur une vraie scène du jeu, sélection des mondes avec vignettes
  générées, 3 étoiles, records, écran de fin, clavier / tactile / manette, et **dégradation
  automatique de la qualité** si le framerate descend sous 46 fps.

![Mobile](captures/apercu-mobile.png)

---

## Publier sur GitHub (et jouer en ligne)

Le dépôt est prêt : `index.html` est à la racine, il suffit d'activer Pages.

```bash
git init
git add .
git commit -m "NOVA RUN — jeu de plateforme néon"
git branch -M main
git remote add origin https://github.com/<TON-PSEUDO>/nova-run.git
git push -u origin main
```

Puis, sur GitHub : **Settings → Pages → Build and deployment → Source : Deploy from a branch**,
**Branch : `main` / `/ (root)`** → *Save*.
Après une minute, le jeu est en ligne sur `https://<TON-PSEUDO>.github.io/nova-run/`.

Le fichier `nova-run.html` peut aussi être envoyé par mail, glissé dans un autre site, ou ouvert
directement en double-cliquant dessus : il est totalement autonome.

---

## Structure du projet

```
index.html             ← le jeu (Page GitHub le sert directement)
nova-run.html          ← le même fichier, pour le partager tel quel
src/
  template.html        structure DOM
  style.css            habillage de l'interface
  levels.js            niveaux (données générées)
  game.js              physique, entités, caméra, boucle
  render.js            rendu canvas (ciel, parallaxe, personnages, particules)
  audio.js             synthèse musicale et bruitages
  ui.js                écrans, sauvegarde, entrées, HUD
tools/
  gen_levels.py        génère src/levels.js (+ carte ASCII des niveaux)
  validate.js          contrôle géométrique : objets hors des murs, cheminements possibles
  build.py             assemble le fichier unique
  test.js              tests navigateur (physique mesurée, écrans, erreurs console)
  bot.js               bot qui joue les niveaux et cartographie les points de chute
  test-responsive.js   mobile paysage/portrait, tactile, petit et grand écran
  test-iframe.js       exécution dans une iframe sandbox (localStorage bloqué)
captures/              aperçus PNG
```

### Modifier et reconstruire

```bash
python3 tools/gen_levels.py   # éditer les niveaux (tuiles de 40 px, sol à la rangée 15)
node tools/validate.js        # vérifier la géométrie et l'atteignabilité
python3 tools/build.py        # réassembler index.html + nova-run.html

# tests (Playwright + Chromium)
npm install
npx playwright install chromium
npm test                      # test.js
npm run bot                   # LEVELS=0,1,2 pour cibler un monde
npm run test:responsive
```

**Repères de conception** : tuiles de 40 px, monde de 720 px de haut ; saut simple ≈ 143 px de haut
et 230 px de long, double saut ≈ 254 px, ressort ≈ 363 px, dash ≈ +120 px de portée.

---

## Licence

MIT — voir [LICENSE](LICENSE). Tu peux réutiliser, modifier et republier librement
(remplace simplement le nom du titulaire dans `LICENSE` si tu le souhaites).

## Limites connues

- Pas de sauvegarde entre sessions dans une iframe `sandbox` sans `allow-same-origin` (détecté, le
  jeu continue sans mémoire).
- Le son démarre après le premier clic ou la première touche (règle d'autoplay des navigateurs).
- Pas de mode deux joueurs ni d'éditeur intégré — mais `tools/gen_levels.py` fait office d'éditeur :
  chaque niveau tient en une quinzaine de lignes de Python.
