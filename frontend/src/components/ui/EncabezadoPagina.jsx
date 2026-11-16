// Encabezado de una pantalla: título y subtítulo a la izquierda, botones a la
// derecha (a la altura del título). En el celular los botones van debajo, uno
// por fila y a todo el ancho. Así todas las pantallas se ven iguales.
export default function EncabezadoPagina({ titulo, subtitulo, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-gray-800">{titulo}</h1>
        {subtitulo && <p className="text-gray-500 text-sm mt-1">{subtitulo}</p>}
      </div>
      {children && (
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:justify-end gap-2 shrink-0">
          {children}
        </div>
      )}
    </div>
  );
}
