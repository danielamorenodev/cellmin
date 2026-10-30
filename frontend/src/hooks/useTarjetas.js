import { useEffect, useState } from "react";
import { tarjetasService } from "../services/tarjetas.service";

// Tarjetas activas con sus planes de cuotas (para elegir al cobrar)
export function useTarjetas() {
  const [tarjetas, setTarjetas] = useState([]);
  useEffect(() => {
    tarjetasService
      .getAll()
      .then((t) => setTarjetas(t.filter((x) => x.activo !== false)))
      .catch(() => {});
  }, []);
  return tarjetas;
}
