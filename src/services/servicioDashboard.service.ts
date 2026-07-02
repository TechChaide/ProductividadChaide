
import { environment } from "@/environments/environments.prod";
import type { BodyListResponse } from "@/types/body-list-response";
import { BodyResponse } from "@/types/body-response";
import type { EtiquetaPlastificado, OrdenProduccion, LogCambioPlasticos, CambioPorTipo, CambioPorSolicitante } from "@/types/interfaces";

const API_URL = `${environment.apiURL}/api/dsh-Servicios`;

function normalizarHora(valor: unknown): string {
  if (typeof valor !== "string") return "";

  const match = valor.match(/(\d{2}):(\d{2})/);
  if (!match) return valor.trim();

  return `${match[1]}:${match[2]}`;
}

function normalizarProductividadPersonaDiaActual<T>(response: BodyListResponse<T>): BodyListResponse<T> {
  if (!Array.isArray(response?.data)) {
    return response;
  }

  return {
    ...response,
    data: response.data.map((item: any) => ({
      ...item,
      HORA: normalizarHora(item.HORA ?? item.Hora ?? item.hora),
    })) as T[],
  };
}

function normalizarProductividadSegmentoDiasPersona<T>(response: BodyListResponse<T>): BodyListResponse<T> {
  if (!Array.isArray(response?.data)) {
    return response;
  }

  return {
    ...response,
    data: response.data.map((item: any) => ({
      ...item,
      TiempoSTDTotal: item.TiempoSTDTotal ?? item.TiempoSDTTotal ?? 0,
      ProductividadDiaria:
        item.ProductividadDiaria ?? item.ProductividadRespectoHorasNominales ?? 0,
      ProductividadDiariaTurno:
        item.ProductividadDiariaTurno ?? item.ProductividadRespectoTurnoHoras ?? 0,
      CantidadDefectos: item.CantidadDefectos ?? 0,
      UNIDADES_PROD: item.UNIDADES_PROD ?? 0,
    })) as T[],
  };
}


export const servicioService = {

  async getOperadoresPorNombredeAreaYFechaInicio(departamento: string, fechaInicio: Date): Promise<BodyListResponse<any>> {

    const response = await fetch(API_URL + '/operadoresByAreaYFI', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ departamento, fechaInicio }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido en el servidor' }));
      throw new Error(errorBody.message || `Error ${response.status}: ${response.statusText}`);
    }

    return response.json();
  },


  async getTiempoProduccionMedioMaterial(hojaRuta: string, material: string): Promise<BodyListResponse<any>> {

    const response = await fetch(API_URL + '/TiempoProduccionMaterialHR', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ hojaRuta, material }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido en el servidor' }));
      throw new Error(errorBody.message || `Error ${response.status}: ${response.statusText}`);
    }

    return response.json();
  },


  async getHabilidadesOperadorPorCodigoOperador(Codigo: string): Promise<BodyListResponse<any>> {

    const response = await fetch(API_URL + '/habilidadesOperadorByCodigo', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ Codigo }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido en el servidor' }));
      throw new Error(errorBody.message || `Error ${response.status}: ${response.statusText}`);
    }

    return response.json();
  },


  async getDepartamentosDisponiblesProduccion(): Promise<BodyListResponse<any>> {

    const response = await fetch(API_URL + '/DepartamentosDisponibles', {
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


  ////////////////////////////////////////////////////////////////////////////////////////////////////
  // async getOrdenesTrabajadasPorDepartamntoEmpleadoYFecha(departamento: string, empleado: string, fechaInicio: Date): Promise<BodyListResponse<OrdenProduccion>> {

  //   const response = await fetch(API_URL + '/OrdenesTrabajadasPorPDFI', {
  //     method: 'POST',
  //     headers: {
  //       'Content-Type': 'application/json',
  //     },
  //     body: JSON.stringify({ Departamento: departamento, CodigoEmpleado: empleado, fechaInicio }),
  //   });

  //   if (!response.ok) {
  //     const errorBody = await response.json().catch(() => ({ message: 'Error desconocido en el servidor' }));
  //     throw new Error(errorBody.message || `Error ${response.status}: ${response.statusText}`);
  //   }

  //   return response.json();
  // },

  // async getInformacionOrdenes(orden: string): Promise<BodyListResponse<any>> {

  //   const response = await fetch(API_URL + '/orderInfo', {
  //     method: 'POST',
  //     headers: {
  //       'Content-Type': 'application/json',
  //     },
  //     body: JSON.stringify({ CodigoOrden: orden }),
  //   });

  //   if (!response.ok) {
  //     const errorBody = await response.json().catch(() => ({ message: 'Error desconocido en el servidor' }));
  //     throw new Error(errorBody.message || `Error ${response.status}: ${response.statusText}`);
  //   }

  //   return response.json();
  // },

  // async getOrdenesTrabajadosPorEmpleadoPorEmpleadoYOrden(Orden: string, CodigoEmpleado: string): Promise<BodyListResponse<any>> {
  //   const response = await fetch(API_URL + '/orderInfoE', {
  //     method: 'POST',
  //     headers: {
  //       'Content-Type': 'application/json',
  //     },
  //     body: JSON.stringify({ Orden: Orden, CodigoEmpleado: CodigoEmpleado }),
  //   });

  //   if (!response.ok) {
  //     const errorBody = await response.json().catch(() => ({ message: 'Error desconocido en el servidor' }));
  //     throw new Error(errorBody.message || `Error ${response.status}: ${response.statusText}`);
  //   }

  //   return response.json();
  // },

  async getProductividadPersonaDiaActual(
    CodigoPersona: string,
    fechaInicio: string,
    fechaFin: string,
    HoraInicio: string,
    HoraFin: string,
    Departamento: string,
    Cargo: string
  ): Promise<BodyListResponse<any>> {
    const response = await fetch(API_URL + '/ProductividadDiasPersona', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        CodigoPersona: CodigoPersona,
        fechaInicio: fechaInicio,
        fechaFin: fechaFin,
        HoraInicio: HoraInicio,
        HoraFin: HoraFin,
        Departamento,
        Cargo,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido en el servidor' }));
      throw new Error(errorBody.message || `Error ${response.status}: ${response.statusText}`);
    }

    return normalizarProductividadPersonaDiaActual(await response.json());
  },


  async getProductividadSegmentoDiasPersona(CodigoPersona: string, fechaInicio: string, fechaFin: string, Departamento: string, Cargo: string): Promise<BodyListResponse<any>> {
    const response = await fetch(API_URL + '/ProductividadSegmentoDiasPersona', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ CodigosPersonas: CodigoPersona, fechaInicio: fechaInicio, fechaFin: fechaFin, Departamento: Departamento, Cargo: Cargo }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido en el servidor' }));
      throw new Error(errorBody.message || `Error ${response.status}: ${response.statusText}`);
    }

    return normalizarProductividadSegmentoDiasPersona(await response.json());
  },

  async getProductividadSegmentoFechasPersona(CodigoPersona: string, fechaInicio: string, fechaFin: string, Departamento: string, Cargo: string): Promise<BodyListResponse<any>> {
    const response = await fetch(API_URL + '/ProductividadFechasPersona', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ CodigosPersonas: CodigoPersona, fechaInicio: fechaInicio, fechaFin: fechaFin, Departamento: Departamento, Cargo: Cargo }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido en el servidor' }));
      throw new Error(errorBody.message || `Error ${response.status}: ${response.statusText}`);
    }

    return response.json();
  },

  async getFiltrosDepartamentos(): Promise<BodyListResponse<any>> {

    const response = await fetch(API_URL + '/getFiltrosPorArea', {
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



  ///////////////////////////////////////////////////////////////////////////
  //funcion para recuperar los tiempos justificados de los empleados

  async getTiemposJustificadosOperadores(CodigoPersona: string, fechaInicio: string, fechaFin: string): Promise<BodyListResponse<any>> {
    const response = await fetch(API_URL + '/tiemposJustificadosEnIntervaloFechas', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ CodigosPersonas: CodigoPersona, fechaInicio: fechaInicio, fechaFin: fechaFin }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido en el servidor' }));
      throw new Error(errorBody.message || `Error ${response.status}: ${response.statusText}`);
    }

    return response.json();
  },



  async getRegistrosProductividadPersonas(CodigoPersona: string, fechaInicio: string, fechaFin: string, Departamento: string, Cargo: string): Promise<BodyListResponse<any>> {
    const response = await fetch(API_URL + '/getRegistrosProductividad', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ CodigosPersonas: CodigoPersona, fechaInicio: fechaInicio, fechaFin: fechaFin, Departamento: Departamento, Cargo: Cargo }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido en el servidor' }));
      throw new Error(errorBody.message || `Error ${response.status}: ${response.statusText}`);
    }

    return response.json();
  },

};
