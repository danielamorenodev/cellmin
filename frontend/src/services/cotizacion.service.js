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

  // Solo administrador: últimos cambios del valor
  getHistorial: async () => {
    const response = await api.get("/cotizacion/historial");
    return response.data;
  },
};
