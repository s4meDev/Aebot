import { useEffect, useState } from 'react';
import { desktopBridge, type DesktopStatus } from '../desktop/contracts';

export function DesktopSettings({ isOpen, onClose, onRulesChanged }: {
  isOpen: boolean; onClose(): void; onRulesChanged(): void;
}) {
  const [status, setStatus] = useState<DesktopStatus | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    const refresh = () => void desktopBridge()?.status().then((value) => {
      if (active) setStatus(value);
    }).catch(() => { if (active) setMessage('Não foi possível consultar o aplicativo.'); });
    refresh(); const timer = setInterval(refresh, 2000);
    return () => { active = false; clearInterval(timer); };
  }, [isOpen]);
  if (!isOpen) return null;
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setMessage('');
    try { await action(); } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível concluir a operação.'); }
    finally { setBusy(false); }
  };
  return <div className="modal-backdrop"><section className="modal-content" role="dialog" aria-modal="true" aria-labelledby="desktop-title">
    <div className="modal-header"><h3 id="desktop-title">AEBOT neste computador</h3>
      <button className="icon-btn" onClick={onClose} aria-label="Fechar">✕</button></div>
    <div className="modal-body">
      <p>{status?.message ?? 'Verificando…'}</p>
      <p className="help-text">{status?.model} · Base {status?.ruleVersion}</p>
      <p className="help-text">Funciona offline, sem chave de API. As conversas não saem deste computador e são descartadas ao fechar o aplicativo.</p>
      {status?.rulesWarning && <p className="danger-text">{status.rulesWarning}</p>}
      <h4>Operação do piloto</h4>
      <p className="help-text">Versão em validação. Confira as orientações antes de concluir a OS; testes técnicos não substituem homologação operacional.</p>
      <p>{status?.analyses ?? 0} análises · {status?.modelCalls ?? 0} chamadas locais · {status?.modelErrors ?? 0} falhas do modelo</p>
      <p className="help-text">Tempo médio: {status?.averageDurationMs === null ? 'sem medições' : `${((status?.averageDurationMs ?? 0) / 1000).toFixed(1)} s`}. Sem cobrança por pergunta; o desempenho depende do computador.</p>
      <div className="desktop-actions">
        <button className="secondary-btn" disabled={busy || status?.state === 'starting'} onClick={() => void run(async () => { await desktopBridge()!.restartModel(); setMessage('Reiniciando a IA…'); })}>Reiniciar IA</button>
        <button className="secondary-btn" disabled={busy} onClick={() => void run(async () => {
          const result = await desktopBridge()!.importRules(); setMessage(result.message);
          if (result.changed) onRulesChanged();
        })}>Importar regras aprovadas</button>
        <button className="secondary-btn" disabled={busy} onClick={() => void run(async () => {
          const result = await desktopBridge()!.exportReport();
          setMessage(result.saved ? 'Relatório salvo. Envie o arquivo ao responsável pelo piloto.' : 'Exportação cancelada.');
        })}>Exportar métricas e feedbacks</button>
      </div>
      <p className="help-text">O relatório inclui contagens e os feedbacks escritos voluntariamente. Não inclui o histórico de conversa.</p>
      <p role="status">{message}</p>
    </div>
  </section></div>;
}
