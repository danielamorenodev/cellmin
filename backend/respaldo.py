"""Respaldo completo de la base de datos en un archivo comprimido.

Uso (desde la carpeta backend, con el entorno virtual activado):
    python respaldo.py

- Guarda TODAS las colecciones en respaldos/cellmin_AAAA-MM-DD_HHMM.json.gz.
  En el servidor la carpeta se define con la variable RESPALDO_DIR
  (el servicio usa /var/backups/cellmin).
- Usa JSON extendido de MongoDB: fechas, ObjectId y decimales se guardan con
  su tipo, así el archivo se puede restaurar tal cual (restaurar_respaldo.py).
- Conserva los últimos RESPALDO_DIAS días (14 por defecto) y borra los más viejos.
- Los archivos tienen datos personales: se crean con permisos solo para el dueño.

En el servidor lo ejecuta todos los días el temporizador cellmin-respaldo.timer.
"""
import gzip
import os
import sys
import time
from datetime import datetime

from bson import json_util
from pymongo import MongoClient

from app.config import settings

CARPETA = os.environ.get("RESPALDO_DIR") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "respaldos")
DIAS = int(os.environ.get("RESPALDO_DIAS", "14"))
PREFIJO = "cellmin_"


def respaldar() -> str:
    os.makedirs(CARPETA, mode=0o700, exist_ok=True)
    db = MongoClient(settings.mongodb_url, serverSelectionTimeoutMS=15000)[settings.database_name]
    datos = {"_respaldo": {"base": settings.database_name, "fecha": datetime.utcnow().isoformat() + "Z"}}
    totales = {}
    for col in sorted(db.list_collection_names()):
        if col.startswith("system."):
            continue
        datos[col] = list(db[col].find())
        totales[col] = len(datos[col])
    datos["_respaldo"]["documentos"] = totales

    nombre = f"{PREFIJO}{datetime.now().strftime('%Y-%m-%d_%H%M')}.json.gz"
    final = os.path.join(CARPETA, nombre)
    temporal = final + ".parcial"
    # Se escribe primero en un archivo temporal: si algo falla a mitad de camino,
    # no queda un respaldo incompleto con nombre de respaldo bueno.
    viejo_umask = os.umask(0o077)
    try:
        with gzip.open(temporal, "wt", encoding="utf-8") as f:
            f.write(json_util.dumps(datos, json_options=json_util.CANONICAL_JSON_OPTIONS))
    finally:
        os.umask(viejo_umask)
    os.replace(temporal, final)

    total = sum(totales.values())
    kb = os.path.getsize(final) / 1024
    print(f"Respaldo creado: {final} ({len(totales)} colecciones, {total} documentos, {kb:.0f} KB)")
    return final


def limpiar_viejos():
    limite = time.time() - DIAS * 86400
    for nombre in os.listdir(CARPETA):
        ruta = os.path.join(CARPETA, nombre)
        if nombre.startswith(PREFIJO) and os.path.getmtime(ruta) < limite:
            os.remove(ruta)
            print(f"Borrado por antigüedad: {nombre}")


if __name__ == "__main__":
    try:
        respaldar()
        limpiar_viejos()
    except Exception as e:  # el error queda en el registro del servicio (journalctl)
        print(f"ERROR: no se pudo hacer el respaldo: {e}", file=sys.stderr)
        sys.exit(1)
