# NOVA RUN

**Un jeu de plateforme néon, complet, dans un seul fichier HTML.**
8 mondes dont 3 mondes animés (Grand Line, Lugnica enneigée, Tournoi des Héros), un système de
**skins** procéduraux (Luffy, Zoro, Subaru, Émilia, Rem, Naruto, Goku…), double saut, dash, saut
mural, musique synthétisée — zéro dépendance, zéro ressource externe.

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

**Objectif :** traverser les 8 mondes et franchir le **portail** de lumière. Jusqu'à **3 étoiles**
par monde (24 au total) : le terminer · ramasser 70 % des pièces · finir sous le temps objectif.
Terminer les mondes animés **débloque des skins** dans le menu *SKINS*.

**Techniques de survie :** écrase les ennemis en leur sautant sur la tête · glisse le long des murs
et saute de mur en mur · enchaîne *saut + dash + saut* pour les grands gouffres · les dalles claires
s'effondrent, les plateformes mobiles ont un rythme à lire · les ressorts envoient très haut.

La sauvegarde (étoiles, records, mondes débloqués, **skin équipé**) utilise `localStorage`.
Si le stockage est bloqué (iframe sandbox), le jeu fonctionne quand même — simplement sans
mémoire entre sessions.

---

## Les 8 mondes

| # | Monde | Taille | Objectif | Pièces | Gemmes | Spécificité |
|---|---|---|---|---|---|---|
| 01 | **Brise Matinale** | 126 tuiles | 0:55 | 31 | 2 | aube sur les toits, apprentissage |
| 02 | **Forêt de Néon** | 142 tuiles | 1:10 | 44 | 3 | introduction du saut mural |
| 03 | **Canyons de Verre** | 154 tuiles | 1:25 | 61 | 3 | ressorts, plateformes mobiles |
| 04 | **Glace Électrique** | 166 tuiles | 1:40 | 61 | 3 | dash, dalles friables, nuit polaire |
| 05 | **Cœur de l'Orage** | 182 tuiles | 2:00 | 75 | 4 | tout combiné, orage et éclairs |
| 06 | **Grand Line** *(One Piece)* | 172 tuiles | 2:15 | 80 | 5 | radeaux mobiles, mâts à sauts muraux, horizon de voiliers |
| 07 | **Lugnica Enneigée** *(Re:Zero)* | 178 tuiles | 2:30 | 86 | 4 | neige continue, ruines en wall-jump, silhouettes de châteaux |
| 08 | **Tournoi des Héros** *(shōnen)* | 188 tuiles | 2:45 | 93 | 4 | arène ultime sous orage, portails torii, toutes les techniques réunies |

Au total : **531 pièces, 28 gemmes, 73 ennemis** de 3 types (rôdeur, sauteur, œil volant).
Chaque monde porte sa météo (`motes`, `rain`, `snow`, `storm`) et sa ligne d'horizon
(`city`, `trees`, `mesa`, `peaks`, `sea`, `castle`, `torii`), toutes cuites en parallaxe procédurale.

![Canyons de Verre](captures/apercu-canyon.png)
![Glace Électrique](captures/apercu-glace.png)

---

## Les skins

Le bouton **SKINS** du menu ouvre un écran de sélection avec vignettes dessinées en direct sur
canvas. Les personnages sont des **recreations vectorielles néon** — palettes de couleurs et
accessoires reconnaissables (chapeau de paille, cheveux verts, bandeau, pics, fleur, ruban…),
sans aucun asset ni personnage copié. Le skin choisi est enregistré dans la sauvegarde
(`localStorage`, clé `novarun.save.v2`, champ `skin`) et appliqué partout, écharpe et traînées
de dash incluses.

| Skin | Tag | Déblocage |
|---|---|---|
| **Nova** | NOVA RUN | disponible d'office |
| **Luffy**, **Zoro** | ONE PIECE | terminer le monde 06 (Grand Line) |
| **Subaru**, **Émilia**, **Rem** | RE:ZERO | terminer le monde 07 (Lugnica Enneigée) |
| **Naruto**, **Goku** | SHONEN | terminer le monde 08 (Tournoi des Héros) |

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
  générées, écran de **skins avec vignettes peintes en canvas** et verrous de déblocage, 3 étoiles,
  records, écran de fin, clavier / tactile / manette, et **dégradation automatique de la qualité**
  si le framerate descend sous 46 fps.

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

Les sources vivent à la racine du dépôt (les scripts acceptent aussi une arborescence `src/` +
`tools/` si tu en recrées une) :

```
index.html             ← le jeu autonome (Page GitHub le sert directement)
nova-run.html          ← le même fichier, pour le partager tel quel
template.html          structure DOM
style.css              habillage de l'interface (écrans, cartes de mondes, cartes de skins)
levels.js              8 niveaux (données générées)
game.js                physique, entités, caméra, boucle
render.js              rendu canvas : ciels, parallaxe, table SKINS et peinture des personnages
audio.js               synthèse musicale et bruitages
ui.js                  écrans, sélection des skins, sauvegarde, entrées, HUD
gen_levels.py          génère levels.js (+ carte ASCII des niveaux)
validate.js            contrôle géométrique : objets hors des murs, cheminements possibles
build.py               assemble le fichier unique (détecte src/ si présent, sinon la racine)
sim-bot.js             bot headless Node (physique uniquement, sans navigateur)
test.js, bot.js        tests navigateur Playwright (physique mesurée, bot visuel)
test-responsive.js     mobile paysage/portrait, tactile, petit et grand écran
test-iframe.js         exécution dans une iframe sandbox (localStorage bloqué)
captures/              aperçus PNG
```

### Modifier et reconstruire

```bash
python3 gen_levels.py        # éditer les niveaux (tuiles de 40 px, sol à la rangée 15)
node validate.js             # vérifier la géométrie et l'atteignabilité (0 erreur attendue)
node sim-bot.js              # bot headless : joue les 8 niveaux sans navigateur
python3 build.py             # réassembler index.html + nova-run.html

# tests navigateur (Playwright + Chromium, optionnel)
npm install
npx playwright install chromium
npm test
LEVELS=5,6,7 npm run bot     # cibler les mondes animés
```

**Ajouter un skin** : une entrée dans la table `SKINS` de `render.js` (palettes + type de tête +
emblème), éventuellement un nouvel accessoire dans `paintHead` / `paintEmblem`, puis une règle de
déblocage via le champ `unlock` (index du monde à terminer, ou `null` pour un skin libre).

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
- Pas de mode deux joueurs ni d'éditeur intégré — mais `gen_levels.py` fait office d'éditeur :
  chaque niveau tient en une quinzaine de lignes de Python.
- Les skins sont des évocations vectorielles (couleurs + accessoires), pas des sprites officiels :
  le jeu reste 100 % procédural et autonome, sans image ni ressource externe.
