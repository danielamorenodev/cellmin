# Despliegue de Cellmin en el VPS (cellmin.jybora.com)

Guía paso a paso para un VPS de Hostinger con **Ubuntu 22.04 o 24.04**.
Los comandos van en bloques: se copian y pegan **uno por uno** en la terminal del servidor.

Cómo queda armado:

```
Navegador ──HTTPS──> nginx ──┬─> /          sitio (React ya compilado, /var/www/cellmin)
                             └─> /api/...   backend (uvicorn, solo en 127.0.0.1:8002)
                                                └─> MongoDB Atlas (base cellmin_prod)
```

## 0. Antes de empezar

- **IP del VPS** y acceso por SSH como `root` (hPanel de Hostinger → VPS → Panel).
- **DNS:** un registro **A** de `cellmin.jybora.com` apuntando a la IP del VPS (en la zona DNS de `jybora.com`). Puede tardar un rato en propagarse; se comprueba con `nslookup cellmin.jybora.com`.
- **Firewall de Hostinger** (hPanel → VPS → Seguridad): tienen que estar abiertos los puertos 22, 80 y 443.
- Cuenta de **MongoDB Atlas**.

> **Servidor compartido:** si el VPS ya aloja otros sistemas, Cellmin usa el puerto interno **8002** (el 8000 y el 8001 pueden estar ocupados por otras apps), su propio archivo de nginx, y no se borra el sitio `default` ni se toca `ufw` si ya está activo. Antes de empezar: `ss -tlnp` para ver puertos ocupados.

## 1. Seguridad previa (hacerlo ANTES de publicar)

### 1.1 MongoDB Atlas
1. *Database Access* → **Add New Database User**: usuario `cellmin_prod`, contraseña larga generada (guardala en un gestor de contraseñas), permiso **Read and write to a specific database → `cellmin_prod`**.
2. Borrá el usuario de desarrollo anterior (`admin_ventas`): su contraseña apareció en conversaciones y capturas, hay que darla por comprometida.
3. *Network Access*: agregá la **IP del VPS**. No dejes `0.0.0.0/0` (acceso desde cualquier lado).
4. *Connect → Drivers*: copiá la cadena de conexión (`mongodb+srv://...`) y reemplazá usuario y contraseña. La vas a usar en el paso 4.

### 1.2 GitHub
- Recomendado: **repositorio privado** (Settings → General → Danger Zone → Change visibility). En el historial del repo no hay contraseñas ni claves (se revisó), pero un sistema de un negocio no tiene por qué ser público.
- Si queda privado, el servidor necesita una *deploy key* (paso 3.1). Si queda público, se clona directo.

## 2. Preparar el servidor

Conectate: `ssh root@IP_DEL_VPS`

```bash
apt update && apt upgrade -y
apt install -y nginx git rsync curl ufw python3-venv python3-pip certbot python3-certbot-nginx
```

Node.js 20 (para compilar el sitio):

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node -v
```

Firewall del servidor (deja SSH, HTTP y HTTPS):

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
```

Usuario para administrar (no trabajar siempre como root):

```bash
adduser deploy
usermod -aG sudo deploy
```

Usuario que ejecuta el sistema (sin contraseña, no inicia sesión):

```bash
adduser --system --group --home /opt/cellmin --shell /bin/bash cellmin
```

A partir de acá podés seguir como `deploy` (`ssh deploy@IP_DEL_VPS`) y anteponer `sudo` donde haga falta.

## 3. Bajar el código

### 3.1 Si el repo es privado: deploy key
```bash
sudo -u cellmin ssh-keygen -t ed25519 -N "" -f /opt/cellmin/.ssh_deploy_key
sudo cat /opt/cellmin/.ssh_deploy_key.pub
```
Copiá esa línea en GitHub → repositorio → Settings → **Deploy keys** → Add (solo lectura). Después:

```bash
sudo -u cellmin git config --global core.sshCommand "ssh -i /opt/cellmin/.ssh_deploy_key -o StrictHostKeyChecking=accept-new"
sudo -u cellmin git clone git@github.com:danielamorenodev/cellmin.git /opt/cellmin/app_tmp
```

### 3.2 Si el repo es público
```bash
sudo -u cellmin git clone https://github.com/danielamorenodev/cellmin.git /opt/cellmin/app_tmp
```

Dejar el código directo en `/opt/cellmin`:

```bash
sudo -u cellmin bash -c "shopt -s dotglob && mv /opt/cellmin/app_tmp/* /opt/cellmin/ && rmdir /opt/cellmin/app_tmp"
ls /opt/cellmin
```
(Tienen que verse `backend`, `frontend`, `deploy`.)

## 4. Backend

```bash
cd /opt/cellmin/backend
sudo -u cellmin python3 -m venv venv
sudo -u cellmin ./venv/bin/pip install -r requirements.txt
sudo -u cellmin mkdir -p logs
```

Archivo de configuración:

```bash
sudo -u cellmin cp .env.example .env
sudo -u cellmin nano .env
```

Completá `MONGODB_URL` (paso 1.1) y `SECRET_KEY`. Para generar la clave:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(48))"
```

Cuidá que `ENTORNO=produccion` y `CORS_ORIGINS=https://cellmin.jybora.com`. Guardá (Ctrl+O, Enter, Ctrl+X) y protegé el archivo:

```bash
sudo chmod 600 /opt/cellmin/backend/.env
```

### Crear el primer administrador
```bash
cd /opt/cellmin/backend
sudo -u cellmin ./venv/bin/python crear_admin.py
```
Te pide nombre, email y contraseña (mínimo 8). Los demás usuarios se crean después desde el sistema.

### Servicio
```bash
sudo cp /opt/cellmin/deploy/cellmin-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now cellmin-backend
sudo systemctl status cellmin-backend --no-pager
curl http://127.0.0.1:8002/
```
Tiene que responder `{"message":"Sistema de Ventas API funcionando ✅"}`. Si falla: `sudo journalctl -u cellmin-backend -n 50 --no-pager`.

## 5. Sitio (frontend)

```bash
cd /opt/cellmin/frontend
sudo -u cellmin npm ci
sudo -u cellmin npm run build
sudo mkdir -p /var/www/cellmin
sudo rsync -a --delete dist/ /var/www/cellmin/
```
(Si el servidor tiene poca memoria y `npm run build` se corta, compilalo en tu PC con `npm run build` y subí la carpeta `dist` con WinSCP a `/var/www/cellmin`.)

## 6. nginx

```bash
sudo cp /opt/cellmin/deploy/nginx-cellmin.conf /etc/nginx/sites-available/cellmin
sudo ln -s /etc/nginx/sites-available/cellmin /etc/nginx/sites-enabled/cellmin
# (en un servidor nuevo y vacío podés borrar el sitio default; en uno compartido NO lo borres)
sudo nginx -t && sudo systemctl reload nginx
```
Probá `http://cellmin.jybora.com` (todavía sin candado).

## 7. HTTPS (Let's Encrypt)

```bash
sudo certbot --nginx -d cellmin.jybora.com
```
Aceptá la redirección de HTTP a HTTPS. Comprobá la renovación automática:

```bash
sudo certbot renew --dry-run
```

## 8. Prueba final (checklist)

- [ ] `https://cellmin.jybora.com` abre con candado y muestra el login.
- [ ] Iniciás sesión con el administrador creado.
- [ ] Sección **Dólar**: cargás el valor y aparece en la barra superior.
- [ ] Creás un usuario cajero y uno de depósito; entrás con cada uno.
- [ ] Cargás un producto, abrís caja, hacés una venta, imprimís el ticket.
- [ ] Recargás la página en una ruta interna (ej. `/ventas`): no da 404.
- [ ] `https://cellmin.jybora.com/docs` da 404 (la documentación de la API no se publica).
- [ ] Desde la PC, `http://cellmin.jybora.com:8002` no responde (el backend no está expuesto).

## 9. Actualizar el sistema más adelante

Cada vez que subas cambios a GitHub:

```bash
bash /opt/cellmin/deploy/actualizar.sh
```
Baja el código, instala dependencias, recompila el sitio y reinicia el backend.

## 10. Copias de seguridad

El plan gratuito de Atlas (M0) **no incluye copias automáticas**, así que el servidor hace las suyas: todos los días a las 3:30 guarda la base completa en `/var/backups/cellmin` y conserva los últimos 14 días. Los archivos tienen datos personales y solo los puede leer el usuario `cellmin`.

### 10.1 Activar el respaldo diario (una sola vez)

```bash
sudo install -d -o cellmin -g cellmin -m 700 /var/backups/cellmin
sudo cp /opt/cellmin/deploy/cellmin-respaldo.service /opt/cellmin/deploy/cellmin-respaldo.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now cellmin-respaldo.timer
```

Probarlo en el momento, sin esperar a la noche:

```bash
sudo systemctl start cellmin-respaldo.service
sudo journalctl -u cellmin-respaldo -n 5 --no-pager
sudo ls -lh /var/backups/cellmin
```

Tiene que aparecer `Respaldo creado: ...` y un archivo `cellmin_AAAA-MM-DD_HHMM.json.gz`. Para ver cuándo es el próximo: `systemctl list-timers cellmin-respaldo.timer`.

### 10.2 Comprobar que un respaldo sirve (una vez por mes)

Un respaldo que nunca se probó no es un respaldo. Esto lo restaura en una base aparte (`cellmin_restaurado`), sin tocar la base en uso:

```bash
cd /opt/cellmin/backend
sudo -u cellmin venv/bin/python restaurar_respaldo.py /var/backups/cellmin/ARCHIVO.json.gz
```

Muestra cuántos documentos restauró por colección. Después, borrá la base `cellmin_restaurado` desde Atlas (*Browse Collections*).

Para recuperar de verdad la base en uso (solo ante una pérdida de datos): detené el backend (`sudo systemctl stop cellmin-backend`), corré el mismo comando con `--base cellmin_prod --reemplazar` (pide escribir el nombre de la base para confirmar) y volvé a iniciarlo.

### 10.3 Copia fuera del servidor

Si se pierde el VPS, se pierden también sus respaldos. Por eso:

- En el panel de Hostinger, verificá que estén activas las **copias semanales del VPS** (*VPS → Backups*).
- Una vez por semana, el administrador descarga la copia completa desde **Reportes → Descargar respaldo** y la guarda en una carpeta privada (por ejemplo, Google Drive del dueño).

## 10 bis. Registros del sistema

En `/opt/cellmin/backend/logs` (rotan solos a los 5 MB y guardan 10 copias; nunca guardan contraseñas, tokens ni códigos de bloqueo):

| Archivo | Qué registra |
|---|---|
| `actividad.log` | Quién hizo qué: inicios de sesión, ventas, cancelaciones, cajas, compras, reparaciones, usuarios, valor del dólar, movimientos y ajustes de stock, y cambios de precio |
| `accesos.log` | Cada pedido a la API, con su resultado y cuánto tardó |
| `errores.log` | Errores no previstos, con el detalle para corregirlos |

Ejemplo: ver los últimos ajustes de stock con `grep "modulo=stock" /opt/cellmin/backend/logs/actividad.log | tail -n 20`.

## 11. Si algo falla

| Síntoma | Qué mirar |
|---|---|
| El sitio no abre | `sudo systemctl status nginx` y `sudo tail -n 50 /var/log/nginx/error.log` |
| El sitio abre pero el login da error de red / 502 | `sudo systemctl status cellmin-backend` y `sudo journalctl -u cellmin-backend -n 50 --no-pager` |
| El backend no arranca por la base | Revisá `MONGODB_URL`, la contraseña y que la IP del VPS esté en *Network Access* de Atlas |
| El backend dice que `SECRET_KEY` es corta | Usá una de 32 caracteres o más (paso 4) |
| `certbot` falla | El DNS todavía no apunta al VPS (`nslookup cellmin.jybora.com`) o el puerto 80 está cerrado |
| Error 500 en alguna pantalla | `sudo tail -n 50 /opt/cellmin/backend/logs/errores.log` |
| No se generó el respaldo de la noche | `sudo journalctl -u cellmin-respaldo -n 20 --no-pager` |

## Resumen de seguridad ya aplicado en el código

- La clave secreta y la conexión a la base viven solo en el `.env` del servidor (nunca en GitHub).
- En producción se exige una clave de 32+ caracteres y se oculta la documentación `/docs`.
- El acceso desde navegador (CORS) se limita al dominio real.
- El backend escucha solo en `127.0.0.1`; todo entra por nginx con HTTPS.
- Se eliminó el script que vaciaba las colecciones de la base.
