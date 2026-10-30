from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.config import settings
from app.database import connect_db, close_db
from app.routers import (
    auth, users, categories, products,
    clients, suppliers, stock, purchases,
    sales, cash_register, repairs, reports, backup
)
from app.routers import repair_types
import time
from app.routers import cotizacion
from app.routers import tarjetas
from app.routers import remitos
from app.routers import marcas
from app.routers import actividad
import traceback
from fastapi import Request
from fastapi.responses import JSONResponse
from datetime import datetime, timezone
from fastapi.encoders import ENCODERS_BY_TYPE


# Las fechas se guardan en UTC sin zona horaria (datetime.utcnow()). Si se
# envían así, el navegador las toma como hora local y las muestra 3 horas
# adelantadas. Se envían marcadas como UTC y el navegador las pasa a la hora
# de Argentina.
def _fecha_utc(d: datetime) -> str:
    return (d.replace(tzinfo=timezone.utc) if d.tzinfo is None else d).isoformat()


ENCODERS_BY_TYPE[datetime] = _fecha_utc
from app.utils.logger import log_accesos, log_errores, guardar_evento

@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    from app.database import get_db
    from app.utils.stock import migrar_stock_por_sucursal
    await migrar_stock_por_sucursal(get_db())
    from app.utils.migraciones import aplicar_migraciones
    await aplicar_migraciones(get_db())
    # Actualización automática del dólar (solo actúa si el administrador la activó)
    import asyncio
    from app.utils.cotizacion import ciclo_automatico
    tarea_dolar = asyncio.create_task(ciclo_automatico(get_db))
    yield
    tarea_dolar.cancel()
    await close_db()

# En producción no se publica la documentación interactiva de la API
app = FastAPI(
    title="Sistema de Ventas y Stock",
    version="1.0.0",
    lifespan=lifespan,
    docs_url=None if settings.es_produccion else "/docs",
    redoc_url=None if settings.es_produccion else "/redoc",
    openapi_url=None if settings.es_produccion else "/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origenes_permitidos,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,          prefix="/api/auth",        tags=["Auth"])
app.include_router(users.router,         prefix="/api/users",       tags=["Usuarios"])
app.include_router(categories.router,    prefix="/api/categories",  tags=["Categorías"])
app.include_router(products.router,      prefix="/api/products",    tags=["Productos"])
app.include_router(clients.router,       prefix="/api/clients",     tags=["Clientes"])
app.include_router(suppliers.router,     prefix="/api/suppliers",   tags=["Proveedores"])
app.include_router(stock.router,         prefix="/api/stock",       tags=["Stock"])
app.include_router(purchases.router,     prefix="/api/purchases",   tags=["Compras"])
app.include_router(sales.router,         prefix="/api/sales",       tags=["Ventas"])
app.include_router(cash_register.router, prefix="/api/cash",        tags=["Caja"])
app.include_router(repairs.router,       prefix="/api/repairs",     tags=["Reparaciones"])
app.include_router(reports.router,       prefix="/api/reports",     tags=["Reportes"])
app.include_router(backup.router,        prefix="/api/backup",      tags=["Backup"])
app.include_router(repair_types.router, prefix="/api/repair-types", tags=["Tipos de Reparación"])
app.include_router(cotizacion.router, prefix="/api/cotizacion", tags=["Cotización"])
app.include_router(tarjetas.router,      prefix="/api/tarjetas",    tags=["Tarjetas"])
app.include_router(remitos.router,       prefix="/api/remitos",     tags=["Remitos"])
app.include_router(marcas.router,        prefix="/api/marcas",      tags=["Marcas y modelos"])
app.include_router(actividad.router,     prefix="/api/actividad",   tags=["Registro de actividad"])


@app.middleware("http")
async def registrar_pedidos(request: Request, call_next):
    inicio = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception as error:
        log_errores.error(
            f"{request.method} {request.url.path}\n{traceback.format_exc()}"
        )
        await guardar_evento(
            None, "error", "sistema", request.method,
            f"{request.method} {request.url.path}: {type(error).__name__}: {str(error)[:200]}",
            ip=request.client.host if request.client else None,
        )
        return JSONResponse(status_code=500, content={"detail": "Error interno del servidor"})
    ms = (time.perf_counter() - inicio) * 1000
    cliente = request.client.host if request.client else "-"
    log_accesos.info(
        f"{cliente} {request.method} {request.url.path} {response.status_code} {ms:.0f}ms"
    )
    return response


@app.get("/")
async def root():
    return {"message": "Sistema de Ventas API funcionando ✅"}
