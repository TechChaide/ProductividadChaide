"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { authMuestreosDdppService } from "@/services/integrations/muestreos-ddpp/auth.service";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, Loader2, User, X } from "lucide-react";
import type { FichaSocialHistorica } from "@/types/integrations/muestreos-ddpp";
import CatalogSelect, { type CatalogOption } from "@/components/integrations/muestreos-ddpp/shared/catalog-select";

/**
 * Separador usado para unir múltiples usuarios en un único string.
 * El backend persiste este valor directamente en `usuario_calidad`,
 * por lo que NO debe cambiarse sin migrar los datos existentes.
 */
export const USER_SEPARATOR = " & ";

interface UserAutocompleteProps {
  /** Valor controlado: tokens unidos por ` & `, p.ej. `"123 — Juan & 456 — María"`. */
  value: string;
  /** Se invoca con el nuevo string concatenado cada vez que se añade o quita un usuario. */
  onChange: (value: string) => void;
  /** ID para accesibilidad (se vincula al <input>). */
  inputId?: string;
  /** Placeholder del input. */
  placeholder?: string;
  /** Callback opcional que recibe el objeto completo al seleccionar. */
  onSelect?: (user: FichaSocialHistorica) => void;
  /** Deshabilitar el input y los botones de quitar. */
  disabled?: boolean;
  /** Limite de sugerencias a mostrar (default 8). */
  maxSuggestions?: number;
  /**
   * `true` (default): varios usuarios unidos por `USER_SEPARATOR`.
   * `false`: un solo código; la nueva selección reemplaza la anterior.
   */
  multiple?: boolean;
  /** Filtra el catálogo por defecto (p.ej. mismo departamento). Al buscar, incluye todos si no hay coincidencias en el alcance. */
  filterUser?: (user: FichaSocialHistorica) => boolean;
  className?: string;
  /**
   * Al hacer click/focus, muestra el catálogo completo (luego se filtra al escribir).
   * Default `false` para no inundar formularios con listas enormes.
   */
  showAllOnOpen?: boolean;
  /**
   * Solo elegir de la lista (sin texto libre).
   * Se puede escribir para buscar; al seleccionar, el valor queda fijo.
   */
  selectOnly?: boolean;
}

export default function UserAutocomplete({
  value,
  onChange,
  inputId,
  placeholder = "Buscar por nombre, código o cédula...",
  onSelect,
  disabled = false,
  maxSuggestions = 8,
  multiple = true,
  filterUser,
  className,
  showAllOnOpen = false,
  selectOnly = false,
}: UserAutocompleteProps) {
  const { toast } = useToast();
  const [fullUsers, setFullUsers] = useState<FichaSocialHistorica[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Parsea el string controlado en tokens individuales.
  const tokens = useMemo(
    () =>
      value
        .split(USER_SEPARATOR)
        .map((t) => t.trim())
        .filter(Boolean),
    [value],
  );

  // Carga única al montar (catálogo completo; el filtro de departamento es preferencia, no bloqueo).
  useEffect(() => {
    let cancelled = false;
    const fetchUsers = async () => {
      setIsLoading(true);
      try {
        const res = await authMuestreosDdppService.getUsersInfo();
        if (cancelled) return;
        const list = (res.data ?? []) as unknown as FichaSocialHistorica[];
        list.sort((a, b) =>
          (a.NOMBRE ?? "").localeCompare(b.NOMBRE ?? "", "es"),
        );
        setFullUsers(list);
      } catch (error) {
        const msg =
          error instanceof Error
            ? error.message
            : "No se pudo cargar la lista de usuarios.";
        toast({
          title: "Error",
          description: msg,
          variant: "destructive",
        });
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void fetchUsers();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  const scopedUsers = useMemo(() => {
    if (!filterUser) return fullUsers;
    return fullUsers.filter(filterUser);
  }, [fullUsers, filterUser]);

  const sortUsersByName = (a: FichaSocialHistorica, b: FichaSocialHistorica) =>
    (a.NOMBRE ?? "").localeCompare(b.NOMBRE ?? "", "es");

  const sortUsersPreferScope = (users: FichaSocialHistorica[]) => {
    if (!filterUser) return [...users].sort(sortUsersByName);
    return [...users].sort((a, b) => {
      const aInScope = filterUser(a) ? 0 : 1;
      const bInScope = filterUser(b) ? 0 : 1;
      if (aInScope !== bInScope) return aInScope - bInScope;
      return sortUsersByName(a, b);
    });
  };

  // Cierra el dropdown al hacer click fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const matchesSearch = (u: FichaSocialHistorica, q: string) => {
    const haystack = [
      u.NOMBRE ?? "",
      u.CODIGO ?? "",
      u.CEDULA ?? "",
      u.DEPARTAMENTO ?? "",
      u.GRUPO_DEPARTAMENTO ?? "",
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  };

  // Filtra usuarios por búsqueda. Sin texto: alcance preferido (departamento).
  // Con texto: primero el alcance; si no hay coincidencias, fallback a todos.
  const suggestions = useMemo(() => {
    const available = fullUsers.filter((u) => {
      if (multiple && tokens.includes(u.CODIGO)) return false;
      if (!multiple && tokens[0] === u.CODIGO) return false;
      return true;
    });
    const q = searchText.trim().toLowerCase();

    if (!q) {
      const pool = showAllOnOpen ? scopedUsers : [];
      return maxSuggestions > 0 ? pool.slice(0, maxSuggestions) : pool;
    }

    const inScope = available.filter(
      (u) => (!filterUser || filterUser(u)) && matchesSearch(u, q),
    );
    const pool =
      inScope.length > 0
        ? inScope
        : available.filter((u) => matchesSearch(u, q));

    if (!showAllOnOpen && maxSuggestions > 0) {
      return pool.slice(0, maxSuggestions);
    }
    return pool;
  }, [
    fullUsers,
    scopedUsers,
    searchText,
    tokens,
    maxSuggestions,
    multiple,
    showAllOnOpen,
    filterUser,
  ]);

  // Busca un usuario por CODIGO dentro del catálogo cargado.
  const findUserByCodigo = (codigo: string): FichaSocialHistorica | undefined =>
    fullUsers.find((u) => u.CODIGO === codigo);

  const commit = (newTokens: string[]) => {
    onChange(newTokens.join(USER_SEPARATOR));
  };

  const handleSelect = (user: FichaSocialHistorica) => {
    const token = user.CODIGO;
    if (multiple) {
      if (tokens.includes(token)) {
        setSearchText("");
        return;
      }
      commit([...tokens, token]);
    } else {
      commit([token]);
      setIsOpen(false);
    }
    onSelect?.(user);
    setSearchText("");
    setActiveIndex(-1);
    inputRef.current?.focus();
  };

  const handleRemove = (token: string) => {
    commit(tokens.filter((t) => t !== token));
  };

  const handleFreeTextCommit = () => {
    const text = searchText.trim();
    if (!text) return;
    if (multiple) {
      if (tokens.includes(text)) {
        setSearchText("");
        return;
      }
      commit([...tokens, text]);
    } else {
      commit([text]);
      setIsOpen(false);
    }
    setSearchText("");
    setActiveIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIsOpen(true);
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && suggestions[activeIndex]) {
        handleSelect(suggestions[activeIndex]);
      } else {
        handleFreeTextCommit();
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
    } else if (e.key === "Backspace" && searchText === "" && tokens.length > 0) {
      // UX: backspace sobre input vacío borra el último token
      e.preventDefault();
      commit(tokens.slice(0, -1));
    }
  };

  const selectOnlyOptions = useMemo<CatalogOption[]>(
    () =>
      sortUsersPreferScope(fullUsers).map((u) => ({
        value: u.CODIGO,
        label: u.NOMBRE ? `${u.NOMBRE} (${u.CODIGO})` : u.CODIGO,
        subtitle: u.DEPARTAMENTO || undefined,
      })),
    [fullUsers, filterUser],
  );


  if (selectOnly) {
    const selectedCodigo = tokens[0] ?? "";
    return (
      <CatalogSelect
        id={inputId ?? "user-select"}
        value={selectedCodigo}
        onChange={(codigo) => {
          commit(codigo ? [codigo] : []);
          const user = fullUsers.find((u) => u.CODIGO === codigo);
          if (user) onSelect?.(user);
        }}
        options={selectOnlyOptions}
        isLoading={isLoading}
        disabled={disabled}
        placeholder={placeholder}
        emptyMessage="No hay empleados que coincidan. Prueba otro nombre o código."
        searchPlaceholder="Buscar por nombre o código..."
        hint={''}
        className={className}
      />
    );
  }

  return (
    <div ref={containerRef} className={cn("w-full space-y-2", className)}>
      {/* Badges de usuarios ya seleccionados. Cada token es solo el
          CODIGO; si el usuario existe en el catálogo, mostramos también
          su NOMBRE. Si no (texto libre), se muestra el CODIGO tal cual. */}
      {tokens.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tokens.map((token) => {
            const u = findUserByCodigo(token);
            const label = u
              ? `${u.NOMBRE} (${u.CODIGO})${
                  u.DEPARTAMENTO ? ` · ${u.DEPARTAMENTO}` : ""
                }`
              : token;
            return (
              <span
                key={token}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium",
                  "bg-blue-50 text-blue-900 border-blue-200",
                  "dark:bg-blue-950/40 dark:text-blue-100 dark:border-blue-800",
                )}
              >
                <User className="h-3 w-3 shrink-0" />
                <span className="truncate max-w-[260px]">{label}</span>
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => handleRemove(token)}
                    className={cn(
                      "ml-0.5 rounded-sm p-0.5",
                      "hover:bg-blue-200/70 dark:hover:bg-blue-800/60",
                    )}
                    aria-label={`Quitar ${label}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            );
          })}
        </div>
      )}

      {/* Input + dropdown en un wrapper relativo */}
      <div className="relative">
        <User className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          value={searchText}
          disabled={disabled}
          onChange={(e) => {
            setSearchText(e.target.value);
            setIsOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => {
            if (fullUsers.length > 0) setIsOpen(true);
          }}
          onClick={() => {
            if (fullUsers.length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={isLoading ? "Cargando usuarios..." : placeholder}
          autoComplete="off"
          className={cn(
            "flex h-9 w-full rounded-md border border-input bg-background pl-9 pr-9 py-1 text-sm shadow-sm",
            "placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onMouseDown={(e) => {
            e.preventDefault();
            inputRef.current?.focus();
            if (fullUsers.length > 0) setIsOpen((open) => !open);
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:text-foreground"
          aria-label="Mostrar usuarios"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
        {isLoading && (
          <Loader2 className="pointer-events-none absolute right-9 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
        )}

        {isOpen && suggestions.length > 0 && (
          <ul
            role="listbox"
            className={cn(
              "absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-md border bg-popover shadow-md",
              "p-1 text-sm",
            )}
          >
            {suggestions.map((u, idx) => {
              const highlighted = idx === activeIndex;
              return (
                <li
                  key={`${u.CODIGO}-${u.CEDULA}`}
                  role="option"
                  aria-selected={highlighted}
                  onMouseDown={(e) => {
                    // mousedown para no perder el focus del input
                    e.preventDefault();
                    handleSelect(u);
                  }}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={cn(
                    "flex cursor-pointer items-start gap-2 rounded-sm px-2 py-1.5",
                    highlighted ? "bg-accent text-accent-foreground" : "",
                  )}
                >
                  <Check
                    className={cn(
                      "mt-0.5 h-4 w-4 shrink-0",
                      highlighted ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{u.NOMBRE}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      Cód: {u.CODIGO}
                      {u.DEPARTAMENTO ? ` · ${u.DEPARTAMENTO}` : ""}
                      {u.CEDULA ? ` · Céd: ${u.CEDULA}` : ""}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {isOpen &&
          searchText.trim().length > 0 &&
          suggestions.length === 0 &&
          !isLoading && (
            <div
              className={cn(
                "absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md",
                "p-3 text-sm text-muted-foreground text-center",
              )}
            >
              No se encontraron usuarios. Pulsa{" "}
              <kbd className="rounded border px-1 text-[10px]">Enter</kbd> para
              añadir “{searchText}” como texto libre.
            </div>
          )}
      </div>
    </div>
  );
}