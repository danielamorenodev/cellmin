"""Ajustes de datos que se aplican solos al arrancar el servidor.
Cada uno se puede ejecutar muchas veces sin cambiar el resultado."""


async def aplanar_categorias(db):
    """Las categorías dejaron de tener categoría padre: las subcategorías
    quedan como categorías comunes, con sus mismos productos."""
    await db.categorias.update_many(
        {"categoria_padre_id": {"$exists": True}},
        {"$unset": {"categoria_padre_id": ""}},
    )


async def aplicar_migraciones(db):
    from app.utils.tarjetas import crear_tarjetas_iniciales
    await aplanar_categorias(db)
    await crear_tarjetas_iniciales(db)
