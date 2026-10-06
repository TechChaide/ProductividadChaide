// En las tablets los campos de escaneo los llena el lector, así que no debe abrirse el teclado
// virtual al darles foco. No se usa inputMode="none": en algunas tablets el texto del lector
// entra por el teclado del sistema y con eso deja de llegar al campo. Android no abre el teclado
// si el campo se enfoca (o se toca) mientras es de solo lectura, ni después al quitarle el
// readOnly; el campo sigue recibiendo el texto del lector como un input normal.
const MS_SOLO_LECTURA_AL_ENFOCAR = 300;

export function liberarSoloLectura(input: HTMLInputElement) {
  setTimeout(() => {
    input.readOnly = false;
  }, MS_SOLO_LECTURA_AL_ENFOCAR);
}

/** Enfoca el campo sin abrir el teclado virtual (p. ej. después de tocar un botón). */
export function enfocarSinTeclado(input: HTMLInputElement | null) {
  if (!input) return;
  input.readOnly = true;
  input.focus();
  liberarSoloLectura(input);
}
