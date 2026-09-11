/**
 * Formatea una fecha JS a string compatible con SQL Server `datetime2`
 * usando la hora LOCAL del navegador (Ecuador UTC-5), sin convertir a UTC:
 *   YYYY-MM-DD HH:mm:ss.SSS
 *
 * No usar `toISOString()`: convierte a UTC y en Ecuador aparece con +5
 * horas al persistirse en `datetime2` (sin zona horaria).
 */
export function formatDateForSQLServer(date: Date = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  const ms = date.getMilliseconds().toString().padStart(3, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${ms}`;
}

/**
 * Auditoría de edición: `usuario_modificacion` = `codigo_empleado`
 * de la sesión. Solo debe enviarse en UPDATE, nunca en INSERT.
 */
export function auditFieldsOnEdit(codigoEmpleado: string, date: Date = new Date()) {
  const usuario = (codigoEmpleado ?? "").trim();
  return {
    fecha_modificacion: formatDateForSQLServer(date),
    usuario_modificacion: usuario,
  };
}
