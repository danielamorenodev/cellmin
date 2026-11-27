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


# ── El administrador vende en la caja abierta de la sucursal que elija ──

def _abrir(client, user, sucursal):
    r = client.post("/api/cash/abrir", headers=user["headers"], json={"monto_inicial": 1000, "sucursal": sucursal})
    assert r.status_code == 200, r.text


def _venta(client, user, p, sucursal=None):
    datos = {"items": [{"producto_id": p["id"], "nombre_producto": p["nombre"], "cantidad": 1,
                        "precio_unitario": p["precio_venta"], "subtotal": p["precio_venta"]}],
             "total": p["precio_venta"], "metodo_pago": "efectivo",
             "pagos": [{"metodo": "efectivo", "monto": p["precio_venta"]}]}
    if sucursal:
        datos["sucursal"] = sucursal
    return client.post("/api/sales/", headers=user["headers"], json=datos)


def test_admin_vende_en_caja_de_otro(client, admin, nuevo_usuario):
    c1 = nuevo_usuario("Cajero S1", "cajero", ("sucursal_1",))
    c2 = nuevo_usuario("Cajero S2", "cajero", ("sucursal_2",))
    p = _producto(client, admin, stock1=5, stock2=5)
    assert client.get("/api/cash/para-vender", headers=admin["headers"]).json()["estado"] == "cerrada"
    _abrir(client, c1, "sucursal_1")
    # Una sola caja abierta: vende ahí sin elegir
    r = _venta(client, admin, p)
    assert r.status_code == 200, r.text
    _abrir(client, c2, "sucursal_2")
    # Dos abiertas: tiene que elegir
    caja = client.get("/api/cash/para-vender", headers=admin["headers"]).json()
    assert caja["estado"] == "cerrada" and "elegí" in caja["motivo"]
    assert _venta(client, admin, p).status_code == 400
    r = _venta(client, admin, p, "sucursal_2")
    assert r.status_code == 200, r.text
    venta = client.get(f"/api/sales/{r.json()['id']}", headers=admin["headers"]).json()
    assert venta["sucursal"] == "sucursal_2" and venta["vendedor_nombre"] == "Admin"
    # La venta entra en la caja del cajero de esa sucursal
    caja2 = client.get("/api/cash/actual", headers=c2["headers"]).json()
    assert caja2["total_ventas_hoy"] == p["precio_venta"]
    # El historial dice quién abrió cada caja
    hist = client.get("/api/cash/historial", headers=admin["headers"]).json()
    assert {h["usuario_apertura_nombre"] for h in hist} == {"Cajero S1", "Cajero S2"}
