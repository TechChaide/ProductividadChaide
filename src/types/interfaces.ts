

// Este archivo es autogenerado. No lo modifiques manually.

export interface AreaProcessControl {
  codigo_rcp: number;
  resp_ctrl_prod: string;
  estado: string;
  maquina: string;
  direccion_ip: string;
}

export interface Estacion {
  codigo_estacion: number;
  nombre_estacion: string;
  estado: string;
  usuario_modificacion: string;
  fecha_modificacion: Date | string;
  codigo_linea: number;
  direccion_ip: string;
}

export interface Linea {
  codigo_linea: number;
  nombre_linea: string;
  estado: string;
  usuario_modificacion: string;
  fecha_modificacion: Date | string;
}

export interface Sesion {
  codigo_sesion: number;
  codigo_rcp: number;
  codigo_estacion: number;
  codigo_operador: string;
  fecha_evento: Date | string;
  tipo_evento: string;
  estado: string;
}

export interface Configuracion {
  codigo_equipo: number;
  mac_address: string;
  estado: string;
}

export interface LogOrdenes {
  codigo_log: number;
  orden_log: string;
  codigo_empleado: number;
  codigo_equipo: number;
  fecha_log: Date | string;
  cantidad_entregada: number;
  cantidad_rechazada: number;
  cantidad_reproceso: number;
  orden_reproceso: string;
}

export interface OrdenEmpleado {
  ID: number;
  NUM_ORDEN: string;
  CODIGO_EMP: string;
  UNIDADES_PROD: number;
  FECHA: string; // Changed to string to match formatted date
  HORA: string;
  TURNO: string;
  CENTRO: string;
  CODIGO: string;
  MAQUINA: string;
}

export interface OrdenEmpleadoDecimal {
  ID: number;
  NUM_ORDEN: string;
  CODIGO_EMP: string;
  UNIDADES_PROD: number;
  FECHA: string; // Changed to string to match formatted date
  HORA: string;
  TURNO: string;
  CENTRO: string;
  CODIGO: string;
  MAQUINA: string;
}

// Interfaces for Authentication
export interface Ficha {
  CODIGO: string;
  NOMBRE: string;
  DEPARTAMENTO: string;
  codigo_rcp: number;
  resp_ctrl_prod: string;
  estado: string;
  maquina: string;
  mac_address: string;
  Centro: string;
  direccion_ip: string; // Added from your spec
}

export interface User {
  name: string;
  code: string;
  imageUrl?: string;
  machine?: string;
  department?: string;
  resp_ctrl_prod?: string; 
  Centro?: string;
  ip_address?: string;
}


export interface AuthUser {
  id: string;
  ficha: Ficha;
}

export interface AuthResponse {
  message: string;
  token: string;
  expiresIn: string;
  user: AuthUser;
}

// Interface for Production Orders from servicio.service
export interface OrdenProduccion {
    Orden: string;
    Fecha: string;
    Material: string;
    Nombre: string;
    CantProgramada: number;
    CantNotificada: number;
    CantRechazo: number;
    Estacion: string;
    RespCtrlProd: string;
    Maquina: string;
}

// Interface for Admin Users from usuario.service
export interface Usuario {
    codigo_usuario: number;
    nombres_usuario: string;
    correo_usuario: string;
    estado: 'A' | 'I' | string;
}

