"""Usuarios y clientes (incluido el alta de cliente desde una orden de reparación)."""


def test_api_arranca(client):
    assert client.get("/").status_code == 200


# ── Usuarios ────────────────────────────────────────────────────────────

def test_crear_usuario_guarda_sucursales(client, admin):
    r = client.post("/api/users/", headers=admin["headers"], json={
        "nombre": "Ana", "email": "ana@test.com", "password": "clave1234",
        "rol": "vendedor", "sucursales": ["sucursal_2"],
    })
    assert r.status_code == 200, r.text
    assert r.json()["sucursales"] == ["sucursal_2"]
    lista = client.get("/api/users/", headers=admin["headers"]).json()
    ana = next(u for u in lista if u["email"] == "ana@test.com")
    assert ana["sucursales"] == ["sucursal_2"]


def test_crear_usuario_rol_invalido(client, admin):
    r = client.post("/api/users/", headers=admin["headers"], json={
        "nombre": "X", "email": "x@test.com", "password": "clave1234", "rol": "jefe",
    })
    assert r.status_code == 400


def test_crear_usuario_email_repetido_sin_importar_mayusculas(client, admin):
    datos = {"nombre": "Ana", "email": "ana@test.com", "password": "clave1234", "rol": "vendedor"}
    assert client.post("/api/users/", headers=admin["headers"], json=datos).status_code == 200
    r = client.post("/api/users/", headers=admin["headers"], json={**datos, "email": "ANA@test.com"})
    assert r.status_code == 400


def test_editar_usuario_email_repetido(client, admin):
    a = client.post("/api/users/", headers=admin["headers"], json={
        "nombre": "Ana", "email": "ana@test.com", "password": "clave1234", "rol": "vendedor"}).json()
    client.post("/api/users/", headers=admin["headers"], json={
        "nombre": "Beto", "email": "beto@test.com", "password": "clave1234", "rol": "vendedor"})
    r = client.put(f"/api/users/{a['id']}", headers=admin["headers"], json={"email": "beto@test.com"})
    assert r.status_code == 400


def test_editar_usuario_cambia_sucursales(client, admin):
    a = client.post("/api/users/", headers=admin["headers"], json={
        "nombre": "Ana", "email": "ana@test.com", "password": "clave1234", "rol": "vendedor"}).json()
    r = client.put(f"/api/users/{a['id']}", headers=admin["headers"], json={
        "sucursales": ["sucursal_1", "sucursal_2"]})
    assert r.status_code == 200, r.text
    assert r.json()["sucursales"] == ["sucursal_1", "sucursal_2"]


def test_usuario_id_invalido_da_404(client, admin):
    assert client.delete("/api/users/no-es-un-id", headers=admin["headers"]).status_code == 404


def test_solo_admin_gestiona_usuarios(client, vendedor):
    assert client.get("/api/users/", headers=vendedor["headers"]).status_code == 403


# ── Clientes ────────────────────────────────────────────────────────────

FORM_VACIO = {"nombre": "Juan", "apellido": "", "dni": "", "telefono": "", "email": "", "direccion": ""}


def test_crear_cliente_con_campos_vacios(client, tecnico):
    """El formulario de la orden de reparación manda "" en los campos que no se completan."""
    r = client.post("/api/clients", headers=tecnico["headers"], json=FORM_VACIO, follow_redirects=True)
    assert r.status_code == 200, r.text
    assert r.json()["email"] is None


def test_dos_clientes_sin_dni(client, vendedor):
    """Un DNI vacío no debe chocar con otro cliente sin DNI."""
    assert client.post("/api/clients/", headers=vendedor["headers"], json=FORM_VACIO).status_code == 200
    r = client.post("/api/clients/", headers=vendedor["headers"], json={**FORM_VACIO, "nombre": "Pedro"})
    assert r.status_code == 200, r.text


def test_cliente_dni_repetido(client, vendedor):
    datos = {**FORM_VACIO, "dni": "30111222"}
    assert client.post("/api/clients/", headers=vendedor["headers"], json=datos).status_code == 200
    r = client.post("/api/clients/", headers=vendedor["headers"], json={**datos, "dni": " 30111222 "})
    assert r.status_code == 400


def test_cliente_email_invalido_da_mensaje_claro(client, vendedor):
    r = client.post("/api/clients/", headers=vendedor["headers"], json={**FORM_VACIO, "email": "juan@"})
    assert r.status_code == 422


def test_editar_cliente_puede_borrar_email(client, vendedor):
    c = client.post("/api/clients/", headers=vendedor["headers"], json={**FORM_VACIO, "email": "j@test.com"}).json()
    r = client.put(f"/api/clients/{c['id']}", headers=vendedor["headers"], json={**FORM_VACIO, "email": ""})
    assert r.status_code == 200, r.text
    assert r.json()["email"] is None


def test_desactivar_y_reactivar_cliente(client, admin, vendedor):
    c = client.post("/api/clients/", headers=vendedor["headers"], json=FORM_VACIO).json()
    client.delete(f"/api/clients/{c['id']}", headers=admin["headers"])
    assert client.get(f"/api/clients/{c['id']}", headers=admin["headers"]).json()["activo"] is False
    client.delete(f"/api/clients/{c['id']}", headers=admin["headers"])
    assert client.get(f"/api/clients/{c['id']}", headers=admin["headers"]).json()["activo"] is True


def test_cliente_id_invalido_da_404(client, vendedor):
    assert client.get("/api/clients/xyz", headers=vendedor["headers"]).status_code == 404


def test_orden_con_cliente_recien_creado(client, vendedor):
    c = client.post("/api/clients/", headers=vendedor["headers"], json=FORM_VACIO)
    assert c.status_code == 200, c.text
    r = client.post("/api/repairs/", headers=vendedor["headers"], json={
        "cliente_id": c.json()["id"],
        "equipo": {"marca": "Samsung", "modelo": "A10", "problema_descripcion": "No carga"},
    })
    assert r.status_code == 200, r.text
    assert r.json()["numero_orden"].startswith("OR-")


def test_orden_con_cliente_inexistente(client, vendedor):
    r = client.post("/api/repairs/", headers=vendedor["headers"], json={
        "cliente_id": "000000000000000000000000",
        "equipo": {"marca": "Samsung", "modelo": "A10"},
    })
    assert r.status_code == 400
