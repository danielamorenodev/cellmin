"""Tipos de reparación: alta en el momento al definir el problema de una orden."""
import pytest


@pytest.mark.parametrize("rol", ["tecnico", "vendedor", "cajero", "administrador"])
def test_quien_define_el_problema_puede_crear_el_tipo(client, nuevo_usuario, rol):
    u = nuevo_usuario(f"Persona {rol}", rol)
    r = client.post("/api/repair-types/", headers=u["headers"], json={"nombre": "Cambio de pin de carga", "precio": 15000})
    assert r.status_code == 200, r.text
    assert r.json()["nombre"] == "Cambio de pin de carga"
    assert r.json()["activo"] is True


def test_deposito_no_crea_tipos(client, nuevo_usuario):
    u = nuevo_usuario("Deposito", "deposito")
    r = client.post("/api/repair-types/", headers=u["headers"], json={"nombre": "X", "precio": 1})
    assert r.status_code == 403


def test_tipo_repetido_sin_importar_mayusculas(client, tecnico):
    client.post("/api/repair-types/", headers=tecnico["headers"], json={"nombre": "Cambio de módulo", "precio": 1})
    r = client.post("/api/repair-types/", headers=tecnico["headers"], json={"nombre": "  cambio de MÓDULO ", "precio": 1})
    assert r.status_code == 400


def test_tipo_precio_negativo_o_sin_nombre(client, tecnico):
    assert client.post("/api/repair-types/", headers=tecnico["headers"], json={"nombre": "A", "precio": -5}).status_code == 422
    assert client.post("/api/repair-types/", headers=tecnico["headers"], json={"nombre": "   ", "precio": 5}).status_code == 422


def test_solo_admin_edita_tipos(client, tecnico, admin):
    t = client.post("/api/repair-types/", headers=tecnico["headers"], json={"nombre": "Batería", "precio": 100}).json()
    assert client.put(f"/api/repair-types/{t['id']}", headers=tecnico["headers"], json={"precio": 1}).status_code == 403
    r = client.put(f"/api/repair-types/{t['id']}", headers=admin["headers"], json={"precio": 200})
    assert r.json()["precio"] == 200
    assert client.put("/api/repair-types/malo", headers=admin["headers"], json={"precio": 1}).status_code == 404


def test_definir_problema_con_tipo_creado_en_el_momento(client, tecnico, vendedor):
    cli = client.post("/api/clients/", headers=vendedor["headers"], json={"nombre": "Juan"}).json()
    orden = client.post("/api/repairs/", headers=vendedor["headers"], json={
        "cliente_id": cli["id"], "equipo": {"marca": "Motorola", "modelo": "G20"},
    }).json()
    assert orden["estado"] == "en_diagnostico"
    tipo = client.post("/api/repair-types/", headers=tecnico["headers"], json={"nombre": "Limpieza de placa", "precio": 8000}).json()
    r = client.put(f"/api/repairs/{orden['id']}", headers=tecnico["headers"], json={
        "estado": "ingresada",
        "tipos_reparacion": [{"tipo_id": tipo["id"], "nombre": tipo["nombre"], "precio": tipo["precio"]}],
    })
    assert r.status_code == 200, r.text
    assert r.json()["estado"] == "ingresada"
    assert r.json()["precio_total"] == 8000
