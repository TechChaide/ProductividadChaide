"use client";

/**
 * Paso 6 del wizard de muestreos: Captura final.
 *
 * Este paso renderiza el formulario final que el inspector llena. Tiene
 * dos bloques:
 *
 *   1. PARTE FIJA
 *      Campos obligatorios de la tabla `registro` (modelo de datos).
 *      El usuario edita los que apliquen: departamento, motivo, origen,
 *      componente, causa_defecto, máquina. Los demás campos (regional,
 *      fecha, código de empleado, año/mes/día/hora) se autocompletan
 *      con valores del usuario logueado y la fecha actual.
 *
 *   2. PARTE DINÁMICA
 *      Una fila de input por cada columna de la tabla virtual
 *      (`Asociacion`) devuelta por el endpoint
 *      `getTablaByAreaTipoMotivo(atm, componente)`. La `etiqueta` de la
 *      asociación se usa como label del input. El valor capturado se
 *      enviará luego como un `Detalle` (uno por columna).
 *
 * La pantalla NO envía datos a ningún backend todavía: el submit vive
 * en el padre (`page.tsx`) y aquí solo exponemos los valores capturados
 * mediante `onChange`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  DndContext,
  type DragEndEvent,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  AlertCircle,
  CalendarClock,
  Database,
  GripVertical,
  Hourglass,
  IdCard,
  ListTree,
  Loader2,
  Lock,
  LockKeyhole,
  Pause,
  Play,
  Plus,
  QrCode,
  Save,
  Search,
  Sparkles,
  StopCircle,
  Timer,
  Trash2,
  Type,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateForSQLServer } from "@/lib/integrations/muestreos-ddpp/datetime2";
import { matchUsuarioByDepartamento } from "@/lib/integrations/muestreos-ddpp/resolve-area-departamento";
import { useCapturaCatalogos } from "@/hooks/integrations/muestreos-ddpp/use-captura-catalogos";
import {
  COMODIN_NA,
  MATERIAL_NO_APLICA,
  necesitaPedido,
  resolveComodinCaptura,
  valorComodinParaPayload,
  valorPedidoParaPayload,
} from "@/lib/integrations/muestreos-ddpp/comodin-captura";
import { useSyncRegistroUnidades } from "@/hooks/integrations/muestreos-ddpp/use-sync-registro-unidades";
import RegistroUnidadesOculto from "@/components/integrations/muestreos-ddpp/shared/registro-unidades-oculto";
import UserAutocomplete from "@/components/integrations/muestreos-ddpp/shared/user-autocomplete";
import CatalogSelect from "@/components/integrations/muestreos-ddpp/shared/catalog-select";
import MaterialAutocomplete from "@/components/integrations/muestreos-ddpp/shared/material-autocomplete";
import { useToast } from "@/hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  AreaTipoMotivo,
  Asociacion,
  FichaSocialHistorica,
  OrdenesTrabajadas,
  Subcomponentes,
} from "@/types/integrations/muestreos-ddpp";
import { asociacionService } from "@/services/integrations/muestreos-ddpp/asociacion.service";
import { filterAsociacionesPorTipoMedicion } from "@/lib/integrations/muestreos-ddpp/tipo-medicion-tabla";
import { subcomponentesService } from "@/services/integrations/muestreos-ddpp/subcomponentes.service";
import { elementoAsociacionService } from "@/services/integrations/muestreos-ddpp/elementoAsociacion.service";
import { registroService } from "@/services/integrations/muestreos-ddpp/registro.service";
import { registroCausaDefectoService } from "@/services/integrations/muestreos-ddpp/registroCausaDefecto.service";
import { detalleService } from "@/services/integrations/muestreos-ddpp/detalle.service";
import { areaTipoMotivoService } from "@/services/integrations/muestreos-ddpp/areaTipoMotivo.service";
import { serviciosMuestreosService } from "@/services/integrations/muestreos-ddpp/serviciosMuestreos.service"; 
import {
  procesoRutaParcialStorage as defectRutaParcialStorage,
  procesoRutaStorage as defectRutaStorage,
} from "./captura-storage";
import { getCodigoEmpleadoSesion, getStoredUser } from "@/lib/integrations/muestreos-ddpp/session-storage";
import type { MuestreoTablaVirtual } from "@/types/integrations/muestreos-ddpp";
import ScannerPanel from "@/components/integrations/muestreos-ddpp/shared/scanner-panel";

/**
 * Tipos de dato soportados por `ElementoAsociacion.data_type`.
 * Coinciden con los valores que el backend puede devolver.
 * - "string"  → texto libre (default).
 * - "number"  → numérico (entero o decimal). El input se renderiza como
 *                `type="number"` y se valida antes de enviar.
 * - "boolean" → checkbox / switch (true/false).
 */
type ColumnDataType = "string" | "number" | "boolean";

/**
 * Mapa `codigo_asociacion → data_type` para las columnas activas.
 * Se llena consultando `elementoAsociacionService.getById(...)` por cada
 * `codigo_elemento_asociacion` de la tabla dinámica. Si el endpoint no
 * devuelve `data_type`, asumimos "string" (defensa por compatibilidad).
 */
type DataTypeByColumn = Record<number, ColumnDataType>;

/** Estado de la parte fija que el usuario edita. */
export interface FixedFields {
  departamento: string;
  motivo: string;
  origen: string;
  componente: string;
  causa_defecto: string;
  /**
   * Unidades. Por defecto `0`; al guardar debe ser un número ≥ 0.
   * Se persiste como `Registro.cantidad` (VARCHAR).
   */
  cantidad: string;
  /**
   * Unidad de medida del componente (catálogo). Oculto en UI; opcional
   * en `Registro.unidades`.
   */
  unidades: string;
  /**
   * Código de empleado de la captura. Opcional: si va vacío se persiste
   * el `codigo_empleado` de quien crea el registro.
   */
  codigo_empleado: string;
  /** Máquina. Si el usuario no elige, se persiste `N.A.`. */
  maquina: string;
  /** Material / orden / ticket / escaneo → `Registro.material`. */
  material?: string;
  /** Proveedor, tienda, cliente, etc. → `Registro.comodin`. */
  comodin?: string;
  /**
   * Número de pedido (GESTIÓN ADM. DISTRI.) → `Registro.pedido`. Campo
   * propio, independiente de `comodin`/`material`.
   */
  pedido?: string;
  /**
   * Tiempo total (en segundos) que tardó el inspector en hacer la
   * inspección. Se persiste en `registro.tiempo`. Solo se rellena
   * después de pulsar PARAR.
   */
  tiempo?: number;
}

/** Estado de la parte dinámica: un valor por cada columna (una muestra). */
export type DynamicValues = Record<number, string>;

/** Payload consolidado que el padre (page.tsx) necesita para el POST. */
export interface CapturaData {
  fixed: FixedFields;
  /** Una entrada por cada muestra capturada. */
  muestras: DynamicValues[];
  /**
   * Orden de trabajo seleccionada cuando el ATM es de tipo_fuente = CONSULTA.
   * Es `null` para MANUAL / ESCANEO. La fila completa se persiste en
   * `Registro.origen` (campo `origen`) y la fila del detalle lleva el
   * `NUM_ORDEN` que el usuario eligió.
   */
  ordenSeleccionada: SelectedOrdenConsulta | null;
  /** Metadatos para auditoría local */
  meta: {
    regional: string;
    codigoEmpleado: string;
    fechaCaptura: string; // ISO
  };
}

/**
 * Fila que el inspector eligió de la tabla devuelta por
 * `getInformacionOrdenesByResponsblesYCaso`. Conservamos la fila completa
 * para auditoría y solo guardamos `numOrden` en `Registro.origen`.
 */
export interface SelectedOrdenConsulta {
  /** PK funcional de la orden (viene del backend como NUM_ORDEN). */
  numOrden: string;
  /** Fila completa tal como la devolvió el SP, por si el padre la quiere loguear. */
  fila: OrdenesTrabajadas;
}

interface Step5CapturarMuestreoProps {
  /** Combinación área+motivo (ATM) ya seleccionada. */
  codigoAreaTipoMotivo: number | null;
  /** Componente seleccionado en el paso 3. */
  codigoComponente: number | null;
  /**
   * Tipo de medición elegido tras la causa (si el componente tiene
   * varias tablas). Filtra las asociaciones de captura.
   */
  codigoTipoMedicion?: number | null;
  /** Responsables del área (`area.respCtrlProd`), ya separados por coma/&/o. */
  responsables?: string | null;
  /**
   * Si es `false`, deshabilita por completo la función de "órdenes
   * disponibles" (CONSULTA/ESCANEO): no se resuelve el AreaTipoMotivo, no
   * se llama al SP de órdenes, ni se muestra el card ni el scanner de
   * fuente. Usado por Muestreos operador, donde esto no aplica.
   * @default true
   */
  ordenesConsultaHabilitadas?: boolean;
  /** Nombres ya conocidos — autocompletan la parte fija como defaults. */
  defaults: {
    departamento?: string;
    motivo?: string;
    origen?: string;
    componente?: string;
    causa_defecto?: string;
    regional?: string;
  };
  /** Fila consolidada del paso 4 (MuestreoTablaVirtual). */
  filaConsolidada?: MuestreoTablaVirtual | null;
  /** Notifica al padre los valores actuales (para habilitar submit). */
  onChange?: (data: CapturaData) => void;
  stepHint?: string;
  title?: string;
  /** Autocomplete de empleados filtrado por departamento (vista /captura). */
  empleadoAutocomplete?: boolean;
  /** Nombre del origen de la semiruta; cruza con DEPARTAMENTO de la ficha. */
  departamentoEmpleadoFilter?: string;
  /** Unidades del catálogo de componentes (si ya se conocen al abrir captura). */
  unidadesComponente?: string;
}

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/**
 * Lista de campos de `OrdenesTrabajadas` que se muestran en el card de
 * detalle y que pueden arrastrarse a los inputs "Máquina" o
 * "Código Escaneado" de la parte fija.
 *
 * IMPORTANTE: el `key` es la propiedad REAL del objeto que devolvió el SP,
 * para que al hacer drop podamos extraer su valor exacto.
 *
 * `NUM_ORDEN` (PK de la orden) se incluye al inicio porque es justamente
 * el valor más útil para arrastrar al campo "Código Escaneado" — coincide
 * 1:1 con el identificador funcional de la orden.
 */
const ordenFields: Array<{ key: keyof OrdenesTrabajadas; label: string }> = [
  { key: "NUM_ORDEN", label: "Núm. orden" },
  { key: "Material", label: "Material" },
  { key: "Descripcion", label: "Descripción" },
  { key: "CODIGO_EMP", label: "Cód. empleado" },
  { key: "MAQUINA", label: "Máquina" },
  { key: "FECHA_HORA_UNIFICADA", label: "Fecha / hora" },
];

/**
 * Identificador del evento que `@dnd-kit/core` emite cuando se suelta
 * un campo del card sobre uno de los inputs. Lo centralizamos para que
 * `DraggableField` y `DndContext.onDragEnd` se refieran al mismo origen.
 */
const DRAG_PREFIX = "orden";

/* ============================================================================
 *  Partículas de “estrellitas” al hacer drop exitoso
 *  ============================================================================
 *  Cuando el inspector suelta un campo sobre Máquina / Código Escaneado,
 *  disparamos un burst radial de partículas que salen del centro del
 *  input hacia afuera, con colores variados (azul / verde / ámbar) y un
 *  pequeño desfase temporal entre ellas para que parezca un “confeti”
 *  elegante. Duran ~700ms y se desvanecen automáticamente.
 *
 *  Cada partícula se renderiza como un `<div>` absolutamente posicionado
 *  sobre el input destino. El movimiento lo hace un `@keyframes` inline
 *  que se inyecta UNA sola vez (cuando hay partículas activas) para no
 *  contaminar el bundle global.
 * ========================================================================== */

/** Una partícula individual: posición, ángulo, color, duración, retraso. */
interface DropParticle {
  id: number;
  /** Ángulo en radianes desde el cual sale del centro. */
  angle: number;
  /** Distancia (px) a la que viaja antes de desvanecerse. */
  distance: number;
  /** Tamaño en px. */
  size: number;
  /** Color del “sparkle” (azul, verde, ámbar, blanco). */
  color: string;
  /** Duración total de la animación (ms). */
  duration: number;
  /** Retraso antes de empezar (ms) — para el efecto escalonado. */
  delay: number;
  /** Campo destino al que pertenece (para limpieza). */
  target: "maquina" | "material";
}

/**
 * Colores posibles para las partículas. Se eligen al azar en cada burst
 * para que cada drop se sienta único.
 */
const PARTICLE_COLORS = [
  "rgb(59, 130, 246)",   // azul primary
  "rgb(34, 197, 94)",    // verde (éxito)
  "rgb(251, 191, 36)",   // ámbar
  "rgb(244, 114, 182)",  // rosa accent
  "rgb(255, 255, 255)",  // blanco brillante
] as const;

/**
 * Crea un burst de partículas centrado en el input destino.
 * Llamamos a esta función desde `handleDragEndOrden` justo después de
 * setear `fixed` y `dropHighlight`.
 */
const PARTICLE_COUNT = 12;
function makeBurst(target: "maquina" | "material"): DropParticle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => {
    // Distribuimos las partículas en círculo, con un pequeño jitter para
    // que no queden perfectamente equidistantes (más natural).
    const baseAngle = (i / PARTICLE_COUNT) * Math.PI * 2;
    const jitter = (Math.random() - 0.5) * 0.4;
    return {
      id: Date.now() + i,
      angle: baseAngle + jitter,
      distance: 36 + Math.random() * 28,         // 36–64 px
      size: 4 + Math.random() * 4,               // 4–8 px
      color:
        PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
      duration: 500 + Math.random() * 250,       // 500–750 ms
      delay: Math.random() * 60,                 // 0–60 ms escalonado
      target,
    };
  });
}

/** Lee el `codigo_empleado` de la sesión embebida (namespaced, ver session-storage.ts). */
function getCodigoEmpleado(): string {
  return getCodigoEmpleadoSesion();
}

const MAQUINA_SIN_SELECCION = "N.A.";

/** Cantidad válida para guardar: número finito ≥ 0 (incluye 0). */
function parseCantidadNoNegativa(raw: string | undefined): number | null {
  const s = String(raw ?? "").trim().replace(",", ".") || "0";
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/** Lee cualquier dato de la sesión embebida (regional, etc.). */
function getUserContext(): { regional: string; codigo_empleado: string } {
  const user = getStoredUser();
  return {
    regional: String(user?.regional ?? ""),
    codigo_empleado: String(user?.codigo_empleado ?? ""),
  };
}

export default function Step5CapturarMuestreo({
  codigoAreaTipoMotivo,
  codigoComponente,
  codigoTipoMedicion = null,
  responsables,
  ordenesConsultaHabilitadas = true,
  defaults,
  filaConsolidada,
  onChange,
  stepHint = "Paso 7 de 7",
  title = "Captura del Defecto",
  empleadoAutocomplete = false,
  departamentoEmpleadoFilter,
  unidadesComponente,
}: Step5CapturarMuestreoProps) {
  const { toast } = useToast();

  const filterEmpleado = useCallback(
    (user: FichaSocialHistorica) =>
      matchUsuarioByDepartamento(user, departamentoEmpleadoFilter),
    [departamentoEmpleadoFilter],
  );

  // ===== Flag de hidratación =====
  /**
   * `false` durante el primer render (SSR + primer paint del cliente).
   * `true` después del primer `useEffect`, garantizando que cualquier
   * valor dependiente de `window`/`Date.now()` solo se muestre una vez
   * que React ya hidrató el árbol. Esto evita el warning de
   * "Hydration mismatch" en:
   *   - meta.fechaCaptura (reloj en vivo)
   *   - meta.codigoEmpleado / meta.regional (localStorage)
   *   - cronometroLegible (si se persistiera entre sesiones)
   */
  const [mounted, setMounted] = useState(false);

  // ===== Estado de carga: tabla dinámica =====
  const [asociaciones, setAsociaciones] = useState<Asociacion[]>([]);
  const [isLoadingTabla, setIsLoadingTabla] = useState(true);
  const [errorTabla, setErrorTabla] = useState<string | null>(null);

  // ===== data_type por columna (ElementoAsociacion) =====
  // Se llena después de cargar la tabla dinámica. Mientras se carga,
  // asumimos "string" (comportamiento permisivo, luego se sobreescribe).
  const [dataTypeByColumn, setDataTypeByColumn] = useState<DataTypeByColumn>(
    {}
  );
  const [dataTypeLoading, setDataTypeLoading] = useState<Record<number, boolean>>(
    {}
  );

  // ===== Fuente de datos del ATM (CONSULTA / MANUAL / ESCANEO) =====
  /**
   * Se carga UNA vez al montar el paso 5:
   *   1. Lee `codigo_area_tipo_motivo` de sessionStorage (lo guardó el paso 2).
   *   2. Llama a `areaTipoMotivoService.getById(...)` para obtener el registro
   *      completo del ATM (incluye `tipo_fuente` y `caso`).
   *   3. Si `tipo_fuente === "CONSULTA"`, dispara
   *      `getInformacionOrdenesByResponsblesYCaso(caso, responsables)` para
   *      poblar la tabla con radios.
   *
   * MANUAL / ESCANEO → no se llama al SP de órdenes y se renderiza la UI
   * habitual (sin bloque de selección de orden).
   */
  const [atmFuente, setAtmFuente] = useState<AreaTipoMotivo | null>(null);
  const [ordenes, setOrdenes] = useState<OrdenesTrabajadas[]>([]);
  const [selectedOrden, setSelectedOrden] = useState<SelectedOrdenConsulta | null>(
    null
  );
  const [isLoadingFuente, setIsLoadingFuente] = useState(false);
  const [errorFuente, setErrorFuente] = useState<string | null>(null);

  // ===== Filtro + paginación de la tabla CONSULTA =====
  /**
   * Mismo patrón que `areas/table.tsx` y `Tmotivos/table.tsx`:
   *   - `filter`: búsqueda case-insensitive sobre Material / NUM_ORDEN /
   *     Descripcion (los criterios que pidió el usuario).
   *   - `page` + `rowsPerPage`: controlan la paginación.
   *   - Los derivados (`filteredOrdenes`, `paginatedOrdenes`, totales)
   *     son `useMemo` para evitar recalcular en cada render.
   */
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  const PAGE_SIZE_OPTIONS = [5, 10, 15, 25];

  const filteredOrdenes = useMemo(() => {
    if (!filter.trim()) return ordenes;
    const f = filter.toLowerCase();
    return ordenes.filter((o) => {
      const numOrden = String(o.NUM_ORDEN ?? "").toLowerCase();
      const material = String(o.Material ?? "").toLowerCase();
      const descripcion = String(o.Descripcion ?? "").toLowerCase();
      return (
        numOrden.includes(f) ||
        material.includes(f) ||
        descripcion.includes(f)
      );
    });
  }, [ordenes, filter]);

  const totalRows = filteredOrdenes.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / rowsPerPage));
  useEffect(() => {
    if (page > totalPages && totalPages > 0) setPage(totalPages);
  }, [page, totalPages]);

  const paginatedOrdenes = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filteredOrdenes.slice(start, start + rowsPerPage);
  }, [filteredOrdenes, page, rowsPerPage]);

  // ===== Subcomponentes por columna dinámica =====
  /**
   * Mapa `codigo_elemento_asociacion → Subcomponentes[]`.
   * Cada columna dinámica consulta sus subcomponentes. Si la lista está
   * vacía o falla, se renderiza un <Input>. Si tiene elementos, se
   * renderiza un <Select> con la descripción como opción visible y el
   * `codigo_subcomponente` como valor.
   */
  const [subcomponentesByColumna, setSubcomponentesByColumna] = useState<
    Record<number, Subcomponentes[]>
  >({});
  const [subcomponentesLoading, setSubcomponentesLoading] = useState<
    Record<number, boolean>
  >({});

  // ===== Estado del formulario =====
  // Si llega la fila consolidada del paso 4, la usamos como fuente de verdad
  // para los campos derivados de la ruta (incluye `nombre_origen`).
  const filaParaDefaults: Partial<MuestreoTablaVirtual> =
    filaConsolidada ?? defectRutaStorage.get() ?? {};

  const [fixed, setFixed] = useState<FixedFields>({
    departamento: defaults.departamento ?? "",
    motivo: defaults.motivo ?? "",
    // El `origen` vive en la fila consolidada del paso 4 (campo
    // `nombre_origen`). Lo precargamos desde ahí y permitimos edición.
    origen:
      defaults.origen ??
      filaParaDefaults.nombre_origen ??
      "",
    componente: defaults.componente ?? "",
    causa_defecto: defaults.causa_defecto ?? "",
    cantidad: "0",
    unidades: "",
    codigo_empleado: "",
    maquina: "",
    material: "",
    comodin: COMODIN_NA,
    pedido: "",
  });

  const applyRegistroUnidades = useCallback((unidades: string) => {
    // eslint-disable-next-line no-console
    console.log("[step5] applyRegistroUnidades →", JSON.stringify(unidades));
    setFixed((prev) =>
      prev.unidades === unidades ? prev : { ...prev, unidades },
    );
  }, []);
  useSyncRegistroUnidades(
    codigoComponente,
    applyRegistroUnidades,
    unidadesComponente,
  );

  /** Array de muestras; cada elemento es un mapa codigo_asociacion→valor. */
  const [muestras, setMuestras] = useState<DynamicValues[]>([{}]);

  // ===== Cronómetro de inspección =====
  /**
   * Estados posibles:
   *   - "idle"    : todavía no se ha iniciado el muestreo (tabla dinámica bloqueada)
   *   - "running" : el inspector está capturando (tabla desbloqueada, cronómetro en vivo)
   *   - "stopped" : se detuvo el cronómetro (tabla bloqueada, `tiempo` finalizado)
   *
   * El cronómetro se modela como `inicioMs` (epoch ms cuando arrancó);
   * el `tiempo` final se calcula como `(now - inicioMs) / 1000`.
   */
  const [cronometro, setCronometro] = useState<
    "idle" | "running" | "stopped"
  >("idle");
  const [inicioMs, setInicioMs] = useState<number | null>(null);
  const [segundosTranscurridos, setSegundosTranscurridos] = useState(0);

  /**
   * `inicioRef` es la fuente de verdad consultada por el `setInterval`.
   * Lo usamos en lugar de `inicioMs` directamente para que el callback
   * del tick SIEMPRE vea el epoch ms actualizado aunque React batchee
   * múltiples `setState` en el mismo render (fix típico de closures
   * "stale" en `setInterval` con dependencias).
   */
  const inicioRef = useRef<number | null>(null);

  // ===== Tick del cronómetro (1s) mientras está corriendo =====
  useEffect(() => {
    if (cronometro !== "running" || inicioRef.current == null) return;

    // Sincronizamos el ref con el state al arrancar el tick. Esto cubre
    // el caso en que React aún no haya commiteado `inicioMs` al ref en
    // el mismo batch donde `cronometro` pasó a "running".
    if (inicioMs != null && inicioRef.current !== inicioMs) {
      inicioRef.current = inicioMs;
    }

    // Pintamos el primer segundo de inmediato para que el contador no
    // arranque en 00:00:00 hasta el segundo tick.
    const start = inicioRef.current;
    setSegundosTranscurridos(Math.floor((Date.now() - start) / 1000));

    const id = window.setInterval(() => {
      if (inicioRef.current == null) return;
      setSegundosTranscurridos(
        Math.floor((Date.now() - inicioRef.current) / 1000)
      );
    }, 1000);

    return () => window.clearInterval(id);
  }, [cronometro, inicioMs]);

  // ===== ¿La tabla dinámica está habilitada? Solo cuando el cronómetro corre. =====
  const tablaHabilitada = cronometro === "running";
  const tieneTablaDinamica = asociaciones.length > 0;
  const cantidadValida = parseCantidadNoNegativa(fixed.cantidad) != null;

  // ===== Metadatos automáticos =====
  const [meta, setMeta] = useState({
    regional: defaults.regional ?? "",
    codigoEmpleado: "",
    fechaCaptura: "",
  });

  // Hidratamos meta al montar: usuario + reloj en vivo (cada 1s).
  useEffect(() => {
    const user = getUserContext();
    setMeta((m) => ({
      ...m,
      regional: m.regional || user.regional,
      codigoEmpleado: user.codigo_empleado || getCodigoEmpleado(),
    }));
    const tick = () =>
      setMeta((m) => ({ ...m, fechaCaptura: formatDateForSQLServer() }));
    tick();
    const id = window.setInterval(tick, 1000);
    // Marcamos `mounted=true` ANTES del return: si va después, el
    // `return` sale de la función y `setMounted(true)` queda como
    // código muerto → `mounted` jamás cambia a `true` y los textos
    // dependientes de él se quedan en su valor "neutro".
    setMounted(true);
    return () => window.clearInterval(id);
  }, []);

  const {
    maquinaOptions,
    maquinasLoading,
    maquinaHint,
    comodinOptions,
    comodinLoading,
    comodinHint,
    buscarComodinCliente,
    esComodinBusquedaEnVivo,
    materialOptions,
    materialesLoading,
    materialHint,
    mostrarSelectorPedido,
    pedidoOptions,
    pedidoLoading,
    pedidoHint,
    buscarPedido,
  } = useCapturaCatalogos({
    enabled: empleadoAutocomplete,
    regional: meta.regional || defaults.regional || "",
    origen: defaults.origen || departamentoEmpleadoFilter || "",
    motivo: defaults.motivo || "",
    departamento: defaults.departamento || "",
    componente: defaults.componente || "",
    // Formulario unificado de captura (`procesos/captura`, vía este mismo
    // componente): único lugar donde las muletillas "tienda" y "cliente"
    // están habilitadas además de "proveedor". El campo "pedido" es
    // independiente (no es muletilla) y también solo se activa aquí.
    habilitarMuletillasExtendidas: true,
  });

  const comodinConfig = useMemo(
    () =>
      resolveComodinCaptura(
        defaults.motivo,
        defaults.origen || departamentoEmpleadoFilter,
        defaults.componente,
        { habilitarExtendidas: true },
      ),
    [
      defaults.motivo,
      defaults.origen,
      defaults.componente,
      departamentoEmpleadoFilter,
    ],
  );

  useEffect(() => {
    if (comodinConfig.tipo !== "none") return;
    setFixed((prev) =>
      prev.comodin === COMODIN_NA ? prev : { ...prev, comodin: COMODIN_NA },
    );
  }, [comodinConfig.tipo]);

  // GESTIÓN ADM. DISTRI.: usa el campo `pedido` dedicado (no material).
  // Material no aplica para este motivo, así que se fija en "NO" (no
  // editable) en vez de dejarse vacío.
  const requierePedido = necesitaPedido(defaults.motivo);
  useEffect(() => {
    if (!requierePedido) return;
    setFixed((prev) =>
      prev.material === MATERIAL_NO_APLICA
        ? prev
        : { ...prev, material: MATERIAL_NO_APLICA },
    );
  }, [requierePedido]);

  // ===== Helpers compartidos (declarados ANTES del useEffect que los usa) =====

  /**
   * `atmFuenteRef` es un espejo sincronizado del state `atmFuente`. Lo
   * necesitamos para que `handleScannerDetected` (un `useCallback` con
   * dependencias mínimas) pueda leer el ATM actual sin depender del
   * state — sin esto, el callback quedaría "stale" y no vería el ATM
   * recién cargado.
   */
  const atmFuenteRef = useRef<AreaTipoMotivo | null>(null);
  useEffect(() => {
    atmFuenteRef.current = atmFuente;
  }, [atmFuente]);

  /**
   * Llama al SP de órdenes con el `caso` del ATM. Se invoca desde dos
   * sitios:
   *   - `useEffect` de montaje: solo cuando `tipo_fuente === "CONSULTA"`.
   *   - `handleScannerDetected`: solo cuando `tipo_fuente === "ESCANEO"`,
   *     justo después de un escaneo exitoso del QR/código de barras.
   *
   * El `caso` se pasa TAL CUAL viene del backend: puede ser un número
   * ("1") o un texto viejo ("Producción forros"). El backend decide qué
   * hacer con cada formato.
   */
  const loadOrdenesPorCaso = useCallback(
    async (atm: AreaTipoMotivo | null, codigoEscaneado?: string) => {
      if (!atm) return;
      const caso = (atm.caso ?? "").toString().trim();
      if (!caso) {
        setErrorFuente(
          "El motivo configurado para esta área es de tipo CONSULTA / ESCANEO pero no tiene un `caso` asociado. Pídele al administrador que reconfigure la fuente de datos del motivo."
        );
        return;
      }
      if (!responsables || !responsables.trim()) {
        setErrorFuente(
          "El área seleccionada no tiene responsables de control de producción (`respCtrlProd`) configurados; no se pueden recuperar las órdenes a muestrear."
        );
        return;
      }
      // El tercer argumento del service es `Codigo` y SOLO aplica en modo
      // ESCANEO (es el valor decodificado del QR/código de barras). En
      // modo CONSULTA / MANUAL no se pasa el Codigo del lector: se envía
      // string vacío como valor neutro. Si el SP backend rechaza vacío,
      // habrá que pedirle al admin que ajuste el procedimiento.
      const codigoParaSP = (codigoEscaneado ?? "").trim();
      setIsLoadingFuente(true);
      setErrorFuente(null);
      try {
        const ordenesRes =
          await serviciosMuestreosService.getInformacionOrdenesByResponsblesYCaso(
            caso,
            responsables,
            codigoParaSP
          );
        const filas = ((ordenesRes.data ?? []) as OrdenesTrabajadas[]).filter(
          (o) => o && o.NUM_ORDEN
        );
        setOrdenes(filas);
        setSelectedOrden(null);
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : "No se pudo cargar la fuente de datos del motivo.";
        setErrorFuente(msg);
        setOrdenes([]);
        setSelectedOrden(null);
      } finally {
        setIsLoadingFuente(false);
      }
    },
    [responsables]
  );

  // ===== Cargar ATM y (si aplica) órdenes del SP de consulta =====
  /**
   * Resuelve la FK al AreaTipoMotivo:
   *   - Prioriza la prop `codigoAreaTipoMotivo` (la pasa page.tsx).
   *   - Si viene null, intenta leerla de `samplingRutaParcialStorage`
   *     (persistida en el paso 2). Esto cubre el caso de un reload que
   *     deja la pestaña en el paso 5 con la prop no inicializada.
   *   - Como defensa adicional, también acepta el `codigo_area_tipo_motivo`
   *     que viene dentro de la fila consolidada del paso 4.
   *
   * Una vez obtenido el ID, consulta `areaTipoMotivoService.getById(...)`.
   * Solo si el ATM es de `tipo_fuente === "CONSULTA"` se llama al SP
   * `getInformacionOrdenesByResponsblesYCaso(caso, responsables)`;
   * para `tipo_fuente === "ESCANEO"`, la llamada se difiere hasta que
   * el ScannerPanel emita un escaneo exitoso (ver handleScannerDetected).
   *
   * Se ejecuta UNA sola vez al montar; las dependencias son las FKs
   * (no los objetos derivados) para no entrar en bucles (ver nota
   * sobre ciclos data → callback → data en la memoria de usuario).
   */
  useEffect(() => {
    if (!ordenesConsultaHabilitadas) {
      setAtmFuente(null);
      setOrdenes([]);
      setSelectedOrden(null);
      return;
    }

    let cancelled = false;

    const loadAtmAndOrdenes = async () => {
      // 1) Resolver el ID del ATM (prop → sessionStorage → fila consolidada)
      const idFromProps = codigoAreaTipoMotivo;
      const idFromStorage = defectRutaParcialStorage.get()
        .codigo_area_tipo_motivo;
      const idFromFila = filaConsolidada?.codigo_area_tipo_motivo;
      const atmId =
        idFromProps ??
        (typeof idFromStorage === "number" ? idFromStorage : null) ??
        (typeof idFromFila === "number" ? idFromFila : null);

      if (atmId == null) {
        // No hay ATM resoluble → no mostramos la sección de fuente.
        // La UI existente (parte fija + dinámica) sigue funcionando.
        setAtmFuente(null);
        setOrdenes([]);
        setSelectedOrden(null);
        return;
      }

      setIsLoadingFuente(true);
      setErrorFuente(null);

      try {
        // 2) Cargar el AreaTipoMotivo (incluye tipo_fuente + caso)
        const atmRes = await areaTipoMotivoService.getById(atmId);
        if (cancelled) return;
        const atm = (atmRes.data ?? null) as AreaTipoMotivo | null;
        setAtmFuente(atm);

        // 3) Si NO es CONSULTA ni ESCANEO, salimos.
        //    MANUAL: el inspector llena la tabla a mano, no consultamos SP.
        //    CONSULTA / ESCANEO: ambos modos necesitan la lista de órdenes
        //    del SP, pero el momento de llamarlo es DISTINTO:
        //      - CONSULTA → automático al montar.
        //      - ESCANEO  → DESPUÉS de un escaneo exitoso (lo dispara
        //                   handleScannerDetected). NO aquí.
        const tipoFuente = atm?.tipo_fuente;
        const fuenteUpper = String(tipoFuente ?? "")
          .trim()
          .toUpperCase();
        if (
          !atm ||
          (fuenteUpper !== "CONSULTA" && fuenteUpper !== "ESCANEO")
        ) {
          setOrdenes([]);
          setSelectedOrden(null);
          return;
        }

        // 4) Solo CONSULTA consulta el SP al montar. ESCANEO espera al
        //    primer escaneo exitoso (ver handleScannerDetected).
        // `loadOrdenesPorCaso` ya gestiona su propio try/catch y los
        // estados isLoadingFuente/errorFuente/ordenes, así que aquí no
        // necesitamos envolverla en otro try.
        if (fuenteUpper === "CONSULTA") {
          await loadOrdenesPorCaso(atm);
        }
      } catch (err) {
        if (cancelled) return;
        const msg =
          err instanceof Error
            ? err.message
            : "No se pudo cargar el área-tipo-motivo.";
        setErrorFuente(msg);
        setAtmFuente(null);
        setOrdenes([]);
        setSelectedOrden(null);
      } finally {
        if (!cancelled) setIsLoadingFuente(false);
      }
    };

    loadAtmAndOrdenes();

    return () => {
      cancelled = true;
    };
    // Dependencias: solo los IDs/props que resuelven la FK, NO objetos
    // derivados (así evitamos el ciclo data → callback → data).
    // `loadOrdenesPorCaso` está memoizado con `useCallback` y solo
    // cambia si `responsables` cambia, por lo que añadirlo a las deps
    // NO introduce re-renders extra.
  }, [
    ordenesConsultaHabilitadas,
    codigoAreaTipoMotivo,
    responsables,
    filaConsolidada?.codigo_area_tipo_motivo,
    loadOrdenesPorCaso,
  ]);

  // ===== Cargar la tabla dinámica cuando entran los IDs =====
  useEffect(() => {
    let cancelled = false;
    const fetchTabla = async () => {
      if (
        codigoAreaTipoMotivo == null ||
        codigoComponente == null
      ) {
        setAsociaciones([]);
        setIsLoadingTabla(false);
        return;
      }
      setIsLoadingTabla(true);
      setErrorTabla(null);
      setAsociaciones([]);
      // Limpiamos subcomponentes previos al cambiar de combinación
      setSubcomponentesByColumna({});
      setSubcomponentesLoading({});
      try {
        const res = await asociacionService.getTablaByAreaTipoMotivo(
          codigoAreaTipoMotivo,
          codigoComponente
        );
        if (cancelled) return;
        // Filtramos por tipo de medición (si aplica) y versión vigente
        // de ese tipo, para no mezclar tablas del mismo componente.
        const filas = (res.data || []) as Asociacion[];
        const vigentes = filterAsociacionesPorTipoMedicion(
          filas,
          codigoTipoMedicion,
        );
        setAsociaciones(vigentes);
        // Inicializamos valores dinámicos vacíos para las nuevas columnas en cada muestra
        setMuestras((prev) =>
          prev.map((muestra) => {
            const next: DynamicValues = { ...muestra };
            for (const a of vigentes) {
              if (next[a.codigo_asociacion] == null) next[a.codigo_asociacion] = "";
            }
            return next;
          })
        );

        // ====== data_type por columna (ElementoAsociacion.getById) ======
        // Reseteamos y consultamos EN PARALELO el data_type de cada columna.
        // Mientras carga, `dataTypeByColumn[col]` no existirá → el render
        // asumirá "string" (defensa permisiva).
        setDataTypeByColumn({});
        const dataTypeLoadingInit: Record<number, boolean> = {};
        for (const a of vigentes) dataTypeLoadingInit[a.codigo_asociacion] = true;
        setDataTypeLoading(dataTypeLoadingInit);

        for (const a of vigentes) {
          if (cancelled) return;
          elementoAsociacionService
            .getById(a.codigo_elemento_asociacion)
            .then((eaRes) => {
              if (cancelled) return;
              const raw =
                (eaRes?.data?.data_type as string | undefined) ?? "string";
              const normalized = (raw.toLowerCase() as ColumnDataType);
              const dt: ColumnDataType =
                normalized === "number" || normalized === "boolean"
                  ? normalized
                  : "string";
              setDataTypeByColumn((m) => ({
                ...m,
                [a.codigo_asociacion]: dt,
              }));
            })
            .catch(() => {
              if (cancelled) return;
              // Fallo NO debe romper la captura: por defecto asumimos "string".
              setDataTypeByColumn((m) => ({
                ...m,
                [a.codigo_asociacion]: "string",
              }));
            })
            .finally(() => {
              if (cancelled) return;
              setDataTypeLoading((m) => ({
                ...m,
                [a.codigo_asociacion]: false,
              }));
            });
        }

        // ====== Subcomponentes por columna ======
        // Disparamos las consultas en paralelo para no bloquear el render.
        // Cada columna puede tener 0..N subcomponentes.
        for (const a of vigentes) {
          if (cancelled) return;
          setSubcomponentesLoading((m) => ({
            ...m,
            [a.codigo_elemento_asociacion]: true,
          }));
          subcomponentesService
            .getSubcomponentesByCodigoElementoAsociacion(
              a.codigo_elemento_asociacion
            )
            .then((subRes) => {
              if (cancelled) return;
              const subs = ((subRes.data || []) as Subcomponentes[]).filter(
                (s) => s.estado === "A"
              );
              setSubcomponentesByColumna((m) => ({
                ...m,
                [a.codigo_elemento_asociacion]: subs,
              }));
            })
            .catch(() => {
              if (cancelled) return;
              // Fallo de subcomponentes NO debe romper la captura:
              // se renderiza como Input (sin hijos).
              setSubcomponentesByColumna((m) => ({
                ...m,
                [a.codigo_elemento_asociacion]: [],
              }));
            })
            .finally(() => {
              if (cancelled) return;
              setSubcomponentesLoading((m) => ({
                ...m,
                [a.codigo_elemento_asociacion]: false,
              }));
            });
        }
      } catch (error) {
        if (cancelled) return;
        const msg =
          error instanceof Error
            ? error.message
            : "No se pudo cargar la tabla dinámica.";
        setErrorTabla(msg);
        setAsociaciones([]);
      } finally {
        if (!cancelled) setIsLoadingTabla(false);
      }
    };
    fetchTabla();
    return () => {
      cancelled = true;
    };
  }, [codigoAreaTipoMotivo, codigoComponente, codigoTipoMedicion]);

  // ===== Handlers de muestras =====
  const handleDynamicChange = useCallback(
    (muestraIdx: number, codigoAsociacion: number, value: string) => {
      if (!tablaHabilitada) return;
      setMuestras((prev) => {
        const next = [...prev];
        next[muestraIdx] = { ...next[muestraIdx], [codigoAsociacion]: value };
        return next;
      });
    },
    [tablaHabilitada]
  );

  /**
   * Si el subcomponente elegido trae `codigo_operador` y/o `puesto_trabajo`,
   * los vuelca a la parte fija del registro:
   *   codigo_operador → codigo_empleado
   *   puesto_trabajo  → maquina
   * Solo reescribe los campos que vienen no vacíos (no borra lo ya capturado).
   */
  const applySubcomponenteToFixed = useCallback(
    (sub: Subcomponentes | undefined) => {
      if (!sub) return;
      const op = String(sub.codigo_operador ?? "").trim();
      const puesto = String(sub.puesto_trabajo ?? "").trim();
      if (!op && !puesto) return;
      setFixed((prev) => ({
        ...prev,
        ...(op ? { codigo_empleado: op } : {}),
        ...(puesto ? { maquina: puesto } : {}),
      }));
    },
    [],
  );

  const handleSubcomponenteChange = useCallback(
    (
      muestraIdx: number,
      codigoAsociacion: number,
      codigoElementoAsociacion: number,
      value: string,
    ) => {
      handleDynamicChange(muestraIdx, codigoAsociacion, value);
      const subs = subcomponentesByColumna[codigoElementoAsociacion];
      const sub = (subs ?? []).find(
        (s) => String(s.codigo_subcomponente) === value,
      );
      applySubcomponenteToFixed(sub);
    },
    [handleDynamicChange, subcomponentesByColumna, applySubcomponenteToFixed],
  );

  const addMuestra = useCallback(() => {
    if (!tablaHabilitada) return;
    setMuestras((prev) => {
      const empty: DynamicValues = {};
      for (const a of asociaciones) empty[a.codigo_asociacion] = "";
      return [...prev, empty];
    });
  }, [asociaciones, tablaHabilitada]);

  const removeMuestra = useCallback((idx: number) => {
    setMuestras((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  // ===== Handlers del cronómetro =====
  const handleIniciar = useCallback(() => {
    const now = Date.now();
    inicioRef.current = now; // ← actualizamos el ref ANTES del setState
    setCronometro("running");
    setInicioMs(now);
    setSegundosTranscurridos(0);
    setFixed((prev) => ({ ...prev, tiempo: 0 }));
  }, []);

  const handleParar = useCallback(() => {
    const elapsed = segundosTranscurridos;
    inicioRef.current = null;
    setCronometro("stopped");
    setSegundosTranscurridos(elapsed);
    setFixed((prev) => ({ ...prev, tiempo: elapsed }));
  }, [segundosTranscurridos]);

  const handleCancelar = useCallback(() => {
    inicioRef.current = null;
    setCronometro("idle");
    setInicioMs(null);
    setSegundosTranscurridos(0);
    setMuestras([{}]);
    setFixed((prev) => ({
      ...prev,
      tiempo: undefined,
      cantidad: "0",
      codigo_empleado: "",
    }));
    // Limpiamos también el ID del registro por si el usuario había
    // iniciado un guardado previo y quiere volver a empezar de cero.
    codigoRegistroRef.current = null;
    causasOkRef.current = false;
    // Reseteamos el flag de error para que en el próximo muestreo los
    // inputs no aparezcan rojos al inicio.
    setIntentoGuardar(false);
    toast({
      title: "Muestreo cancelado",
      description: "Se reinició el cronómetro y las muestras capturadas.",
      variant: "destructive",
    });
  }, [toast]);

  /** Estado de envío: evita doble click y muestra progreso. */
  const [isSaving, setIsSaving] = useState(false);
  const [progreso, setProgreso] = useState<{ actual: number; total: number } | null>(null);

  /**
   * Flag que indica si el usuario YA intentó guardar al menos una vez
   * en esta sesión de muestreo. Sirve para MOSTRAR los marcadores de
   * error en celdas `number` vacías SOLO después del primer intento
   * (de lo contrario, los inputs vacíos se ven rojos desde el arranque,
   * lo cual confunde al usuario).
   * Se resetea a `false` en `handleCancelar` para empezar de cero.
   */
  const [intentoGuardar, setIntentoGuardar] = useState(false);

  /**
   * Ref de bloqueo de re-entrada para `handleGuardar`.
   *
   * ¿Por qué un `useRef` y no solo `isSaving`?
   *   - `isSaving` es state y se commitea asíncronamente; en renders
   *     concurrentes un segundo click puede ver el state aún en `false`
   *     y disparar otro POST a `/api/registro`, creando 2 cabeceras.
   *   - `useRef` se actualiza SINCRONICAMENTE en el mismo tick en que
   *     se llama la función, garantizando que SOLO se cree UN registro
   *     por sesión de muestreo (1:N con los `Detalle`).
   *
   * Regla: `handleGuardar` se sale INMEDIATAMENTE si `savingRef.current`
   * es `true`. Solo lo libera el `finally` (éxito o error).
   */
  const savingRef = useRef(false);

  /**
   * `codigoRegistroRef` recuerda el `codigo_registro` asignado por el
   * backend al primer POST a `/api/registro`. Si por alguna razón
   * React re-renderiza y vuelve a entrar a `handleGuardar`, este ref
   * evita crear un segundo registro: lo reutiliza y solo reintenta
   * los detalles pendientes.
   */
  const codigoRegistroRef = useRef<number | null>(null);
  /** Evita duplicar filas en `registro_causa_defecto` en reintentos. */
  const causasOkRef = useRef(false);

  /**
   * Construye el payload de `Registro` a partir de los datos capturados.
   * La causa del path (paso 4) se valida aquí, pero se persiste en
   * `registro_causa_defecto` (no como FK deprecada en `Registro`).
   */
  const construirRegistroPayload = useCallback(() => {
    const fila = filaConsolidada ?? defectRutaStorage.get();
    const ahora = new Date();
    const codigoCausaDefecto = fila?.codigo_causa_defecto;
    if (codigoCausaDefecto == null) {
      throw new Error(
        "Falta codigo_causa_defecto (la fila consolidada del paso 4 está vacía)."
      );
    }
    const usuarioSesion =
      meta.codigoEmpleado || getCodigoEmpleado() || "sistema";
    const codigoEmpleadoCaptura =
      String(fixed.codigo_empleado ?? "").trim() || usuarioSesion;
    const maquinaCaptura =
      String(fixed.maquina ?? "").trim() || MAQUINA_SIN_SELECCION;

    const payload = {
      // Marca temporal: preferimos la del cronómetro si está disponible,
      // si no, usamos la hora actual del navegador.
      fecha_registro: meta.fechaCaptura || formatDateForSQLServer(ahora),
      anio: ahora.getFullYear(),
      mes: ahora.getMonth() + 1,
      dia: ahora.getDate(),
      hora: ahora.getHours(),
      regional: meta.regional || "",
      departamento: fixed.departamento,
      motivo: fixed.motivo,
      origen: fixed.origen,
      componente: fixed.componente,
      causa_defecto: fixed.causa_defecto,
      cantidad: String(parseCantidadNoNegativa(fixed.cantidad) ?? ""),
      unidades: String(fixed.unidades ?? "").trim(),
      maquina: maquinaCaptura,
      material: (fixed.material ?? "").trim(),
      comodin: valorComodinParaPayload(fixed.comodin, comodinConfig),
      pedido: valorPedidoParaPayload(fixed.pedido, fixed.motivo),
      // Si el usuario no elige empleado, se usa quien crea el registro.
      codigo_empleado: codigoEmpleadoCaptura,
      // ⏱️ tiempo del cronómetro (segundos). Default 0 si por alguna razón no se detuvo.
      tiempo: fixed.tiempo ?? 0,
      estado: "A",
      fecha_creacion: formatDateForSQLServer(ahora),
      usuario_creacion: usuarioSesion,
    };
    // eslint-disable-next-line no-console
    console.log(
      "[step5] construirRegistroPayload unidades →",
      JSON.stringify(payload.unidades),
      "| fixed.unidades →",
      JSON.stringify(fixed.unidades),
    );
    return payload;
  }, [filaConsolidada, fixed, meta, comodinConfig]);

  /**
   * Construye el array de detalles a persistir. Para cada muestra N
   * y cada columna activa M crea UN detalle con:
   *   - codigo_asociacion: PK de la columna
   *   - muestra: índice 1-based de la muestra
   *   - valor: el string capturado
   *
   * Las columnas sin valor (string vacío) también se persisten (el
   * backend puede marcarlas como N/A). Si prefieres omitirlas, filtra
   * aquí con `if (!valor) continue`.
   */
  const construirDetalles = useCallback(
    (codigoRegistro: number) => {
      const out: Array<{
        codigo_registro: number;
        codigo_asociacion: number;
        muestra: number;
        valor: string;
        estado: string;
        fecha_modificacion: string | null;
        usuario_modificacion: string | null;
      }> = [];

      muestras.forEach((muestra, muestraIdx) => {
        const numMuestra = muestraIdx + 1;
        for (const col of asociaciones) {
          const valor = muestra[col.codigo_asociacion] ?? "";
          out.push({
            codigo_registro: codigoRegistro,
            codigo_asociacion: col.codigo_asociacion,
            muestra: numMuestra,
            valor,
            estado: "A",
            fecha_modificacion: null,
            usuario_modificacion: null,
          });
        }
      });
      return out;
    },
    [muestras, asociaciones]
  );

  const handleGuardar = useCallback(async () => {
    // ===== 0) Bloqueo de re-entrada (useRef, síncrono) =====
    // CRÍTICO: este chequeo se hace ANTES de cualquier setState y
    // ANTES de cualquier await. Si ya hay un guardado en curso,
    // salimos inmediatamente. Esto previene el bug clásico donde un
    // segundo click (o un re-render con `onChange`) dispara OTRO
    // `registroService.save` y crea un SEGUNDO registro.
    if (savingRef.current) {
      // eslint-disable-next-line no-console
      console.warn(
        "[step5] handleGuardar re-entrante bloqueado. Ya hay un guardado en curso."
      );
      return;
    }

    // ===== 1) Validaciones previas =====
    if (tieneTablaDinamica && cronometro !== "stopped") {
      toast({
        title: "Detén el cronómetro primero",
        description:
          "Para guardar el registro debes pulsar PARAR antes de enviar.",
        variant: "destructive",
      });
      return;
    }
    // Captura simple: sin columnas, se guarda solo registro + causa.
    if (asociaciones.length > 0 && muestras.length === 0) {
      toast({
        title: "Sin muestras",
        description: "Agrega al menos una muestra antes de guardar.",
        variant: "destructive",
      });
      return;
    }

    // Cantidad: número ≥ 0 (0 es válido).
    if (parseCantidadNoNegativa(fixed.cantidad) == null) {
      setIntentoGuardar(true);
      toast({
        title: "Cantidad inválida",
        description: "Indica una cantidad numérica mayor o igual a 0.",
        variant: "destructive",
      });
      return;
    }

    // Código empleado: opcional. Si va vacío, construirRegistroPayload
    // usa el código de quien crea el registro.

    // ===== 1.5) Validar data_type por columna =====
    // Defensa en profundidad: aunque `type="number"` en el navegador
    // bloquea letras al TECLEAR, hay formas de colar valores no
    // numéricos (autofill del navegador, pegar contenido, devtools).
    // Aquí verificamos que CADA celda cumpla con el data_type de su
    // columna. Si alguna falla, abortamos con un toast claro.
    for (const col of asociaciones) {
      const dt: ColumnDataType =
        dataTypeByColumn[col.codigo_asociacion] ?? "string";
      if (dt !== "number") continue; // string/boolean no requieren parseo
      muestras.forEach((muestra, muestraIdx) => {
        const raw = muestra[col.codigo_asociacion];
        const valor = (raw ?? "").trim();
        if (valor === "") return; // vacío es válido (se persiste como "")
        // Acepta enteros y decimales; rechaza "12abc", "abc", " ".
        const esNumero = /^-?\d+(\.\d+)?$/.test(valor);
        if (!esNumero) {
          toast({
            title: `Valor no numérico en muestra #${muestraIdx + 1}`,
            description:
              `La columna "${col.etiqueta}" es de tipo number. ` +
              `El valor "${valor}" no es un número válido.`,
            variant: "destructive",
          });
          throw new Error(
            `data_type violation: column ${col.codigo_asociacion} (${col.etiqueta}) expected number, got "${valor}"`
          );
        }
      });
    }

    // ===== 1.6) Validar obligatoriedad de columnas `number` =====
    // Las columnas con `data_type === "number"` son obligatorias en CADA
    // celda (muestra × columna). Si falta UN solo valor numérico, no se
    // permite guardar: el modelo requiere la lectura completa de la
    // muestra. Levantamos el flag `intentoGuardar` para que los inputs
    // vacíos muestren su borde rojo y recopilamos TODAS las violaciones
    // en un único toast para que el usuario sepa cuántas le faltan.
    const vacios: Array<{ muestra: number; columna: string }> = [];
    for (const col of asociaciones) {
      const dt: ColumnDataType =
        dataTypeByColumn[col.codigo_asociacion] ?? "string";
      if (dt !== "number") continue;
      muestras.forEach((muestra, muestraIdx) => {
        const raw = String(muestra[col.codigo_asociacion] ?? "").trim();
        if (raw === "") {
          vacios.push({ muestra: muestraIdx + 1, columna: col.etiqueta });
        }
      });
    }
    if (vacios.length > 0) {
      // Activamos el flag para que el render pinte los inputs vacíos con
      // borde rojo (es la primera vez que el usuario ve el error).
      setIntentoGuardar(true);
      const primeras = vacios
        .slice(0, 3)
        .map((v) => `muestra #${v.muestra} → "${v.columna}"`)
        .join(", ");
      const extra = vacios.length > 3 ? ` (+${vacios.length - 3} más)` : "";
      toast({
        title: `Faltan ${vacios.length} valor(es) numérico(s)`,
        description: `Las columnas number son obligatorias. ${primeras}${extra}`,
        variant: "destructive",
      });
      return;
    }

    // Marcamos el ref ANTES del primer await: cualquier re-entrada queda
    // bloqueada desde este punto.
    savingRef.current = true;
    setIsSaving(true);
    const tieneDetalles = asociaciones.length > 0;
    setProgreso({
      actual: 0,
      total: tieneDetalles
        ? muestras.length * asociaciones.length + 2
        : 2,
    });

    try {
      // ===== 2) POST /api/registro — UNA SOLA VEZ =====
      // La relación 1:N del modelo exige que EXACTAMENTE un `Registro`
      // agrupe N `Detalle`. Por eso este POST ocurre a lo sumo UNA vez
      // por sesión de muestreo (verificado por `savingRef` y por
      // `codigoRegistroRef`).
      let codigoRegistro = codigoRegistroRef.current;
      if (codigoRegistro == null) {
        const registroPayload = construirRegistroPayload();
        // eslint-disable-next-line no-console
        console.info(
          "[step5] POST /api/registro (único por sesión) →",
          registroPayload
        );
        const resRegistro = await registroService.save(
          registroPayload as unknown as import("@/types/integrations/muestreos-ddpp").Registro
        );
        codigoRegistro = resRegistro.data?.codigo_registro;
        if (
          codigoRegistro == null ||
          typeof codigoRegistro !== "number" ||
          codigoRegistro <= 0
        ) {
          // Si el backend NO devolvió un codigo_registro válido,
          // abortamos TODO. No tiene sentido insertar detalles
          // sueltos: terminarían creando registros huérfanos en el
          // backend (cada POST /api/detalle con codigo_registro
          // inválido se interpreta como "crear uno nuevo").
          throw new Error(
            "El backend no devolvió un codigo_registro válido. " +
              "Abortamos para no crear registros duplicados."
          );
        }
        // Persistimos en el ref: si React re-renderiza y vuelve a
        // entrar a esta función, NO se crea un segundo registro.
        codigoRegistroRef.current = codigoRegistro;
        // eslint-disable-next-line no-console
        console.info(
          "[step5] Registro creado OK. codigo_registro =",
          codigoRegistro
        );
      }
      setProgreso((p) => (p ? { ...p, actual: 1 } : null));

      // ===== 2.5) POST /api/registro_causa_defecto =====
      if (!causasOkRef.current) {
        const fila = filaConsolidada ?? defectRutaStorage.get();
        const codigoCausa = fila?.codigo_causa_defecto;
        if (codigoCausa == null || codigoCausa <= 0) {
          throw new Error(
            "Falta codigo_causa_defecto para persistir registro_causa_defecto."
          );
        }
        // eslint-disable-next-line no-console
        console.info(
          "[step5] POST /api/registro_causa_defecto →",
          { codigo_registro: codigoRegistro, codigo_causa_defecto: codigoCausa }
        );
        await registroCausaDefectoService.save({
          codigo_registro: codigoRegistro,
          codigo_causa_defecto: codigoCausa,
          estado: "A",
        });
        causasOkRef.current = true;
      }
      setProgreso((p) => (p ? { ...p, actual: 2 } : null));

      // ===== 3) POST /api/detalle (solo si hay columnas) =====
      if (tieneDetalles) {
      // Cada `Detalle` referencia EXACTAMENTE el `codigo_registro`
      // devuelto por el backend en el paso 2. NO se crea ningún
      // `Registro` adicional aquí: solo se insertan filas en `detalle`.
      const detallesPayload = construirDetalles(codigoRegistro);

      // Sanity-check: verificamos que TODOS los detalles llevan el
      // MISMO codigo_registro. Si no, abortamos para no contaminar
      // la BD.
      const codigosUnicos = new Set(
        detallesPayload.map((d) => d.codigo_registro)
      );
      if (codigosUnicos.size !== 1 || !codigosUnicos.has(codigoRegistro)) {
        throw new Error(
          `Inconsistencia: los detalles no comparten un único codigo_registro ` +
            `(encontrados: ${Array.from(codigosUnicos).join(", ")}).`
        );
      }
      // eslint-disable-next-line no-console
      console.info(
        `[step5] Enviando ${detallesPayload.length} detalle(s) → codigo_registro =`,
        codigoRegistro
      );

      // Enviamos los detalles con `Promise.allSettled` para no
      // bloquear el event loop. Si alguno falla, los demás siguen.
      const results = await Promise.allSettled(
        detallesPayload.map((d) =>
          detalleService.save(
            d as unknown as import("@/types/integrations/muestreos-ddpp").Detalle
          )
        )
      );
      let failed = 0;
      results.forEach((r, i) => {
        if (r.status === "rejected") {
          failed++;
          // eslint-disable-next-line no-console
          console.error(
            `[step5] detalle #${i + 1} falló:`,
            r.reason,
            detallesPayload[i]
          );
        }
      });
      setProgreso((p) =>
        p ? { ...p, actual: detallesPayload.length + 2 } : null
      );

      // ===== 4) Resultado =====
      const creados = detallesPayload.length - failed;
      if (failed === 0) {
        // ✅ Guardado 100% exitoso: toast verde + recarga de la página.
        // La recarga limpia el wizard (muestras, cronómetro, etc.) y
        // garantiza que NO quede visible lo recién capturado.
        toast({
          title: "Muestreo guardado correctamente",
          description:
            `Registro #${codigoRegistro} con ${creados} detalle(s) en ` +
            `${muestras.length} muestra(s) × ${asociaciones.length} columna(s).`,
          variant: "default",
        });
        // Damos un pequeño margen para que el toast se muestre antes
        // de la recarga (≈400ms). Sin este delay, el reload se lleva
        // el toast antes de que el usuario lo vea.
        if (typeof window !== "undefined") {
          window.setTimeout(() => {
            window.location.reload();
          }, 400);
        }
      } else {
        toast({
          title: "Guardado parcial",
          description:
            `Registro #${codigoRegistro} creado. ${creados}/${detallesPayload.length} ` +
            `detalles se guardaron; revisa la consola.`,
          variant: "destructive",
        });
      }
      } else {
        toast({
          title: "Registro guardado correctamente",
          description: `Registro #${codigoRegistro} (captura simple, sin campos adicionales).`,
          variant: "default",
        });
        if (typeof window !== "undefined") {
          window.setTimeout(() => {
            window.location.reload();
          }, 400);
        }
      }
    } catch (error) {
      const msg =
        error instanceof Error
          ? error.message
          : "No se pudo guardar el muestreo.";
      // Si falló el POST a /api/registro, LIMPIAMOS el ref para que
      // un reintento genuino del usuario pueda crear el registro.
      // Si falló después, conservamos el codigo_registro para no
      // duplicarlo.
      if (codigoRegistroRef.current == null) {
        // No se llegó a crear el registro: nada que limpiar.
      } else {
        // Se creó el registro pero algo falló: conservamos el ID
        // en el ref para que un próximo intento NO lo duplique.
        // eslint-disable-next-line no-console
        console.warn(
          "[step5] Fallo parcial. codigo_registro conservado en ref:",
          codigoRegistroRef.current
        );
      }
      toast({
        title: "Error al guardar",
        description: msg,
        variant: "destructive",
      });
    } finally {
      savingRef.current = false;
      setIsSaving(false);
      setProgreso(null);
    }
  }, [
    cronometro,
    tieneTablaDinamica,
    asociaciones,
    muestras,
    dataTypeByColumn,
    construirRegistroPayload,
    construirDetalles,
    filaConsolidada,
    meta.codigoEmpleado,
    fixed.cantidad,
    fixed.codigo_empleado,
    toast,
  ]);

  // ===== Notificar al padre en cada cambio =====
  useEffect(() => {
    onChange?.({ fixed, muestras, ordenSeleccionada: selectedOrden, meta });
  }, [fixed, muestras, selectedOrden, meta, onChange]);

  const handleFixedChange = (
    field: keyof FixedFields,
    value: string
  ) => {
    setFixed((prev) => ({ ...prev, [field]: value }));
  };

  const handleCantidadChange = (raw: string) => {
    const normalized = raw.replace(",", ".");
    let next = "";
    let seenDot = false;
    for (const ch of normalized) {
      if (ch >= "0" && ch <= "9") {
        next += ch;
      } else if (ch === "." && !seenDot) {
        next += ".";
        seenDot = true;
      }
    }
    handleFixedChange("cantidad", next);
  };

  /**
   * Handler del radio en la tabla de CONSULTA.
   *
   * Cuando el inspector marca una fila, guardamos la fila completa en
   * `selectedOrden` para auditoría y para alimentar el card de detalles
   * draggable. NO tocamos `fixed.origen`: ese campo lo llena el path
   * del wizard (paso 4 → `nombre_origen`) y se mantiene como texto
   * independiente del NUM_ORDEN seleccionado.
   */
  // (loadOrdenesPorCaso y atmFuenteRef están declarados arriba, antes del
// useEffect que los usa, para evitar "used before declaration".)

const handleSelectOrden = useCallback(
  (fila: OrdenesTrabajadas) => {
    const numOrden = String(fila.NUM_ORDEN ?? "").trim();
    if (!numOrden) return;
    setSelectedOrden({ numOrden, fila });
  },
  []
);

  // Ref de deduplicación para handleScannerDetected: solo llamamos al SP
  // si el código escaneado cambió respecto al último procesado.
  const lastScanRef = useRef<string>("");

  /**
   * Handler del ScannerPanel (modo ESCANEO).
   * Inyecta el valor en fixed.material, dispara el feedback visual
   * y llama al SP de órdenes (solo si el código es nuevo).
   */
  const handleScannerDetected = useCallback((value: string) => {
    const text = (value ?? "").trim();
    if (!text) return;
    setFixed((prev) => ({ ...prev, material: text }));
    setDropHighlight("material");
    setParticles(makeBurst("material"));

    // Evita llamar loadOrdenesPorCaso si el mismo código ya fue procesado.
    if (text === lastScanRef.current) return;
    lastScanRef.current = text;
    void loadOrdenesPorCaso(atmFuenteRef.current, text);
  }, []);

  // ===== Drag & Drop (campos de la orden → inputs de parte fija) =====

  /**
   * Sensors: permiten iniciar el drag con mouse, touch y teclado.
   *
   * Importante para Android: `PointerSensor` por sí solo NO funciona
   * bien en navegadores móviles Android (Chrome Android, Samsung
   * Internet): muchos no emiten `pointermove` con la frecuencia
   * necesaria, así que el drag nunca arranca. Hay que añadir
   * `TouchSensor` dedicado.
   *
   *   - PointerSensor → desktop (mouse, trackpad, stylus)
   *   - TouchSensor   → móvil (Android, iOS) con delay de 300ms y
   *                     tolerancia de 8px. El delay evita falsos
   *                     positivos por scroll/tap largo; la tolerancia
   *                     absorbe el temblor natural del dedo antes de
   *                     iniciar el drag.
   *   - KeyboardSensor → accesibilidad (espacio/enter)
   *
   * El patrón (delay + tolerance) es el oficialmente recomendado por
   * @dnd-kit para móvil.
   */
  const dndSensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 300, tolerance: 8 },
    }),
    useSensor(KeyboardSensor)
  );

  /**
   * Inputs que aceptan drop: solo "maquina" y "material" de la
   * parte fija. Centralizamos el mapeo para que el handler de drop tenga
   * una sola fuente de verdad.
   */
  const dropTargetsByField: Record<
    string,
    keyof Pick<FixedFields, "maquina" | "material">
  > = {
    maquina: "maquina",
    material: "material",
  };

  /**
   * Campo que recibió un drop exitoso. Lo usamos para pintar el input
   * con un pulse breve (ver `dropHighlight` abajo) y darle feedback
   * visual al inspector.
   */
  const [dropHighlight, setDropHighlight] = useState<
    keyof typeof dropTargetsByField | null
  >(null);

  /**
   * Partículas activas actualmente. Cada drop agrega un burst; el
   * `useEffect` siguiente las limpia tras 800ms (un poco más que la
   * duración máxima de la animación para que el fade-out termine).
   */
  const [particles, setParticles] = useState<DropParticle[]>([]);

  useEffect(() => {
    if (!dropHighlight) return;
    const id = window.setTimeout(() => setDropHighlight(null), 600);
    return () => window.clearTimeout(id);
  }, [dropHighlight]);

  // Limpieza periódica de partículas viejas. Usamos un counter para
  // evitar limpiar un burst nuevo que aún no terminó.
  useEffect(() => {
    if (particles.length === 0) return;
    const id = window.setTimeout(() => setParticles([]), 800);
    return () => window.clearTimeout(id);
  }, [particles]);

  /**
   * Handler del drop. Decodifica el id del draggable (formato
   * `orden:<key>:<numOrden>`), busca el valor en la fila seleccionada
   * y lo escribe en el input destino.
   */
  const handleDragEndOrden = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over) return;
      const activeId = String(active.id);
      const overId = String(over.id);
      const targetField = dropTargetsByField[overId];
      if (!targetField) return;

      // El active.id tiene el formato `orden:<key>:<numOrden>`.
      const parts = activeId.split(":");
      if (parts.length < 3 || parts[0] !== DRAG_PREFIX) return;
      const key = parts[1] as keyof OrdenesTrabajadas;
      const numOrden = parts.slice(2).join(":");
      if (selectedOrden?.numOrden !== numOrden) return;

      const raw = (selectedOrden.fila as unknown as Record<string, unknown>)[key];
      const value = raw == null ? "" : String(raw);
      setFixed((prev) => ({ ...prev, [targetField]: value }));
      setDropHighlight(targetField);
      // Dispara el burst de partículas en el input destino (estrellitas).
      setParticles(makeBurst(targetField));
    },
    [dropTargetsByField, selectedOrden]
  );

  // ===== Derivados de UI =====
  const fechaLegible = useMemo(() => {
    if (!meta.fechaCaptura) return "—";
    const d = new Date(meta.fechaCaptura);
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()} · ${MESES[d.getMonth()]} · ${pad(d.getDate())}`;
  }, [meta.fechaCaptura]);

  const horaLegible = useMemo(() => {
    if (!meta.fechaCaptura) return "—";
    const d = new Date(meta.fechaCaptura);
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }, [meta.fechaCaptura]);

  /** Formatea los segundos del cronómetro a HH:MM:SS. */
  const cronometroLegible = useMemo(() => {
    const s = segundosTranscurridos;
    const hh = Math.floor(s / 3600);
    const mm = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${pad(hh)}:${pad(mm)}:${pad(ss)}`;
  }, [segundosTranscurridos]);

  return (
    /*
     * IMPORTANTE: `<DndContext>` envuelve TODO el return del componente,
     * NO solo el bloque CONSULTA. Esto es necesario porque los
     * `DraggableField` viven en la sección CONSULTA, pero los
     * `DroppableInput` (Máquina, Código Escaneado) viven en la PARTE
     * FIJA más abajo. Si el `DndContext` solo envolviera la sección
     * CONSULTA, los eventos de drop sobre los inputs NO llegarían al
     * handler porque `@dnd-kit` solo escucha drops dentro de su árbol.
     */
    <DndContext
      sensors={dndSensors}
      onDragEnd={handleDragEndOrden}
    >
    <div className="space-y-1 pb-28">
      <div>
        <span className="text-sm text-primary font-medium">{stepHint}</span>
        <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">
          {title}
        </h2>
      </div>

      {/* ============ FUENTE DE DATOS: TABLA CON RADIOS (solo CONSULTA) ============ */}
      {/*
        Se muestra únicamente cuando el `AreaTipoMotivo` cargado indica
        `tipo_fuente === "CONSULTA"`. Para MANUAL / ESCANEO este bloque
        no se renderiza y la UI sigue como estaba.
      */}

      {/*
        =====================================================================
        ESCANEO — ScannerPanel del formDesigner
        =====================================================================
        Se muestra únicamente cuando el `AreaTipoMotivo` indica
        `tipo_fuente === "ESCANEO"`. El inspector abre la cámara con un
        click, escanea un QR o código de barras, y el valor detectado se
        inyecta en `fixed.material` (se persiste como
        `Registro.material`).

        Se renderiza ARRIBA de la tabla CONSULTA (no la reemplaza) porque
        el inspector puede usar ambas herramientas si la lógica de negocio
        lo requiere.
      */}
      {atmFuente &&
        String(atmFuente.tipo_fuente).trim().toUpperCase() === "ESCANEO" && (
          <Card className="border-2 border-primary/40">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">
                    Captura por escaneo
                  </h3>
                  <Badge variant="secondary" className="gap-1">
                    ESCANEO · caso {atmFuente.caso || "?"}
                  </Badge>
                </div>
                {fixed.material && (
                  <Badge
                    variant="default"
                    className="bg-primary gap-1 font-mono"
                  >
                    Capturado: {fixed.material}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Este motivo está configurado para escanear un QR o código
                de barras. Abre el panel, enfoca la etiqueta y el valor
                detectado se copiará al campo “Código escaneado” de la
                parte fija.
              </p>
              <ScannerPanel onScan={handleScannerDetected} />
            </CardContent>
          </Card>
        )}

      {/*
        Tabla de órdenes: se muestra para CONSULTA y ESCANEO.
        En ESCANEO ya cargamos el ScannerPanel arriba; aquí debajo
        mostramos la misma tabla con paginador/buscador que en CONSULTA.
        El usuario puede marcar una fila para arrastrar sus campos
        (Material, Máquina, etc.) a los inputs de la parte fija.
      */}
      {atmFuente &&
        ["CONSULTA", "ESCANEO"].includes(
          String(atmFuente.tipo_fuente).trim().toUpperCase()
        ) && (
          <Card className="border-2 border-primary/40">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">
                    Órdenes disponibles
                  </h3>
                  <Badge variant="secondary" className="gap-1">
                    {String(atmFuente.tipo_fuente).trim().toUpperCase()} · caso{" "}
                    {atmFuente.caso || "?"}
                  </Badge>
                </div>
                {selectedOrden && (
                  <Badge variant="default" className="bg-primary gap-1">
                    Elegida: {selectedOrden.numOrden}
                  </Badge>
                )}
              </div>

              {isLoadingFuente ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Cargando órdenes desde el SP…
                </div>
              ) : errorFuente ? (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  {errorFuente}
                </div>
              ) : ordenes.length === 0 ? (
                /*
                  Diferenciamos dos casos para dar mejor feedback:
                  - ESCANEO sin escaneo previo → "Escanea un código".
                  - Ya se consultó el SP pero no devolvió nada → mensaje
                    genérico de "sin resultados".
                  `fixed.material` se setea SOLO cuando el
                  ScannerPanel emite un escaneo exitoso, por eso es un
                  buen indicador de "ya se intentó".
                */
                <div className="rounded-md border border-dashed bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
                  {String(atmFuente?.tipo_fuente).trim().toUpperCase() ===
                    "ESCANEO" && !fixed.material ? (
                    <>
                      Escanea un código QR o de barras en el panel de arriba
                      para recuperar las órdenes disponibles.
                    </>
                  ) : (
                    <>
                      El SP no devolvió órdenes para los responsables
                      seleccionados.
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {/*
                    Búsqueda rápida. Filtra por NUM_ORDEN, Material o
                    Descripción (case-insensitive). El filtro y la página
                    se resetean cuando el usuario cambia el texto.
                  */}
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1 max-w-xs">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        className="pl-9 h-9 text-sm"
                        placeholder="Buscar por núm. orden, material o descripción..."
                        value={filter}
                        onChange={(e) => {
                          setFilter(e.target.value);
                          setPage(1);
                        }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {totalRows === ordenes.length
                        ? `${ordenes.length} orden(es) en total`
                        : `${totalRows} de ${ordenes.length} coinciden`}
                    </span>
                  </div>

                  <div className="rounded-md border overflow-x-auto">
                    <RadioGroup
                      value={selectedOrden?.numOrden ?? ""}
                      onValueChange={(numOrden) => {
                        // Buscamos en el array COMPLETO filtrado (no solo
                        // en la página actual) para que la selección
                        // sobreviva a un cambio de página.
                        const fila = filteredOrdenes.find(
                          (o) => String(o.NUM_ORDEN) === numOrden
                        );
                        if (fila) handleSelectOrden(fila);
                      }}
                    >
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[40px]" />
                            <TableHead>Núm. orden</TableHead>
                            <TableHead>Material</TableHead>
                            <TableHead>Descripción</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedOrdenes.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={4}
                                className="h-16 text-center text-xs text-muted-foreground"
                              >
                                Ninguna orden coincide con el filtro.
                              </TableCell>
                            </TableRow>
                          ) : (
                          paginatedOrdenes.map((o) => {
                            const numOrden = String(o.NUM_ORDEN);
                            return (
                              <TableRow
                                key={numOrden}
                                className={cn(
                                  "cursor-pointer",
                                  selectedOrden?.numOrden === numOrden &&
                                    "bg-primary/5"
                                )}
                                onClick={() => handleSelectOrden(o)}
                              >
                                <TableCell>
                                  <RadioGroupItem
                                    value={numOrden}
                                    aria-label={`Seleccionar orden ${numOrden}`}
                                  />
                                </TableCell>
                                <TableCell className="font-mono font-medium">
                                  {numOrden}
                                </TableCell>
                                <TableCell>{o.Material ?? ""}</TableCell>
                                <TableCell>{o.Descripcion ?? ""}</TableCell>
                              </TableRow>
                            );
                          })
                          )}
                        </TableBody>
                      </Table>
                    </RadioGroup>
                  </div>

                  {/*
                    Paginador (mismo patrón que areas/table.tsx y
                    Tmotivos/table.tsx).
                  */}
                  <div className="flex items-center justify-end gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">Items per page:</span>
                      <select
                        className="border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        value={rowsPerPage}
                        onChange={(e) => {
                          setRowsPerPage(Number(e.target.value));
                          setPage(1);
                        }}
                      >
                        {PAGE_SIZE_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                    <span className="text-sm">
                      {totalRows === 0
                        ? "0"
                        : `${(page - 1) * rowsPerPage + 1} – ${Math.min(
                            page * rowsPerPage,
                            totalRows
                          )} of ${totalRows}`}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="p-1 rounded disabled:opacity-50 hover:bg-gray-100"
                        onClick={() => setPage(1)}
                        disabled={page === 1}
                        aria-label="Primera página"
                      >
                        <span className="sr-only">Primera página</span>
                        &#x23ee;
                      </button>
                      <button
                        type="button"
                        className="p-1 rounded disabled:opacity-50 hover:bg-gray-100"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        aria-label="Página anterior"
                      >
                        <span className="sr-only">Página anterior</span>
                        &#x2039;
                      </button>
                      <button
                        type="button"
                        className="p-1 rounded disabled:opacity-50 hover:bg-gray-100"
                        onClick={() =>
                          setPage((p) => Math.min(totalPages, p + 1))
                        }
                        disabled={page === totalPages}
                        aria-label="Página siguiente"
                      >
                        <span className="sr-only">Página siguiente</span>
                        &#x203a;
                      </button>
                      <button
                        type="button"
                        className="p-1 rounded disabled:opacity-50 hover:bg-gray-100"
                        onClick={() => setPage(totalPages)}
                        disabled={page === totalPages}
                        aria-label="Última página"
                      >
                        <span className="sr-only">Última página</span>
                        &#x23ed;
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/*
                Card con TODOS los campos de la orden elegida. Cada campo
                es DRAGGABLE (@dnd-kit/core) y se puede soltar sobre los
                inputs "Máquina" y "Código Escaneado" de la parte fija
                (no hay restricción: cualquier campo → cualquier input).
              */}
              {selectedOrden && (
                <div className="mt-2 rounded-md border border-primary/30 bg-primary/5 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4 text-primary" />
                      <p className="text-sm font-semibold">
                        Detalle de la orden seleccionada
                      </p>
                    </div>
                    <Badge variant="secondary" className="font-mono">
                      {selectedOrden.numOrden}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mb-3">
                    Arrastra cualquier campo sobre los inputs{" "}
                    <strong>Máquina</strong> o{" "}
                    <strong>Código escaneado</strong> de la parte fija para
                    copiar su valor.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {ordenFields.map((f) => {
                      const value = (selectedOrden.fila as unknown as Record<string, unknown>)[
                        f.key
                      ];
                      return (
                        <DraggableField
                          key={f.key}
                          id={`orden:${f.key}:${selectedOrden.numOrden}`}
                          label={f.label}
                          value={value == null ? "" : String(value)}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

      {/* ============ PARTE FIJA ============ */}
      <Card>
        <CardContent className="p-5 space-y-4">
          {!tieneTablaDinamica && (
            <RegistroUnidadesOculto value={fixed.unidades ?? ""} />
          )}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">
                Tabla <code className="font-mono text-xs">registro</code> — campos fijos
              </h3>
              <Badge variant="secondary" className="gap-1">
                <LockKeyhole className="h-3 w-3" />
                Obligatorios
              </Badge>
            </div>
            <div className="text-right text-xs text-muted-foreground leading-tight">
              <div className="flex items-center gap-1 justify-end">
                <CalendarClock className="h-3 w-3" />
                {mounted ? fechaLegible : "—"}
              </div>
              <div className="font-mono">{mounted ? horaLegible : "—"}</div>
            </div>
          </div>

          {/* Resumen de campos del path (ocultos pero persistidos en `fixed`) */}
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            <PathSummaryItem
              label="Regional"
              value={mounted ? meta.regional : ""}
            />
            <PathSummaryItem
              label="Departamento"
              value={fixed.departamento}
            />
            <PathSummaryItem
              label="Motivo"
              value={fixed.motivo}
            />
            <PathSummaryItem
              label="Origen"
              value={fixed.origen}
            />
            <PathSummaryItem
              label="Componente"
              value={fixed.componente}
            />
            <PathSummaryItem
              label="Causa defecto"
              value={fixed.causa_defecto}
            />
          </div>

          {/* Campos editables — una sola fila en desktop */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label
                htmlFor="registro-codigo-empleado"
                className="text-xs font-medium flex items-center justify-between"
              >
                <span className="flex items-center gap-1">
                  <IdCard className="h-3 w-3" />
                  Cód. empleado
                </span>
                <span className="text-[10px] text-muted-foreground font-normal">
                  Opcional
                </span>
              </Label>
              {empleadoAutocomplete ? (
                <UserAutocomplete
                  inputId="registro-codigo-empleado"
                  value={fixed.codigo_empleado}
                  onChange={(v) => handleFixedChange("codigo_empleado", v)}
                  multiple={false}
                  selectOnly
                  showAllOnOpen
                  filterUser={filterEmpleado}
                  placeholder="Selecciona el empleado..."
                />
              ) : (
              <Input
                id="registro-codigo-empleado"
                value={fixed.codigo_empleado}
                onChange={(e) =>
                  handleFixedChange("codigo_empleado", e.target.value)
                }
                placeholder="Ej: 2312"
                className={cn(
                  "h-9 text-sm font-mono",
                  !fixed.codigo_empleado && "border-dashed",
                )}
              />
              )}
              {empleadoAutocomplete ? (
                <p className="text-[10px] text-muted-foreground">
                  Si no eliges, se guarda el código de quien captura
                  {departamentoEmpleadoFilter ? (
                    <>
                      . El listado se filtra por el origen{" "}
                      <span className="font-semibold">
                        {departamentoEmpleadoFilter}
                      </span>
                    </>
                  ) : null}
                  .
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="registro-cantidad"
                className="text-xs font-medium flex items-center justify-between"
              >
                <span>
                  Cantidad <span className="text-destructive">*</span>
                </span>
                <span className="text-[10px] text-muted-foreground font-normal">
                  Obligatorio
                </span>
              </Label>
              <Input
                id="registro-cantidad"
                type="text"
                inputMode="decimal"
                pattern="[0-9]*[.,]?[0-9]*"
                autoComplete="off"
                value={fixed.cantidad}
                onChange={(e) => handleCantidadChange(e.target.value)}
                onBlur={() => {
                  if (!String(fixed.cantidad ?? "").trim()) {
                    handleFixedChange("cantidad", "0");
                  }
                }}
                onKeyDown={(e) => {
                  if (["e", "E", "+", "-"].includes(e.key)) {
                    e.preventDefault();
                  }
                }}
                placeholder="0"
                className={cn(
                  "h-9 text-sm font-mono",
                  !fixed.cantidad && "border-dashed",
                  (intentoGuardar && !cantidadValida) &&
                    "border-red-500 focus-visible:ring-red-500",
                )}
              />
            </div>
            {empleadoAutocomplete ? (
              <CatalogSelect
                id="registro-maquina"
                label="Máquina"
                value={fixed.maquina}
                onChange={(v) => handleFixedChange("maquina", v)}
                options={maquinaOptions}
                isLoading={maquinasLoading}
                placeholder="Selecciona una máquina"
                searchPlaceholder="Buscar máquina..."
                emptyMessage="No hay máquinas para esta regional y área."
                hint={[maquinaHint, "Si no eliges, se guarda N.A."]
                  .filter(Boolean)
                  .join(" · ")}
              />
            ) : (
            <DroppableInput
              id="registro-maquina"
              label="Máquina"
              placeholder="Arrastra o escribe"
              value={fixed.maquina}
              droppableId="maquina"
              highlighted={dropHighlight === "maquina"}
              particles={particles.filter((p) => p.target === "maquina")}
              onChange={(v) => handleFixedChange("maquina", v)}
            />
            )}
            {requierePedido ? (
              <div className="space-y-1.5">
                <label className="text-xs font-medium flex items-center gap-1 text-muted-foreground">
                  <QrCode className="h-3 w-3 inline mr-1" />
                  Material
                </label>
                <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
                  {MATERIAL_NO_APLICA}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  No aplica para este motivo: se captura el pedido en su propio campo.
                </p>
              </div>
            ) : empleadoAutocomplete ? (
              <div className="space-y-1.5">
                <label htmlFor="registro-material" className="text-xs font-medium flex items-center gap-1">
                  <QrCode className="h-3 w-3 inline mr-1" />
                  Material
                </label>
                <MaterialAutocomplete
                  centro={meta.regional || defaults.regional || ""}
                  resp={responsables?.trim() || ""}
                  value={fixed.material ?? ""}
                  onSelect={({ MATERIAL }) => handleFixedChange("material", MATERIAL)}
                  hint={materialHint}
                />
              </div>
            ) : (
            <DroppableInput
              id="registro-material"
              label={
                <>
                  <QrCode className="h-3 w-3 inline mr-1" />
                  Material
                </>
              }
              placeholder="Arrastra o escanea"
              value={fixed.material ?? ""}
              droppableId="material"
              highlighted={dropHighlight === "material"}
              particles={particles.filter(
                (p) => p.target === "material"
              )}
              onChange={(v) => handleFixedChange("material", v)}
            />
            )}
            {empleadoAutocomplete && comodinConfig.tipo !== "none" ? (
              <CatalogSelect
                id="registro-comodin"
                label={comodinConfig.label}
                value={fixed.comodin === COMODIN_NA ? "" : (fixed.comodin ?? "")}
                onChange={(v) => handleFixedChange("comodin", v || COMODIN_NA)}
                options={comodinOptions}
                isLoading={comodinLoading}
                placeholder={comodinConfig.placeholder}
                searchPlaceholder={comodinConfig.searchPlaceholder}
                emptyMessage={comodinConfig.emptyMessage}
                hint={[comodinHint, comodinConfig.hint].filter(Boolean).join(" · ")}
                onFilterChange={
                  esComodinBusquedaEnVivo ? buscarComodinCliente : undefined
                }
              />
            ) : null}
            {mostrarSelectorPedido ? (
              <CatalogSelect
                id="registro-pedido"
                label="Pedido"
                value={fixed.pedido ?? ""}
                onChange={(v) => handleFixedChange("pedido", v)}
                options={pedidoOptions}
                isLoading={pedidoLoading}
                placeholder="Selecciona un pedido"
                searchPlaceholder="Buscar por número de pedido..."
                emptyMessage="No se encontraron pedidos."
                hint={pedidoHint}
                onFilterChange={buscarPedido}
              />
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* ============ PARTE DINÁMICA (solo si el componente tiene tabla para este motivo) ============ */}
      {(errorTabla || tieneTablaDinamica) && (
      <Card className="border-dashed border-2 border-primary/30 p-0 m-0">
        <CardContent className="p-5 space-y-1">
          {/* Cronómetro / Banner de estado */}
          <div
            className={cn(
              "flex items-center justify-between gap-3 rounded-md px-3 py-2 text-xs transition-colors",
              cronometro === "idle" &&
                "bg-muted/40 text-muted-foreground border border-dashed",
              cronometro === "running" &&
                "bg-green-50 text-green-700 border border-green-200 dark:bg-green-950/30 dark:text-green-300 dark:border-green-800",
              cronometro === "stopped" &&
                "bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800"
            )}
          >
            <div className="flex items-center gap-2">
              <Timer className="h-4 w-4" />
              <span className="font-medium">
                {cronometro === "idle" &&
                  "La tabla dinámica está bloqueada. Pulsa INICIAR para empezar."}
                {cronometro === "running" &&
                  "Muestreo en curso — registra los valores por muestra."}
                {cronometro === "stopped" &&
                  "Muestreo detenido — listo para guardar."}
              </span>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-sm font-semibold">
              <Hourglass className="h-3.5 w-3.5" />
              {mounted ? cronometroLegible : "00:00:00"}
            </div>
          </div>

          {!tablaHabilitada && (
            <p className="text-[11px] text-muted-foreground">
              {cronometro === "idle"
                ? "Las columnas dinámicas se habilitarán al iniciar el cronómetro."
                : "Las columnas se bloquearon al detener el cronómetro."}
            </p>
          )}

          {isLoadingTabla ? (
            <div className="flex flex-row flex-wrap gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex-1 min-w-[150px]">
                  <Skeleton className="h-9 w-full" />
                </div>
              ))}
              <p className="col-span-full text-xs text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                Cargando tabla dinámica…
              </p>
            </div>
          ) : errorTabla ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {errorTabla}
            </div>
          ) : (
            <div className="space-y-1">
              {/* Cabeceras de columna */}
              <div className="flex items-center gap-2 px-0.5">
                <span className="shrink-0 w-5 text-[10px] font-medium text-muted-foreground uppercase tracking-wide text-center">
                  #
                </span>
                <span className="flex-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wide border-l pl-3">
                  Valores
                </span>
                <span className="shrink-0 w-10 text-[10px] font-medium text-muted-foreground uppercase tracking-wide text-center border-l">
                  Acción
                </span>
              </div>

              {muestras.map((muestra, muestraIdx) => {
                const isLast = muestraIdx === muestras.length - 1;
                return (
                  <div key={muestraIdx} className="flex items-center gap-2">
                    {/* Badge # muestra */}
                    <Badge
                      variant="secondary"
                      className="shrink-0 text-[11px] px-2.5 py-1 self-center"
                    >
                      {muestraIdx + 1}
                    </Badge>

                    {/* Card con los inputs */}
                    <Card className="flex-1 shadow-none">
                      <CardContent className="px-3 py-2">
                        <div className="flex flex-row flex-wrap gap-2">
                          {asociaciones.map((a) => {
                            const subs =
                              subcomponentesByColumna[a.codigo_elemento_asociacion];
                            const loadingSubs =
                              subcomponentesLoading[a.codigo_elemento_asociacion] ?? true;
                            const tieneHijos =
                              !loadingSubs && Array.isArray(subs) && subs.length > 0;

                            // ===== data_type de la columna =====
                            // Mientras `dataTypeLoading` esté activo asumimos
                            // "string" (defensa permisiva). Una vez resuelto,
                            // el tipo controla el input Y se muestra en un badge.
                            const dt: ColumnDataType =
                              dataTypeByColumn[a.codigo_asociacion] ?? "string";
                            const dtIsLoading =
                              dataTypeLoading[a.codigo_asociacion] ?? true;

                            // Si la columna tiene subcomponentes (Select), NO
                            // aplicamos el control de tipo al input: el
                            // subcomponente ya fuerza un valor discreto.
                            // Aun así, mostramos el badge para que el usuario
                            // vea qué tipo de dato conceptual está capturando.
                            if (tieneHijos) {
                              return (
                                <div key={a.codigo_asociacion} className="flex-1 min-w-[130px] space-y-1">
                                  <DataTypeBadge
                                    dataType={dt}
                                    loading={dtIsLoading}
                                  />
                                  <Select
                                    value={muestra[a.codigo_asociacion] ?? ""}
                                    onValueChange={(v) =>
                                      handleSubcomponenteChange(
                                        muestraIdx,
                                        a.codigo_asociacion,
                                        a.codigo_elemento_asociacion,
                                        v,
                                      )
                                    }
                                    disabled={!tablaHabilitada}
                                  >
                                    <SelectTrigger
                                      className={cn(
                                        "h-8 text-sm",
                                        !tablaHabilitada && "opacity-60 cursor-not-allowed"
                                      )}
                                    >
                                      <SelectValue placeholder={a.etiqueta} />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {subs!.map((s) => (
                                        <SelectItem
                                          key={s.codigo_subcomponente}
                                          value={String(s.codigo_subcomponente)}
                                        >
                                          {s.descripcion}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              );
                            }

                            // ===== Sin subcomponentes → Input controlado por data_type =====
                            // - "string"  → <Input type="text"> libre
                            // - "number"  → <Input type="number" step="any"> (bloquea letras)
                            // - "boolean" → Checkbox (true/false → se persiste como "true"/"false")
                            if (dt === "boolean") {
                              const checked =
                                String(muestra[a.codigo_asociacion] ?? "") === "true";
                              return (
                                <div key={a.codigo_asociacion} className="flex-1 min-w-[130px] space-y-1">
                                  <DataTypeBadge
                                    dataType={dt}
                                    loading={dtIsLoading}
                                  />
                                  <label
                                    className={cn(
                                      "flex items-center gap-2 h-8 px-2 rounded border bg-background text-sm",
                                      !tablaHabilitada && "opacity-60 cursor-not-allowed"
                                    )}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      disabled={dtIsLoading || !tablaHabilitada}
                                      onChange={(e) =>
                                        handleDynamicChange(
                                          muestraIdx,
                                          a.codigo_asociacion,
                                          e.target.checked ? "true" : "false"
                                        )
                                      }
                                      className="h-4 w-4"
                                    />
                                    <span className="truncate">
                                      {dtIsLoading ? "Cargando..." : a.etiqueta}
                                    </span>
                                  </label>
                                </div>
                              );
                            }

                            const isNumber = dt === "number";
                            // Para columnas `number` OBLIGATORIAS, marcamos
                            // visualmente el input con borde rojo si está
                            // vacío. Solo se muestra DESPUÉS del primer
                            // intento de guardar (ver estado `intentoGuardar`)
                            // para no asustar al usuario mientras edita.
                            const valorCelda = String(
                              muestra[a.codigo_asociacion] ?? ""
                            ).trim();
                            const numberVacio = isNumber && valorCelda === "";
                            const mostrarErrorNumber =
                              numberVacio && intentoGuardar;
                            return (
                              <div key={a.codigo_asociacion} className="flex-1 min-w-[130px] space-y-1">
                                <DataTypeBadge
                                  dataType={dt}
                                  loading={dtIsLoading}
                                />
                                <Input
                                  type={isNumber ? "number" : "text"}
                                  step="any"
                                  inputMode={isNumber ? "decimal" : "text"}
                                  required={isNumber}
                                  aria-required={isNumber || undefined}
                                  aria-invalid={mostrarErrorNumber || undefined}
                                  value={muestra[a.codigo_asociacion] ?? ""}
                                  onChange={(e) =>
                                    handleDynamicChange(muestraIdx, a.codigo_asociacion, e.target.value)
                                  }
                                  placeholder={
                                    dtIsLoading || loadingSubs
                                      ? "Cargando..."
                                      : isNumber
                                        ? `${a.etiqueta} *`
                                        : a.etiqueta
                                  }
                                  disabled={loadingSubs || dtIsLoading || !tablaHabilitada}
                                  className={cn(
                                    "h-8 text-sm",
                                    !muestra[a.codigo_asociacion] && !isNumber && "border-dashed",
                                    mostrarErrorNumber &&
                                      "border-red-500 focus-visible:ring-red-500",
                                    !tablaHabilitada && "opacity-60 cursor-not-allowed",
                                    isNumber && "font-mono",
                                  )}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Badge acción: + en la última fila, × en las demás */}
                    {isLast ? (
                      <button
                        type="button"
                        onClick={addMuestra}
                        className="shrink-0 flex items-center gap-1 rounded-full border border-green-500/40 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-600 hover:bg-green-100 transition-colors self-center dark:bg-green-950/30 dark:hover:bg-green-950/50"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => removeMuestra(muestraIdx)}
                        className="shrink-0 flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/5 px-2.5 py-1 text-xs font-medium text-destructive hover:bg-destructive/15 transition-colors self-center"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {/* Hint de envío */}
      {/* <p className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
        <Save className="h-3 w-3" />
        Al enviar se creará{" "}
        <strong className="font-semibold text-foreground">1 (un) registro</strong>{" "}
        en <code className="font-mono">registro</code> y{" "}
        <strong className="font-semibold text-foreground">
          {muestras.length * asociaciones.length || 0}
        </strong>{" "}
        muestreos internos en <code className="font-mono">detalle</code>{" "}
        ({muestras.length} muestra{muestras.length === 1 ? "" : "s"} × {asociaciones.length} columna{asociaciones.length === 1 ? "" : "s"}).
        <span className="text-[10px]">
          · Relación 1 registro → N detalles
        </span>
      </p> */}

      {/* ============ BOTONES FLOTANTES ============ */}
      {/* fixed bottom-right, z-40, móvil-friendly */}
      <TooltipProvider delayDuration={200} skipDelayDuration={0}>
        <div className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-4 z-40 flex flex-col gap-3 sm:right-6">
          {/* INICIAR / PARAR — solo si hay tabla dinámica */}
          {tieneTablaDinamica && cronometro !== "stopped" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={cronometro === "idle" ? handleIniciar : handleParar}
                  className={cn(
                    "group flex h-12 w-12 items-center justify-center rounded-full shadow-lg ring-1 ring-black/5 transition-all hover:scale-105 active:scale-95",
                    cronometro === "idle"
                      ? "bg-green-600 text-white hover:bg-green-700 shadow-green-600/30"
                      : "bg-red-600 text-white hover:bg-red-700 shadow-red-600/30 animate-pulse"
                  )}
                  aria-label={cronometro === "idle" ? "Iniciar muestreo" : "Detener cronómetro"}
                >
                  {cronometro === "idle" ? (
                    <Play className="h-5 w-5" />
                  ) : (
                    <StopCircle className="h-5 w-5" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="left">
                {cronometro === "idle" ? "Iniciar muestreo" : "Detener cronómetro"}
              </TooltipContent>
            </Tooltip>
          )}

          {/* CANCELAR — naranja, circular */}
          {(tieneTablaDinamica &&
            (cronometro === "running" || cronometro === "stopped")) && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleCancelar}
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-500 text-white shadow-lg shadow-orange-500/30 ring-1 ring-black/5 transition-all hover:bg-orange-600 hover:scale-105 active:scale-95"
                  aria-label="Cancelar y reiniciar"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left">Cancelar y reiniciar</TooltipContent>
            </Tooltip>
          )}

          {/* GUARDAR — azul/primario, circular */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={handleGuardar}
                /**
                 * Bloqueo de doble-click robusto.
                 * Combinamos TRES fuentes de "no guardar":
                 *   1. `savingRef.current` (síncrono)  ← clave
                 *   2. `isSaving` (state, puede llegar tarde)
                 *   3. `cronometro !== "stopped"` (regla de negocio)
                 *
                 * El `savingRef` se setea DENTRO de `handleGuardar` ANTES
                 * del primer await, así que un segundo click (incluso en
                 * el mismo tick) lee `true` y queda bloqueado. Esto evita
                 * que el usuario cree varios registros por accidente.
                 */
                disabled={
                  savingRef.current ||
                  isSaving ||
                  !cantidadValida ||
                  (tieneTablaDinamica && cronometro !== "stopped")
                }
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-full shadow-lg ring-1 ring-black/5 transition-all",
                  savingRef.current || isSaving
                    ? "bg-muted text-muted-foreground cursor-not-allowed opacity-80"
                    : cantidadValida &&
                        (!tieneTablaDinamica || cronometro === "stopped")
                      ? "bg-primary text-primary-foreground hover:scale-105 active:scale-95 hover:bg-primary/90 shadow-primary/30"
                      : "bg-muted text-muted-foreground cursor-not-allowed opacity-60"
                )}
                aria-label={
                  savingRef.current || isSaving
                    ? `Enviando ${progreso?.actual ?? 0} de ${progreso?.total ?? "?"}`
                    : !cantidadValida
                      ? "Indica una cantidad ≥ 0"
                      : !tieneTablaDinamica || cronometro === "stopped"
                        ? "Guardar registro"
                        : "Detén el cronómetro para guardar"
                }
              >
                {savingRef.current || isSaving ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Save className="h-5 w-5" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">
              {savingRef.current || isSaving
                ? `Enviando… ${progreso?.actual ?? 0}/${progreso?.total ?? "?"} (bloqueado)`
                : !cantidadValida
                  ? "Indica una cantidad ≥ 0"
                  : !tieneTablaDinamica || cronometro === "stopped"
                    ? "Guardar registro"
                    : "Detén el cronómetro para guardar"}
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </div>
    </DndContext>
  );
}

/* ============ Sub-componente: campo de texto con label flotante ============ */
interface FieldTextProps {
  id: string;
  label: React.ReactNode;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
}

function FieldText({
  id,
  label,
  placeholder,
  value,
  onChange,
  hint,
  disabled,
  icon,
}: FieldTextProps) {
  return (
    <div className="space-y-1.5">
      <Label
        htmlFor={id}
        className="text-xs font-medium flex items-center justify-between"
      >
        <span className="flex items-center gap-1">
          {icon}
          {label}
        </span>
        {hint && (
          <span className="text-[10px] text-muted-foreground font-normal">
            {hint}
          </span>
        )}
      </Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={cn("h-9 text-sm", !value && "border-dashed")}
      />
    </div>
  );
}

/* ============ Sub-componente: ítem resumen del path (read-only) ============ */
interface PathSummaryItemProps {
  label: string;
  value?: string;
  icon?: React.ReactNode;
}

/**
 * Mini-tarjeta que resume un campo derivado de la ruta de muestreo.
 * No es editable: el valor ya viene "fijo" del path del wizard. Sirve
 * para que el inspector vea qué se va a registrar sin saturar el form.
 */
function PathSummaryItem({ label, value, icon }: PathSummaryItemProps) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        {icon}
        {label}
      </p>
      <p
        className="text-xs font-medium truncate"
        title={value || "—"}
      >
        {value || "—"}
      </p>
    </div>
  );
}
interface FieldSelectProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  options: Array<{ value: string; label: string; sub?: string }>;
}

function FieldSelect({
  id,
  label,
  value,
  onChange,
  hint,
  options,
}: FieldSelectProps) {
  return (
    <div className="space-y-1.5">
      <Label
        htmlFor={id}
        className="text-xs font-medium flex items-center justify-between"
      >
        <span className="flex items-center gap-1">
          <ListTree className="h-3 w-3" />
          {label}
        </span>
        {hint && (
          <span className="text-[10px] text-muted-foreground font-normal">
            {hint}
          </span>
        )}
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="h-9 text-sm">
          <SelectValue placeholder="Selecciona una opción" />
        </SelectTrigger>
        <SelectContent>
          {options.length === 0 ? (
            <SelectItem value="__vacio__" disabled>
              (Sin opciones)
            </SelectItem>
          ) : (
            options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                <span className="flex flex-col">
                  <span>{o.label}</span>
                  {o.sub && (
                    <span className="text-[10px] text-muted-foreground">
                      {o.sub}
                    </span>
                  )}
                </span>
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * Pequeño badge que indica el `data_type` de una columna dinámica.
 *
 * Variantes:
 *   - "string"  → verde   (texto: "abc")
 *   - "number"  → azul    (texto: "123")
 *   - "boolean" → ámbar   (texto: "true/false")
 *
 * Mientras el `data_type` no se haya resuelto del backend, muestra un
 * skeleton neutro para no hacer layout-shift.
 */
/* ============ Sub-componente: campo arrastrable (card de la orden) ============ */
interface DraggableFieldProps {
  /** id único usado por @dnd-kit. Formato esperado: `orden:<key>:<numOrden>`. */
  id: string;
  /** Etiqueta visible del campo (Material, Máquina, etc.). */
  label: string;
  /** Valor textual que se copiará al input destino al hacer drop. */
  value: string;
}

/**
 * Tarjeta arrastrable que representa un campo de `OrdenesTrabajadas`.
 *
 * ── Reglas para drag-and-drop en móvil (Android / iOS) ──────────────────
 *
 * 1. `touch-action: none` es OBLIGATORIO en el elemento que tiene
 *    `listeners`. Sin él el browser intercepta el toque para scroll /
 *    selección de texto ANTES de que @dnd-kit lo capture, y el drag
 *    nunca arranca (o empieza a seleccionar texto como reportó el usuario).
 *
 * 2. `user-select: none` + `-webkit-user-select: none` en el MISMO
 *    elemento previenen que iOS/Android resalten texto al mantener pulsado.
 *
 * 3. `listeners` y `setNodeRef` deben vivir en el MISMO elemento raíz.
 *    Si `listeners` está en un hijo (p. ej. solo en el <button> handle),
 *    el área activa es demasiado pequeña en móvil y `touch-action: none`
 *    solo se aplica a esa área, no a la tarjeta entera.
 *
 * 4. El ícono `GripVertical` sigue siendo la pista visual del handle,
 *    pero ya NO tiene los `listeners`: toda la tarjeta es arrastrable.
 * ────────────────────────────────────────────────────────────────────────
 */
function DraggableField({ id, label, value }: DraggableFieldProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.6 : 1,
    // ⚠️ CRÍTICO para móvil: le dice al browser que NO maneje este elemento
    // con scroll / zoom / selección de texto — @dnd-kit toma control total.
    touchAction: "none",
    // Previene la selección de texto al mantener pulsado (Android/iOS).
    userSelect: "none",
    WebkitUserSelect: "none",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      // Todos los eventos de drag viven en la tarjeta entera, no solo en
      // el handle. En móvil esto aumenta el área táctil considerablemente.
      {...listeners}
      {...attributes}
      className={cn(
        "flex items-center gap-2 rounded-md border bg-primary/5 px-2 py-1.5 text-xs",
        "border-primary/30 transition-shadow select-none",
        "hover:bg-primary/10 hover:border-primary/60 hover:shadow-sm",
        isDragging
          ? "shadow-lg ring-2 ring-primary/50 cursor-grabbing bg-primary/15"
          : "cursor-grab"
      )}
    >
      {/* Indicador visual del handle — solo decorativo, sin listeners */}
      <GripVertical
        className="h-4 w-4 shrink-0 text-primary"
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wide text-primary/80 font-semibold">
          {label}
        </p>
        <p className="font-mono truncate text-foreground" title={value || "—"}>
          {value || "—"}
        </p>
      </div>
    </div>
  );
}

/* ============ Sub-componente: input droppable (parte fija) ============ */
interface DroppableInputProps {
  id: string;
  label: React.ReactNode;
  placeholder?: string;
  value: string;
  /**
   * Identificador de droppable. Coincide con las claves de
   * `dropTargetsByField` (`maquina` | `material`) para que el
   * handler `handleDragEndOrden` sepa dónde escribir.
   */
  droppableId: string;
  /** `true` justo después de un drop exitoso; dispara el pulse. */
  highlighted?: boolean;
  /**
   * Partículas activas para ESTE input destino. El padre ya las filtró
   * por `target`, así que aquí simplemente las pintamos.
   */
  particles?: DropParticle[];
  onChange: (value: string) => void;
  disabled?: boolean;
}

/**
 * Input que actúa como zona de drop para los `DraggableField`.
 *
 * Estados visuales:
 *   - normal            → borde estándar
 *   - hover sobre drop   → `isOver` activa el highlight primary
 *   - drop exitoso       → `highlighted` (600ms) lanza un pulse verde
 *                          + burst de partículas (estrellitas)
 *
 * El input sigue siendo editable: el drag-and-drop es un atajo, no un
 * reemplazo del teclado.
 */
function DroppableInput({
  id,
  label,
  placeholder,
  value,
  droppableId,
  highlighted,
  particles = [],
  onChange,
  disabled,
}: DroppableInputProps) {
  const { setNodeRef, isOver } = useDroppable({ id: droppableId });
  return (
    <div className="space-y-1.5">
      <Label
        htmlFor={id}
        className="text-xs font-medium flex items-center justify-between"
      >
        <span className="flex items-center gap-1">{label}</span>
        <span className="text-[10px] text-muted-foreground font-normal">
          arrastrable
        </span>
      </Label>
      {/*
        `setNodeRef` se aplica al wrapper del input. Usamos un `div`
        separado para que el `isOver` se evalúe sobre toda el área
        (label + input), dando más superficie de drop.
      */}
      <div
        ref={setNodeRef}
        className={cn(
          "relative rounded-md transition-all",
          isOver && "ring-2 ring-primary ring-offset-2 ring-offset-background",
          highlighted && "animate-pulse ring-2 ring-green-500"
        )}
      >
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "h-9 text-sm",
            !value && "border-dashed",
            isOver && "border-primary"
          )}
        />
        {/*
          Overlay de partículas (estrellitas). Se posiciona absolutamente
          sobre todo el wrapper; las partículas se “anclan” al centro
          (50% 50%) y salen hacia afuera con un transform calculado
          por trigonometría. Las keyframes `@keyframes` se inyectan
          inline (ver bloque abajo) solo cuando hay partículas activas.
        */}
        {particles.length > 0 && (
          <>
            <style>{`
              @keyframes drop-burst-${id} {
                0% {
                  opacity: 1;
                  transform: translate(-50%, -50%) scale(0.4);
                }
                60% {
                  opacity: 1;
                  transform: translate(
                    calc(-50% + var(--dx) * 1px),
                    calc(-50% + var(--dy) * 1px)
                  ) scale(1);
                }
                100% {
                  opacity: 0;
                  transform: translate(
                    calc(-50% + var(--dx) * 1.2px),
                    calc(-50% + var(--dy) * 1.2px)
                  ) scale(0.5);
                }
              }
            `}</style>
            <div
              className="pointer-events-none absolute inset-0 overflow-visible"
              aria-hidden="true"
            >
              {particles.map((p) => {
                const dx = Math.cos(p.angle) * p.distance;
                const dy = Math.sin(p.angle) * p.distance;
                return (
                  <span
                    key={p.id}
                    style={
                      {
                        position: "absolute",
                        left: "50%",
                        top: "50%",
                        width: `${p.size}px`,
                        height: `${p.size}px`,
                        background: p.color,
                        borderRadius: "9999px",
                        boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
                        ["--dx" as string]: `${dx}`,
                        ["--dy" as string]: `${dy}`,
                        animationName: `drop-burst-${id}`,
                        animationDuration: `${p.duration}ms`,
                        animationDelay: `${p.delay}ms`,
                        animationTimingFunction:
                          "cubic-bezier(0.16, 1, 0.3, 1)",
                        animationFillMode: "forwards",
                      } as React.CSSProperties
                    }
                  />
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ============ Sub-componente: badge con data_type ============ */
function DataTypeBadge({
  dataType,
  loading,
}: {
  dataType: ColumnDataType;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <span
        className="inline-flex h-4 w-16 rounded-full bg-muted animate-pulse"
        aria-label="Cargando tipo de dato"
      />
    );
  }
  const cfg: Record<
    ColumnDataType,
    { label: string; classes: string; example: string; required: boolean }
  > = {
    string: {
      label: "string",
      classes:
        "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800",
      example: '"texto"',
      required: false,
    },
    number: {
      label: "number",
      classes:
        "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800",
      example: "0.00",
      required: true,
    },
    boolean: {
      label: "boolean",
      classes:
        "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800",
      example: "true / false",
      required: false,
    },
  };
  const { label, classes, example, required } = cfg[dataType];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-1.5 h-4 text-[10px] font-mono leading-none",
        classes
      )}
      title={
        required
          ? `Tipo de dato: ${label} · OBLIGATORIO. Ejemplo: ${example}`
          : `Tipo de dato: ${label}. Ejemplo: ${example}`
      }
    >
      {label}
      <span className="opacity-60">· {example}</span>
      {required && (
        <span
          className="text-red-600 dark:text-red-400 font-bold"
          aria-label="Obligatorio"
        >
          *
        </span>
      )}
    </span>
  );
}