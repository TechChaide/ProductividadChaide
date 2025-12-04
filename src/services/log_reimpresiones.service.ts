
import { environment } from "@/environments/environments.prod";
import type { LogReimpresiones, Sesion } from "@/types/interfaces";
import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";

const API_URL = `${environment.apiURL}/api/log-reimpresiones`;

export const LogReimpresionesService = {
  async getAll(): Promise<BodyListResponse<LogReimpresiones>> {
    const response = await fetch(API_URL);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to fetch sesiones');
    }
    return response.json();
  },

  async getById(id: number | string): Promise<BodyResponse<LogReimpresiones>> {
    const response = await fetch(`${API_URL}/${id}`);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || `Failed to fetch sesion with id ${id}`);
    }
    return response.json();
  },

  async save(data: LogReimpresiones): Promise<BodyResponse<LogReimpresiones>> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to save log reimpresion');
    }
    return response.json();
  },

  async delete(id: number | string): Promise<BodyResponse<LogReimpresiones>> {
    const response = await fetch(`${API_URL}/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || `Failed to delete sesion with id ${id}`);
    }
    return response.json();
  },

  async getLogImpresionesPorOrden(num_orden: string): Promise<BodyResponse<any>> {

    const response = await fetch(`${API_URL}/LbyNOP`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({numero_orden: num_orden}),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido en el servidor' }));
      throw new Error(errorBody.message || `Error ${response.status}: ${response.statusText}`);
    }

    return response.json();
  },

  async getLogImpresionesPorCodigoBarrasF(codigo_barras: string): Promise<BodyResponse<any>> {

    const response = await fetch(`${API_URL}/LbyNOPPlastificado`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({codigo_barras: codigo_barras}),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido en el servidor' }));
      throw new Error(errorBody.message || `Error ${response.status}: ${response.statusText}`);
    }

    return response.json();
  },

};
