# Rework UI/UX de tuiaux — analyse et design

Statut : **validé** (2026-11-28).

## 1. Pourquoi

L'app marche, mais l'interface est un assemblage de vues qui gèrent chacune leurs touches,
leurs dialogues et leurs indications. Résultat : on ne sait pas où l'on est, on ne découvre pas
ce qu'on peut faire, et l'écran casse dès 80 colonnes. Le but est une interface utilisable au
quotidien, découvrable, et des composants `ui/` réutilisables et testés au lieu de lignes faites
à la main dans chaque feature.

## 2. État actuel (captures réelles, `testRender`, thème `tuiaux-dark`)

Dashboard, 80 × 24 :

```
 ● tuiaux v1.2.3
 4 repos  ·  ● 2 passing   ◌ 1 running   ● 0 failed   ○ 1 idle
╭─ Repos ──────────────────────╮╭─ Runs · satisfies-labs/portfolio-2026 ───────╮
│ GITHUB                       ││    WORKFLOW   #     BRANCH     COMMIT   TIME │
│ ▌◌ satisfie… main      13:05 ││  ◌ CI         412   main       feat: p… 13:0 │
│  ● satisfie… main        13h ││  ● Deploy     411   main       fix: og… —    │
│  ● satisfie… repo not found… ││  ● CI         410   main       wip: wo… —    │
│ GITLAB                       ││                                              │
│  ○ innolab/…               — ││                                              │
│                              │╰──────────────────── 3 runs · avg — · ok 50% ─╯
│                              │╭─ Jobs · CI #412 · a1b2c3d ───────────────────╮
│                              ││ running  ·  push on main  ·  created 13h ago │
│                              ││ ● install              ██████ done         — │
│                              ││ ◌ test                 ░░░░░░ running      — │
╰──────────────────── 4 repos ─╯╰──────────────────────────────────────────────╯
 ↑↓ move   tab panel   ⏎ details   w watch   o open   d forget   r refresh   ?
```

Aide (`?`) depuis la vue watch :

```
        ╭─ keys ───────────────────────────────────────────────────────╮
        │ o     open                                                   │
        │ esc   back                                                   │
        │ q     quit                                                   │
        │ esc   close                                                  │
        ╰──────────────────────────────────────────────────────────────╯
```

### Problèmes constatés

**Bugs**

| # | Constat | Où |
|---|---------|----|
| B1 | `esc` apparaît deux fois dans l'aide → warning React « two children with the same key `esc` » | `features/app/help.tsx` |
| B2 | La ligne d'indications déborde à 80 colonnes : `? help` et `q quit` disparaissent | `ui/components/key-hints.tsx` |
| B3 | Colonne TIME tronquée (`13:0`) : `commit` a un minimum de 8 qui fait dépasser la largeur | `dashboard/runs-table.tsx` |
| B4 | `esc` depuis watch revient toujours au dashboard, même si on venait du détail | `watch/watch.tsx` |
| B5 | `● 0 failed` affiche un point rouge pour zéro échec : faux signal d'alerte | `dashboard.tsx` `Summary` |
| B6 | Un repo en erreur garde le point vert de ses runs en cache à côté de « repo not found… » tronqué | `repo-list.tsx` |

**Navigation et découvrabilité**

- Aucun repère de position : le header n'affiche que le logo. Le design cible (`docs/design/01-dashboard.txt`) prévoit des onglets, l'état des providers et l'âge du dernier rafraîchissement.
- Les actions ne se découvrent que par la ligne du bas, tronquée (B2). L'aide liste des touches sans les grouper ni les expliquer.
- Pas de recherche, pas de saut rapide vers un repo ou un run : avec 15 repos on fait défiler.

**Architecture UI**

- Chaque vue a son `useKeyboard` gardé par un booléen `active`, plus un dans `App`. Les indications (`DASHBOARD_HINTS`…) sont déclarées à part des handlers : elles divergent déjà (`r refresh` est géré par `App`, listé par chaque vue ; `esc close` est ajouté à la main dans l'aide).
- Les dialogues vivent à deux endroits (`overlayAtom` dans `App`, `forgetAtom` dans le dashboard), chacun avec sa propre capture de touches.
- `RepoRow`, `RunRow`, `JobList` réimplémentent trois fois la même ligne sélectionnable (marqueur `▌`, fond `selection`, `fit` par colonne, calcul de largeur à la main avec des constantes magiques `width - 4 - 3 - TIME`).
- `Dialog` a une géométrie figée (`top 25%`, `width 80%`) : une boîte de 80 % pour quatre lignes.

**Mise en page**

- Les chemins `owner/repo` sont tronqués à `satisfie…` : le propriétaire, souvent le même partout, mange toute la place.
- Le panneau Repos est vide aux trois quarts ; le panneau Jobs prend une moitié fixe même avec deux jobs.
- Rien ne bouge pour un run actif alors que la marque dit « ◌/spinner running ».

## 3. Objectifs

- **Savoir où l'on est** : onglets de vues dans le header, fil d'Ariane, état des hôtes.
- **Tout faire au clavier sans mémoriser** : une palette de commandes (`Ctrl-K` / `:`) qui liste toutes les actions avec leur raccourci et permet de sauter vers un repo ou un run.
- **Une seule source pour les touches** : chaque commande est déclarée une fois ; touches, ligne d'indications, aide et palette en dérivent.
- **Tenir à 80 × 24** sans rien couper d'essentiel.
- **Composants `ui/` réutilisables et testés** : `Table`, `Tabs`, `Dialog`, `CommandPalette`, `KeyHints`, `Spinner`, `EmptyState`.

### Non-objectifs

- Pas de nouvelles données : logs, rerun, cancel restent en v1.1 (roadmap). Le registre de commandes leur laisse la place (commandes masquées tant que `capabilities` ne les offre pas).
- Pas de souris.
- Pas de nouveau thème ni de nouveau token de couleur.

### Anti-objectifs (échec même si « ça marche »)

- Une palette qui est une deuxième implémentation des actions, à côté des touches.
- Des couleurs de statut hors statut, du hex dans l'UI, une grille de caractères qui casse.
- Des modes cachés : à tout moment `esc` ferme ce qui est ouvert ou revient en arrière.

## 4. Approches pour le cœur (touches + commandes)

**A. Registre de commandes + un seul dispatcher (recommandé)**
Chaque vue expose `useXCommands(...)` → `ReadonlyArray<Command>`. `App` compose les commandes
globales et celles de la vue, et un seul `useKeyboard` dispatche : l'overlay ouvert d'abord, puis
la première commande dont une touche correspond. La ligne du bas, l'aide et la palette lisent la
même liste. Coût : on déplace les handlers existants, sans changer leur logique.

**B. Garder les `useKeyboard` par vue, ajouter une palette qui lit les `HINTS`**
Moins de changements, mais la palette ne peut pas *exécuter* les actions (elles sont enfouies dans
les handlers) ou les duplique. Rejeté : c'est exactement l'anti-objectif.

**C. Composants OpenTUI natifs (`<select>`, `<tab-select>`) qui gèrent eux-mêmes leurs touches**
Ils capturent le focus et le clavier à leur façon et ont leur propre style : conflit avec un
dispatcher central et avec les tokens de thème. On garde `<input>` pour la saisie de la palette
(c'est la seule chose qu'on ne veut pas réécrire), le reste est fait en `<box>`/`<text>`.

## 5. Design proposé

### 5.1 Registre de commandes (`src/ui/commands.ts`)

```ts
export type CommandGroup = "Navigation" | "Run" | "Repo" | "App"

export interface Command {
  readonly id: string                   // "run.open-browser"
  readonly title: string                // "Open run in browser" (palette, aide)
  readonly group: CommandGroup
  readonly keys: ReadonlyArray<string>  // ["o"], ["j", "down"], ["ctrl+k"]
  readonly hint?: string                // libellé court pour la ligne du bas ; absent = pas affiché
  readonly palette?: boolean            // false pour j/k, flèches (défaut true)
  readonly run: () => void
}

/** La commande qu'une touche déclenche, s'il y en a une. Pur, testé. */
export const matchKey: (commands: ReadonlyArray<Command>, key: KeyEvent) => Command | undefined
```

- Les commandes indisponibles ne sont pas dans la liste (pas de run sélectionné → pas de `run.watch`). Pas d'état « désactivé » à gérer.
- `features/app` compose : `[...globalCommands, ...viewCommands]`. Un seul `useKeyboard`.
- `DASHBOARD_HINTS`, `RUN_DETAIL_HINTS`, `WATCH_HINTS` et le booléen `active` disparaissent.

### 5.2 Overlays (`src/ui/overlay.ts`)

Un seul atome, un seul overlay à la fois, qui reçoit toutes les touches tant qu'il est ouvert :

```ts
export type Overlay = Data.TaggedEnum<{
  Palette: { readonly scope: "all" | "repos" }
  Confirm: { readonly title: string; readonly message: string; readonly confirm: string; readonly run: () => void }
  ConfigIssues: {}
}>
```

`ForgetDialog` devient un `Overlay.Confirm`, `Help` devient la palette (voir 5.4). `esc` ferme toujours.

### 5.3 Header avec onglets (`ui/components/tabs.tsx`)

```
 ● tuiaux   1 Dashboard   2 Run   3 Watch                    github ●  gitlab ●   ↻ 4s
```

- Onglets = vues. `1`/`2`/`3` ou `[`/`]` pour changer. `Run` et `Watch` portent le dernier run ouvert ; grisés tant qu'aucun run n'a été ouvert.
- L'onglet actif est souligné en `accent` et en gras ; les autres en `muted`.
- À droite : un point par hôte connu (`idle` si OK et calme, `failure` si `hostIssues` le concerne, `running` pendant un fetch) et l'âge du `fetchedAt` le plus récent.
- La version passe dans la palette (« About »), elle n'a rien à faire en permanence à l'écran.

`viewAtom` garde une pile courte (`back` revient à la vue précédente) : corrige B4.

### 5.4 Palette de commandes (`ui/components/command-palette.tsx`)

`Ctrl-K` ou `:` ; `?` l'ouvre aussi, filtrée sur rien (= l'aide, groupée, avec les touches).

```
          ╭─ Commands ───────────────────────────────────────────────╮
          │ › fail█                                                   │
          │                                                           │
          │ ACTIONS                                                   │
          │▌ Show failing repos only                              f   │
          │ REPOS                                                     │
          │   ● satisfies-labs/portfolio-2026       main        12m   │
          │ RUNS                                                      │
          │   ● Deploy #411 · portfolio-2026        failed      38m   │
          │                                                           │
          ╰─────────────────────────────── ↑↓ select · ⏎ run · esc ──╯
```

- Trois sections : actions (le registre), repos (sauter = sélectionner dans le dashboard), runs récents de tous les repos (sauter = ouvrir le détail).
- Filtrage par sous-séquence floue, pur et testé : `fuzzyScore(query, text): number | undefined` dans `ui/fuzzy.ts`, avec bonus début de mot et caractères contigus. Pas de dépendance.
- Saisie par `<input>` OpenTUI ; la liste est une `Table` sans en-tête.
- Hauteur ≤ 60 % de l'écran, largeur `min(72, width - 8)`, centrée.

### 5.5 Composants `ui/`

| Composant | Rôle | Remplace |
|-----------|------|----------|
| `Table<T>` | Colonnes `{ id, header?, width \| flex, align, priority, render }`. Calcule les largeurs depuis la largeur disponible ; sous la place nécessaire, retire les colonnes de plus faible priorité ; la colonne `flex` prend le reste avec un minimum. Ligne sélectionnable (marqueur + fond), fenêtrage via `visibleWindow`. | `RepoRow`, `RunRow`, lignes de `JobList`, lignes des étapes |
| `Tabs` | Onglets du header (5.3). | — |
| `Dialog` | Centré, `width` en cellules (bornée à l'écran), titre, pied avec `KeyHints`. | géométrie figée actuelle |
| `KeyHints` | Prend `width`, garde les indications par ordre de priorité tant qu'elles tiennent, termine toujours par `^K commands`. | corrige B2 |
| `Spinner` / `StatusDot animated` | `◐◓◑◒` pour `running`, cadencé par un tick partagé (pas un timer par ligne). | `◌` fixe |
| `EmptyState` | Point `idle`, titre, une ou deux lignes d'explication, une commande suggérée. | textes `muted` épars |

Les largeurs magiques (`width - 4 - 3 - TIME`) disparaissent : `Panel` expose sa largeur intérieure, `Table` fait le reste.

### 5.6 Écrans

**Dashboard (120 × 30)**

```
 ● tuiaux   1 Dashboard   2 Run   3 Watch                                     github ●  gitlab ●   ↻ 4s
 4 repos · ● 2 passing  ◌ 1 running  ○ 1 idle                                              filter: all
╭─ Repos ──────────────────────────────╮╭─ Runs · satisfies-labs/portfolio-2026 ─────────────────────────╮
│ GITHUB · 3                           ││   WORKFLOW   #    COMMIT                    BRANCH   TIME   AGE │
│▌◐ portfolio-2026      main     13:05 ││▌◐ CI         412  feat: pixel cloud hero    main    13:05   13h │
│ ● tuiaux              main       13h ││ ● Deploy     411  fix: og image size        main        —   13h │
│ ! dotfiles            repo not found ││ ● CI         410  wip: works grid           main        —   13h │
│ GITLAB · 1                           │╰──────────────────────────────────── 3 runs · avg — · ok 50% ──╯
│ ○ vue-ui-kit                       — │╭─ Jobs · CI #412 · a1b2c3d · push on main ────────────────────╮
│                                      ││ ● install     ████████████████████████████████  done    0:21 │
│                                      ││ ● lint        ████████████████████████████████  done    0:18 │
│                                      ││ ◐ test        ████████████████████░░░░░░░░░░░░   64%    0:37 │
╰──────────────────────────── 4 repos ─╯╰──────────────────────────────────────────────────────────────╯
 ↑↓ move  tab panel  ⏎ details  w watch  o open  / filter                                  ^K commands
```

- Repos : le nom seul en `text`, le propriétaire en `muted` uniquement s'il diffère d'une ligne à l'autre ou si la place le permet ; le chemin complet est dans le titre du panneau Runs. Corrige la troncature à `satisfie…`.
- Repo en erreur : marque `!` en `failure` au lieu du point de statut, message entier dans la colonne branche + temps (B6).
- Résumé : les compteurs à zéro sont masqués (B5). `filter:` affiche le filtre courant.
- Runs : colonnes par priorité `dot > workflow > commit(flex) > time > # > age > branch > event`. À 80 colonnes, `event` puis `branch` partent ; TIME n'est jamais coupé (B3).
- Jobs : la hauteur suit le nombre de jobs (min 4 lignes, max moitié) ; le panneau Runs récupère le reste. Le méta (`push on main`) passe dans le titre.
- Sous 100 colonnes, le panneau Repos passe en compact (point + nom + temps).

**Filtre `/`** (roadmap v1.1) : ouvre la palette en `scope: "repos"` ; ⏎ applique la requête comme filtre du dashboard (affiché dans le résumé), `esc` dans le dashboard l'efface. `f` bascule « en échec seulement ».

**Détail de run** : inchangé dans sa forme (jobs à gauche, étapes à droite), passé sur `Table`. Le fil d'Ariane reste sous le header.

**Watch** : la carte compacte centrée verticalement, comme `docs/design/03-watch.txt`, avec la durée de chaque job sur la ligne des points quand la place le permet.

### 5.7 Retour d'action

Une ligne de « flash » dans la barre du bas pendant 3 s après une action sans effet visible :
`↻ refreshing…`, `opened in browser`, `forgot satisfies-labs/dotfiles`. Atome UI `flashAtom`, effacé par un `useEffect` temporisé.

## 6. Découpage (une PR par étape, `bun run check` vert à chaque fois)

1. **Fondations** : `Command` + `matchKey` + dispatcher unique, `Overlay`, `Dialog` centré, `KeyHints` qui tient la largeur. Les vues migrent sans changer de comportement. Corrige B1, B2.
2. **Palette** : `fuzzyScore`, `CommandPalette`, `Ctrl-K` / `:` / `?`, sections actions / repos / runs.
3. **Header et navigation** : `Tabs`, pile de vues, état des hôtes, âge du rafraîchissement. Corrige B4.
4. **Table et mise en page** : `Table`, colonnes par priorité, repos compacts, hauteurs adaptatives, résumé. Corrige B3, B5, B6.
5. **Finitions** : `Spinner`, `EmptyState`, flash, filtre `/` et `f`.

Tests : `fuzzyScore`, `matchKey`, calcul des largeurs de `Table` en tests purs ; chaque étape a ses tests `testRender` à 80 × 24 et 120 × 30 (aucune ligne ne dépasse, les touches clés restent visibles, la palette exécute une commande).

## 7. Laissé au constructeur

- Glyphes exacts du spinner selon ce que rendent les terminaux courants (repli sur `◌` si besoin).
- Seuils de priorité de colonnes fins, tant que TIME et le point ne disparaissent jamais.
- Libellés exacts des commandes.

## 8. Décisions

1. Onglets = vues (`Dashboard · Run · Watch`). Filtres via `/` et `f`.
2. `?` ouvre la palette à vide : elle sert d'aide groupée. Plus d'écran d'aide séparé.
3. La version quitte le header ; elle est dans la commande « About » de la palette.
