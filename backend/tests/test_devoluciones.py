"""Devoluciones de ventas de cualquier fecha."""
from datetime import datetime, timedelta

from bson import ObjectId

from tests.test_ventas_stock_caja import _producto, _abrir_caja


def _vender(client, user, p, cantidad=2):
    datos = {"items": [{"producto_id": p["id"], "nombre_producto": p["nombre"], "cantidad": cantidad,
                        "precio_unitario": p["precio_venta"], "subtotal": p["precio_venta"] * cantidad}],
             "total": p["precio_venta"] * cantidad, "metodo_pago": "efectivo",
             "pagos": [{"metodo": "efectivo", "monto": p["precio_venta"] * cantidad}]}
    r = client.post("/api/sales/", headers=user["headers"], json=datos)
    assert r.status_code == 200, r.text
    return r.json()


def _stock(client, admin, pid, suc="sucursal_1"):
    p = next(x for x in client.get("/api/products/", headers=admin["headers"]).json() if x["id"] == pid)
    return p["stock_sucursal"][suc]


def _cerrar_y_reabrir(client, cajero, db):
    client.post("/api/cash/cerrar", headers=cajero["headers"], json={"montos_por_metodo": [{"metodo": "efectivo", "monto": 0}]})
    # La caja de hoy ya se cerró: se simula que es otro día
    client.portal.call(db.cajas.update_many, {}, {"$set": {"fecha_apertura": datetime.utcnow() - timedelta(days=1), "dia": "2000-01-01"}})
    client.portal.call(db.ventas.update_many, {}, {"$set": {"fecha": datetime.utcnow() - timedelta(days=1)}})
    _abrir_caja(client, cajero)
    # Efectivo en la caja nueva para poder devolver
    client.post("/api/cash/movimiento", headers=cajero["headers"], json={
        "tipo": "ingreso", "monto": 100000, "motivo": "Cambio", "metodo_pago": "efectivo"})


def test_devolucion_de_venta_vieja(client, admin, cajero, db):
    p = _producto(client, admin, stock1=10, precio=10000)
    _abrir_caja(client, cajero)
    v = _vender(client, cajero, p, 2)
    _cerrar_y_reabrir(client, cajero, db)
    # Cancelar ya no se puede: queda la devolución
    assert client.put(f"/api/sales/{v['id']}/cancel", headers=cajero["headers"]).status_code == 400
    stock_antes = _stock(client, admin, p["id"])
    r = client.post(f"/api/sales/{v['id']}/devolucion", headers=cajero["headers"], json={
        "items": [{"indice": 0, "cantidad": 1, "vuelve_stock": True}], "metodo": "efectivo", "motivo": "No le gustó"})
    assert r.status_code == 200, r.text
    assert r.json()["numero"] == "D-0001" and r.json()["monto"] == 10000
    assert _stock(client, admin, p["id"]) == stock_antes + 1
    caja = client.get("/api/cash/actual", headers=cajero["headers"]).json()
    egresos = [m for m in caja["movimientos"] if m.get("concepto") == "devolucion_venta"]
    assert [m["monto"] for m in egresos] == [10000]
    # La segunda unidad vino fallada: no vuelve al stock
    r = client.post(f"/api/sales/{v['id']}/devolucion", headers=cajero["headers"], json={
        "items": [{"indice": 0, "cantidad": 1, "vuelve_stock": False}], "metodo": "transferencia"})
    assert r.status_code == 200, r.text
    assert _stock(client, admin, p["id"]) == stock_antes + 1
    venta = client.get(f"/api/sales/{v['id']}", headers=admin["headers"]).json()
    assert venta["estado"] == "completada" and venta["total_devuelto"] == 20000 and len(venta["devoluciones"]) == 2
    # Ya no queda nada para devolver
    r = client.post(f"/api/sales/{v['id']}/devolucion", headers=cajero["headers"], json={
        "items": [{"indice": 0, "cantidad": 1}], "metodo": "efectivo"})
    assert r.status_code == 400


def test_devolucion_validaciones(client, admin, cajero, vendedor):
    p = _producto(client, admin, stock1=10, precio=10000)
    _abrir_caja(client, cajero)
    v = _vender(client, cajero, p, 2)
    url = f"/api/sales/{v['id']}/devolucion"
    h = cajero["headers"]
    assert client.post(url, headers=vendedor["headers"], json={"items": [{"indice": 0, "cantidad": 1}]}).status_code == 403
    assert client.post(url, headers=h, json={"items": [{"indice": 0, "cantidad": 3}]}).status_code == 400
    assert client.post(url, headers=h, json={"items": [{"indice": 5, "cantidad": 1}]}).status_code == 400
    assert client.post(url, headers=h, json={"items": [{"indice": 0, "cantidad": 0}]}).status_code == 400
    assert client.post(url, headers=h, json={"items": [{"indice": 0, "cantidad": 1}], "metodo": "usd"}).status_code == 400
    assert client.post(url, headers=h, json={"items": [{"indice": 0, "cantidad": 1}], "monto": 999999}).status_code == 400
    # Monto a mano (menor): se respeta
    r = client.post(url, headers=h, json={"items": [{"indice": 0, "cantidad": 1}], "monto": 8000})
    assert r.status_code == 200 and r.json()["monto"] == 8000
    # Con devoluciones, cancelar ya no se puede (devolvería dos veces)
    assert client.put(f"/api/sales/{v['id']}/cancel", headers=h).status_code == 400


def test_devolucion_con_descuento_devuelve_lo_pagado(client, admin, cajero):
    p = _producto(client, admin, stock1=10, precio=10000)
    _abrir_caja(client, cajero)
    r = client.post("/api/sales/", headers=cajero["headers"], json={
        "items": [{"producto_id": p["id"], "nombre_producto": p["nombre"], "cantidad": 2, "precio_unitario": 10000, "subtotal": 20000}],
        "total": 18000, "tipo_ajuste": "descuento", "porcentaje_ajuste": 10, "metodo_pago": "efectivo",
        "pagos": [{"metodo": "efectivo", "monto": 18000}]})
    assert r.status_code == 200, r.text
    d = client.post(f"/api/sales/{r.json()['id']}/devolucion", headers=cajero["headers"], json={"items": [{"indice": 0, "cantidad": 1}]})
    assert d.status_code == 200 and d.json()["monto"] == 9000


def test_devolucion_sin_caja_de_la_sucursal(client, admin, cajero, db):
    p = _producto(client, admin, stock1=10)
    _abrir_caja(client, cajero)
    v = _vender(client, cajero, p, 1)
    client.post("/api/cash/cerrar", headers=cajero["headers"], json={"montos_por_metodo": [{"metodo": "efectivo", "monto": 0}]})
    r = client.post(f"/api/sales/{v['id']}/devolucion", headers=admin["headers"], json={"items": [{"indice": 0, "cantidad": 1}]})
    assert r.status_code == 400 and "caja" in r.json()["detail"]


def test_reportes_restan_las_devoluciones_el_dia_que_se_hacen(client, admin, cajero, db):
    p = _producto(client, admin, stock1=10, precio=10000)   # costo 5000
    _abrir_caja(client, cajero)
    v = _vender(client, cajero, p, 2)
    _cerrar_y_reabrir(client, cajero, db)   # la venta queda "ayer"
    client.post(f"/api/sales/{v['id']}/devolucion", headers=cajero["headers"], json={
        "items": [{"indice": 0, "cantidad": 1, "vuelve_stock": True}], "metodo": "efectivo"})
    h = admin["headers"]
    hoy = client.get("/api/reports/ventas?periodo=dia", headers=h).json()
    assert hoy["total"] == -10000 and hoy["total_devoluciones"] == 10000 and hoy["cantidad_devoluciones"] == 1
    rent = client.get("/api/reports/rentabilidad?periodo=dia", headers=h).json()
    assert rent["total_ingresos"] == -10000 and rent["total_costo"] == -5000 and rent["ganancia"] == -5000
    prods = client.get("/api/reports/productos-vendidos?periodo=dia", headers=h).json()["productos"]
    fila = next(f for f in prods if f["id"] == p["id"])
    assert fila["cantidad_total"] == -1 and fila["devueltas"] == 1
    semana = client.get("/api/reports/ventas?periodo=semana", headers=h).json()
    assert semana["total"] == 10000   # vendió 2, devolvió 1
    assert client.get("/api/reports/dashboard", headers=h).json()["total_ventas_hoy"] == -10000


def test_monto_no_supera_lo_pagado_por_las_unidades(client, admin, cajero):
    p = _producto(client, admin, stock1=10, precio=10000)
    _abrir_caja(client, cajero)
    v = _vender(client, cajero, p, 2)
    url = f"/api/sales/{v['id']}/devolucion"
    # 1 de 2 unidades: como máximo 10.000 (no los 20.000 de toda la venta)
    assert client.post(url, headers=cajero["headers"], json={"items": [{"indice": 0, "cantidad": 1}], "monto": 20000}).status_code == 400
    r = client.post(url, headers=cajero["headers"], json={"items": [{"indice": 0, "cantidad": 1}], "monto": 10000})
    assert r.status_code == 200


def test_sin_efectivo_en_caja_no_se_devuelve_en_efectivo(client, admin, cajero):
    p = _producto(client, admin, stock1=10, precio=10000)
    _abrir_caja(client, cajero)   # $ 10.000 iniciales
    v = _vender(client, cajero, p, 2)   # + $ 20.000 en efectivo
    # Se retira casi todo el efectivo
    assert client.post("/api/cash/movimiento", headers=cajero["headers"], json={
        "tipo": "egreso", "monto": 25000, "motivo": "Retiro", "metodo_pago": "efectivo"}).status_code == 200
    # Un egreso que dejaría la caja en negativo
    r = client.post("/api/cash/movimiento", headers=cajero["headers"], json={
        "tipo": "egreso", "monto": 6000, "motivo": "Otro retiro", "metodo_pago": "efectivo"})
    assert r.status_code == 400 and "En la caja hay $ 5.000,00" in r.json()["detail"]
    url = f"/api/sales/{v['id']}/devolucion"
    r = client.post(url, headers=cajero["headers"], json={"items": [{"indice": 0, "cantidad": 1}], "metodo": "efectivo"})
    assert r.status_code == 400 and "efectivo" in r.json()["detail"]
    # Por transferencia sí
    r = client.post(url, headers=cajero["headers"], json={"items": [{"indice": 0, "cantidad": 1}], "metodo": "transferencia"})
    assert r.status_code == 200, r.text
    # Cancelar tampoco: devolvería $ 20.000 en efectivo que no están
    assert client.put(f"/api/sales/{v['id']}/cancel", headers=cajero["headers"]).status_code == 400


def test_reporte_por_vendedor_resta_devoluciones(client, admin, cajero, db):
    p = _producto(client, admin, stock1=10, precio=10000)
    _abrir_caja(client, cajero)
    v = _vender(client, cajero, p, 2)
    client.post(f"/api/sales/{v['id']}/devolucion", headers=cajero["headers"], json={
        "items": [{"indice": 0, "cantidad": 1}], "metodo": "transferencia"})
    r = client.get("/api/reports/ventas?periodo=dia", headers=admin["headers"]).json()
    assert sum(f["total"] for f in r["por_vendedor"]) == r["total"] == 10000
