#!/bin/bash
# Deja el sistema del local en cero (quedan usuarios, configuración, marcas y
# categorías). Hace un respaldo antes y pide confirmación. Ver backend/limpiar_sistema.py
# Uso (en el servidor):  bash /opt/cellmin/deploy/limpiar_sistema.sh
set -euo pipefail
cd /opt/cellmin/backend
sudo -u cellmin env RESPALDO_DIR=/var/backups/cellmin venv/bin/python limpiar_sistema.py
