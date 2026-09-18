#!/bin/bash
# Recompiler les schémas GSettings locaux
glib-compile-schemas schemas/
# Enregistrer et compiler le schéma pour gnome-control-center
mkdir -p "$HOME/.local/share/glib-2.0/schemas"
cp -u schemas/org.gnome.shell.extensions.dock.gschema.xml "$HOME/.local/share/glib-2.0/schemas/"
glib-compile-schemas "$HOME/.local/share/glib-2.0/schemas"

# S'assurer que l'extension est activée dans la liste des extensions
gsettings set org.gnome.shell enabled-extensions "['dock@linux.arrera-software.fr']"

# Lancer la session de test GNOME Shell
dbus-run-session -- gnome-shell --devkit