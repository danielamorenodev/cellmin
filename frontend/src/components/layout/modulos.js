// Módulos del menú (como máximo 7) y sus submódulos.
// Los submódulos aparecen al apoyar el mouse sobre el módulo (o al tocarlo en
// el celular) y también como pestañas arriba de cada pantalla del módulo.
// Una ruta con "?vista=..." muestra otra vista de la misma pantalla.
import {
  LayoutDashboard,
  ShoppingCart,
  Wrench,
  Package,
  Users,
  BarChart2,
  Settings,
} from "lucide-react";

const TODOS = ["administrador", "cajero", "vendedor", "deposito", "tecnico"];

export const MODULOS = [
  {
    id: "inicio",
    label: "Inicio",
    icon: LayoutDashboard,
    items: [{ label: "Inicio", path: "/dashboard", roles: TODOS }],
  },
  {
    id: "ventas",
    label: "Ventas",
    icon: ShoppingCart,
    items: [
      { label: "Ventas", path: "/ventas", roles: ["administrador", "cajero", "vendedor"] },
      { label: "Caja", path: "/caja", roles: ["administrador", "cajero"] },
    ],
  },
  {
    id: "reparaciones",
    label: "Reparaciones",
    icon: Wrench,
    items: [
      {
        label: "Órdenes",
        path: "/reparaciones",
        roles: ["administrador", "cajero", "vendedor", "tecnico"],
      },
      {
        label: "Tipos de reparación",
        path: "/reparaciones?vista=tipos",
        roles: ["administrador", "cajero", "vendedor", "tecnico"],
      },
    ],
  },
  {
    id: "inventario",
    label: "Inventario",
    icon: Package,
    items: [
      {
        label: "Productos y stock",
        path: "/productos",
        roles: ["administrador", "deposito", "cajero", "vendedor"],
      },
      { label: "Ingresos de mercadería", path: "/compras", roles: ["administrador", "deposito"] },
      { label: "Remitos", path: "/remitos", roles: ["administrador", "deposito"] },
      { label: "Movimientos", path: "/movimientos", roles: ["administrador", "deposito"] },
      { label: "Categorías", path: "/productos?vista=categorias", roles: ["administrador", "deposito"] },
      { label: "Proveedores", path: "/compras?vista=proveedores", roles: ["administrador", "deposito"] },
    ],
  },
  {
    id: "clientes",
    label: "Clientes",
    icon: Users,
    items: [
      { label: "Clientes", path: "/clientes", roles: ["administrador", "cajero", "vendedor", "tecnico"] },
    ],
  },
  {
    id: "reportes",
    label: "Reportes",
    icon: BarChart2,
    items: [{ label: "Reportes", path: "/reportes", roles: ["administrador"] }],
  },
  {
    id: "configuracion",
    label: "Configuración",
    icon: Settings,
    items: [
      { label: "Usuarios", path: "/usuarios", roles: ["administrador"] },
      { label: "Medios de pago", path: "/medios-pago", roles: ["administrador"] },
      { label: "Dólar", path: "/dolar", roles: ["administrador"] },
    ],
  },
];

// Módulos con solo los submódulos que el rol puede ver
export function modulosPara(rol) {
  return MODULOS.map((m) => ({
    ...m,
    items: m.items.filter((i) => i.roles.includes(rol)),
  })).filter((m) => m.items.length > 0);
}

const separar = (path) => {
  const [ruta, query = ""] = path.split("?");
  return { ruta, vista: new URLSearchParams(query).get("vista") || "" };
};

// ¿El submódulo es la pantalla que se está viendo?
export function itemActivo(item, location) {
  const { ruta, vista } = separar(item.path);
  const actual = new URLSearchParams(location.search).get("vista") || "";
  return location.pathname === ruta && actual === vista;
}

// Módulo al que pertenece la pantalla actual (incluye detalles como /ventas/123)
export function moduloActual(modulos, location) {
  return modulos.find((m) =>
    m.items.some((i) => {
      const { ruta } = separar(i.path);
      return location.pathname === ruta || location.pathname.startsWith(ruta + "/");
    }),
  );
}
