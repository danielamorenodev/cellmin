import api from "./api";

export const marcasService = {
  getAll: async () => (await api.get("/marcas")).data,
  create: async (nombre) => (await api.post("/marcas", { nombre })).data,
  update: async (id, data) => (await api.put(`/marcas/${id}`, data)).data,
  agregarModelo: async (id, nombre) => (await api.post(`/marcas/${id}/modelos`, { nombre })).data,
  quitarModelo: async (id, nombre) =>
    (await api.delete(`/marcas/${id}/modelos/${encodeURIComponent(nombre)}`)).data,
};
