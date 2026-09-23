"use client";

import { QRCodeComponent } from "@/components/ui/qrcode";
import {
  generarEtiquetaPrensado,
  letraDiaImpresion,
  ZPL_NORMAL,
  ZPL_PEQUENA,
} from "@/services/zplPlanchaEspumaPrensado.service";
import type { OrdenPlanchaEspumaPrensado } from "@/types/interfaces";

interface EtiquetaPrensadoPreviewProps {
  orden: OrdenPlanchaEspumaPrensado;
  formato: "normal" | "pequena";
  /** Secuencial a mostrar (último registrado + 1), consultado por el componente padre. */
  secuencial: number;
}

// Tamaño físico aproximado del QR en puntos ZPL (mismas unidades que las coordenadas
// de ZPL_NORMAL/ZPL_PEQUENA), usado solo para dibujar el preview a escala. Como el
// contenedor respeta el aspect-ratio real de la etiqueta (que NO es cuadrada), el ancho
// y el alto del QR deben calcularse cada uno contra su propio eje (ancho vs alto de la
// etiqueta); usar un único porcentaje para ambos deforma el QR y lo corta.
// El contenedor fuerza al <canvas> a llenarlo con !important porque la librería qrcode
// escribe width/height inline sobre el elemento y eso gana sobre las clases de Tailwind:
// sin el override el QR se dibuja a su tamaño fijo en px y se desborda sobre el pie.
const QR_DOTS_NORMAL = 255; // aprox. para ^BQN,2,9
const QR_DOTS_PEQUENA = 110; // aprox. para ^BQN,2,4

// Mismo criterio de lectura de fecha que el resto del módulo: el API entrega UTC,
// por lo que se lee en UTC para no correrse un día en Ecuador (UTC-5).
function formatearFechaOrden(fechaISO: string): string {
  const fecha = new Date(fechaISO);
  if (Number.isNaN(fecha.getTime())) return String(fechaISO);
  const dia = String(fecha.getUTCDate()).padStart(2, "0");
  const mes = String(fecha.getUTCMonth() + 1).padStart(2, "0");
  return `${dia}/${mes}/${fecha.getUTCFullYear()}`;
}

// Círculo con la letra del día de impresión, dimensionado igual que el QR: ancho y alto
// del círculo se calculan cada uno contra su propio eje de la etiqueta (no es cuadrada),
// para que no se deforme ni se corte.
// El contenido va en un <svg> con viewBox: un font-size en CSS con % es relativo a la
// fuente heredada del padre (no al ancho del contenedor), así que la letra quedaba
// diminuta; dentro del viewBox el texto escala junto con el círculo.
function CirculoDia({
  letra,
  pct,
  config,
  ancho,
  alto,
}: {
  letra: string;
  pct: (x: number, y: number) => { left: string; top: string };
  config: { x: number; y: number; diametro: number };
  ancho: number;
  alto: number;
}) {
  // Grosor del borde equivalente a los 4 puntos que usa ^GC en el ZPL real.
  const grosorBorde = (4 / config.diametro) * 100;
  return (
    <div
      className="absolute"
      style={{
        ...pct(config.x, config.y),
        width: `${(config.diametro / ancho) * 100}%`,
        height: `${(config.diametro / alto) * 100}%`,
      }}
    >
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <circle
          cx="50"
          cy="50"
          r={50 - grosorBorde / 2}
          fill="none"
          stroke="black"
          strokeWidth={grosorBorde}
        />
        <text
          x="50"
          y="50"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="88"
          fontWeight="bold"
          fill="black"
        >
          {letra}
        </text>
      </svg>
    </div>
  );
}

// Este componente NO interpreta el ZPL; es un mock visual que reutiliza las mismas
// coordenadas (ZPL_NORMAL / ZPL_PEQUENA) usadas para generar el ZPL real, así ambos
// no pueden desincronizarse. En este proyecto no existe un renderizador de ZPL a imagen.
export default function EtiquetaPrensadoPreview({ orden, formato, secuencial }: EtiquetaPrensadoPreviewProps) {
  const codPedido = String(orden.Pedido ?? "").trim();
  const fechaVisible = formatearFechaOrden(String(orden.Fecha));
  const letraDia = letraDiaImpresion();

  if (formato === "normal") {
    const etiqueta = generarEtiquetaPrensado("normal", orden, secuencial, 1);
    const c = ZPL_NORMAL;
    const pct = (x: number, y: number) => ({
      left: `${(x / c.ancho) * 100}%`,
      top: `${(y / c.alto) * 100}%`,
    });
    // Las filas de texto se colocan en ZPL con ^FT, que ancla la LÍNEA BASE, mientras que
    // en CSS `top` ancla el borde superior. Sin restar el alto de la fuente el preview
    // dibuja cada fila una línea más abajo que la impresora. El logo, el QR, el círculo y
    // el pie usan ^FO (anclado arriba) y por eso siguen usando pct() sin corregir.
    const pctTexto = (x: number, y: number) => pct(x, y - 32); // ^AEN,32

    return (
      <div
        className="relative w-full bg-white border rounded-md shadow-sm text-black overflow-hidden"
        style={{ aspectRatio: `${c.ancho} / ${c.alto}` }}
      >
        <div
          className="absolute flex items-center justify-center bg-primary/10 rounded text-[7px] text-primary font-semibold"
          style={{ ...pct(c.logo.x - 70, c.logo.y - 30), width: "18%", height: "16%" }}
        >
          LOGO
        </div>
        <span className="absolute text-[9px] font-bold" style={pctTexto(c.fecha.label.x, c.fecha.label.y)}>
          FECHA:
        </span>
        <span className="absolute text-[9px]" style={pctTexto(c.fecha.valor.x, c.fecha.valor.y)}>
          {fechaVisible}
        </span>
        <span className="absolute text-[9px] font-bold" style={pctTexto(c.orden.label.x, c.orden.label.y)}>
          ORDEN:
        </span>
        <span className="absolute text-[9px]" style={pctTexto(c.orden.valor.x, c.orden.valor.y)}>
          {orden.Orden}
        </span>
        <span
          className="absolute text-[9px] max-w-[55%] truncate"
          style={pctTexto(c.producto.x, c.producto.y)}
        >
          {orden.Nombre}
        </span>
        <span className="absolute text-[9px] font-bold" style={pctTexto(c.etiqueta.label.x, c.etiqueta.label.y)}>
          ETIQUETA:
        </span>
        <span className="absolute text-[9px]" style={pctTexto(c.etiqueta.valor.x, c.etiqueta.valor.y)}>
          {String(etiqueta.netiqueta)}
        </span>
        {codPedido && (
          <>
            <span
              className="absolute text-[9px] font-bold"
              style={pctTexto(c.codPedido.label.x, c.codPedido.label.y)}
            >
              CODPEDIDO:
            </span>
            <span className="absolute text-[9px]" style={pctTexto(c.codPedido.valor.x, c.codPedido.valor.y)}>
              {codPedido}
            </span>
          </>
        )}
        <div
          className="absolute bg-white p-0.5 [&>canvas]:!w-full [&>canvas]:!h-full [&>canvas]:!max-w-none [&>canvas]:!max-h-none"
          style={{
            ...pct(c.qr.x, c.qr.y),
            width: `${(QR_DOTS_NORMAL / c.ancho) * 100}%`,
            height: `${(QR_DOTS_NORMAL / c.alto) * 100}%`,
          }}
        >
          <QRCodeComponent value={etiqueta.codigo} size={120} className="w-full h-full" />
        </div>
        <CirculoDia letra={letraDia} pct={pct} config={c.diaImpresion} ancho={c.ancho} alto={c.alto} />
        <span
          className="absolute left-0 w-full text-center text-[13px] font-mono"
          style={{ top: `${(c.pieCodigo.y / c.alto) * 100}%` }}
        >
          {etiqueta.codigo}
        </span>
      </div>
    );
  }

  const etiqueta = generarEtiquetaPrensado("pequena", orden, secuencial, 1);
  const c = ZPL_PEQUENA;
  const pct = (x: number, y: number) => ({
    left: `${(x / c.ancho) * 100}%`,
    top: `${(y / c.alto) * 100}%`,
  });
  const pctTexto = (x: number, y: number) => pct(x, y - 22); // ^AAN,22

  let y = c.posicionYInicial;
  const filas: { label?: string; valor: string; y: number }[] = [];
  filas.push({ label: "FECHA:", valor: fechaVisible, y });
  y += c.altoFila;
  filas.push({ label: "ORDEN:", valor: String(orden.Orden), y });
  y += c.altoFila;
  filas.push({ valor: String(orden.Nombre), y });
  y += c.altoFila;
  filas.push({ label: "ETIQUETA:", valor: String(etiqueta.netiqueta), y });
  y += c.altoFila;
  if (codPedido) {
    filas.push({ label: "CODPEDIDO:", valor: codPedido, y });
  }

  return (
    <div
      className="relative w-full bg-white border rounded-md shadow-sm text-black overflow-hidden"
      style={{ aspectRatio: `${c.ancho} / ${c.alto}` }}
    >
      {filas.map((fila, i) => (
        <div key={i}>
          {fila.label && (
            <span className="absolute text-[8px] font-bold" style={pctTexto(c.margenIzquierdo, fila.y)}>
              {fila.label}
            </span>
          )}
          <span
            className="absolute text-[8px] max-w-[45%] truncate"
            style={pctTexto(fila.label ? c.columnaDerechaX : c.margenIzquierdo, fila.y)}
          >
            {fila.valor}
          </span>
        </div>
      ))}
      <div
        className="absolute bg-white p-0.5 [&>canvas]:!w-full [&>canvas]:!h-full [&>canvas]:!max-w-none [&>canvas]:!max-h-none"
        style={{
          ...pct(c.qr.x, c.qr.y),
          width: `${(QR_DOTS_PEQUENA / c.ancho) * 100}%`,
          height: `${(QR_DOTS_PEQUENA / c.alto) * 100}%`,
        }}
      >
        <QRCodeComponent value={etiqueta.codigo} size={90} className="w-full h-full" />
      </div>
      <CirculoDia letra={letraDia} pct={pct} config={c.diaImpresion} ancho={c.ancho} alto={c.alto} />
      <span
        className="absolute left-0 w-full text-center text-[11px] font-mono"
        style={{ top: `${(c.pieCodigo.y / c.alto) * 100}%` }}
      >
        {etiqueta.codigo}
      </span>
    </div>
  );
}
