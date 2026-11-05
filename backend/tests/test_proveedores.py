"""Proveedores: alta y cuenta corriente (cuánto se le debe)."""
import pytest


@pytest.fixture()
def deposito(nuevo_usuario):
    return nuevo_usuario("Deposito Uno", "deposito")


def _proveedor(client, user, **extra):
    r = client.post("/api/suppliers/", headers=user["headers"], json={
        "nombre": "Distribuidora Sur", "cuit": "", "telefono": "", "email": "", "direccion": "", "contacto": "", **extra})
    assert r.status_code == 200, r.text
    return r.json()


def test_proveedor_con_campos_vacios(client, deposito):
    p = _proveedor(client, deposito)
    assert p["email"] is None
    assert p["saldo_deuda"] == 0


def test_proveedor_id_invalido(client, deposito):
    assert client.get("/api/suppliers/xx", headers=deposito["headers"]).status_code == 404


def test_registrar_deuda_y_pagos(client, deposito):
    p = _proveedor(client, deposito)
    url = f"/api/suppliers/{p['id']}/cuenta"
    r = client.post(url, headers=deposito["headers"], json={"tipo": "deuda", "monto": 100000, "concepto": "Factura A 0001-123"})
    assert r.status_code == 200, r.text
    assert r.json()["saldo_deuda"] == 100000
    r = client.post(url, headers=deposito["headers"], json={"tipo": "pago", "monto": 30000.5, "metodo": "transferencia"})
    assert r.json()["saldo_deuda"] == 69999.5
    cuenta = client.get(url, headers=deposito["headers"]).json()
    assert cuenta["saldo_deuda"] == 69999.5
    assert [m["tipo"] for m in cuenta["movimientos"]] == ["pago", "deuda"]
    assert cuenta["movimientos"][0]["usuario_nombre"] == "Deposito Uno"
    lista = client.get("/api/suppliers/", headers=deposito["headers"]).json()
    assert lista[0]["saldo_deuda"] == 69999.5


def test_validaciones_de_movimientos(client, deposito, vendedor):
    p = _proveedor(client, deposito)
    url = f"/api/suppliers/{p['id']}/cuenta"
    assert client.post(url, headers=deposito["headers"], json={"tipo": "deuda", "monto": 0, "concepto": "x"}).status_code == 400
    assert client.post(url, headers=deposito["headers"], json={"tipo": "deuda", "monto": 10}).status_code == 400  # sin concepto
    assert client.post(url, headers=deposito["headers"], json={"tipo": "regalo", "monto": 10}).status_code == 400
    assert client.post(url, headers=vendedor["headers"], json={"tipo": "pago", "monto": 10}).status_code == 403


def test_pago_mayor_queda_a_favor(client, deposito):
    p = _proveedor(client, deposito)
    r = client.post(f"/api/suppliers/{p['id']}/cuenta", headers=deposito["headers"], json={"tipo": "pago", "monto": 500})
    assert r.json()["saldo_deuda"] == -500


def test_anular_movimiento_solo_admin(client, deposito, admin):
    p = _proveedor(client, deposito)
    url = f"/api/suppliers/{p['id']}/cuenta"
    mov = client.post(url, headers=deposito["headers"], json={"tipo": "deuda", "monto": 1000, "concepto": "x"}).json()["movimiento"]
    assert client.delete(f"{url}/{mov['id']}", headers=deposito["headers"]).status_code == 403
    r = client.delete(f"{url}/{mov['id']}", headers=admin["headers"])
    assert r.status_code == 200
    assert r.json()["saldo_deuda"] == 0
    assert client.delete(f"{url}/{mov['id']}", headers=admin["headers"]).status_code == 400
    cuenta = client.get(url, headers=admin["headers"]).json()
    assert cuenta["movimientos"][0]["anulado"] is True


# ── Ingreso de mercadería que queda debiendo ─────────────────────────────

def _producto(client, admin):
    cat = client.post("/api/categories/", headers=admin["headers"], json={"nombre": "Repuestos"}).json()["id"]
    return client.post("/api/products/", headers=admin["headers"], json={
        "nombre": "Módulo A10", "categoria_id": cat, "unidad_medida": "unidad",
        "precio_costo": 10000, "precio_venta": 20000,
        "stock_sucursal": {"sucursal_1": 0, "sucursal_2": 0}}).json()


def _compra(client, user, proveedor_id, producto_id, **extra):
    return client.post("/api/purchases/", headers=user["headers"], json={
        "proveedor_id": proveedor_id, "sucursal": "sucursal_1",
        "items": [{"producto_id": producto_id, "nombre_producto": "Módulo A10", "cantidad": 3,
                   "precio_unitario": 10000, "subtotal": 999}],  # subtotal mal calculado a propósito
        "total": 1, **extra})


def test_compra_que_queda_debiendo(client, admin, deposito):
    prov = _proveedor(client, deposito)
    prod = _producto(client, admin)
    r = _compra(client, deposito, prov["id"], prod["id"], monto_adeudado=20000, numero_remito="R-55")
    assert r.status_code == 200, r.text
    assert r.json()["total"] == 30000  # se recalcula en el servidor
    cuenta = client.get(f"/api/suppliers/{prov['id']}/cuenta", headers=deposito["headers"]).json()
    assert cuenta["saldo_deuda"] == 20000
    assert cuenta["movimientos"][0]["numero_compra"] == r.json()["numero_compra"]
    assert "R-55" in cuenta["movimientos"][0]["concepto"]
    stock = client.get(f"/api/products/{prod['id']}", headers=admin["headers"]).json()["stock_sucursal"]["sucursal_1"]
    assert stock == 3

    # Cancelar la compra anula su deuda; esa deuda no se anula a mano
    mov_id = cuenta["movimientos"][0]["id"]
    assert client.delete(f"/api/suppliers/{prov['id']}/cuenta/{mov_id}", headers=admin["headers"]).status_code == 400
    assert client.put(f"/api/purchases/{r.json()['id']}/cancelar", headers=deposito["headers"]).status_code == 200
    assert client.get(f"/api/suppliers/{prov['id']}/cuenta", headers=deposito["headers"]).json()["saldo_deuda"] == 0


def test_compra_pagada_no_genera_deuda(client, admin, deposito):
    prov = _proveedor(client, deposito)
    prod = _producto(client, admin)
    assert _compra(client, deposito, prov["id"], prod["id"]).status_code == 200
    assert client.get(f"/api/suppliers/{prov['id']}/cuenta", headers=deposito["headers"]).json()["movimientos"] == []


def test_compra_deuda_mayor_al_total(client, admin, deposito):
    prov = _proveedor(client, deposito)
    prod = _producto(client, admin)
    assert _compra(client, deposito, prov["id"], prod["id"], monto_adeudado=40000).status_code == 400


def test_compra_validaciones(client, admin, deposito):
    prov = _proveedor(client, deposito)
    prod = _producto(client, admin)
    assert _compra(client, deposito, "000000000000000000000000", prod["id"]).status_code == 400
    assert _compra(client, deposito, prov["id"], "000000000000000000000000").status_code == 400
    r = client.post("/api/purchases/", headers=deposito["headers"], json={
        "proveedor_id": prov["id"], "items": [], "total": 0})
    assert r.status_code == 400
