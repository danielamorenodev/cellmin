from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    mongodb_url: str
    database_name: str
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 480
    # "produccion" en el servidor: oculta la documentación interactiva de la API
    # y exige una clave secreta larga.
    entorno: str = "desarrollo"
    # Orígenes del navegador que pueden llamar a la API, separados por coma.
    # En producción el sitio y la API comparten dominio (nginx), así que casi
    # no hace falta; se deja el dominio real por las dudas.
    cors_origins: str = (
        "http://localhost:5173,http://localhost:5174,"
        "http://127.0.0.1:5173,http://127.0.0.1:5174"
    )

    class Config:
        env_file = ".env"

    @property
    def es_produccion(self) -> bool:
        return self.entorno.lower() in ("produccion", "producción", "production")

    @property
    def origenes_permitidos(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()

if settings.es_produccion and len(settings.secret_key) < 32:
    raise RuntimeError(
        "SECRET_KEY es demasiado corta para producción (mínimo 32 caracteres). "
        "Generá una con: python -c \"import secrets; print(secrets.token_urlsafe(48))\""
    )
