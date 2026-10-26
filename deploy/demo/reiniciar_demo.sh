#!/bin/bash
# Deja la demostración como nueva: borra la base cellmin_demo, carga los datos
# de prueba (una semana de historia y hoy sin cajas abiertas) y reinicia la API.
# Uso (en el servidor):  bash /opt/cellmin/deploy/demo/reiniciar_demo.sh CLAVE
# CLAVE es la contraseña de todos los usuarios de prueba (mínimo 8 caracteres).
# Correrlo la mañana de la defensa, y después de cada ensayo.
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Uso: bash $0 CLAVE_DE_LOS_USUARIOS_DE_PRUEBA"; exit 1
fi
if [ ! -f /opt/cellmin/demo.env ]; then
  echo "Falta /opt/cellmin/demo.env (ver DEMO.md)"; exit 1
fi

echo "==> Cargando los datos de prueba en la base de la demo"
cd /opt/cellmin/backend
sudo -u cellmin bash -c 'set -a; . /opt/cellmin/demo.env; set +a; export LOG_DIR=/opt/cellmin/logs-demo; exec venv/bin/python cargar_datos_demo.py --clave "$0"' "$1"

echo "==> Reiniciando la API de la demo"
sudo systemctl restart cellmin-demo-backend
sleep 2
sudo systemctl is-active cellmin-demo-backend
echo "Listo: https://demo.cellmin.jybora.com"
