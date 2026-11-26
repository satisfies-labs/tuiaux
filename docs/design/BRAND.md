# tuiaux — brand kit

> **tuiaux** = *tuyaux* (pipes) + **TUI**. Un moniteur de pipelines CI dans le terminal, construit avec OpenTUI.

## Le signe

Un tuyau en S, pixel, plat, avec une bride à chaque extrémité, qui débouche sur **un point de statut**.
Le tuyau est toujours neutre (couleur du texte). **Le point est le seul élément coloré** : il vit avec la CI.

| Statut    | Token     | Sur fond sombre | Sur fond clair | Terminal (ANSI) |
|-----------|-----------|-----------------|----------------|-----------------|
| Réussi    | `success` | `#34D399`       | `#10B981`      | couleur 2 (vert)  |
| En cours  | `running` | `#FBBF24`       | `#D97706`      | couleur 3 (jaune) |
| Échec     | `failure` | `#F87171`       | `#DC2626`      | couleur 1 (rouge) |
| Inactif   | `idle`    | `#94A3B8`       | `#64748B`      | couleur 8 (gris)  |

La couleur de marque par défaut est le point vert menthe `#34D399` (`success`).

### Règles

- Grille : le signe fait **18 × 11 pixels**. Ne jamais lisser, arrondir, ajouter d'ombre ou de dégradé. En CSS, utiliser `image-rendering: pixelated` pour les PNG et `shape-rendering: crispEdges` pour les SVG.
- Agrandir par multiples entiers du pixel quand c'est possible (×2, ×4, ×8…) pour garder des bords nets.
- Marge de protection : **2 pixels du signe** de chaque côté (déjà incluse dans les viewBox des SVG).
- Tailles minimales : signe seul 18 px de large (1 px écran par pixel), logo complet 66 px de large, icône d'app 16 px.
- Le tuyau ne prend jamais une couleur de statut. Pas de point en couleur de marque si le statut affiché est différent.
- Ne pas recomposer le logo avec une autre fonte.

## Couleurs de marque (site, README, réseaux)

| Nom     | Hex       | Usage                        |
|---------|-----------|------------------------------|
| ink     | `#0E1116` | fond sombre, tuyau sur clair |
| surface | `#161B22` | cartes sur fond sombre       |
| line    | `#2A313C` | bordures sur fond sombre     |
| paper   | `#F5F5F0` | fond clair, tuyau sur sombre |
| muted   | `#9AA4B2` | texte secondaire (sombre)    |

**Dans l'app, ces couleurs ne sont pas imposées** : par défaut tuiaux hérite des couleurs ANSI du terminal (thème `terminal`). `tuiaux-dark` / `tuiaux-light` sont proposés comme thèmes intégrés au même titre que Tokyo Night, Catppuccin, etc.

## Typographie

| Rôle | Fonte | Notes |
|------|-------|-------|
| Logo, grands titres | **Departure Mono** | tailles multiples de 11 px (22 / 44 / 88) pour rester sur la grille. OFL, © Helena Zhang. Fichiers dans `fonts/`. |
| UI web, docs, code | **Geist Mono** | `npm i geist` ou Google Fonts. Dans le terminal, c'est la police de l'utilisateur. |

Le wordmark des SVG est déjà vectorisé : aucune fonte n'est nécessaire pour afficher les logos.

## Thèmes & config

```toml
# ~/.config/tuiaux/config.toml
[theme]
name = "terminal"          # défaut : couleurs ANSI du terminal
# name = "tokyo-night" | "catppuccin-mocha" | "catppuccin-latte" | "gruvbox-dark"
#        "nord" | "dracula" | "rose-pine" | "kanagawa" | "tuiaux-dark" | "tuiaux-light"

[theme.colors]             # surcharges optionnelles, token par token
success = "#9ece6a"
```

Valeurs possibles : `#rrggbb`, `default` (fg/bg du terminal), `ansi:N` (index de palette 0–15).
Tokens : `bg`, `surface`, `line`, `text`, `muted`, `success`, `running`, `failure`, `idle`.
Les fichiers sont dans `themes/` (`.toml` un par thème + `themes.json`) et typés dans `dev/tokens.ts`.

> ⚠️ Les hex des thèmes tiers ont été repris de mémoire : vérifie-les contre les dépôts officiels de chaque thème avant la release. Rose Pine n'a pas de vert, `success` utilise *foam*.

## Logo dans le terminal

`terminal/logo.txt` (brut), `terminal/logo.ansi` (point en ANSI vert, suit le thème du terminal), `terminal/logo.truecolor.ansi` (point `#34D399`).

```
▄
███████▄
▀      ██   tuiaux
       ██
       ██▄▄▄█ ▄██▄
        ▀▀▀▀█ ▀██▀
```

Dans le code, `dev/logo.ts` exporte `LOGO_SEGMENTS` : chaque ligne est découpée en segments `pipe` / `dot` / `space`, pour colorer le point selon le statut. Exemple OpenTUI (à adapter à ta version de l'API) :

```ts
import { LOGO_SEGMENTS } from "./logo";
import { THEMES } from "./tokens";

const status = "running";
for (const line of LOGO_SEGMENTS) {
  // pipe → theme.text, dot → theme[status]
  renderLine(line.map(s => ({ text: s.text, fg: s.kind === "dot" ? theme[status] : theme.text })));
}
```

## README

```html
<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/tuiaux-logo-on-dark.svg">
    <img alt="tuiaux" src="assets/tuiaux-logo-on-light.svg" width="330">
  </picture>
</p>
<p align="center">CI pipelines, live in your terminal.</p>
```

Image de partage GitHub : *Settings → Social preview* → `png/social/tuiaux-social-dark.png` (1280 × 640).

## Site web

```html
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#0E1116">
<link rel="stylesheet" href="/tokens.css">
```

`favicon.svg` bascule tout seul clair/sombre. `web/status/favicon-*.svg` permet de changer le favicon selon le statut d'un pipeline (ex. sur une page de statut).

## Index des fichiers

```
svg/mark/       signe seul, fond transparent : on-dark, on-light, adaptive (prefers-color-scheme), mono (currentColor)
svg/logo/       signe + wordmark : on-dark, on-light, dark-bg, light-bg, mono ; wordmark seul
svg/app-icon/   icône d'app (carré arrondi ou carré plein), dark & light
svg/status/     signe et icône pour les 4 statuts, dark & light
svg/social/     bannière 1280×640, dark & light
png/            rendus PNG (icônes 16 → 1024, logos @2x, bannières)
web/            favicon.svg/.ico, apple-touch-icon, icônes PWA, site.webmanifest, tokens.css
terminal/       logo en half-blocks : .txt, .ansi, .truecolor.ansi
themes/         un .toml par thème + themes.json
dev/            tokens.ts, logo.ts
fonts/          Departure Mono (otf, woff2) + licence OFL
```
