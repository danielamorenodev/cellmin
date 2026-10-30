import { useEffect, useState } from "react";
import { usuariosService } from "../services/usuarios.service";

// Personal activo: para elegir quién vendió o tomó una orden y qué técnico la repara
export function usePersonal() {
  const [personal, setPersonal] = useState([]);
  useEffect(() => {
    usuariosService.personal().then(setPersonal).catch(() => {});
  }, []);
  return personal;
}
