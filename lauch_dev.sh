#!/bin/bash
# Recompiler les schémas GSettings locaux
glib-compile-schemas schemas/

# S'assurer que l'extension est activée dans la liste des extensions
gsettings set org.gnome.shell enabled-extensions "['dock@linux.arrera-software.fr']"

# Lancer la session de test GNOME Shell
dbus-run-session -- gnome-shell --devkit