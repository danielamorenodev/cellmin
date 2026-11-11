"""Ventas, stock y caja: los cálculos de dinero y de stock que exige la
definición de terminado.

Cubre: descuento de stock en la sucursal de la caja, stock que nunca queda
negativo (también con dos ventas simultáneas de la última unidad), ventas
duplicadas por doble clic, totales calculados en el servidor, pagos
mixtos, cobro en dólares con vuelto en pesos, cancelación y cierre de caja.
"""
import asyncio

import pytest
from bson import ObjectId

from app import database
from app.utils.stock import descontar_stock


# ── Ayudas ───────────────────────────────────────────────────────────────

def _producto(client, admin, stock1=5, stock2=0, precio=10000, nombre="Funda A10"):
    cat = client.post("/api/categories/", headers=admin["headers"], json={"nombre": f"Cat {nombre}"}).json()["id"]
    r = client.post("/api/products/", headers=admin["headers"], json={
        "nombre": nombre, "categoria_id": cat, "unidad_medida": "unidad",
        "precio_costo": precio / 2, "precio_venta": precio,
        "stock_sucursal": {"sucursal_1": stock1, "sucursal_2": stock2}})
    assert r.status_code == 200, r.text
    return r.json()


def _stock(client, producto_id, sucursal="sucursal_1"):
    p = client.portal.call(database.get_db().productos.find_one, {"_id": ObjectId(producto_id)})
    return p["stock_sucursal"][sucursal]


def _abrir_caja(client, user, monto=10000, sucursal="sucursal_1"):
    r = client.post("/api/cash/abrir", headers=user["headers"],
                    json={"monto_inicial": monto, "sucursal": sucursal})
    assert r.status_code == 200, r.text
    return r.json()["id"]


def _vender(client, user, producto, cantidad=1, total=None, **extra):
    precio = producto["precio_venta"]
    cuerpo = {
        "items": [{
            "producto_id": producto["id"], "nombre_producto": producto["nombre"],
            "cantidad": cantidad, "precio_unitario": precio, "subtotal": precio * cantidad,
        }],
        "total": precio * cantidad if total is None else total,
        "pagos": [{"metodo": "efectivo", "monto": 0}],
        **extra,
    }
    return client.post("/api/sales/", headers=user["headers"], json=cuerpo)


@pytest.fixture()
def producto(client, admin):
    return _producto(client, admin)


# ── Stock ────────────────────────────────────────────────────────────────

def test_venta_descuenta_stock_de_la_sucursal_de_la_caja(client, cajero, producto, db):
    _abrir_caja(client, cajero)
    r = _vender(client, cajero, producto, cantidad=2)
    assert r.status_code == 200, r.text
    assert _stock(client, producto["id"], "sucursal_1") == 3
    assert _stock(client, producto["id"], "sucursal_2") == 0
    movs = client.portal.call(lambda: db.stock_movimientos.find({"motivo": "venta"}).to_list(10))
    assert len(movs) == 1 and movs[0]["cantidad"] == 2 and movs[0]["sucursal"] == "sucursal_1"


def test_sin_stock_suficiente_no_vende_ni_toca_el_stock(client, cajero, producto, db):
    _abrir_caja(client, cajero)
    r = _vender(client, cajero, producto, cantidad=6)
    assert r.status_code == 400
    assert "Stock insuficiente" in r.json()["detail"]
    assert _stock(client, producto["id"]) == 5
    assert client.portal.call(db.ventas.count_documents, {}) == 0


def test_stock_de_otra_sucursal_no_se_puede_vender(client, cajero, admin):
    p = _producto(client, admin, stock1=0, stock2=4, nombre="Cargador")
    _abrir_caja(client, cajero)  # caja de la Sucursal 1
    r = _vender(client, cajero, p)
    assert r.status_code == 400
    assert _stock(client, p["id"], "sucursal_2") == 4


def test_dos_ventas_simultaneas_de_la_ultima_unidad(client, admin):
    """El descuento comprueba y resta en una sola operación: de dos
    descuentos al mismo tiempo de la última unidad, solo uno se aplica."""
    p = _producto(client, admin, stock1=1, nombre="Último equipo")

    async def dos_a_la_vez():
        db = database.get_db()
        return await asyncio.gather(
            descontar_stock(db, p["id"], None, "sucursal_1", 1),
            descontar_stock(db, p["id"], None, "sucursal_1", 1),
        )

    resultados = client.portal.call(dos_a_la_vez)
    assert sorted(resultados) == [False, True]
    assert _stock(client, p["id"]) == 0


def test_la_segunda_venta_de_la_ultima_unidad_es_rechazada(client, cajero, vendedor, admin, db):
    p = _producto(client, admin, stock1=1, nombre="Último equipo")
    _abrir_caja(client, cajero)
    assert _vender(client, cajero, p).status_code == 200
    r = _vender(client, vendedor, p)  # el vendedor vende en la misma caja
    assert r.status_code in (400, 409)
    assert _stock(client, p["id"]) == 0
    assert client.portal.call(db.ventas.count_documents, {}) == 1


def test_variante_descuenta_su_propio_stock(client, cajero, admin):
    cat = client.post("/api/categories/", headers=admin["headers"], json={"nombre": "Fundas"}).json()["id"]
    r = client.post("/api/products/", headers=admin["headers"], json={
        "nombre": "Funda silicona", "categoria_id": cat, "unidad_medida": "unidad",
        "tiene_variantes": True, "precio_costo": 0, "precio_venta": 0,
        "variantes": [
            {"nombre": "Negra", "precio_costo": 2000, "precio_venta": 5000,
             "stock_sucursal": {"sucursal_1": 3, "sucursal_2": 0}},
            {"nombre": "Roja", "precio_costo": 2000, "precio_venta": 5000,
             "stock_sucursal": {"sucursal_1": 2, "sucursal_2": 0}},
        ]})
    assert r.status_code == 200, r.text
    p = r.json()
    _abrir_caja(client, cajero)
    r = client.post("/api/sales/", headers=cajero["headers"], json={
        "items": [{"producto_id": p["id"], "variante_nombre": "Roja", "nombre_producto": "Funda",
                   "cantidad": 2, "precio_unitario": 5000, "subtotal": 10000}],
        "total": 10000, "pagos": [{"metodo": "efectivo", "monto": 0}]})
    assert r.status_code == 200, r.text
    doc = client.portal.call(database.get_db().productos.find_one, {"_id": ObjectId(p["id"])})
    stock = {v["nombre"]: v["stock_sucursal"]["sucursal_1"] for v in doc["variantes"]}
    assert stock == {"Negra": 3, "Roja": 0}


# ── Venta: doble clic, totales y medios de pago ─────────────────────────

def test_doble_clic_registra_una_sola_venta(client, cajero, producto, db):
    _abrir_caja(client, cajero)
    r1 = _vender(client, cajero, producto, clave_idempotencia="form-123")
    r2 = _vender(client, cajero, producto, clave_idempotencia="form-123")
    assert r1.status_code == 200 and r2.status_code == 200
    assert r1.json()["numero_venta"] == r2.json()["numero_venta"]
    assert client.portal.call(db.ventas.count_documents, {}) == 1
    assert _stock(client, producto["id"]) == 4


def test_claves_distintas_son_ventas_distintas(client, cajero, producto, db):
    _abrir_caja(client, cajero)
    assert _vender(client, cajero, producto, clave_idempotencia="a").status_code == 200
    assert _vender(client, cajero, producto, clave_idempotencia="b").status_code == 200
    assert client.portal.call(db.ventas.count_documents, {}) == 2
    assert _stock(client, producto["id"]) == 3


def test_sin_caja_abierta_no_se_puede_vender(client, cajero, producto):
    r = _vender(client, cajero, producto)
    assert r.status_code == 400
    assert _stock(client, producto["id"]) == 5


def test_precio_y_descuento_los_calcula_el_servidor(client, cajero, producto):
    _abrir_caja(client, cajero)
    # Un total armado en el navegador que no coincide con los precios reales se rechaza
    r = _vender(client, cajero, producto, total=1)
    assert r.status_code == 409
    # 10 % de descuento sobre 2 × 10.000 = 18.000
    r = _vender(client, cajero, producto, cantidad=2, total=18000,
                tipo_ajuste="descuento", porcentaje_ajuste=10)
    assert r.status_code == 200, r.text
    assert r.json()["total"] == 18000


def test_recargo_en_porcentaje(client, cajero, producto):
    _abrir_caja(client, cajero)
    r = _vender(client, cajero, producto, total=11000, tipo_ajuste="interes", porcentaje_ajuste=10)
    assert r.status_code == 200, r.text
    assert r.json()["total"] == 11000


def test_pago_mixto_debe_sumar_el_total(client, cajero, producto):
    _abrir_caja(client, cajero)
    r = _vender(client, cajero, producto, pagos=[
        {"metodo": "efectivo", "monto": 4000}, {"metodo": "transferencia", "monto": 5000}])
    assert r.status_code == 400
    r = _vender(client, cajero, producto, pagos=[
        {"metodo": "efectivo", "monto": 4000}, {"metodo": "transferencia", "monto": 6000}])
    assert r.status_code == 200, r.text


def test_efectivo_se_carga_una_sola_vez(client, cajero, producto):
    _abrir_caja(client, cajero)
    r = _vender(client, cajero, producto, pagos=[
        {"metodo": "efectivo", "monto": 5000}, {"metodo": "efectivo", "monto": 5000}])
    assert r.status_code == 400


def test_cobro_en_dolares_con_vuelto_en_pesos(client, cajero, admin, producto, db):
    assert client.put("/api/cotizacion/", headers=admin["headers"], json={"valor": 1000}).status_code == 200
    _abrir_caja(client, cajero)
    # Total $ 10.000; el cliente paga USD 15 = $ 15.000; vuelto $ 5.000
    r = _vender(client, cajero, producto, pagos=[{"metodo": "usd", "monto": 15}])
    assert r.status_code == 200, r.text
    assert r.json()["vuelto"] == 5000
    venta = client.portal.call(db.ventas.find_one, {})
    assert venta["cotizacion_usd"] == 1000
    assert venta["pagos"][0]["usd"] == 15


def test_dolares_que_no_alcanzan(client, cajero, admin, producto):
    client.put("/api/cotizacion/", headers=admin["headers"], json={"valor": 1000})
    _abrir_caja(client, cajero)
    r = _vender(client, cajero, producto, pagos=[{"metodo": "usd", "monto": 5}])
    assert r.status_code == 400


# ── Cancelación ──────────────────────────────────────────────────────────

def test_cancelar_venta_devuelve_stock_y_dinero(client, cajero, producto, db):
    caja_id = _abrir_caja(client, cajero)
    venta = _vender(client, cajero, producto, cantidad=2).json()
    assert _stock(client, producto["id"]) == 3
    r = client.put(f"/api/sales/{venta['id']}/cancel", headers=cajero["headers"])
    assert r.status_code == 200, r.text
    assert _stock(client, producto["id"]) == 5
    caja = client.portal.call(db.cajas.find_one, {"_id": ObjectId(caja_id)})
    egresos = [m for m in caja["movimientos"] if m.get("concepto") == "cancelacion_venta"]
    assert len(egresos) == 1 and egresos[0]["monto"] == 20000 and egresos[0]["tipo"] == "egreso"
    # No se puede cancelar dos veces
    assert client.put(f"/api/sales/{venta['id']}/cancel", headers=cajero["headers"]).status_code == 400
    assert _stock(client, producto["id"]) == 5


def test_el_vendedor_no_cancela_ventas(client, cajero, vendedor, producto):
    _abrir_caja(client, cajero)
    venta = _vender(client, cajero, producto).json()
    assert client.put(f"/api/sales/{venta['id']}/cancel", headers=vendedor["headers"]).status_code == 403


# ── Caja ─────────────────────────────────────────────────────────────────

def test_una_caja_por_sucursal_y_por_usuario(client, cajero, nuevo_usuario):
    _abrir_caja(client, cajero)
    otro = nuevo_usuario("Cajero Dos", "cajero")
    r = client.post("/api/cash/abrir", headers=otro["headers"],
                    json={"monto_inicial": 0, "sucursal": "sucursal_1"})
    assert r.status_code == 400
    r = client.post("/api/cash/abrir", headers=cajero["headers"],
                    json={"monto_inicial": 0, "sucursal": "sucursal_1"})
    assert r.status_code == 400


def test_cierre_de_caja_sin_diferencias(client, cajero, admin):
    p = _producto(client, admin, stock1=10, precio=10000)
    _abrir_caja(client, cajero, monto=5000)
    assert _vender(client, cajero, p).status_code == 200                       # efectivo 10.000
    assert _vender(client, cajero, p, pagos=[
        {"metodo": "efectivo", "monto": 4000}, {"metodo": "transferencia", "monto": 6000}]).status_code == 200
    r = client.post("/api/cash/movimiento", headers=cajero["headers"], json={
        "tipo": "egreso", "monto": 1000, "motivo": "Artículos de limpieza", "metodo_pago": "efectivo"})
    assert r.status_code == 200, r.text

    # Efectivo esperado: 5.000 inicial + 10.000 + 4.000 − 1.000 = 18.000; transferencias: 6.000
    r = client.post("/api/cash/cerrar", headers=cajero["headers"], json={
        "montos_por_metodo": [{"metodo": "efectivo", "monto": 18000}, {"metodo": "transferencia", "monto": 6000}],
        "dejar_en_caja": 5000})
    assert r.status_code == 200, r.text
    cierre = r.json()
    assert cierre["esperado_por_metodo"]["efectivo"] == 18000
    assert cierre["esperado_por_metodo"]["transferencia"] == 6000
    assert cierre["diferencias_por_metodo"] == {"efectivo": 0, "transferencia": 0}
    assert cierre["diferencia"] == 0
    assert cierre["monto_dejado"] == 5000 and cierre["monto_retirado"] == 13000


def test_cierre_de_caja_muestra_de_que_medio_sale_la_diferencia(client, cajero, admin):
    p = _producto(client, admin, stock1=10, precio=10000)
    _abrir_caja(client, cajero, monto=0)
    _vender(client, cajero, p)
    _vender(client, cajero, p, pagos=[{"metodo": "transferencia", "monto": 0}])
    r = client.post("/api/cash/cerrar", headers=cajero["headers"], json={
        "montos_por_metodo": [{"metodo": "efectivo", "monto": 9500}, {"metodo": "transferencia", "monto": 10000}]})
    assert r.status_code == 200, r.text
    assert r.json()["diferencias_por_metodo"] == {"efectivo": -500, "transferencia": 0}


def test_venta_cancelada_no_suma_en_el_cierre(client, cajero, producto):
    _abrir_caja(client, cajero, monto=0)
    venta = _vender(client, cajero, producto).json()
    client.put(f"/api/sales/{venta['id']}/cancel", headers=cajero["headers"])
    r = client.post("/api/cash/cerrar", headers=cajero["headers"], json={
        "montos_por_metodo": [{"metodo": "efectivo", "monto": 0}]})
    assert r.status_code == 200, r.text
    assert r.json()["diferencias_por_metodo"]["efectivo"] == 0


def test_no_se_deja_en_caja_mas_de_lo_contado(client, cajero):
    _abrir_caja(client, cajero, monto=1000)
    r = client.post("/api/cash/cerrar", headers=cajero["headers"], json={
        "montos_por_metodo": [{"metodo": "efectivo", "monto": 1000}], "dejar_en_caja": 2000})
    assert r.status_code == 400
