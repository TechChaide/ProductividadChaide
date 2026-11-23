
import { environment } from "@/environments/environments.prod";
import type {
  RespuestaDesperdicioXCodBarras,
  RespuestaIngresoDesperdicio,
} from "@/types/interfaces";

// El API puede devolver el detalle del error en distintas claves (o en texto plano);
// se intenta con todas para que el mensaje que llega al usuario sea el real del servidor.
async function extraerMensajeError(response: Response): Promise<string> {
  const generico = `Error ${response.status}: ${response.statusText}`;
  const raw = await response.text().catch(() => "");
  if (!raw) return generico;
  try {
    const parsed = JSON.parse(raw);
    return parsed?.msg || parsed?.message || parsed?.error || parsed?.Mensaje || raw;
  } catch {
    return raw;
  }
}

const API_URL = `${environment.apiURL}/api/servicios`;

/** ESTADO de DesperdiciosAreas cuando ya se ingresó (1 = pendiente). */
export const ESTADO_DESPERDICIO_INGRESADO = 2;

/**
 * Error de /ingresarDesperdicio. `reintentable` es false cuando SAP pudo haber creado el
 * documento igual (no respondió a tiempo, o lo creó y no se marcó en la BDD): reenviarlo
 * podría duplicar la salida del desperdicio. 409 = ya estaba ingresado.
 */
export class IngresoDesperdicioError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly reintentable: boolean
  ) {
    super(message);
    this.name = "IngresoDesperdicioError";
  }
}

export const desperdicioService = {
  /** Desperdicio pesado en la balanza por su código de barras. `data` viene vacía si no existe. */
  async buscarDesperdicioXCodBarras(codbarras: string): Promise<RespuestaDesperdicioXCodBarras> {
    const response = await fetch(`${API_URL}/buscarDesperdicioXCodBarras`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ codbarras }),
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(await extraerMensajeError(response));
    }

    return response.json();
  },

  /**
   * Envía el desperdicio a SAP (ZmmWsMigo) y lo marca como ingresado. Solo resuelve si quedó
   * ingresado; si no, lanza IngresoDesperdicioError con el mensaje del servidor o de SAP.
   */
  async ingresarDesperdicio(codbarras: string): Promise<RespuestaIngresoDesperdicio> {
    const response = await fetch(`${API_URL}/ingresarDesperdicio`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ codbarras }),
    });

    const body: RespuestaIngresoDesperdicio | null = await response.json().catch(() => null);
    if (!response.ok || !body?.ingresado) {
      throw new IngresoDesperdicioError(
        body?.msg || `Error ${response.status}: ${response.statusText}`,
        response.status,
        body?.reintentable !== false
      );
    }

    return body;
  },
};
