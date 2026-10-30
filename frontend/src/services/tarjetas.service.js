import api from "./api";

export const tarjetasService = {
  getAll: async () => (await api.get("/tarjetas")).data,
  create: async (data) => (await api.post("/tarjetas", data)).data,
  update: async (id, data) => (await api.put(`/tarjetas/${id}`, data)).data,
};
