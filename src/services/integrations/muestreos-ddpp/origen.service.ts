import type { Origen } from "@/types/integrations/muestreos-ddpp";
import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";
import { environment } from "@/environments/environments.prod";
import { fetchWithAuth } from "./http-client";

const API_URL = `${environment.apiSamplingBA}/api/origen`;

export const origenService = {
  async getAll(): Promise<BodyListResponse<Origen>> {
    const response = await fetchWithAuth(API_URL);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to fetch origenes');
    }
    return response.json();
  },

  async getById(id: number | string): Promise<BodyResponse<Origen>> {
    const response = await fetchWithAuth(`${API_URL}/${id}`);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || `Failed to fetch origen with id ${id}`);
    }
    return response.json();
  },

  async save(data: Origen): Promise<BodyResponse<Origen>> {
    const response = await fetchWithAuth(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to save origen');
    }
    return response.json();
  },

  async delete(id: number | string): Promise<void> {
    const response = await fetchWithAuth(`${API_URL}/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || `Failed to delete origen with id ${id}`);
    }
  },

  async getOrigenesByCodigoAreaTipoMotivo(codigo_area_tipo_motivo: number): Promise<BodyResponse<Origen>> {
    const response = await fetchWithAuth(API_URL + '/getOrigenesByAreaTipoMotivo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo_area_tipo_motivo: codigo_area_tipo_motivo }),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to fetch origenes by codigo_area_tipo_motivo');
    }
    return response.json();
  },
};
