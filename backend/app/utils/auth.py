from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token inválido o expirado",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id: str = payload.get("sub")
        role: str = payload.get("role")
        sucursales: list = payload.get("sucursales", ["sucursal_1"])
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    # Rol, sucursales y estado se leen de la base: así un cambio hecho por el
    # administrador (o una desactivación) rige enseguida, sin volver a entrar.
    from bson import ObjectId
    from app.database import get_db
    db = get_db()
    if db is not None and ObjectId.is_valid(user_id):
        u = await db.usuarios.find_one({"_id": ObjectId(user_id)}, {"rol": 1, "sucursales": 1, "sucursal": 1, "activo": 1})
        if not u or not u.get("activo", True):
            raise credentials_exception
        role = u.get("rol", role)
        sucursales = u.get("sucursales") or [u.get("sucursal", "sucursal_1")]
    return {"user_id": user_id, "role": role, "sucursales": sucursales}