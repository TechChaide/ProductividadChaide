import type { Subcomponentes } from "@/types/integrations/muestreos-ddpp";
import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";
import { environment } from "@/environments/environments.prod";
import { fetchWithAuth } from "./http-client";

const API_URL = `${environment.apiSamplingBA}/api/subcomponentes`;

export const subcomponentesService = {
  async getAll(): Promise<BodyListResponse<Subcomponentes>> {
    const response = await fetchWithAuth(API_URL);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to fetch subcomponentes');
    }
    return response.json();
  },

  async getById(id: number | string): Promise<BodyResponse<Subcomponentes>> {
    const response = await fetchWithAuth(`${API_URL}/${id}`);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || `Failed to fetch subcomponentes with id ${id}`);
    }
    return response.json();
  },

  async save(data: Subcomponentes): Promise<BodyResponse<Subcomponentes>> {
    const response = await fetchWithAuth(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to save subcomponentes');
    }
    return response.json();
  },

  async delete(id: number | string): Promise<void> {
    const response = await fetchWithAuth(`${API_URL}/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || `Failed to delete subcomponentes with id ${id}`);
    }
  },

  async getSubcomponentesByCodigoElementoAsociacion(codigoElementoAsociacion: number): Promise<BodyListResponse<Subcomponentes>> {
    const response = await fetchWithAuth(API_URL + '/obtenerSubcomponentesByCodigoElementoAsociacion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo_elemento_asociacion: codigoElementoAsociacion }),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to fetch subcomponentes by codigoElementoAsociacion');
    }
    return response.json();
  },
};
