# -*- coding: utf-8 -*-

# --- CONFIGURACIÓN ---
# Reemplaza esto con la dirección de tu impresora.
# Ejemplo en Windows: "\\\\MI-PC\\Zebra" (las barras invertidas dobles son importantes)
# Ejemplo en Linux: "/dev/usb/lp0"
printer_path = "\\\\UIOANALISTI4\\Zebra"

# --- DISEÑO DE LA ETIQUETA EN LENGUAJE ZPL ---
# Puedes diseñar tu propia etiqueta aquí.
# Usa el diseñador online de Labelary para ayudarte: http://labelary.com/viewer.html
zpl_code = """
^XA
^FO50,50^A0N,45,45^FD^FS
^FO50,110^ADN,36,20^^FS
^FO50,160^ADN,36,20^FDHola Mundo :)))^FS
^FO80,220^BY3^BCN,100,Y,N,N^FD Hola MUNDO ^FS
^XZ
"""

# --- FUNCIÓN PARA ENVIAR A IMPRIMIR ---
print(f"Enviando etiqueta a la impresora: {printer_path}")

try:
    # Abrimos la ruta de la impresora en modo de escritura binaria ("wb")
    with open(printer_path, "wb") as printer_file:
        # Codificamos el código ZPL a bytes y lo escribimos en el archivo de la impresora
        printer_file.write(zpl_code.encode('utf-8'))
    
    print("¡Etiqueta enviada con éxito!")

except FileNotFoundError:
    print(f"Error: No se pudo encontrar la impresora en la ruta '{printer_path}'.")
    print("Verifica que la impresora esté compartida y que el nombre sea correcto.")
except Exception as e:
    print(f"Ocurrió un error inesperado: {e}")