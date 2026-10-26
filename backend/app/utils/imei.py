"""Validación del IMEI de un celular.

El IMEI tiene 15 números y el último es un dígito verificador (algoritmo de
Luhn), así que la mayoría de los errores de tipeo se detectan antes de guardar.
"""
import re


def normalizar(texto) -> str:
    """Deja solo los números (el lector o la caja pueden traer espacios o guiones)."""
    return re.sub(r"\D", "", str(texto or ""))


def es_valido(imei: str) -> bool:
    if not re.fullmatch(r"\d{15}", imei or ""):
        return False
    suma = 0
    for i, c in enumerate(reversed(imei)):
        d = int(c)
        if i % 2 == 1:
            d *= 2
            if d > 9:
                d -= 9
        suma += d
    return suma % 10 == 0
