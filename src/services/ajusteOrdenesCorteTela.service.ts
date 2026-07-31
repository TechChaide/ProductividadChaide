
import { environment } from "@/environments/environments.prod";
import type { BodyListResponse } from "@/types/body-list-response";
import type {
  PreNotificacionOrden,
  InsertarPreNotificacionPayload,
  InsertarPreNotificacionResponse,
} from "@/types/interfaces";

const API_URL = `${environment.apiURL}/api/servicios`;

export const ajusteOrdenesCorteTelaService = {
  async listaPorFecha(fechaInicio: string, fechaFin: string): Promise<BodyListResponse<PreNotificacionOrden>> {
    const response = await fetch(`${API_URL}/preNotificacionesPorFecha`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fechaInicio, fechaFin }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido en el servidor' }));
      throw new Error(errorBody.message || `Error ${response.status}: ${response.statusText}`);
    }

    return response.json();
  },

  async porOrden(orden: string): Promise<BodyListResponse<PreNotificacionOrden>> {
    const response = await fetch(`${API_URL}/preNotificacionPorOrden`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ orden }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido en el servidor' }));
      throw new Error(errorBody.message || `Error ${response.status}: ${response.statusText}`);
    }

    return response.json();
  },

  async confirmar(payload: InsertarPreNotificacionPayload): Promise<InsertarPreNotificacionResponse> {
    const response = await fetch(`${API_URL}/insertarPreNotificacion`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido en el servidor' }));
      throw new Error(errorBody.message || `Error ${response.status}: ${response.statusText}`);
    }

    return response.json();
  },
};
