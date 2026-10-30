import api from "./api";

export const cotizacionService = {
  get: async () => {
    const response = await api.get("/cotizacion/");
    return response.data;
  },

  // Solo administrador: carga el valor del dólar
  guardar: async (valor) => {
    const response = await api.put("/cotizacion/", { valor });
    return response.data;
  },

  // Solo administrador: blue de Córdoba en InfoDolar (lo consulta el servidor)
  consultarInfodolar: async () => (await api.get("/cotizacion/infodolar")).data,
  usarInfodolar: async (usar) => (await api.post("/cotizacion/infodolar", { usar })).data,
  getAutomatica: async () => (await api.get("/cotizacion/automatica")).data,
  setAutomatica: async (activa, usar) =>
    (await api.put("/cotizacion/automatica", { activa, usar })).data,

  // Solo administrador: últimos cambios del valor
  getHistorial: async () => {
    const response = await api.get("/cotizacion/historial");
    return response.data;
  },
};
