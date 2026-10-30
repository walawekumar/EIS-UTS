import { useEffect, useMemo, useRef, useState } from 'react'
import {
  FinanceModal,
  ModalActions,
} from '@/components/keuangan/FinanceModal'
import {
  FinanceEmptyRow,
  FinanceTable,
  FinanceTd,
  FinanceTh,
  FinanceThead,
  FinanceTr,
} from '@/components/keuangan/FinanceTable'
import { FinanceToast } from '@/components/keuangan/FinanceToast'
import { FinanceWorkflowSteps } from '@/components/keuangan/FinanceWorkflowSteps'
import { StatusPill } from '@/components/keuangan/StatusPill'
import { Select } from '@/components/ui/Select'
import { TextField } from '@/components/ui/TextField'
import { useAuth } from '@/features/auth/AuthContext'
import {
  sessionSummary,
  useBankStore,
} from '@/features/keuangan/bank-store'
import type { BankLine, BankSession } from '@/features/keuangan/bank-data'
import { useFinanceStore } from '@/features/keuangan/finance-store'
import { formatIdr } from '@/features/keuangan/keuangan-data'
import { parseCashDateToIso } from '@/features/keuangan/period-helpers'

const LINE_STATUS_LABEL: Record<BankLine['status'], string> = {
  unmatched: 'Belum match',
  matched: 'Matched',
  ignored: 'Diabaikan',
  adjusted: 'Disesuaikan (JE)',
}

const LINE_STATUS_TONE: Record<
  BankLine['status'],
  'neutral' | 'good' | 'warn' | 'muted'
> = {
  unmatched: 'warn',
  matched: 'good',
  ignored: 'muted',
  adjusted: 'neutral',
}

function sessionLabel(s: BankSession): string {
  return `${s.startDate} – ${s.endDate}`
}

export function RekonBankPage() {
  const { user } = useAuth()
  const {
    sessions,
    lines,
    createSession,
    importCsv,
    runAutoMatch,
    acceptSuggestion,
    rejectSuggestion,
    manualMatch,
    ignoreLine,
    postAdjustment,
  } = useBankStore()
  const { cashEntries } = useFinanceStore()

  const [toast, setToast] = useState<string | null>(null)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [statementBal, setStatementBal] = useState('')
  const [manualLineId, setManualLineId] = useState<string | null>(null)
  const [manualCashId, setManualCashId] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 2800)
    return () => window.clearTimeout(t)
  }, [toast])

  useEffect(() => {
    if (activeSessionId) return
    if (sessions.length > 0) setActiveSessionId(sessions[0].id)
  }, [sessions, activeSessionId])

  const activeSession = sessions.find((s) => s.id === activeSessionId)
  const sessionLines = useMemo(
    () =>
      lines.filter((l) => l.sessionId === activeSessionId).sort((a, b) => {
        const d = a.date.localeCompare(b.date)
        if (d !== 0) return d
        return a.id.localeCompare(b.id)
      }),
    [lines, activeSessionId],
  )
  const summary = useMemo(() => sessionSummary(sessionLines), [sessionLines])

  const workflowStep = useMemo(() => {
    if (!activeSession) return 'session'
    if (sessionLines.length === 0) return 'import'
    if (summary.unmatched > 0) return 'match'
    return 'done'
  }, [activeSession, sessionLines.length, summary.unmatched])

  const cashOptions = useMemo(() => {
    if (!activeSession) return []
    const taken = new Set(
      sessionLines
        .filter((l) => l.cashEntryId)
        .map((l) => l.cashEntryId as string),
    )
    return cashEntries
      .filter((c) => {
        if (taken.has(c.id)) return false
        const iso = parseCashDateToIso(c.date)
        if (!iso) return false
        return iso >= activeSession.startDate && iso <= activeSession.endDate
      })
      .map((c) => ({
        value: c.id,
        label: `${c.reference} · ${c.date} · ${formatIdr(c.amount)} (${c.direction})`,
      }))
  }, [cashEntries, activeSession, sessionLines])

  function submitCreateSession() {
    if (!user) return
    const balRaw = statementBal.trim().replace(/\./g, '')
    const statementBalance = balRaw ? Number(balRaw) : undefined
    const err = createSession({
      startDate: startDate.trim(),
      endDate: endDate.trim(),
      statementBalance:
        statementBalance != null && Number.isFinite(statementBalance)
          ? statementBalance
          : undefined,
      by: user.name,
    })
    if (err) {
      setToast(err)
      return
    }
    setCreateOpen(false)
    setStartDate('')
    setEndDate('')
    setStatementBal('')
    setToast('Sesi rekon dibuat')
  }

  function onCsvFile(file: File) {
    if (!activeSessionId) {
      setToast('Pilih sesi rekon terlebih dahulu')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result ?? '')
      const err = importCsv(activeSessionId, text)
      setToast(err ?? 'CSV diimpor')
    }
    reader.readAsText(file)
  }

  function confirmManualMatch() {
    if (!manualLineId || !manualCashId) return
    const err = manualMatch(manualLineId, manualCashId)
    setToast(err ?? 'Match manual tersimpan')
    setManualLineId(null)
    setManualCashId('')
  }

  return (
    <div className="space-y-2.5">
      <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-[14px] font-semibold text-ink">Rekon bank</h2>
            <p className="mt-0.5 text-[12px] text-muted">
              Import CSV mutasi bank, auto-match ke kas (±2 hari, nominal exact),
              match manual, abaikan, atau jurnal penyesuaian
            </p>
            <p className="mt-1 text-[11px] text-muted">
              Kolom CSV: tanggal (YYYY-MM-DD atau DD/MM/YYYY), deskripsi,
              jumlah atau debit/kredit, ref opsional
            </p>
          </div>
          <FinanceToast message={toast} />
        </div>

        <FinanceWorkflowSteps
          steps={[
            {
              id: 'session',
              label: 'Sesi',
              done: Boolean(activeSession),
              current: workflowStep === 'session',
            },
            {
              id: 'import',
              label: 'Import CSV',
              done: sessionLines.length > 0,
              current: workflowStep === 'import',
            },
            {
              id: 'match',
              label: 'Match',
              done: sessionLines.length > 0 && summary.unmatched === 0,
              current: workflowStep === 'match',
            },
            {
              id: 'done',
              label: 'Ringkas',
              done: workflowStep === 'done',
              current: workflowStep === 'done',
            },
          ]}
        />

        {sessions.length === 0 ? (
          <div className="mb-3 rounded-xl border border-dashed border-line bg-surface/60 px-4 py-6 text-center">
            <p className="text-[13px] font-medium text-ink">Belum ada sesi rekon</p>
            <p className="mt-1 text-[12px] text-muted">
              Buat sesi untuk rentang tanggal statement bank, lalu import CSV
              mutasi.
            </p>
            <button
              type="button"
              className="mt-3 inline-flex h-10 items-center rounded-xl bg-ink px-4 text-[13px] font-medium text-white transition hover:bg-ink/90"
              onClick={() => setCreateOpen(true)}
            >
              Buat sesi pertama
            </button>
          </div>
        ) : (
          <div className="mb-3 space-y-1.5">
            <p className="text-[12px] font-medium text-ink">Sesi aktif</p>
            <div className="flex items-center gap-2">
              <Select
                label="Sesi aktif"
                hideLabel
                className="min-w-0 max-w-xs flex-1 sm:max-w-sm"
                value={(activeSessionId ?? '') as string}
                options={sessions.map((s) => ({
                  value: s.id,
                  label: sessionLabel(s),
                }))}
                placeholder="Pilih sesi"
                onChange={(id) => setActiveSessionId(id || null)}
              />
              <button
                type="button"
                className="inline-flex h-11 shrink-0 items-center rounded-xl bg-ink px-4 text-[13px] font-medium text-white transition hover:bg-ink/90"
                onClick={() => setCreateOpen(true)}
              >
                Sesi baru
              </button>
            </div>
          </div>
        )}

        {activeSession ? (
          <>
            <div className="mb-3 flex flex-wrap gap-2 text-[11px]">
              <StatusPill
                label={`Matched: ${summary.matched}`}
                tone="good"
              />
              <StatusPill
                label={`Unmatched: ${summary.unmatched}`}
                tone="warn"
              />
              <StatusPill label={`Ignored: ${summary.ignored}`} tone="muted" />
              <StatusPill
                label={`Adjusted: ${summary.adjusted}`}
                tone="neutral"
              />
              {activeSession.statementBalance != null ? (
                <span className="text-muted">
                  Saldo statement: {formatIdr(activeSession.statementBalance)}
                </span>
              ) : null}
            </div>

            <div className="mb-3 flex flex-wrap gap-2">
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) onCsvFile(f)
                  e.target.value = ''
                }}
              />
              <button
                type="button"
                className="rounded-lg border border-line px-3 py-2 text-[12px]"
                onClick={() => fileRef.current?.click()}
              >
                Import CSV
              </button>
              <button
                type="button"
                className="rounded-lg border border-line px-3 py-2 text-[12px]"
                onClick={() => {
                  if (!activeSessionId) return
                  runAutoMatch(activeSessionId)
                  setToast('Auto-match dijalankan')
                }}
              >
                Auto-match
              </button>
            </div>

            <FinanceTable>
              <FinanceThead>
                <tr>
                  <FinanceTh>Tanggal</FinanceTh>
                  <FinanceTh>Deskripsi</FinanceTh>
                  <FinanceTh>Jumlah</FinanceTh>
                  <FinanceTh>Status</FinanceTh>
                  <FinanceTh>Aksi</FinanceTh>
                </tr>
              </FinanceThead>
              <tbody>
                {sessionLines.length === 0 ? (
                  <FinanceEmptyRow
                    colSpan={5}
                    message="Belum ada baris — import CSV"
                  />
                ) : (
                  sessionLines.map((line) => (
                    <FinanceTr key={line.id}>
                      <FinanceTd>{line.date}</FinanceTd>
                      <FinanceTd>
                        <span className="line-clamp-2">{line.memo}</span>
                        {line.bankRef ? (
                          <span className="block text-[10px] text-muted">
                            Ref {line.bankRef}
                          </span>
                        ) : null}
                      </FinanceTd>
                      <FinanceTd className="font-mono text-[12px]">
                        {formatIdr(line.amount)}
                      </FinanceTd>
                      <FinanceTd>
                        <StatusPill
                          label={LINE_STATUS_LABEL[line.status]}
                          tone={LINE_STATUS_TONE[line.status]}
                        />
                        {line.suggestedCashEntryId ? (
                          <span className="mt-1 block text-[10px] text-muted">
                            Saran kas: {line.suggestedCashEntryId}
                          </span>
                        ) : null}
                        {line.cashEntryId ? (
                          <span className="mt-1 block text-[10px] text-muted">
                            Kas: {line.cashEntryId}
                          </span>
                        ) : null}
                      </FinanceTd>
                      <FinanceTd>
                        <div className="flex flex-col gap-1">
                          {line.status === 'unmatched' &&
                          line.suggestedCashEntryId ? (
                            <>
                              <button
                                type="button"
                                className="text-left text-[11px] text-brand-800 underline"
                                onClick={() => {
                                  const err = acceptSuggestion(line.id)
                                  setToast(err ?? 'Saran diterima')
                                }}
                              >
                                Terima saran
                              </button>
                              <button
                                type="button"
                                className="text-left text-[11px] text-muted underline"
                                onClick={() => rejectSuggestion(line.id)}
                              >
                                Tolak saran
                              </button>
                            </>
                          ) : null}
                          {line.status === 'unmatched' ? (
                            <>
                              <button
                                type="button"
                                className="text-left text-[11px] underline"
                                onClick={() => {
                                  setManualLineId(line.id)
                                  setManualCashId('')
                                }}
                              >
                                Match manual
                              </button>
                              <button
                                type="button"
                                className="text-left text-[11px] text-muted underline"
                                onClick={() => ignoreLine(line.id)}
                              >
                                Abaikan
                              </button>
                              <button
                                type="button"
                                className="text-left text-[11px] text-amber-800 underline"
                                onClick={() => {
                                  const err = postAdjustment(line.id, {
                                    memo: line.memo,
                                  })
                                  setToast(
                                    err ??
                                      'Penyesuaian JE diposting (GL-only)',
                                  )
                                }}
                              >
                                Post penyesuaian
                              </button>
                            </>
                          ) : null}
                        </div>
                      </FinanceTd>
                    </FinanceTr>
                  ))
                )}
              </tbody>
            </FinanceTable>
          </>
        ) : (
          <p className="text-[12px] text-muted">
            Buat sesi rekon untuk rentang tanggal statement bank.
          </p>
        )}
      </section>

      {createOpen ? (
        <FinanceModal
          title="Sesi rekon baru"
          onClose={() => setCreateOpen(false)}
          footer={
            <ModalActions
              onCancel={() => setCreateOpen(false)}
              onConfirm={submitCreateSession}
              confirmLabel="Buat sesi"
            />
          }
        >
          <div className="space-y-3">
            <TextField
              id="rekon-start"
              label="Tanggal mulai"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <TextField
              id="rekon-end"
              label="Tanggal akhir"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
            <TextField
              id="rekon-bal"
              label="Saldo akhir statement (opsional)"
              value={statementBal}
              onChange={(e) => setStatementBal(e.target.value)}
              placeholder="Contoh: 15000000"
            />
          </div>
        </FinanceModal>
      ) : null}

      {manualLineId ? (
        <FinanceModal
          title="Match manual ke kas"
          onClose={() => setManualLineId(null)}
          footer={
            <ModalActions
              onCancel={() => setManualLineId(null)}
              onConfirm={confirmManualMatch}
              confirmLabel="Simpan match"
              confirmDisabled={!manualCashId}
            />
          }
        >
          <Select
            label="Entri kas"
            value={manualCashId}
            options={cashOptions}
            onChange={setManualCashId}
          />
          {cashOptions.length === 0 ? (
            <p className="mt-2 text-[11px] text-muted">
              Tidak ada kas unmatched di rentang sesi. Pastikan nominal &
              tanggal sesuai (signed:{' '}
              {manualLineId
                ? formatIdr(
                    sessionLines.find((l) => l.id === manualLineId)?.amount ??
                      0,
                  )
                : '—'}
              ).
            </p>
          ) : null}
        </FinanceModal>
      ) : null}
    </div>
  )
}
