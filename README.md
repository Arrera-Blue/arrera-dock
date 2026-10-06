# Arrera Dock

Dock moderne et dynamique pour l'environnement de bureau **GNOME Shell**, conçu spécialement pour la distribution **Arrera Blue**.

Il remplace le dash natif de l'aperçu par une pilule flottante au design soigné inspiré de **Material 3 Expressive** et d'**Android 16 QPR2**, avec prise en charge du mode barre, de l'autohide, de thèmes multiples et de l'intégration des statuts système.

---

## Fonctionnalités

* **Disposition adaptative** : Positionnement au choix en bas (horizontal), à gauche ou à droite de l'écran (vertical).
* **Masquage automatique intelligent (Autohide)** : Rentre et sort avec une zone de détection et détection automatique des fenêtres actives ou en chevauchement.
* **Mode barre plein écran (Bar Mode)** :
  * *Dynamique* : Le dock se transforme en barre pleine largeur (ou hauteur) dès qu'une fenêtre est maximisée ou en plein écran (`extend-on-maximize`).
  * *Permanent* : Possibilité de verrouiller le dock en mode barre continue (`always-bar-mode`).
  * *Alignement des icônes* : Icônes centrées ou calées au début/à gauche en mode barre (`bar-icons-alignment`).
* **Tailles d'icônes configurables** : Format petit (28 px), moyen (36 px, par défaut) ou grand (48 px).
* **Modes de thème** :
  * *Expressif (`expressive`)* : Fond teinté dynamiquement selon la couleur d'accentuation active de GNOME (Material 3).
  * *Contour noir (`black-outline`)* : Fond noir profond (`#0c0c0f`) avec bordure nette de la couleur d'accentuation.
  * *Vanilla GNOME (`vanilla-gnome`)* : Couleur grise `#38383b` identique au dock natif GNOME, sans liseré de couleur, avec points d'application blancs.
  * *(Voir le guide détaillé dans [`THEMES.md`](THEMES.md))*
* **Intégration du statut système dans le dock** :
  * *Paramètres rapides (`show-quick-settings`)* : Intègre Wi-Fi, volume, profil d'énergie, batterie dans le dock, avec menu ascendant.
  * *Date et horloge (`show-date-menu`)* : Affiche l'heure, la date et le calendrier directement à côté des icônes du dock.
  * Dimensionnement adaptatif automatique des icônes système selon la taille du dock.
* **Gestion des favoris par clic droit** : Épingler, détacher et réorganiser n'importe quelle application par glisser-déposer (*drag & drop*).
* **Configuration rapide** : Script interactif `config_dock.sh` pour basculer facilement toutes les options GSettings.

---

## Installation RPM (Fedora / Arrera Linux)

### Via le dépôt COPR officiel Arrera Blue

```bash
# Activer le dépôt COPR
sudo dnf copr enable arrera-software/arrera_blue

# Installer le paquet
sudo dnf install gnome-shell-extension-arrera-dock
```

### Activer l'extension

```bash
gnome-extensions enable dock@linux.arrera-software.fr
```

---

## Configuration

### Script interactif rapide

Un script en ligne de commande est fourni pour basculer instantanément n'importe quelle option :

```bash
./config_dock.sh
```

### Via GSettings

Toutes les options sont gérées sous le schéma `org.gnome.shell.extensions.dock` :

```bash
# Masquage automatique
gsettings set org.gnome.shell.extensions.dock autohide true

# Taille des icônes ('small' | 'medium' | 'large')
gsettings set org.gnome.shell.extensions.dock icon-size 'medium'

# Thème visuel ('expressive' | 'black-outline' | 'vanilla-gnome')
gsettings set org.gnome.shell.extensions.dock theme-mode 'vanilla-gnome'

# Mode barre permanent
gsettings set org.gnome.shell.extensions.dock always-bar-mode true

# Afficher les paramètres rapides ou la date dans le dock
gsettings set org.gnome.shell.extensions.dock show-quick-settings true
gsettings set org.gnome.shell.extensions.dock show-date-menu true
```

Pour la liste exhaustive de toutes les clés et leurs valeurs autorisées, consultez [`GNOME_SETTINGS_INTEGRATION.md`](GNOME_SETTINGS_INTEGRATION.md). Pour le détail visuel des styles et rendus, consultez [`THEMES.md`](THEMES.md).

---

## Développement et contribution

### Prérequis

Pour développer et tester l'extension dans un environnement isolé sans impacter votre session de bureau principale :

* **GNOME Shell** (version 45 à 50)
* **glib2-devel** (pour compiler les schémas avec `glib-compile-schemas`)
* **mutter-devkit** (fournit la session imbriquée devkit Wayland)
* **dbus-daemon** (fournit `dbus-run-session`)

### Cloner le projet

```bash
git clone https://github.com/Arrera-linux/arrera-dock.git
cd arrera-dock
```

### Lancer la session de test (mode développement)

Pour compiler les schémas et lancer une session GNOME Shell imbriquée avec **Arrera Dock** :

```bash
./lauch_dev.sh
```

### Structure du projet

* **`dock.js`** : Cœur du dock (disposition adaptative, lanceurs d'apps, autohide, mode barre, reparentage du statut système).
* **`extension.js`** : Point d'entrée de l'extension (`enable()` et `disable()`), intégration du chrome et masquage du dash natif.
* **`stylesheet.css`** : Feuilles de style Clutter/St (thèmes Expressif, Black Outline, Vanilla GNOME, tailles et orientations).
* **`schemas/`** : Schéma XML et binaires compilés GSettings (`org.gnome.shell.extensions.dock.gschema.xml`).
* **`config_dock.sh`** : Script interactif de configuration rapide en console.
* **`lauch_dev.sh`** : Script pour lancer l'environnement de test Mutter/Wayland isolé.
* **`agent.md`** : Guide complet d'architecture et de règles de développement pour agents d'IA.
* **`GNOME_SETTINGS_INTEGRATION.md`** : Référence synthétique des clés GSettings pour l'intégration système.

---

## Licence

Ce projet est distribué sous licence **GPL-2.0-or-later**.
