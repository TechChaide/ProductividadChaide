// Tipos básicos para BrowserPrint (simplificados)
// Permite autocompletado sin depender de definiciones oficiales.

interface BrowserPrintDevice {
  name: string;
  deviceType: string;
  connection: string;
  uid: string;
  provider?: string;
  manufacturer?: string;
  version?: number;
  send(data: string, onSuccess?: (resp?: any) => void, onError?: (err?: any) => void): void;
}

interface BrowserPrintStatic {
  getDefaultDevice(type: string, onSuccess: (device: BrowserPrintDevice | null, err?: any) => void, onError?: (err: any) => void): void;
  getLocalDevices(onSuccess: (devices: Record<string, BrowserPrintDevice[]>) => void, onError?: (err: any) => void): void;
}

declare global {
  interface Window {
    BrowserPrint?: BrowserPrintStatic;
    Zebra?: { BrowserPrint?: BrowserPrintStatic };
  }
}

export {};
