"""Barrido de todas las rutas de la API: ninguna debe responder 500 (error
interno) ante un ID inválido, un ID que no existe o un cuerpo vacío."""
import re

import pytest
from fastapi.routing import APIRoute

import app.main as main

# Rutas que dependen de servicios externos (internet) o generan archivos grandes
EXCLUIDAS = {"/api/cotizacion/infodolar", "/api/backup/exportar"}

RUTAS = [
    (metodo, r.path)
    for r in main.app.routes
    if isinstance(r, APIRoute) and r.path.startswith("/api/") and r.path not in EXCLUIDAS
    for metodo in sorted(r.methods)
]


def _url(path, valor):
    return re.sub(r"\{[^}]+\}", valor, path)


@pytest.mark.parametrize("metodo,path", RUTAS, ids=[f"{m} {p}" for m, p in RUTAS])
def test_ruta_sin_errores_internos(client, admin, metodo, path):
    valores = ["no-es-un-id", "000000000000000000000000"] if "{" in path else [None]
    for valor in valores:
        url = _url(path, valor) if valor else path
        cuerpo = {} if metodo in ("POST", "PUT", "PATCH") else None
        if path == "/api/auth/login":
            r = client.post(url, data={"username": "nadie@test.com", "password": "x"})
        else:
            r = client.request(metodo, url, headers=admin["headers"], json=cuerpo)
        assert r.status_code < 500, f"{metodo} {url} -> {r.status_code}: {r.text[:300]}"


def test_sin_sesion_pide_ingresar(client):
    r = client.get("/api/repairs/")
    assert r.status_code == 401
