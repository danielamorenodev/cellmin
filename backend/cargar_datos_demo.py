"""Carga datos de prueba verosímiles en una base de DEMOSTRACIÓN.

Uso (desde la carpeta backend, con el entorno virtual activado y el .env de la demo):
    python cargar_datos_demo.py --clave CLAVE_DE_LOS_USUARIOS

- BORRA todo lo que haya en la base y la vuelve a cargar. Por seguridad solo
  funciona si el nombre de la base contiene "demo" (por ejemplo, cellmin_demo).
  Nunca se puede correr contra la base del local.
- Usa la API del propio sistema (sin levantar el servidor), así cada dato pasa
  por las mismas reglas que una carga a mano: stock, cajas, pagos, IMEI, etc.
- Arma una semana de historia: compras, ventas en las dos sucursales (algunas en
  dólares y celulares con IMEI), cajas abiertas y cerradas, reparaciones en
  distintos estados y cambios del valor del dólar. Hoy no queda ninguna caja
  abierta, para que la demostración empiece abriendo la caja.
- Todos los datos son inventados (Ley 25.326): nombres, DNI, teléfonos e IMEI.
"""
import argparse
import asyncio
import random
from datetime import datetime, timedelta, timezone

import httpx
from bson import ObjectId

from app.config import settings
from app.utils.cajas import dia_local
from app.utils.auth import hash_password

USUARIOS = [
    # rol, email, nombre, sucursales
    ("administrador", "admin@cellmin-demo.com", "Marcela Ríos", ["sucursal_1", "sucursal_2"]),
    ("cajero", "cajero1@cellmin-demo.com", "Julián Pérez", ["sucursal_1"]),
    ("cajero", "cajero2@cellmin-demo.com", "Sofía Gómez", ["sucursal_2"]),
    ("vendedor", "vendedor@cellmin-demo.com", "Tomás Díaz", ["sucursal_1"]),
    ("tecnico", "tecnico@cellmin-demo.com", "Nicolás Herrera", ["sucursal_1", "sucursal_2"]),
    ("deposito", "deposito@cellmin-demo.com", "Paula Ruiz", ["sucursal_1", "sucursal_2"]),
]

CATEGORIAS = ["Celulares", "Fundas", "Protectores de pantalla", "Cargadores y cables", "Audio"]

# nombre, categoría, costo, venta, stock S1, stock S2, mínimo S1, mínimo S2, pide IMEI, variantes
PRODUCTOS = [
    ("Samsung Galaxy A15 128 GB", "Celulares", 280000, 389999, 4, 3, 2, 2, True, None),
    ("Motorola Moto G24 128 GB", "Celulares", 220000, 309999, 3, 3, 2, 2, True, None),
    ("iPhone 12 64 GB (usado)", "Celulares", 450000, 629999, 1, 1, 0, 0, True, None),
    ("Funda silicona Samsung A15", "Fundas", 4000, 12000, 0, 0, 0, 0, False,
     [("Negro", 10, 5, 3, 2), ("Azul", 6, 5, 3, 2), ("Lila", 3, 5, 2, 2)]),
    ("Vidrio templado iPhone 13", "Protectores de pantalla", 2500, 9000, 15, 4, 4, 3, False, None),
    ("Cargador 20 W USB-C", "Cargadores y cables", 9000, 24000, 14, 10, 3, 3, False, None),
    ("Cable USB-C a Lightning 1 m", "Cargadores y cables", 3500, 11000, 16, 12, 4, 4, False, None),
    ("Auriculares inalámbricos", "Audio", 15000, 39000, 10, 8, 2, 2, False, None),
]

PROVEEDORES = [
    ("Distribuidora Tecnocel S.A.", "30-71234567-1", "351 555-0201", "ventas@tecnocel-demo.com", "Gonzalo Paz"),
    ("Accesorios del Centro S.R.L.", "30-70987654-2", "351 555-0202", "pedidos@accesorios-demo.com", "Valeria Sosa"),
]

TIPOS_REPARACION = [
    ("Cambio de módulo Samsung A15", 95000),
    ("Cambio de batería iPhone 12", 65000),
    ("Cambio de pin de carga", 35000),
    ("Diagnóstico", 10000),
]

CLIENTES = [
    ("Carla", "Méndez", "30111222", "351 555-0101"),
    ("Martín", "Ferreyra", "28444555", "351 555-0102"),
    ("Lucía", "Bustos", "35777888", "351 555-0103"),
    ("Diego", "Arias", "33222111", "351 555-0104"),
    ("Valentina", "Ortiz", "40123456", "351 555-0105"),
    ("Hernán", "Quiroga", "26999000", "351 555-0106"),
]

# Valor del dólar: (días atrás, valor)
DOLAR = [(6, 1420), (3, 1435), (0, 1450)]


def imei_valido(rnd):
    """IMEI inventado pero con dígito verificador correcto (Luhn)."""
    base = [3, 5] + [rnd.randint(0, 9) for _ in range(12)]
    suma = 0
    for i, d in enumerate(reversed(base)):
        if i % 2 == 0:
            d *= 2
            if d > 9:
                d -= 9
        suma += d
    return "".join(map(str, base)) + str((10 - suma % 10) % 10)


class Demo:
    def __init__(self, clave, semilla=7):
        from app.main import app
        self.app = app
        self.clave = clave
        self.rnd = random.Random(semilla)
        self.tokens = {}
        self.ids = {}

    # ------------------------------------------------------------ API
    async def __aenter__(self):
        from app.database import connect_db, get_db
        await connect_db()
        self.db = get_db()
        self.http = httpx.AsyncClient(transport=httpx.ASGITransport(app=self.app), base_url="http://demo")
        return self

    async def __aexit__(self, *a):
        await self.http.aclose()

    async def login(self, email):
        if email not in self.tokens:
            r = await self.http.post("/api/auth/login", data={"username": email, "password": self.clave})
            r.raise_for_status()
            self.tokens[email] = r.json()["access_token"]
        return {"Authorization": f"Bearer {self.tokens[email]}"}

    async def api(self, metodo, ruta, quien, json=None, params=None):
        r = await self.http.request(metodo, ruta, json=json, params=params, headers=await self.login(quien))
        if r.status_code >= 400:
            raise RuntimeError(f"{metodo} {ruta} como {quien}: {r.status_code} {r.text}")
        return r.json()

    # ------------------------------------------------------------ base
    async def vaciar(self):
        for col in await self.db.list_collection_names():
            if not col.startswith("system."):
                await self.db[col].delete_many({})

    async def crear_usuarios(self):
        for rol, email, nombre, sucursales in USUARIOS:
            await self.db.usuarios.insert_one({
                "nombre": nombre, "email": email, "password": hash_password(self.clave), "rol": rol,
                "sucursales": sucursales, "activo": True, "fecha_creacion": datetime.utcnow(),
            })

    async def catalogo(self):
        A = "admin@cellmin-demo.com"
        cats = {}
        for c in CATEGORIAS:
            r = await self.api("POST", "/api/categories/", A, {"nombre": c})
            cats[c] = r.get("id") or r.get("_id")
        for nombre, cat, costo, venta, s1, s2, m1, m2, imei, variantes in PRODUCTOS:
            datos = {
                "nombre": nombre, "categoria_id": cats[cat], "unidad_medida": "unidad", "pide_imei": imei,
                "codigo_barras": str(7790000000000 + self.rnd.randint(10 ** 6, 10 ** 7)),
            }
            if variantes:
                datos.update(tiene_variantes=True, variantes=[{
                    "nombre": vn, "precio_costo": costo, "precio_venta": venta,
                    "codigo_barras": str(7790000000000 + self.rnd.randint(10 ** 6, 10 ** 7)),
                    "stock_sucursal": {"sucursal_1": v1, "sucursal_2": v2},
                    "stock_minimo_sucursal": {"sucursal_1": n1, "sucursal_2": n2},
                } for vn, v1, v2, n1, n2 in variantes])
            else:
                datos.update(precio_costo=costo, precio_venta=venta,
                             stock_sucursal={"sucursal_1": s1, "sucursal_2": s2},
                             stock_minimo_sucursal={"sucursal_1": m1, "sucursal_2": m2})
            r = await self.api("POST", "/api/products/", A, datos)
            self.ids[nombre] = r["id"]
        for nombre, cuit, tel, mail, contacto in PROVEEDORES:
            r = await self.api("POST", "/api/suppliers/", A, {"nombre": nombre, "cuit": cuit, "telefono": tel, "email": mail, "contacto": contacto})
            self.ids[nombre] = r.get("id") or r.get("_id")
        self.tipos = []
        for nombre, precio in TIPOS_REPARACION:
            r = await self.api("POST", "/api/repair-types/", A, {"nombre": nombre, "precio": precio})
            self.tipos.append({"tipo_id": r.get("id") or r.get("_id"), "nombre": nombre, "precio": precio})
        self.clientes = []
        for n, a, dni, tel in CLIENTES:
            r = await self.api("POST", "/api/clients/", A, {"nombre": n, "apellido": a, "dni": dni, "telefono": tel})
            self.clientes.append(r.get("id") or r.get("_id"))

    # ------------------------------------------------------------ operaciones
    async def dolar(self, valor):
        await self.api("PUT", "/api/cotizacion/", "admin@cellmin-demo.com", {"valor": valor})

    async def compra(self, sucursal, proveedor, items):
        pedido = [{"producto_id": self.ids[p], "variante_nombre": v, "nombre_producto": p, "cantidad": c,
                   "precio_unitario": costo, "subtotal": c * costo} for p, v, c, costo in items]
        await self.api("POST", "/api/purchases/", "deposito@cellmin-demo.com", {
            "proveedor_id": self.ids[proveedor], "sucursal": sucursal, "items": pedido,
            "total": sum(i["subtotal"] for i in pedido), "numero_remito": f"0001-{self.rnd.randint(10000, 99999)}"})

    async def precio(self, nombre, variante=None):
        p = await self.api("GET", f"/api/products/{self.ids[nombre]}", "admin@cellmin-demo.com")
        if variante:
            return next(v for v in p["variantes"] if v["nombre"] == variante)["precio_venta"]
        return p["precio_venta"]

    async def stock(self, nombre, variante, sucursal):
        p = await self.api("GET", f"/api/products/{self.ids[nombre]}", "admin@cellmin-demo.com")
        item = next(v for v in p["variantes"] if v["nombre"] == variante) if variante else p
        return item["stock_sucursal"][sucursal]

    async def venta(self, quien, items, pago="efectivo", usd=None, cliente=None):
        lineas, total = [], 0
        for nombre, variante, cant in items:
            precio = await self.precio(nombre, variante)
            linea = {"producto_id": self.ids[nombre], "variante_nombre": variante, "nombre_producto": nombre,
                     "cantidad": cant, "precio_unitario": precio, "subtotal": precio * cant}
            if nombre.startswith(("Samsung", "Motorola", "iPhone")):
                linea["imeis"] = [imei_valido(self.rnd) for _ in range(cant)]
            lineas.append(linea)
            total += precio * cant
        if usd:
            pagos = [{"metodo": "usd", "monto": usd}]
        else:
            pagos = [{"metodo": pago, "monto": total}]
        await self.api("POST", "/api/sales/", quien, {
            "items": lineas, "total": total, "pagos": pagos, "cliente_id": cliente,
            "clave_idempotencia": str(ObjectId())})

    async def abrir(self, quien, sucursal, inicial):
        # se abre con lo que quedó en la caja anterior (como un cajero que cuenta bien)
        previo = await self.api("GET", "/api/cash/esperado", quien, params={"sucursal": sucursal})
        if previo.get("esperado") is not None:
            inicial = previo["esperado"]
        await self.api("POST", "/api/cash/abrir", quien, {"monto_inicial": inicial, "sucursal": sucursal})

    async def cerrar(self, quien, dejar=20000):
        c = await self.api("GET", "/api/cash/actual", quien)
        montos = [{"metodo": m, "monto": v} for m, v in c["esperado_por_metodo"].items() if m != "usd"]
        if c.get("esperado_usd"):
            montos.append({"metodo": "usd", "monto": c["esperado_usd"]})
        efectivo = sum(m["monto"] for m in montos if m["metodo"] == "efectivo")
        await self.api("POST", "/api/cash/cerrar", quien, {"montos_por_metodo": montos, "dejar_en_caja": min(dejar, efectivo)})

    async def orden(self, quien, cliente, marca, modelo, tipo, problema, bloqueo=("ninguno", None), sena=None,
                    sucursal="sucursal_1", estimada=3):
        # estimada: días desde HOY (real) para la fecha de entrega prometida;
        # negativo = la orden ya está atrasada
        fecha = (datetime.now().date() + timedelta(days=estimada)).isoformat()
        datos = {"cliente_id": cliente, "sucursal": sucursal, "tipos_reparacion": [tipo], "fecha_estimada_entrega": fecha,
                 "equipo": {"marca": marca, "modelo": modelo, "imei": imei_valido(self.rnd), "problema_descripcion": problema,
                            "bloqueo_tipo": bloqueo[0], "bloqueo_valor": bloqueo[1]}}
        if sena:
            datos["sena"] = {"monto": sena, "metodo": "efectivo"}
        r = await self.api("POST", "/api/repairs/", quien, datos)
        return r.get("id") or r.get("_id")

    async def estado(self, orden, *estados, quien="tecnico@cellmin-demo.com"):
        for e in estados:
            await self.api("PUT", f"/api/repairs/{orden}", quien, {"estado": e})

    async def cobrar_y_entregar(self, quien, orden):
        r = await self.api("GET", f"/api/repairs/{orden}", quien)
        if r["saldo_pendiente"] > 0:
            await self.api("POST", f"/api/repairs/{orden}/pago", quien, {"monto": r["saldo_pendiente"], "tipo": "saldo", "metodo": "transferencia"})
        await self.estado(orden, "entregada", quien=quien)

    HISTORIA = ("ventas", "compras", "cajas", "stock_movimientos", "reparaciones", "cotizacion_historial")

    async def existentes(self):
        return {c: {d["_id"] async for d in self.db[c].find({}, {"_id": 1})} for c in self.HISTORIA}

    async def correr_dias(self, antes, desde, cuantos):
        """Pasa a un día anterior todo lo creado en este día de la historia (lo que
        no estaba en `antes`) y le da horarios de un día de atención (9:30 a 20:00,
        hora de Argentina) respetando el orden en que ocurrió cada cosa."""
        from app.utils.cajas import ZONA_AR
        dia = (datetime.now(ZONA_AR) - timedelta(days=cuantos)).date()
        abre = datetime(dia.year, dia.month, dia.day, 9, 30, tzinfo=ZONA_AR).astimezone(timezone.utc).replace(tzinfo=None)
        docs = []
        for col in self.HISTORIA:
            async for d in self.db[col].find({"_id": {"$nin": list(antes[col])}}):
                docs.append((col, d))
        # todas las marcas de tiempo del día, en orden, repartidas entre 9:30 y 20:00
        marcas = set()

        def juntar(v, clave=""):
            if isinstance(v, datetime) and "vencimiento" not in clave:
                marcas.add(v)
            elif isinstance(v, dict):
                for k, x in v.items():
                    juntar(x, k)
            elif isinstance(v, list):
                for x in v:
                    juntar(x, clave)
        for _, d in docs:
            juntar(d)
        orden = sorted(marcas)
        paso = timedelta(minutes=630) / max(len(orden), 1)
        nueva = {t: abre + paso * i + timedelta(seconds=self.rnd.randint(0, 59)) for i, t in enumerate(orden)}

        def mover(v, clave=""):
            if isinstance(v, datetime):
                return nueva.get(v, v - timedelta(days=cuantos))
            if isinstance(v, dict):
                return {k: mover(x, k) for k, x in v.items()}
            if isinstance(v, list):
                return [mover(x, clave) for x in v]
            return v
        for col, d in docs:
            nuevo = {k: mover(v, k) for k, v in d.items() if k != "_id"}
            if col == "reparaciones" and d.get("fecha_vencimiento_garantia") and d.get("fecha_entrega"):
                nuevo["fecha_vencimiento_garantia"] = nuevo["fecha_entrega"] + (d["fecha_vencimiento_garantia"] - d["fecha_entrega"])
            if col == "cajas":
                nuevo["dia"] = dia_local(nuevo["fecha_apertura"])
            await self.db[col].replace_one({"_id": d["_id"]}, nuevo)
        cfg = await self.db.configuracion.find_one({"_id": "cotizacion_blue"})
        if cfg and cfg.get("guardada") and cfg["guardada"] >= desde.replace(tzinfo=None):
            await self.db.configuracion.update_one({"_id": "cotizacion_blue"}, {"$set": {"guardada": nueva.get(cfg["guardada"], abre)}})

    # ------------------------------------------------------------ guion
    async def cargar(self):
        await self.vaciar()
        await self.crear_usuarios()
        await self.catalogo()
        C1, C2, V = "cajero1@cellmin-demo.com", "cajero2@cellmin-demo.com", "vendedor@cellmin-demo.com"
        cl = self.clientes
        valor = dict(DOLAR)
        accesorios = [("Vidrio templado iPhone 13", None), ("Cargador 20 W USB-C", None), ("Cable USB-C a Lightning 1 m", None),
                      ("Auriculares inalámbricos", None), ("Funda silicona Samsung A15", "Negro"), ("Funda silicona Samsung A15", "Azul")]
        pendientes = []
        for atras in range(6, 0, -1):
            inicio = datetime.now(timezone.utc) - timedelta(seconds=1)
            antes = await self.existentes()
            if atras in valor:
                await self.dolar(valor[atras])
            if atras == 6:
                await self.compra("sucursal_1", "Distribuidora Tecnocel S.A.", [("Samsung Galaxy A15 128 GB", None, 2, 280000), ("Motorola Moto G24 128 GB", None, 1, 220000)])
                await self.compra("sucursal_2", "Accesorios del Centro S.R.L.", [("Vidrio templado iPhone 13", None, 10, 2500), ("Cargador 20 W USB-C", None, 4, 9000)])
            await self.abrir(C1, "sucursal_1", 20000)
            await self.abrir(C2, "sucursal_2", 20000)
            for quien, suc in ((C1, "sucursal_1"), (V, "sucursal_1"), (C2, "sucursal_2")):
                for _ in range(self.rnd.randint(1, 3)):
                    nombre, var = self.rnd.choice(accesorios)
                    cant = self.rnd.randint(1, 2)
                    # se deja al menos una unidad por encima del mínimo para que las alertas sean las previstas
                    if await self.stock(nombre, var, suc) < cant + 4:
                        continue
                    await self.venta(quien, [(nombre, var, cant)], pago=self.rnd.choice(["efectivo", "transferencia", "debito", "credito"]))
            if atras in (5, 2):  # un celular vendido con IMEI, pagado en dólares
                await self.venta(C1, [("Samsung Galaxy A15 128 GB", None, 1)], usd=280, cliente=cl[atras % len(cl)])
            if atras == 4:
                await self.venta(C2, [("Motorola Moto G24 128 GB", None, 1), ("Funda silicona Samsung A15", "Negro", 1)], pago="credito", cliente=cl[1])
            if atras == 5:  # reparación completa: ingreso con seña, taller, cobro y entrega
                o = await self.orden(C2, cl[0], "Samsung", "Galaxy A15", self.tipos[0], "Pantalla rota, no responde al tacto",
                                     ("patron", "1-5-9-6"), sena=30000, sucursal="sucursal_2", estimada=-3)
                await self.estado(o, "ingresada", "en_reparacion", "lista")
                pendientes.append(("entregar", o))
            if atras == 3:
                for accion, o in pendientes:
                    await self.cobrar_y_entregar(C2, o)
                o = await self.orden(C1, cl[2], "Apple", "iPhone 12", self.tipos[1], "La batería dura menos de medio día",
                                     ("pin", "4821"), sena=20000, estimada=-1)
                await self.estado(o, "ingresada", "en_reparacion")
            if atras == 2:
                await self.api("POST", "/api/stock/movimiento", "deposito@cellmin-demo.com", {
                    "producto_id": self.ids["Funda silicona Samsung A15"], "variante_nombre": "Lila", "tipo": "ajuste",
                    "cantidad": 2, "sucursal": "sucursal_1", "motivo": "ajuste_manual", "notas": "Conteo semanal: una funda dañada"})
            if atras == 1:
                o = await self.orden(C1, cl[3], "Motorola", "Moto G24", self.tipos[2], "No carga, hay que mover el cable",
                                     ("patron", "7-4-1-2-3"), sena=10000, estimada=0)
                await self.estado(o, "ingresada", "en_reparacion", "lista")
                o = await self.orden(C2, cl[4], "Samsung", "Galaxy A54", self.tipos[3], "Se apaga solo", sucursal="sucursal_2",
                                     estimada=1)
            await self.cerrar(C1)
            await self.cerrar(C2)
            await self.correr_dias(antes, inicio, atras)
        await self.dolar(valor[0])
        # una orden recién ingresada hoy, sin seña (no hace falta caja abierta)
        await self.orden(V, cl[5], "Xiaomi", "Redmi Note 13", self.tipos[3], "Se mojó; no enciende")
        # Tarjetas y marcas para mostrar en la demo (datos de ejemplo: los
        # recargos reales los carga el local en Configuración → Medios de pago)
        from app.utils.tarjetas import crear_tarjetas_iniciales
        from app.utils.marcas import cargar_marcas_iniciales
        await crear_tarjetas_iniciales(self.db)
        for nombre in ("Visa", "Mastercard"):
            await self.db.tarjetas.update_one({"nombre": nombre}, {"$set": {"planes": [
                {"cuotas": 1, "recargo": 0}, {"cuotas": 3, "recargo": 10}, {"cuotas": 6, "recargo": 20}]}})
        await cargar_marcas_iniciales(self.db)


async def principal():
    ap = argparse.ArgumentParser(description="Carga datos de prueba en la base de demostración")
    ap.add_argument("--clave", required=True, help="contraseña de todos los usuarios de prueba (mínimo 8 caracteres)")
    a = ap.parse_args()
    if "demo" not in settings.database_name.lower():
        raise SystemExit(f"La base configurada es '{settings.database_name}'. Este script borra todo: solo se usa con una base cuyo nombre contenga 'demo'.")
    if len(a.clave) < 8:
        raise SystemExit("La clave tiene que tener al menos 8 caracteres.")
    async with Demo(a.clave) as demo:
        await demo.cargar()
        n = {c: await demo.db[c].count_documents({}) for c in ("productos", "ventas", "compras", "cajas", "reparaciones", "clientes")}
    print(f"Datos de prueba cargados en {settings.database_name}: {n}")
    print("Usuarios (todos con la clave indicada):")
    for rol, email, nombre, suc in USUARIOS:
        print(f"  {rol:<13} {email:<28} {nombre}")


if __name__ == "__main__":
    asyncio.run(principal())
