
import { environment } from "@/environments/environments.prod";
import type { Linea, LogCambioPlasticos } from "@/types/interfaces";
import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";

const API_URL = `${environment.apiURL}/api/log-cambio-plasticos`;

export const logCambioPlasticosService = {
  async getAll(): Promise<BodyListResponse<LogCambioPlasticos>> {
    const response = await fetch(API_URL);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to fetch log');
    }
    return response.json();
  },

  async getById(id: number | string): Promise<BodyResponse<LogCambioPlasticos>> {
    const response = await fetch(`${API_URL}/${id}`);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || `Failed to fetch log with id ${id}`);
    }
    return response.json();
  },

  async save(data: LogCambioPlasticos): Promise<BodyResponse<LogCambioPlasticos>> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to save log');
    }
    return response.json();
  },

  async delete(id: number | string): Promise<BodyResponse<LogCambioPlasticos>> {
    const response = await fetch(`${API_URL}/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || `Failed to delete log with id ${id}`);
    }
    return response.json();
  },
};
