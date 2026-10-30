"""Cotización del dólar blue en Córdoba tomada de InfoDolar.

La consulta la hace el SERVIDOR del sistema (no el navegador): así no hay
problemas de permisos entre sitios (CORS), se consulta una sola vez para
todos y, si la página no responde o cambia, el sistema sigue funcionando
con el valor cargado a mano.

InfoDolar no ofrece una API: se lee la página pública
https://www.infodolar.com/cotizacion-dolar-provincia-cordoba.aspx y se
busca la fila "Dólar Blue en Córdoba" (compra y venta). Si el formato de la
página cambia, la lectura falla con un mensaje claro y se carga a mano.
"""
import html
import re

import httpx

FUENTE = "InfoDolar · Dólar Blue en Córdoba"
URL = "https://www.infodolar.com/cotizacion-dolar-provincia-cordoba.aspx"
_ETIQUETA = re.compile(r"D[oó]lar\s+Blue\s+en\s+C[oó]rdoba", re.IGNORECASE)
_MONTO = re.compile(r"\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?)")


class CotizacionNoDisponible(Exception):
    pass


def _numero(texto: str) -> float:
    return float(texto.replace(".", "").replace(",", "."))


def leer_blue_cordoba(pagina: str) -> dict:
    """Busca compra y venta del blue de Córdoba en el HTML de la página."""
    texto = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", pagina, flags=re.S | re.I)
    texto = html.unescape(re.sub(r"<[^>]+>", " ", texto))
    texto = re.sub(r"\s+", " ", texto)
    for m in _ETIQUETA.finditer(texto):
        ventana = texto[m.end(): m.end() + 500]
        # Los valores chicos (variación del día, "= $ 0,00") no son cotizaciones
        valores = [_numero(v) for v in _MONTO.findall(ventana)]
        valores = [v for v in valores if v >= 100]
        if len(valores) >= 2:
            compra, venta = valores[0], valores[1]
            if compra <= venta <= compra * 1.2:
                return {"compra": compra, "venta": venta}
    raise CotizacionNoDisponible(
        "No se encontró el dólar blue de Córdoba en InfoDolar (la página pudo cambiar). Cargalo a mano."
    )


async def consultar_blue_cordoba() -> dict:
    """Consulta InfoDolar y devuelve {compra, venta, fuente, url}."""
    try:
        async with httpx.AsyncClient(timeout=10, follow_redirects=True, headers={
            "User-Agent": "CellminGestion/1.0 (consulta de cotizacion; contacto: administracion del local)",
            "Accept-Language": "es-AR,es;q=0.9",
        }) as cliente:
            r = await cliente.get(URL)
            r.raise_for_status()
    except Exception:
        raise CotizacionNoDisponible("InfoDolar no respondió. Probá de nuevo en unos minutos o cargalo a mano.")
    datos = leer_blue_cordoba(r.text)
    return {**datos, "fuente": FUENTE, "url": URL}
