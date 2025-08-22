export interface Order {
  id: string; // Unique identifier for the row, used for selection
  material: string; // Material code, e.g., "30002335"
  orden: string;
  fecha: string;
  descripcionMaterial: string;
  cantProgramada: number;
  cantNotificada: number;
  cantPendiente: number;
  acolchadora: string;
  resp_ctrl_prod: string;
  maquina: string; // Added field to store the station/machine from the order
}
