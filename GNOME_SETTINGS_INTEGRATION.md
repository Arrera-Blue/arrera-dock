# Configuration GSettings - Arrera Dock

* **Schéma** : `org.gnome.shell.extensions.dock`
* **Chemin** : `/org/gnome/shell/extensions/dock/`

---

### `autohide` (booléen)
* **Description** : Masque automatiquement le dock quand il n'est pas survolé ou quand une fenêtre le chevauche.
* **Valeurs possibles** :
  * `false` *(défaut)* : Dock toujours visible.
  * `true` : Dock masqué automatiquement.

---

### `extend-on-maximize` (booléen)
* **Description** : Transforme le dock en barre pleine largeur (ou pleine hauteur) si une fenêtre est maximisée ou en plein écran.
* **Valeurs possibles** :
  * `true` *(défaut)* : S'étend en barre si une fenêtre est maximisée.
  * `false` : Reste en pilule flottante.

---

### `always-bar-mode` (booléen)
* **Description** : Force le dock à rester en mode barre pleine largeur (ou pleine hauteur) en permanence.
* **Valeurs possibles** :
  * `false` *(défaut)* : Mode pilule flottante.
  * `true` : Mode barre permanent.

---

### `bar-icons-alignment` (chaîne)
* **Description** : Position des icônes lorsque le dock est en mode barre.
* **Valeurs possibles** :
  * `'center'` *(défaut)* : Icônes centrées.
  * `'left'` : Icônes alignées à gauche (ou en haut si vertical).

---

### `icon-size` (chaîne)
* **Description** : Taille des icônes d'application dans le dock.
* **Valeurs possibles** :
  * `'small'` : Petit (icônes 28px).
  * `'medium'` *(défaut)* : Moyen (icônes 36px).
  * `'large'` : Grand (icônes 48px).

---

### `theme-mode` (chaîne)
* **Description** : Style visuel et couleur du dock.
* **Valeurs possibles** :
  * `'expressive'` *(défaut)* : Fond teinté selon la couleur d'accentuation active de GNOME (Material 3 Expressive).
  * `'black-outline'` : Fond noir profond avec bordure de la couleur d'accentuation.
  * `'vanilla-gnome'` : Fond gris sombre (`#38383b`) sans bordure, identique au dock natif GNOME.

---

### `position` (chaîne)
* **Description** : Position du dock sur l'écran.
* **Valeurs possibles** :
  * `'bottom'` *(défaut)* : En bas de l'écran (horizontal).
  * `'left'` : À gauche de l'écran (vertical).
  * `'right'` : À droite de l'écran (vertical).

---

### `show-quick-settings` (booléen)
* **Description** : Intègre les paramètres rapides (Wi-Fi, volume, batterie, etc.) directement dans le dock.
* **Valeurs possibles** :
  * `false` *(défaut)* : Reste dans la barre supérieure.
  * `true` : Déplacé dans le dock.

---

### `show-date-menu` (booléen)
* **Description** : Intègre la date, l'horloge et le calendrier directement dans le dock.
* **Valeurs possibles** :
  * `false` *(défaut)* : Reste dans la barre supérieure.
  * `true` : Déplacé dans le dock.

---

### `show-activities-button` (booléen)
* **Description** : Intègre le bouton Activités (avec le logo Arrera) directement dans le dock et masque le bouton « Activités » de la barre supérieure.
* **Valeurs possibles** :
  * `false` *(défaut)* : Bouton Activités conservé dans la barre supérieure.
  * `true` : Bouton Activités présent dans le dock avec le logo Arrera.
