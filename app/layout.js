import './globals.css';

export const metadata = {
  title: 'Pausa | Tu estacionamiento, en simple',
  description: 'Registra tu patente, inicia tu estadía y paga tu estacionamiento. Prototipo de prueba con pagos simulados.',
  applicationName: 'Pausa',
};

export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#f5f7f6' };

export default function RootLayout({ children }) {
  return <html lang="es-CL"><body>{children}</body></html>;
}
