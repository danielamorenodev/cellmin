import axios from "axios";

// Ruta relativa: en desarrollo la atiende el proxy de Vite y en producción nginx
// (mismo dominio que el sitio). VITE_API_URL permite apuntar a otra dirección.
const API_URL = import.meta.env.VITE_API_URL || "/api";
const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptor para agregar el token a cada petición
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Interceptor para manejar errores globales
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Un 401 en el ingreso o en la recuperación es "datos incorrectos", no una
    // sesión vencida: no se recarga la página (se perdía el aviso de error)
    const esAcceso = /\/auth\/(login|recuperar)/.test(error.config?.url || "");
    if (error.response?.status === 401 && !esAcceso) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);

export default api;
