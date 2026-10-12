#!/bin/bash
# Actualiza el sistema en el servidor con la última versión de GitHub.
# Uso (como usuario con sudo, en el servidor):  bash /opt/cellmin/deploy/actualizar.sh
set -euo pipefail

cd /opt/cellmin
echo "==> Bajando cambios de GitHub"
sudo -u cellmin git pull --ff-only

echo "==> Backend: dependencias"
sudo -u cellmin /opt/cellmin/backend/venv/bin/pip install -q -r backend/requirements.txt

echo "==> Frontend: compilando"
cd /opt/cellmin/frontend
sudo -u cellmin npm ci --no-audit --no-fund
sudo -u cellmin npm run build
sudo rsync -a --delete dist/ /var/www/cellmin/

echo "==> Reiniciando el backend"
sudo systemctl restart cellmin-backend
sleep 2
sudo systemctl is-active cellmin-backend
echo "Listo."
