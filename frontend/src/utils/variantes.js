// Alto de los campos de las tablas de carga (ingresos, remitos): todas las
// celdas de una fila se alinean a esta línea, así quedan parejas.
export const ALTO_FILA = "h-[38px]";

// Agrega una fila del mismo producto justo después de su última fila
export function agregarOtraVariante(items, index, nuevaFila) {
  const id = items[index].producto_id;
  let ultima = index;
  items.forEach((it, j) => {
    if (it.producto_id === id) ultima = j;
  });
  return [...items.slice(0, ultima + 1), nuevaFila, ...items.slice(ultima + 1)];
}
