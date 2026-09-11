import type { CausaDefecto } from "@/types/integrations/muestreos-ddpp";
import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";
import { environment } from "@/environments/environments.prod";
import { fetchWithAuth } from "./http-client";

const API_URL = `${environment.apiSamplingBA}/api/causa_defecto`;

export const causaDefectoService = {
  async getAll(): Promise<BodyListResponse<CausaDefecto>> {
    const response = await fetchWithAuth(API_URL);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to fetch causas de defecto');
    }
    return response.json();
  },

  async getById(id: number | string): Promise<BodyResponse<CausaDefecto>> {
    const response = await fetchWithAuth(`${API_URL}/${id}`);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || `Failed to fetch causa de defecto with id ${id}`);
    }
    return response.json();
  },

  async save(data: CausaDefecto): Promise<BodyResponse<CausaDefecto>> {
    const response = await fetchWithAuth(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to save causa de defecto');
    }
    return response.json();
  },

  async delete(id: number | string): Promise<void> {
    const response = await fetchWithAuth(`${API_URL}/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || `Failed to delete causa de defecto with id ${id}`);
    }
  },

  async getCausasDefectoByCodigoOrigenComponente(codigo_origen_componente: number): Promise<BodyResponse<CausaDefecto>> {
    const response = await fetchWithAuth(API_URL + '/recuperarCausasDefectoByCodigoOC', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo_origen_componente: codigo_origen_componente }),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to save causa de defecto');
    }
    return response.json();
  },
};
