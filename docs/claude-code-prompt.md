# Prompt de démarrage pour Claude Code

Colle ce prompt dans Claude Code, à la racine du repo, après `bun install`.

---

Tu travailles sur **tuiaux**, une TUI open source (MIT) qui affiche en direct les pipelines GitHub Actions et GitLab CI (y compris auto-hébergé) depuis le terminal. Stack : Bun ≥ 1.3, TypeScript strict, OpenTUI React, zod, Biome, `bun test`. Plateformes : Linux et macOS.

**Avant toute chose**, lis `CLAUDE.md`, `docs/architecture.md`, `docs/roadmap.md` et regarde les maquettes dans `docs/design/` (`*.txt` et PNG). Lance `bun run check`, `bun run demo` et `bun run snapshot` pour voir l'état actuel. La base fonctionne déjà : modèle de données, providers GitHub/GitLab, polling, 3 vues, thèmes, CLI, tests, CI.

**Règles non négociables**

- Respecte les couches (imports uniquement vers le bas) et les règles de `CLAUDE.md`.
- Tout le code, les commentaires, les commits et la doc sont en anglais.
- Chaque tâche se termine avec `bun run check` au vert et, si l'UI change, une sortie `bun run snapshot` comparée aux maquettes de `docs/design/`.
- Pas de réseau dans les tests : fixtures dans `tests/fixtures/`.
- Un commit Conventional Commits par changement logique. Ne pousse pas, ne publie rien.
- Avant de te fier à une API OpenTUI, vérifie-la dans `node_modules/@opentui/*` (projet pré-1.0).

**Travail à faire, dans l'ordre** (montre-moi un plan court avant chaque étape, puis exécute) :

1. **Vérification sur une vraie machine** : lance `bun run dev` dans un repo GitHub réel et un repo GitLab réel ; corrige ce qui casse (pagination, champs nuls, erreurs d'auth affichées dans l'UI plutôt qu'en crash). Ajoute une fixture pour chaque cas réel corrigé.
2. **Écran d'erreur et d'état vide soignés** : token manquant (message + commande `gh auth login` / `glab auth login`), quota API atteint (heure de reprise), aucun run.
3. **Filtre `/`** sur la liste des repos et des runs, et pagination des runs (`page 1/4` comme la maquette).
4. **Barre d'en-tête fidèle à la maquette** : onglets `1 Dashboard · 2 Runs · 3 Watch`, statut par provider, compteur de rafraîchissement.
5. **Thèmes** : vérifie chaque couleur des thèmes intégrés contre leur dépôt officiel et corrige `src/theme/themes.ts` ; ajoute le chargement de thèmes utilisateur depuis `~/.config/tuiaux/themes/*.toml`.
6. **GIF de démo** avec `docs/demo.tape` (VHS) et mise à jour du README.
7. Prépare la **v0.1.0** : relis README, CHANGELOG, `docs/roadmap.md` ; liste-moi ce qu'il reste avant de taguer.

Pour la v1.1 (pas maintenant) : logs des jobs en direct dans la vue détail, relancer/annuler un run, titres de commit GitLab.
