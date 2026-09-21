
import { environment } from "@/environments/environments.prod";
import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";
import type { OrdenPlanchaEspumaPrensado, LogPlanchaEspumaPrensado } from "@/types/interfaces";

const API_URL = `${environment.apiURL}/api/servicios`;

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
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido en el servidor' }));
      throw new Error(errorBody.message || `Error ${response.status}: ${response.statusText}`);
    }

    return response.json();
  },

  async guardarLogPrensado(payload: LogPlanchaEspumaPrensado): Promise<BodyResponse<LogPlanchaEspumaPrensado>> {
    const response = await fetch(`${API_URL}/insertarLogPlanchasEspumaPrensado`, {
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
