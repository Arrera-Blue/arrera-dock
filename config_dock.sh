#!/bin/bash
# ==============================================================================
# config_dock.sh - Script de configuration interactif pour Arrera Dock
# Permet de modifier les options GSettings sans passer par GNOME Control Center.
# ==============================================================================

SCHEMA="org.gnome.shell.extensions.dock"

# S'assurer que les schémas locaux sont bien compilés si exécuté depuis le repo
if [ -d "schemas" ]; then
    glib-compile-schemas schemas/ 2>/dev/null
fi

while true; do
    clear
    # Récupération des valeurs actuelles
    AUTOHIDE=$(gsettings get $SCHEMA autohide 2>/dev/null || echo "false")
    EXTEND_MAX=$(gsettings get $SCHEMA extend-on-maximize 2>/dev/null || echo "true")
    ALWAYS_BAR=$(gsettings get $SCHEMA always-bar-mode 2>/dev/null || echo "false")
    ALIGN=$(gsettings get $SCHEMA bar-icons-alignment 2>/dev/null | tr -d "'" || echo "center")
    SIZE=$(gsettings get $SCHEMA icon-size 2>/dev/null | tr -d "'" || echo "medium")
    THEME=$(gsettings get $SCHEMA theme-mode 2>/dev/null | tr -d "'" || echo "expressive")
    POS=$(gsettings get $SCHEMA position 2>/dev/null | tr -d "'" || echo "bottom")
    SHOW_QS=$(gsettings get $SCHEMA show-quick-settings 2>/dev/null || echo "false")
    SHOW_DATE=$(gsettings get $SCHEMA show-date-menu 2>/dev/null || echo "false")
    SHOW_ACT=$(gsettings get $SCHEMA show-activities-button 2>/dev/null || echo "false")
    CLOCK_POS=$(gsettings get $SCHEMA clock-position 2>/dev/null | tr -d "'" || echo "bottom")

    echo "=========================================================="
    echo "            Arrera Dock - Configuration Rapide            "
    echo "=========================================================="
    echo " 1) Masquage automatique (autohide)       : $AUTOHIDE"
    echo " 2) Mode barre si maximisé (extend)       : $EXTEND_MAX"
    echo " 3) Mode barre permanent (always-bar)     : $ALWAYS_BAR"
    echo " 4) Alignement icônes en barre (align)    : $ALIGN"
    echo " 5) Taille des icônes (icon-size)         : $SIZE"
    echo " 6) Style visuel du thème (theme-mode)    : $THEME"
    echo " 7) Position sur l'écran (position)        : $POS"
    echo " 8) Paramètres rapides (quick-settings)   : $SHOW_QS"
    echo " 9) Date et horloge (date-menu)           : $SHOW_DATE"
    echo "10) Bouton Activités (activities-button)  : $SHOW_ACT"
    echo "11) Position horloge (clock-position)     : $CLOCK_POS"
    echo "----------------------------------------------------------"
    echo " r) Réinitialiser toutes les options par défaut"
    echo " q) Quitter"
    echo "=========================================================="
    read -p " Choisissez une option [1-11, r, q] : " CHOIX

    case "$CHOIX" in
        1)
            if [ "$AUTOHIDE" = "true" ]; then
                gsettings set $SCHEMA autohide false
            else
                gsettings set $SCHEMA autohide true
            fi
            ;;
        2)
            if [ "$EXTEND_MAX" = "true" ]; then
                gsettings set $SCHEMA extend-on-maximize false
            else
                gsettings set $SCHEMA extend-on-maximize true
            fi
            ;;
        3)
            if [ "$ALWAYS_BAR" = "true" ]; then
                gsettings set $SCHEMA always-bar-mode false
            else
                gsettings set $SCHEMA always-bar-mode true
            fi
            ;;
        4)
            echo ""
            echo " Alignement des icônes en mode barre :"
            echo "   1) Centré (center)"
            echo "   2) À gauche (left)"
            read -p " Choix [1-2] : " ALIGN_CHOIX
            case "$ALIGN_CHOIX" in
                1) gsettings set $SCHEMA bar-icons-alignment "center" ;;
                2) gsettings set $SCHEMA bar-icons-alignment "left" ;;
            esac
            ;;
        5)
            echo ""
            echo " Taille des icônes :"
            echo "   1) Petit / 28px (small)"
            echo "   2) Moyen / 36px (medium)"
            echo "   3) Grand / 48px (large)"
            read -p " Choix [1-3] : " SIZE_CHOIX
            case "$SIZE_CHOIX" in
                1) gsettings set $SCHEMA icon-size "small" ;;
                2) gsettings set $SCHEMA icon-size "medium" ;;
                3) gsettings set $SCHEMA icon-size "large" ;;
            esac
            ;;
        6)
            echo ""
            echo " Thème visuel :"
            echo "   1) Expressif / Tonal (expressive)"
            echo "   2) Noir avec contour couleur (black-outline)"
            echo "   3) Vanilla GNOME / Dash standard (vanilla-gnome)"
            read -p " Choix [1-3] : " THEME_CHOIX
            case "$THEME_CHOIX" in
                1) gsettings set $SCHEMA theme-mode "expressive" ;;
                2) gsettings set $SCHEMA theme-mode "black-outline" ;;
                3) gsettings set $SCHEMA theme-mode "vanilla-gnome" ;;
            esac
            ;;
        7)
            echo ""
            echo " Position du dock :"
            echo "   1) En bas (bottom)"
            echo "   2) À gauche (left)"
            echo "   3) À droite (right)"
            read -p " Choix [1-3] : " POS_CHOIX
            case "$POS_CHOIX" in
                1) gsettings set $SCHEMA position "bottom" ;;
                2) gsettings set $SCHEMA position "left" ;;
                3) gsettings set $SCHEMA position "right" ;;
            esac
            ;;
        8)
            if [ "$SHOW_QS" = "true" ]; then
                gsettings set $SCHEMA show-quick-settings false
            else
                gsettings set $SCHEMA show-quick-settings true
            fi
            ;;
        9)
            if [ "$SHOW_DATE" = "true" ]; then
                gsettings set $SCHEMA show-date-menu false
            else
                gsettings set $SCHEMA show-date-menu true
            fi
            ;;
        10)
            if [ "$SHOW_ACT" = "true" ]; then
                gsettings set $SCHEMA show-activities-button false
            else
                gsettings set $SCHEMA show-activities-button true
            fi
            ;;
        11)
            echo ""
            echo " Emplacement de l'horloge :"
            echo "   1) En haut / sous le logo (top)"
            echo "   2) Entre le logo et les apps (between-logo-and-apps)"
            echo "   3) En bas / fin de dock (bottom)"
            read -p " Choix [1-3] : " CPOS_CHOIX
            case "$CPOS_CHOIX" in
                1) gsettings set $SCHEMA clock-position "top" ;;
                2) gsettings set $SCHEMA clock-position "between-logo-and-apps" ;;
                3) gsettings set $SCHEMA clock-position "bottom" ;;
            esac
            ;;
        r|R)
            echo ""
            read -p " Confirmer la réinitialisation par défaut ? [o/N] : " CONFIRM
            if [[ "$CONFIRM" =~ ^[oOyY]$ ]]; then
                gsettings reset $SCHEMA autohide
                gsettings reset $SCHEMA extend-on-maximize
                gsettings reset $SCHEMA always-bar-mode
                gsettings reset $SCHEMA bar-icons-alignment
                gsettings reset $SCHEMA icon-size
                gsettings reset $SCHEMA theme-mode
                gsettings reset $SCHEMA position
                gsettings reset $SCHEMA show-quick-settings
                gsettings reset $SCHEMA show-date-menu
                gsettings reset $SCHEMA show-activities-button
                gsettings reset $SCHEMA clock-position
                echo " Paramètres réinitialisés !"
                sleep 1
            fi
            ;;
        q|Q)
            echo " Au revoir !"
            break
            ;;
        *)
            echo " Choix invalide !"
            sleep 1
            ;;
    esac
done
