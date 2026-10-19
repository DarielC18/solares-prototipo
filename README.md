# NODO · Solares — prototipo interactivo

Prototipo estático para explorar el master plan de **Altavista · Etapa 2**, filtrar y seleccionar solares, calcular el plan de 12/24/36 meses y preparar la solicitud de reserva por WhatsApp. Plano, precios y disponibilidad son **datos ilustrativos**. No hay backend: nada se guarda ni se envía; el botón final solo abre WhatsApp con el mensaje redactado.

## Archivos

| Archivo | Qué es |
|---|---|
| `index.html` | Entrada del sitio |
| `styles.css` | Estilos (paleta carbón/pizarra, cian solo para acciones y selección) |
| `data.js` | **Configuración editable** y generador del plano/solares |
| `app.js` | Lógica: mapa (zoom, arrastre, pinch), filtros, lista, selección, financiamiento, formulario y WhatsApp |
| `assets/hero.svg` | Ilustración ficticia de portada (reemplazable por una foto real) |

Sin dependencias ni build. Funciona abriendo `index.html` con doble clic y en GitHub Pages.

## Publicar en GitHub Pages

1. Sube estos archivos a la raíz de un repositorio público.
2. **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)` → Save.**
3. Espera 1–2 minutos y abre `https://TU-USUARIO.github.io/TU-REPO/`.
4. Comparte ese enlace por WhatsApp.

## Personalizar

Todo está en `SOLARES_CFG`, al inicio de `data.js`:

- `contactPhone` — número de destino de «Abrir WhatsApp» (vacío = solo «Copiar solicitud»).
- `logoText`, `projectFull`, `location`, `eyebrow` — marca y textos.
- `currency`, `currencyLocale`, `sep` — moneda y separación por solar.
- `heroImage` — fotografía residencial de la portada, p. ej. `'./assets/hero.jpg'`. Sin valor se muestra un marcador.

El plano se genera con una semilla fija, así que siempre es el mismo. El solar de referencia **E2-131** (300 m², RD$704,700, separación RD$10,000 → 36 cuotas de RD$19,297) está fijado en `buildSolaresData()`.

> La página incluye `noindex` para que no aparezca en buscadores: solo la ve quien tiene el enlace.
