import { createContext, useContext, useState, useEffect } from "react";
import { authService } from "../services/auth.service";

const AuthContext = createContext(null);

// Id del usuario guardado en el token (para sesiones abiertas antes de que
// el sistema guardara el id junto con el nombre)
const idDelToken = (token) => {
  try {
    const datos = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(datos)).sub || null;
  } catch {
    return null;
  }
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const savedUser = localStorage.getItem("user");
    if (token && savedUser) {
      try {
        const guardado = JSON.parse(savedUser);
        setUser(guardado.id ? guardado : { ...guardado, id: idDelToken(token) });
      } catch {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const data = await authService.login(email, password);
    localStorage.setItem("token", data.access_token);
    const userData = {
      id: data.id || idDelToken(data.access_token),
      nombre: data.nombre,
      rol: data.rol,
      sucursales: data.sucursales || ["sucursal_1"],
      sucursal: data.sucursales?.[0] || "sucursal_1",
    };
    localStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);
    return userData;
  };

  const logout = () => {
    authService.logout();
    setUser(null);
  };

  if (loading)
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-sm">Cargando...</div>
      </div>
    );

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
