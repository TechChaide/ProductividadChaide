import type { Registro } from "@/types/integrations/muestreos-ddpp";
import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";
import { environment } from "@/environments/environments.prod";
import { fetchWithAuth } from "./http-client";
import { auditFieldsOnEdit } from "@/lib/integrations/muestreos-ddpp/datetime2";
import { getCodigoEmpleadoSesion } from "@/lib/integrations/muestreos-ddpp/session-storage";

const API_URL = `${environment.apiSamplingBA}/api/registro`;

export const registroService = {
  async getAll(): Promise<BodyListResponse<Registro>> {
    const response = await fetchWithAuth(API_URL);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to fetch registros');
    }
    return response.json();
  },

  async getById(id: number | string): Promise<BodyResponse<Registro>> {
    const response = await fetchWithAuth(`${API_URL}/${id}`);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || `Failed to fetch registro with id ${id}`);
    }
    return response.json();
  },

  async save(data: Registro): Promise<BodyResponse<Registro>> {
    const isEdit = Number(data.codigo_registro) > 0;
    const payload: Registro = { ...data };

    if (!isEdit) {
      // INSERT: usuario_modificacion / fecha_modificacion solo en edición.
      delete payload.usuario_modificacion;
      delete payload.fecha_modificacion;
    } else {
      Object.assign(payload, auditFieldsOnEdit(getCodigoEmpleadoSesion()));
    }

    const response = await fetchWithAuth(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to save registro');
    }
    return response.json();
  },

  async delete(id: number | string): Promise<void> {
    const response = await fetchWithAuth(`${API_URL}/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || `Failed to delete registro with id ${id}`);
    }
  },
};
