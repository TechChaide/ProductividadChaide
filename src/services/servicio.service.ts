
import { environment } from "@/environments/environments.prod";
import type { BodyListResponse } from "@/types/body-list-response";
import type { OrdenProduccion } from "@/types/interfaces";

const API_URL = `${environment.apiURL}/api/servicios/ordenes`;

interface GetOrdenesParams {
  maquinas: string;
  usuarios: string;
}

export const servicioService = {
  async getOrdenes(params: GetOrdenesParams): Promise<BodyListResponse<OrdenProduccion>> {
    const requestBody = {
        // Ensure both parameters are always sent, even if one is empty
        maquinas: params.maquinas || "",
        usuarios: params.usuarios || "",
    };
    
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido en el servidor' }));
      throw new Error(errorBody.message || `Error ${response.status}: ${response.statusText}`);
    }

    return response.json();
  },
};

    