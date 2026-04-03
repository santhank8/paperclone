# Google Drive Tools Plugin

Plugin nativo de Paperclip para que los agentes puedan trabajar con Google Drive y Google Docs.

## Que hace

- Buscar archivos en Drive
- Listar carpetas
- Leer Google Docs
- Crear Google Docs
- Anadir contenido a Google Docs existentes

## Configuracion minima

El plugin usa un refresh token de Google y secretos cifrados de Paperclip.

Campos de configuracion:

- `clientId`
- `clientSecretSecretRef`
- `refreshTokenSecretRef`
- `defaultFolderId` opcional
- `defaultUserEmail` opcional
- `defaultPageSize` opcional

## Setup recomendado

1. Crear un cliente OAuth de Google.
   Opcion por defecto: cliente tipo Desktop App.
2. Obtener un refresh token con scopes:
   - `https://www.googleapis.com/auth/drive`
   - `https://www.googleapis.com/auth/documents`
3. Guardar en Paperclip dos secretos:
   - client secret
   - refresh token
4. Pegar el `clientId` en la config del plugin y referenciar ambos secretos por UUID.

## Tools expuestas

- `search-drive-files`
- `list-drive-items`
- `read-google-doc`
- `create-google-doc`
- `append-google-doc`

## Limitacion actual

La configuracion es global por instancia. Para este despliegue, lo razonable es apuntarlo a la cuenta general `roselloagents@gmail.com`.
