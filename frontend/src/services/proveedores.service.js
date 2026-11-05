import api from "./api";

export const proveedoresService = {
  getAll: async () => {
    const response = await api.get("/suppliers");
    return response.data;
  },

  getById: async (id) => {
    const response = await api.get(`/suppliers/${id}`);
    return response.data;
  },

  create: async (data) => {
    const response = await api.post("/suppliers", data);
    return response.data;
  },

  update: async (id, data) => {
    const response = await api.put(`/suppliers/${id}`, data);
    return response.data;
  },

  // Cuenta corriente: cuánto se le debe, con sus deudas y pagos
  getCuenta: async (id) => {
    const response = await api.get(`/suppliers/${id}/cuenta`);
    return response.data;
  },

  agregarMovimiento: async (id, data) => {
    const response = await api.post(`/suppliers/${id}/cuenta`, data);
    return response.data;
  },

  anularMovimiento: async (id, movId) => {
    const response = await api.delete(`/suppliers/${id}/cuenta/${movId}`);
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/suppliers/${id}`);
    return response.data;
  },
};
