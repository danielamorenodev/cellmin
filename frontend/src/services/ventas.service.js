import api from "./api";

export const ventasService = {
  // Sin filtros: las últimas 1000. Con fechas o búsqueda (número o IMEI), en todas.
  getAll: async (filtros = {}) => {
    const params = Object.fromEntries(Object.entries(filtros).filter(([, v]) => v));
    const response = await api.get("/sales", { params });
    return response.data;
  },

  getById: async (id) => {
    const response = await api.get(`/sales/${id}`);
    return response.data;
  },

  create: async (data) => {
    const response = await api.post("/sales", data);
    return response.data;
  },

  // Envía el ticket por email (al email indicado o al del cliente)
  enviarEmail: async (id, email) => {
    const response = await api.post(`/sales/${id}/email`, { email: email || null });
    return response.data;
  },

  cancel: async (id) => {
    const response = await api.put(`/sales/${id}/cancel`);
    return response.data;
  },
};
