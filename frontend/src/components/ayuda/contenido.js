// Basado en el manual de usuario (tp/b5.js). Desde noviembre de 2026 se actualiza
// también a mano con las funciones nuevas: al regenerarlo desde el manual, pasar
// antes estos cambios al Word para no perderlos.
export const GUIAS = [
  {
    "id": "3-ingresar",
    "capitulo": "Primeros pasos",
    "titulo": "Ingresar",
    "perfiles": [
      "todos"
    ],
    "ruta": null,
    "bloques": [
      {
        "pasos": [
          "Abrí el navegador y entrá a la dirección del sistema.",
          "Escribí tu email y tu contraseña.",
          "Presioná **Ingresar**. Vas a ver la pantalla de **Inicio** y el menú con las funciones de tu puesto."
        ]
      },
      {
        "texto": "Por seguridad, la sesión se cierra sola a las 8 horas. Para salir antes, usá **Salir**, arriba a la derecha."
      }
    ]
  },
  {
    "id": "3-conocer-la-pantalla",
    "capitulo": "Primeros pasos",
    "titulo": "Conocer la pantalla",
    "perfiles": [
      "todos"
    ],
    "ruta": "/dashboard",
    "bloques": [
      {
        "texto": "A la izquierda está el **menú**, con hasta siete módulos: Inicio, Ventas, Reparaciones, Inventario, Clientes, Reportes y Configuración (cada perfil ve solo los suyos). Cerrado, el menú muestra solo el logo de Cellmin y los íconos; **se abre solo al apoyar el mouse encima y se cierra al sacarlo**. Al apoyar el mouse sobre un módulo aparecen sus secciones, que también se ven como pestañas arriba de cada pantalla. La página se acomoda al lado del menú y nunca queda tapada. En el celular el menú se abre con el botón ☰ y cada módulo se despliega al tocarlo."
      },
      {
        "texto": "Arriba ves tu nombre, el valor del dólar vigente y el botón **?**, que abre la **ayuda**: las guías de este manual para tu puesto, con buscador, problemas frecuentes y glosario. También se abre con la tecla ?. Arriba de todo aparecen las guías de la pantalla en la que estás, y cada paso se puede tocar para marcarlo mientras lo hacés. Los mensajes verdes confirman que algo salió bien y los rojos indican un problema y cómo resolverlo. En los listados, los tres puntitos de cada fila muestran las acciones disponibles, y abajo hay **páginas** para recorrer el listado completo. En **Inicio**, al tocar una tarjeta (por ejemplo, Reparaciones activas) se abre el detalle."
      },
      {
        "texto": "**Antes de guardar, cancelar o desactivar algo, el sistema pregunta «¿Estás seguro de que querés…?»** y explica qué va a pasar. Presioná **Sí, …** para seguir o **No, volver** (o la tecla Esc) para no hacer nada. En las acciones que borran o cancelan, el botón de confirmar es rojo y queda marcado **No, volver**, así un Enter apurado no cancela nada."
      },
      {
        "texto": "**Inicio** muestra tres tarjetas con los datos de tu puesto y cuatro accesos directos. Por ejemplo, el cajero y el vendedor ven las ventas del día, las reparaciones activas y las listas para entregar; el técnico, las reparaciones activas, las suyas y las atrasadas; depósito, el stock bajo, los ingresos y los remitos de la semana; y el administrador, ventas, reparaciones y stock."
      }
    ]
  },
  {
    "id": "3-cambiar-tu-contrasen-a",
    "capitulo": "Primeros pasos",
    "titulo": "Cambiar tu contraseña",
    "perfiles": [
      "todos"
    ],
    "ruta": null,
    "bloques": [
      {
        "pasos": [
          "Arriba a la derecha, tocá tu nombre y elegí **Cambiar mi contraseña**.",
          "Escribí tu contraseña actual y la nueva dos veces. La nueva tiene que tener al menos 8 caracteres y ser distinta de la actual.",
          "Presioná **Cambiar**. La próxima vez ingresás con la nueva."
        ]
      }
    ]
  },
  {
    "id": "3-la-regla-de-la-caja",
    "capitulo": "Primeros pasos",
    "titulo": "La regla de la caja",
    "perfiles": [
      "todos"
    ],
    "ruta": "/caja",
    "bloques": [
      {
        "nota": "**Cada sucursal abre una caja por día, y la abre un cajero.** En esa caja venden el cajero que la abrió y los vendedores de la sucursal. Los cobros de reparaciones, los ingresos y egresos y las cancelaciones de ventas los registra solo el cajero que la abrió (o el administrador). Si la caja de tu sucursal no está abierta, no se puede vender."
      }
    ]
  },
  {
    "id": "4-cargar-un-producto",
    "capitulo": "Depósito",
    "titulo": "Cargar un producto",
    "perfiles": [
      "deposito",
      "administrador"
    ],
    "ruta": "/productos",
    "bloques": [
      {
        "pasos": [
          "En **Inventario → Productos y stock**, presioná **Nuevo producto**. El formulario está dividido en cuatro partes: información del producto, características, precios e inventario.",
          "En **Información del producto** cargá nombre y categoría. En **Código de barras**, escaneá el código del empaque o escribilo; si el producto no tiene, presioná **Generar interno** (si lo dejás vacío, el sistema lo genera al guardar).",
          "En **Características**, si el producto tiene colores o capacidades, marcá **Tiene variantes**. Si es un celular, dejá marcada **Pedir el IMEI al venderlo** (se marca sola si la categoría es de celulares). El IMEI no se carga acá: se pide en cada venta, uno por unidad.",
          "En **Precios**, elegí la moneda del precio. **Pesos (fijo)**: el precio no cambia cuando sube el dólar (fundas, vidrios, cargadores). **Dólares (sigue al dólar)**: se carga en US$ y el precio en pesos se actualiza solo cada vez que se carga un valor nuevo del dólar; en el listado esos productos llevan la etiqueta **US$**. Con variantes, podés marcar **Mismo precio para todas las variantes** y presionar **Aplicar**.",
          "En **Inventario**, completá la tabla de cada sucursal: el **stock inicial** es la cantidad con la que empieza el producto y el **stock mínimo** es el número en el que el sistema avisa que hay que reponer (0 = sin aviso). Con variantes, cada una tiene su propia tabla.",
          "Presioná **Guardar**."
        ]
      },
      {
        "texto": "Las categorías se administran en **Inventario → Categorías**. Son una lista simple (sin categorías dentro de otras), y en los listados se puede filtrar por una o varias a la vez."
      }
    ]
  },
  {
    "id": "4-registrar-un-ingreso-de-mercaderi-a",
    "capitulo": "Depósito",
    "titulo": "Registrar un ingreso de mercadería",
    "perfiles": [
      "deposito",
      "administrador"
    ],
    "ruta": "/compras",
    "bloques": [
      {
        "pasos": [
          "En **Inventario → Ingresos de mercadería**, presioná **Nuevo ingreso** (también está el botón **Ingreso de mercadería** en Productos y stock).",
          "Elegí el proveedor, la sucursal que recibe y el número del remito o la factura del proveedor. Si el proveedor no existe, crealo ahí mismo con **+ Nuevo proveedor**.",
          "Buscá cada producto por nombre o código. Si es un producto que todavía no existe, presioná **Producto nuevo**, cargalo y vuelve solo al ingreso (su stock entra con este ingreso).",
          "Si el producto tiene variantes, elegí la variante en la línea. Para cargar **más de una variante del mismo producto** (por ejemplo, la funda en negro y en azul), presioná **+ Otra variante** debajo: se agrega otra línea del mismo producto para elegir la otra variante.",
          "Completá cantidad y costo de cada línea y presioná **Registrar ingreso**. El sistema pregunta si estás seguro y muestra las unidades, el total y, si corresponde, lo que queda debiendo. El aviso confirma cuántas unidades se sumaron y en qué sucursal."
        ]
      },
      {
        "texto": "Si un ingreso se cargó por error, anulalo desde sus acciones: el stock se resta de la sucursal que lo recibió. Si parte de esa mercadería ya se vendió y el stock no alcanza, el sistema lo avisa y no lo anula."
      }
    ]
  },
  {
    "id": "4b-deuda-con-proveedores",
    "capitulo": "Depósito",
    "titulo": "Registrar lo que se le debe a un proveedor",
    "perfiles": [
      "deposito",
      "administrador"
    ],
    "ruta": "/compras?vista=proveedores",
    "bloques": [
      {
        "texto": "Cada proveedor tiene su **cuenta corriente**: lo que se le debe, con sus deudas y pagos. En **Proveedores** se ve la columna **Deuda** y arriba el **total que se les debe**; tocándolo se filtran los proveedores con deuda."
      },
      {
        "pasos": [
          "Al registrar un ingreso de mercadería, en **Pago al proveedor** elegí **Queda debiendo todo** o **Queda debiendo una parte** (y cuánto). Ese monto se suma solo a su cuenta.",
          "Para cargar una deuda a mano o registrar un pago, abrí las acciones del proveedor y elegí **Cuenta corriente** (o tocá su deuda). Elegí **Se le debe** o **Le pagamos**, cargá el monto y el concepto y guardá.",
          "Si se paga de más, queda **a favor** del negocio.",
          "Un movimiento cargado por error lo anula el administrador. La deuda de un ingreso se anula cancelando ese ingreso."
        ]
      }
    ]
  },
  {
    "id": "4-ver-el-stock-y-que-hay-que-reponer",
    "capitulo": "Depósito",
    "titulo": "Ver el stock y qué hay que reponer",
    "perfiles": [
      "deposito",
      "administrador"
    ],
    "ruta": "/productos",
    "bloques": [
      {
        "texto": "En **Productos y stock** cada producto muestra su **stock total**; al tocar el número se abre el detalle: una fila por sucursal con su stock y su stock mínimo (y, si tiene variantes, lo mismo para cada una). La columna **Estado** marca “Bajo en S1” o “Bajo en S2” cuando el stock llegó al mínimo, y arriba aparece un aviso con el enlace **Ver solo esos**. Si un producto tiene mínimo 0, no genera alertas. Cajeros y vendedores ven esta pantalla solo para consultar."
      }
    ]
  },
  {
    "id": "4-enviar-mercaderi-a-a-la-otra-sucursal-remito",
    "capitulo": "Depósito",
    "titulo": "Enviar mercadería a la otra sucursal (remito)",
    "perfiles": [
      "deposito",
      "administrador"
    ],
    "ruta": "/remitos",
    "bloques": [
      {
        "pasos": [
          "En **Inventario → Remitos**, presioná **Nuevo remito**.",
          "Elegí qué sucursal envía: la otra queda como la que recibe.",
          "Buscá los productos y cargá cuánto se envía (con **+ Otra variante** mandás varias variantes del mismo producto). Al lado ves el stock de la sucursal que envía; si no alcanza, se marca en rojo y no deja registrar.",
          "Presioná **Registrar remito**. La mercadería se descuenta de una sucursal y se suma en la otra, y queda un comprobante numerado (R-0001) para imprimir y mandar con la mercadería."
        ]
      }
    ]
  },
  {
    "id": "4-corregir-el-stock",
    "capitulo": "Depósito",
    "titulo": "Corregir el stock",
    "perfiles": [
      "deposito",
      "administrador"
    ],
    "ruta": "/movimientos",
    "bloques": [
      {
        "pasos": [
          "En **Inventario → Movimientos**, presioná **Ajuste de stock**.",
          "Elegí el producto, la sucursal y el tipo: entrada, salida o ajuste. Un ajuste reemplaza la cantidad actual por la que cargues.",
          "Elegí el motivo (por ejemplo, “Conteo de inventario”) y confirmá. En la misma pantalla está el historial de todos los movimientos: ingresos, ventas, remitos y ajustes."
        ]
      }
    ]
  },
  {
    "id": "5-abrir-la-caja",
    "capitulo": "Cajero",
    "titulo": "Abrir la caja",
    "perfiles": [
      "cajero",
      "administrador"
    ],
    "ruta": "/caja",
    "bloques": [
      {
        "pasos": [
          "Entrá a **Caja** y presioná **Abrir caja**.",
          "Elegí tu sucursal e ingresá el efectivo con el que empezás. Si la caja anterior dejó efectivo, el sistema te muestra cuánto debería haber y avisa si hay diferencia.",
          "Confirmá. Desde ahora podés vender y cobrar reparaciones."
        ]
      }
    ]
  },
  {
    "id": "5-registrar-una-venta",
    "capitulo": "Cajero",
    "titulo": "Registrar una venta",
    "perfiles": [
      "cajero",
      "administrador"
    ],
    "ruta": "/ventas",
    "bloques": [
      {
        "pasos": [
          "Entrá a **Ventas** y presioná **Nueva venta**.",
          "Escaneá el producto con el lector o buscalo por nombre: ves el stock de tu sucursal. Repetí para cada producto.",
          "Si vendés un celular, debajo aparece el campo **IMEI**: escanealo de la caja o del equipo, o escribí los 15 números (en el celular se ve marcando *#06#). Si llevás dos unidades, aparece un campo por cada una. El campo se pone verde cuando el IMEI es válido; sin todos los IMEI no se puede confirmar la venta.",
          "En **Vendió**, dejá tu nombre o elegí el vendedor que atendió al cliente.",
          "Si corresponde, aplicá un descuento o un recargo en porcentaje.",
          "Elegí el medio de pago: efectivo, transferencia, débito, crédito o **dólares**. Con débito o crédito elegí la tarjeta y, en crédito, las cuotas: si el plan tiene recargo, el sistema lo suma y muestra cuánto se cobra en la tarjeta.",
          "Si el cliente paga con varios medios, marcá **Pago mixto** y cargá cuánto va por cada uno (con **Agregar otro medio de pago** sumás más). Efectivo y dólares se cargan una sola vez; tarjetas y transferencias se pueden repetir, por ejemplo, con dos tarjetas distintas.",
          "Si paga en efectivo o en dólares, ingresá lo que entrega: el sistema calcula el vuelto, siempre en pesos.",
          "Si el sistema tiene configurado el email, podés marcar **Enviar el ticket por email al cliente**: se manda solo al registrar la venta.",
          "Presioná **Confirmar venta**. El sistema pregunta si estás seguro y muestra el total, las unidades y el cliente: presioná **Sí, registrar la venta** (o **No, volver** para seguir editando).",
          "Aparece la ventana **Venta registrada** con lo que podés hacer con el ticket: **Imprimir ticket**, **Enviar por WhatsApp** o **Enviar por email**. Podés hacer una, varias o ninguna; cada una se tilda al usarla. Presioná **Listo** para cerrar."
        ]
      },
      {
        "texto": "Si después necesitás el ticket de nuevo, en el listado de **Ventas** abrí las acciones de la venta: ahí están **Imprimir ticket**, **Enviar ticket por WhatsApp** y **Enviar ticket por email**."
      }
    ]
  },
  {
    "id": "5-cancelar-una-venta",
    "capitulo": "Cajero",
    "titulo": "Cancelar una venta",
    "perfiles": [
      "cajero",
      "administrador"
    ],
    "ruta": "/ventas",
    "bloques": [
      {
        "pasos": [
          "En **Ventas**, abrí las acciones de la venta y elegí **Cancelar venta**.",
          "El sistema pregunta si estás seguro: presioná **Sí, cancelar la venta**. Los productos vuelven al stock y la devolución del dinero se registra en la caja abierta."
        ]
      },
      {
        "texto": "Solo se pueden cancelar ventas de la caja abierta del día. Las de cajas ya cerradas quedaron incluidas en su cierre."
      }
    ]
  },
  {
    "id": "5-registrar-un-ingreso-o-egreso-de-caja",
    "capitulo": "Cajero",
    "titulo": "Registrar un ingreso o egreso de caja",
    "perfiles": [
      "cajero",
      "administrador"
    ],
    "ruta": "/caja",
    "bloques": [
      {
        "pasos": [
          "En **Caja**, elegí registrar un movimiento.",
          "Indicá si es ingreso o egreso, el medio de pago, el monto y el motivo (por ejemplo, “pago de flete”).",
          "Guardá y confirmá en la pregunta «¿Estás seguro…?»."
        ]
      }
    ]
  },
  {
    "id": "5-cobrar-y-entregar-una-reparacio-n",
    "capitulo": "Cajero",
    "titulo": "Cobrar y entregar una reparación",
    "perfiles": [
      "cajero",
      "administrador"
    ],
    "ruta": "/reparaciones",
    "bloques": [
      {
        "pasos": [
          "En **Reparaciones**, buscá la orden por número, cliente o IMEI.",
          "Abrí sus acciones y elegí **Cobrar**: el saldo es el presupuesto menos la seña. Se puede cobrar en pesos, en dólares, con tarjeta (eligiendo cuál y las cuotas) o con varios medios. Antes de registrarlo, el sistema pide confirmar el cobro.",
          "En las acciones, elegí **Pasar a Entregada** y confirmá con **Sí, entregar** (si queda saldo, el sistema lo avisa). El código de desbloqueo se borra al entregar. El sistema registra la fecha y calcula el vencimiento de la garantía."
        ]
      }
    ]
  },
  {
    "id": "5-cerrar-la-caja",
    "capitulo": "Cajero",
    "titulo": "Cerrar la caja",
    "perfiles": [
      "cajero",
      "administrador"
    ],
    "ruta": "/caja",
    "bloques": [
      {
        "pasos": [
          "En **Caja**, presioná **Cerrar caja**.",
          "Contá el dinero y cargá cuánto hay por cada medio de pago, incluidos los dólares.",
          "En la columna **Diferencia** ves lo que sobra o falta en cada medio de pago, y a la derecha, la diferencia total. Revisala antes de confirmar.",
          "Indicá cuánto efectivo queda en la caja para mañana y confirmá (si hay diferencias, el sistema lo vuelve a avisar antes de cerrar). El cierre queda en el historial."
        ]
      }
    ]
  },
  {
    "id": "6-consultar-precio-y-stock",
    "capitulo": "Vendedor",
    "titulo": "Consultar precio y stock",
    "perfiles": [
      "vendedor",
      "cajero",
      "administrador"
    ],
    "ruta": "/productos",
    "bloques": [
      {
        "pasos": [
          "En **Inventario → Productos y stock**, escribí el nombre del producto o filtrá por una o varias categorías.",
          "Vas a ver el precio y el stock total; tocá el número para ver cada sucursal."
        ]
      }
    ]
  },
  {
    "id": "6-registrar-una-venta",
    "capitulo": "Vendedor",
    "titulo": "Registrar una venta",
    "perfiles": [
      "vendedor",
      "cajero",
      "administrador"
    ],
    "ruta": "/ventas",
    "bloques": [
      {
        "pasos": [
          "Revisá que un cajero haya abierto la caja de tu sucursal; si no, el sistema te pide que la abran.",
          "Si trabajás en las dos sucursales, elegí en cuál vendés en el selector que está arriba de **Nueva venta**.",
          "Seguí los mismos pasos que el cajero (capítulo 5). En **Vendió** aparece tu nombre: así la venta queda a tu cargo en los reportes."
        ]
      },
      {
        "texto": "El vendedor no cobra reparaciones, no registra ingresos o egresos de caja y no cancela ventas: para eso, pedíselo al cajero."
      }
    ]
  },
  {
    "id": "6-registrar-un-cliente",
    "capitulo": "Vendedor",
    "titulo": "Registrar un cliente",
    "perfiles": [
      "vendedor",
      "cajero",
      "administrador"
    ],
    "ruta": "/clientes",
    "bloques": [
      {
        "pasos": [
          "En **Clientes**, presioná **Nuevo cliente**.",
          "Completá nombre, apellido, DNI y teléfono (email y dirección son opcionales).",
          "Guardá. Si el DNI ya existe, el sistema te avisa."
        ]
      }
    ]
  },
  {
    "id": "6-ingresar-un-equipo-para-reparar",
    "capitulo": "Vendedor",
    "titulo": "Ingresar un equipo para reparar",
    "perfiles": [
      "vendedor",
      "cajero",
      "administrador"
    ],
    "ruta": "/reparaciones",
    "bloques": [
      {
        "pasos": [
          "En **Reparaciones → Órdenes**, presioná **Nueva orden**.",
          "Arriba revisá **Atendió** (por defecto, vos), la **sucursal de ingreso** y la **entrega estimada** que le prometés al cliente (por defecto, en 3 días).",
          "Buscá al cliente o crealo sin salir de la pantalla con **+ Nuevo cliente**.",
          "Buscá la marca y el modelo en sus barras. Si no están, aparece **Crear «…»** para agregarlos en el momento (el modelo se habilita después de elegir la marca). Cargá el IMEI y la falla que cuenta el cliente.",
          "Si el equipo tiene bloqueo, indicá el tipo (patrón, PIN o contraseña). Si es un patrón, dibujalo en la cuadrícula.",
          "Si sabés qué reparación necesita, elegí uno o más tipos: el presupuesto se calcula solo. Si el tipo no existe, escribilo en el buscador y presioná **Crear tipo de reparación «…»**: cargá el precio y presioná **Crear y elegir** (queda guardado para las próximas órdenes). Si no sabés todavía qué tiene, dejalo vacío y la orden queda “En diagnóstico”.",
          "Revisá los días de garantía (90 por defecto). Si el cliente deja seña, marcá **Cobrar seña ahora** e ingresá el monto.",
          "Si querés mandarle la orden al cliente, marcá **Enviar la orden por WhatsApp al cliente** (y, si está configurado, **Enviar la orden por email**).",
          "Guardá. Se imprime la orden: con WhatsApp, la copia del cliente va por mensaje y **siempre se imprime la copia del técnico**. Se abre WhatsApp con el número del cliente y el mensaje listo: solo falta tocar enviar."
        ]
      }
    ]
  },
  {
    "id": "6-consultar-una-garanti-a",
    "capitulo": "Vendedor",
    "titulo": "Consultar una garantía",
    "perfiles": [
      "vendedor",
      "cajero",
      "administrador"
    ],
    "ruta": "/reparaciones",
    "bloques": [
      {
        "pasos": [
          "En **Reparaciones**, buscá por número de orden, IMEI o cliente.",
          "La orden entregada muestra la fecha de vencimiento de la garantía."
        ]
      }
    ]
  },
  {
    "id": "6b-enviar-por-whatsapp-o-email",
    "capitulo": "Vendedor",
    "titulo": "Enviar el ticket o la orden por WhatsApp o email",
    "perfiles": [
      "vendedor",
      "cajero",
      "administrador"
    ],
    "ruta": "/ventas",
    "bloques": [
      {
        "texto": "Por **WhatsApp**, el sistema abre la app (o WhatsApp Web) con el chat del cliente y el mensaje ya escrito: solo falta tocar enviar. El mensaje lleva el detalle del ticket o de la orden, nunca el código de desbloqueo del equipo."
      },
      {
        "pasos": [
          "**Ticket de una venta:** al registrarla, en la ventana **Venta registrada** elegí **Enviar por WhatsApp**. Más tarde, desde el listado de **Ventas**: acciones de la venta → **Enviar ticket por WhatsApp**.",
          "**Orden de reparación:** al crearla, marcá **Enviar la orden por WhatsApp al cliente** (se imprime siempre la copia del técnico). Más tarde: acciones de la orden → **Enviar orden por WhatsApp**, donde podés elegir si imprimir de nuevo la copia del técnico.",
          "En la ventana de WhatsApp revisá el número: se completa con el teléfono del cliente. Si no tiene o le falta el código de área, escribilo (por ejemplo, 351 555 1234). Debajo dice con qué número se abre el chat.",
          "Si querés, cambiá el texto del mensaje y presioná **Abrir WhatsApp**. En WhatsApp, tocá enviar."
        ]
      },
      {
        "texto": "Por **email** funciona igual: al registrar la venta o crear la orden marcá la casilla de enviar por email (se usa el email del cliente y se puede cambiar), o mandalo después desde las acciones con **Enviar … por email**. La opción aparece solo si el administrador configuró el envío de emails en el servidor."
      }
    ]
  },
  {
    "id": "6b-avisar-equipo-listo",
    "capitulo": "Vendedor",
    "titulo": "Avisar al cliente que el equipo está listo",
    "perfiles": [
      "vendedor",
      "cajero",
      "tecnico",
      "administrador"
    ],
    "ruta": "/reparaciones",
    "bloques": [
      {
        "pasos": [
          "Cuando la orden pasa a **Lista para entregar**, el sistema pregunta «¿Querés avisarle al cliente por WhatsApp que ya puede retirar el equipo?». Presioná **Sí, avisar por WhatsApp** (o **Ahora no**).",
          "Se abre la ventana de WhatsApp con el número del cliente y el mensaje: el equipo, el local donde retirarlo, el número de orden y el **saldo a pagar** (o que ya está todo pago). Revisalo y presioná **Abrir WhatsApp**.",
          "Si no avisaste en ese momento, mientras la orden esté lista para entregar aparece **Avisar que está lista (WhatsApp)** en sus acciones y el botón **Avisar que está lista** en su detalle."
        ]
      }
    ]
  },
  {
    "id": "7-ver-los-equipos-pendientes",
    "capitulo": "Técnico",
    "titulo": "Ver los equipos pendientes",
    "perfiles": [
      "tecnico",
      "administrador"
    ],
    "ruta": "/reparaciones",
    "bloques": [
      {
        "texto": "En **Reparaciones → Órdenes** filtrá por estado o por técnico para ver tu cola de trabajo. Cada orden muestra la sucursal donde ingresó y la entrega estimada; si ya pasó, aparece en rojo “Atrasada X días”, y arriba un aviso con el enlace **Ver solo esas**. Podés hacerlo desde el celular en el taller."
      }
    ]
  },
  {
    "id": "7-actualizar-el-estado",
    "capitulo": "Técnico",
    "titulo": "Actualizar el estado",
    "perfiles": [
      "tecnico",
      "administrador"
    ],
    "ruta": "/reparaciones",
    "bloques": [
      {
        "pasos": [
          "Abrí la orden.",
          "Si estaba “En diagnóstico”, cargá los tipos de reparación (si no existe, crealo en el momento desde el buscador): el presupuesto se calcula solo y el mostrador puede avisarle al cliente.",
          "Avanzá el estado: Ingresada → En reparación → Lista para entregar. Al pasar a **En reparación** el sistema pregunta qué técnico la repara (si sos vos, ya aparecés elegido): queda en la orden y en el historial del técnico. Cada cambio de estado pide confirmación.",
          "Al pasarla a **Lista para entregar**, el sistema pregunta si querés **avisarle al cliente por WhatsApp** que ya puede retirar el equipo (ver la guía «Avisar al cliente que el equipo está listo»)."
        ]
      }
    ]
  },
  {
    "id": "7-administrar-los-tipos-de-reparacio-n-y-las-marcas",
    "capitulo": "Técnico",
    "titulo": "Administrar los tipos de reparación y las marcas",
    "perfiles": [
      "tecnico",
      "administrador"
    ],
    "ruta": "/reparaciones?vista=tipos",
    "bloques": [
      {
        "pasos": [
          "En **Reparaciones**, entrá a la sección **Tipos de reparación** y creá uno nuevo.",
          "Cargá nombre, descripción y precio. Si cambiás un precio, las órdenes ya emitidas conservan el anterior.",
          "También se pueden crear en el momento, mientras cargás la orden.",
          "En **Reparaciones → Marcas y modelos** está el catálogo de equipos, como un listado. Con **Nueva Marca** agregás una; desde las acciones de cada marca podés editar el nombre, ver y agregar sus modelos, quitar un modelo o desactivar la marca. Todo lo que agregues aparece al buscar en la orden."
        ]
      }
    ]
  },
  {
    "id": "8-configurar-las-tarjetas-y-las-cuotas",
    "capitulo": "Administrador",
    "titulo": "Configurar las tarjetas y las cuotas",
    "perfiles": [
      "administrador"
    ],
    "ruta": "/medios-pago",
    "bloques": [
      {
        "pasos": [
          "En **Configuración → Medios de pago** están las tarjetas que acepta el local. Con **Nueva tarjeta** agregás otra.",
          "En cada tarjeta marcá si se acepta como débito, crédito o ambos y cargá los planes de cuotas con su recargo (por ejemplo, 3 cuotas +10 %). 1 pago siempre está disponible.",
          "Para dejar de aceptar una tarjeta, desactivala: los cobros anteriores no cambian."
        ]
      }
    ]
  },
  {
    "id": "8-cargar-el-valor-del-do-lar",
    "capitulo": "Administrador",
    "titulo": "Cargar el valor del dólar",
    "perfiles": [
      "administrador"
    ],
    "ruta": "/dolar",
    "bloques": [
      {
        "texto": "El valor del dólar se puede cargar a mano o tomar del **dólar blue de Córdoba** que publica InfoDolar. Se usa el **valor de venta**."
      },
      {
        "pasos": [
          "En **Configuración → Dólar**, en el recuadro **Dólar blue en Córdoba (InfoDolar)**, presioná **Consultar ahora**: ves la compra y la venta publicadas y a qué hora.",
          "Presioná **Usar este valor** en la venta. Si preferís otro valor, escribilo en **Nuevo valor** y presioná **Guardar valor**.",
          "Para no tener que hacerlo todos los días, marcá **Actualizar sola cada 30 minutos** con el valor de **venta**: el sistema consulta de lunes a sábado de 9 a 21 h. Si la página no responde o el valor se aleja más de un 25 % del actual, no lo cambia y lo avisa en **Última consulta automática**; en ese caso, revisalo y cargalo a mano.",
          "Abajo ves el historial, con quién, cuándo y de dónde salió cada valor (a mano o InfoDolar). Sin un valor cargado, no se puede cobrar en dólares."
        ]
      }
    ]
  },
  {
    "id": "8-crear-usuarios",
    "capitulo": "Administrador",
    "titulo": "Crear usuarios",
    "perfiles": [
      "administrador"
    ],
    "ruta": "/usuarios",
    "bloques": [
      {
        "pasos": [
          "En **Configuración → Usuarios**, creá un nuevo usuario.",
          "Cargá nombre, email, contraseña inicial, perfil y sucursales. Los usuarios son también la lista de vendedores y técnicos que se eligen en ventas y órdenes.",
          "Para dar de baja a alguien, desactivalo: su historial se conserva.",
          "Si alguien olvidó su contraseña, en las acciones del usuario elegí **Cambiar contraseña** y asignale una nueva (al menos 8 caracteres). Queda en el registro de actividad."
        ]
      }
    ]
  },
  {
    "id": "8-ver-co-mo-va-el-negocio",
    "capitulo": "Administrador",
    "titulo": "Ver cómo va el negocio",
    "perfiles": [
      "administrador"
    ],
    "ruta": "/reportes",
    "bloques": [
      {
        "texto": "**Inicio** muestra ventas del día, reparaciones activas (con las atrasadas) y productos con stock bajo; al tocar cada tarjeta se abre la lista, por ejemplo, las reparaciones con su técnico a cargo, los días en el local y la entrega estimada. En **Reportes** elegís un período o un rango de fechas para ver ventas (también por vendedor), rentabilidad, productos más vendidos y reparaciones: por técnico, por sucursal y por quién atendió, con el promedio de días, las atrasadas y las terminadas fuera de término, y el historial filtrable por técnico, cliente, sucursal y estado."
      }
    ]
  },
  {
    "id": "8-revisar-el-registro-de-actividad",
    "capitulo": "Administrador",
    "titulo": "Revisar el registro de actividad",
    "perfiles": [
      "administrador"
    ],
    "ruta": "/actividad",
    "bloques": [
      {
        "texto": "En **Configuración → Registro de actividad** se ve quién hizo qué y cuándo (ventas, cajas, órdenes, cambios de precios, usuarios), los **intentos de ingreso fallidos** (con el email que se intentó y desde qué dirección, nunca la contraseña) y los **errores del sistema**. Arriba hay un resumen de la última semana y se puede filtrar por fecha, tipo, módulo, usuario o texto. El registro se guarda un año."
      }
    ]
  },
  {
    "id": "8-descargar-un-respaldo",
    "capitulo": "Administrador",
    "titulo": "Descargar un respaldo",
    "perfiles": [
      "administrador"
    ],
    "ruta": "/reportes",
    "bloques": [
      {
        "texto": "En **Reportes**, presioná **Descargar respaldo**. Guardá el archivo en un lugar seguro: contiene datos personales de clientes. Además, el servidor hace una copia automática todas las noches."
      }
    ]
  }
];

export const PROBLEMAS = [
  [
    "No me deja vender.",
    "La caja de tu sucursal no está abierta. Si sos cajero, abrila en **Caja**; si sos vendedor, pedile a un cajero que la abra."
  ],
  [
    "No me deja cobrar una reparación ni cancelar una venta.",
    "Lo hace el cajero que abrió la caja de la sucursal o el administrador."
  ],
  [
    "“IMEI inválido” al vender un celular.",
    "Algún número está mal tipeado: el sistema controla el dígito verificador del IMEI. Volvé a escanearlo o revisalo marcando *#06# en el equipo."
  ],
  [
    "Busco una venta por el IMEI del celular.",
    "En **Ventas**, escribí el IMEI (o parte de él) en el buscador del listado."
  ],
  [
    "“Otra venta se llevó las últimas unidades”.",
    "Mientras armabas la venta, alguien vendió ese producto en otra caja. Actualizá, revisá el carrito y confirmá de nuevo."
  ],
  [
    "No puedo abrir la caja.",
    "Ya hay una caja abierta en la sucursal, ya tenés otra caja abierta, o la caja de hoy ya se abrió y se cerró (se abre una por día)."
  ],
  [
    "No puedo cancelar una venta (siendo cajero).",
    "La venta es de una caja ya cerrada, o la caja la abrió otra persona. Pedí ayuda al administrador."
  ],
  [
    "No me deja cobrar en dólares.",
    "Falta cargar el valor del dólar. Avisale al administrador."
  ],
  [
    "No me deja elegir cuotas o una tarjeta.",
    "Esa tarjeta o ese plan no está cargado en **Configuración → Medios de pago**. Avisale al administrador."
  ],
  [
    "No me deja poner efectivo dos veces.",
    "Efectivo y dólares se cargan una sola vez por cobro: sumá el total en una sola línea."
  ],
  [
    "No encuentro la marca o el modelo del equipo.",
    "Escribilo en la barra y presioná **Crear «…»**: queda agregado para las próximas órdenes."
  ],
  [
    "El remito no me deja registrar.",
    "Alguna cantidad supera el stock de la sucursal que envía (aparece en rojo). Revisá la cantidad o hacé antes un ajuste de stock."
  ],
  [
    "“Stock insuficiente”.",
    "Revisá el stock de la otra sucursal. Si hay diferencia con lo que ves en el estante, avisá a depósito para un ajuste."
  ],
  [
    "Me sacó del sistema.",
    "La sesión dura 8 horas. Volvé a ingresar."
  ],
  [
    "Olvidé mi contraseña.",
    "Pedile al administrador que te asigne una nueva. Después podés cambiarla desde tu nombre → Cambiar mi contraseña."
  ],
  [
    "El lector no carga el producto.",
    "Hacé clic en el campo de búsqueda antes de escanear. Si el código no existe, avisá a depósito."
  ],
  [
    "No imprime el ticket.",
    "Verificá que la impresora esté encendida y elegida como predeterminada. El ticket se puede reimprimir desde las acciones de la venta (**Imprimir ticket**) o desde su detalle."
  ],
  [
    "WhatsApp no abre el chat del cliente o dice que el número no es válido.",
    "Revisá el número en la ventana de WhatsApp: tiene que llevar el código de área (por ejemplo, 351 555 1234), sin el 0 ni el 15 de más. Si el cliente no tiene teléfono cargado, escribilo ahí y, para la próxima, cargalo en **Clientes**."
  ],
  [
    "No aparece la opción de enviar por email.",
    "El envío de emails todavía no está configurado en el servidor. Mientras tanto, usá WhatsApp o imprimí. Avisale al administrador."
  ],
  [
    "No encuentro el tipo de reparación en la orden.",
    "Escribilo en el buscador de tipos y presioná **Crear tipo de reparación «…»**, cargá el precio y presioná **Crear y elegir**."
  ],
  [
    "Toqué cancelar (o desactivar) sin querer.",
    "No pasa nada hasta que confirmes: en la pregunta «¿Estás seguro…?» presioná **No, volver** o la tecla Esc."
  ],
  [
    "Se cortó internet.",
    "Usá el celular de la sucursal como zona Wi-Fi. Si no funciona, anotá las ventas en la planilla de contingencia y cargalas antes de cerrar la caja."
  ]
];

export const GLOSARIO = [
  [
    "Ajuste de stock",
    "Corrección que reemplaza la cantidad registrada por la real."
  ],
  [
    "Caja",
    "Registro de todo el dinero que entra y sale de una sucursal en un día."
  ],
  [
    "Estado de la orden",
    "Etapa en la que está una reparación: en diagnóstico, ingresada, en reparación, lista para entregar, entregada o cancelada."
  ],
  [
    "IMEI",
    "Número que identifica a cada celular. Se ve marcando *#06#."
  ],
  [
    "Ingreso de mercadería",
    "Registro de lo que llega de un proveedor: suma stock en la sucursal que lo recibe."
  ],
  [
    "Pago mixto",
    "Cobro con dos o más medios de pago en una misma operación."
  ],
  [
    "Recargo por cuotas",
    "Porcentaje que se suma al cobrar con tarjeta de crédito en un plan de cuotas."
  ],
  [
    "Remito interno",
    "Comprobante de un envío de mercadería de una sucursal a la otra."
  ],
  [
    "Seña",
    "Parte del precio de la reparación que el cliente paga al dejar el equipo."
  ],
  [
    "Stock mínimo",
    "Cantidad a partir de la cual el sistema avisa que hay que reponer: la alerta aparece cuando el stock llega a ese número."
  ],
  [
    "Valor del dólar",
    "Cotización que el sistema usa para precios y cobros en dólares. La carga el administrador a mano o se toma del dólar blue de Córdoba (venta) publicado por InfoDolar."
  ],
  [
    "Variante",
    "Versión de un producto que se diferencia por color, capacidad u otra característica."
  ]
];
