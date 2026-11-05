"""Precio en pesos (fijo) o en dólares (sigue a la cotización)."""


def _dolar(client, admin, valor):
    r = client.put("/api/cotizacion/", headers=admin["headers"], json={"valor": valor})
    assert r.status_code == 200, r.text


def _categoria(client, admin):
    r = client.post("/api/categories/", headers=admin["headers"], json={"nombre": "Accesorios"})
    assert r.status_code == 200, r.text
    return r.json()["id"]


def _producto(client, admin, cat, **extra):
    datos = {"nombre": "Producto", "categoria_id": cat, "unidad_medida": "unidad",
             "precio_costo": 1000, "precio_venta": 2000,
             "stock_sucursal": {"sucursal_1": 5, "sucursal_2": 0}, **extra}
    r = client.post("/api/products/", headers=admin["headers"], json=datos)
    assert r.status_code == 200, r.text
    return r.json()


def test_producto_en_pesos_no_cambia_con_el_dolar(client, admin):
    _dolar(client, admin, 1000)
    cat = _categoria(client, admin)
    funda = _producto(client, admin, cat, nombre="Funda silicona")
    assert funda["precio_en_usd"] is False
    _dolar(client, admin, 1200)
    p = client.get(f"/api/products/{funda['id']}", headers=admin["headers"]).json()
    assert p["precio_venta"] == 2000
    assert p["precio_costo"] == 1000


def test_producto_en_dolares_sigue_la_cotizacion(client, admin):
    _dolar(client, admin, 1000)
    cat = _categoria(client, admin)
    cel = _producto(client, admin, cat, nombre="Samsung A15", precio_en_usd=True,
                    precio_costo_usd=150, precio_venta_usd=200)
    assert cel["precio_venta"] == 200_000
    assert cel["precio_costo"] == 150_000
    _dolar(client, admin, 1250.5)
    p = client.get(f"/api/products/{cel['id']}", headers=admin["headers"]).json()
    assert p["precio_venta"] == 250_100
    assert p["precio_costo"] == 187_575
    assert p["precio_venta_usd"] == 200


def test_variantes_en_dolares(client, admin):
    _dolar(client, admin, 1000)
    cat = _categoria(client, admin)
    var = {"precio_costo": 0, "precio_venta": 0, "stock_sucursal": {"sucursal_1": 2, "sucursal_2": 0}}
    p = _producto(client, admin, cat, nombre="iPhone 13", tiene_variantes=True, precio_en_usd=True,
                  precio_costo=None, precio_venta=None, variantes=[
                      {**var, "nombre": "128 GB", "precio_costo_usd": 400, "precio_venta_usd": 500},
                      {**var, "nombre": "256 GB", "precio_costo_usd": 450, "precio_venta_usd": 600},
                  ])
    assert [v["precio_venta"] for v in p["variantes"]] == [500_000, 600_000]
    _dolar(client, admin, 1100)
    p = client.get(f"/api/products/{p['id']}", headers=admin["headers"]).json()
    assert [v["precio_venta"] for v in p["variantes"]] == [550_000, 660_000]
    assert p["variantes"][0]["stock_sucursal"]["sucursal_1"] == 2


def test_pasar_de_dolares_a_pesos_lo_deja_fijo(client, admin):
    _dolar(client, admin, 1000)
    cat = _categoria(client, admin)
    p = _producto(client, admin, cat, precio_en_usd=True, precio_venta_usd=10, precio_costo_usd=5)
    r = client.put(f"/api/products/{p['id']}", headers=admin["headers"], json={
        "precio_en_usd": False, "precio_venta": 12000, "precio_costo": 6000})
    assert r.status_code == 200, r.text
    assert r.json()["precio_venta_usd"] is None
    _dolar(client, admin, 2000)
    p = client.get(f"/api/products/{p['id']}", headers=admin["headers"]).json()
    assert p["precio_venta"] == 12000


def test_en_dolares_sin_cotizacion_da_error(client, admin):
    cat = _categoria(client, admin)
    r = client.post("/api/products/", headers=admin["headers"], json={
        "nombre": "X", "categoria_id": cat, "unidad_medida": "unidad",
        "precio_costo": 1, "precio_venta": 2, "precio_en_usd": True, "precio_venta_usd": 2})
    assert r.status_code == 400


def test_en_dolares_solo_con_pesos_los_convierte(client, admin):
    """Si llega solo el precio en pesos (p. ej. desde un ingreso), se pasa a dólares."""
    _dolar(client, admin, 1000)
    cat = _categoria(client, admin)
    p = _producto(client, admin, cat, precio_en_usd=True)
    assert p["precio_venta_usd"] == 2
    assert p["precio_venta"] == 2000


def test_venta_usa_el_precio_actualizado(client, admin, db):
    _dolar(client, admin, 1000)
    cat = _categoria(client, admin)
    p = _producto(client, admin, cat, precio_en_usd=True, precio_venta_usd=100, precio_costo_usd=50)
    _dolar(client, admin, 1500)
    # La venta toma el precio guardado, que ya quedó actualizado al cambiar el dólar
    prod = client.portal.call(db.productos.find_one, {"nombre": "Producto"})
    assert prod["precio_venta"] == 150_000
