# Cellmin — Sistema de Gestión para Comercio de Celulares y Servicio Técnico

Sistema web full stack para un comercio de venta y reparación de celulares, accesorios y productos tecnológicos. Reúne en un solo lugar ventas, reparaciones, stock por sucursal, compras, caja y reportes. Está **en producción** y se usa a diario en el negocio.

**Stack:** React · Vite · Tailwind CSS · Python · FastAPI · MongoDB (Motor, async) · Nginx

> 🇬🇧 **English summary:** Full-stack management system for a phone retail and repair business, used daily in production. Covers sales, repair orders with status tracking, multi-branch inventory, purchasing, cash register, USD pricing with live exchange rate, PDF tickets, Excel reports and role-based permissions. Built with React, FastAPI and MongoDB.

---

## Funcionalidades

- **Ventas:** carrito, varios medios de pago, ticket de venta y detalle de cada operación.
- **Reparaciones con seguimiento de estado:** En diagnóstico → Ingresada → En reparación → Lista → Entregada. Cada reparación tiene su orden imprimible, el registro del **patrón de bloqueo** del equipo y tipos de reparación configurables.
- **Stock por sucursal:** productos, categorías, movimientos y control de inventario.
- **Compras y proveedores:** carga de compras que actualizan el stock automáticamente.
- **Caja:** apertura, cierre y movimientos diarios.
- **Precios en dólares:** cotización del dólar que se actualiza sola y convierte los precios a pesos.
- **Reportes** con gráficos y **exportación a Excel**.
- **Tickets y órdenes en PDF.**
- **Backup** exportable de los datos.
- **Interfaz responsive**, utilizable desde computadora y celular.

## Roles y permisos

Hay cinco roles con permisos definidos en el backend: **Administrador, Cajero, Vendedor, Depósito y Técnico**. Cada uno ve y puede hacer solo lo que le corresponde. Por ejemplo, un técnico puede avanzar una reparación hasta "Lista", pero la entrega al cliente la registra el mostrador.

## Seguridad y confiabilidad

- Autenticación con **JWT** y contraseñas cifradas con **bcrypt**.
- Permisos validados en cada endpoint, no solo ocultos en la interfaz.
- **Protección contra operaciones duplicadas (idempotencia):** si una venta se envía dos veces por un doble clic o un corte de red, se registra una sola vez.
- Credenciales fuera del repositorio, en archivos `.env` del servidor.
- Base de datos en MongoDB Atlas con usuario de permisos mínimos y acceso restringido por IP.
- El backend escucha solo en `127.0.0.1`. Al exterior solo se expone Nginx con **HTTPS**.

## Estructura

```
backend/            API REST con FastAPI (async)
  app/routers/      endpoints (ventas, reparaciones, stock, compras, caja, reportes…)
  app/models/       modelos de datos
  app/utils/        autenticación, permisos, cotización, idempotencia, tickets PDF
frontend/           React + Vite + Tailwind
  src/pages/        pantallas del sistema
  src/components/   componentes reutilizables
  src/services/     comunicación con la API
deploy/             configuración de Nginx, servicio systemd y script de actualización
DESPLIEGUE.md       guía de despliegue paso a paso
```

## Cómo correrlo localmente

**Requisitos:** Python 3.10 o superior, Node.js 20 o superior y una base MongoDB (local o Atlas).

```bash
# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # completar la conexión a MongoDB y SECRET_KEY
python crear_admin.py
uvicorn app.main:app --reload

# Frontend (en otra terminal)
cd frontend
npm install
npm run dev
```

La API queda en `http://localhost:8000/docs`, con documentación interactiva de FastAPI.

## Despliegue

Corre en un VPS Linux (Ubuntu) con el backend como servicio **systemd**, **Nginx** como proxy reverso y certificados HTTPS. El detalle está en [DESPLIEGUE.md](DESPLIEGUE.md).

---

Desarrollado por **Daniela Moreno** · Desarrolladora Full Stack
