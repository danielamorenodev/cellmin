import api from "./api";

export const stockService = {
  getProductos: async () => {
    const response = await api.get("/stock/productos");
    return response.data;
  },

  // Sin fechas: los últimos 2000. Con fechas, en todo el historial.
  getMovimientos: async (filtros = {}) => {
    const params = Object.fromEntries(Object.entries(filtros).filter(([, v]) => v));
    const response = await api.get("/stock", { params });
    return response.data;
  },

  crearMovimiento: async (data) => {
    const response = await api.post("/stock/movimiento", data);
    return response.data;
  },
};
