import type { RegistroCausaDefecto } from "@/types/integrations/muestreos-ddpp";
import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";
import { environment } from "@/environments/environments.prod";
import { fetchWithAuth } from "./http-client";

const API_URL = `${environment.apiSamplingBA}/api/registro_causa_defecto`;

export const registroCausaDefectoService = {
  async getAll(): Promise<BodyListResponse<RegistroCausaDefecto>> {
    const response = await fetchWithAuth(API_URL);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({
        message: "Error desconocido",
      }));
      throw new Error(
        errorBody.message || "Failed to fetch registro_causa_defecto",
      );
    }
    return response.json();
  },

  async getById(
    id: number | string,
  ): Promise<BodyResponse<RegistroCausaDefecto>> {
    const response = await fetchWithAuth(`${API_URL}/${id}`);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({
        message: "Error desconocido",
      }));
      throw new Error(
        errorBody.message ||
          `Failed to fetch registro_causa_defecto with id ${id}`,
      );
    }
    return response.json();
  },

  async save(
    data: Partial<RegistroCausaDefecto>,
  ): Promise<BodyResponse<RegistroCausaDefecto>> {
    const response = await fetchWithAuth(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({
        message: "Error desconocido",
      }));
      throw new Error(
        errorBody.message || "Failed to save registro_causa_defecto",
      );
    }
    return response.json();
  },

  async delete(id: number | string): Promise<void> {
    const response = await fetchWithAuth(`${API_URL}/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({
        message: "Error desconocido",
      }));
      throw new Error(
        errorBody.message ||
          `Failed to delete registro_causa_defecto with id ${id}`,
      );
    }
  },
};
