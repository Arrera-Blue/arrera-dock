# Arrera Dock

Dock moderne et dynamique pour l'environnement de bureau **GNOME Shell**, conçu spécialement pour la distribution **Arrera Blue Linux**.

Il remplace le dash natif de l'aperçu par une pilule flottante au design soigné inspiré de **Material 3 Expressive** et d'**Android 16 QPR2**.

---

## Fonctionnalités

* **Disposition adaptative** : Positionnement au choix en bas (horizontal), à gauche ou à droite de l'écran (vertical).
* **Effet de vague dynamique** : Agrandissement fluide des icônes au survol du curseur.
* **Masquage automatique intelligent (Autohide)** : Rentre et sort avec une bande d'activation au bord de l'écran.
* **Harmonie des couleurs** : S'accorde automatiquement avec les 9 couleurs d'accentuation officielles de GNOME.
* **Modes de thème** :
  * *Expressif* : Surface de couleur teintée selon l'accentuation active.
  * *Contour noir* : Fond noir profond avec liseré contrasté de couleur d'accentuation.
* **Lanceur d'applications intégré** : Panneau flottant avec recherche en temps réel et catégories.
* **Gestion des favoris par clic droit** : Épingler ou détacher n'importe quelle application depuis le lanceur ou directement sur le dock.
* **Intégration GNOME Settings** : Configuration directe via `gnome-control-center` et le schéma GSettings `org.gnome.shell.extensions.dock`.

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

## Développement et contribution

### Prérequis

Pour développer et tester l'extension dans un environnement isolé sans impacter votre session de bureau principale :

* **GNOME Shell** (version 45 à 50)
* **glib2-devel** (pour compiler les schémas avec `glib-compile-schemas`)
* **mutter-devkit** (ou `mutter-dev-bin` selon votre distribution Linux, pour la session imbriquée devkit)
* **dbus-daemon** (fournit `dbus-run-session`)
* **python3-gobject**

### Cloner le projet

Clonez le dépôt dans votre dossier de travail :

```bash
git clone https://github.com/Arrera-linux/arrera-dock.git
cd arrera-dock
```

### Lancer la session de test (mode développement)

Pour lancer une session GNOME Shell imbriquée (nested devkit) avec **Arrera Dock** directement activé :

```bash
./lauch_dev.sh
```

Ce script prend en charge automatiquement :
1. **Le lien symbolique** : S'assure que le dossier de l'extension est lié dans `~/.local/share/gnome-shell/extensions/dock@linux.arrera-software.fr`.
2. **La compilation des schémas** : Compile les clés GSettings de `schemas/`.
3. **La configuration GSettings** : Active les extensions utilisateur et nettoie la liste des extensions désactivées.
4. **L'isolation D-Bus** : Démarre une session D-Bus dédiée avec `gnome-shell --devkit` et active automatiquement Arrera Dock dès que le shell est prêt.

### Débogage et rechargement

* **Logs en direct** : Les messages et erreurs (`console.log`, `console.error`) s'affichent directement dans le terminal où `./lauch_dev.sh` est exécuté.
* **Recharger les modifications** : Fermez la fenêtre de test (ou appuyez sur `Ctrl+C` dans le terminal), puis relancez `./lauch_dev.sh` pour tester votre nouveau code.
* **Looking Glass** : Vous pouvez ouvrir l'inspecteur Looking Glass dans la fenêtre de test en appuyant sur `Alt + F2`, puis en tapant `lg` et Entrée.

### Structure du projet

* **`dock.js`** : Cœur du dock (disposition adaptative, icônes, animations de vague, autohide intelligent, mode barre plein écran et info-bulles).
* **`extension.js`** : Point d'entrée de l'extension (`enable()` et `disable()`), intégration avec les couches GNOME Shell et l'aperçu des activités.
* **`appLauncher.js`** : Lanceur d'applications flottant avec recherche et catégories.
* **`stylesheet.css`** : Styles visuels, thèmes (Expressif, Contour noir) et harmonie des 9 couleurs d'accentuation GNOME.
* **`schemas/`** : Schéma GSettings de configuration (`org.gnome.shell.extensions.dock.gschema.xml`).
* **`icons/`** : Icônes graphiques et symboliques de l'extension.
* **`lauch_dev.sh`** : Script d'automatisation pour lancer l'environnement de dev.

---

## Licence

Ce projet est distribué sous licence **GPL-2.0-or-later**.
