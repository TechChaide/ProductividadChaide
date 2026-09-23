import {
  generarEtiquetaPrensado,
  ZPL_LIMPIAR_LOGO,
  type FormatoEtiquetaPrensado,
} from "@/services/zplPlanchaEspumaPrensado.service";
import { planchaEspumaPrensadoService } from "@/services/planchaEspumaPrensado.service";
import type { OrdenPlanchaEspumaPrensado } from "@/types/interfaces";

async function enviarZPLBrowserPrint(zpl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const bp = (window as any).BrowserPrint || window.Zebra?.BrowserPrint;
    if (!bp) {
      reject(new Error("BrowserPrint no detectado. Verifica que el servicio esté instalado y en ejecución."));
      return;
    }
    bp.getDefaultDevice(
      "printer",
      (printer: any, err: any) => {
        if (err || !printer) {
          reject(new Error("No se pudo obtener la impresora por defecto."));
          return;
        }
        printer.send(
          zpl,
          () => resolve(),
          (sendErr: any) =>
            reject(new Error("Error al enviar a la impresora: " + (sendErr?.message || sendErr)))
        );
      },
      () => reject(new Error("Error al resolver la impresora."))
    );
  });
}

async function enviarZPLRed(zpl: string, printerIP: string): Promise<void> {
  const response = await fetch("/api/zebra-network", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ zpl, printerIP }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error || "Error al imprimir en la impresora de red.");
  }
}

function enviarZPL(zpl: string, printerIP?: string): Promise<void> {
  return printerIP ? enviarZPLRed(zpl, printerIP) : enviarZPLBrowserPrint(zpl);
}

function mensajeDe(err: unknown): string {
  return err instanceof Error ? err.message : "Error desconocido";
}

export interface ImprimirEtiquetasPrensadoParams {
  orden: OrdenPlanchaEspumaPrensado;
  formato: FormatoEtiquetaPrensado;
  /** Números de etiqueta (dentro de la orden) a imprimir, en orden. */
  netiquetas: number[];
  operador: string;
  printerIP?: string;
}

export interface ResultadoImpresionPrensado {
  /** Enviadas a la impresora correctamente. */
  impresas: number;
  /** Guardadas en el log (incluye una que haya fallado después al enviarse a la impresora). */
  registradas: number;
  /** Secuenciales efectivamente impresos. */
  secuenciales: number[];
  /** Números de etiqueta que quedaron sin registrar ni imprimir por un error. */
  pendientes: number[];
  /** Presente si el proceso se detuvo; ya redactado para mostrarse al usuario. */
  error: { titulo: string; descripcion: string } | null;
}

/**
 * Imprime las etiquetas indicadas de una orden. Por cada una, en este orden estricto:
 *   1) consulta el secuencial justo antes (último + 1), para no chocar con otra estación;
 *   2) registra el log en BDD; si falla, NO imprime y detiene el proceso;
 *   3) recién con el registro confirmado la envía a la impresora.
 * Nunca lanza: el resultado indica qué se completó y qué quedó pendiente.
 */
export async function imprimirEtiquetasPrensado({
  orden,
  formato,
  netiquetas,
  operador,
  printerIP,
}: ImprimirEtiquetasPrensadoParams): Promise<ResultadoImpresionPrensado> {
  const resultado: ResultadoImpresionPrensado = {
    impresas: 0,
    registradas: 0,
    secuenciales: [],
    pendientes: [],
    error: null,
  };
  const total = netiquetas.length;
  const progreso = () => `(${resultado.impresas} de ${total} completadas)`;

  for (let i = 0; i < total; i++) {
    const netiqueta = netiquetas[i];

    let secuencial: number;
    try {
      secuencial = (await planchaEspumaPrensadoService.buscarSecuencialPrensado()) + 1;
    } catch (err) {
      console.error("[ETIQUETAS-PRENSADO] Error al consultar secuencial:", err);
      resultado.pendientes = netiquetas.slice(i);
      resultado.error = {
        titulo: "Error al consultar el secuencial",
        descripcion: `${mensajeDe(err)} No se imprimió la etiqueta ${netiqueta}; se detuvo el proceso ${progreso()}.`,
      };
      break;
    }

    // El logo (~DG) solo se descarga a la impresora con la primera etiqueta del lote.
    const etiqueta = generarEtiquetaPrensado(formato, orden, secuencial, netiqueta, i === 0);

    try {
      await planchaEspumaPrensadoService.guardarLogPrensado({
        codbarras: etiqueta.codigo,
        orden: String(orden.Orden ?? ""),
        operador,
        secuencial: etiqueta.secuencial,
        producto: String(orden.Nombre ?? ""),
        netiqueta: etiqueta.netiqueta,
        codPedido: String(orden.Pedido ?? "").trim(),
      });
      resultado.registradas++;
    } catch (err) {
      console.error("[ETIQUETAS-PRENSADO] Error al guardar log de impresión:", err);
      resultado.pendientes = netiquetas.slice(i);
      resultado.error = {
        titulo: `Error al registrar la etiqueta ${netiqueta}`,
        descripcion: `${mensajeDe(err)} No se imprimió; se detuvo el proceso ${progreso()}.`,
      };
      break;
    }

    try {
      await enviarZPL(etiqueta.zpl, printerIP);
      resultado.impresas++;
      resultado.secuenciales.push(etiqueta.secuencial);
      // Pequeño delay entre etiquetas, mismo patrón usado en otros módulos de impresión.
      await new Promise((r) => setTimeout(r, 300));
    } catch (err) {
      // Esta ya quedó registrada: no cuenta como pendiente (se reimprime desde "Reimprimir").
      resultado.pendientes = netiquetas.slice(i + 1);
      resultado.error = {
        titulo: `Error al imprimir la etiqueta ${netiqueta}`,
        descripcion: `${mensajeDe(err)} El registro (secuencial ${etiqueta.secuencial}) ya quedó guardado. Se detuvo la impresión ${progreso()}.`,
      };
      break;
    }
  }

  // Limpiar el logo descargado en la impresora (solo aplica al formato normal, que lo usa).
  if (formato === "normal" && resultado.registradas > 0) {
    try {
      await enviarZPL(ZPL_LIMPIAR_LOGO, printerIP);
    } catch (cleanupErr) {
      console.warn("[ETIQUETAS-PRENSADO] No se pudo limpiar el logo de la impresora:", cleanupErr);
    }
  }

  return resultado;
}

/** "192" o "192 a 195" para los mensajes al usuario. */
export function rangoSecuenciales(secuenciales: number[]): string {
  if (secuenciales.length === 0) return "-";
  const primero = secuenciales[0];
  const ultimo = secuenciales[secuenciales.length - 1];
  return primero === ultimo ? String(primero) : `${primero} a ${ultimo}`;
}
