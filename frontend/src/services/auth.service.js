import api from "./api";

export const authService = {
  login: async (email, password) => {
    const formData = new FormData();
    formData.append("username", email);
    formData.append("password", password);
    const response = await api.post("/auth/login", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },

  getMe: async () => {
    const response = await api.get("/auth/me");
    return response.data;
  },

  // El usuario conectado cambia su propia contraseña
  cambiarClave: async (actual, nueva) => {
    const response = await api.put("/auth/password", { actual, nueva });
    return response.data;
  },

  // Recuperación de contraseña (el link llega al email de la empresa)
  estadoRecuperacion: async () => (await api.get("/auth/recuperar/estado")).data,
  pedirRecuperacion: async (email) => (await api.post("/auth/recuperar", { email })).data,
  verRecuperacion: async (codigo) => (await api.get(`/auth/recuperar/${encodeURIComponent(codigo)}`)).data,
  confirmarRecuperacion: async (codigo, nueva) =>
    (await api.post("/auth/recuperar/confirmar", { codigo, nueva })).data,

  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  },
};
