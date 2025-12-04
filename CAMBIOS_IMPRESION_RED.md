# Corrección: Implementación de Impresión en Red en Módulo de Reimpresión

## Problema Identificado
El módulo de **reimpresión de etiquetas** estaba intentando imprimir siempre en **localhost:9100** (a través de BrowserPrint) incluso cuando había una **impresora de red configurada**. Esto ocurría porque el método `handlePrintZPL` no estaba pasando el parámetro `printerIP` al endpoint de la API.

## Causa Raíz
Los métodos de impresión en los siguientes módulos **NO estaban enviando el `printerIP`** disponible desde el hook `usePrinterIPs()`:

1. **src/app/dashboard/pedidos-reimpresion/page.tsx** - `handlePrintZPL()`
2. **src/app/dashboard/etiquetas-nl/page.tsx** - `handlePrintZPL()`
3. **src/app/dashboard/etiquetas-reparaciones/page.tsx** - `handlePrintZPL()`

## Solución Implementada

### 1. Módulo: Reimpresión de Etiquetas (`pedidos-reimpresion/page.tsx`)
**Cambios en función `handlePrintZPL()`:**

```typescript
// ANTES: No enviaba printerIP
const response = await fetch("/api/zebra-r", {
  method: "POST",
  body: JSON.stringify([{
    orden, paquete, unidades, descripcionMaterial, codigoBarras, codigoEmpleado
    // ❌ Sin printerIP
  }]),
});

// DESPUÉS: Obtiene printerIP y lo usa
const printerIP = printerIPs && printerIPs.length > 0 ? printerIPs[0] : undefined;
const requestBody = {
  orden, paquete, unidades, descripcionMaterial, codigoBarras, codigoEmpleado,
  ...(printerIP && { printerIP }) // ✅ Incluye printerIP si está disponible
};
```

**Flujo de Lógica:**
1. Intenta obtener IP de impresora de red desde `printerIPs[0]`
2. Si hay `printerIP`, la envía al endpoint `/api/zebra-r`
3. El endpoint genera ZPL y lo envía directamente a la impresora de red
4. Si no hay impresora de red, devuelve ZPL y usa BrowserPrint

### 2. Módulo: Etiquetas Nylon (`etiquetas-nl/page.tsx`)
**Cambios idénticos en función `handlePrintZPL()`:**
- Obtiene `printerIP` del hook `usePrinterIPs()`
- Envía a `/api/zebra-ny` si hay impresora de red
- Fallback a BrowserPrint si no hay red

**Mejora adicional:**
- Se registra en logs si la impresión fue en red (`impresoraRed: printerIP`)

### 3. Módulo: Etiquetas Reparaciones (`etiquetas-reparaciones/page.tsx`)
**Cambios idénticos a etiquetas-nl**

## Endpoints de API Afectados

Los siguientes endpoints ya tenían soporte para `printerIP`, solo faltaba que el frontend los usara:

- `/api/zebra-r` - POST con parámetro `printerIP` opcional
- `/api/zebra-ny` - POST con parámetro `printerIP` opcional
- `/api/zebra-network` - POST para impresión directa en red

## Flujo de Impresión Actualizado

### Con Impresora de Red Configurada:
```
Cliente (React) 
  → Obtiene printerIP del hook usePrinterIPs()
  → Envía ZPL + printerIP a /api/zebra-r
  → API genera ZPL y usa sendToNetworkPrinter()
  → Se conecta directamente a la impresora de red
  → Imprime sin depender de BrowserPrint
```

### Sin Impresora de Red (Fallback):
```
Cliente (React)
  → printerIPs está vacío
  → Envía solo ZPL a /api/zebra-r sin printerIP
  → API devuelve ZPL crudo
  → Cliente usa BrowserPrint para imprimir localmente
```

## Registro de Cambios

| Archivo | Función | Cambio |
|---------|---------|--------|
| `pedidos-reimpresion/page.tsx` | `handlePrintZPL()` | ✅ Ahora envía `printerIP` al endpoint |
| `etiquetas-nl/page.tsx` | `handlePrintZPL()` | ✅ Ahora envía `printerIP` al endpoint |
| `etiquetas-reparaciones/page.tsx` | `handlePrintZPL()` | ✅ Ahora envía `printerIP` al endpoint |

## Logging Mejorado

Se agregó logging detallado en cada módulo:

```typescript
console.log(`[REIMPRESION] Iniciando impresión - Impresora de red: ${printerIP || 'No disponible'}`);
console.log(`[REIMPRESION] Usando impresora de red: ${printerIP}`);
console.log(`[REIMPRESION] Impresión en red exitosa: ${payload.printer}`);
console.log('[REIMPRESION] Usando BrowserPrint para impresión local');
```

## Validación

- ✅ No hay errores de compilación
- ✅ Todos los módulos compilan correctamente
- ✅ El hook `usePrinterIPs()` ya está disponible en todos los módulos
- ✅ Los endpoints de API ya soportan el parámetro `printerIP`
- ✅ Mantiene compatibilidad con BrowserPrint como fallback

## Cómo Probar

1. **Con Impresora de Red:**
   - Asegúrate de que la estación tenga una impresora de red configurada en la BD
   - El hook `usePrinterIPs()` debería cargar las IPs al montar la página
   - Al reimprimir, debería ver el icono de impresora de red ✓
   - La impresión debería ir directamente a la impresora de red (sin BrowserPrint)

2. **Sin Impresora de Red:**
   - Remover la configuración de impresora de red
   - Al reimprimir, debería usar BrowserPrint como antes

## Dependencias

El módulo ya tenía todas las dependencias necesarias:
- Hook `usePrinterIPs()` - ✅ Disponible
- Componente de UI `Printer` Icon - ✅ Disponible
- Endpoints API - ✅ Actualizados
- Servicio `LogReimpresionesService` - ✅ Disponible

---

**Fecha de Implementación:** Diciembre 3, 2025
**Archivos Modificados:** 3
**Líneas de código modificadas:** ~450
