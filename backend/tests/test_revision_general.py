"""Revisión general: validaciones, cobros y cancelaciones seguras, permisos,
listados sin tope y reportes en horario argentino."""
from datetime import datetime, timedelta

import pytest
from bson import ObjectId

from app import database
from app.utils.cajas import rango_periodo
from tests.test_ventas_stock_caja import _producto, _abrir_caja, _vender


# ── Caja ────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("datos", [
    {"tipo": "robo", "monto": 100, "motivo": "x"},
    {"tipo": "ingreso", "monto": -100, "motivo": "x"},
    {"tipo": "egreso", "monto": 0, "motivo": "x"},
    {"tipo": "ingreso", "monto": 10, "motivo": "x", "metodo_pago": "bitcoin"},
    {"tipo": "ingreso", "monto": 10, "motivo": "   "},
])
def test_movimiento_de_caja_invalido(client, cajero, datos):
    _abrir_caja(client, cajero)
    assert client.post("/api/cash/movimiento", headers=cajero["headers"], json=datos).status_code == 422


def test_cierre_con_montos_negativos(client, cajero):
    _abrir_caja(client, cajero)
    r = client.post("/api/cash/cerrar", headers=cajero["headers"], json={
        "montos_por_metodo": [{"metodo": "efectivo", "monto": 10000}, {"metodo": "transferencia", "monto": -5}]})
    assert r.status_code == 422


# ── Productos ───────────────────────────────────────────────────────────

def _cat(client, admin):
    return client.post("/api/categories/", headers=admin["headers"], json={"nombre": "Varios"}).json()["id"]


@pytest.mark.parametrize("cambio", [
    {"precio_venta": -10}, {"precio_costo": -1}, {"nombre": "   "}, {"categoria_id": "000000000000000000000000"},
])
def test_producto_invalido(client, admin, cambio):
    datos = {"nombre": "Funda", "categoria_id": _cat(client, admin), "unidad_medida": "unidad",
             "precio_costo": 5, "precio_venta": 10, **cambio}
    assert client.post("/api/products/", headers=admin["headers"], json=datos).status_code in (400, 422)


def test_editar_producto_con_precio_negativo(client, admin):
    p = _producto(client, admin)
    assert client.put(f"/api/products/{p['id']}", headers=admin["headers"], json={"precio_venta": -1}).status_code == 422


# ── Reparaciones ────────────────────────────────────────────────────────

def _orden(client, user, precio=20000, **extra):
    c = client.post("/api/clients/", headers=user["headers"], json={"nombre": "Ana"}).json()
    return client.post("/api/repairs/", headers=user["headers"], json={
        "cliente_id": c["id"], "equipo": {"marca": "Samsung", "modelo": "A10"},
        "tipos_reparacion": [{"tipo_id": "x", "nombre": "Pantalla", "precio": precio}], **extra})


def test_orden_no_nace_entregada(client, vendedor):
    r = _orden(client, vendedor, estado="entregada")
    assert r.status_code == 200 and r.json()["estado"] == "ingresada"


@pytest.mark.parametrize("extra", [{"garantia_dias": -5}])
def test_orden_garantia_negativa(client, vendedor, extra):
    assert _orden(client, vendedor, **extra).status_code == 422


def test_orden_precio_negativo(client, vendedor):
    assert _orden(client, vendedor, precio=-500).status_code == 422


def test_sin_saldo_no_se_cobra_ni_en_dolares(client, cajero):
    _abrir_caja(client, cajero)
    o = _orden(client, cajero).json()
    r = client.post(f"/api/repairs/{o['id']}/pago", headers=cajero["headers"], json={"monto": 20000, "tipo": "total", "metodo": "efectivo"})
    assert r.status_code == 200
    r = client.post(f"/api/repairs/{o['id']}/pago", headers=cajero["headers"], json={"monto": 5, "tipo": "saldo", "metodo": "usd"})
    assert r.status_code == 400
    caja = client.get("/api/cash/actual", headers=cajero["headers"]).json()
    assert len([m for m in caja["movimientos"] if m.get("referencia_id") == o["id"]]) == 1


def test_cobro_sobre_orden_que_cambio_mientras_tanto(client, cajero, db):
    """Si otro cobro se registró entre la lectura y la escritura, no se pisa."""
    _abrir_caja(client, cajero)
    o = _orden(client, cajero).json()
    from app.routers import repairs as mod
    original = mod.planear_cobro

    async def con_cobro_en_medio(*a, **k):
        plan = await original(*a, **k)
        await database.get_db().reparaciones.update_one({"_id": ObjectId(o["id"])}, {"$inc": {"total_pagado": 1000}})
        return plan
    mod.planear_cobro = con_cobro_en_medio
    try:
        r = client.post(f"/api/repairs/{o['id']}/pago", headers=cajero["headers"], json={"monto": 20000, "tipo": "total", "metodo": "efectivo"})
    finally:
        mod.planear_cobro = original
    assert r.status_code == 409
    caja = client.get("/api/cash/actual", headers=cajero["headers"]).json()
    assert not [m for m in caja["movimientos"] if m.get("referencia_id") == o["id"]]


def test_cancelar_dos_veces_devuelve_una_sola_vez(client, cajero):
    _abrir_caja(client, cajero)
    o = _orden(client, cajero).json()
    client.post(f"/api/repairs/{o['id']}/pago", headers=cajero["headers"], json={"monto": 5000, "tipo": "seña", "metodo": "efectivo"})
    assert client.put(f"/api/repairs/{o['id']}/cancelar", headers=cajero["headers"]).status_code == 200
    assert client.put(f"/api/repairs/{o['id']}/cancelar", headers=cajero["headers"]).status_code == 400
    caja = client.get("/api/cash/actual", headers=cajero["headers"]).json()
    egresos = [m for m in caja["movimientos"] if m.get("referencia_id") == o["id"] and m["tipo"] == "egreso"]
    assert len(egresos) == 1 and egresos[0]["monto"] == 5000


# ── Permisos ────────────────────────────────────────────────────────────

def test_tecnico_no_ve_proveedores(client, tecnico):
    assert client.get("/api/suppliers/", headers=tecnico["headers"]).status_code == 403


def test_tecnico_ve_clientes(client, tecnico):
    assert client.get("/api/clients/", headers=tecnico["headers"]).status_code == 200


# ── Listados sin tope ───────────────────────────────────────────────────

def test_ventas_viejas_se_encuentran_por_fecha_y_numero(client, admin, cajero, db):
    p = _producto(client, admin, stock1=50)
    _abrir_caja(client, cajero)
    v = _vender(client, cajero, p).json()
    hace_un_anio = datetime.utcnow() - timedelta(days=365)
    client.portal.call(db.ventas.update_one, {"_id": ObjectId(v["id"])}, {"$set": {"fecha": hace_un_anio}})
    for _ in range(3):
        _vender(client, cajero, p)
    assert v["numero_venta"] not in [x["numero_venta"] for x in client.get("/api/sales/?limite=3", headers=admin["headers"]).json()]
    dia = (hace_un_anio - timedelta(hours=3)).strftime("%Y-%m-%d")
    por_fecha = client.get(f"/api/sales/?desde={dia}&hasta={dia}&limite=3", headers=admin["headers"]).json()
    assert [x["numero_venta"] for x in por_fecha] == [v["numero_venta"]]
    por_numero = client.get(f"/api/sales/?q={v['numero_venta']}&limite=3", headers=admin["headers"]).json()
    assert [x["numero_venta"] for x in por_numero] == [v["numero_venta"]]


def test_reparaciones_en_curso_nunca_se_pierden(client, vendedor, db):
    o = _orden(client, vendedor).json()
    # Una orden en curso muy vieja y muchas entregadas más nuevas
    client.portal.call(db.reparaciones.update_one, {"_id": ObjectId(o["id"])},
                       {"$set": {"fecha_ingreso": datetime.utcnow() - timedelta(days=900)}})
    client.portal.call(db.reparaciones.insert_many, [
        {"numero_orden": f"OR-X{i}", "estado": "entregada", "fecha_ingreso": datetime.utcnow(), "equipo": {}}
        for i in range(30)])
    numeros = [r["numero_orden"] for r in client.get("/api/repairs/", headers=vendedor["headers"]).json()]
    assert o["numero_orden"] in numeros


# ── Reportes en horario argentino ───────────────────────────────────────

def test_rango_incluye_el_dia_hasta_completo_de_aca():
    inicio, fin = rango_periodo(None, "2026-11-01", "2026-11-30")
    assert inicio == datetime(2026, 11, 1, 3, 0)           # 00:00 de acá
    assert fin > datetime(2026, 12, 1, 2, 59) and fin < datetime(2026, 12, 1, 3, 0)  # 23:59 del 30 de acá


def test_rango_invertido_o_mal_escrito():
    from fastapi import HTTPException
    for d, h in [("2026-12-30", "2026-01-01"), ("30/12/2026", None)]:
        with pytest.raises(HTTPException):
            rango_periodo(None, d, h)


def test_reporte_de_ventas_no_suma_canceladas_ni_usa_el_dia_utc(client, admin, cajero, db):
    p = _producto(client, admin, stock1=10)
    _abrir_caja(client, cajero)
    a = _vender(client, cajero, p).json()
    b = _vender(client, cajero, p).json()
    client.put(f"/api/sales/{b['id']}/cancel", headers=cajero["headers"])
    # Una venta a las 22:30 de acá (01:30 UTC del día siguiente)
    noche = datetime(2026, 11, 10, 1, 30)
    client.portal.call(db.ventas.update_one, {"_id": ObjectId(a["id"])}, {"$set": {"fecha": noche}})
    r = client.get("/api/reports/ventas?desde=2026-11-09&hasta=2026-11-09", headers=admin["headers"]).json()
    assert r["cantidad_ventas"] == 1
    assert r["por_dia"] == [{"fecha": "2026-11-09", "total": a["total"]}]
    hoy = client.get("/api/reports/ventas?periodo=dia", headers=admin["headers"]).json()
    assert sum(x["total"] for x in hoy["por_metodo"]) == 0  # la cancelada no suma


def test_rentabilidad_usa_el_costo_del_momento_de_la_venta(client, admin, cajero):
    p = _producto(client, admin, precio=10000)  # costo 5000
    _abrir_caja(client, cajero)
    _vender(client, cajero, p)
    client.put(f"/api/products/{p['id']}", headers=admin["headers"], json={"precio_costo": 9000})
    r = client.get("/api/reports/rentabilidad?periodo=dia", headers=admin["headers"]).json()
    assert r["total_costo"] == 5000 and r["ganancia"] == 5000
