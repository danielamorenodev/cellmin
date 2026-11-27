"""Depósito (y cualquier usuario que no sea admin) mueve stock solo de sus sucursales asignadas."""
from tests.test_ventas_stock_caja import _producto


def _compra(client, user, prov, p, sucursal):
    return client.post("/api/purchases/", headers=user["headers"], json={
        "proveedor_id": prov, "sucursal": sucursal, "total": 0,
        "items": [{"producto_id": p["id"], "nombre_producto": "x", "cantidad": 2, "precio_unitario": 100, "subtotal": 200}]})


def test_deposito_solo_en_sus_sucursales(client, admin, nuevo_usuario):
    dep = nuevo_usuario("Deposito Uno", "deposito", ("sucursal_1",))
    p = _producto(client, admin, stock1=10)
    prov = client.post("/api/suppliers/", headers=admin["headers"], json={"nombre": "Prov"}).json()["id"]

    # Ingreso de mercadería
    assert _compra(client, dep, prov, p, "sucursal_1").status_code == 200
    assert _compra(client, dep, prov, p, "sucursal_2").status_code == 403
    # Anular un ingreso de otra sucursal
    otra = _compra(client, admin, prov, p, "sucursal_2").json()
    assert client.put(f"/api/purchases/{otra['id']}/cancelar", headers=dep["headers"]).status_code == 403
    # Movimiento de stock
    mov = {"producto_id": p["id"], "tipo": "entrada", "cantidad": 1, "motivo": "ajuste"}
    assert client.post("/api/stock/movimiento", headers=dep["headers"], json={**mov, "sucursal": "sucursal_1"}).status_code == 200
    assert client.post("/api/stock/movimiento", headers=dep["headers"], json={**mov, "sucursal": "sucursal_2"}).status_code == 403
    # Remito: envía desde la suya (a cualquiera), no puede traer desde la otra
    item = [{"producto_id": p["id"], "cantidad": 1}]
    assert client.post("/api/remitos/", headers=dep["headers"], json={"origen": "sucursal_1", "destino": "sucursal_2", "items": item}).status_code == 200
    assert client.post("/api/remitos/", headers=dep["headers"], json={"origen": "sucursal_2", "destino": "sucursal_1", "items": item}).status_code == 403


def test_deposito_con_las_dos_sucursales(client, admin, nuevo_usuario):
    dep = nuevo_usuario("Deposito Dos", "deposito", ("sucursal_1", "sucursal_2"))
    p = _producto(client, admin, stock1=10)
    prov = client.post("/api/suppliers/", headers=admin["headers"], json={"nombre": "Prov"}).json()["id"]
    assert _compra(client, dep, prov, p, "sucursal_2").status_code == 200
