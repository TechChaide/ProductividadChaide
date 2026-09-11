"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CatalogOption } from "@/components/integrations/muestreos-ddpp/shared/catalog-select";
import type { Area } from "@/types/integrations/muestreos-ddpp";
import { areaService } from "@/services/integrations/muestreos-ddpp/area.service";
import { serviciosMuestreosService } from "@/services/integrations/muestreos-ddpp/serviciosMuestreos.service";
import { extractList, pickRowField } from "@/lib/integrations/muestreos-ddpp/extract-list";
import {
  matchesCentro,
  nombreAreaPorOrigen,
  pickMaquinaLabel,
  responsablesPorOrigenOTodas,
} from "@/lib/integrations/muestreos-ddpp/resolve-area-departamento";
import {
  esComodinCliente,
  esComodinProveedor,
  esComodinTienda,
  necesitaPedido,
} from "@/lib/integrations/muestreos-ddpp/comodin-captura";

/** Tipo de muletilla resuelto para el contexto actual (mutuamente excluyentes). */
type TipoMuletilla = "proveedor" | "tienda" | "cliente" | "none";

function resolveTipoMuletilla(
  motivo: string | undefined,
  origen: string,
  componente: string,
  habilitarExtendidas: boolean,
): TipoMuletilla {
  if (habilitarExtendidas && esComodinCliente(motivo)) return "cliente";
  if (habilitarExtendidas && esComodinTienda(origen, componente)) return "tienda";
  if (esComodinProveedor(motivo, origen)) return "proveedor";
  return "none";
}

export function useCapturaCatalogos(opts: {
  enabled: boolean;
  regional: string;
  origen: string;
  motivo?: string;
  departamento: string;
  componente: string;
  /**
   * Habilita las muletillas "tienda" y "cliente" (además de "proveedor",
   * que ya está disponible siempre).
   */
  habilitarMuletillasExtendidas?: boolean;
}) {
  const {
    enabled,
    regional,
    origen,
    motivo,
    departamento,
    componente,
    habilitarMuletillasExtendidas = false,
  } = opts;
  const centroUsuario = regional.trim();
  const origenSemiruta = origen.trim();
  const departamentoSeleccionado = departamento.trim();
  const componenteSeleccionado = componente.trim();

  const [maquinaOptions, setMaquinaOptions] = useState<CatalogOption[]>([]);
  const [maquinasLoading, setMaquinasLoading] = useState(false);
  const [maquinaHint, setMaquinaHint] = useState("");
  const [comodinOptions, setComodinOptions] = useState<CatalogOption[]>([]);
  const [comodinLoading, setComodinLoading] = useState(false);
  const [comodinHint, setComodinHint] = useState("");
  const [materialOptions, setMaterialOptions] = useState<CatalogOption[]>([]);
  const [materialesLoading, setMaterialesLoading] = useState(false);
  const [materialHint, setMaterialHint] = useState("");
  const [pedidoOptions, setPedidoOptions] = useState<CatalogOption[]>([]);
  const [pedidoLoading, setPedidoLoading] = useState(false);
  const [pedidoHint, setPedidoHint] = useState("");

  const mostrarSelectorPedido = necesitaPedido(motivo);

  const tipoMuletilla = resolveTipoMuletilla(
    motivo,
    origenSemiruta,
    componenteSeleccionado,
    habilitarMuletillasExtendidas,
  );

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const loadMaquinas = async () => {
      setMaquinasLoading(true);
      try {
        let rows: Record<string, unknown>[] = [];
        let nombreArea = "";
        if (origenSemiruta) {
          const areasRes = await areaService.getAll();
          const areas = extractList<Area>(areasRes);
          nombreArea = nombreAreaPorOrigen(areas, origenSemiruta);
        }
        if (nombreArea) {
          const res =
            await serviciosMuestreosService.getMAquinasByCentroYAreaOrigen(
              centroUsuario,
              nombreArea,
            );
          rows = extractList<Record<string, unknown>>(res);
          if (!cancelled) {
            setMaquinaHint(
              `Regional ${centroUsuario || "—"} · área ${nombreArea}`,
            );
          }
        } else {
          const res = await serviciosMuestreosService.getMaquinasMantenimiento();
          rows = extractList<Record<string, unknown>>(res).filter((row) =>
            matchesCentro(row, centroUsuario),
          );
          if (!cancelled) {
            setMaquinaHint(
              origenSemiruta
                ? `Sin área para el origen ${origenSemiruta}: mantenimiento por regional ${centroUsuario || "—"}`
                : `Sin origen: mantenimiento filtrado por regional ${centroUsuario || "—"}`,
            );
          }
        }
        if (cancelled) return;
        const seen = new Set<string>();
        const options: CatalogOption[] = [];
        rows.forEach((row) => {
          const label = pickMaquinaLabel(row);
          if (!label || seen.has(label)) return;
          seen.add(label);
          options.push({ value: label, label });
        });
        options.sort((a, b) => a.label.localeCompare(b.label, "es"));
        setMaquinaOptions(options);
      } catch {
        if (!cancelled) {
          setMaquinaOptions([]);
          setMaquinaHint("");
        }
      } finally {
        if (!cancelled) setMaquinasLoading(false);
      }
    };
    void loadMaquinas();
    return () => {
      cancelled = true;
    };
  }, [enabled, centroUsuario, origenSemiruta]);

  const clienteRequestIdRef = useRef(0);
  const cargarComodinClientes = useCallback(
    async (term: string) => {
      const requestId = ++clienteRequestIdRef.current;
      setComodinLoading(true);
      try {
        const res = await serviciosMuestreosService.getInformacionClientesInterlocutores(
          { Regional: centroUsuario, Busqueda: term },
        );
        if (requestId !== clienteRequestIdRef.current) return;
        const seen = new Set<string>();
        const options: CatalogOption[] = [];
        for (const f of extractList<Record<string, unknown>>(res)) {
          const identificacion = pickRowField(f, ["Identificacion", "IDENTIFICACION", "identificacion"]);
          const nombre = pickRowField(f, ["NombreInterlocutor", "NOMBREINTERLOCUTOR", "nombreInterlocutor"]);
          if (!identificacion || seen.has(identificacion)) continue;
          seen.add(identificacion);
          options.push({
            value: identificacion,
            label: nombre ? `${identificacion} — ${nombre}` : identificacion,
          });
        }
        setComodinOptions(options);
        setComodinHint(
          term
            ? `Clientes · ${centroUsuario || "—"}`
            : `Clientes · ${centroUsuario || "—"} (primeros ${options.length}, escribe para acotar)`,
        );
      } catch {
        if (requestId === clienteRequestIdRef.current) {
          setComodinOptions([]);
          setComodinHint("No se pudo buscar clientes.");
        }
      } finally {
        if (requestId === clienteRequestIdRef.current) setComodinLoading(false);
      }
    },
    [centroUsuario],
  );

  const clienteDebounceRef = useRef<number | null>(null);
  const buscarComodinCliente = useCallback(
    (texto: string) => {
      if (tipoMuletilla !== "cliente") return;
      if (clienteDebounceRef.current != null) {
        window.clearTimeout(clienteDebounceRef.current);
      }
      const term = texto.trim();
      setComodinLoading(true);
      clienteDebounceRef.current = window.setTimeout(() => {
        void cargarComodinClientes(term.length >= 2 ? term : "");
      }, 350);
    },
    [tipoMuletilla, cargarComodinClientes],
  );

  useEffect(() => {
    if (!enabled) return;

    if (tipoMuletilla === "proveedor") {
      if (!centroUsuario || !departamentoSeleccionado || !componenteSeleccionado) {
        setComodinOptions([]);
        setComodinLoading(false);
        setComodinHint("");
        return;
      }
      let cancelled = false;
      const loadComodinProveedores = async () => {
        setComodinLoading(true);
        try {
          const res = await serviciosMuestreosService.getInformacionProveedores(
            centroUsuario,
            departamentoSeleccionado,
            componenteSeleccionado,
          );
          if (cancelled) return;
          const seen = new Set<string>();
          const options: CatalogOption[] = [];
          for (const f of extractList<Record<string, unknown>>(res)) {
            const codigo = pickRowField(f, ["CODIGO", "Codigo", "codigo"]);
            const proveedor = pickRowField(f, [
              "PROVEEDOR",
              "Proveedor",
              "proveedor",
              "PROOVEEDOR",
            ]);
            if (!codigo || seen.has(codigo)) continue;
            seen.add(codigo);
            options.push({
              value: codigo,
              label: proveedor ? `${codigo} — ${proveedor}` : codigo,
            });
          }
          options.sort((a, b) => a.label.localeCompare(b.label, "es"));
          setComodinOptions(options);
          setComodinHint(
            `Proveedores · ${departamentoSeleccionado} / ${componenteSeleccionado}`,
          );
        } catch {
          if (!cancelled) {
            setComodinOptions([]);
            setComodinHint("");
          }
        } finally {
          if (!cancelled) setComodinLoading(false);
        }
      };
      void loadComodinProveedores();
      return () => {
        cancelled = true;
      };
    }

    if (tipoMuletilla === "tienda") {
      let cancelled = false;
      const loadComodinTiendas = async () => {
        setComodinLoading(true);
        try {
          const res = await serviciosMuestreosService.getInformacionTiendas();
          if (cancelled) return;
          const seen = new Set<string>();
          const options: CatalogOption[] = [];
          for (const f of extractList<Record<string, unknown>>(res)) {
            const codigo = pickRowField(f, ["OFICINAVENTAS", "OficinaVentas", "oficinaventas"]);
            const nombre = pickRowField(f, ["VENDEDOR", "Vendedor", "vendedor"]);
            if (!codigo || seen.has(codigo)) continue;
            seen.add(codigo);
            options.push({
              value: codigo,
              label: nombre ? `${codigo} — ${nombre}` : codigo,
            });
          }
          options.sort((a, b) => a.label.localeCompare(b.label, "es"));
          setComodinOptions(options);
          setComodinHint("Tiendas propias");
        } catch {
          if (!cancelled) {
            setComodinOptions([]);
            setComodinHint("");
          }
        } finally {
          if (!cancelled) setComodinLoading(false);
        }
      };
      void loadComodinTiendas();
      return () => {
        cancelled = true;
      };
    }

    if (tipoMuletilla === "cliente") {
      if (!centroUsuario) {
        setComodinOptions([]);
        setComodinLoading(false);
        setComodinHint("");
        return;
      }
      void cargarComodinClientes("");
      return;
    }

    setComodinOptions([]);
    setComodinLoading(false);
    setComodinHint("");
  }, [
    enabled,
    tipoMuletilla,
    centroUsuario,
    departamentoSeleccionado,
    componenteSeleccionado,
    cargarComodinClientes,
  ]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const loadMateriales = async () => {
      setMaterialesLoading(true);
      try {
        const areasRes = await areaService.getAll();
        const areas = extractList<Area>(areasRes);
        const { responsables: resp, fromOrigen } = responsablesPorOrigenOTodas(
          areas,
          origenSemiruta,
        );
        const seen = new Set<string>();
        const options: CatalogOption[] = [];
        const fuentes: string[] = [];

        if (centroUsuario && resp) {
          const res =
            await serviciosMuestreosService.getMaterialesByCentroResponsables(
              centroUsuario,
              resp,
            );
          if (cancelled) return;
          for (const f of extractList<Record<string, unknown>>(res)) {
            const material = pickRowField(f, [
              "MATERIAL",
              "Material",
              "material",
              "MATNR",
            ]);
            const descripcion = pickRowField(f, [
              "DESCRIPCION",
              "Descripcion",
              "descripcion",
              "MAKTX",
            ]);
            if (!material || seen.has(material)) continue;
            seen.add(material);
            options.push({
              value: material,
              label: descripcion ? `${material} - ${descripcion}` : material,
            });
          }
          fuentes.push(
            fromOrigen
              ? `materiales del origen ${origenSemiruta}`
              : "materiales de todas las áreas",
          );
        }

        if (cancelled) return;
        options.sort((a, b) => a.label.localeCompare(b.label, "es"));
        setMaterialOptions(options);
        setMaterialHint(fuentes.join(" · "));
      } catch {
        if (!cancelled) {
          setMaterialOptions([]);
          setMaterialHint("");
        }
      } finally {
        if (!cancelled) setMaterialesLoading(false);
      }
    };
    void loadMateriales();
    return () => {
      cancelled = true;
    };
  }, [enabled, centroUsuario, origenSemiruta]);

  const pedidoRequestIdRef = useRef(0);
  const cargarPedidos = useCallback(async (term: string) => {
    const requestId = ++pedidoRequestIdRef.current;
    setPedidoLoading(true);
    try {
      const res = await serviciosMuestreosService.getInformacionPedidos({
        Busqueda: term,
      });
      if (requestId !== pedidoRequestIdRef.current) return;
      const seen = new Set<string>();
      const options: CatalogOption[] = [];
      for (const f of extractList<Record<string, unknown>>(res)) {
        const pedido = pickRowField(f, ["PEDIDO", "Pedido", "pedido"]);
        const solicitante = pickRowField(f, [
          "NOMBRE_SOLICITANTE",
          "Nombre_Solicitante",
          "nombreSolicitante",
        ]);
        if (!pedido || seen.has(pedido)) continue;
        seen.add(pedido);
        options.push({
          value: pedido,
          label: solicitante ? `${pedido} — ${solicitante}` : pedido,
        });
      }
      setPedidoOptions(options);
      setPedidoHint(
        term
          ? "Pedidos que coinciden con la búsqueda"
          : `${options.length} pedidos más recientes, escribe para acotar`,
      );
    } catch {
      if (requestId === pedidoRequestIdRef.current) {
        setPedidoOptions([]);
        setPedidoHint("No se pudo buscar pedidos.");
      }
    } finally {
      if (requestId === pedidoRequestIdRef.current) setPedidoLoading(false);
    }
  }, []);

  const pedidoDebounceRef = useRef<number | null>(null);
  const buscarPedido = useCallback(
    (texto: string) => {
      if (!mostrarSelectorPedido) return;
      if (pedidoDebounceRef.current != null) {
        window.clearTimeout(pedidoDebounceRef.current);
      }
      const term = texto.trim();
      setPedidoLoading(true);
      pedidoDebounceRef.current = window.setTimeout(() => {
        void cargarPedidos(term.length >= 2 ? term : "");
      }, 350);
    },
    [mostrarSelectorPedido, cargarPedidos],
  );

  useEffect(() => {
    if (!enabled || !mostrarSelectorPedido) {
      setPedidoOptions([]);
      setPedidoLoading(false);
      setPedidoHint("");
      return;
    }
    void cargarPedidos("");
  }, [enabled, mostrarSelectorPedido, cargarPedidos]);

  return {
    maquinaOptions,
    maquinasLoading,
    maquinaHint,
    comodinOptions,
    comodinLoading,
    comodinHint,
    buscarComodinCliente,
    esComodinBusquedaEnVivo: tipoMuletilla === "cliente",
    materialOptions,
    materialesLoading,
    materialHint,
    mostrarSelectorPedido,
    pedidoOptions,
    pedidoLoading,
    pedidoHint,
    buscarPedido,
  };
}
