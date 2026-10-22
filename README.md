# Cellmin Gestión — Sistema de gestión para venta y reparación de celulares

Sistema web para **Cellmin**, un comercio con dos sucursales que vende y repara celulares, accesorios y productos tecnológicos. Reúne en un solo lugar el stock de cada sucursal, las ventas, la caja, las órdenes de reparación, las compras a proveedores y los reportes.

**Sitio publicado:** https://cellmin.jybora.com
**Tablero del proyecto:** https://github.com/users/luciaddanielamoreno-hash/projects/1

**Tecnologías:** React · Vite · Tailwind CSS · Python · FastAPI · MongoDB (Motor, asíncrono) · Nginx

> 🇬🇧 **English summary:** Web management system for a two-branch phone retail and repair business. It covers multi-branch inventory, sales with PDF tickets, daily cash register, repair orders with deposits, status tracking and warranty, purchasing, USD payments with change in pesos (exchange rate set by the administrator), Excel reports and role-based permissions. Built with React, FastAPI and MongoDB.

---

## Funcionalidades

- **Stock por sucursal:** productos con variantes, categorías, entradas, salidas y ajustes por sucursal, y alertas de stock bajo. Dos ventas simultáneas no pueden llevarse la misma última unidad.
- **Ventas:** carrito, varios medios de pago (efectivo, transferencia, débito, crédito y dólares), ticket en PDF y detalle de cada operación.
- **Caja:** apertura y cierre diario por sucursal, ingresos y egresos, y al cerrar muestra cuánto debería haber por cada medio de pago.
- **Reparaciones:** orden imprimible con seña, datos del equipo y **código o patrón de bloqueo**. Los estados avanzan de a un paso: En diagnóstico → Ingresada → En reparación → Lista → Entregada. Solo se entrega un equipo pagado por completo, y al entregarlo empieza la garantía (90 días, editable por orden).
- **Dólar:** el administrador carga el valor del día y queda un historial de cambios. Se puede cobrar en dólares y dar el vuelto en pesos.
- **Compras y proveedores:** cada compra registrada suma el stock de la sucursal que la recibe.
- **Reportes** con gráficos y **exportación a Excel**.
- **Respaldo:** el administrador descarga una copia completa de los datos desde Reportes.
- **Funciona en computadora, tablet y celular**, desde el navegador y sin instalar nada.

## Roles y permisos

Hay cinco roles con permisos definidos en el backend (`backend/app/utils/permissions.py`):

| Rol | Qué puede hacer |
|---|---|
| Administrador | Todo, incluidos usuarios, valor del dólar, reportes y respaldo. |
| Cajero | Abrir y cerrar la caja de su sucursal, vender, cobrar reparaciones y anular ventas. |
| Vendedor | Vender en la caja abierta de su sucursal, atender clientes y tomar reparaciones. |
| Técnico | Gestionar las reparaciones: diagnóstico, presupuesto y cambios de estado. |
| Depósito | Productos, stock, proveedores y compras. |

El código de desbloqueo de los equipos solo lo ven el técnico y el administrador, y se borra al entregar el equipo.

## Seguridad y confiabilidad

- Inicio de sesión con **JWT** y contraseñas cifradas con **bcrypt**.
- Los permisos se controlan en cada endpoint, no solo ocultando botones.
- **Idempotencia:** si una venta llega dos veces por un doble clic o un corte de red, se registra una sola vez.
- **Stock sin negativos:** el descuento solo se aplica si hay unidades suficientes en la misma operación.
- Las credenciales están en archivos `.env` del servidor y nunca se suben al repositorio.
- MongoDB Atlas con un usuario de permisos mínimos y acceso restringido por IP.
- El backend escucha solo en `127.0.0.1`. Hacia afuera solo se expone Nginx con **HTTPS**.

## Estructura

```
backend/            API REST con FastAPI
  app/routers/      endpoints (ventas, reparaciones, stock, compras, caja, reportes…)
  app/models/       modelos de datos
  app/utils/        sesión, permisos, stock, caja, dólar, idempotencia, tickets PDF
  crear_admin.py    crea el primer usuario administrador
frontend/           React + Vite + Tailwind
  src/pages/        pantallas del sistema
  src/components/   componentes reutilizables
  src/services/     comunicación con la API
deploy/             configuración de Nginx, servicio systemd y script de actualización
DESPLIEGUE.md       guía de despliegue en el servidor, paso a paso
```

## Cómo ejecutarlo en una computadora

**Requisitos:** Python 3.10 o superior, Node.js 20 o superior, Git y una base MongoDB (local o una cuenta gratuita de MongoDB Atlas).

### 1. Descargar el código

```bash
git clone https://github.com/luciaddanielamoreno-hash/cellmin.git
cd cellmin
```

### 2. Backend

```bash
cd backend
python -m venv venv
```

Activar el entorno virtual:

- Windows: `venv\Scripts\activate`
- Linux o macOS: `source venv/bin/activate`

```bash
pip install -r requirements.txt
```

Copiar `.env.example` como `.env` (en Windows: `copy .env.example .env`; en Linux o macOS: `cp .env.example .env`) y completar:

| Variable | Valor para usarlo en la computadora |
|---|---|
| `MONGODB_URL` | La conexión a la base: `mongodb://localhost:27017` si es local, o la cadena que da Atlas. |
| `DATABASE_NAME` | Por ejemplo `cellmin_dev`. |
| `SECRET_KEY` | Una clave larga. Se genera con `python -c "import secrets; print(secrets.token_urlsafe(48))"`. |
| `ENTORNO` | `desarrollo` (con `produccion` se oculta la documentación de la API). |
| `CORS_ORIGINS` | `http://localhost:5173` |

Crear el primer administrador (pide nombre, email y contraseña) y levantar la API:

```bash
python crear_admin.py
uvicorn app.main:app --reload
```

La API queda en `http://localhost:8000`, con su documentación interactiva en `http://localhost:8000/docs`.

### 3. Frontend (en otra terminal)

```bash
cd frontend
npm install
npm run dev
```

Abrir `http://localhost:5173` e iniciar sesión con el administrador creado. Vite redirige las llamadas `/api` al backend, así que no hace falta configurar nada más.

### 4. Primeros pasos dentro del sistema

1. En **Usuarios**, crear los usuarios de cada rol y asignarles su sucursal.
2. En **Dólar**, cargar el valor del día (sin ese valor no se muestran precios en dólares ni se puede cobrar en dólares).
3. En **Categorías** y **Productos**, cargar el catálogo; en **Compras** o **Stock**, las existencias de cada sucursal.
4. Con un cajero, abrir la **Caja** de la sucursal: desde ahí ya se puede vender.

### Problemas frecuentes

- **`/docs` muestra “Not Found”:** `ENTORNO` está en `produccion`; cambiarlo a `desarrollo` y reiniciar el backend.
- **El inicio de sesión falla con error de red:** el backend no está corriendo o no está en el puerto 8000.
- **No se puede vender:** la caja de la sucursal no está abierta.

## Despliegue

El sitio corre en un VPS Linux (Ubuntu) de Hostinger, con el backend como servicio **systemd**, **Nginx** como proxy reverso y certificados HTTPS de Let's Encrypt. El paso a paso está en [DESPLIEGUE.md](DESPLIEGUE.md); para publicar una versión nueva se usa `deploy/actualizar.sh`.

---

Desarrollado por **Nodo Sistemas**: **Daniela Moreno** (backend, despliegue y contacto con el cliente) y **Esteban Farias** (análisis funcional, diseño UX/UI y frontend).
