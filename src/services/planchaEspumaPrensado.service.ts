
import { environment } from "@/environments/environments.prod";
import type { BodyListResponse } from "@/types/body-list-response";
import type {
  OrdenPlanchaEspumaPrensado,
  LogPlanchaEspumaPrensado,
  RespuestaLogPlanchaEspumaPrensado,
  SecuencialPlanchaEspumaPrensado,
  EtiquetaImpresaPrensado,
  BuscarEtiquetasPrensadoPayload,
  BuscarEtiquetasQRPrensadoPayload,
  RespuestaEtiquetasQRPrensado,
} from "@/types/interfaces";

// El API puede devolver el detalle del error en distintas claves (o en texto plano);
// se intenta con todas para que el mensaje que llega al usuario sea el real del servidor.
async function extraerMensajeError(response: Response): Promise<string> {
  const generico = `Error ${response.status}: ${response.statusText}`;
  const raw = await response.text().catch(() => "");
  if (!raw) return generico;
  try {
    const parsed = JSON.parse(raw);
    // Las validaciones del API (400 por campo faltante) vienen en `msg`.
    return parsed?.msg || parsed?.message || parsed?.error || parsed?.Mensaje || raw;
  } catch {
    return raw;
  }
}

const API_URL = `${environment.apiURL}/api/servicios`;

// Valores fijos por ahora. MESA_PRENSADO se guarda como `mesa` al insertar el log y se
// envía como `estacion` al buscar; el API compara ambos exactos, así que deben coincidir.
export const MESA_PRENSADO = "Impresion";
export const TIPO_OPE_PRENSADO = "X";

export const planchaEspumaPrensadoService = {
  async buscarOrdenesPlanchasEspumaPrensado(
    fechaInicio: string,
    fechaFin: string,
    centro: string
  ): Promise<BodyListResponse<OrdenPlanchaEspumaPrensado>> {
    const response = await fetch(`${API_URL}/buscarOrdenesPlanchasEspumaPrensado`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fechaInicio, fechaFin, centro }),
    });

    if (!response.ok) {
      throw new Error(await extraerMensajeError(response));
    }

    return response.json();
  },

  /**
   * Inserta el log de una etiqueta. Lanza si el servidor responde con error o si no
   * confirma la inserción: quien llama solo debe imprimir cuando esta promesa resuelve.
   */
  async guardarLogPrensado(
    payload: LogPlanchaEspumaPrensado
  ): Promise<BodyListResponse<RespuestaLogPlanchaEspumaPrensado>> {
    const response = await fetch(`${API_URL}/insertarLogPlanchasEspumaPrensado`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(await extraerMensajeError(response));
    }

    // Respuesta esperada: { data: [ { Mensaje: "Registro Ingresado", ... } ], length: 1 }.
    // Si no vino ninguna fila, el registro no quedó guardado.
    const body = await response.json().catch(() => null);
    if (!Array.isArray(body?.data) || body.data.length === 0) {
      throw new Error('El servidor no confirmó el registro de la etiqueta.');
    }

    return body;
  },

  /**
   * Último secuencial registrado. Respuesta: { data: [ { secuencial: 191 } ], length: 1 }.
   * Lanza si no viene un número válido: sin secuencial confiable no se debe imprimir.
   */
  async buscarSecuencialPrensado(): Promise<number> {
    const response = await fetch(`${API_URL}/buscarSecuencialPrensado`, {
      method: 'GET',
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(await extraerMensajeError(response));
    }

    const body: BodyListResponse<SecuencialPlanchaEspumaPrensado> | null = await response
      .json()
      .catch(() => null);
    const secuencial = Number(body?.data?.[0]?.secuencial);
    if (!Number.isInteger(secuencial) || secuencial < 0) {
      throw new Error('El servidor no devolvió un secuencial válido.');
    }

    return secuencial;
  },

  /** Etiquetas ya impresas (registradas en el log) de una orden y estación, para reimpresión. */
  async buscarEtiquetasXOrdenPrensado(
    orden: string,
    estacion: string = MESA_PRENSADO
  ): Promise<BodyListResponse<EtiquetaImpresaPrensado>> {
    const payload: BuscarEtiquetasPrensadoPayload = { orden, estacion };
    const response = await fetch(`${API_URL}/buscarEtiquetasXOrdenPrensado`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(await extraerMensajeError(response));
    }

    return response.json();
  },

  /**
   * Etiqueta asociada al código QR leído en la estación de Lectura Prensado. Si `data` viene
   * vacía, la etiqueta no se debe registrar y `msg` trae el motivo (no encontrada o ya procesada).
   */
  async buscarEtiquetasXQRPrensado(
    qr: string,
    estacion: string
  ): Promise<RespuestaEtiquetasQRPrensado> {
    const payload: BuscarEtiquetasQRPrensadoPayload = { qr, estacion };
    const response = await fetch(`${API_URL}/buscarEtiquetasXQRPrensado`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(await extraerMensajeError(response));
    }

    return response.json();
  },

  /**
   * Etiquetas distintas leídas en una estación dentro de un rango de fechas
   * ("YYYY-MM-DD HH:mm:ss.SSS", hora local). Respuesta: { data: [ { TotalQRDiferentes: 144 } ] }.
   */
  async buscarCantQRxEstacionRangoPrensado(
    fechaInicio: string,
    fechaFin: string,
    estacion: string
  ): Promise<number> {
    const response = await fetch(`${API_URL}/buscarCantQRxEstacionRangoPrensado`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fechaInicio, fechaFin, estacion }),
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(await extraerMensajeError(response));
    }

    const body = await response.json().catch(() => null);
    const total = Number(body?.data?.[0]?.TotalQRDiferentes ?? body?.total ?? 0);
    return Number.isFinite(total) ? total : 0;
  },

  /**
   * Anula etiquetas de una orden para reimprimirlas (sp_CambiaEstadoEtiquetasPrensado: deja
   * netiqueta en 0 y guarda el log de reimpresión). netiqueta = -1 anula todas las activas.
   * Devuelve cuántas filas se anularon. Lanza si no anuló ninguna: en ese caso NO se debe
   * imprimir la etiqueta nueva.
   */
  async cambiarEstadoEtiquetasPrensado(payload: {
    orden: string;
    netiqueta: number;
    codUsuario: string;
  }): Promise<number> {
    const response = await fetch(`${API_URL}/cambiarEstadoEtiquetasPrensado`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(await extraerMensajeError(response));
    }

    // El SP responde { Actualizados, Mensaje }; normalmente llega envuelto en data[0].
    const body = await response.json().catch(() => null);
    const fila = Array.isArray(body?.data) ? body.data[0] : body;
    const actualizados = Number(fila?.Actualizados);
    if (!Number.isFinite(actualizados) || actualizados <= 0) {
      throw new Error(fila?.Mensaje || 'El servidor no confirmó la anulación de las etiquetas.');
    }

    return actualizados;
  },
};
