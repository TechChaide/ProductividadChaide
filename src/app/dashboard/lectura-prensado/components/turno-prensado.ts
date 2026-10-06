// Turnos de Prensado para el total de etiquetas leídas por estación:
//   Día:   07:00 a 19:00
//   Noche: 20:00 a 06:00 del día siguiente
// En los huecos se sigue mostrando el turno que acaba de terminar: de 19:00 a 20:00 el de
// Día y de 06:00 a 07:00 el de Noche (que empezó la noche anterior).

export interface TurnoPrensado {
  nombre: "Día" | "Noche";
  /** Rango para el API, en hora local: "YYYY-MM-DD HH:mm:ss.000". */
  fechaInicio: string;
  fechaFin: string;
  /** Rango legible, p. ej. "07:00 - 19:00". */
  rango: string;
  /** Identifica el turno concreto (fecha + nombre) para saber cuándo cambia. */
  clave: string;
}

// Los turnos y el rango que se envía al API van siempre en hora de Ecuador (GMT-5, sin horario
// de verano), sin importar la zona horaria configurada en la tablet.
const OFFSET_ECUADOR_MS = -5 * 60 * 60 * 1000;

const pad = (n: number) => String(n).padStart(2, "0");

/** `fecha` ya desplazada a hora de Ecuador: se leen sus componentes en UTC. */
function formatearFecha(fecha: Date, hora: number): string {
  return `${fecha.getUTCFullYear()}-${pad(fecha.getUTCMonth() + 1)}-${pad(fecha.getUTCDate())} ${pad(hora)}:00:00.000`;
}

function sumarDias(fecha: Date, dias: number): Date {
  const d = new Date(fecha);
  d.setUTCDate(d.getUTCDate() + dias);
  return d;
}

export function turnoPrensadoActual(instante: Date = new Date()): TurnoPrensado {
  const ahora = new Date(instante.getTime() + OFFSET_ECUADOR_MS);
  const hora = ahora.getUTCHours();
  if (hora >= 7 && hora < 20) {
    const fechaInicio = formatearFecha(ahora, 7);
    return {
      nombre: "Día",
      fechaInicio,
      fechaFin: formatearFecha(ahora, 19),
      rango: "07:00 - 19:00",
      clave: `D-${fechaInicio}`,
    };
  }
  // Antes de las 07:00 el turno de Noche empezó el día anterior.
  const inicio = hora >= 20 ? ahora : sumarDias(ahora, -1);
  const fechaInicio = formatearFecha(inicio, 20);
  return {
    nombre: "Noche",
    fechaInicio,
    fechaFin: formatearFecha(sumarDias(inicio, 1), 6),
    rango: "20:00 - 06:00",
    clave: `N-${fechaInicio}`,
  };
}
