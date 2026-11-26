"""Deja el sistema del local en cero para empezar a usarlo de verdad.

Uso en el servidor:  bash /opt/cellmin/deploy/limpiar_sistema.sh
(o, desde la carpeta backend con el entorno virtual:  python limpiar_sistema.py)

BORRA todo lo cargado: ventas, órdenes de reparación, compras, remitos, cajas,
movimientos de stock, clientes, proveedores (y sus cuentas), productos, tipos de
reparación y el registro de actividad. La numeración vuelve a empezar
(V-0001, OR-0001, etc.).

QUEDAN: los usuarios, la configuración (dólar, actualización automática del
dólar, recargos de tarjetas e historial del dólar), las marcas y modelos y las
categorías.

Antes de borrar:
- Se niega a correr sobre una base de demostración (nombre con "demo").
- Hace un respaldo completo que NO se borra solo (antes_de_limpiar_….json.gz).
  Con restaurar_respaldo.py se puede volver atrás.
- Muestra cuánto se va a borrar y pide escribir el nombre de la base.
"""
import os
import sys

from pymongo import MongoClient

from app.config import settings

BORRAR = {
    "ventas": "Ventas",
    "reparaciones": "Órdenes de reparación",
    "compras": "Compras (ingresos de mercadería)",
    "remitos": "Remitos",
    "cajas": "Cajas (aperturas, cierres y movimientos)",
    "stock_movimientos": "Movimientos de stock",
    "proveedor_movimientos": "Cuentas de proveedores (deudas y pagos)",
    "clientes": "Clientes",
    "proveedores": "Proveedores",
    "productos": "Productos (con su stock)",
    "tipos_reparacion": "Tipos de reparación",
    "actividad": "Registro de actividad",
    "contadores": "Numeración (vuelve a empezar en 0001)",
}
QUEDAN = ["usuarios", "configuracion", "tarjetas", "cotizacion_historial", "marcas", "categorias"]


def main():
    base = settings.database_name
    if "demo" in base.lower():
        sys.exit(f"La base {base} es de demostración: para eso está reiniciar_demo.sh. No se hizo nada.")

    db = MongoClient(settings.mongodb_url, serverSelectionTimeoutMS=15000)[base]
    existentes = set(db.list_collection_names())

    print(f"\nBase: {base}\n")
    print("SE BORRA:")
    total = 0
    for col, desc in BORRAR.items():
        n = db[col].count_documents({}) if col in existentes else 0
        total += n
        print(f"  {desc:<45} {n:>7}")
    print("\nQUEDA COMO ESTÁ:")
    for col in QUEDAN:
        n = db[col].count_documents({}) if col in existentes else 0
        print(f"  {col:<45} {n:>7}")
    otras = sorted(c for c in existentes - set(BORRAR) - set(QUEDAN) if not c.startswith("system."))
    if otras:
        print(f"  (otras que no se tocan: {', '.join(otras)})")

    if total == 0:
        print("\nNo hay nada para borrar.")
        return

    print(f"\nSe van a borrar {total} registros. Esto NO se puede deshacer desde el sistema.")
    if input(f"Para confirmar, escribí el nombre de la base ({base}): ").strip() != base:
        sys.exit("No coincide. No se hizo ningún cambio.")

    # Respaldo completo antes de tocar nada. Se renombra para que el respaldo
    # diario (que borra los "cellmin_…" de más de 14 días) no lo elimine.
    print("\nHaciendo el respaldo…")
    import respaldo

    archivo = respaldo.respaldar()
    seguro = os.path.join(os.path.dirname(archivo), "antes_de_limpiar_" + os.path.basename(archivo))
    os.replace(archivo, seguro)
    print(f"Respaldo guardado en {seguro}")

    print("\nBorrando…")
    for col, desc in BORRAR.items():
        if col in existentes:
            r = db[col].delete_many({})  # se vacía la colección pero quedan sus índices
            print(f"  {desc:<45} {r.deleted_count:>7} borrados")

    print("\nListo. El sistema quedó en cero con los usuarios, la configuración, las marcas y las categorías.")
    print(f"Si hiciera falta volver atrás:  python restaurar_respaldo.py {seguro} --base {base} --reemplazar")


if __name__ == "__main__":
    main()
