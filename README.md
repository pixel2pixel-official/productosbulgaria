# Productos Bulgaria: catálogo Nature of Agiva

Dos webs estáticas publicadas con GitHub Pages:

| Web | Ruta | Para quién |
|---|---|---|
| Catálogo de colaboradores | `/` | Colaboradores. Solo lectura: productos, precios de venta online por zona de envío y precios para comercio. |
| Gestión de precios | `/gestion/` | Uso interno. Requiere un token de GitHub con permiso de escritura en este repositorio. |

## Cómo funcionan los precios

- `data/productos.json`: catálogo (gamas, subcategorías, productos e imágenes).
- `data/precios.json`: precios. Lo escribe el panel de gestión mediante la API de GitHub, y el catálogo lo lee al cargar.
- Todos los importes son **sin IVA**.
- Margen online por zona = precio de venta − precio de fábrica − envío de esa zona.
- Margen comercio por canal = precio del canal − precio de fábrica.

Tras pulsar "Guardar y publicar", GitHub Pages tarda 1 o 2 minutos en reflejar los cambios.

## Token para el panel de gestión

Token fine-grained en https://github.com/settings/personal-access-tokens/new con:
- Resource owner: `pixel2pixel-official`
- Repository access: solo `productosbulgaria`
- Permissions > Contents: **Read and write**
