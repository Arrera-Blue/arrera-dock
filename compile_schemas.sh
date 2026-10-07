#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCHEMAS_DIR="${SCRIPT_DIR}/schemas"
XML_FILE="${SCHEMAS_DIR}/org.gnome.shell.extensions.dock.gschema.xml"
USER_GLIB_DIR="${HOME}/.local/share/glib-2.0/schemas"

if [ ! -d "${SCHEMAS_DIR}" ]; then
    echo "❌ Erreur : Dossier 'schemas/' introuvable dans ${SCRIPT_DIR}"
    exit 1
fi

echo "==> Compilation des schémas locaux dans ${SCHEMAS_DIR}..."
glib-compile-schemas "${SCHEMAS_DIR}"

if [ -f "${XML_FILE}" ]; then
    echo "==> Enregistrement dans ${USER_GLIB_DIR} pour 'gsettings'..."
    mkdir -p "${USER_GLIB_DIR}"
    cp "${XML_FILE}" "${USER_GLIB_DIR}/"
    glib-compile-schemas "${USER_GLIB_DIR}"
fi

echo "✅ Schémas GSettings compilés avec succès !"