# BiometrIMSS

Aplicación web progresiva (PWA) para llevar un control personal de guardias y registros biométricos desde el teléfono.

## Funciones

- Registro rápido o manual de entrada y salida.
- Clasificación automática de guardias efectivas, retardos, omisiones, salidas anticipadas, faltas y registros fuera de horario.
- Estados manuales para justificaciones y aclaraciones.
- Calendario mensual por colores.
- Resumen por periodo con guardias programadas, efectivas, justificadas e incidencias.
- Historial editable y exportación mensual en CSV.
- Respaldo y restauración en JSON.
- Horario y días de guardia configurables.
- Periodos vacacionales programados, visibles en el calendario y excluidos de faltas, incidencias y asistencia real.
- Acceso externo a ChatGPT, Meta AI y Gemini desde ABITIMSS.
- Instalación en iPhone, iPad y Android, y funcionamiento sin conexión.
- Datos almacenados únicamente en el dispositivo mediante `localStorage`.

## Configuración inicial

La app inicia con el turno nocturno:

- Días: martes, jueves y sábado.
- Entrada: 20:30.
- Límite de entrada: 21:00.
- Salida: 08:10 del día siguiente.
- Límite de salida: 10:10.

Todos estos valores pueden modificarse en **Ajustes**.

## Desarrollo local

No requiere compilación ni dependencias para funcionar.

```bash
npm test
npm run check
npx serve .
```

## Privacidad

BiometrIMSS es una herramienta personal e independiente. No es una aplicación oficial del IMSS y no sustituye los registros institucionales. La app no envía datos a servidores; la información permanece en el navegador del dispositivo, salvo que la persona descargue un respaldo o reporte.
## Prueba semanal personal

Para la prueba de uso real, consulta la [checklist semanal](docs/CHECKLIST-SEMANAL-BIOMETRIMSS.md).
