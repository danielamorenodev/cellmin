"""Recuperación de contraseña por el email de la empresa y validación de
DNI, teléfono, CUIT e IMEI."""
import re

import pytest

from app.config import settings

ORIGEN = {"Origin": "http://localhost:5173"}


@pytest.fixture()
def empresa(smtp, monkeypatch):
    monkeypatch.setattr(settings, "recuperacion_email", "dueno@empresa.test")
    return smtp


def _codigo(mensaje):
    return re.search(r"codigo=([\w-]+)", mensaje["texto"]).group(1)


def test_sin_email_configurado_avisa(client, tecnico):
    assert client.get("/api/auth/recuperar/estado").json() == {"disponible": False}
    r = client.post("/api/auth/recuperar", json={"email": tecnico["email"]}, headers=ORIGEN)
    assert r.status_code == 503
    assert "administrador" in r.json()["detail"]


def test_el_link_va_al_email_de_la_empresa_y_cambia_la_clave(client, tecnico, empresa):
    assert client.get("/api/auth/recuperar/estado").json() == {"disponible": True}
    r = client.post("/api/auth/recuperar", json={"email": tecnico["email"].upper()}, headers=ORIGEN)
    assert r.status_code == 200, r.text
    assert len(empresa) == 1
    m = empresa[0]
    assert m["destino"] == "dueno@empresa.test"          # nunca al email del usuario
    assert tecnico["nombre"] in m["texto"] and tecnico["email"] in m["texto"]
    assert "http://localhost:5173/recuperar?codigo=" in m["texto"]
    codigo = _codigo(m)
    assert client.get(f"/api/auth/recuperar/{codigo}").json()["nombre"] == tecnico["nombre"]
    assert client.post("/api/auth/recuperar/confirmar", json={"codigo": codigo, "nueva": "corta"}).status_code == 400
    r = client.post("/api/auth/recuperar/confirmar", json={"codigo": codigo, "nueva": "nueva-clave-1"})
    assert r.status_code == 200, r.text
    login = client.post("/api/auth/login", data={"username": tecnico["email"], "password": "nueva-clave-1"})
    assert login.status_code == 200
    # El link sirve una sola vez
    assert client.post("/api/auth/recuperar/confirmar", json={"codigo": codigo, "nueva": "otra-clave-2"}).status_code == 400


def test_email_inexistente_responde_igual_y_no_envia(client, empresa):
    r = client.post("/api/auth/recuperar", json={"email": "nadie@x.com"}, headers=ORIGEN)
    assert r.status_code == 200
    assert empresa == []


def test_origen_desconocido_no_arma_links(client, tecnico, empresa):
    r = client.post("/api/auth/recuperar", json={"email": tecnico["email"]}, headers={"Origin": "https://malo.test"})
    assert r.status_code == 503
    assert empresa == []


def test_link_vencido_o_inventado(client, tecnico, empresa, db):
    client.post("/api/auth/recuperar", json={"email": tecnico["email"]}, headers=ORIGEN)
    codigo = _codigo(empresa[0])
    from datetime import datetime, timedelta
    client.portal.call(db.recuperaciones.update_many, {}, {"$set": {"vence": datetime.utcnow() - timedelta(minutes=1)}})
    assert client.post("/api/auth/recuperar/confirmar", json={"codigo": codigo, "nueva": "nueva-clave-1"}).status_code == 400
    assert client.get("/api/auth/recuperar/inventado").status_code == 400


def test_un_pedido_nuevo_anula_el_anterior_y_hay_limite(client, tecnico, empresa):
    for _ in range(5):
        client.post("/api/auth/recuperar", json={"email": tecnico["email"]}, headers=ORIGEN)
    assert len(empresa) == 3  # máximo 3 por hora
    viejo, nuevo = _codigo(empresa[0]), _codigo(empresa[-1])
    assert client.get(f"/api/auth/recuperar/{viejo}").status_code == 400
    assert client.get(f"/api/auth/recuperar/{nuevo}").status_code == 200


@pytest.mark.parametrize("campo,valor", [
    ("telefono", "holaaa"), ("telefono", "123"), ("dni", "abc12345"), ("dni", "123"),
])
def test_cliente_rechaza_datos_invalidos(client, vendedor, campo, valor):
    r = client.post("/api/clients/", headers=vendedor["headers"], json={"nombre": "Ana", campo: valor})
    assert r.status_code == 422


def test_cliente_acepta_formatos_habituales(client, vendedor):
    r = client.post("/api/clients/", headers=vendedor["headers"],
                    json={"nombre": "Ana", "dni": "30.123.456", "telefono": "+54 9 (351) 555-1234"})
    assert r.status_code == 200, r.text
    assert r.json()["dni"] == "30123456"


@pytest.mark.parametrize("cuit,ok", [("abc", False), ("20-12345678-0", False), ("20-12345678-6", True), ("20123456786", True)])
def test_proveedor_cuit(client, admin, cuit, ok):
    r = client.post("/api/suppliers/", headers=admin["headers"], json={"nombre": f"Prov {cuit}", "cuit": cuit})
    assert (r.status_code == 200) is ok, r.text
    if ok:
        assert r.json()["cuit"] == "20-12345678-6"


@pytest.mark.parametrize("imei,ok", [
    ("abc123456789012", False), ("12345678901234567890", False), ("490154203237518", True), ("", True),
])
def test_orden_imei(client, vendedor, imei, ok):
    c = client.post("/api/clients/", headers=vendedor["headers"], json={"nombre": "Ana"}).json()
    r = client.post("/api/repairs/", headers=vendedor["headers"], json={
        "cliente_id": c["id"], "equipo": {"marca": "Samsung", "modelo": "A10", "imei": imei},
    })
    assert (r.status_code == 200) is ok, r.text
