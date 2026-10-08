# TODO - Arrera Dock

Liste des fonctionnalités manquantes pour permettre la réalisation des 3 designs de bureau :
- **Design 1** : Bureau moderne (Top Bar en haut + Dock flottant bleu au centre en bas)
- **Design 2** : Barre unique inférieure (Top Bar masquée + Dock pleine largeur en bas)
- **Design 3** : Barre latérale droite (Top Bar masquée + Dock vertical à droite avec tuiles)

---

## 1. Agencement & Ordre des éléments (Crucial pour le Design 3)
- [x] **Ordre personnalisable des éléments dans le dock (`_dockPill`)** :
  - Permettre de modifier l'ordre des éléments dans la pilule (actuellement figé dans `dock.js` : Logo -> Show Apps -> Applications -> Horloge/Status).
  - Supporter l'ordre du Design 3 : **Logo Arrera -> Horloge -> Show Apps -> Applications**.
- [x] **Clé GSettings pour la position de l'horloge** :
  - Ajouter une option `clock-position` avec les choix : `'top'` (en haut sous le logo), `'between-logo-and-apps'`, `'bottom'` (après les apps).

---

## 2. Widget Horloge compacte pour dock vertical (Pour le Design 3)
- [x] **Widget Horloge verticale dédiée ("HH : MM")** :
  - Créer un widget horloge compact au format tuile (évitant le débordement horizontal du `dateMenu` natif de GNOME sur un dock vertical étroit).
  - Affichage textuel compact (ex. `HH : MM` sur deux lignes ou taille réduite).
- [x] **Gestion du clic sur l'horloge** :
  - Ouvrir le menu du calendrier GNOME sans casser la géométrie verticale du dock.

---

## 3. Formatage de la Date et du Statut (Pour le Design 2)
- [x] **Format de date personnalisé dans le dock** :
  - Ajouter une option permettant d'afficher la date au format complet en majuscules textuelles (ex. `DAY MONTH YEAR` / `MERCREDI 7 OCTOBRE`).
- [x] **Organisation de la zone droite en mode barre** :
  - Placer la date à gauche du groupe des paramètres rapides avec un espacement propre.
  - Encapsuler les paramètres rapides dans un style de pilule grise distincte (comme sur la maquette).

---

## 4. Style visuel en « Tuiles sombres » (Squircle) (Designs 1, 2 et 3)
- [x] **Arrière-plan permanent pour les icônes d'applications** :
  - Ajouter une option de style donnant à chaque icône un fond de tuile sombre arrondi (carré aux coins arrondis / squircle sombre permanent).
- [x] **Harmonisation des boutons de contrôle** :
  - Appliquer ce même conteneur sombre au logo Arrera, au bouton Show Apps et à l'horloge.

---

## 5. Mode « Tuiles détachées / Fond transparent » (Island Mode) (Pour le Design 3)
- [x] **Conteneur transparent pour dock vertical** :
  - Option permettant de rendre le fond du dock (`.arrera-dock`) 100 % transparent (sans bordure ni ombre globale), afin que seules les tuiles individuelles flottent sur le bord droit de l'écran.
- [x] **Alignement vertical pour dock latéral (Haut à droite / Haut à gauche)** :
  - Option `vertical-alignment` (`top`, `center`, `bottom`) pour positionner les tuiles détachées en haut ou au centre de l'écran.
- [x] **Tuile carrée dédiée pour les Paramètres Rapides (`DockQuickSettingsTile`)** :
  - Évite la tour d'indicateurs verticaux étirés et les débordements sur dock vertical.
  - Offre une tuile carrée compacte et uniforme avec icône système, infobulle et ouverture directe du menu Quick Settings.

---
