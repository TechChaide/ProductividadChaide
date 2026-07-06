"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { servicioService } from "@/services/servicioDashboard.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useIsMobile } from "@/hooks/use-mobile";
import { Badge } from "@/components/ui/badge";
import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, ArrowDownRight, ArrowUpRight, BarChart3, Building2, CalendarIcon, CheckCircle2, ChevronLeft, ChevronRight, Search, Users, X, Check, Package, TrendingUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { configuracionService } from "@/services/configuracion.service";

type DepartamentoDisponible = {
  id: string;
  nombre: string;
  centro?: string;
};

type OperadorDisponible = {
  codigo: string;
  nombre: string;
  departamento: string;
};

type RangoBusqueda = "3_meses" | "1_mes" | "semana_actual" | "por_mes" | "personalizado";

type RegistroProductividad = {
  CodEmpleado: string;
  Año: number;
  Mes: number;
  Día: number;
  TiempoSTD: number;
  TiempoTotalDia: number;
  HORA: string; // "HH:MM"
  UNIDADES_PROD: number;
  PuestoTrabajoReal?: string;
  CargoEmpleado?: string;
  NombreMaterial?: string;
};

type TiempoJustificado = {
  CodEmpleado: string;
  Año: number;
  Mes: number;
  Día: number;
  HorasDescontar: number;
};

type JornadaDia = {
  codEmpleado: string;
  nombreEmpleado: string;
  cargoEmpleado?: string;
  año: number;
  mes: number;
  dia: number;
  jornada: number;
  fechaHoraInicio: string;
  fechaHoraFin: string;
  horaInicio: string;
  horaFin: string;
  horasNetas: number;
  horasDescontar: number;
  totalCantidad?: number;
  totalDefectos?: number;
  totalTiempoSTD?: number;
};

type ResumenOperador = {
  codEmpleado: string;
  nombre: string;
  cargo: string;
  totalHorasNetas: number;
  totalA: number;
  totalHorasSTD: number;
  totalHorasDescontar: number;
  totalUnidades: number;
  totalDefectos: number;
  productividad: number;
  calidad: number;
  ego: number;
};

function egoGradientColor(ego: number, minEgo: number, maxEgo: number) {
  if (maxEgo === minEgo) return "hsl(120, 75%, 45%)";
  const ratio = Math.max(0, Math.min(1, (ego - minEgo) / (maxEgo - minEgo)));
  const hue = 0 + 120 * ratio;
  return `hsl(${hue}, 75%, 45%)`;
}

type OperadorResumen = {
  codEmpleado: string;
  operadorNombre: string;
  totalJornadas: number;
  totalUnidades: number;
  totalHorasNetas: number;
  totalHorasSTD: number;
  totalHorasDescontar: number;
  horasTeoricasEB: number;
  productividad: number;
  totalDefectos: number;
  calidad: number;
  ego: number;
  jornadas: JornadaDia[];
};

type ProductividadItem = {
  CodEmpleado: string;
  Año: number;
  Mes: number;
  Día: number;
  TotalCantidad: number;
  TotalDefectos: number;
  TotalTiempoSTD: number;
};

function normalizarOperadorResumen(
  codEmpleado: string,
  jornadas: JornadaDia[],
  datosProductividad: ProductividadItem[] | Map<string, ProductividadItem[]> = []
): OperadorResumen {
  let prodData: ProductividadItem[] | undefined;
  if (datosProductividad instanceof Map) {
    prodData = datosProductividad.get(String(codEmpleado));
  } else if (Array.isArray(datosProductividad)) {
    prodData = datosProductividad.filter((d) => String(d.CodEmpleado) === String(codEmpleado));
  }
  const operadorNombre = jornadas[0]?.nombreEmpleado ?? `Op. ${codEmpleado}`;
  const totalJornadas = jornadas.length;

  // Fuente de la verdad para STD, unidades y defectos: el endpoint ProductividadFechasPersona (SP)
  // Si no llega, fallback a lo que ya tengamos en las jornadas enriquecidas
  let totalHorasSTD: number;
  let totalUnidades: number;
  let totalDefectos: number;
  if (prodData && prodData.length > 0) {
    totalHorasSTD = prodData.reduce((s, d) => s + (Number(d.TotalTiempoSTD) || 0), 0);
    totalUnidades = prodData.reduce((s, d) => s + (Number(d.TotalCantidad) || 0), 0);
    totalDefectos = prodData.reduce((s, d) => s + (Number(d.TotalDefectos) || 0), 0);
  } else {
    totalHorasSTD = jornadas.reduce((sum, j) => sum + (j.totalTiempoSTD ?? 0), 0);
    totalUnidades = jornadas.reduce((sum, j) => sum + (j.totalCantidad ?? 0), 0);
    totalDefectos = jornadas.reduce((sum, j) => sum + (j.totalDefectos ?? 0), 0);
  }

  const totalHorasNetas = jornadas.reduce((sum, j) => sum + j.horasNetas, 0);
  const totalA = jornadas.reduce((sum, j) => sum + j.horasNetas * 0.13, 0);
  const totalHorasDescontar = jornadas.reduce((sum, j) => sum + (j.horasDescontar || 0), 0);
  const horasTeoricasEB = totalHorasNetas - totalA - totalHorasDescontar;
  const productividad = horasTeoricasEB > 0 ? (totalHorasSTD / horasTeoricasEB) * 100 : 0;
  const calidad = totalUnidades > 0 ? (1 - totalDefectos / totalUnidades) * 100 : 0;
  const ego = productividad * calidad / 100;
  return {
    codEmpleado,
    operadorNombre,
    totalJornadas,
    totalUnidades,
    totalHorasNetas,
    totalHorasSTD,
    totalHorasDescontar,
    horasTeoricasEB,
    productividad,
    totalDefectos,
    calidad,
    ego,
    jornadas,
  };
}

function OperadoresList({ operadores }: { operadores: OperadorResumen[] }) {
  const [busqueda, setBusqueda] = useState("");

  const termino = busqueda.trim().toLowerCase();
  const filtrados = termino
    ? operadores.filter((op) => {
        const nombreCompleto = op.operadorNombre.toLowerCase();
        const codigo = op.codEmpleado.toLowerCase();
        return nombreCompleto.includes(termino) || codigo.includes(termino);
      })
    : operadores;

  if (operadores.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar operador por nombre o código..."
          className="h-9 border-border/70 bg-white pl-9 pr-9"
        />
        {busqueda && (
          <button
            type="button"
            onClick={() => setBusqueda("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Limpiar búsqueda"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {filtrados.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border/70 bg-white px-3 py-4 text-center text-sm text-muted-foreground">
          No hay operadores que coincidan con &quot;{busqueda}&quot;.
        </p>
      ) : (
        <>
          <div className="text-[11px] text-muted-foreground">
            Mostrando {filtrados.length} de {operadores.length} operador(es)
          </div>
          {filtrados.map((op) => (
            <Card key={`op-${op.codEmpleado}`} className="rounded-xl border border-border bg-white p-4 shadow-sm">
              <Accordion type="single" collapsible>
                <AccordionItem value={`operator-${op.codEmpleado}`}>
                  <AccordionTrigger>
                    <div className="flex items-center justify-between w-full pr-4">
                      <div>
                        <p className="font-semibold text-foreground">{op.operadorNombre}</p>
                        <p className="text-[11px] text-muted-foreground">Código: {op.codEmpleado}</p>
                      </div>
                      <div className="flex flex-wrap gap-4 text-right">
                        <div>
                          <p className="text-[10px] text-muted-foreground">Jornadas</p>
                          <p className="font-semibold text-foreground">{op.totalJornadas}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">EGO</p>
                          <p className="font-semibold text-foreground">{op.ego.toFixed(2)}%</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">Hrs Netas</p>
                          <p className="font-semibold text-foreground">{op.totalHorasNetas.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">Unidades</p>
                          <p className="font-semibold text-foreground">{op.totalUnidades}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">Defectos</p>
                          <p
                            className={`font-semibold ${
                              op.totalDefectos > 0 ? "text-red-700" : "text-foreground"
                            }`}
                          >
                            {op.totalDefectos}
                          </p>
                        </div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="overflow-x-auto p-2">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border bg-muted/40 text-left">
                            <th className="px-2 py-1 font-semibold text-muted-foreground">Fecha</th>
                            <th className="px-2 py-1 font-semibold text-muted-foreground text-center">Jornada</th>
                            <th className="px-2 py-1 font-semibold text-muted-foreground">Inicio</th>
                            <th className="px-2 py-1 font-semibold text-muted-foreground">Fin</th>
                            <th className="px-2 py-1 font-semibold text-muted-foreground text-right">Hrs Netas</th>
                            <th className="px-2 py-1 font-semibold text-muted-foreground text-right">Σ TiempoSTD</th>
                            <th className="px-2 py-1 font-semibold text-muted-foreground text-right">Unidades</th>
                          </tr>
                        </thead>
                        <tbody>
                          {op.jornadas.map((j, idx) => (
                            <tr key={`${op.codEmpleado}-${idx}`} className={idx % 2 === 0 ? "bg-white" : "bg-muted/20"}>
                              <td className="px-2 py-1 text-muted-foreground whitespace-nowrap">{j.dia.toString().padStart(2, "0")}/{j.mes.toString().padStart(2, "0")}/{j.año}</td>
                              <td className="px-2 py-1 text-center">
                                <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${j.jornada === 1 ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                                  J{j.jornada}
                                </span>
                              </td>
                              <td className="px-2 py-1 font-mono text-muted-foreground">{j.horaInicio}</td>
                              <td className="px-2 py-1 font-mono text-muted-foreground">{j.horaFin}</td>
                              <td className="px-2 py-1 text-right font-mono">{j.horasNetas.toFixed(2)}</td>
                              <td className="px-2 py-1 text-right font-mono">{(j.totalTiempoSTD ?? 0).toFixed(3)}</td>
                              <td className="px-2 py-1 text-right font-mono">{j.totalCantidad ?? 0}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <Card className="mt-3 overflow-hidden rounded-xl border border-border bg-white p-3 shadow-sm">
                      <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          <div className="rounded-xl border border-border/80 bg-muted/50 p-2">
                            <p className="text-[10px] uppercase text-muted-foreground">B) Horas STD</p>
                            <p className="mt-1 text-base font-semibold text-foreground">{op.totalHorasSTD.toFixed(2)}</p>
                          </div>
                          <div className="rounded-xl border border-border/80 bg-muted/50 p-2">
                            <p className="text-[10px] uppercase text-muted-foreground">C) Horas Teóricas Efectivas</p>
                            <p className="mt-1 text-base font-semibold text-foreground">{op.horasTeoricasEB.toFixed(2)}</p>
                            <p className="mt-0.5 text-[9px] text-muted-foreground/70">
                              {op.totalHorasNetas.toFixed(2)} - {(op.totalHorasNetas * 0.13).toFixed(2)} - {op.totalHorasDescontar.toFixed(2)}
                            </p>
                          </div>
                          <div className="rounded-xl border border-border/80 bg-muted/50 p-2">
                            <p className="text-[10px] uppercase text-muted-foreground">D) Productividad</p>
                            <p className="mt-1 text-base font-semibold text-foreground">{op.productividad.toFixed(2)}%</p>
                          </div>
                          <div className="rounded-xl border border-border/80 bg-muted/50 p-2">
                            <p className="text-[10px] uppercase text-muted-foreground">E) Calidad</p>
                            <p className="mt-1 text-base font-semibold text-foreground">{op.calidad.toFixed(2)}%</p>
                          </div>
                          <div
                            className={`rounded-xl border p-2 ${
                              op.totalDefectos > 0
                                ? "border-red-200 bg-red-50"
                                : "border-emerald-200 bg-emerald-50"
                            }`}
                          >
                            <p className="text-[10px] uppercase text-muted-foreground">F) Defectos</p>
                            <p
                              className={`mt-1 text-base font-semibold ${
                                op.totalDefectos > 0 ? "text-red-700" : "text-emerald-700"
                              }`}
                            >
                              {op.totalDefectos.toLocaleString()}
                            </p>
                          </div>
                          <div className="rounded-xl border border-border/80 bg-muted/50 p-2">
                            <p className="text-[10px] uppercase text-muted-foreground">Unidades Totales</p>
                            <p className="mt-1 text-base font-semibold text-foreground">{op.totalUnidades.toLocaleString()}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-end">
                          <svg width="140" height="80" viewBox="0 0 140 80" className="overflow-visible">
                            <defs>
                              <linearGradient id={`gaugeGradient-${op.codEmpleado}`} x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#EF4444" />
                                <stop offset="50%" stopColor="#EAB308" />
                                <stop offset="100%" stopColor="#22C55E" />
                              </linearGradient>
                            </defs>
                            <path d="M 15 70 A 55 55 0 0 1 125 70" fill="none" stroke={`url(#gaugeGradient-${op.codEmpleado})`} strokeWidth="10" strokeLinecap="round" />
                            <path d="M 20 70 A 50 50 0 0 1 120 70" fill="none" stroke="#e5e5e5" strokeWidth="2" strokeLinecap="round" />
                            {[0, 25, 50, 75, 100].map((mark) => {
                              const angle = (mark / 100) * 180;
                              const rad = (angle - 180) * (Math.PI / 180);
                              const x1 = 70 + 42 * Math.cos(rad);
                              const y1 = 70 + 42 * Math.sin(rad);
                              const x2 = 70 + 50 * Math.cos(rad);
                              const y2 = 70 + 50 * Math.sin(rad);
                              return <line key={mark} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#666" strokeWidth="1.5" />;
                            })}
                            {(() => {
                              const angle = (Math.min(100, Math.max(0, op.ego)) / 100) * 180;
                              const rad = (angle - 180) * (Math.PI / 180);
                              const needleX = 70 + 38 * Math.cos(rad);
                              const needleY = 70 + 38 * Math.sin(rad);
                              return <line key="needle" x1="70" y1="70" x2={needleX} y2={needleY} stroke="#1f2937" strokeWidth="3" strokeLinecap="round" />;
                            })()}
                            <circle cx="70" cy="70" r="4" fill="#1f2937" />
                            <text x="70" y="58" textAnchor="middle" className="text-[10px] fill-gray-500">EGO</text>
                            <text x="70" y="48" textAnchor="middle" className="text-sm font-bold fill-gray-900">{op.ego.toFixed(0)}%</text>
                          </svg>
                        </div>
                      </div>
                    </Card>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}

const CENTRO_KEY_PRIORIDAD = [
  "centro",
  "Centro",
  "CENTRO",
  "code_centro",
  "codigoCentro",
  "CodigoCentro",
];

const NOMBRE_KEY_PRIORIDAD = [
  "nombre_departamento",
  "departamento",
  "nombre",
  "name",
  "descripcion",
  "NombreDepartamento",
  "Nombre",
  "DEPARTAMENTO",
  "NOMBRE_DEPARTAMENTO",
];

const ID_KEY_PRIORIDAD = [
  "codigo_departamento",
  "id",
  "codigo",
  "CodigoDepartamento",
  "code",
];

function extraerTextoValido(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const limpio = valor.trim();
  return limpio.length > 0 ? limpio : null;
}

function normalizarDepartamento(item: any): DepartamentoDisponible {
  if (typeof item === "string" || typeof item === "number") {
    const texto = String(item).trim();
    return { id: texto, nombre: texto };
  }

  const source = item && typeof item === "object" ? item : {};

  let nombre: string | null = null;

  for (const key of NOMBRE_KEY_PRIORIDAD) {
    nombre = extraerTextoValido(source[key]);
    if (nombre) break;
  }

  if (!nombre) {
    for (const [key, valor] of Object.entries(source)) {
      const esLlaveCandidata =
        /depart|nombre|name|desc/i.test(key) &&
        !/estado|usuario|fecha|rel|activo/i.test(key);

      if (!esLlaveCandidata) continue;

      nombre = extraerTextoValido(valor);
      if (nombre) break;
    }
  }

  if (!nombre) {
    for (const valor of Object.values(source)) {
      nombre = extraerTextoValido(valor);
      if (nombre) break;
    }
  }

  const nombreFinal = nombre ?? "Sin nombre";

  let id: string | null = null;

  for (const key of ID_KEY_PRIORIDAD) {
    const valor = source[key];
    if (typeof valor === "string" || typeof valor === "number") {
      id = String(valor);
      break;
    }
  }

  if (!id) id = nombreFinal;

  return { id: String(id), nombre: nombreFinal };
}

function inicialesDepartamento(nombre: string): string {
  return nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((fragmento) => fragmento[0]?.toUpperCase() ?? "")
    .join("");
}

function normalizarOperador(item: any): OperadorDisponible {
  const source = item && typeof item === "object" ? item : {};

  const nombre =
    extraerTextoValido(source.NOMBRE) ??
    extraerTextoValido(source.nombre) ??
    extraerTextoValido(source.Nombre) ??
    "Sin nombre";

  const codigo =
    extraerTextoValido(source.CODIGO) ??
    extraerTextoValido(source.codigo) ??
    extraerTextoValido(source.Codigo) ??
    "-";

  const departamento =
    extraerTextoValido(source.DEPARTAMENTO) ??
    extraerTextoValido(source.departamento) ??
    extraerTextoValido(source.NombreDepartamento) ??
    "";

  return {
    codigo,
    nombre,
    departamento,
  };
}

function inicioSemanaActual(baseDate: Date): Date {
  const inicio = new Date(baseDate);
  const diaSemana = inicio.getDay();
  const ajuste = diaSemana === 0 ? -6 : 1 - diaSemana;
  inicio.setDate(inicio.getDate() + ajuste);
  inicio.setHours(0, 0, 0, 0);
  return inicio;
}

function finSemanaActual(baseDate: Date): Date {
  const fin = inicioSemanaActual(baseDate);
  fin.setDate(fin.getDate() + 6);
  fin.setHours(23, 59, 59, 999);
  return fin;
}

function restarMeses(baseDate: Date, meses: number): Date {
  const fecha = new Date(baseDate);
  fecha.setMonth(fecha.getMonth() - meses);
  fecha.setHours(0, 0, 0, 0);
  return fecha;
}

function formatearFecha(date: Date): string {
  return new Intl.DateTimeFormat("es-EC", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatearFechaISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function calcularRango(rango: RangoBusqueda, baseDate: Date): { desde: Date; hasta: Date } {
  const hoy = new Date(baseDate);
  hoy.setHours(23, 59, 59, 999);

  if (rango === "3_meses") {
    return { desde: restarMeses(baseDate, 3), hasta: hoy };
  }

  if (rango === "1_mes") {
    return { desde: restarMeses(baseDate, 1), hasta: hoy };
  }

  return {
    desde: inicioSemanaActual(baseDate),
    hasta: finSemanaActual(baseDate),
  };
}

function calcularRangoMes(año: number, mes: number): { desde: Date; hasta: Date } {
  const primerDia = new Date(año, mes, 1);
  primerDia.setHours(0, 0, 0, 0);
  const ultimoDia = new Date(año, mes + 1, 0);
  ultimoDia.setHours(23, 59, 59, 999);
  return { desde: primerDia, hasta: ultimoDia };
}

function generarMesesDisponibles(): Array<{ value: string; label: string; año: number; mes: number }> {
  const meses = [];
  const hoy = new Date();
  const nombresMeses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  
  for (let i = 0; i < 12; i++) {
    const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    const año = fecha.getFullYear();
    const mes = fecha.getMonth();
    meses.push({
      value: `${año}-${mes}`,
      label: `${nombresMeses[mes]} ${año}`,
      año,
      mes
    });
  }
  
  return meses;
}

function horaAMinutos(hora: string): number {
  const [h, m] = (hora ?? "").split(":").map(Number);
  if (!Number.isFinite(h)) return -1;
  return h * 60 + (m || 0);
}

function minutosAHora(minutos: number): string {
  // Si cruza medianoche (> 24h), ajustar al día siguiente
  const minutosAjustado = minutos % 1440; // 1440 = 24 * 60
  const h = Math.floor(minutosAjustado / 60).toString().padStart(2, "0");
  const m = (minutosAjustado % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function minutosAHoraFin(minutos: number): string {
  // Si cruza medianoche (> 24h), ajustar al día siguiente
  const minutosAjustado = minutos % 1440; // 1440 = 24 * 60
  const h = Math.ceil(minutosAjustado / 60).toString().padStart(2, "0");
  const m = (minutosAjustado % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function parseHora(hora: string | undefined | null) {
  const texto = String(hora ?? "00:00").trim();
  const match = texto.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return { horas: 0, minutos: 0 };
  const horas = Number(match[1]);
  const minutos = Number(match[2]);
  if (!Number.isFinite(horas) || !Number.isFinite(minutos)) return { horas: 0, minutos: 0 };
  if (horas < 0 || horas > 23 || minutos < 0 || minutos > 59) return { horas: 0, minutos: 0 };
  return { horas, minutos };
}

function formatearFechaHora(timestamp: number): string {
  const fecha = new Date(timestamp);
  const dia = fecha.getDate().toString().padStart(2, "0");
  const mes = (fecha.getMonth() + 1).toString().padStart(2, "0");
  const año = fecha.getFullYear();
  const hora = fecha.getHours().toString().padStart(2, "0");
  const minuto = fecha.getMinutes().toString().padStart(2, "0");
  return `${dia}/${mes}/${año} ${hora}:${minuto}`;
}

function calcularJornadasPorDia(
  registros: RegistroProductividad[],
  nombrePorCodigo: Map<string, string>,
  cargoPorCodigo: Map<string, string>
): JornadaDia[] {
  const GAP_MINUTOS = 360; // 6 horas

  // PASO 1: Obtener DISTINTOS por (CodEmpleado, Año, Mes, Día, HORA)
  const distintosKey = new Set<string>();
  const notifDistintas: Array<RegistroProductividad & { _ts: number }> = [];

  for (const r of registros) {
    const día = Number((r as any).Día ?? (r as any).Dia ?? 0);
    const díaSeguro = Number.isFinite(día) && día > 0 && día <= 31 ? día : 1;
    const key = `${r.CodEmpleado}__${r.Año}__${r.Mes}__${díaSeguro}__${r.HORA}`;
    
    if (!distintosKey.has(key)) {
      distintosKey.add(key);
      
      // Crear timestamp global: Fecha + Hora
      const { horas, minutos } = parseHora(r.HORA);
      const fecha = new Date(Number(r.Año) || 1970, Number(r.Mes) - 1 || 0, díaSeguro);
      fecha.setHours(horas, minutos, 0, 0);
      const ts = fecha.getTime();
      
      notifDistintas.push({
        ...r,
        _ts: Number.isFinite(ts) ? ts : 0,
      });
    }
  }

  // PASO 2: Agrupar por empleado y ordenar por TS
  const porEmpleado = new Map<string, typeof notifDistintas>();
  for (const notif of notifDistintas) {
    if (!porEmpleado.has(notif.CodEmpleado)) {
      porEmpleado.set(notif.CodEmpleado, []);
    }
    porEmpleado.get(notif.CodEmpleado)!.push(notif);
  }

  // Ordenar cada empleado por TS
  for (const notifs of porEmpleado.values()) {
    notifs.sort((a, b) => a._ts - b._ts);
  }

  // PASO 3: Calcular gaps y asignar JornadaId TEMPORAL
  type NotifConJornada = typeof notifDistintas[0] & {
    gapMin: number | null;
    jornadaIdTemporal: number;
    fechaJornada: { año: number; mes: number; día: number };
  };

  const notifConJornada: NotifConJornada[] = [];

  for (const [codEmpleado, notifs] of porEmpleado.entries()) {
    let jornadaIdTemporal = 1;

    for (let i = 0; i < notifs.length; i++) {
      const notif = notifs[i];
      let gapMin: number | null = null;

      // Calcular gap con el anterior
      if (i > 0) {
        const prev = notifs[i - 1]._ts;
        const curr = notif._ts;
        gapMin = (curr - prev) / (1000 * 60);
      }

      // Si gap NULL o gap > 360 minutos = nueva jornada
      if (gapMin === null || gapMin > GAP_MINUTOS) {
        if (i > 0) jornadaIdTemporal++;
      }

      // Asignar jornada temporal (sin fechaJornada aún)
      notifConJornada.push({
        ...notif,
        gapMin,
        jornadaIdTemporal,
        fechaJornada: { año: 0, mes: 0, día: 0 }, // Placeholder, se calcula en PASO 4
      });
    }
  }

  // PASO 4: Normalizar fechaJornada para cada jornada temporal
  // Para jornadas que cruzan medianoche, usar el TS más bajo (fecha de INICIO)
  const minTsPorJornada = new Map<string, number>();
  for (const notif of notifConJornada) {
    const key = `${notif.CodEmpleado}__${notif.jornadaIdTemporal}`;
    const tsActual = minTsPorJornada.get(key) ?? Infinity;
    minTsPorJornada.set(key, Math.min(tsActual, notif._ts));
  }

  // Actualizar fechaJornada en todos los notif con la fecha del TS más bajo
  for (const notif of notifConJornada) {
    const key = `${notif.CodEmpleado}__${notif.jornadaIdTemporal}`;
    const minTs = minTsPorJornada.get(key)!;
    const fechaTS = new Date(minTs);
    notif.fechaJornada = {
      año: fechaTS.getFullYear(),
      mes: fechaTS.getMonth() + 1,
      día: fechaTS.getDate(),
    };
  }

  // PASO 5: Re-numerar jornadas por (CodEmpleado + FechaJornada) para que solo haya J1, J2
  // Para cada jornada temporal, asignamos un número correlativo dentro de su fechaJornada
  const jornadaPorEmpleadoFecha = new Map<string, number>();
  const jornadaIdFinalPorTemporal = new Map<string, number>();

  // Recorremos en orden de aparición (ya están agrupados por empleado y ordenados por TS)
  for (const notif of notifConJornada) {
    const keyTemporal = `${notif.CodEmpleado}__${notif.jornadaIdTemporal}`;

    if (!jornadaIdFinalPorTemporal.has(keyTemporal)) {
      const keyFecha = `${notif.CodEmpleado}__${notif.fechaJornada.año}__${notif.fechaJornada.mes}__${notif.fechaJornada.día}`;
      const siguienteNum = (jornadaPorEmpleadoFecha.get(keyFecha) ?? 0) + 1;
      jornadaPorEmpleadoFecha.set(keyFecha, siguienteNum);
      jornadaIdFinalPorTemporal.set(keyTemporal, siguienteNum);
    }
  }

  // PASO 6: Para cada empleado + jornadaIdTemporal, obtener FechaJornada (ya normalizada)
  const fechaJornadaPorEmpleadoJornada = new Map<
    string,
    { año: number; mes: number; día: number }
  >();

  for (const notif of notifConJornada) {
    const key = `${notif.CodEmpleado}__${notif.jornadaIdTemporal}`;
    if (!fechaJornadaPorEmpleadoJornada.has(key)) {
      fechaJornadaPorEmpleadoJornada.set(key, notif.fechaJornada);
    }
  }

  // PASO 7: Agrupar registros ORIGINALES con JornadaId FINAL
  const registrosConJornada = registros.map((r) => {
    const día = (r as any).Día ?? (r as any).Dia;
    const [h, m] = (r.HORA ?? "00:00").split(":").map(Number);
    const fecha = new Date(r.Año, r.Mes - 1, día);
    fecha.setHours(h, m, 0, 0);
    const ts = fecha.getTime();

    // Buscar en notifConJornada el jornadaIdTemporal correspondiente
    const notif = notifConJornada.find(
      (n) =>
        n.CodEmpleado === r.CodEmpleado &&
        n.Año === r.Año &&
        n.Mes === r.Mes &&
        ((n as any).Día ?? (n as any).Dia) === día &&
        n.HORA === r.HORA
    );

    const jornadaIdTemporal = notif?.jornadaIdTemporal ?? 1;
    const jornadaIdFinal = jornadaIdFinalPorTemporal.get(
      `${r.CodEmpleado}__${jornadaIdTemporal}`
    ) ?? 1;
    const fechaJornada =
      fechaJornadaPorEmpleadoJornada.get(
        `${r.CodEmpleado}__${jornadaIdTemporal}`
      ) || {
        año: r.Año,
        mes: r.Mes,
        día,
      };

    return { ...r, _ts: ts, _jornadaId: jornadaIdFinal, _fechaJornada: fechaJornada };
  });

  // PASO 8: Agrupar registros por (CodEmpleado, FechaJornada, JornadaId FINAL)
  const gruposJornada = new Map<
    string,
    typeof registrosConJornada
  >();

  for (const r of registrosConJornada) {
    const key = `${r.CodEmpleado}__${r._fechaJornada.año}__${r._fechaJornada.mes}__${r._fechaJornada.día}__${r._jornadaId}`;
    if (!gruposJornada.has(key)) {
      gruposJornada.set(key, []);
    }
    gruposJornada.get(key)!.push(r);
  }

  // PASO 9: Calcular jornadas con horas netas (floor/ceil)
  const resultado: JornadaDia[] = [];

  for (const [key, regs] of gruposJornada.entries()) {
    const parts = key.split("__");
    const codEmpleado = parts[0];
    const año = Number(parts[1]);
    const mes = Number(parts[2]);
    const día = Number(parts[3]);
    const jornadaId = Number(parts[4]);

    const nombreEmpleado = nombrePorCodigo.get(codEmpleado) ?? `Op. ${codEmpleado}`;
    const fechaJornada = regs[0]._fechaJornada;

    // Ordenar registros por timestamp para encontrar primero y último
    const regsOrdenados = [...regs].sort((a, b) => a._ts - b._ts);
    const tsInicio = regsOrdenados[0]._ts;
    const tsFin = regsOrdenados[regsOrdenados.length - 1]._ts;

    // Calcular horas netas usando floor/ceil sobre timestamps reales
    const fechaInicioObj = new Date(tsInicio);
    const fechaFinObj = new Date(tsFin);
    const minutosInicioDelDia = fechaInicioObj.getHours() * 60 + fechaInicioObj.getMinutes();
    const minutosFinDelDia = fechaFinObj.getHours() * 60 + fechaFinObj.getMinutes();

    const horaInicioMinutos = Math.floor(minutosInicioDelDia / 60) * 60;
    const horaFinMinutos = Math.ceil(minutosFinDelDia / 60) * 60;
    let horasNetas: number;
    if (minutosFinDelDia < minutosInicioDelDia) {
      horasNetas = ((24 * 60 - horaInicioMinutos) + horaFinMinutos) / 60;
    } else {
      horasNetas = (horaFinMinutos - horaInicioMinutos) / 60;
    }

    resultado.push({
      codEmpleado,
      nombreEmpleado,
      cargoEmpleado: cargoPorCodigo.get(codEmpleado),
      año: fechaJornada.año,
      mes: fechaJornada.mes,
      dia: fechaJornada.día,
      jornada: jornadaId,
      fechaHoraInicio: formatearFechaHora(tsInicio),
      fechaHoraFin: formatearFechaHora(tsFin),
      horaInicio: minutosAHora(horaInicioMinutos),
      horaFin: minutosAHoraFin(horaFinMinutos),
      horasNetas: Math.round(horasNetas * 100) / 100,
      horasDescontar: 0,
    });
  }

  // PASO 10: Ordenar resultado
  resultado.sort((a, b) => {
    if (a.codEmpleado !== b.codEmpleado)
      return a.codEmpleado.localeCompare(b.codEmpleado);
    if (a.año !== b.año) return a.año - b.año;
    if (a.mes !== b.mes) return a.mes - b.mes;
    if (a.dia !== b.dia) return a.dia - b.dia;
    return a.jornada - b.jornada;
  });

  return resultado;
}

function enriquecerJornadasConProductividad(
  jornadas: JornadaDia[],
  datosProductividad: Array<{
    CodEmpleado: string;
    Año: number;
    Mes: number;
    Día: number;
    TotalCantidad: number;
    TotalDefectos: number;
    TotalTiempoSTD: number;
  }>,
  justificados: TiempoJustificado[]
): JornadaDia[] {
  // Índice de horas a descontar por (CodEmpleado, Año, Mes, Día)
  const descontarIdx = new Map<string, number>();
  for (const j of justificados) {
    const día = (j as any).Día ?? (j as any).Dia;
    const key = `${j.CodEmpleado}__${j.Año}__${j.Mes}__${día}`;
    descontarIdx.set(key, (descontarIdx.get(key) ?? 0) + j.HorasDescontar);
  }

  // Índice de datos de productividad por (CodEmpleado, Año, Mes, Día)
  // Si hay múltiples jornadas en el mismo día, se suman las cantidades/defectos/STD
  const productividadIdx = new Map<string, {
    TotalCantidad: number;
    TotalDefectos: number;
    TotalTiempoSTD: number;
  }>();
  for (const datos of datosProductividad) {
    const día = (datos as any).Día ?? (datos as any).Dia;
    const key = `${datos.CodEmpleado}__${datos.Año}__${datos.Mes}__${día}`;
    const cantidad = Number(datos.TotalCantidad ?? 0);
    const defectos = Number(datos.TotalDefectos ?? 0);
    const tiempoSTD = Number(datos.TotalTiempoSTD ?? 0);
    const prev = productividadIdx.get(key);
    if (prev) {
      prev.TotalCantidad += cantidad;
      prev.TotalDefectos += defectos;
      prev.TotalTiempoSTD += tiempoSTD;
    } else {
      productividadIdx.set(key, {
        TotalCantidad: cantidad,
        TotalDefectos: defectos,
        TotalTiempoSTD: tiempoSTD,
      });
    }
  }

  // Enriquecer cada jornada
  return jornadas.map((jornada) => {
    const keyDescontar = `${jornada.codEmpleado}__${jornada.año}__${jornada.mes}__${jornada.dia}`;
    const keyProductividad = `${jornada.codEmpleado}__${jornada.año}__${jornada.mes}__${jornada.dia}`;

    const horasDescontar = jornada.jornada === 1 ? (descontarIdx.get(keyDescontar) ?? 0) : 0;
    const datosProd = productividadIdx.get(keyProductividad);

    return {
      ...jornada,
      horasDescontar,
      totalCantidad: datosProd?.TotalCantidad ?? 0,
      totalDefectos: datosProd?.TotalDefectos ?? 0,
      totalTiempoSTD: datosProd?.TotalTiempoSTD ?? 0,
    };
  });
}

const OPCIONES_RANGO: Array<{ value: Exclude<RangoBusqueda, "personalizado">; label: string }> = [
  { value: "semana_actual", label: "Semana actual" },
  { value: "por_mes", label: "Por mes" },
];

export function DashboardDshCard() {
  const isMobile = useIsMobile();
  const [departamentos, setDepartamentos] = useState<DepartamentoDisponible[]>([]);
  const [departamentoSeleccionado, setDepartamentoSeleccionado] = useState<string | null>(null);
  const [rangoBusqueda, setRangoBusqueda] = useState<RangoBusqueda>("semana_actual");
  const [mesSeleccionado, setMesSeleccionado] = useState<string>(() => {
    const hoy = new Date();
    return `${hoy.getFullYear()}-${hoy.getMonth()}`;
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [operadores, setOperadores] = useState<OperadorDisponible[]>([]);
  const [loadingOperadores, setLoadingOperadores] = useState(false);
  const [errorOperadores, setErrorOperadores] = useState<string | null>(null);
  const [rangoPersonalizado, setRangoPersonalizado] = useState<DateRange | undefined>(undefined);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [filtrosDepartamentos, setFiltrosDepartamentos] = useState<any>(null);
  const [busquedaFiltros, setBusquedaFiltros] = useState("");
  const [filtroIndex, setFiltroIndex] = useState(0);
  const [departamentoIndex, setDepartamentoIndex] = useState(0);
  const [filtrosExpandido, setFiltrosExpandido] = useState(false);
  const [filtrosSeleccionados, setFiltrosSeleccionados] = useState<string[]>([]);

  const [visibilidadConfig, setVisibilidadConfig] = useState<Record<string, string[]> | null>(null);
  const [visibilidadCargada, setVisibilidadCargada] = useState(false);

  // Estado para datos de productividad (Paso 2)
  const [jornadasCalculadas, setJornadasCalculadas] = useState<JornadaDia[]>([]);
  const [productividadPorOperador, setProductividadPorOperador] = useState<Map<string, Array<{
    CodEmpleado: string;
    Año: number;
    Mes: number;
    Día: number;
    TotalCantidad: number;
    TotalDefectos: number;
    TotalTiempoSTD: number;
  }>>>(new Map());
  const [loadingConsulta, setLoadingConsulta] = useState(false);
  const [operadorCargando, setOperadorCargando] = useState<string | null>(null);
  const [operadoresCargados, setOperadoresCargados] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const resumenOperadores = useMemo(() => {
    const agrupado = new Map<string, JornadaDia[]>();
    jornadasCalculadas.forEach((jornada) => {
      if (!agrupado.has(jornada.codEmpleado)) {
        agrupado.set(jornada.codEmpleado, []);
      }
      agrupado.get(jornada.codEmpleado)!.push(jornada);
    });

    const operadores = Array.from(agrupado.entries()).map(([codEmpleado, jornadas]): ResumenOperador => {
      const nombre = jornadas[0]?.nombreEmpleado ?? `Op. ${codEmpleado}`;
      const cargo = jornadas[0]?.cargoEmpleado ?? "Sin Cargo";
      const totalHorasNetas = jornadas.reduce((sum, j) => sum + j.horasNetas, 0);
      const totalA = totalHorasNetas * 0.13;
      const totalHorasDescontar = jornadas.reduce((sum, j) => sum + (j.horasDescontar || 0), 0);

      // Fuente de la verdad para STD, unidades y defectos: ProductividadFechasPersona (SP)
      const prodData = productividadPorOperador.get(String(codEmpleado));
      let totalHorasSTD: number;
      let totalUnidades: number;
      let totalDefectos: number;
      if (prodData && prodData.length > 0) {
        totalHorasSTD = prodData.reduce((s, d) => s + (Number(d.TotalTiempoSTD) || 0), 0);
        totalUnidades = prodData.reduce((s, d) => s + (Number(d.TotalCantidad) || 0), 0);
        totalDefectos = prodData.reduce((s, d) => s + (Number(d.TotalDefectos) || 0), 0);
      } else {
        totalHorasSTD = jornadas.reduce((sum, j) => sum + (j.totalTiempoSTD ?? 0), 0);
        totalUnidades = jornadas.reduce((sum, j) => sum + (j.totalCantidad ?? 0), 0);
        totalDefectos = jornadas.reduce((sum, j) => sum + (j.totalDefectos ?? 0), 0);
      }
      
      const horasTeoricasEB = totalHorasNetas - totalA - totalHorasDescontar;
      const productividad = horasTeoricasEB > 0 ? (totalHorasSTD / horasTeoricasEB) * 100 : 0;
      const calidad = totalUnidades > 0 ? (1 - totalDefectos / totalUnidades) * 100 : 0;
      const ego = productividad * calidad / 100;

      return {
        codEmpleado,
        nombre,
        cargo,
        totalHorasNetas,
        totalA,
        totalHorasSTD,
        totalHorasDescontar,
        totalUnidades,
        totalDefectos,
        productividad,
        calidad,
        ego,
      };
    });

    const unidadesPorCargo = new Map<string, number>();
    operadores.forEach((op) => {
      unidadesPorCargo.set(op.cargo, (unidadesPorCargo.get(op.cargo) ?? 0) + op.totalUnidades);
    });

    const operadorMejorEgo = operadores.length > 0 ? operadores.reduce(
      (best, current) => (current.ego > best.ego ? current : best),
      operadores[0]
    ) : { codEmpleado: "", nombre: "N/A", cargo: "", totalHorasNetas: 0, totalA: 0, totalHorasSTD: 0, totalHorasDescontar: 0, totalUnidades: 0, productividad: 0, calidad: 0, ego: 0 };

    const operadorPeorEgo = operadores.length > 0 ? operadores.reduce(
      (worst, current) => (current.ego < worst.ego ? current : worst),
      operadores[0]
    ) : { codEmpleado: "", nombre: "N/A", cargo: "", totalHorasNetas: 0, totalA: 0, totalHorasSTD: 0, totalHorasDescontar: 0, totalUnidades: 0, productividad: 0, calidad: 0, ego: 0 };

    const operadoresOrdenados = [...operadores].sort((a, b) => b.ego - a.ego);
    const minEgo = operadoresOrdenados.length > 0 ? operadoresOrdenados[operadoresOrdenados.length - 1].ego : 0;

    const totalDefectosTodos = operadores.reduce((sum, op) => sum + (op.totalDefectos ?? 0), 0);
    const promedioProductividad = operadores.length > 0 ? operadores.reduce((sum, op) => sum + op.productividad, 0) / operadores.length : 0;
    const promedioEgo = operadores.length > 0 ? operadores.reduce((sum, op) => sum + op.ego, 0) / operadores.length : 0;

    return {
      agrupadoPorOperador: agrupado,
      chartData: operadoresOrdenados.map((op) => ({
        name: op.nombre.split(' ').map(n => n[0]).join('').substring(0, 4),
        nameFull: op.nombre,
        productividad: Number(op.productividad.toFixed(2)),
        ego: Number(op.ego.toFixed(2)),
      })),
      unidadesPorCargo: Array.from(unidadesPorCargo.entries()).map(([cargo, unidades]) => ({ cargo, unidades })),
      totalUnidadesTodos: operadores.reduce((sum, op) => sum + op.totalUnidades, 0),
      totalDefectosTodos,
      maxEgo: operadoresOrdenados.length > 0 ? operadoresOrdenados[0].ego : 0,
      minEgo,
      maxProductividad: operadores.reduce((max, op) => Math.max(max, op.productividad), 0),
      promedioProductividad,
      promedioEgo,
      operadorMejorEgo,
      operadorPeorEgo,
    };
  }, [jornadasCalculadas, productividadPorOperador]);
  
  useEffect(() => {
    const cargarDepartamentos = async () => {
      try {
        setLoading(true);

        const [resDepts, resConfig] = await Promise.all([
          servicioService.getDepartamentosDisponiblesProduccion(),
          configuracionService.getConfigrucacionesByCodigoAplicacion().catch(() => ({ data: [] })),
        ]);

        // Parsear VISIBILIDAD_DEPARTAMENTOS
        const configVisibilidad = ((resConfig.data as any[]) ?? []).find(
          (c: any) => c.nombre_configuracion === "VISIBILIDAD_DEPARTAMENTOS"
        );
        console.log("[DSH] resConfig.data:", resConfig.data);
        console.log("[DSH] configVisibilidad encontrado:", configVisibilidad);
        let visibilidad: Record<string, string[]> | null = null;
        if (configVisibilidad?.valor_configuracion) {
          try {
            visibilidad = JSON.parse(configVisibilidad.valor_configuracion);
            console.log("[DSH] visibilidad parseada:", visibilidad);
          } catch (e) {
            console.error("[DSH] Error parseando VISIBILIDAD_DEPARTAMENTOS:", e);
            visibilidad = null;
          }
        }
        setVisibilidadConfig(visibilidad);
        setVisibilidadCargada(true);

        const departamentosNormalizados = ((resDepts.data as any[]) ?? [])
          .map(normalizarDepartamento)
          .filter((item) => item.nombre.trim().length > 0);

        setDepartamentos(departamentosNormalizados);
        setDepartamentoSeleccionado(null);
        setError(null);
      } catch {
        setError("No se pudieron cargar los departamentos disponibles.");
      } finally {
        setLoading(false);
      }
    };

    cargarDepartamentos();
  }, []);

  useEffect(() => {
    const cargarFiltrosDepartamentos = async () => {
      try {
        const response = await servicioService.getFiltrosDepartamentos();
        setFiltrosDepartamentos(response.data);
      } catch (err) {
        console.error("Error al cargar filtros de departamentos:", err);
      }
    };

    if (departamentos.length > 0 && !loading) {
      cargarFiltrosDepartamentos();
    }
  }, [departamentos, loading]);

  // Filtrar departamentos según VISIBILIDAD_DEPARTAMENTOS
  const departamentosFiltrados = useMemo(() => {
    // Todavía no terminó de cargar la config → no mostrar nada aún
    if (!visibilidadCargada) return [];

    // Si no hay config definida → no se puede determinar acceso, mostrar ninguno
    if (!visibilidadConfig) return [];

    const userString = typeof window !== "undefined" ? localStorage.getItem("user") : null;
    const user = userString ? JSON.parse(userString) : null;
    const userDepartment: string = user?.department ?? "";
    const userCode: string = String(user?.code ?? "");

    return departamentos.filter((dept) => {
      const regla = visibilidadConfig[dept.nombre];
      if (!regla) return false; // no aparece en config → no visible

      // Regla AREA: el department del usuario coincide con el nombre del departamento
      if (regla.includes("AREA") && userDepartment === dept.nombre) return true;

      // Regla por código de empleado
      const codigos = regla.filter((r) => r !== "AREA");
      if (codigos.includes(userCode)) return true;

      return false;
    });
  }, [departamentos, visibilidadConfig, visibilidadCargada]);

  const seleccionado = useMemo(
    () => departamentosFiltrados.find((d) => d.id === departamentoSeleccionado) ?? null,
    [departamentosFiltrados, departamentoSeleccionado]
  );

  const rangoFechas = useMemo((): { desde: Date; hasta: Date } => {
    switch (rangoBusqueda) {
      case "personalizado":
        if (rangoPersonalizado?.from) {
          return {
            desde: rangoPersonalizado.from,
            hasta: rangoPersonalizado.to ?? rangoPersonalizado.from,
          };
        }
        break;
      case "por_mes":
        if (mesSeleccionado) {
          const [año, mes] = mesSeleccionado.split('-').map(Number);
          return calcularRangoMes(año, mes);
        }
        break;
      case "3_meses":
      case "1_mes":
      case "semana_actual":
        return calcularRango(rangoBusqueda, new Date());
    }
    return calcularRango("semana_actual", new Date());
  }, [rangoBusqueda, rangoPersonalizado, mesSeleccionado]);

  const numDiasRango = useMemo((): number => {
    switch (rangoBusqueda) {
      case "personalizado":
        if (rangoPersonalizado?.from && rangoPersonalizado?.to) {
          const diff = Math.ceil(
            (rangoPersonalizado.to.getTime() - rangoPersonalizado.from.getTime()) / (1000 * 60 * 60 * 24)
          );
          return Math.max(1, diff + 1);
        }
        break;
      case "por_mes":
        if (mesSeleccionado) {
          const [año, mes] = mesSeleccionado.split('-').map(Number);
          const rangoMes = calcularRangoMes(año, mes);
          return Math.ceil((rangoMes.hasta.getTime() - rangoMes.desde.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        }
        break;
      case "3_meses":
        return 90;
      case "1_mes":
        return 30;
      case "semana_actual":
        return 7;
    }
    return 7;
  }, [rangoBusqueda, rangoPersonalizado, mesSeleccionado]);
  const operadoresPorVista = isMobile ? 1 : 3;
  
  // Necesario declara primero para usarse en operadoresFiltrados
  const cargosSeleccionados = useMemo(() => {
    const cargosUnicos = new Set<string>();
    const codigosEmpleadoUnicos = new Set<string>();

    // Para cada cargo seleccionado, agregar cargo y códigos de empleado
    filtrosDepartamentos?.forEach((filtro: any) => {
      const id = `${filtro.CargoEmpleado || ""}`;
      if (filtrosSeleccionados.includes(id)) {
        if (filtro.CargoEmpleado) cargosUnicos.add(filtro.CargoEmpleado);
        if (filtro.CodEmpleado) codigosEmpleadoUnicos.add(String(filtro.CodEmpleado));
      }
    });

    console.log("Cargos únicos seleccionados:", Array.from(cargosUnicos));
    console.log("Códigos de empleado para cargos seleccionados:", Array.from(codigosEmpleadoUnicos));

    return {
      cargosString: Array.from(cargosUnicos).join("&"),
      codigosEmpleadoString: Array.from(codigosEmpleadoUnicos).join("&"),
      codigosEmpleadoSet: codigosEmpleadoUnicos,
    };
  }, [filtrosSeleccionados, filtrosDepartamentos]);

  // Filtrar operadores por cargos seleccionados
  const operadoresFiltradosPorCargos = useMemo(() => {
    // Si no hay cargos seleccionados, retornar todos los operadores
    if (cargosSeleccionados.codigosEmpleadoSet.size === 0) {
      return operadores;
    }

    // Filtrar operadores que coincidan con los códigos extraídos de los cargos
    return operadores.filter((operador) => 
      cargosSeleccionados.codigosEmpleadoSet.has(operador.codigo)
    );
  }, [operadores, cargosSeleccionados]);

  const operadoresFiltrados = useMemo(() => {
    return operadoresFiltradosPorCargos;
  }, [operadoresFiltradosPorCargos]);

  const filtrosFiltrados = useMemo(() => {
    if (!filtrosDepartamentos || !Array.isArray(filtrosDepartamentos)) return [];
    
    // Filtrar por departamento y obtener cargos únicos
    const cargosMap = new Map<string, any>();
    
    filtrosDepartamentos.forEach((filtro: any) => {
      const centroMatch = !seleccionado?.centro || filtro.Centro === seleccionado.centro;
      const deptMatch = filtro.Departamento === seleccionado?.nombre;
      
      if (centroMatch && deptMatch && filtro.CargoEmpleado) {
        const cargo = String(filtro.CargoEmpleado).trim();
        if (cargo && !cargosMap.has(cargo)) {
          cargosMap.set(cargo, filtro);
        }
      }
    });
    
    let resultados = Array.from(cargosMap.values());
    
    // Filtrar por búsqueda
    const termino = busquedaFiltros.trim().toLowerCase();
    if (termino) {
      resultados = resultados.filter((filtro: any) => {
        const cargoBusqueda = String(filtro.CargoEmpleado || "").toLowerCase();
        return cargoBusqueda.includes(termino);
      });
    }
    
    // Ordenar alfabéticamente por cargo
    resultados.sort((a: any, b: any) => {
      return (a.CargoEmpleado || "").localeCompare(b.CargoEmpleado || "", "es-EC");
    });
    
    return resultados;
  }, [filtrosDepartamentos, seleccionado, busquedaFiltros]);

  const filtrosPorVista = 3;
  const maxFiltroIndex = Math.max(0, filtrosFiltrados.length - filtrosPorVista);
  const filtrosPaginados = useMemo(() => {
    return filtrosFiltrados.slice(filtroIndex, filtroIndex + filtrosPorVista);
  }, [filtrosFiltrados, filtroIndex, filtrosPorVista]);

  const handlePrevFiltro = () => {
    setFiltroIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNextFiltro = () => {
    setFiltroIndex((prev) => Math.min(maxFiltroIndex, prev + 1));
  };

  const generarIdFiltro = (filtro: any): string => {
    return `${filtro.CargoEmpleado || ""}`;
  };

  const agruparFiltrosPorLetra = (filtros: any[]) => {
    const grupos: { [key: string]: any[] } = {};
    
    filtros.forEach((filtro) => {
      const texto = filtro.CargoEmpleado;
      const primera = (texto || "")[0]?.toUpperCase() || "#";
      if (!grupos[primera]) grupos[primera] = [];
      grupos[primera].push(filtro);
    });
    
    // Ordenar claves alfabéticamente
    return Object.keys(grupos).sort().reduce((acc, key) => {
      acc[key] = grupos[key];
      return acc;
    }, {} as { [key: string]: any[] });
  };

  const toggleFiltroSeleccionado = (filtro: any) => {
    const id = generarIdFiltro(filtro);
    setFiltrosSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  };

  const toggleSeleccionarTodos = () => {
    if (filtrosSeleccionados.length === filtrosFiltrados.length) {
      // Si todos están seleccionados, deseleccionar todos
      setFiltrosSeleccionados([]);
    } else {
      // Seleccionar todos
      const todosLosIds = filtrosFiltrados.map((filtro: any) => generarIdFiltro(filtro));
      setFiltrosSeleccionados(todosLosIds);
    }
  };

  const toggleSeleccionarTodosPorLetra = (filtros: any[]) => {
    const idsDeEstaLetra = filtros.map((filtro: any) => generarIdFiltro(filtro));
    const todosSeleccionadosEnLetra = idsDeEstaLetra.every((id) =>
      filtrosSeleccionados.includes(id)
    );

    if (todosSeleccionadosEnLetra) {
      // Si todos están seleccionados en esta letra, deseleccionar
      setFiltrosSeleccionados((prev) =>
        prev.filter((id) => !idsDeEstaLetra.includes(id))
      );
    } else {
      // Seleccionar todos en esta letra
      setFiltrosSeleccionados((prev) => {
        const nuevoSet = new Set(prev);
        idsDeEstaLetra.forEach((id) => nuevoSet.add(id));
        return Array.from(nuevoSet);
      });
    }
  };

  const isFiltroSeleccionado = (filtro: any): boolean => {
    return filtrosSeleccionados.includes(generarIdFiltro(filtro));
  };

  const filtrosSeleccionadosString = filtrosSeleccionados.join("&");

  const departamentosPorVista = 3;
  const maxDepartamentoIndex = Math.max(0, departamentosFiltrados.length - departamentosPorVista);
  const departamentosPaginados = useMemo(() => {
    return departamentosFiltrados.slice(departamentoIndex, departamentoIndex + departamentosPorVista);
  }, [departamentosFiltrados, departamentoIndex, departamentosPorVista]);

  const handlePrevDepartamento = () => {
    setDepartamentoIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNextDepartamento = () => {
    setDepartamentoIndex((prev) => Math.min(maxDepartamentoIndex, prev + 1));
  };

  const maxOperadorIndex = Math.max(0, operadoresFiltrados.length - operadoresPorVista);
  const totalPaginasOperador = Math.max(1, Math.ceil(operadoresFiltrados.length / operadoresPorVista));
  const paginaActualOperador = 0;
  const operadoresPaginados = useMemo(() => {
    return operadoresFiltrados;
  }, [operadoresFiltrados]);

  useEffect(() => {
    const cargarOperadores = async () => {
      if (!seleccionado) {
        setOperadores([]);
        setErrorOperadores(null);
        return;
      }

      try {
        setLoadingOperadores(true);
        setErrorOperadores(null);

        const response = await servicioService.getOperadoresPorNombredeAreaYFechaInicio(
          seleccionado.nombre,
          rangoFechas.desde
        );

        const operadoresNormalizados = ((response.data as any[]) ?? [])
          .map(normalizarOperador)
          .filter((item) => item.nombre !== "Sin nombre");

        setOperadores(operadoresNormalizados);
      } catch {
        setOperadores([]);
        setErrorOperadores("No se pudieron cargar los operadores para el departamento seleccionado.");
      } finally {
        setLoadingOperadores(false);
      }
    };

    cargarOperadores();
  }, [seleccionado]);

  useEffect(() => {
    setFiltroIndex(0);
  }, [busquedaFiltros, filtrosFiltrados.length]);

  useEffect(() => {
    setDepartamentoIndex(0);
    setDepartamentoSeleccionado(null);
    setFiltrosSeleccionados([]);
    setJornadasCalculadas([]);
    setProductividadPorOperador(new Map());
    setOperadoresCargados(0);
  }, [departamentosFiltrados.length]);

  // Mapa nombre por código para calcularJornadasPorDia
  const nombrePorCodigoMap = useMemo(() => {
    const m = new Map<string, string>();
    operadores.forEach((o) => m.set(o.codigo, o.nombre));
    return m;
  }, [operadores]);

  const cancelarConsulta = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoadingConsulta(false);
    setOperadorCargando(null);
  };

  const consultarProductividad = async () => {
    if (!operadoresFiltradosPorCargos.length || !seleccionado) return;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setOperadoresCargados(0);
    setLoadingConsulta(true);
    
    // Limpiar datos anteriores
    setJornadasCalculadas([]);
    setProductividadPorOperador(new Map());

    const fi = formatearFechaISO(rangoFechas.desde);
    const ff = formatearFechaISO(rangoFechas.hasta);

    let resultadoFinal: JornadaDia[] = [];

    for (const operador of operadoresFiltradosPorCargos) {
      const codigo = String(operador.codigo);
      setOperadorCargando(codigo);
      if (controller.signal.aborted) break;

      try {
        const [resRegistros, resJustificados, resProductividad] = await Promise.all([
          servicioService.getRegistrosProductividadPersonas(
            codigo, fi, ff, seleccionado.nombre, cargosSeleccionados.cargosString
          ),
          servicioService.getTiemposJustificadosOperadores(codigo, fi, ff),
          servicioService.getProductividadSegmentoFechasPersona(
            codigo, fi, ff, seleccionado.nombre, cargosSeleccionados.cargosString
          ),
        ]);

        if (controller.signal.aborted) break;

        let registrosCopia = ((resRegistros.data as RegistroProductividad[]) ?? []).map((item) => ({
          ...item,
          CodEmpleado: String(item.CodEmpleado ?? codigo),
          Año: Number(item.Año ?? 0),
          Mes: Number(item.Mes ?? 0),
          Día: Number((item as any).Día ?? (item as any).Dia ?? 0),
          HORA: String(item.HORA ?? "00:00"),
          UNIDADES_PROD: Number(item.UNIDADES_PROD ?? 0),
          TiempoSTD: Number(item.TiempoSTD ?? 0),
          TiempoTotalDia: Number(item.TiempoTotalDia ?? 0),
        }));
        const justificadosCopia = ((resJustificados.data as TiempoJustificado[]) ?? []).map((item) => ({
          CodEmpleado: String(item.CodEmpleado ?? codigo),
          Año: Number(item.Año ?? 0),
          Mes: Number(item.Mes ?? 0),
          Día: Number((item as any).Día ?? (item as any).Dia ?? 0),
          HorasDescontar: Number(item.HorasDescontar ?? 0),
        }));
        const productividadCopia = ((resProductividad.data as any[]) ?? []).map((item) => ({
          CodEmpleado: String(item.CodEmpleado ?? codigo),
          Año: Number(item.Año ?? 0),
          Mes: Number(item.Mes ?? 0),
          Día: Number((item as any).Día ?? (item as any).Dia ?? 0),
          TotalCantidad: Number(item.TotalCantidad ?? item.Cantidad ?? 0),
          TotalDefectos: Number(item.TotalDefectos ?? item.CantidadDefectos ?? 0),
          TotalTiempoSTD: Number(item.TotalTiempoSTD ?? item.TiempoSTDTotal ?? 0),
        })) as Array<{
          CodEmpleado: string;
          Año: number;
          Mes: number;
          Día: number;
          TotalCantidad: number;
          TotalDefectos: number;
          TotalTiempoSTD: number;
        }>;

        // Mapear productividad por (CodEmpleado, Año, Mes, Día) para asignación directa
        const productividadIdxMap = new Map<string, typeof productividadCopia[number]>();
        for (const d of productividadCopia) {
          productividadIdxMap.set(`${d.CodEmpleado}__${d.Año}__${d.Mes}__${d.Día}`, d);
        }

        const cargoPorCodigoMap = new Map<string, string>();
        registrosCopia.forEach((r) => {
          if (r.CargoEmpleado) {
            cargoPorCodigoMap.set(r.CodEmpleado, r.CargoEmpleado);
          }
        });

        const jornadas = calcularJornadasPorDia(registrosCopia, nombrePorCodigoMap, cargoPorCodigoMap);
        const jornadasEnriquecidas = enriquecerJornadasConProductividad(jornadas, productividadCopia, justificadosCopia);

        // Guardar productividad por operador (fuente de la verdad para unidades/defectos)
        setProductividadPorOperador((prev) => {
          const next = new Map(prev);
          next.set(String(codigo), [...productividadCopia]);
          return next;
        });

        // Limpiar la copia de datos una vez procesado
        registrosCopia = [];
        productividadCopia.length = 0;
        justificadosCopia.length = 0;

        resultadoFinal = [...resultadoFinal, ...jornadasEnriquecidas];
        setJornadasCalculadas(resultadoFinal);
        setOperadoresCargados((n) => n + 1);
      } catch {
        if (controller.signal.aborted) break;
        setOperadoresCargados((n) => n + 1);
      }
    }

    abortControllerRef.current = null;
    setOperadorCargando(null);
    setLoadingConsulta(false);
  };

  const etiquetasResumen = [
    {
      label: "Departamentos",
      value: String(departamentosFiltrados.length).padStart(2, "0"),
      detail: seleccionado ? `Activo: ${seleccionado.nombre}` : "Elige una vista de trabajo",
      icon: Building2,
      accent: "text-emerald-600",
    },
    {
      label: "Operadores",
      value: String(operadoresFiltradosPorCargos.length).padStart(2, "0"),
      detail: loadingOperadores ? "Actualizando listado..." : cargosSeleccionados.codigosEmpleadoSet.size > 0 ? `Filtrados por ${cargosSeleccionados.cargosString.split("&").length} cargo(s)` : "Disponibles con el filtro actual",
      icon: Users,
      accent: "text-sky-600",
    },
    {
      label: "Rango",
      value: `${numDiasRango}`,
      detail: `${formatearFecha(rangoFechas.desde)} - ${formatearFecha(rangoFechas.hasta)}`,
      icon: CalendarIcon,
      accent: "text-amber-600",
    },
  ];

  return (
    <Card className="overflow-hidden border-border/60 bg-[linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(248,250,252,0.96))] shadow-sm">
      <CardHeader className="border-b border-border/60 bg-[radial-gradient(circle_at_top_right,_rgba(14,165,233,0.12),_transparent_24%),radial-gradient(circle_at_top_left,_rgba(16,185,129,0.12),_transparent_22%)] px-6 py-6">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,420px)] xl:items-start">
          <div className="space-y-5">
            <div className="space-y-3">
              <div>
                <CardTitle className="text-2xl font-semibold tracking-tight">Panel de exploración operacional</CardTitle>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                  Selecciona un departamento, define el rango y navega entre la lectura global y el detalle por operador desde una misma superficie.
                </p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {etiquetasResumen.map((item) => {
                const Icono = item.icon;
                return (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-border/60 bg-white/80 p-4 shadow-sm backdrop-blur"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                          {item.label}
                        </p>
                        <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{item.value}</p>
                      </div>
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-muted/60">
                        <Icono className={`h-5 w-5 ${item.accent}`} />
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">{item.detail}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-3xl border border-border/60 bg-white/85 p-5 shadow-sm backdrop-blur">

            <div className="mt-4 flex flex-wrap gap-2">
              {OPCIONES_RANGO.map((opcion) => (
                <Button
                  key={opcion.value}
                  type="button"
                  size="sm"
                  variant={rangoBusqueda === opcion.value ? "default" : "outline"}
                  className={rangoBusqueda === opcion.value ? "shadow-sm" : "bg-white"}
                  onClick={() => setRangoBusqueda(opcion.value)}
                >
                  {opcion.label}
                </Button>
              ))}

              <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    variant={rangoBusqueda === "personalizado" ? "default" : "outline"}
                    className="gap-1.5"
                  >
                    <CalendarIcon className="h-3.5 w-3.5" />
                    Personalizado
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="range"
                    selected={rangoPersonalizado}
                    onSelect={(range) => {
                      setRangoPersonalizado(range);
                      setRangoBusqueda("personalizado");
                      if (range?.from && range?.to) {
                        setPopoverOpen(false);
                      }
                    }}
                    numberOfMonths={2}
                    disabled={{ after: new Date() }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {rangoBusqueda === "por_mes" && (
              <div className="mt-3">
                <Select value={mesSeleccionado} onValueChange={setMesSeleccionado}>
                  <SelectTrigger className="w-full bg-white">
                    <SelectValue placeholder="Selecciona un mes" />
                  </SelectTrigger>
                  <SelectContent>
                    {generarMesesDisponibles().map((mes) => (
                      <SelectItem key={mes.value} value={mes.value}>
                        {mes.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="mt-4 rounded-2xl border border-dashed border-border/70 bg-muted/20 p-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Rango activo
              </p>
              <p className="mt-2 text-sm font-semibold text-foreground">
                Desde {formatearFecha(rangoFechas.desde)} hasta {formatearFecha(rangoFechas.hasta)}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {numDiasRango} día(s) considerados en la comparación actual.
              </p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-1 py-1">
        {loading ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-[132px] rounded-2xl border border-border bg-muted/40 animate-pulse"
              />
            ))}
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : departamentosFiltrados.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay departamentos disponibles.</p>
        ) : (
          <div className="space-y-1">
            <section className="rounded-3xl border border-border/60 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Paso 1
                  </p>
                  <p className="mt-1 text-lg font-semibold text-foreground">Selecciona el departamento base</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Mantengo la lógica original: el departamento define los operadores y habilita el análisis posterior.
                  </p>
                </div>
                <Badge variant="outline" className="w-fit bg-white">
                  {seleccionado ? `Activo: ${seleccionado.nombre}` : "Pendiente de selección"}
                </Badge>
              </div>

              <div className="mt-4 flex items-center gap-3">
                {departamentosFiltrados.length > departamentosPorVista && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 flex-shrink-0"
                    disabled={departamentoIndex === 0}
                    onClick={handlePrevDepartamento}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                )}

                <div className={isMobile ? "grid grid-cols-1 gap-3 flex-1" : "grid grid-cols-1 gap-3 md:grid-cols-3 flex-1"}>
                {departamentosPaginados.map((departamento) => {
                const isSelected = departamento.id === departamentoSeleccionado;

                return (
                  <button
                    key={departamento.id}
                    type="button"
                    onClick={() => setDepartamentoSeleccionado(departamento.id)}
                    aria-pressed={isSelected}
                    className={[
                      "group relative min-h-[100px] rounded-2xl border px-4 py-3 text-left",
                      "transition-all duration-200",
                      isSelected
                        ? "border-primary bg-primary/[0.04] shadow-md ring-1 ring-primary/25"
                        : "border-border bg-white shadow-sm hover:-translate-y-0.5 hover:border-primary/40 hover:shadow",
                    ].join(" ")}
                  >
                    <div className="flex h-full flex-col justify-between gap-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
                          Departamento
                          </p>
                          <p className="mt-1 text-sm font-semibold leading-tight text-foreground truncate">
                            {departamento.nombre}
                          </p>
                        </div>
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-muted/60 text-xs font-semibold text-foreground flex-shrink-0">
                          {inicialesDepartamento(departamento.nombre)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-border/30">
                        <span className="text-[11px] text-muted-foreground">
                          {isSelected ? "Activo" : "Seleccionar"}
                        </span>
                        {isSelected ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                        ) : (
                          <span className="text-[11px] font-medium text-muted-foreground transition-colors group-hover:text-foreground">→</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
                </div>

                {departamentosFiltrados.length > departamentosPorVista && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 flex-shrink-0"
                    disabled={departamentoIndex >= maxDepartamentoIndex}
                    onClick={handleNextDepartamento}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {departamentosFiltrados.length > departamentosPorVista && (
                <div className="mt-3 flex justify-center gap-2 border-t border-border/60 pt-3">
                  {Array.from({ length: Math.ceil(departamentosFiltrados.length / departamentosPorVista) }).map((_, pagina) => (
                    <button
                      key={pagina}
                      type="button"
                      onClick={() => setDepartamentoIndex(pagina * departamentosPorVista)}
                      className={[
                        "h-2 rounded-full transition-all",
                        Math.floor(departamentoIndex / departamentosPorVista) === pagina ? "w-6 bg-primary" : "w-2 bg-muted-foreground/35",
                      ].join(" ")}
                      aria-label={`Ir a la página ${pagina + 1}`}
                    />
                  ))}
                </div>
              )}
            </section>

            {seleccionado && filtrosDepartamentos && (
              <section className="rounded-3xl border border-border/60 bg-white p-5 shadow-sm">

                {!filtrosExpandido ? (
                  // MODO CARRUSEL COMPACTO
                  <div className="space-y-4 rounded-2xl border border-border/80 bg-muted/20 p-4">
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            Cargos de empleados disponibles
                          </p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            Busca directamente o navega por páginas para explorar las opciones disponibles.
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className="text-xs text-muted-foreground">
                            {busquedaFiltros
                              ? `${filtrosFiltrados.length} de ${filtrosDepartamentos.filter((f: any) => f.Departamento === seleccionado?.nombre && (!seleccionado?.centro || f.Centro === seleccionado.centro)).length} resultados`
                              : `Página ${Math.floor(filtroIndex / filtrosPorVista) + 1} de ${Math.ceil(filtrosFiltrados.length / filtrosPorVista)}`}
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setFiltrosExpandido(true)}
                            className="text-xs"
                          >
                            Ver todos ({filtrosFiltrados.length})
                          </Button>
                        </div>
                      </div>
                    </div>

                    {filtrosFiltrados.length === 0 && !busquedaFiltros ? (
                      <p className="text-sm text-muted-foreground">No hay cargos disponibles para este departamento.</p>
                    ) : (
                      <>
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            type="text"
                            value={busquedaFiltros}
                            onChange={(e) => setBusquedaFiltros(e.target.value)}
                            placeholder="Buscar por grupo de puesto o cargo..."
                            className="h-10 border-border/70 bg-white pl-9 pr-9"
                          />
                          {busquedaFiltros && (
                            <button
                              type="button"
                              onClick={() => setBusquedaFiltros("")}
                              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                              aria-label="Limpiar búsqueda"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          {!busquedaFiltros && filtrosFiltrados.length > filtrosPorVista && (
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 flex-shrink-0"
                              disabled={filtroIndex === 0}
                              onClick={handlePrevFiltro}
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                          )}

                          {filtrosPaginados.length === 0 ? (
                            <p className="rounded-2xl border border-dashed border-border/70 bg-white px-2 py-6 text-center text-sm text-muted-foreground flex-1">
                              No hay puestos que coincidan con &quot;{busquedaFiltros}&quot;.
                            </p>
                          ) : (
                            <div className={isMobile ? "grid grid-cols-1 gap-3 flex-1" : "grid grid-cols-1 gap-3 md:grid-cols-3 flex-1"}>
                              {filtrosPaginados.map((filtro: any, index: number) => {
                                const isSelected = isFiltroSeleccionado(filtro);
                                return (
                                  <button
                                    key={index}
                                    type="button"
                                    onClick={() => toggleFiltroSeleccionado(filtro)}
                                    className={[
                                      "flex h-full min-h-[100px] w-full flex-col justify-between rounded-2xl border px-3 py-3 text-left shadow-sm transition-all",
                                      isSelected
                                        ? "border-primary bg-primary/[0.04] ring-1 ring-primary/25 shadow-md"
                                        : "border-border bg-white hover:-translate-y-0.5 hover:border-primary/40 hover:shadow",
                                    ].join(" ")}
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold text-foreground">{filtro.CargoEmpleado}</p>
                                      </div>
                                      <div className={[
                                        "inline-flex h-5 w-5 items-center justify-center rounded border-2 transition-all flex-shrink-0",
                                        isSelected
                                          ? "border-primary bg-primary"
                                          : "border-border bg-white"
                                      ].join(" ")}>
                                        {isSelected && <Check className="h-3 w-3 text-white" />}
                                      </div>
                                    </div>

                                    <div className="mt-2 border-t border-border/30 pt-2">
                                      <p className="text-[11px] text-muted-foreground truncate">{filtro.Centro || "Centro"}</p>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {!busquedaFiltros && filtrosFiltrados.length > filtrosPorVista && (
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 flex-shrink-0"
                              disabled={filtroIndex >= maxFiltroIndex}
                              onClick={handleNextFiltro}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          )}
                        </div>

                        {!busquedaFiltros && filtrosFiltrados.length > filtrosPorVista && (
                          <div className="flex justify-center gap-2 border-t border-border/60 pt-3">
                            {Array.from({ length: Math.ceil(filtrosFiltrados.length / filtrosPorVista) }).map((_, pagina) => (
                              <button
                                key={pagina}
                                type="button"
                                onClick={() => setFiltroIndex(pagina * filtrosPorVista)}
                                className={[
                                  "h-2 rounded-full transition-all",
                                  Math.floor(filtroIndex / filtrosPorVista) === pagina ? "w-6 bg-primary" : "w-2 bg-muted-foreground/35",
                                ].join(" ")}
                                aria-label={`Ir a la página ${pagina + 1}`}
                              />
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  // MODO EXPANDIDO - VER TODOS
                  <div className="space-y-4">
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            Todos los cargos de empleados disponibles
                          </p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            Visualización completa de {filtrosFiltrados.length} elementos disponibles.
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setFiltrosExpandido(false);
                            setBusquedaFiltros("");
                            setFiltroIndex(0);
                          }}
                          className="text-xs"
                        >
                          Cerrar vista completa
                        </Button>
                      </div>

                    </div>

                    {filtrosFiltrados.length === 0 ? (
                      <p className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
                        No hay cargos disponibles para este departamento.
                      </p>
                    ) : (
                      <div className="space-y-6">
                        {Object.entries(agruparFiltrosPorLetra(filtrosFiltrados)).map(([letra, filtros]) => {
                          const idsDeEstaLetra = filtros.map((filtro: any) => generarIdFiltro(filtro));
                          const todosSeleccionadosEnLetra = idsDeEstaLetra.every((id) =>
                            filtrosSeleccionados.includes(id)
                          );

                          return (
                            <div key={letra} className="space-y-3">
                              <div className="flex items-center gap-3">
                                <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-xs font-bold text-white">
                                  {letra}
                                </div>
                                <div className="flex-1 border-t border-border/40" />
                                <span className="text-xs font-medium text-muted-foreground">{filtros.length} elemento(s)</span>
                                <button
                                  type="button"
                                  onClick={() => toggleSeleccionarTodosPorLetra(filtros)}
                                  className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                                >
                                  {todosSeleccionadosEnLetra ? "Deseleccionar" : "Seleccionar"}
                                </button>
                              </div>
                            
                            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                              {filtros.map((filtro: any, index: number) => {
                                const isSelected = isFiltroSeleccionado(filtro);
                                return (
                                  <button
                                    key={`${letra}-${index}`}
                                    type="button"
                                    onClick={() => toggleFiltroSeleccionado(filtro)}
                                    className={[
                                      "flex h-full min-h-[100px] w-full flex-col justify-between rounded-2xl border px-3 py-3 text-left shadow-sm transition-all",
                                      isSelected
                                        ? "border-primary bg-primary/[0.04] ring-1 ring-primary/25 shadow-md"
                                        : "border-border bg-white hover:-translate-y-0.5 hover:border-primary/40 hover:shadow",
                                    ].join(" ")}
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold text-foreground">{filtro.CargoEmpleado}</p>
                                      </div>
                                      <div className={[
                                        "inline-flex h-5 w-5 items-center justify-center rounded border-2 transition-all flex-shrink-0",
                                        isSelected
                                          ? "border-primary bg-primary"
                                          : "border-border bg-white"
                                      ].join(" ")}>
                                        {isSelected && <Check className="h-3 w-3 text-white" />}
                                      </div>
                                    </div>

                                    <div className="mt-2 border-t border-border/30 pt-2">
                                      <p className="text-[11px] text-muted-foreground truncate">{filtro.Centro || "Centro"}</p>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}

            {seleccionado && filtrosSeleccionados.length > 0 && operadoresFiltradosPorCargos.length > 0 && (
              <section className="rounded-3xl border border-border/60 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Paso 2</p>
                    <p className="mt-1 text-lg font-semibold text-foreground">Productividad por jornada</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {operadoresFiltradosPorCargos.length} operador(es) · {formatearFecha(rangoFechas.desde)} – {formatearFecha(rangoFechas.hasta)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {loadingConsulta && (
                      <span className="text-xs text-muted-foreground">
                        Cargando {operadorCargando ?? "..."} ({operadoresCargados}/{operadoresFiltradosPorCargos.length})
                      </span>
                    )}
                    {loadingConsulta && (
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={cancelarConsulta}
                        className="gap-2"
                      >
                        <X className="h-4 w-4" />
                        Cancelar
                      </Button>
                    )}
                    <Button
                      type="button"
                      onClick={consultarProductividad}
                      disabled={loadingConsulta}
                      className="gap-2"
                    >
                      {loadingConsulta ? (
                        <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                      Consultar
                    </Button>
                  </div>
                </div>

                {jornadasCalculadas.length > 0 && (
                  <>
                    <div className="mt-4 space-y-4">
                      <Card className="rounded-3xl border border-border bg-white p-3 shadow-sm">
                        <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
                          <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-emerald-50 p-2 shadow-sm">
                            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                              <ArrowUpRight className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Promedio EGO</p>
                              <p className="mt-1 text-2xl font-semibold text-foreground">{resumenOperadores.promedioEgo.toFixed(2)}%</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-sky-50 p-2 shadow-sm">
                            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                              <TrendingUp className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Promedio productividad</p>
                              <p className="mt-1 text-2xl font-semibold text-foreground">{resumenOperadores.promedioProductividad.toFixed(2)}%</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-violet-50 p-2 shadow-sm">
                            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                              <Package className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Unidades por Cargo</p>
                              <div className="mt-1 space-y-0.5">
                                {resumenOperadores.unidadesPorCargo.map(({ cargo, unidades }) => (
                                  <p key={cargo} className="text-sm font-semibold text-foreground">{cargo}: {unidades.toLocaleString()}</p>
                                ))}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-amber-50 p-2 shadow-sm">
                            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                              <Activity className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Defectos totales</p>
                              <p className="mt-1 text-2xl font-semibold text-foreground">{resumenOperadores.totalDefectosTodos}</p>
                            </div>
                          </div>
                        </div>
                      </Card>

                      <Card className="rounded-3xl border border-border bg-white p-3 shadow-sm">
                        <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
                          <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-blue-50 p-2 shadow-sm">
                            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
                              <CheckCircle2 className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Mejor EGO</p>
                              <p className="text-base font-semibold text-foreground">{resumenOperadores.operadorMejorEgo.nombre}</p>
                              <p className="text-xs text-muted-foreground">{resumenOperadores.operadorMejorEgo.cargo} - {resumenOperadores.operadorMejorEgo.ego.toFixed(2)}%</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-red-50 p-2 shadow-sm">
                            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-red-100 text-red-700">
                              <ArrowDownRight className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Peor EGO</p>
                              <p className="text-base font-semibold text-foreground">{resumenOperadores.operadorPeorEgo.nombre}</p>
                              <p className="text-xs text-muted-foreground">{resumenOperadores.operadorPeorEgo.cargo} - {resumenOperadores.operadorPeorEgo.ego.toFixed(2)}%</p>
                            </div>
                          </div>
                        </div>
                      </Card>

                      <Card className="rounded-3xl border border-border bg-white p-3 shadow-sm">
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">EGO y Productividad</p>
                          <p className="mt-2 text-sm text-muted-foreground">Operadores ordenados de mayor a menor EGO</p>
                        </div>
                        <div className="mt-4 w-full overflow-x-auto">
                          <BarChart
                            width={Math.max(resumenOperadores.chartData.length * 80, 400)}
                            height={320}
                            data={resumenOperadores.chartData}
                            margin={{ top: 40, right: 30, left: 20, bottom: 60 }}
                            barCategoryGap="30%"
                          >
                            <CartesianGrid strokeDasharray="3 3" opacity={0.35} />
                            <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#666' }} interval={0} angle={-45} textAnchor="end" height={80} />
                            <YAxis tickFormatter={(value) => `${value}%`} />
                            <Tooltip
                              labelFormatter={(_label, payload) => {
                                const item = payload?.[0]?.payload as { nameFull?: string } | undefined;
                                return item?.nameFull ?? "";
                              }}
                              formatter={(value: number | string, name: string) => [
                                `${Number(value).toFixed(2)}%`,
                                name,
                              ]}
                            />
                            <Legend verticalAlign="top" height={36} />
                            <Bar dataKey="productividad" name="Productividad" fill="#2563EB" fillOpacity={0.8} />
                            <Bar dataKey="ego" name="EGO" fill="#10B981" fillOpacity={0.8} />
                          </BarChart>
                        </div>
                      </Card>
                    </div>

                    <div className="mt-4 space-y-4">
                      {(() => {
                        const cargosUnicos = Array.from(new Set(jornadasCalculadas.map((j) => j.cargoEmpleado || "Sin Cargo"))).filter(Boolean);
                        const tieneMultiplesCargos = cargosUnicos.length > 1;

                        const agrupadoPorCargo = new Map<string, Map<string, JornadaDia[]>>();
                        jornadasCalculadas.forEach((j) => {
                          const cargo = j.cargoEmpleado || "Sin Cargo";
                          if (!agrupadoPorCargo.has(cargo)) {
                            agrupadoPorCargo.set(cargo, new Map());
                          }
                          const porOperador = agrupadoPorCargo.get(cargo)!;
                          if (!porOperador.has(j.codEmpleado)) {
                            porOperador.set(j.codEmpleado, []);
                          }
                          porOperador.get(j.codEmpleado)!.push(j);
                        });

                        let totalGlobalHorasNetas = 0;
                        let totalGlobalHorasSTD = 0;
                        let totalGlobalUnidades = 0;
                        let totalGlobalDefectos = 0;
                        let totalGlobalHorasDescontar = 0;

                        if (tieneMultiplesCargos) {
                          const elementos: JSX.Element[] = [];

                          agrupadoPorCargo.forEach((porOperador, cargo) => {
                            let totalCargoHorasNetas = 0;
                            let totalCargoHorasSTD = 0;
                            let totalCargoUnidades = 0;
                            let totalCargoDefectos = 0;
                            let totalCargoHorasDescontar = 0;

                            porOperador.forEach((jornadas, codEmpleado) => {
                              // Calcular horas desde jornadas
                              jornadas.forEach((j) => {
                                totalCargoHorasNetas += j.horasNetas;
                                totalCargoHorasSTD += (j.totalTiempoSTD ?? 0);
                                totalCargoHorasDescontar += (j.horasDescontar || 0);
                              });
                              
                              // Unidades y defectos desde productividadPorOperador (fuente de la verdad)
                              const prodData = productividadPorOperador.get(String(codEmpleado));
                              if (prodData && prodData.length > 0) {
                                totalCargoUnidades += prodData.reduce((s, d) => s + (d.TotalCantidad || 0), 0);
                                totalCargoDefectos += prodData.reduce((s, d) => s + (d.TotalDefectos || 0), 0);
                              } else {
                                totalCargoUnidades += jornadas.reduce((s, j) => s + (j.totalCantidad ?? 0), 0);
                                totalCargoDefectos += jornadas.reduce((s, j) => s + (j.totalDefectos ?? 0), 0);
                              }
                            });

                            totalGlobalHorasNetas += totalCargoHorasNetas;
                            totalGlobalHorasSTD += totalCargoHorasSTD;
                            totalGlobalUnidades += totalCargoUnidades;
                            totalGlobalDefectos += totalCargoDefectos;
                            totalGlobalHorasDescontar += totalCargoHorasDescontar;

                            const horasTeoricasCargo = totalCargoHorasNetas - (totalCargoHorasNetas * 0.13) - totalCargoHorasDescontar;
                            const productividadCargo = horasTeoricasCargo > 0 ? (totalCargoHorasSTD / horasTeoricasCargo) * 100 : 0;
                            const calidadCargo = totalCargoUnidades > 0 ? (1 - totalCargoDefectos / totalCargoUnidades) * 100 : 0;
                            const egoCargo = productividadCargo * calidadCargo / 100;

                            elementos.push(
                              <Accordion type="single" collapsible key={`cargo-${cargo}`}>
                                <AccordionItem value={`cargo-${cargo}`}>
                                  <AccordionTrigger className="px-4 py-3 bg-primary/5 hover:bg-primary/10 rounded-xl border border-border">
                                    <div className="flex items-center justify-between w-full pr-4">
                                      <div className="flex items-center gap-3">
                                        <div className="rounded-full bg-primary/20 px-3 py-1">
                                          <span className="text-sm font-semibold text-primary">{cargo}</span>
                                        </div>
                                        <span className="text-xs text-muted-foreground">{porOperador.size} operador(es)</span>
                                      </div>
                                      <div className="flex gap-6 text-right">
                                        <div>
                                          <p className="text-[10px] text-muted-foreground">Hrs Netas</p>
                                          <p className="font-semibold text-foreground">{totalCargoHorasNetas.toFixed(2)}</p>
                                        </div>
                                        <div>
                                          <p className="text-[10px] text-muted-foreground">EGO</p>
                                          <p className="font-semibold text-foreground">{egoCargo.toFixed(2)}%</p>
                                        </div>
                                        <div>
                                          <p className="text-[10px] text-muted-foreground">Productividad</p>
                                          <p className="font-semibold text-foreground">{productividadCargo.toFixed(2)}%</p>
                                        </div>
                                      </div>
                                    </div>
                                  </AccordionTrigger>
                                  <AccordionContent>
                                    <div className="p-3 space-y-3">
                                      <Card className="rounded-xl border border-border bg-white p-3 shadow-sm">
                                        <div className="mb-2 flex items-center justify-between">
                                          <p className="text-xs uppercase tracking-[0.1em] text-muted-foreground">EGO y Productividad por Operador</p>
                                          <div className="flex gap-4 text-xs">
                                            <span className="text-muted-foreground">Total Unidades:</span>
                                            <span className="font-semibold text-foreground">{totalCargoUnidades.toLocaleString()}</span>
                                            <span className="text-muted-foreground">EGO Cargo:</span>
                                            <span className="font-semibold text-foreground">{egoCargo.toFixed(2)}%</span>
                                            <span className="text-muted-foreground">Productividad:</span>
                                            <span className="font-semibold text-foreground">{productividadCargo.toFixed(2)}%</span>
                                          </div>
                                        </div>
                                        {(() => {
                                          const chartData: {name: string; nameFull: string; productividad: number; ego: number}[] = [];
                                          porOperador.forEach((jornadas, codEmpleado) => {
                                            const totalHorasNetas = jornadas.reduce((sum, j) => sum + j.horasNetas, 0);
                                            const totalA = jornadas.reduce((sum, j) => sum + j.horasNetas * 0.13, 0);
                                            const totalHorasSTD = jornadas.reduce((sum, j) => sum + (j.totalTiempoSTD ?? 0), 0);
                                            const totalHorasDescontar = jornadas.reduce((sum, j) => sum + (j.horasDescontar || 0), 0);
                                            const horasTeoricasEB = totalHorasNetas - totalA - totalHorasDescontar;
                                            const productividad = horasTeoricasEB > 0 ? (totalHorasSTD / horasTeoricasEB) * 100 : 0;
                                            
                                            // Unidades y defectos desde productividadPorOperador (fuente de la verdad)
                                            const prodData = productividadPorOperador.get(String(codEmpleado));
                                            let totalUnidades: number;
                                            let totalDefectos: number;
                                            if (prodData && prodData.length > 0) {
                                              totalUnidades = prodData.reduce((s, d) => s + (d.TotalCantidad || 0), 0);
                                              totalDefectos = prodData.reduce((s, d) => s + (d.TotalDefectos || 0), 0);
                                            } else {
                                              totalUnidades = jornadas.reduce((sum, j) => sum + (j.totalCantidad ?? 0), 0);
                                              totalDefectos = jornadas.reduce((sum, j) => sum + (j.totalDefectos ?? 0), 0);
                                            }
                                            
                                            const calidad = totalUnidades > 0 ? (1 - totalDefectos / totalUnidades) * 100 : 0;
                                            const ego = productividad * calidad / 100;
                                            const nombre = jornadas[0]?.nombreEmpleado ?? `Op. ${codEmpleado}`;
                                            chartData.push({ name: nombre.split(' ').map(n => n[0]).join('').substring(0, 4), nameFull: nombre, productividad, ego });
                                          });
                                          const sortedData = chartData.sort((a, b) => b.ego - a.ego);
                                          
                                          if (sortedData.length === 0) {
                                            return <p className="text-sm text-muted-foreground p-4">No hay datos para mostrar</p>;
                                          }

                                          return (
                                            <div className="w-full overflow-x-auto">
                                              <BarChart
                                                width={Math.max(sortedData.length * 100, 500)}
                                                height={300}
                                                data={sortedData}
                                                margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
                                              >
                                                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                                                <XAxis 
                                                  dataKey="name" 
                                                  tick={{ fontSize: 11, fill: '#666' }} 
                                                  interval={0} 
                                                  angle={-45} 
                                                  textAnchor="end" 
                                                  height={80}
                                                />
                                                <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => `${value}%`} />
                                                <Tooltip
                                                  labelFormatter={(_label, payload) => {
                                                    const item = payload?.[0]?.payload as { nameFull?: string } | undefined;
                                                    return item?.nameFull ?? "";
                                                  }}
                                                  formatter={(value: number | string, name: string) => [
                                                    `${Number(value).toFixed(2)}%`,
                                                    name,
                                                  ]}
                                                />
                                                <Legend wrapperStyle={{ paddingTop: '10px' }} />
                                                <Bar dataKey="productividad" name="Productividad" fill="#2563EB" />
                                                <Bar dataKey="ego" name="EGO" fill="#10B981" />
                                              </BarChart>
                                            </div>
                                          );
                                        })()}
                                      </Card>
                                      <OperadoresList
                                        operadores={Array.from(porOperador.entries()).map(([codEmpleado, jornadas]) =>
                                          normalizarOperadorResumen(codEmpleado, jornadas, productividadPorOperador)
                                        )}
                                      />
                                    </div>
                                  </AccordionContent>
                                </AccordionItem>
                              </Accordion>
                            );
                          });

                          const totalAGlobal = totalGlobalHorasNetas * 0.13;
                          const horasTeoricasGlobal = totalGlobalHorasNetas - totalAGlobal - totalGlobalHorasDescontar;
                          const productividadGlobal = horasTeoricasGlobal > 0 ? (totalGlobalHorasSTD / horasTeoricasGlobal) * 100 : 0;
                          const calidadGlobal = totalGlobalUnidades > 0 ? (1 - totalGlobalDefectos / totalGlobalUnidades) * 100 : 0;
                          const egoGlobal = productividadGlobal * calidadGlobal / 100;

                          elementos.push(
                            <Card key="resumen-global" className="overflow-hidden rounded-2xl border-2 border-primary bg-white p-4 shadow-sm">
                              <div className="mb-3 flex items-center justify-between">
                                <p className="text-base font-semibold text-foreground">Resumen Combinado - Todas los Cargos</p>
                                <svg width="140" height="80" viewBox="0 0 140 80" className="overflow-visible">
                                  <defs>
                                    <linearGradient id="gaugeGradientGlobal" x1="0%" y1="0%" x2="100%" y2="0%">
                                      <stop offset="0%" stopColor="#EF4444" />
                                      <stop offset="50%" stopColor="#EAB308" />
                                      <stop offset="100%" stopColor="#22C55E" />
                                    </linearGradient>
                                  </defs>
                                  <path d="M 15 70 A 55 55 0 0 1 125 70" fill="none" stroke="url(#gaugeGradientGlobal)" strokeWidth="10" strokeLinecap="round" />
                                  <path d="M 20 70 A 50 50 0 0 1 120 70" fill="none" stroke="#e5e5e5" strokeWidth="2" strokeLinecap="round" />
                                  {[0, 25, 50, 75, 100].map((mark) => {
                                    const angle = (mark / 100) * 180;
                                    const rad = (angle - 180) * (Math.PI / 180);
                                    const x1 = 70 + 42 * Math.cos(rad);
                                    const y1 = 70 + 42 * Math.sin(rad);
                                    const x2 = 70 + 50 * Math.cos(rad);
                                    const y2 = 70 + 50 * Math.sin(rad);
                                    return <line key={mark} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#666" strokeWidth="1.5" />;
                                  })}
                                  {(() => {
                                    const angle = (Math.min(100, Math.max(0, egoGlobal)) / 100) * 180;
                                    const rad = (angle - 180) * (Math.PI / 180);
                                    const needleX = 70 + 38 * Math.cos(rad);
                                    const needleY = 70 + 38 * Math.sin(rad);
                                    return <line key="needle" x1="70" y1="70" x2={needleX} y2={needleY} stroke="#1f2937" strokeWidth="3" strokeLinecap="round" />;
                                  })()}
                                  <circle cx="70" cy="70" r="4" fill="#1f2937" />
                                  <text x="70" y="58" textAnchor="middle" className="text-[10px] fill-gray-500">EGO</text>
                                  <text x="70" y="48" textAnchor="middle" className="text-sm font-bold fill-gray-900">{egoGlobal.toFixed(0)}%</text>
                                </svg>
                              </div>
                              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                                <div className="rounded-xl border border-border/80 bg-muted/50 p-3">
                                  <p className="text-[10px] uppercase text-muted-foreground">Promedio EGO</p>
                                  <p className="mt-1 text-xl font-semibold text-foreground">{egoGlobal.toFixed(2)}%</p>
                                </div>
                                <div className="rounded-xl border border-border/80 bg-muted/50 p-3">
                                  <p className="text-[10px] uppercase text-muted-foreground">Promedio Productividad</p>
                                  <p className="mt-1 text-xl font-semibold text-foreground">{productividadGlobal.toFixed(2)}%</p>
                                </div>
                                <div className="rounded-xl border border-border/80 bg-muted/50 p-3">
                                  <p className="text-[10px] uppercase text-muted-foreground">Defectos Totales</p>
                                  <p className="mt-1 text-xl font-semibold text-foreground">{totalGlobalDefectos}</p>
                                </div>
                                <div className="rounded-xl border border-border/80 bg-muted/50 p-3">
                                  <p className="text-[10px] uppercase text-muted-foreground">Hrs Netas Totales</p>
                                  <p className="mt-1 text-xl font-semibold text-foreground">{totalGlobalHorasNetas.toFixed(2)}</p>
                                </div>
                              </div>
                            </Card>
                          );

                          return elementos;
                        } else {
                          const elementos: JSX.Element[] = [];
                          const operadoresParaLista: OperadorResumen[] = [];

                          agrupadoPorCargo.forEach((porOperador) => {
                            porOperador.forEach((jornadas, codEmpleado) => {
                              const resumen = normalizarOperadorResumen(codEmpleado, jornadas, productividadPorOperador);
                              totalGlobalHorasNetas += resumen.totalHorasNetas;
                              totalGlobalHorasSTD += resumen.totalHorasSTD;
                              totalGlobalUnidades += resumen.totalUnidades;
                              totalGlobalDefectos += resumen.totalDefectos;
                              totalGlobalHorasDescontar += resumen.totalHorasDescontar;
                              operadoresParaLista.push(resumen);
                            });
                          });

                          elementos.push(<OperadoresList key="lista-operadores" operadores={operadoresParaLista} />);

                          const totalAGlobal = totalGlobalHorasNetas * 0.13;
                          const horasTeoricasGlobal = totalGlobalHorasNetas - totalAGlobal - totalGlobalHorasDescontar;
                          const productividadGlobal = horasTeoricasGlobal > 0 ? (totalGlobalHorasSTD / horasTeoricasGlobal) * 100 : 0;
                          const calidadGlobal = totalGlobalUnidades > 0 ? (1 - totalGlobalDefectos / totalGlobalUnidades) * 100 : 0;
                          const egoGlobal = productividadGlobal * calidadGlobal / 100;

                          elementos.push(
                            <Card key="resumen-global" className="overflow-hidden rounded-2xl border-2 border-primary bg-white p-4 shadow-sm">
                              <div className="mb-3 flex items-center justify-between">
                                <p className="text-base font-semibold text-foreground">Resumen Combinado</p>
                                <svg width="140" height="80" viewBox="0 0 140 80" className="overflow-visible">
                                  <defs>
                                    <linearGradient id="gaugeGradientGlobal2" x1="0%" y1="0%" x2="100%" y2="0%">
                                      <stop offset="0%" stopColor="#EF4444" />
                                      <stop offset="50%" stopColor="#EAB308" />
                                      <stop offset="100%" stopColor="#22C55E" />
                                    </linearGradient>
                                  </defs>
                                  <path d="M 15 70 A 55 55 0 0 1 125 70" fill="none" stroke="url(#gaugeGradientGlobal2)" strokeWidth="10" strokeLinecap="round" />
                                  <path d="M 20 70 A 50 50 0 0 1 120 70" fill="none" stroke="#e5e5e5" strokeWidth="2" strokeLinecap="round" />
                                  {[0, 25, 50, 75, 100].map((mark) => {
                                    const angle = (mark / 100) * 180;
                                    const rad = (angle - 180) * (Math.PI / 180);
                                    const x1 = 70 + 42 * Math.cos(rad);
                                    const y1 = 70 + 42 * Math.sin(rad);
                                    const x2 = 70 + 50 * Math.cos(rad);
                                    const y2 = 70 + 50 * Math.sin(rad);
                                    return <line key={mark} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#666" strokeWidth="1.5" />;
                                  })}
                                  {(() => {
                                    const angle = (Math.min(100, Math.max(0, egoGlobal)) / 100) * 180;
                                    const rad = (angle - 180) * (Math.PI / 180);
                                    const needleX = 70 + 38 * Math.cos(rad);
                                    const needleY = 70 + 38 * Math.sin(rad);
                                    return <line key="needle" x1="70" y1="70" x2={needleX} y2={needleY} stroke="#1f2937" strokeWidth="3" strokeLinecap="round" />;
                                  })()}
                                  <circle cx="70" cy="70" r="4" fill="#1f2937" />
                                  <text x="70" y="58" textAnchor="middle" className="text-[10px] fill-gray-500">EGO</text>
                                  <text x="70" y="48" textAnchor="middle" className="text-sm font-bold fill-gray-900">{egoGlobal.toFixed(0)}%</text>
                                </svg>
                              </div>
                              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                                <div className="rounded-xl border border-border/80 bg-muted/50 p-3">
                                  <p className="text-[10px] uppercase text-muted-foreground">Promedio EGO</p>
                                  <p className="mt-1 text-xl font-semibold text-foreground">{egoGlobal.toFixed(2)}%</p>
                                </div>
                                <div className="rounded-xl border border-border/80 bg-muted/50 p-3">
                                  <p className="text-[10px] uppercase text-muted-foreground">Promedio Productividad</p>
                                  <p className="mt-1 text-xl font-semibold text-foreground">{productividadGlobal.toFixed(2)}%</p>
                                </div>
                                <div className="rounded-xl border border-border/80 bg-muted/50 p-3">
                                  <p className="text-[10px] uppercase text-muted-foreground">Defectos Totales</p>
                                  <p className="mt-1 text-xl font-semibold text-foreground">{totalGlobalDefectos}</p>
                                </div>
                                <div className="rounded-xl border border-border/80 bg-muted/50 p-3">
                                  <p className="text-[10px] uppercase text-muted-foreground">Hrs Netas Totales</p>
                                  <p className="mt-1 text-xl font-semibold text-foreground">{totalGlobalHorasNetas.toFixed(2)}</p>
                                </div>
                              </div>
                            </Card>
                          );

                          return elementos;
                        }
                      })()}
                    </div>
                    </>
                )}

                {!loadingConsulta && jornadasCalculadas.length === 0 && (
                  <p className="mt-4 text-sm text-muted-foreground">Presiona Consultar para cargar los datos.</p>
                )}
              </section>
            )}
          </div>
        )}
      </CardContent>


    </Card>
  );
}
