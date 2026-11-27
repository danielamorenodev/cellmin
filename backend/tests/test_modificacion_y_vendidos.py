"""Fecha de última modificación de productos y reporte de productos vendidos."""
from datetime import datetime, timedelta

from bson import ObjectId

from app import database
from tests.test_ventas_stock_caja import _producto, _abrir_caja, _vender


def _fecha_mod(client, pid):
    p = client.portal.call(database.get_db().productos.find_one, {"_id": ObjectId(pid)})
    return p.get("fecha_modificacion")


def _envejecer(client, pid):
    viejo = datetime.utcnow() - timedelta(days=3)
    client.portal.call(database.get_db().productos.update_one, {"_id": ObjectId(pid)},
                       {"$set": {"fecha_modificacion": viejo}})
    return viejo


def test_editar_y_ajustar_actualiza_la_fecha(client, admin):
    p = _producto(client, admin)
    assert p["fecha_modificacion"] is not None
    viejo = _envejecer(client, p["id"])
    r = client.put(f"/api/products/{p['id']}", headers=admin["headers"], json={"precio_venta": 12000})
    assert r.status_code == 200, r.text
    assert _fecha_mod(client, p["id"]) > viejo
    viejo = _envejecer(client, p["id"])
    r = client.post("/api/stock/movimiento", headers=admin["headers"], json={
        "producto_id": p["id"], "tipo": "ajuste", "cantidad": 8, "sucursal": "sucursal_1", "motivo": "ajuste"})
    assert r.status_code == 200, r.text
    assert _fecha_mod(client, p["id"]) > viejo


def test_una_venta_no_cambia_la_fecha(client, admin, cajero):
    p = _producto(client, admin)
    viejo = _envejecer(client, p["id"])
    _abrir_caja(client, cajero)
    assert _vender(client, cajero, p).status_code == 200
    assert abs((_fecha_mod(client, p["id"]) - viejo).total_seconds()) < 1


def test_productos_vendidos_lista_todos_y_respeta_el_periodo(client, admin, cajero):
    a = _producto(client, admin, nombre="Funda")
    b = _producto(client, admin, nombre="Cargador")
    _abrir_caja(client, cajero)
    assert _vender(client, cajero, a, cantidad=2).status_code == 200
    assert _vender(client, cajero, a, cantidad=1).status_code == 200
    r = client.get("/api/reports/productos-vendidos?periodo=dia", headers=admin["headers"]).json()
    filas = {f["nombre"]: f for f in r["productos"]}
    assert filas["Funda"]["cantidad_total"] == 3
    assert filas["Funda"]["cantidad_ventas"] == 2
    assert filas["Funda"]["total_vendido"] == 30000
    assert filas["Cargador"]["cantidad_total"] == 0       # también los que no se vendieron
    assert r["productos"][0]["nombre"] == "Funda"          # los más vendidos primero
    # Un período sin ventas: todos en 0
    r = client.get("/api/reports/productos-vendidos?desde=2020-01-01&hasta=2020-01-31", headers=admin["headers"]).json()
    assert all(f["cantidad_total"] == 0 for f in r["productos"])
