"use client";
import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Cloud,
  Download,
  Link2,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
  Unlink,
} from "lucide-react";
type Status = {
  configured: boolean;
  connected: boolean;
  environment: "test" | "production";
  redirectUri: string;
  connection?: { expiresAt: string; connectedAt: string };
  automation?: {
    status: string;
    checked: number;
    sent: number;
    failed: number;
    message: string;
    lastRunAt: string;
    lastSuccessAt: string | null;
  } | null;
};
type Message = {
  id: number;
  messageId: string;
  direction: "RECEIVED" | "SENT";
  cif: string;
  details: string;
  documentDate: string;
  downloadId: string;
  createdAt: string;
};

const BUCHAREST_TIME_ZONE = "Europe/Bucharest";

export default function EFacturaPage() {
  const [status, setStatus] = useState<Status | null>(null),
    [messages, setMessages] = useState<Message[]>([]),
    [busy, setBusy] = useState(false),
    [protecting, setProtecting] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  async function load() {
    const [statusResponse, messagesResponse] = await Promise.all([
      fetch("/api/accounting/efactura/status"),
      fetch("/api/accounting/efactura/messages"),
    ]);
    const [statusResult, messagesResult] = await Promise.all([
      statusResponse.json(),
      messagesResponse.json(),
    ]);
    if (!statusResponse.ok)
      throw new Error(
        statusResult.error || "Configurarea ANAF nu a putut fi încărcată.",
      );
    if (!messagesResponse.ok)
      throw new Error(
        messagesResult.error || "Mesajele ANAF nu au putut fi încărcate.",
      );
    setStatus(statusResult);
    setMessages(Array.isArray(messagesResult) ? messagesResult : []);
  }
  useEffect(() => {
    load().catch((reason) =>
      setError(
        reason instanceof Error
          ? reason.message
          : "Configurarea ANAF nu a putut fi încărcată.",
      ),
    );
    const params = new URLSearchParams(window.location.search);
    const callbackError = params.get("error");
    if (callbackError) setError(callbackError);
    if (params.has("connected"))
      setNotice("Conexiunea cu ANAF/SPV a fost realizată.");
    if (params.has("error") || params.has("connected"))
      window.history.replaceState({}, "", window.location.pathname);
  }, []);
  async function sync() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await fetch("/api/accounting/efactura/sync", {
        method: "POST",
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Sincronizarea a eșuat.");
      await load();
      const count = Number(d.count || 0);
      const time = new Intl.DateTimeFormat("ro-RO", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: BUCHAREST_TIME_ZONE,
      }).format(new Date());
      setNotice(
        count === 0
          ? `Sincronizare finalizată la ${time}. ANAF nu a returnat mesaje în ultimele 60 de zile.`
          : `Sincronizare finalizată la ${time}. ANAF a returnat ${count} ${count === 1 ? "mesaj" : "mesaje"}.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sincronizarea a eșuat.");
    } finally {
      setBusy(false);
    }
  }
  async function protect() {
    setProtecting(true);
    setError("");
    setNotice("");
    try {
      const r = await fetch("/api/accounting/efactura/protect", {
        method: "POST",
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Protecția e-Factura a eșuat.");
      await load();
      setNotice(
        d.skipped
          ? d.reason
          : `Protecție finalizată: ${d.checked} statusuri verificate, ${d.sent} facturi trimise, ${d.failed} erori.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Protecția e-Factura a eșuat.");
    } finally {
      setProtecting(false);
    }
  }
  async function disconnect() {
    if (!confirm("Deconectezi contul ANAF?")) return;
    await fetch("/api/accounting/efactura/disconnect", { method: "POST" });
    setNotice("");
    load().catch((reason) =>
      setError(
        reason instanceof Error
          ? reason.message
          : "Configurarea ANAF nu a putut fi încărcată.",
      ),
    );
  }
  return (
    <div>
      <div className="page-head">
        <div>
          <div className="eyebrow">RO e-Factura · SPV</div>
          <h2 className="page-title">Integrare ANAF</h2>
          <p className="page-subtitle">
            Transmitere, statusuri și facturi primite prin API-ul oficial.
          </p>
        </div>
        {status?.connected && (
          <div className="flex gap-2 flex-wrap">
            <button
              className="btn-primary"
              onClick={protect}
              disabled={protecting || busy}
            >
              <ShieldCheck size={15} />
              {protecting ? "Se verifică…" : "Rulează protecția acum"}
            </button>
            <button
              className="btn-secondary"
              onClick={sync}
              disabled={busy || protecting}
            >
              <RefreshCw className={busy ? "ef-spin" : ""} size={15} />
              {busy ? "Se sincronizează…" : "Sincronizează SPV"}
            </button>
          </div>
        )}
      </div>
      {error && <div className="ref-error">{error}</div>}
      {notice && (
        <div className="ef-success">
          <CheckCircle2 size={17} />
          <span>{notice}</span>
        </div>
      )}
      {status?.environment === "test" && (
        <div className="ef-safety-warning">
          <TriangleAlert size={17} />
          <span>
            <strong>Mediul Test este activ.</strong> Sincronizarea și
            trimiterile nu produc efecte fiscale reale. Pentru operare reală
            trebuie configurat mediul Producție și reconectat SPV.
          </span>
        </div>
      )}
      <div className="ef-status-grid">
        <div className="card">
          <div className="section-label">Configurare</div>
          <div className="ef-status-line">
            <span>Mediu ANAF</span>
            <strong
              className={
                status?.environment === "production" ? "ef-prod" : "ef-test"
              }
            >
              {status?.environment === "production" ? "Producție" : "Test"}
            </strong>
          </div>
          <div className="ef-status-line">
            <span>Client OAuth</span>
            <strong>{status?.configured ? "Configurat" : "Lipsește"}</strong>
          </div>
          <div className="ef-status-line">
            <span>Conexiune SPV</span>
            <strong>{status?.connected ? "Conectată" : "Neconectată"}</strong>
          </div>
          <div className="ef-status-line">
            <span>Ultima protecție automată</span>
            <strong
              className={
                status?.automation?.status === "SUCCESS"
                  ? "ef-prod"
                  : status?.automation
                    ? "ef-test"
                    : ""
              }
            >
              {status?.automation?.lastRunAt
                ? new Date(status.automation.lastRunAt).toLocaleString("ro-RO", {
                    timeZone: BUCHAREST_TIME_ZONE,
                  })
                : "Nu a rulat încă"}
            </strong>
          </div>
          {status?.automation && (
            <div className="ef-automation-summary">
              Status: <strong>{status.automation.status}</strong> · verificate{" "}
              {status.automation.checked} · trimise {status.automation.sent} ·
              erori {status.automation.failed}
              {status.automation.message ? (
                <> · {status.automation.message}</>
              ) : (
                ""
              )}
            </div>
          )}
          <div className="divider" />
          {!status?.configured ? (
            <p className="page-subtitle">
              Adaugă în Vercel ANAF_CLIENT_ID, ANAF_CLIENT_SECRET,
              ANAF_REDIRECT_URI și ANAF_ENVIRONMENT.
            </p>
          ) : status.connected ? (
            <button className="btn-danger" onClick={disconnect}>
              <Unlink size={14} />
              Deconectează ANAF
            </button>
          ) : (
            <a href="/api/accounting/efactura/connect" className="btn-primary">
              <Link2 size={14} />
              Conectează certificatul/SPV
            </a>
          )}
          <div className="ef-callback">Callback: {status?.redirectUri}</div>
        </div>
        <div className="card">
          <div className="section-label">Flux activ</div>
          <div className="ef-flow">
            <Cloud size={28} />
            <p>
              Factură validată local → XML CIUS-RO → încărcare ANAF → verificare
              status → arhivare răspuns.
            </p>
          </div>
          <p className="page-subtitle">
            Facturile noi sunt trimise imediat după emitere. Protecția zilnică
            rulează dimineața conform orei Europe/Bucharest, preia automat
            orice factură rămasă netrimisă, verifică răspunsurile ANAF și
            reîncearcă erorile temporare. Facturile respinse se corectează și
            se retrimit manual.
          </p>
        </div>
      </div>
      <div className="section-label">Mesaje e-Factura sincronizate</div>
      <div className="card-table">
        <table>
          <thead>
            <tr>
              <th>Direcție</th>
              <th>ID ANAF</th>
              <th>CIF</th>
              <th>Detalii</th>
              <th>Data</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {messages.length === 0 ? (
              <tr>
                <td colSpan={6} className="empty-row">
                  Nu există mesaje sincronizate.
                </td>
              </tr>
            ) : (
              messages.map((m) => (
                <tr key={m.id}>
                  <td>
                    <span
                      className={`badge ${m.direction === "RECEIVED" ? "badge-partial" : "badge-paid"}`}
                    >
                      {m.direction === "RECEIVED" ? "Primită" : "Trimisă"}
                    </span>
                  </td>
                  <td className="num">{m.messageId}</td>
                  <td>{m.cif || "—"}</td>
                  <td>{m.details || "—"}</td>
                  <td>
                    {m.documentDate ||
                      new Date(m.createdAt).toLocaleDateString("ro-RO", {
                        timeZone: BUCHAREST_TIME_ZONE,
                      })}
                  </td>
                  <td>
                    <a
                      className="btn-secondary"
                      href={`/api/accounting/efactura/messages/${m.downloadId}/download`}
                    >
                      <Download size={13} />
                      ZIP
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
