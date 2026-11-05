import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import api from "../services/api";

// Si el servidor tiene configurado el envío de emails. Se consulta una vez.
let configurado = null;
let pedido = null;

export function useEmailConfigurado() {
  const [valor, setValor] = useState(configurado ?? false);
  useEffect(() => {
    if (configurado !== null) return;
    pedido =
      pedido ||
      api
        .get("/email/estado")
        .then((r) => (configurado = !!r.data?.configurado))
        .catch(() => (configurado = false));
    let vivo = true;
    pedido.then((v) => vivo && setValor(v));
    return () => {
      vivo = false;
    };
  }, []);
  return valor;
}

// La casilla "Enviar por email" recuerda la última elección en este navegador
const CLAVE = "cellmin_enviar_email";
export const preferenciaEmail = {
  leer: (tipo) => {
    try {
      return localStorage.getItem(`${CLAVE}_${tipo}`) === "1";
    } catch {
      return false;
    }
  },
  guardar: (tipo, valor) => {
    try {
      localStorage.setItem(`${CLAVE}_${tipo}`, valor ? "1" : "0");
    } catch {
      /* sin almacenamiento disponible */
    }
  },
};

// Toast con el resultado del envío que vino junto con la orden o la venta
export function avisarEnvio(envio) {
  if (!envio) return;
  if (envio.enviado) toast.success(`Enviado por email a ${envio.destino}`);
  else toast.error(`No se pudo enviar el email: ${envio.error}`, { duration: 8000 });
}
