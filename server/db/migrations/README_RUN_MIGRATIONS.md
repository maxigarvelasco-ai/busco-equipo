Pasos para aplicar migraciones y RPCs en Supabase

1) Revisión previa
- Verifica que tienes acceso al proyecto Supabase y al SQL Editor.
- Haz backup (Export) de la base de datos antes de aplicar cambios en producción.

2) Archivos de migración (ya presentes en el repo)
- server/db/migrations/20260315_add_notifications_data_and_triggers.sql
- server/db/migrations/20260315_update_accept_reject_rpc.sql
- server/db/migrations/20260315_remove_match_join_notification_trigger.sql (opcional)

3) Orden recomendado de ejecución
- Ejecuta `20260315_add_notifications_data_and_triggers.sql` primero. Esto añade la columna `data jsonb` a `notifications`, crea la función/trigger que puede auto-insertar notificaciones en `match_join_requests` y backfill si aplica.
- Ejecuta `20260315_update_accept_reject_rpc.sql`. Esto crea/actualiza las funciones RPC `accept_match_request` y `reject_match_request` que marcan requests, insertan en `match_players` (si procede) y generan notificaciones al requester.
- Opcional: si quieres DESHABILITAR la creación automática de notificaciones (porque hay otro proceso que ya lo hace), ejecuta `20260315_remove_match_join_notification_trigger.sql`.

4) Permisos
- Después de crear/actualizar RPCs, concede `EXECUTE` sobre las funciones a los roles que las necesitan (por ejemplo `authenticated`):

  GRANT EXECUTE ON FUNCTION accept_match_request(integer, uuid, uuid) TO authenticated;
  GRANT EXECUTE ON FUNCTION reject_match_request(integer, uuid, uuid) TO authenticated;

- Ajusta roles/owners según tu setup.

5) Verificaciones post-ejecución
- En la tabla `notifications` verifica que la columna `data` existe y que los registros de prueba contienen JSON en `data`.
- Crea una petición de JOIN de prueba desde un usuario B y verifica que el registro en `match_join_requests` se crea.
- Desde la cuenta creadora, llama a la RPC `accept_match_request` (o usa la app) y verifica que:
  - Se inserta un registro en `match_players` (si corresponde).
  - El request se marca como `handled`/`status` actualizada.
  - Se crea una notificación para el requester (si está habilitado).

6) CORS / Allowed Origins
- Asegúrate en Supabase -> Authentication -> Settings -> "Allowed origins (for requests from browser)" de incluir tus orígenes (`http://localhost:3000`, `http://localhost:3003`, y la URL de producción).

7) Re-deploy
- Una vez aplicados los cambios DB y verificado endpoints, vuelve a desplegar tu frontend (Vercel / Netlify) y prueba el flujo E2E: crear solicitud → aceptar → ver notificación y estado actualizado en UI.

Si querés, me encargo de ejecutar los checks E2E localmente (necesito que me confirmes dos cuentas de prueba o que me autorices a simular las llamadas RPC desde un usuario).