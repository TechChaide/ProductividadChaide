"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Camera,
  CheckCircle2,
  Image as ImageIcon,
  Keyboard,
  QrCode,
  Radar,
  RefreshCw,
  ScanLine,
  XCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { codesGRService, type ReadMode } from "@/services/integrations/muestreos-ddpp/codegr.service";

interface ScannerPanelProps {
  /** Se dispara con el texto decodificado del QR / código de barras. */
  onScan?: (value: string) => void;
}

/**
 * Lock a nivel de MÓDULO para evitar capturas concurrentes incluso si
 * React.StrictMode monta dos instancias del componente o si el padre
 * re-renderiza muy rápido y el handler cambia de identidad.
 */
let moduleCaptureLock = false;
let lastCaptureAt = 0;
const CAPTURE_THROTTLE_MS = 1500;

type CodeKind = "qr" | "barcode";

interface DetectResult {
  kind: CodeKind;
  data: string[];
}

export default function ScannerPanel({ onScan }: ScannerPanelProps) {
  const { toast } = useToast();

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // Guarda síncrona contra capturas concurrentes.
  const isCapturingRef = useRef(false);

  const [openValue, setOpenValue] = useState<string>("");
  const [isStarting, setIsStarting] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isDecoding, setIsDecoding] = useState(false);
  const [scannedValue, setScannedValue] = useState("");
  const [scannedKind, setScannedKind] = useState<CodeKind | null>(null);
  const [capturedImageUrl, setCapturedImageUrl] = useState<string>("");
  const [error, setError] = useState("");
  /** Modo de envío al backend: "json" usa image_base64, "multipart" sube el archivo. */
  const [readMode, setReadMode] = useState<ReadMode>("json");
  /** Valor del input manual (cuando el backend no detecta nada). */
  const [manualValue, setManualValue] = useState("");
  /** Indica que el último intento fue "no detectado" para mostrar el fallback manual. */
  const [showManualFallback, setShowManualFallback] = useState(false);
  /** Fallos consecutivos del backend (resetea al escanear de nuevo). */
  const [backendFailCount, setBackendFailCount] = useState(0);
  /** Modo activo: "backend" (captura única) o "live" (html5-qrcode continuo). */
  const [scanMode, setScanMode] = useState<"backend" | "live">("backend");
  /** Instancia activa de Html5Qrcode para poder detenerla. */
  const html5QrRef = useRef<any>(null);

  const stopCamera = useCallback(() => {
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    const video = videoRef.current;
    if (video) {
      video.srcObject = null;
    }
    setIsCameraReady(false);
  }, []);

  const startCamera = useCallback(async () => {
    setError("");
    setScannedValue("");
    setScannedKind(null);
    setCapturedImageUrl("");
    setShowManualFallback(false);
    setManualValue("");
    setIsStarting(true);
    stopCamera();

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }
      streamRef.current = stream;

      if (!videoRef.current) {
        throw new Error("No se encontró el elemento de video.");
      }

      videoRef.current.srcObject = stream;

      // Espera a que el <video> esté reproduciendo (fix móvil).
      await new Promise<void>((resolve) => {
        const video = videoRef.current;
        if (!video) return resolve();

        let settled = false;
        const cleanup = () => {
          video.removeEventListener("playing", onPlaying);
          video.removeEventListener("loadeddata", onLoaded);
        };
        const onPlaying = () => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve();
        };
        const onLoaded = () => {
          video
            .play()
            .then(() => {
              if (settled) return;
              settled = true;
              cleanup();
              resolve();
            })
            .catch(() => {
              if (settled) return;
              settled = true;
              cleanup();
              resolve();
            });
        };
        video.addEventListener("playing", onPlaying);
        video.addEventListener("loadeddata", onLoaded);

        video.play().catch(() => {
          // Si falla por autoplay, esperamos al fallback loadeddata.
        });

        window.setTimeout(() => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve();
        }, 3000);
      });

      videoRef.current.setAttribute("playsinline", "true");
      videoRef.current.setAttribute("webkit-playsinline", "true");

      // Aseguramos que el video tenga dimensiones reales antes de capturar.
      if (videoRef.current.videoWidth === 0) {
        await new Promise<void>((resolve) => {
          const video = videoRef.current;
          if (!video) return resolve();
          const maxWait = window.setTimeout(resolve, 2000);
          const checkDimensions = () => {
            if (!videoRef.current) {
              clearTimeout(maxWait);
              resolve();
              return;
            }
            if (videoRef.current.videoWidth > 0) {
              clearTimeout(maxWait);
              resolve();
              return;
            }
            window.requestAnimationFrame(checkDimensions);
          };
          window.requestAnimationFrame(checkDimensions);
        });
      }

      setIsCameraReady(true);
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : "No se pudo iniciar la cámara. Revisa los permisos del navegador.";
      setError(msg);
    } finally {
      setIsStarting(false);
    }
  }, [stopCamera]);

  /**
   * Decodifica un código desde el backend probando primero QR y luego
   * Barcode. El servicio devuelve `data` poblado cuando detecta algo.
   * Si ambos endpoints devuelven `data` vacío, considera "no detectado".
   */
  const detectFromBackend = useCallback(
    async (image: File | Blob): Promise<DetectResult | null> => {
      // 1) Probamos QR
      try {
        const qr = await codesGRService.readQR(image, readMode);
        const data = (qr as any)?.data ?? [];
        if (Array.isArray(data) && data.length > 0) {
          return { kind: "qr", data: data.filter(Boolean) };
        }
      } catch (e) {
        console.warn("readQR failed:", e);
      }

      // 2) Probamos Barcode
      try {
        const bc = await codesGRService.readBarcode(image, readMode);
        const data = (bc as any)?.data ?? [];
        if (Array.isArray(data) && data.length > 0) {
          return { kind: "barcode", data: data.filter(Boolean) };
        }
        // Algunos Barcode endpoints devuelven el valor en el root.
        const root =
          (bc as any)?.value ?? (bc as any)?.code ?? (bc as any)?.text;
        if (typeof root === "string" && root.trim().length > 0) {
          return { kind: "barcode", data: [root.trim()] };
        }
      } catch (e) {
        console.warn("readBarcode failed:", e);
      }

      return null;
    },
    [readMode]
  );

  /**
   * Toma el frame actual del <video>, lo dibuja en un canvas, lo manda
   * al backend (/api/qr/read o /api/barcode/read) y, según el resultado,
   * dispara `onScan` con el primer valor detectado.
   */
  const captureFrame = useCallback(async () => {
    if (moduleCaptureLock) return;
    const now = Date.now();
    if (now - lastCaptureAt < CAPTURE_THROTTLE_MS) return;
    lastCaptureAt = now;
    moduleCaptureLock = true;

    if (isCapturingRef.current) {
      moduleCaptureLock = false;
      return;
    }
    isCapturingRef.current = true;

    const video = videoRef.current;
    if (!video || !isCameraReady) {
      isCapturingRef.current = false;
      moduleCaptureLock = false;
      return;
    }

    setIsDecoding(true);
    setError("");

    try {
      // 1) Capturamos el frame en un canvas.
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("No se pudo crear el contexto del canvas.");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // 2) Generamos Blob (para subir) y dataURL (preview local).
      const blob: Blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (b) =>
            b ? resolve(b) : reject(new Error("No se pudo convertir la imagen")),
          "image/jpeg",
          0.85
        );
      });
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      setCapturedImageUrl(dataUrl);

      // 3) Enviamos al backend (envuelto en File con nombre).
      const payload = new File([blob], "capture.jpg", { type: blob.type });
      const result = await detectFromBackend(payload);

      if (!result) {
        // Marcamos el flag para mostrar el fallback de entrada manual.
        setShowManualFallback(true);
        // Contamos el fallo consecutivo y, si llegamos al umbral, sugerimos
        // el escaneo en vivo con html5-qrcode.
        setBackendFailCount((prev) => {
          const next = prev + 1;
          if (next >= 2) {
            toast({
              title: "El backend no detecta el código",
              description:
                "Prueba el escaneo en vivo: detecta códigos en tiempo real sin enviar al servidor.",
            });
          }
          return next;
        });
        throw new Error("NOT_FOUND");
      }

      const rawText = result.data[0]?.trim() ?? "";
      if (!rawText) {
        throw new Error("NOT_FOUND");
      }

      // Si el QR viene en una URL con param `code=`, extraemos ese valor.
      let text = rawText;
      try {
        const looksLikeUrl =
          /^[a-z][a-z0-9+.-]*:\/\//i.test(rawText) ||
          rawText.includes("?code=");
        if (looksLikeUrl) {
          const parseable = /^[a-z][a-z0-9+.-]*:\/\//i.test(rawText)
            ? rawText
            : `https://placeholder.local/?${rawText.split("?").pop() ?? ""}`;
          const url = new URL(parseable);
          const code = url.searchParams.get("code");
          if (code && code.trim().length > 0) text = code.trim();
        }
      } catch {
        // Si el parseo de URL falla, usamos el texto crudo.
      }

      setScannedValue(text);
      setScannedKind(result.kind);
      stopCamera();
      onScan?.(text);
      toast({
        title:
          result.kind === "qr"
            ? "QR detectado por backend"
            : "Código de barras detectado por backend",
        description: text,
        variant: "default",
      });
    } catch (e: any) {
      const isNotFound =
        e?.message === "NOT_FOUND" ||
        e?.name === "NotFoundException" ||
        /NotFoundException/i.test(e?.message ?? "");
      if (isNotFound) {
        toast({
          title: "No se detectó código",
          description:
            "Apunta mejor al QR/código de barras y vuelve a intentarlo.",
          variant: "destructive",
        });
      } else {
        const msg =
          e instanceof Error ? e.message : "No se pudo procesar la imagen.";
        setError(msg);
      }
    } finally {
      setIsDecoding(false);
      isCapturingRef.current = false;
      moduleCaptureLock = false;
    }
  }, [detectFromBackend, isCameraReady, onScan, stopCamera, toast]);

  const handleOpenChange = (value: string) => {
    setOpenValue(value);
    if (value === "scanner") {
      window.setTimeout(() => {
        void startCamera();
      }, 350);
    } else {
      stopCamera();
      setScannedValue("");
      setScannedKind(null);
      setCapturedImageUrl("");
      setError("");
      setShowManualFallback(false);
      setManualValue("");
    }
  };

  /**
   * Acepta el valor escrito manualmente y lo entrega igual que si
   * viniera del backend. Marcamos el origen como "manual" para que
   * el padre pueda distinguir si lo necesita.
   */
  const handleManualSubmit = useCallback(() => {
    const trimmed = manualValue.trim();
    if (!trimmed) {
      toast({
        title: "Valor vacío",
        description: "Escribe el código antes de continuar.",
        variant: "destructive",
      });
      return;
    }

    setScannedValue(trimmed);
    setScannedKind(null); // sin origen backend
    setShowManualFallback(false);
    stopCamera();
    onScan?.(trimmed);
    toast({
      title: "Código ingresado manualmente",
      description: trimmed,
      variant: "default",
    });
  }, [manualValue, onScan, stopCamera, toast]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return (
    <Accordion
      type="single"
      collapsible
      value={openValue}
      onValueChange={handleOpenChange}
      className="rounded-2xl border border-black/5 bg-white/70 backdrop-blur-xl shadow-sm ring-1 ring-black/5"
    >
      <AccordionItem value="scanner" className="border-none">
        <AccordionTrigger className="px-4 py-3.5 hover:no-underline [&[data-state=open]>div>.chevron-hint]:hidden">
          <div className="flex items-center gap-3 w-full">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-blue-500 text-primary-foreground shadow-md shadow-primary/30">
              <QrCode className="h-5 w-5" />
            </span>
            <div className="text-left">
              <p className="text-[15px] font-semibold tracking-tight">
                Escanear QR / código de barras
              </p>
              <p className="text-xs text-muted-foreground">
                Apunta la cámara y pulsa "Capturar foto". La decodificación
                se hace en el backend.
              </p>
            </div>
            {scannedValue ? (
              <Badge
                className={`ml-auto mr-2 gap-1 rounded-full border-none ${
                  scannedKind
                    ? "bg-green-100 text-green-700"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                <CheckCircle2 className="h-3 w-3" />
                {scannedKind ? "Capturado" : "Ingresado manual"}
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="ml-auto mr-2 gap-1 rounded-full border-primary/20 bg-primary/5 text-primary chevron-hint"
              >
                <Camera className="h-3 w-3" />
                Abrir cámara
              </Badge>
            )}
          </div>
        </AccordionTrigger>

        <AccordionContent className="px-0 pb-4 sm:px-4">
          <div className="space-y-4">
            {/* Selector de modo de envío */}
            <div className="flex flex-wrap items-center gap-2 px-3 text-xs text-muted-foreground sm:px-0">
              <Label htmlFor="read-mode" className="text-xs">
                Modo de envío al backend:
              </Label>
              <select
                id="read-mode"
                className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                value={readMode}
                onChange={(e) => setReadMode(e.target.value as ReadMode)}
                disabled={isDecoding}
              >
                <option value="json">JSON (image_base64)</option>
                <option value="multipart">Multipart (archivo)</option>
              </select>
              <span className="ml-auto">
                {scannedKind ? (
                  <Badge variant="outline" className="rounded-full">
                    {scannedKind === "qr" ? "QR" : "Barcode"}
                  </Badge>
                ) : null}
              </span>
            </div>

            {/* Visor de la cámara */}
            <div className="relative w-screen sm:mx-auto sm:w-full sm:max-w-md aspect-[4/3] overflow-hidden rounded-none sm:rounded-[1.75rem] border-y border-white/10 sm:border bg-black shadow-inner">
              {scannedValue && capturedImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={capturedImageUrl}
                  alt="Foto capturada"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <video
                  ref={videoRef}
                  className="absolute inset-0 h-full w-full object-cover"
                  muted
                  playsInline
                />
              )}

              {isCameraReady && !scannedValue && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="relative h-40 w-56">
                    <span className="absolute left-0 top-0 h-6 w-6 rounded-tl-xl border-l-[3px] border-t-[3px] border-white/90" />
                    <span className="absolute right-0 top-0 h-6 w-6 rounded-tr-xl border-r-[3px] border-t-[3px] border-white/90" />
                    <span className="absolute bottom-0 left-0 h-6 w-6 rounded-bl-xl border-b-[3px] border-l-[3px] border-white/90" />
                    <span className="absolute bottom-0 right-0 h-6 w-6 rounded-br-xl border-b-[3px] border-r-[3px] border-white/90" />
                  </div>
                </div>
              )}

              {(isStarting || (!isCameraReady && !error && !scannedValue)) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/40 text-white/85 backdrop-blur-sm">
                  <span className="text-xs font-medium">Iniciando cámara…</span>
                </div>
              )}

              {isDecoding && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 text-white/85 backdrop-blur-sm">
                  <span className="text-xs font-medium">
                    Consultando backend…
                  </span>
                </div>
              )}

              {isCameraReady && !isDecoding && !scannedValue && (
                <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
                  <Badge className="gap-1 rounded-full border-none bg-white/85 text-slate-800 shadow-sm backdrop-blur">
                    <ScanLine className="h-3 w-3 text-primary" />
                    Apunta y captura
                  </Badge>
                </div>
              )}
            </div>

            {/* Botón de captura / reintentar */}
            <div className="flex flex-col items-center gap-2 px-3 sm:px-0">
              {!scannedValue ? (
                <Button
                  type="button"
                  size="lg"
                  className="rounded-full px-6 touch-manipulation select-none"
                  onPointerDown={() => void captureFrame()}
                  disabled={!isCameraReady || isStarting || isDecoding}
                >
                  <Camera className="mr-2 h-4 w-4" />
                  {isDecoding ? "Consultando…" : "Capturar foto"}
                </Button>
              ) : null}
            </div>

            {/* Fallback: entrada manual cuando el backend no detecta nada */}
            {showManualFallback && !scannedValue && (
              <div className="mx-3 rounded-2xl border border-amber-100 bg-amber-50/70 p-3 backdrop-blur sm:mx-0">
                <div className="mb-2 flex items-center gap-2 text-amber-900">
                  <Keyboard className="h-4 w-4" />
                  <p className="text-sm font-medium">
                    No se detectó código. Ingrésalo manualmente:
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={manualValue}
                    onChange={(e) => setManualValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleManualSubmit();
                      }
                    }}
                    placeholder="Escribe o pega el código…"
                    className="rounded-xl bg-white font-mono"
                    autoFocus
                    inputMode="text"
                  />
                  <Button
                    type="button"
                    className="rounded-full"
                    onClick={handleManualSubmit}
                    disabled={manualValue.trim().length === 0}
                  >
                    Usar este código
                  </Button>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mx-3 flex items-start gap-2 rounded-2xl border border-red-100 bg-red-50/80 p-3 text-sm text-red-800 backdrop-blur sm:mx-0">
                <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium">No se pudo iniciar la cámara</p>
                  <p className="text-xs">{error}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => void startCamera()}
                >
                  <RefreshCw className="mr-2 h-3.5 w-3.5" />
                  Reintentar
                </Button>
              </div>
            )}

            {/* Valor capturado */}
            <div className="space-y-1.5 px-3 sm:px-0">
              <Label htmlFor="scanned-value" className="text-xs">
                Valor capturado
              </Label>
              <div className="flex gap-2">
                <Input
                  id="scanned-value"
                  value={scannedValue}
                  readOnly
                  placeholder="Aún no se ha capturado ningún código"
                  className="rounded-xl bg-muted/40 font-mono"
                />
                {scannedValue && (
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => void startCamera()}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Escanear de nuevo
                  </Button>
                )}
              </div>
              {scannedValue && (
                <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <ImageIcon className="h-3 w-3" />
                  {scannedKind
                    ? `Decodificado por el backend (${scannedKind}) en modo ${readMode}.`
                    : "Ingresado manualmente por el usuario."}
                </p>
              )}
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}