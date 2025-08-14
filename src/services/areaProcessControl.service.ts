
import { environment } from "@/environments/environments.prod";
import type { AreaProcessControl } from "@/types/interfaces";
import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";

const API_URL = `${environment.apiURL}/api/area-process-controls`;

export const areaProcessControlService = {
  async getAll(): Promise<BodyListResponse<AreaProcessControl>> {
    const response = await fetch(API_URL);
    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
        throw new Error(errorBody.message || 'Failed to fetch area process controls');
    }
    return response.json();
  },

  async getById(id: number | string): Promise<BodyResponse<AreaProcessControl>> {
    const response = await fetch(`${API_URL}/${id}`);
     if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
        throw new Error(errorBody.message || `Failed to fetch area process control with id ${id}`);
    }
    return response.json();
  },

  async save(data: AreaProcessControl): Promise<BodyResponse<AreaProcessControl>> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
        throw new Error(errorBody.message || 'Failed to save area process control');
    }
    return response.json();
  },

  async delete(id: number | string): Promise<BodyResponse<AreaProcessControl>> {
    const response = await fetch(`${API_URL}/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
        throw new Error(errorBody.message || `Failed to delete area process control with id ${id}`);
    }
    return response.json();
  },
};
