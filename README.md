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

En el ingreso de patente aparecen hasta cinco **Patentes recientes**, sin duplicados y con la más reciente primero. Seleccionar una completa el campo; **Continuar** confirma su uso y actualiza el orden. También se puede escribir una patente nueva. La lista persiste en localStorage como `recentPlates`. Para datos anteriores a esta función, se recuperan la patente actual y las de los comprobantes por fecha, sin alterar saldos ni estadías.

### Prepago simulado

Usar la barra **Saldo prepago** para consultar y recargar una patente. Hay montos rápidos de $2.000, $5.000 y $10.000, y un monto editable de $1 a $100.000 por recarga. Con una estadía activa, la recarga queda fijada a su patente. Antes de estacionar se puede consultar o recargar otra patente.

Al finalizar, si el saldo cubre el total se selecciona **Usar saldo prepago** por defecto. El usuario confirma el descuento con un botón; también puede elegir el pago simulado habitual. Si falta saldo, puede recargar desde el pago sin perder el monto ni el tiempo finalizados. No se admite pago parcial con saldo. El comprobante y su descarga indican el medio de pago y el saldo inmediatamente posterior al descuento.

Para probar el aislamiento: recargar BCDF12, consultar AB1234 y verificar que no comparte el saldo; volver a BCDF12, pagar una estadía con prepago y recargar la página para comprobar el descuento y el comprobante. Verificar también un saldo insuficiente y un pago alternativo que conserve el saldo.

Es posible volver del pago a la estadía: en ese caso se incluye todo el tiempo transcurrido desde el ingreso. El primer minuto iniciado se cobra desde el inicio. Los precios son ficticios y no representan tarifas oficiales. Las fechas se muestran en la zona horaria de Santiago.

### Multas de prueba

La pestaña **Multas** permite consultar por patente, filtrar todas/pendientes/pagadas y simular el pago de una multa pendiente. La primera consulta de cada patente crea exactamente dos ejemplos: una multa de $15.000 pendiente y otra de $10.000 pagada. Fechas, lugares, motivos y montos son ficticios. No hay emisión real ni integración con autoridades.

Las multas se conservan en `finesByPlate` dentro de la misma clave de localStorage. Se generan una sola vez por patente: recargar o consultar nuevamente no repone las multas pendientes ya pagadas. El pago actualiza el estado y guarda un comprobante de tipo `fine` en una sola escritura; aparece junto a los comprobantes de estacionamientos y se puede descargar. La multa pagada de ejemplo se identifica como tal y no genera un comprobante nuevo.

Las multas se pueden pagar con el saldo prepago de su propia patente o con el pago simulado habitual. Si alcanza, el prepago queda seleccionado por defecto. Si falta saldo, se puede recargar desde el pago, con la patente de la multa fija, y volver a confirmar. La recarga no cambia la patente seleccionada para estacionar. No se permiten pagos parciales. El descuento, el estado pagado y el comprobante se guardan juntos; el comprobante y su descarga indican el medio usado y el saldo restante.

Consultar o pagar multas no detiene ni finaliza una estadía activa. Para probar: consultar una patente, recargar desde su multa pendiente, pagar con saldo y revisar el descuento y el comprobante después de recargar la página. Verificar también saldo insuficiente, saldo exacto y pago alternativo sin descuento. Consultar otra patente para obtener su propio par de ejemplos.

## Persistencia

Una sola clave versionada de localStorage (`pausa-parking-v1`) conserva la última patente, las patentes recientes, la sesión activa o pendiente de pago, los comprobantes, las multas por patente y un mapa `balances` de saldos enteros en CLP por patente normalizada. Los datos anteriores al prepago o las multas se leen con sus mapas vacíos, conservando sesión e historial. El pago guarda el descuento de saldo, el comprobante y la finalización en una única escritura. Si falla el almacenamiento, la interfaz muestra el error y no confirma el pago ni la recarga. Se sincronizan cambios entre pestañas; para pruebas se recomienda una sola pestaña por participante. No hay sincronización entre dispositivos. Borrar los datos del sitio elimina el historial, los saldos y los estados de las multas; para empezar otra prueba se puede borrar únicamente esta clave desde las herramientas del navegador.

## Vercel

Importar este repositorio en Vercel y elegir el preset **Next.js**. Comando de instalación: `npm install`; compilación: `npm run build`. No requiere variables de entorno, base de datos ni configuración adicional. El repositorio incluye el lockfile para instalaciones reproducibles. No está publicado automáticamente.

Los comprobantes son simulados, sin cobro real ni validez tributaria.
