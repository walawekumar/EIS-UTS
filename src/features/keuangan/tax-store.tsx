import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  type TaxDoc,
  type TaxInvoice,
  type TaxSettings,
  type TaxSourceType,
} from '@/features/keuangan/tax-data'
import { setExpenseTaxBridge } from '@/features/keuangan/finance-store'
import { taxRepository } from '@/features/keuangan/tax-storage'

const INVOICE_SEQ_PAD = 6

export function nextTaxDocId(): string {
  return `td-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export function nextInvoiceNumber(settings: TaxSettings): {
  number: string
  settings: TaxSettings
} {
  const number = `${settings.invoicePrefix}${String(settings.nextSeq).padStart(INVOICE_SEQ_PAD, '0')}`
  return {
    number,
    settings: { ...settings, nextSeq: settings.nextSeq + 1 },
  }
}

type TaxStoreValue = {
  settings: TaxSettings
  docs: TaxDoc[]
  invoices: TaxInvoice[]
  updateSettings: (patch: Partial<TaxSettings>) => void
  recordTaxDoc: (
    input: Omit<TaxDoc, 'id' | 'createdAt' | 'voidedAt'> & { id?: string },
  ) => TaxDoc
  recordSaleInvoice: (
    taxDoc: TaxDoc,
    saleOrderId: string,
    partyName?: string,
  ) => TaxInvoice | undefined
  voidTaxForSource: (sourceType: TaxSourceType, sourceId: string) => void
  sendInvoiceMock: (
    id: string,
    opts: { simulateFail: boolean },
  ) => string | undefined
}

const TaxStoreContext = createContext<TaxStoreValue | null>(null)

export function TaxProvider({ children }: { children: ReactNode }) {
  const boot = taxRepository.load()
  const [settings, setSettings] = useState<TaxSettings>(() => ({
    ...boot.settings,
  }))
  const [docs, setDocs] = useState<TaxDoc[]>(() => [...boot.docs])
  const [invoices, setInvoices] = useState<TaxInvoice[]>(() => [
    ...boot.invoices,
  ])

  const taxRef = useRef({ settings, docs, invoices })
  useEffect(() => {
    taxRef.current = { settings, docs, invoices }
  }, [settings, docs, invoices])

  useEffect(() => {
    taxRepository.save({
      version: 1,
      settings,
      docs,
      invoices,
      updatedAt: new Date().toISOString(),
    })
  }, [settings, docs, invoices])

  const updateSettings = useCallback((patch: Partial<TaxSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }))
  }, [])

  const recordTaxDoc = useCallback(
    (
      input: Omit<TaxDoc, 'id' | 'createdAt' | 'voidedAt'> & { id?: string },
    ): TaxDoc => {
      const doc: TaxDoc = {
        ...input,
        id: input.id ?? nextTaxDocId(),
        createdAt: new Date().toISOString(),
      }
      setDocs((list) => [...list, doc])
      return doc
    },
    [],
  )

  const recordSaleInvoice = useCallback(
    (
      taxDoc: TaxDoc,
      saleOrderId: string,
      partyName?: string,
    ): TaxInvoice | undefined => {
      if (taxDoc.ppn <= 0) return undefined

      const { settings: current } = taxRef.current
      const { number, settings: nextSettings } = nextInvoiceNumber(current)
      const invoice: TaxInvoice = {
        id: `ti-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        number,
        taxDocId: taxDoc.id,
        saleOrderId,
        status: 'draft',
        dpp: taxDoc.dpp,
        ppn: taxDoc.ppn,
        total: taxDoc.total,
        date: taxDoc.date,
        partyName: partyName ?? taxDoc.partyName,
      }
      setSettings(nextSettings)
      setInvoices((list) => [...list, invoice])
      return invoice
    },
    [],
  )

  const voidTaxForSource = useCallback(
    (sourceType: TaxSourceType, sourceId: string) => {
      const now = new Date().toISOString()
      const docIdsToVoid = new Set(
        taxRef.current.docs
          .filter(
            (d) =>
              d.sourceType === sourceType &&
              d.sourceId === sourceId &&
              !d.voidedAt,
          )
          .map((d) => d.id),
      )
      if (docIdsToVoid.size === 0) return

      setDocs((list) =>
        list.map((doc) =>
          docIdsToVoid.has(doc.id) ? { ...doc, voidedAt: now } : doc,
        ),
      )
      setInvoices((list) =>
        list.map((inv) =>
          inv.status !== 'void' && docIdsToVoid.has(inv.taxDocId)
            ? { ...inv, status: 'void' as const }
            : inv,
        ),
      )
    },
    [],
  )

  const sendInvoiceMock = useCallback(
    (id: string, opts: { simulateFail: boolean }): string | undefined => {
      const target = taxRef.current.invoices.find((i) => i.id === id)
      if (!target) return 'Faktur pajak tidak ditemukan.'
      if (target.status === 'void') return 'Faktur sudah void.'
      setInvoices((list) =>
        list.map((inv) => {
          if (inv.id !== id) return inv
          if (opts.simulateFail) {
            return {
              ...inv,
              status: 'failed' as const,
              failReason: 'Simulasi gagal',
              sentAt: undefined,
            }
          }
          return {
            ...inv,
            status: 'sent' as const,
            sentAt: new Date().toISOString(),
            failReason: undefined,
          }
        }),
      )
      return undefined
    },
    [],
  )

  const value = useMemo(
    () => ({
      settings,
      docs,
      invoices,
      updateSettings,
      recordTaxDoc,
      recordSaleInvoice,
      voidTaxForSource,
      sendInvoiceMock,
    }),
    [
      settings,
      docs,
      invoices,
      updateSettings,
      recordTaxDoc,
      recordSaleInvoice,
      voidTaxForSource,
      sendInvoiceMock,
    ],
  )

  return (
    <TaxStoreContext.Provider value={value}>{children}</TaxStoreContext.Provider>
  )
}

export function useTaxStore(): TaxStoreValue {
  const ctx = useContext(TaxStoreContext)
  if (!ctx) {
    throw new Error('useTaxStore harus dipakai di dalam TaxProvider')
  }
  return ctx
}

/** Mount once under TaxProvider so finance-store can record expense tax docs. */
export function ExpenseTaxBridge() {
  const { recordTaxDoc, voidTaxForSource } = useTaxStore()
  useEffect(() => {
    setExpenseTaxBridge({ recordTaxDoc, voidTaxForSource })
    return () => setExpenseTaxBridge(null)
  }, [recordTaxDoc, voidTaxForSource])
  return null
}
