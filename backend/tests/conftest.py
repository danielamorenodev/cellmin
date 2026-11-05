"""Entorno de pruebas: la API real de FastAPI sobre una base MongoDB en memoria
(mongomock-motor). No hace falta un servidor MongoDB ni internet.

Ejecutar desde la carpeta backend:
    pip install -r requirements-dev.txt
    pytest
"""
import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

os.environ.setdefault("MONGODB_URL", "mongodb://localhost:27017")
os.environ.setdefault("DATABASE_NAME", "cellmin_test")
os.environ.setdefault("SECRET_KEY", "clave-de-pruebas-" + "x" * 40)
os.environ.setdefault("ENTORNO", "desarrollo")
# Los correos nunca salen en las pruebas: se guardan en memoria
os.environ.setdefault("SMTP_HOST", "")

from bson import ObjectId  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from mongomock_motor import AsyncMongoMockClient  # noqa: E402

from app import database  # noqa: E402
import app.main as main  # noqa: E402
from app.utils.auth import create_access_token, hash_password  # noqa: E402


async def _connect_mock():
    database.client = AsyncMongoMockClient()
    database.db = database.client["cellmin_test"]


async def _close_mock():
    database.client = None
    database.db = None


@pytest.fixture()
def client(monkeypatch):
    monkeypatch.setattr(main, "connect_db", _connect_mock)
    monkeypatch.setattr(main, "close_db", _close_mock)
    try:
        from app.utils import email as email_util
        email_util.ENVIADOS.clear()
    except ImportError:
        pass
    with TestClient(main.app) as c:
        yield c


@pytest.fixture()
def db(client):
    return database.get_db()


def _crear_usuario(client, nombre, rol, sucursales=("sucursal_1",)):
    doc = {
        "nombre": nombre,
        "email": f"{nombre.lower().replace(' ', '.')}@test.com",
        "password": hash_password("clave1234"),
        "rol": rol,
        "sucursales": list(sucursales),
        "activo": True,
    }
    res = client.portal.call(database.get_db().usuarios.insert_one, doc)
    uid = str(res.inserted_id)
    token = create_access_token({"sub": uid, "role": rol, "sucursales": list(sucursales)})
    return {"id": uid, "headers": {"Authorization": f"Bearer {token}"}, **doc}


@pytest.fixture()
def admin(client):
    return _crear_usuario(client, "Admin", "administrador", ("sucursal_1", "sucursal_2"))


@pytest.fixture()
def tecnico(client):
    return _crear_usuario(client, "Tecnico Uno", "tecnico")


@pytest.fixture()
def vendedor(client):
    return _crear_usuario(client, "Vendedor Uno", "vendedor")


@pytest.fixture()
def cajero(client):
    return _crear_usuario(client, "Cajero Uno", "cajero")


@pytest.fixture()
def nuevo_usuario(client):
    return lambda nombre, rol, sucursales=("sucursal_1",): _crear_usuario(client, nombre, rol, sucursales)


def oid():
    return str(ObjectId())


@pytest.fixture()
def smtp(monkeypatch):
    """Simula un servidor de correo configurado: los emails quedan en ENVIADOS."""
    from app.config import settings
    from app.utils import email as email_util
    monkeypatch.setattr(settings, "smtp_host", "smtp.prueba.local")
    monkeypatch.setattr(settings, "smtp_remitente", "Cellmin <ventas@cellmin.test>")
    monkeypatch.setattr(email_util, "_enviar_smtp", lambda mensaje: None)
    email_util.ENVIADOS.clear()
    return email_util.ENVIADOS
