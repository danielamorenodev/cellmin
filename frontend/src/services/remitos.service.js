import api from "./api";

export const remitosService = {
  getAll: async () => (await api.get("/remitos")).data,
  create: async (data) => (await api.post("/remitos", data)).data,
};
