# Agent Guide - Arrera Dock (`dock@linux.arrera-software.fr`)

Ce document fournit aux agents de développement toutes les informations nécessaires pour comprendre, modifier, tester et maintenir rapidement le projet Arrera Dock.

---

## 1. Vue d'ensemble du projet

* **Nom** : Arrera Dock
* **UUID** : `dock@linux.arrera-software.fr`
* **Distribution cible** : Arrera Blue
* **Environnement** : GNOME Shell (45 à 50) sur Wayland / X11 (GJS, modules ECMAScript)
* **Objectif** : Un dock de bureau moderne et flottant (style Android 16 / Material 3 Expressive) qui remplace le Dash natif de la vue Activités de GNOME, avec support du mode barre, de l'autohide, de thèmes multiples et de l'intégration des statuts système (Date/Heure et Paramètres rapides).

---

## 2. Structure des fichiers

```text
.
├── extension.js                    # Point d'entrée de l'extension (cycle de vie enable/disable)
├── dock.js                         # Logique principale du dock, icônes, animations, drag&drop, autohide
├── stylesheet.css                  # Feuilles de style Clutter/St (thèmes, tailles, orientations)
├── metadata.json                   # Métadonnées de l'extension pour GNOME Shell
├── GNOME_SETTINGS_INTEGRATION.md   # Référence synthétique des 9 clés GSettings
├── config_dock.sh                  # Menu CLI interactif pour tester toutes les options GSettings
├── lauch_dev.sh                    # Lanceur d'environnement de test (gnome-shell --devkit)
├── build.sh                        # Script d'empaquetage / distribution
├── schemas/
│   ├── org.gnome.shell.extensions.dock.gschema.xml  # Schéma XML des paramètres GSettings
│   └── gschemas.compiled                            # Binaire de schéma compilé
└── icons/                          # Icônes de l'extension
```

---

## 3. Rôle des composants clés

### `extension.js`
* Gère l'activation (`enable()`) et la désactivation (`disable()`).
* Ajoute le dock au gestionnaire d'affichage de GNOME via `Main.layoutManager.addTopChrome()`.
* Surveille les changements d'écrans (`monitors-changed`) pour repositionner le dock.
* **Vue Activités** : `_replaceNativeDash()` masque le Dash noir natif de GNOME (`opacity = 0`, `visible = false`) et réserve la hauteur du dock pour conserver un alignement parfait de la carte d'aperçu du bureau.

### `dock.js`
* **`ArreraDock`** : Conteneur principal du dock.
  * Structure visuelle : `_dockPill` (pilule centrale) contenant `_iconsBox` (icônes d'apps), `ShowAppsButton` (bouton grille d'apps), spacers pour le mode barre, et `_systemBox` (date et quick settings).
  * **Masquage automatique (`autohide`)** : Détection de survol, barrière de proximité, détection des fenêtres maximisées ou qui chevauchent le dock, et blocage du masquage si un menu est ouvert.
  * **Mode Barre** : S'étend sur toute la largeur/hauteur (`mode-bar`) de manière permanente (`always-bar-mode`) ou dynamique quand une fenêtre est maximisée (`extend-on-maximize`).
  * **Intégration Statut Système** : Reparentage dynamique de `Main.panel.statusArea.quickSettings` et `dateMenu` dans `_systemBox`, avec ajustement de la direction des menus déroulants (`updateArrowSide(St.Side.BOTTOM)` pour s'ouvrir vers le haut).
  * **Synchronisation Thèmes & Couleurs** : Écoute les changements de thème (`theme-mode`) et la couleur d'accentuation du bureau GNOME (`accent-color`).
* **`DockAppIcon`** : Représente chaque lanceur d'application (favori ou active). Gère les indicateurs d'état d'exécution (points blancs ou colorés), les fenêtres actives, les clics, les menus contextuels et le drag-and-drop.
* **`ActivitiesButton`** : Bouton orné du logo Arrera (`icons/arrera-logo.svg`) ouvrant/fermant la vue Activités (`Main.overview.toggle()`), synchronisé avec l'état de l'aperçu et gérant le Drag-and-Drop.
* **`ShowAppsButton`** : Bouton grille d'applications ouvrant Arrera App Menu ou la grille GNOME Shell.
* **`DockClockTile`** : Tuile d'horloge compacte ("HH" sur "MM") dédiée au dock vertical pour éviter les débordements textuels et ouvrir le calendrier GNOME.
* **`DockQuickSettingsTile`** : Tuile carrée dédiée aux Paramètres Rapides sur dock vertical (icône système évitant la colonne d'indicateurs étirée et ouvrant le menu Quick Settings).

### `stylesheet.css`
* Feuille de style utilisant le moteur CSS de Clutter/St.
* **Thèmes pris en charge** (`theme-mode`) :
  1. `theme-expressive` : Fond teinté et dynamique selon la couleur d'accentuation de GNOME via `st-mix(-st-accent-color, ...)`.
  2. `theme-black-outline` : Fond noir profond (`#0c0c0f`) avec bordure nette de 2px de la couleur d'accentuation.
  3. `theme-vanilla-gnome` : Fond gris sombre `#38383b` identique au dash natif GNOME, sans bordure, avec points blancs.
* **Tailles** (`size-small`, `size-medium`, `size-large`) : Définit les paddings, hauteurs, et tailles d'icônes adaptatives (`icon-size: 13px / 16px / 19px` pour les statuts).
* **Orientations** (`position-bottom`, `position-left`, `position-right`).

---

## 4. Schéma GSettings (`org.gnome.shell.extensions.dock`)

Toutes les options sont déclarées dans `schemas/org.gnome.shell.extensions.dock.gschema.xml` :

| Clé | Type | Défaut | Valeurs autorisées | Rôle |
|---|---|---|---|---|
| `autohide` | `b` | `false` | `true`, `false` | Masque le dock quand une fenêtre le chevauche |
| `extend-on-maximize` | `b` | `true` | `true`, `false` | Passe en barre si une fenêtre est maximisée |
| `always-bar-mode` | `b` | `false` | `true`, `false` | Force le mode barre pleine largeur en permanence |
| `bar-icons-alignment`| `s` | `'center'` | `'center'`, `'left'` | Alignement des icônes en mode barre |
| `icon-size` | `s` | `'medium'`| `'small'`, `'medium'`, `'large'` | Taille des icônes (28px, 36px, 48px) |
| `theme-mode` | `s` | `'expressive'` | `'expressive'`, `'black-outline'`, `'vanilla-gnome'` | Thème visuel et couleur du dock |
| `position` | `s` | `'bottom'`| `'bottom'`, `'left'`, `'right'` | Position sur l'écran (bas, gauche, droite) |
| `show-quick-settings`| `b` | `false` | `true`, `false` | Place le bloc Wi-Fi/Volume/Batterie dans le dock |
| `show-date-menu` | `b` | `false` | `true`, `false` | Place l'horloge/date/calendrier dans le dock |
| `show-activities-button`| `b` | `false` | `true`, `false` | Intègre le bouton Activités avec logo Arrera dans le dock et masque le bouton natif |
| `clock-position` | `s` | `'bottom'` | `'top'`, `'between-logo-and-apps'`, `'bottom'` | Emplacement de l'horloge dans le dock |
| `date-format`    | `s` | `'default'` | `'default'`, `'uppercase-date'`, `'uppercase-date-year'`, `'uppercase-datetime'` | Formatage personnalisé de la date dans le dock |
| `dark-tiles`     | `b` | `false` | `true`, `false` | Affiche chaque élément du dock dans une tuile sombre arrondie permanente (squircle) |
| `island-mode`    | `b` | `false` | `true`, `false` | Rend le fond du conteneur de dock 100% transparent (tuiles détachées / Design 3) |
| `vertical-alignment` | `s` | `'center'` | `'top'`, `'center'`, `'bottom'` | Alignement vertical du dock latéral (en haut, centré, en bas) |

---

## 5. Commandes de développement et flux de travail

### Vérification de la syntaxe JavaScript
```bash
node --check dock.js extension.js
```

### Recompilation des schémas GSettings
Lors de toute modification de `schemas/org.gnome.shell.extensions.dock.gschema.xml`, compiler dans le projet et dans le répertoire utilisateur :
```bash
glib-compile-schemas schemas/
cp schemas/org.gnome.shell.extensions.dock.gschema.xml ~/.local/share/glib-2.0/schemas/
glib-compile-schemas ~/.local/share/glib-2.0/schemas/
```

### Lancer la session de test GNOME Shell
Lance une session de test imbriquée (nested session) sans impacter la session hôte :
```bash
./lauch_dev.sh
```

### Tester / Basculer les options en ligne de commande
```bash
# Menu interactif
./config_dock.sh

# Ou directement via gsettings
gsettings set org.gnome.shell.extensions.dock theme-mode 'vanilla-gnome'
gsettings set org.gnome.shell.extensions.dock icon-size 'large'
```

---

## 6. Règles de conception & Bonnes pratiques pour l'agent

1. **Cycle de vie et Teardown propre** :
   * Toujours nettoyer les écouteurs d'événements (`disconnectObject(this)`).
   * Si un widget GNOME est reparenté (ex. `quickSettings`, `dateMenu`), toujours conserver son parent d'origine, son index et ses propriétés de layout (`y_align`, `y_expand`), et le restaurer à son état exact dans `disable()` / `destroy()`.
2. **Gestion des Menus Déroulants** :
   * Les menus GNOME Shell s'ouvrent par défaut vers le bas (`St.Side.TOP`). Dans un dock situé en bas de l'écran, modifier la flèche via `menu._boxPointer.updateArrowSide(St.Side.BOTTOM)` pour qu'ils s'ouvrent vers le haut.
3. **Spécificités Clutter / St CSS** :
   * St CSS n'est pas un moteur web standard : utiliser `icon-size` pour contraindre la taille des `St.Icon`, et les fonctions St supportées (`st-mix`, `st-transparentize`, `-st-accent-color`).
4. **Intégrité de la barre supérieure** :
   * Ne pas modifier le bouton « Activités » de la barre supérieure sauf demande explicite de l'utilisateur.
