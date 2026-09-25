
import { environment } from "@/environments/environments.prod";
import type { BodyListResponse } from "@/types/body-list-response";
import { BodyResponse } from "@/types/body-response";
import type { EtiquetaPlastificado, OrdenProduccion, LogCambioPlasticos, CambioPorTipo, CambioPorSolicitante, BodegaPorCentro, InformacionQR, InformacionMaterial, MaterialPivoteado, MovimientoPorIngreso } from "@/types/interfaces";

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

  async getElementsByCentroAndFert(fert: string, centro: string): Promise<BodyListResponse<any>> {

    const response = await fetch(API_URL + '/getElementsByCentroAndFert', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({material: fert, centro: centro }),
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


  //////DAshboard cambios de plasticos conectores:

    async getUltimosCambios(): Promise<BodyListResponse<LogCambioPlasticos>> {

    const response = await fetch(API_URL + '/UltimosCambios', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido en el servidor' }));
      throw new Error(errorBody.message || `Error ${response.status}: ${response.statusText}`);
    }

    return response.json();
  },

  async getProcesosPorTipoCambio(): Promise<BodyListResponse<CambioPorTipo>> {

    const response = await fetch(API_URL + '/ProcesosPorTipoCambio', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido en el servidor' }));
      throw new Error(errorBody.message || `Error ${response.status}: ${response.statusText}`);
    }

    return response.json();
  },

  async getCambiosPorSolicitante(): Promise<BodyListResponse<CambioPorSolicitante>> {

    const response = await fetch(API_URL + '/getProcesosPorSolicitante', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido en el servidor' }));
      throw new Error(errorBody.message || `Error ${response.status}: ${response.statusText}`);
    }

    return response.json();
  },

  async getMaterialesCambiados(): Promise<BodyListResponse<any>> {
    const response = await fetch(API_URL + '/getMaterialesCambiados', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido en el servidor' }));
      throw new Error(errorBody.message || `Error ${response.status}: ${response.statusText}`);
    }

    return response.json();
  },

  async getCambiosPorIntervaloDeFechas(fechaInicio: Date, fechaFin: Date): Promise<BodyListResponse<LogCambioPlasticos>> {
    const response = await fetch(API_URL + '/getMaterialesCambiadosPorFechas', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fechaInicio: fechaInicio.toISOString(), fechaFin: fechaFin.toISOString() }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido en el servidor' }));
      throw new Error(errorBody.message || `Error ${response.status}: ${response.statusText}`);
    }

    return response.json();
  },

  async getBodegasPorCentro(): Promise<BodyListResponse<BodegaPorCentro>> {
    const response = await fetch(API_URL + '/getBodegasPorCentro', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido en el servidor' }));
      throw new Error(errorBody.message || `Error ${response.status}: ${response.statusText}`);
    }

    return response.json();
  },

  async getInformacionQR(codigo: string): Promise<BodyListResponse<InformacionQR>> {
    const response = await fetch(API_URL + '/getInformacionQR', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ Codigo: codigo }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido en el servidor' }));
      throw new Error(errorBody.message || errorBody.msg || `Error ${response.status}: ${response.statusText}`);
    }

    return response.json();
  },

  async getInformacionMaterial(codigo: string, centro: string): Promise<BodyListResponse<InformacionMaterial>> {
    const response = await fetch(API_URL + '/getInformacionMaterial', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ Codigo: codigo, Centro: centro }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido en el servidor' }));
      throw new Error(errorBody.message || errorBody.msg || `Error ${response.status}: ${response.statusText}`);
    }

    return response.json();
  },

  /**
   * Pivote por semielaborado.
   * @param material código del material (orden.material)
   * @param nombreMaterial descripción/nombre (orden.descripcionMaterial)
   */
  async getMaterialesPivotFertPrincipal(
    material: string,
    nombreMaterial?: string
  ): Promise<BodyListResponse<MaterialPivoteado>> {
    const response = await fetch(API_URL + '/MaterialesPivotFertPrincipal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        Codigo: material,
        Descripcion: nombreMaterial ?? "",
        Material: material,
        NombreMaterial: nombreMaterial ?? "",
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido en el servidor' }));
      throw new Error(errorBody.message || errorBody.msg || `Error ${response.status}: ${response.statusText}`);
    }

    return response.json();
  },

  /** Inverso: material (tela) → todos los FERT que lo usan (ListaMaterialesNivelesPivoteado). */
  async getMaterialesPivotPorMaterial(codigo: string): Promise<BodyListResponse<MaterialPivoteado>> {
    const response = await fetch(API_URL + '/MaterialesPivotPorMaterial', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ Codigo: codigo }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido en el servidor' }));
      throw new Error(errorBody.message || errorBody.msg || `Error ${response.status}: ${response.statusText}`);
    }

    return response.json();
  },

  /**
   * Movimientos / saldo de un ingreso (rollo).
   * Backend: POST /api/servicios/MovimientosPorIngreso → sp_Get_MovimientosPorIngreso
   */
  async getMovimientosPorIngreso(
    codigoIngreso: number,
    cantidadNecesaria?: number | null
  ): Promise<BodyListResponse<MovimientoPorIngreso>> {
    const response = await fetch(API_URL + '/MovimientosPorIngreso', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        CodigoIngreso: codigoIngreso,
        CantidadNecesaria:
          cantidadNecesaria === undefined ? null : cantidadNecesaria,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido en el servidor' }));
      throw new Error(errorBody.message || errorBody.msg || `Error ${response.status}: ${response.statusText}`);
    }

    return response.json();
  },
};
