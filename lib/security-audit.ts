type AuditLevel = "info" | "warning" | "error";

interface AuditPayload {
  event: string;
  level?: AuditLevel;
  actorId?: string;
  actorRole?: string;
  ip?: string;
  path?: string;
  method?: string;
  details?: Record<string, unknown>;
}

export function logAuditEvent(payload: AuditPayload) {
  const entry = {
    timestamp: new Date().toISOString(),
    level: payload.level || "info",
    event: payload.event,
    actorId: payload.actorId || null,
    actorRole: payload.actorRole || null,
    ip: payload.ip || null,
    path: payload.path || null,
    method: payload.method || null,
    details: payload.details || {},
  };

  // Structured logs can be ingested by external SIEM tools.
  console.log("[AUDIT]", JSON.stringify(entry));
}
