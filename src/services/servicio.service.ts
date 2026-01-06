
import { environment } from "@/environments/environments.prod";
import type { BodyListResponse } from "@/types/body-list-response";
import { BodyResponse } from "@/types/body-response";
import type { EtiquetaPlastificado, OrdenProduccion } from "@/types/interfaces";

const API_URL = `${environment.apiURL}/api/servicios`;

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

    const response = await fetch(API_URL + '/ordenes', {
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

  async getOrdenesAlmohadas(params: GetOrdenesParams): Promise<BodyListResponse<OrdenProduccion>> {
    const requestBody = {
      // Ensure both parameters are always sent, even if one is empty
      maquinas: params.maquinas || "",
      usuarios: params.usuarios || "",
    };

    const response = await fetch(API_URL + '/ordenesAlmh', {
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

  async getOrdenPPH(num_orden: string): Promise<BodyResponse<OrdenProduccion>> {

    const response = await fetch(API_URL + '/order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ num_orden: num_orden }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido en el servidor' }));
      throw new Error(errorBody.message || `Error ${response.status}: ${response.statusText}`);
    }

    return response.json();
  },

  async generarCodigoDeBarras(orden: string, cantidad: number, operador: string, colaboradores: string, estacion: string): Promise<BodyListResponse<any>> {
    const requestBody = {
      orden: orden,
      cantidad: cantidad,
      operador: operador,
      colaboradores: colaboradores,
      estacion: estacion
    };

    const response = await fetch(API_URL + '/bar-code_generation', {
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

  async codigoDeBarrasReaderC(codigoBarras: string): Promise<BodyListResponse<any>> {
    const requestBody = {
      codigoBarras
    };

    const response = await fetch(API_URL + '/bar-code_readerC', {
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

  async codigoDeBarrasReader(codigoBarras: string): Promise<BodyListResponse<any>> {
    const requestBody = {
      codigoBarras
    };

    const response = await fetch(API_URL + '/bar-code_reader', {
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


  async getOrdenesReImpresion(num_orden: string): Promise<BodyResponse<OrdenProduccion>> {

    const response = await fetch(API_URL + '/reprint_order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ num_orden: num_orden }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido en el servidor' }));
      throw new Error(errorBody.message || `Error ${response.status}: ${response.statusText}`);
    }

    return response.json();
  },

  async getReimpresionPlastificado(codigo_QR: string): Promise<BodyResponse<EtiquetaPlastificado>> {

    const response = await fetch(API_URL + '/reprintPlastificado', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ codQR: codigo_QR }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido en el servidor' }));
      throw new Error(errorBody.message || `Error ${response.status}: ${response.statusText}`);
    }

    return response.json();
  },

  async cargarOrdenes(data: { orden: string; descripcion: string; almacen: string }): Promise<any> {
    const response = await fetch(API_URL + '/cargar_ordenes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido en el servidor' }));
      // Support both 'message' and 'msg' fields from the API
      const errorMessage = errorBody.msg || errorBody.message || `Error ${response.status}: ${response.statusText}`;
      throw new Error(errorMessage);
    }

    return response.json();
  },
};

