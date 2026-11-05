"""Envío opcional de la orden de reparación y del ticket por email."""
import smtplib


def _cliente(client, user, **extra):
    r = client.post("/api/clients/", headers=user["headers"], json={"nombre": "Juan", "apellido": "Pérez", **extra})
    assert r.status_code == 200, r.text
    return r.json()


def _orden(client, user, cliente_id, **extra):
    return client.post("/api/repairs/", headers=user["headers"], json={
        "cliente_id": cliente_id,
        "equipo": {"marca": "Samsung", "modelo": "A10", "problema_descripcion": "<b>No</b> carga",
                   "bloqueo_tipo": "pin", "bloqueo_valor": "1234"},
        "notas_internas": "nota secreta",
        **extra,
    })


def test_estado_sin_configurar(client, vendedor):
    assert client.get("/api/email/estado", headers=vendedor["headers"]).json() == {"configurado": False}


def test_estado_configurado(client, vendedor, smtp):
    assert client.get("/api/email/estado", headers=vendedor["headers"]).json() == {"configurado": True}


def test_orden_sin_email_no_envia_nada(client, vendedor, smtp):
    c = _cliente(client, vendedor, email="juan@test.com")
    r = _orden(client, vendedor, c["id"])
    assert r.status_code == 200
    assert r.json()["envio_email"] is None
    assert smtp == []


def test_orden_se_envia_al_email_del_cliente(client, vendedor, smtp):
    c = _cliente(client, vendedor, email="juan@test.com")
    r = _orden(client, vendedor, c["id"], enviar_email=True)
    assert r.status_code == 200, r.text
    assert r.json()["envio_email"]["enviado"] is True
    assert len(smtp) == 1
    m = smtp[0]
    assert m["destino"] == "juan@test.com"
    assert r.json()["numero_orden"] in m["asunto"]
    # Copia del cliente: sin código de desbloqueo ni notas internas, y escapada
    assert "1234" not in m["html"] and "1234" not in m["texto"]
    assert "nota secreta" not in m["html"]
    assert "<b>No</b>" not in m["html"] and "&lt;b&gt;No&lt;/b&gt;" in m["html"]


def test_orden_a_otro_email_lo_guarda_si_el_cliente_no_tenia(client, vendedor, smtp, db):
    c = _cliente(client, vendedor)
    r = _orden(client, vendedor, c["id"], enviar_email=True, email_destino="Nuevo@Test.com")
    assert r.status_code == 200, r.text
    assert smtp[0]["destino"] == "nuevo@test.com"
    assert client.get(f"/api/clients/{c['id']}", headers=vendedor["headers"]).json()["email"] == "nuevo@test.com"


def test_orden_sin_email_disponible_no_se_crea(client, vendedor, smtp, db):
    c = _cliente(client, vendedor)
    r = _orden(client, vendedor, c["id"], enviar_email=True)
    assert r.status_code == 400
    assert client.portal.call(db.reparaciones.count_documents, {}) == 0


def test_email_invalido(client, vendedor, smtp):
    c = _cliente(client, vendedor)
    assert _orden(client, vendedor, c["id"], enviar_email=True, email_destino="juan@").status_code == 400


def test_sin_smtp_configurado_no_crea_la_orden(client, vendedor):
    c = _cliente(client, vendedor, email="juan@test.com")
    assert _orden(client, vendedor, c["id"], enviar_email=True).status_code == 400


def test_si_falla_el_servidor_de_correo_la_orden_queda(client, vendedor, smtp, monkeypatch, db):
    from app.utils import email as email_util

    def falla(_):
        raise smtplib.SMTPServerDisconnected("se cortó")
    monkeypatch.setattr(email_util, "_enviar_smtp", falla)
    c = _cliente(client, vendedor, email="juan@test.com")
    r = _orden(client, vendedor, c["id"], enviar_email=True)
    assert r.status_code == 200
    assert r.json()["envio_email"]["enviado"] is False
    assert "No se pudo enviar" in r.json()["envio_email"]["error"]
    orden = client.portal.call(db.reparaciones.find_one, {})
    assert orden["emails"][0]["enviado"] is False


def test_reenviar_orden(client, vendedor, smtp):
    c = _cliente(client, vendedor, email="juan@test.com")
    orden = _orden(client, vendedor, c["id"]).json()
    r = client.post(f"/api/repairs/{orden['id']}/email", headers=vendedor["headers"], json={})
    assert r.status_code == 200, r.text
    r = client.post(f"/api/repairs/{orden['id']}/email", headers=vendedor["headers"], json={"email": "otro@test.com"})
    assert r.status_code == 200
    assert [m["destino"] for m in smtp] == ["juan@test.com", "otro@test.com"]


def _venta(client, admin, cajero, **extra):
    cat = client.post("/api/categories/", headers=admin["headers"], json={"nombre": "Accesorios"}).json()["id"]
    p = client.post("/api/products/", headers=admin["headers"], json={
        "nombre": "Funda", "categoria_id": cat, "unidad_medida": "unidad",
        "precio_costo": 500, "precio_venta": 1000,
        "stock_sucursal": {"sucursal_1": 5, "sucursal_2": 0}}).json()
    r = client.post("/api/cash/abrir", headers=cajero["headers"], json={"monto_inicial": 0, "sucursal": "sucursal_1"})
    assert r.status_code == 200, r.text
    return client.post("/api/sales/", headers=cajero["headers"], json={
        "items": [{"producto_id": p["id"], "nombre_producto": "Funda", "cantidad": 2,
                   "precio_unitario": 1000, "subtotal": 2000}],
        "total": 2000, "pagos": [{"metodo": "efectivo", "monto": 2000}], **extra,
    })


def test_venta_con_ticket_por_email(client, admin, cajero, smtp):
    c = _cliente(client, cajero, email="juan@test.com")
    r = _venta(client, admin, cajero, cliente_id=c["id"], enviar_email=True)
    assert r.status_code == 200, r.text
    assert r.json()["envio_email"]["enviado"] is True
    assert "Funda" in smtp[0]["html"]
    assert "$ 2.000,00" in smtp[0]["html"]


def test_venta_sin_cliente_a_un_email(client, admin, cajero, smtp):
    r = _venta(client, admin, cajero, enviar_email=True, email_destino="comprador@test.com")
    assert r.status_code == 200, r.text
    assert smtp[0]["destino"] == "comprador@test.com"


def test_venta_sin_email_no_se_registra(client, admin, cajero, smtp, db):
    r = _venta(client, admin, cajero, enviar_email=True)
    assert r.status_code == 400
    assert client.portal.call(db.ventas.count_documents, {}) == 0


def test_reenviar_ticket(client, admin, cajero, smtp):
    venta = _venta(client, admin, cajero).json()
    r = client.post(f"/api/sales/{venta['id']}/email", headers=cajero["headers"], json={"email": "a@test.com"})
    assert r.status_code == 200, r.text
    assert len(smtp) == 1
