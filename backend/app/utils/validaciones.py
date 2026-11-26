"""Validación de DNI, CUIT, teléfono e IMEI que se cargan a mano.

Se aceptan los separadores habituales (puntos, guiones, espacios) pero nunca
letras. Cada función devuelve el valor normalizado o lanza ValueError con un
mensaje para mostrar tal cual en el formulario.
"""
import re

from app.utils import imei as imei_util

_SEPARADORES = r"[\s.\-]"


def dni(valor):
    if valor is None:
        return None
    if not re.fullmatch(rf"[\d\s.\-]+", valor):
        raise ValueError("El DNI solo puede tener números")
    numeros = re.sub(_SEPARADORES, "", valor)
    if not 7 <= len(numeros) <= 8:
        raise ValueError("El DNI tiene que tener 7 u 8 números")
    return numeros


def telefono(valor):
    if valor is None:
        return None
    if not re.fullmatch(r"\+?[\d\s().\-]+", valor):
        raise ValueError("El teléfono solo puede tener números (y +, espacios, guiones o paréntesis)")
    cantidad = len(re.sub(r"\D", "", valor))
    if not 8 <= cantidad <= 15:
        raise ValueError("El teléfono tiene que tener entre 8 y 15 números, con el código de área")
    return valor


def cuit_valido(numeros: str) -> bool:
    if not re.fullmatch(r"\d{11}", numeros):
        return False
    pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
    resto = sum(int(d) * p for d, p in zip(numeros, pesos)) % 11
    verificador = 0 if resto == 0 else 9 if resto == 1 else 11 - resto
    return verificador == int(numeros[10])


def cuit(valor):
    if valor is None:
        return None
    if not re.fullmatch(rf"[\d\s.\-]+", valor):
        raise ValueError("El CUIT solo puede tener números y guiones")
    numeros = re.sub(_SEPARADORES, "", valor)
    if len(numeros) != 11:
        raise ValueError("El CUIT tiene que tener 11 números (ej.: 20-12345678-3)")
    if not cuit_valido(numeros):
        raise ValueError("El CUIT no es válido: revisá los números")
    return f"{numeros[:2]}-{numeros[2:10]}-{numeros[10]}"


def imei(valor):
    if valor is None:
        return None
    if not re.fullmatch(r"[\d\s\-]+", valor):
        raise ValueError("El IMEI solo puede tener números")
    numeros = imei_util.normalizar(valor)
    if len(numeros) != 15:
        raise ValueError("El IMEI tiene que tener 15 números")
    if not imei_util.es_valido(numeros):
        raise ValueError("El IMEI no es válido: revisá los números (se ve marcando *#06#)")
    return numeros
