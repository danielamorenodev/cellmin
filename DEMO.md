# Demostración de Cellmin Gestión

La demostración usa **el mismo código** que el sistema del local, pero con **otra base de datos, otros usuarios y datos inventados**. Así nunca se muestran datos de clientes reales (Ley 25.326) y los ensayos no tocan las ventas ni la caja del negocio.

| | Sistema del local | Demostración |
|---|---|---|
| Dirección | https://cellmin.jybora.com | https://demo.cellmin.jybora.com |
| Base de datos | `cellmin_prod` | `cellmin_demo` |
| Usuario de Atlas | el del local | uno propio, solo con permiso sobre `cellmin_demo` |
| API | puerto 8002 | puerto 8003 |
| Configuración | `/opt/cellmin/backend/.env` | `/opt/cellmin/demo.env` |
| Registros | `/opt/cellmin/backend/logs` | `/opt/cellmin/logs-demo` |

Hay tres planes para el día de la defensa:

1. **Principal:** la demo publicada en https://demo.cellmin.jybora.com.
2. **Plan B:** la misma demo corriendo en la computadora de la defensa (localhost), sin internet.
3. **Plan C:** el video de respaldo de 2 a 3 minutos.

---

## 1. Datos de prueba

`backend/cargar_datos_demo.py` **borra** la base y la carga de nuevo con una semana de historia inventada: productos (celulares con IMEI, fundas con variantes y accesorios), dos proveedores, compras, ventas en las dos sucursales (algunas en dólares), cajas abiertas y cerradas, reparaciones en distintos estados y cambios del valor del dólar. **Hoy no queda ninguna caja abierta**, para que la demo empiece abriendo la caja.

Por seguridad, solo corre si el nombre de la base contiene `demo`. Contra la base del local no funciona.

Usuarios que crea (todos con la misma contraseña, la que se indica al correrlo):

| Rol | Usuario | Nombre |
|---|---|---|
| Administrador | admin@cellmin-demo.com | Marcela Ríos |
| Cajero (Sucursal 1) | cajero1@cellmin-demo.com | Julián Pérez |
| Cajero (Sucursal 2) | cajero2@cellmin-demo.com | Sofía Gómez |
| Vendedor (Sucursal 1) | vendedor@cellmin-demo.com | Tomás Díaz |
| Técnico | tecnico@cellmin-demo.com | Nicolás Herrera |
| Depósito | deposito@cellmin-demo.com | Paula Ruiz |

IMEI de prueba válidos para escanear o tipear en una venta: `490154203237518`, `356938035643809`.

**Importante:** como hay una sola caja por sucursal por día, después de cada ensayo hay que volver a cargar los datos. La mañana de la defensa se cargan una última vez.

---

## 2. Demo publicada (una sola vez)

### 2.1 Base de datos en Atlas

1. En MongoDB Atlas, entrá a **Database Access → Add New Database User**.
2. Usuario `cellmin_demo`, con una contraseña generada por Atlas.
3. En **Database User Privileges**, elegí **Specific Privileges** → rol `readWrite` sobre la base `cellmin_demo`, y nada más.
4. La IP del VPS ya está habilitada en **Network Access** (es la misma que usa el sistema del local).

### 2.2 Dirección `demo.cellmin.jybora.com`

En hPanel de Hostinger → **Dominios** → `jybora.com` → **DNS / Nameservers**, agregá un registro:

- Tipo **A** · Nombre `demo.cellmin` · Apunta a: la IP del VPS (la misma que tiene el registro `cellmin`).

Se comprueba con `nslookup demo.cellmin.jybora.com` (puede tardar unos minutos).

### 2.3 En el servidor

Primero actualizá el código (`bash /opt/cellmin/deploy/actualizar.sh`). Después:

```bash
# Configuración de la demo
sudo cp /opt/cellmin/deploy/demo/demo.env.example /opt/cellmin/demo.env
sudo nano /opt/cellmin/demo.env        # completá MONGODB_URL (usuario cellmin_demo) y SECRET_KEY
sudo chown cellmin:cellmin /opt/cellmin/demo.env
sudo chmod 600 /opt/cellmin/demo.env

# Carpetas del sitio y de los registros
sudo install -d -o cellmin -g cellmin /opt/cellmin/logs-demo
sudo mkdir -p /var/www/cellmin-demo
sudo rsync -a --delete /opt/cellmin/frontend/dist/ /var/www/cellmin-demo/

# API de la demo
sudo cp /opt/cellmin/deploy/demo/cellmin-demo-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now cellmin-demo-backend

# Sitio
sudo cp /opt/cellmin/deploy/demo/nginx-cellmin-demo.conf /etc/nginx/sites-available/cellmin-demo
sudo ln -s /etc/nginx/sites-available/cellmin-demo /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d demo.cellmin.jybora.com

# Datos de prueba
bash /opt/cellmin/deploy/demo/reiniciar_demo.sh UNA_CLAVE_PARA_LOS_USUARIOS
```

Al final tiene que decir `Datos de prueba cargados en cellmin_demo` y `active`. Entrá a https://demo.cellmin.jybora.com con `admin@cellmin-demo.com` y la clave que elegiste.

Desde ahí, `actualizar.sh` actualiza también la demo cada vez que se sube un cambio.

### 2.4 Antes de cada ensayo y la mañana de la defensa

```bash
bash /opt/cellmin/deploy/demo/reiniciar_demo.sh LA_MISMA_CLAVE
```

---

## 3. Plan B: la demo en la computadora (Windows, sin internet)

Se prepara **en la computadora que se va a usar en la defensa**, con internet, y se prueba sin internet.

**Instalar una sola vez:**

1. **MongoDB Community Server** (https://www.mongodb.com/try/download/community), opción *Complete* y *Install MongoDB as a Service*. Queda funcionando sola en `mongodb://localhost:27017`.
2. **Python 3.11 o 3.12** (no 3.13: algunas dependencias fijadas todavía no se instalan en esa versión; marcar *Add python.exe to PATH*), **Node.js 20 o superior** y **Git**.

**Preparar el sistema** (en PowerShell):

```powershell
git clone https://github.com/danielamorenodev/cellmin.git
cd cellmin\backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

Crear `backend\.env` con este contenido (la clave puede ser cualquiera larga):

```
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=cellmin_demo
SECRET_KEY=una-clave-larga-solo-para-la-demo-local-de-la-defensa
ENTORNO=desarrollo
CORS_ORIGINS=http://localhost:5173
```

Cargar los datos de prueba:

```powershell
python cargar_datos_demo.py --clave UNA_CLAVE_PARA_LOS_USUARIOS
```

Frontend (en otra ventana de PowerShell):

```powershell
cd cellmin\frontend
npm install
```

**El día de la defensa** (dos ventanas de PowerShell):

```powershell
# Ventana 1
cd cellmin\backend
venv\Scripts\activate
python cargar_datos_demo.py --clave LA_MISMA_CLAVE
uvicorn app.main:app

# Ventana 2
cd cellmin\frontend
npm run dev
```

Abrir http://localhost:5173 en el navegador. Para comprobar que funciona sin internet: desconectá el Wi-Fi y hacé una venta.

---

## 4. Después de la defensa

Para apagar la demo sin tocar el sistema del local:

```bash
sudo systemctl disable --now cellmin-demo-backend
sudo rm /etc/nginx/sites-enabled/cellmin-demo && sudo systemctl reload nginx
```

En Atlas, borrá la base `cellmin_demo` y el usuario `cellmin_demo`. En la computadora, se puede desinstalar MongoDB.
