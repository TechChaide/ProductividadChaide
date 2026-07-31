
import { environment } from "@/environments/environments.prod";
import type { BodyListResponse } from "@/types/body-list-response";
import type {
  OrdenCorteTelaListItem,
  OrdenCorteTelaDetalle,
  InsertarPreNotificacionPayload,
  InsertarPreNotificacionResponse,
} from "@/types/interfaces";

const API_URL = `${environment.apiURL}/api/servicios`;

export const ordenCorteTelaService = {
  async listaPorFecha(fechaInicio: string, fechaFin: string): Promise<BodyListResponse<OrdenCorteTelaListItem>> {
    const response = await fetch(`${API_URL}/ordenesCorteTelaListaPorFecha`, {
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

  async porOrden(orden: string): Promise<BodyListResponse<OrdenCorteTelaDetalle>> {
    const response = await fetch(`${API_URL}/ordenCorteTelaPorOrden`, {
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

  async insertarPreNotificacion(payload: InsertarPreNotificacionPayload): Promise<InsertarPreNotificacionResponse> {
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
