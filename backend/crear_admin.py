"""Crea el primer usuario administrador en una base nueva.

Uso (desde la carpeta backend, con el entorno virtual activado):
    python crear_admin.py

Pide nombre, email y contraseña (la contraseña no se muestra al escribir).
Si el email ya existe no hace nada. Después se pueden crear el resto de los
usuarios desde la sección Usuarios del sistema.
"""
import asyncio
import getpass
import sys
from datetime import datetime

from motor.motor_asyncio import AsyncIOMotorClient

from app.config import settings
from app.utils.auth import hash_password


async def main():
    db = AsyncIOMotorClient(settings.mongodb_url)[settings.database_name]
    print(f"Base de datos: {settings.database_name}")

    nombre = input("Nombre del administrador: ").strip()
    email = input("Email (con el que va a iniciar sesión): ").strip().lower()
    if not nombre or "@" not in email:
        print("Nombre y email válidos son obligatorios.")
        sys.exit(1)
    if await db.usuarios.find_one({"email": email}):
        print("Ya existe un usuario con ese email. No se hizo ningún cambio.")
        sys.exit(1)

    password = getpass.getpass("Contraseña (mínimo 8 caracteres): ")
    if len(password) < 8:
        print("La contraseña es demasiado corta.")
        sys.exit(1)
    if getpass.getpass("Repetí la contraseña: ") != password:
        print("Las contraseñas no coinciden.")
        sys.exit(1)

    await db.usuarios.insert_one({
        "nombre": nombre,
        "email": email,
        "password": hash_password(password),
        "rol": "administrador",
        "sucursales": ["sucursal_1", "sucursal_2"],
        "activo": True,
        "fecha_creacion": datetime.utcnow(),
    })
    print(f"Listo: administrador {email} creado.")


asyncio.run(main())
