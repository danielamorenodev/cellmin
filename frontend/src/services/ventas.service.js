import api from "./api";

export const ventasService = {
  getAll: async () => {
    const response = await api.get("/sales");
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
