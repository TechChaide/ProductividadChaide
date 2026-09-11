import type { AreaTipoMotivo } from "@/types/integrations/muestreos-ddpp";
import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";
import { environment } from "@/environments/environments.prod";
import { fetchWithAuth } from "./http-client";

const API_URL = `${environment.apiSamplingBA}/api/area_tipo_motivo`;

export const areaTipoMotivoService = {
  async getAll(): Promise<BodyListResponse<AreaTipoMotivo>> {
    const response = await fetchWithAuth(API_URL);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to fetch area-tipo-motivo');
    }
    return response.json();
  },

  async getById(id: number | string): Promise<BodyResponse<AreaTipoMotivo>> {
    const response = await fetchWithAuth(`${API_URL}/${id}`);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || `Failed to fetch area-tipo-motivo with id ${id}`);
    }
    return response.json();
  },

  async save(data: AreaTipoMotivo): Promise<BodyResponse<AreaTipoMotivo>> {
    const response = await fetchWithAuth(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to save area-tipo-motivo');
    }
    return response.json();
  },

  async delete(id: number | string): Promise<void> {
    const response = await fetchWithAuth(`${API_URL}/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || `Failed to delete area-tipo-motivo with id ${id}`);
    }
  },

  async getTiposMotivoByCodigoArea(codigo_area: number): Promise<BodyResponse<AreaTipoMotivo>> {
    const response = await fetchWithAuth(API_URL + '/GetMotivosByArea', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo_area: codigo_area }),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to save area-tipo-motivo');
    }
    return response.json();
  },
};
