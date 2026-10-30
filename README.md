# Pausa

Prototipo móvil de pago de estacionamientos en Chile. Next.js con App Router, JavaScript y Tailwind CSS. Sin backend ni conexión a pasarelas de pago.

## Ejecutar

Requiere Node.js 20.9 o posterior.

```sh
npm install
npm run dev
```

Abrir http://localhost:3000. Para verificar:

```sh
npm test
npm run build
```

## Flujo de prueba

1. Registrar una patente de automóvil (por ejemplo, BCDF12 o AB1234).
2. Seleccionar uno de los tres estacionamientos ficticios.
3. Consultar tarifa por minuto iniciado y ejemplos de costo; iniciar la estadía.
4. Consultar tiempo y costo acumulado. Recargar la página para verificar recuperación.
5. Finalizar y confirmar la finalización: se fija el monto y se detiene el cronómetro.
6. Simular el pago. Se guarda un comprobante y se libera la estadía.
7. Consultar Comprobantes, abrir el detalle y descargarlo como archivo de texto.

Es posible volver del pago a la estadía: en ese caso se incluye todo el tiempo transcurrido desde el ingreso. El primer minuto iniciado se cobra desde el inicio. Los precios son ficticios y no representan tarifas oficiales. Las fechas se muestran en la zona horaria de Santiago.

## Persistencia

Una sola clave versionada de localStorage (`pausa-parking-v1`) conserva la última patente, la sesión activa o pendiente de pago y los comprobantes. El pago guarda comprobante y finalización en una única escritura. Si falla el almacenamiento, la interfaz muestra el error y no confirma el pago. Se sincronizan cambios entre pestañas; para pruebas se recomienda una sola pestaña por participante. No hay sincronización entre dispositivos. Borrar los datos del sitio elimina el historial; para empezar otra prueba se puede borrar únicamente esta clave desde las herramientas del navegador.

## Vercel

Importar este repositorio en Vercel y elegir el preset **Next.js**. Comando de instalación: `npm install`; compilación: `npm run build`. No requiere variables de entorno, base de datos ni configuración adicional. El repositorio incluye el lockfile para instalaciones reproducibles. No está publicado automáticamente.

Los comprobantes son simulados, sin cobro real ni validez tributaria.
