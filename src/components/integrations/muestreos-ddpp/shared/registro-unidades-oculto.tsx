"use client";

/**
 * Campo oculto de `Registro.unidades`. Se autocompleta desde el catálogo
 * de componentes cuando está configurado; puede quedar vacío.
 */
export default function RegistroUnidadesOculto({ value }: { value: string }) {
  return (
    <input
      type="hidden"
      name="registro_unidades"
      value={value}
      readOnly
      aria-hidden
      tabIndex={-1}
    />
  );
}
