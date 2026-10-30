import api from "./api";

export const usuariosService = {
  // Personal activo (sin datos privados) para elegir vendedor o técnico
  personal: async () => {
    const response = await api.get("/users/personal");
    return response.data;
  },

  getAll: async () => {
    const response = await api.get("/users/");
    return response.data;
  },

  create: async (data) => {
    const response = await api.post("/users/", data);
    return response.data;
  },

  update: async (id, data) => {
    const response = await api.put(`/users/${id}`, data);
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/users/${id}`);
    return response.data;
  },
};
