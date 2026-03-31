Herramienta: Comisiones Nomad ligadas a Firebase

Qué hace:
- Lee la colección "cotizaciones" del proyecto Firebase "cotizador-nomad"
- Filtra por el KAM/vendedor que ingresa a la app
- Considera como comisión válida las cotizaciones con status1 aceptado/cerrada
- Cruza las pruebas del arreglo "pruebas" contra el Excel de comisiones
- Calcula comisión comercial y comisión al médico
- Muestra pruebas sin match para que puedas corregir nombres en el Excel

Archivos:
- index.html
- styles.css
- data.js
- app.js
- img/innvida-logo.png

Nota:
- Si Firebase no deja leer datos, revisa las reglas del proyecto.
- Esta herramienta no cambia nada en Firebase, solo consulta.
