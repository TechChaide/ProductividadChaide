import type { OrdenPlanchaEspumaPrensado } from "@/types/interfaces";

// Blob del logo Chaide (~DG000.GRF), compartido por ambos formatos. Se descarga una sola vez
// en memoria de la impresora ANTES del primer ^XA y se limpia al final con ZPL_LIMPIAR_LOGO.
// Solo el formato NORMAL lo referencia con ^XG000.GRF,1,1 (el formato pequeño no lleva logo).
const LOGO_GRF_BLOB =
  "~DG000.GRF,02304,024,gG010H0101,,:gK02EA,gJ01FHFD0,gJ0BFIF8,gI01FJFE,gI02EEFEFE,gG0H1NF0,gH03BFBFJF0,gH07FMF0,gH06F0EFFEFF8,gG01FF1FKFC,gH0BE0FKFE,gG07F41FLF,gG02A00EFEFEFE80,Y0107F11FLFC1,gG07E01FLFC0,gG07C01FLFC0,gG0FC03FEFJFC0,g01FC01FMF0,gG0F801FLFE0,g01FC01FLFE0,g01E800EFEFEFEE0,Y0H1F801FMF0,g03F8003FLF0,g03F0H03FLF0,g03F0H02FKFE0,g03F0H017FKF0,g03F0I03FKF0,g03F0I01FKF0,g03F0J0EFEFEE0,Y0H1F0I01FKF0,g01F80I0KFE0,g01FC0H017FJF0,gG0F80I03FFEFE0,g01FC0I017FD7F0,gG0FC0M0FC0,gG07C0M0FC0,gG06E0M0EC0,gG07F0L01FC1,gG03F80K03F80,gG01FC0K07F,gH0FE0K0FE,gG01FF0J01FC,gH07F80I03F8,gH07FD0H017F8,gH03FF8003FF0,gI0MFC0,gI03FKF80,gI01FKF,gJ0KF8,gJ01FIF0,,::O010P010H010H01,,:R0FA,P017FF01F0H03C0H030H01F1FIFH01FIFE,Q0F83C03800380H030H01E03FHFA003FHFE,P01C00F03C003C0H070H01E03F05F003E007,P03800603800380H0780H0E03E00F803E002,M01017801713D013D0H078001F11F017D01F101,P0E0H0183800380H0F8001E03E001F01E001,O01E0H0181C003C001FC001E01E001F81E001,O01E0I083C0038001BE001E03E0H0F81E0,O01D0H0181C003C001BE001F01F001F81F0,O03C0J03800380033E001E03E0H0F81E0,O03C0J01C003C0071F001E01E0H07C1E0,O0280J03800380060E0H0E03E0H0681E0,O03C0I0H1JFD01C1F101F01F0H07C1FHFC,O0380J03FIF800C0F801E03E0H0381FHFC,O03C0J01C447C00C07801E01E0H07C1F4H4,O0380J03C003800803801E03E0H0381E0,O03D0J01C003C01003C01F01F0H0781F0,O03C0J038003801ABBE01E03E0H0F81E0,O01C0J01C003C03FHFE01E01E0H0F81E0,P0E0J03C003802H23E00E03E0H0E80E0,M0101F0I0H1C013C07011F01F01F011F81F001,O01E0I08380038060H0F01E03E001F01E0H080,P0F800103C003C0C0H0F81E01E007C01E001C0,P07800203C00380C0H0781E03E007801E00180,P07C00F01C003C1C0H07C1F01F01F01F001F017,P01E008038001E180H03E1F03FAFE001EABE,Q07FF001C001FF80H01F9FC1FHF4001FHFE,,Q010gJ01,,::::::";

export const ZPL_LIMPIAR_LOGO = "^XA^ID000.GRF^FS^XZ";

// Coordenadas del formato NORMAL, compartidas con el preview gráfico para que ambos nunca
// diverjan. Etiqueta física de 10.6 x 8 cm = 847x639 puntos a 203 dpi, pero el cabezal de
// 4" solo cubre 832 de ancho: ese es el tope real imprimible.
export const ZPL_NORMAL = {
  ancho: 832,
  alto: 640,
  logo: { x: 608, y: 128 },
  fecha: { label: { x: 42, y: 120 }, valor: { x: 180, y: 120 } },
  orden: { label: { x: 42, y: 160 }, valor: { x: 180, y: 160 } },
  producto: { x: 42, y: 200 },
  // Pegado justo debajo de "producto" (antes había un salto grande hasta y=320).
  etiqueta: { label: { x: 42, y: 240 }, valor: { x: 240, y: 240 } },
  codPedido: { label: { x: 42, y: 280 }, valor: { x: 250, y: 280 } },
  // Debajo del logo (que está arriba a la derecha) y por debajo de la fila de producto,
  // que puede ocupar todo el ancho con nombres largos. Con margen a la derecha para
  // que el QR no quede pegado (o cortado) contra el borde de la etiqueta (ancho 832).
  qr: { x: 480, y: 260 },
  // Círculo con la letra del día de impresión, abajo a la izquierda (contrapeso del QR),
  // recorrido hacia la derecha dentro del espacio libre antes del QR (que inicia en x=480).
  diaImpresion: { x: 170, y: 320, diametro: 140, fontAlto: 130, fontAncho: 105 },
  // Pie de página: el mismo código que va en el QR, en texto, centrado en todo el ancho.
  pieCodigo: { y: 575, fontAlto: 46, fontAncho: 25 },
} as const;

// Formato PEQUEÑO: etiqueta física de 8 x 4 cm = 640x320 puntos a 203 dpi. Filas incrementales.
export const ZPL_PEQUENA = {
  ancho: 640,
  alto: 320,
  margenIzquierdo: 60,
  columnaDerechaX: 210,
  posicionYInicial: 56,
  altoFila: 26,
  // Arranca a la misma altura que la fila "ETIQUETA:" (y=134, justo debajo del límite
  // de "producto" en y=108). x=420 deja margen de sobra con el valor de CODPEDIDO
  // (que termina ~x=320) y con el borde derecho (ancho 640).
  qr: { x: 420, y: 134 },
  // Centrado en la franja que queda entre CODPEDIDO (termina en y=160) y el pie (y=280):
  // 120 puntos para un círculo de 100, así que sobran 10 arriba y 10 abajo. No comparte
  // franja horizontal con el QR (x 420..520), así que no compiten por espacio.
  diaImpresion: { x: 110, y: 170, diametro: 100, fontAlto: 90, fontAncho: 72 },
  // Pie de página: el mismo código que va en el QR, en texto, centrado en todo el ancho.
  pieCodigo: { y: 280, fontAlto: 29, fontAncho: 16 },
} as const;

const DIAS_SEMANA_ES: Record<string, string> = {
  Sun: "D",
  Mon: "L",
  Tue: "M",
  Wed: "X",
  Thu: "J",
  Fri: "V",
  Sat: "S",
};

/**
 * Letra del día de la semana (L,M,X,J,V,S,D) según la fecha de IMPRESIÓN (hoy), evaluada
 * siempre en hora de Ecuador (America/Guayaquil, GMT-5) sin importar la zona horaria
 * configurada en el equipo donde corre el navegador.
 */
export function letraDiaImpresion(fecha: Date = new Date()): string {
  const weekdayEn = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Guayaquil",
    weekday: "short",
  }).format(fecha);
  return DIAS_SEMANA_ES[weekdayEn] ?? "?";
}

function zplCirculoDia(
  letra: string,
  config: { x: number; y: number; diametro: number; fontAlto: number; fontAncho: number }
): string {
  const { x, y, diametro, fontAlto, fontAncho } = config;
  // ^A0N ancla la celda del carácter, no el glifo: en la fuente escalable 0 la mayúscula
  // ocupa aprox. el 70% superior de la celda, por lo que su centro visual cae a ~0.40 del
  // alto. Restar ese factor centra la letra dentro del círculo en lugar de dejarla alta.
  const yTexto = y + Math.round(diametro / 2 - fontAlto * 0.4);
  // Mismo efecto sobre el eje horizontal: ^FB centra la celda del carácter, pero la tinta
  // del glifo se apoya contra el borde izquierdo de esa celda y deja el sobrante a la
  // derecha, así que la letra queda corrida a la izquierda del círculo. Se desplaza el
  // bloque una fracción de la celda para compensar.
  const xTexto = x + Math.round(fontAncho * 0.18);
  return (
    `\n^FO${x},${y}^GC${diametro},4,B^FS` +
    `\n^FO${xTexto},${yTexto}^A0N,${fontAlto},${fontAncho}^FB${diametro},1,0,C^FD${letra}^FS`
  );
}

// Pie de página: el mismo código impreso en el QR, en texto, centrado en todo el ancho
// de la etiqueta (^FO0,y + ^FB{ancho},1,0,C centra sin importar el x de origen).
function zplPieCodigo(
  codigo: string,
  ancho: number,
  config: { y: number; fontAlto: number; fontAncho: number }
): string {
  return `\n^FO0,${config.y}^A0N,${config.fontAlto},${config.fontAncho}^FB${ancho},1,0,C^FD${codigo}^FS`;
}

// El API entrega la fecha como medianoche UTC ("2026-09-18T00:00:00.000Z"); hay que leerla
// en UTC (no local) para que no se corra un día en zonas horarias negativas como Ecuador (UTC-5).
function componentesFechaUTC(fechaISO: string): { anio2: string; mes: string; dia: string; ddmmyyyy: string } {
  const fecha = new Date(fechaISO);
  const anioCompleto = fecha.getUTCFullYear();
  const mes = String(fecha.getUTCMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getUTCDate()).padStart(2, "0");
  return {
    anio2: String(anioCompleto).slice(-2),
    mes,
    dia,
    ddmmyyyy: `${dia}/${mes}/${anioCompleto}`,
  };
}

// Evita que un material/nombre con "^" o "~" rompa comandos ZPL.
function limpiarTextoZPL(texto: unknown): string {
  return String(texto ?? "").replace(/[\^~]/g, "");
}

/**
 * Fórmula del código (mismo dato que usaba el barcode legacy, ahora impreso como QR):
 * MATERIAL + "-" + AAMMDD + secuencial(4 dígitos) + ORDEN
 * Ej: material="30002888", fecha=2026-09-18, secuencial=5, orden="015" => "30002888-2609180005015"
 */
export function generarCodigoQR(material: string, fechaISO: string, secuencial: number, orden: string): string {
  const { anio2, mes, dia } = componentesFechaUTC(fechaISO);
  const secuencialPadded = String(secuencial).padStart(4, "0");
  return `${limpiarTextoZPL(material)}-${anio2}${mes}${dia}${secuencialPadded}${limpiarTextoZPL(orden)}`;
}

export interface EtiquetaGenerada {
  zpl: string;
  codigo: string;
  secuencial: string;
  numEtiqueta: string;
}

/**
 * Genera N etiquetas (formato normal, 815x607) para la orden, con secuencial incremental
 * a partir de secuencialBase. La primera etiqueta incluye el blob del logo (~DG) para
 * descargarlo una sola vez en la impresora; referenciarlo en las demás no requiere reenviarlo.
 */
export function generarZPLNormal(
  orden: OrdenPlanchaEspumaPrensado,
  cantidad: number,
  secuencialBase = 1
): EtiquetaGenerada[] {
  const { ddmmyyyy } = componentesFechaUTC(String(orden.Fecha));
  const material = String(orden.Material ?? "");
  const numOrden = String(orden.Orden ?? "");
  const producto = limpiarTextoZPL(orden.Nombre);
  const codPedido = String(orden.Pedido ?? "").trim();
  const c = ZPL_NORMAL;

  const etiquetas: EtiquetaGenerada[] = [];
  for (let i = 0; i < cantidad; i++) {
    const secuencial = secuencialBase + i;
    const secuencialPadded = String(secuencial).padStart(4, "0");
    const codigo = generarCodigoQR(material, String(orden.Fecha), secuencial, numOrden);
    const numEtiqueta = String(secuencial);

    const lineaCodPedido = codPedido
      ? `\n^FT${c.codPedido.label.x},${c.codPedido.label.y}^AEN,32,15^FH^FDCODPEDIDO:^FS` +
        `\n^FT${c.codPedido.valor.x},${c.codPedido.valor.y}^AEN,32,15^FH^FD${limpiarTextoZPL(codPedido)}^FS`
      : "";
    const letraDia = letraDiaImpresion();

    const zplEtiqueta =
      // ^LH/^LT persisten en la memoria de la impresora entre trabajos: si no se resetean,
      // un offset guardado por un trabajo anterior corre toda la etiqueta hacia abajo.
      `^XA\n^MMT\n^PW${c.ancho}\n^LL${String(c.alto).padStart(4, "0")}\n^LH0,0\n^LS0\n^LT0\n` +
      `^FT${c.logo.x},${c.logo.y}^XG000.GRF,1,1^FS\n` +
      `^FT${c.fecha.valor.x},${c.fecha.valor.y}^AEN,32,15^FH^FD${ddmmyyyy}^FS\n` +
      `^FT${c.orden.valor.x},${c.orden.valor.y}^AEN,32,15^FH^FD${numOrden}^FS\n` +
      `^FT${c.producto.x},${c.producto.y}^AEN,32,15^FH^FD${producto}^FS\n` +
      `^FT${c.etiqueta.valor.x},${c.etiqueta.valor.y}^AEN,32,15^FH^FD${numEtiqueta}^FS\n` +
      `^FT${c.fecha.label.x},${c.fecha.label.y}^AEN,32,15^FH^FDFECHA:^FS\n` +
      `^FT${c.orden.label.x},${c.orden.label.y}^AEN,32,15^FH^FDORDEN:^FS\n` +
      `^FT${c.etiqueta.label.x},${c.etiqueta.label.y}^AEN,32,15^FH^FDETIQUETA:^FS` +
      lineaCodPedido +
      zplCirculoDia(letraDia, c.diaImpresion) +
      `\n^FO${c.qr.x},${c.qr.y}^BQN,2,9\n^FDLA,${codigo}^FS` +
      zplPieCodigo(codigo, c.ancho, c.pieCodigo) +
      `\n^PQ1,0,1,Y^XZ`;

    etiquetas.push({
      zpl: i === 0 ? `${LOGO_GRF_BLOB}\n${zplEtiqueta}` : zplEtiqueta,
      codigo,
      secuencial: secuencialPadded,
      numEtiqueta,
    });
  }
  return etiquetas;
}

/**
 * Genera N etiquetas (formato pequeño, 600x320) para la orden, con secuencial incremental
 * a partir de secuencialBase. Sin logo (no lleva ^XG000.GRF) y sin descargar el blob ~DG.
 */
export function generarZPLPequena(
  orden: OrdenPlanchaEspumaPrensado,
  cantidad: number,
  secuencialBase = 1
): EtiquetaGenerada[] {
  const { ddmmyyyy } = componentesFechaUTC(String(orden.Fecha));
  const material = String(orden.Material ?? "");
  const numOrden = String(orden.Orden ?? "");
  const producto = limpiarTextoZPL(orden.Nombre);
  const codPedido = String(orden.Pedido ?? "").trim();
  const c = ZPL_PEQUENA;

  const etiquetas: EtiquetaGenerada[] = [];
  for (let i = 0; i < cantidad; i++) {
    const secuencial = secuencialBase + i;
    const secuencialPadded = String(secuencial).padStart(4, "0");
    const codigo = generarCodigoQR(material, String(orden.Fecha), secuencial, numOrden);
    const numEtiqueta = String(secuencial);

    let y = c.posicionYInicial;
    const filas: string[] = [];
    const agregarFila = (label: string, valor: string) => {
      filas.push(`^FT${c.margenIzquierdo},${y}^AAN,22,11^FH^FD${label}^FS`);
      filas.push(`^FT${c.columnaDerechaX},${y}^AAN,22,11^FH^FD${valor}^FS`);
      y += c.altoFila;
    };

    agregarFila("FECHA:", ddmmyyyy);
    agregarFila("ORDEN:", numOrden);
    // Fila de producto: solo el valor, sin label, alineado a la izquierda.
    filas.push(`^FT${c.margenIzquierdo},${y}^AAN,22,11^FH^FD${producto}^FS`);
    y += c.altoFila;
    agregarFila("ETIQUETA:", numEtiqueta);
    if (codPedido) {
      agregarFila("CODPEDIDO:", limpiarTextoZPL(codPedido));
    }
    const letraDia = letraDiaImpresion();

    const zplEtiqueta =
      `^XA\n^MMT\n^PW${c.ancho}\n^LL${String(c.alto).padStart(4, "0")}\n^LH0,0\n^LS0\n^LT0\n` +
      filas.join("\n") +
      zplCirculoDia(letraDia, c.diaImpresion) +
      `\n^FO${c.qr.x},${c.qr.y}^BQN,2,4\n^FDLA,${codigo}^FS` +
      zplPieCodigo(codigo, c.ancho, c.pieCodigo) +
      `\n^PQ1,0,1,Y^XZ`;

    etiquetas.push({ zpl: zplEtiqueta, codigo, secuencial: secuencialPadded, numEtiqueta });
  }
  return etiquetas;
}
