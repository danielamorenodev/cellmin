"""Restaura un respaldo hecho con respaldo.py.

Uso (desde la carpeta backend, con el entorno virtual activado):
    python restaurar_respaldo.py ARCHIVO.json.gz                 -> restaura en la base "cellmin_restaurado"
    python restaurar_respaldo.py ARCHIVO.json.gz --base OTRA     -> restaura en otra base
    python restaurar_respaldo.py ARCHIVO.json.gz --base cellmin_prod --reemplazar

Por seguridad, por defecto NO toca la base en uso: restaura en una base aparte
para comprobar que el respaldo sirve. Para pisar una base que ya tiene datos hay
que pasar --reemplazar y confirmar escribiendo su nombre.
"""
import argparse
import gzip
import sys

from bson import json_util
from pymongo import MongoClient

from app.config import settings


def main():
    ap = argparse.ArgumentParser(description="Restaura un respaldo de Cellmin")
    ap.add_argument("archivo")
    ap.add_argument("--base", default="cellmin_restaurado")
    ap.add_argument("--reemplazar", action="store_true")
    a = ap.parse_args()

    with gzip.open(a.archivo, "rt", encoding="utf-8") as f:
        datos = json_util.loads(f.read())
    info = datos.pop("_respaldo", {})
    print(f"Respaldo de la base {info.get('base')} del {info.get('fecha')}")

    db = MongoClient(settings.mongodb_url, serverSelectionTimeoutMS=15000)[a.base]
    con_datos = [c for c in db.list_collection_names() if not c.startswith("system.") and db[c].estimated_document_count()]
    if con_datos:
        if not a.reemplazar:
            sys.exit(f"La base {a.base} ya tiene datos ({', '.join(con_datos)}). Usá otra base o --reemplazar.")
        if input(f"Se van a BORRAR los datos actuales de {a.base}. Escribí el nombre de la base para confirmar: ").strip() != a.base:
            sys.exit("No coincide. No se hizo ningún cambio.")

    for col, docs in datos.items():
        db[col].delete_many({})
        if docs:
            db[col].insert_many(docs)
        print(f"  {col}: {len(docs)} documentos")
    print(f"Listo: restaurado en la base {a.base}")


if __name__ == "__main__":
    main()
