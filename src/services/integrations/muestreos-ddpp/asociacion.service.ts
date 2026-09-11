import type { Asociacion } from "@/types/integrations/muestreos-ddpp";
import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";
import { environment } from "@/environments/environments.prod";
import { fetchWithAuth } from "./http-client";

const API_URL = `${environment.apiSamplingBA}/api/asociacion`;

export interface CreateAsociacionInput {
  codigo_asociacion: number;
  codigo_elemento_asociacion: number;
  codigo_componente: number;
  codigo_area_tipo_motivo: number;
  codigo_tipo_medicion: number;
  tabla: string;
  tabla_version: number;
  orden: number;
  etiqueta: string;
  estado: string;
  fecha_modificacion?: string;
  usuario_modificacion?: string;
}

export const asociacionService = {
  async getAll(): Promise<BodyListResponse<Asociacion>> {
    const response = await fetchWithAuth(API_URL);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to fetch asociaciones');
    }
    return response.json();
  },

  async getById(id: number | string): Promise<BodyResponse<Asociacion>> {
    const response = await fetchWithAuth(`${API_URL}/${id}`);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || `Failed to fetch asociacion with id ${id}`);
    }
    return response.json();
  },

  async save(data: Asociacion): Promise<BodyResponse<Asociacion>> {
    const response = await fetchWithAuth(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to save asociacion');
    }
    return response.json();
  },

  async delete(id: number | string): Promise<void> {
    const response = await fetchWithAuth(`${API_URL}/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || `Failed to delete asociacion with id ${id}`);
    }
  },

  async getTablaByAreaTipoMotivo(codigo_area_tipo_motivo: number, codigo_componente: number): Promise<BodyListResponse<Asociacion>> {
    const response = await fetchWithAuth(API_URL + '/getTablaByCodigoAreaTipoMotivoYComponente', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo_area_tipo_motivo: codigo_area_tipo_motivo, codigo_componente: codigo_componente }),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to fetch asociaciones by area-tipo-motivo');
    }
    return response.json();
  },
};
