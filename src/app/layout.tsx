
import type {Metadata} from 'next';
import './globals.css';
import ClientLayout from "./client-layout";

export const metadata: Metadata = {
  title: 'Sistema de Notificaciones',
  description: 'Sistema de Notificaciones para Cosedoras de Falso',
};




export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <script
          src="/zebra/BrowserPrint-3.1.250.min.js"
          suppressHydrationWarning
          dangerouslySetInnerHTML={undefined as any}
          onLoad={undefined as any}
        />
        <script
          // Script inline para asegurar wrapper y logs tempranos
          dangerouslySetInnerHTML={{
            __html: `
              (function(){
                function attach(){
                  try {
                    if (typeof window !== 'undefined') {
                      if (!window.Zebra && window.BrowserPrint) {
                        window.Zebra = { BrowserPrint: window.BrowserPrint };
                        console.log('[BrowserPrint] Wrapper Zebra creado');
                      }
                      console.log('[BrowserPrint] window.BrowserPrint =', typeof window.BrowserPrint);
                    }
                  } catch(e){ console.warn('[BrowserPrint] fallo al envolver', e); }
                }
                // Intento inmediato
                attach();
                // Reintentos rápidos por si tarda en poblar la variable global
                var attempts = 0; var max=10; var iv = setInterval(function(){
                  attempts++; attach();
                  if (window.Zebra && window.Zebra.BrowserPrint) { clearInterval(iv); }
                  if (attempts>=max) clearInterval(iv);
                }, 300);
              })();
            `
          }}
        />
      </head>
      <body className="font-body antialiased">
        <ClientLayout>
          {children}
        </ClientLayout>
      </body>
    </html>
  );
}
