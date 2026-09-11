/**
 * Tipos portados desde el proyecto `muestreos_frontend` (backend samplingBA /
 * seguridadesGuard) para el feature embebido "Paros / Captura".
 *
 * Este archivo es independiente de `@/types/interfaces.ts` (que es autogenerado
 * para el dominio de ProductividadChaide) — no lo mezcles con ese archivo.
 * `BodyResponse<T>` / `BodyListResponse<T>` sí se reutilizan desde
 * `@/types/body-response` y `@/types/body-list-response` porque son idénticos
 * en ambos proyectos.
 */

export interface Configuracion {
  codigo_configuracion: number;
  codigo_aplicacion: string;
  nombre_configuracion: string;
  valor_configuracion: string;
  descripcion_configuracion: string;
  estado: string;
  fecha_modificacion: Date | string;
  usuario_modificacion: string;
}

export interface Usuario {
  codigo_usuario: number;
  id_usuario: string;
  condicion: string;
  estado: string;
  usuario_modificacion: string;
  fecha_modificacion: Date | string;
  codigo_tipo_usuario: number;
}

export interface Auth {
  message: string;
  token: string;
  expiresIn: string;
  user: User;
  perfiles: any;
}

export interface User {
  codigo_usuario: number;
  usuario: string;
  correo_usuario: string;
  condicion: string;
  id_usuario: string;
  codigo_empleado: string;
}

export interface FichaSocialHistorica {
  CODIGO: string;
  NOMBRE: string;
  LOCALIDAD: string;
  CEDULA: string;
  MAIL: string;
  GRUPO_DEPARTAMENTO: string;
  DEPARTAMENTO: string;
  CARGO: string;
  CODIGO_JEFE: string;
}

export interface Area {
  codigo_area: number;
  nombre_area: string;
  nombre_ficha_social: string;
  usuario_calidad: string;
  regional: string;
  respCtrlProd: string;
  estado: string;
  fecha_modificacion: Date | string;
  usuario_modificacion: string;
}

export interface TipoMotivo {
  codigo_tipo_motivo: number;
  nombre_tipo_motivo: string;
  estado: string;
  fecha_modificacion: Date | string;
  usuario_modificacion: string;
}

export interface ElementoAsociacion {
  codigo_elemento_asociacion: number;
  columna: string;
  descripcion: string;
  data_type: string;
  estado: string;
  fecha_modificacion: Date | string;
  usuario_modificacion: string;
}

export interface AreaTipoMotivo {
  codigo_area_tipo_motivo: number;
  codigo_area: number;
  codigo_tipo_motivo: number;
  correo_notificacion: string;
  tipo_fuente: string;
  valor: string;
  caso: string;
  estado: string;
  fecha_modificacion?: Date | string;
  usuario_modificacion?: string;
}

export interface Origen {
  codigo_origen: number;
  codigo_area_tipo_motivo: number;
  nombre_origen: string;
  estado: string;
  fecha_modificacion?: Date | string;
  usuario_modificacion?: string;
}

export interface Componente {
  codigo_componente: number;
  nombre_componente: string;
  unidades: string;
  RespCtrlProd: string;
  /**
   * Solo aplica al componente elegido en el wizard de Paros (paro de
   * máquina): si exige `PASSCODE_PAROS` para iniciar el cronómetro.
   * Ausente/irrelevante para componentes de Captura o Muestreos.
   */
  requiere_passcode?: boolean;
  estado: string;
  fecha_modificacion: Date | string;
  usuario_modificacion: string;
}

export interface Asociacion {
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
  fecha_modificacion: Date | string;
  usuario_modificacion: string;
}

export interface TipoMedicion {
  codigo_tipo_medicion: number;
  nombre_tipo_medicion: string;
  estado: string;
  fecha_modificacion?: Date | string;
  usuario_modificacion?: string;
}

export interface CausaDefecto {
  codigo_causa_defecto: number;
  codigo_origen_componente: number;
  nombre_causa_defecto: string;
  estado: string;
  fecha_modificacion?: Date | string;
  usuario_modificacion?: string;
}

export interface Registro {
  codigo_registro: number;
  /** @deprecated Las causas viven en `registro_causa_defecto`. */
  codigo_causa_defecto?: number;
  fecha_registro: Date | string;
  anio: number;
  mes: number;
  dia: number;
  hora: number;
  regional: string;
  departamento: string;
  motivo: string;
  origen: string;
  componente: string;
  causa_defecto: string;
  cantidad: string;
  unidades: string;
  maquina: string;
  material: string;
  comodin: string;
  pedido?: string;
  /** @deprecated Usar `material`. */
  codigo_ticket?: string;
  codigo_empleado: string;
  tiempo: number;
  estado: string;
  fecha_creacion: Date | string;
  usuario_creacion: string;
  fecha_modificacion?: Date | string | null;
  usuario_modificacion?: string | null;
}

/** Puente M:N registro <-> causa_defecto. */
export interface RegistroCausaDefecto {
  codigo_registro_causa_defecto: number;
  codigo_registro: number;
  codigo_causa_defecto: number;
  estado: string;
  fecha_modificacion?: Date | string | null;
  usuario_modificacion?: string | null;
}

export interface Detalle {
  codigo_detalle: number;
  codigo_registro: number;
  codigo_asociacion: number;
  muestra: number;
  valor: string;
  estado: string;
  fecha_modificacion: Date | string;
  usuario_modificacion: string;
}

export interface OrigenComponente {
  codigo_origen_componente: number;
  codigo_origen: number;
  codigo_componente: number;
  estado: string;
  fecha_modificacion?: Date | string;
  usuario_modificacion?: string;
}

export interface Subcomponentes {
  codigo_subcomponente: number;
  codigo_elemento_asociacion: number;
  descripcion: string;
  puesto_trabajo: string;
  codigo_operador: string;
  estado: string;
  fecha_modificacion: Date | string;
  usuario_modificacion: string;
}

/**
 * Fila devuelta por `getParamsTablaCatalogo`: combina Área x Motivo x Origen x
 * Componente x Causa de defecto para que el wizard encadene los pasos sin
 * llamar a N servicios por separado.
 */
export interface MuestreoTablaVirtual {
  codigo_area: number;
  codigo_area_tipo_motivo: number;
  codigo_tipo_motivo: number;
  codigo_origen: number;
  codigo_origen_componente: number;
  codigo_componente: number;
  codigo_causa_defecto: number;
  nombre_area: string;
  nombre_ficha_social: string;
  nombre_tipo_motivo: string;
  nombre_origen: string;
  nombre_componente: string;
  nombre_causa_defecto: string;
}

export interface OrdenesTrabajadas {
  NUM_ORDEN: string;
  Material: string;
  Descripcion: string;
  CODIGO_EMP: string;
  MAQUINA: string;
  FECHA_HORA_UNIFICADA: string;
}

export interface InformacionExterna {
  codigo_informacion_externa: number;
  codigo_usuario: number;
  identificador: string;
  nombres: string;
  passcode: string;
  estado: string;
  fecha_creacion: Date | string;
  usuario_creacion: string;
  fecha_modificacion: Date | string;
  usuario_modificacion: string;
}

/** Solo referenciado por tipos de `serviciosMuestreosService` (paros de máquina, fuera de alcance funcional aquí). */
export interface Maquina {
  id_maq: number;
  maquina: string;
  componente: string;
  actividad: string;
  regional: string;
  departamento?: string;
}

export interface MaquinasMantenimiento {
  id_maq: number;
  maquina: string;
  componente: string;
  actividad: string;
  regional: string;
  departamento?: string;
}
