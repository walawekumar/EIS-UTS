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
import { useAuth } from '@/features/auth/AuthContext'
import {
  type Account,
  type AccountMap,
  type AccountMapKey,
  type FailedJournalPost,
  type JournalEntry,
  type JournalLine,
  type JournalSourceType,
} from '@/features/keuangan/gl-data'
import {
  enqueueFailedPost,
  postJournal,
  removeFailedPost,
  reverseJournal,
} from '@/features/keuangan/gl-journal'
import { glRepository } from '@/features/keuangan/gl-storage'
import { keuanganRepository } from '@/features/keuangan/keuangan-storage'
import {
  formatDateId,
  nextCashRef,
  nextExpenseRef,
  resolvePayableStatus,
  resolveReceivableStatus,
  type CashDirection,
  type CashEntry,
  type ExpenseRow,
  type ExpenseStatus,
  type PayableRow,
  type ReceivableRow,
} from '@/features/keuangan/keuangan-data'

type AddCashInput = {
  direction: CashDirection
  category: string
  description: string
  amount: number
  receiptName?: string
}

type PayInput = {
  id: string
  amount: number
  invoice: string
  party: string
  note?: string
  receiptName?: string
}

type AddExpenseInput = {
  category: string
  description: string
  amount: number
  status: 'draft' | 'posted'
  receiptName?: string
}

type UpsertPayableInput = {
  sourceId: string
  supplier: string
  invoice: string
  dueDateIso: string
  amount: number
  paid?: number
}

type UpsertReceivableInput = {
  sourceId: string
  customer: string
  invoice: string
  dueDateIso: string
  amount: number
  paid?: number
}

type ApplyLinkedPayInput = {
  sourceId: string
  amount: number
  party: string
  invoice: string
  receiptName?: string
  note?: string
}

type PostJournalEntryInput = {
  date: string
  memo: string
  sourceKey?: string
  sourceType: JournalSourceType
  manual: boolean
  lines: JournalLine[]
}

type FinanceStoreValue = {
  cashEntries: CashEntry[]
  payables: PayableRow[]
  receivables: ReceivableRow[]
  expenses: ExpenseRow[]
  accounts: Account[]
  accountMap: AccountMap
  journals: JournalEntry[]
  failedPosts: FailedJournalPost[]
  postJournalEntry: (input: PostJournalEntryInput) => string | undefined
  reverseJournalEntry: (opts: {
    sourceKey?: string
    id?: string
  }) => string | undefined
  retryFailedPost: (sourceKey: string) => string | undefined
  upsertAccount: (account: Account) => string | undefined
  setAccountActive: (id: string, active: boolean) => string | undefined
  setAccountMap: (map: AccountMap) => void
  mapAccount: (key: AccountMapKey) => string
  addCashEntry: (input: AddCashInput) => void
  removeCashEntry: (id: string) => void
  payPayable: (input: PayInput) => void
  receiveReceivable: (input: PayInput) => void
  addExpense: (input: AddExpenseInput) => void
  setExpenseStatus: (id: string, status: ExpenseStatus) => void
  upsertPayableFromPurchase: (input: UpsertPayableInput) => void
  applyPurchasePayment: (input: ApplyLinkedPayInput) => void
  upsertReceivableFromSale: (input: UpsertReceivableInput) => void
  applySalePayment: (input: ApplyLinkedPayInput) => void
  removeLinkedPayable: (sourceId: string) => void
  removeLinkedReceivable: (sourceId: string) => void
  creditPayable: (invoice: string, amount: number) => void
  creditReceivable: (invoice: string, amount: number) => void
}

const FinanceStoreContext = createContext<FinanceStoreValue | null>(null)

function dueLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return formatDateId(d)
}

function agingFromDue(iso: string): number {
  const due = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(due.getTime())) return 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.floor((today.getTime() - due.getTime()) / 86_400_000)
  return Math.max(0, diff)
}

function todayGlDate(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function prependCash(
  list: CashEntry[],
  partial: {
    direction: CashDirection
    category: string
    description: string
    amount: number
    actor: string
    receiptName?: string
  },
): CashEntry[] {
  const prev = list[0]?.balance ?? 0
  const balance =
    partial.direction === 'in'
      ? prev + partial.amount
      : Math.max(0, prev - partial.amount)
  const entry: CashEntry = {
    id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    date: formatDateId(),
    reference: nextCashRef(list, partial.direction),
    description: partial.description,
    category: partial.category,
    direction: partial.direction,
    amount: partial.amount,
    balance,
    actor: partial.actor,
    receiptName: partial.receiptName,
  }
  return [entry, ...list]
}

export function FinanceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const actor = user?.name ?? 'Pengguna'

  const boot = keuanganRepository.load()
  const glBoot = glRepository.load()
  const [cashEntries, setCashEntries] = useState<CashEntry[]>(() => [
    ...boot.cashEntries,
  ])
  const [payables, setPayables] = useState<PayableRow[]>(() => [...boot.payables])
  const [receivables, setReceivables] = useState<ReceivableRow[]>(() => [
    ...boot.receivables,
  ])
  const [expenses, setExpenses] = useState<ExpenseRow[]>(() => [...boot.expenses])
  const [accounts, setAccounts] = useState<Account[]>(() => [...glBoot.accounts])
  const [accountMap, setAccountMapState] = useState<AccountMap>(() => ({
    ...glBoot.accountMap,
  }))
  const [journals, setJournals] = useState<JournalEntry[]>(() => [
    ...glBoot.journals,
  ])
  const [failedPosts, setFailedPosts] = useState<FailedJournalPost[]>(() => [
    ...glBoot.failedPosts,
  ])

  const glRef = useRef({
    accounts,
    accountMap,
    journals,
    failedPosts,
  })
  useEffect(() => {
    glRef.current = { accounts, accountMap, journals, failedPosts }
  }, [accounts, accountMap, journals, failedPosts])

  useEffect(() => {
    keuanganRepository.save({
      version: 1,
      cashEntries,
      payables,
      receivables,
      expenses,
      updatedAt: new Date().toISOString(),
    })
  }, [cashEntries, payables, receivables, expenses])

  useEffect(() => {
    glRepository.save({
      version: 1,
      accounts,
      accountMap,
      journals,
      failedPosts,
      updatedAt: new Date().toISOString(),
    })
  }, [accounts, accountMap, journals, failedPosts])

  const addCashEntry = useCallback(
    (input: AddCashInput) => {
      setCashEntries((list) => prependCash(list, { ...input, actor }))
    },
    [actor],
  )

  const removeCashEntry = useCallback((id: string) => {
    setCashEntries((list) => list.filter((e) => e.id !== id))
  }, [])

  const payPayable = useCallback(
    ({ id, amount, invoice, party, note, receiptName }: PayInput) => {
      setPayables((list) =>
        list.map((row) => {
          if (row.id !== id) return row
          const paid = row.paid + amount
          return {
            ...row,
            paid,
            status: resolvePayableStatus(row.amount, paid, row.agingDays),
            receiptName: receiptName ?? row.receiptName,
          }
        }),
      )
      const desc = `Bayar utang ${invoice} · ${party}${
        note?.trim() ? ` — ${note.trim()}` : ''
      }`
      setCashEntries((list) =>
        prependCash(list, {
          direction: 'out',
          category: 'Utang',
          description: desc,
          amount,
          actor,
          receiptName,
        }),
      )
    },
    [actor],
  )

  const receiveReceivable = useCallback(
    ({ id, amount, invoice, party, note, receiptName }: PayInput) => {
      setReceivables((list) =>
        list.map((row) => {
          if (row.id !== id) return row
          const paid = row.paid + amount
          return {
            ...row,
            paid,
            status: resolveReceivableStatus(row.amount, paid, row.agingDays),
            receiptName: receiptName ?? row.receiptName,
          }
        }),
      )
      const desc = `Terima piutang ${invoice} · ${party}${
        note?.trim() ? ` — ${note.trim()}` : ''
      }`
      setCashEntries((list) =>
        prependCash(list, {
          direction: 'in',
          category: 'Piutang',
          description: desc,
          amount,
          actor,
          receiptName,
        }),
      )
    },
    [actor],
  )

  const addExpense = useCallback(
    (input: AddExpenseInput) => {
      setExpenses((list) => {
        const entry: ExpenseRow = {
          id: `e-${Date.now()}`,
          date: formatDateId(),
          reference: nextExpenseRef(list),
          category: input.category,
          description: input.description,
          amount: input.amount,
          status: input.status,
          actor,
          receiptName: input.receiptName,
        }
        if (input.status === 'posted') {
          setCashEntries((cash) =>
            prependCash(cash, {
              direction: 'out',
              category: 'Operasional',
              description: `Biaya ${entry.reference} · ${entry.description}`,
              amount: entry.amount,
              actor,
              receiptName: entry.receiptName,
            }),
          )
        }
        return [entry, ...list]
      })
    },
    [actor],
  )

  const setExpenseStatus = useCallback(
    (id: string, status: ExpenseStatus) => {
      setExpenses((list) => {
        const prev = list.find((e) => e.id === id)
        if (prev && prev.status !== 'posted' && status === 'posted') {
          setCashEntries((cash) =>
            prependCash(cash, {
              direction: 'out',
              category: 'Operasional',
              description: `Biaya ${prev.reference} · ${prev.description}`,
              amount: prev.amount,
              actor,
              receiptName: prev.receiptName,
            }),
          )
        }
        return list.map((item) =>
          item.id === id ? { ...item, status } : item,
        )
      })
    },
    [actor],
  )

  const upsertPayableFromPurchase = useCallback((input: UpsertPayableInput) => {
    const id = `ap-${input.sourceId}`
    const agingDays = agingFromDue(input.dueDateIso)
    const paid = input.paid ?? 0
    setPayables((list) => {
      const row: PayableRow = {
        id,
        supplier: input.supplier,
        invoice: input.invoice,
        dueDate: dueLabel(input.dueDateIso),
        amount: input.amount,
        paid,
        status: resolvePayableStatus(input.amount, paid, agingDays),
        agingDays,
      }
      const idx = list.findIndex((r) => r.id === id)
      if (idx >= 0) {
        const next = [...list]
        next[idx] = { ...row, receiptName: list[idx].receiptName }
        return next
      }
      return [row, ...list]
    })
  }, [])

  const applyPurchasePayment = useCallback(
    ({ sourceId, amount, party, invoice, receiptName, note }: ApplyLinkedPayInput) => {
      const id = `ap-${sourceId}`
      setPayables((list) => {
        const exists = list.some((r) => r.id === id)
        if (!exists) return list
        return list.map((row) => {
          if (row.id !== id) return row
          const paid = row.paid + amount
          return {
            ...row,
            paid,
            status: resolvePayableStatus(row.amount, paid, row.agingDays),
            receiptName: receiptName ?? row.receiptName,
          }
        })
      })
      setCashEntries((list) =>
        prependCash(list, {
          direction: 'out',
          category: 'Utang',
          description: `Bayar pembelian ${invoice} · ${party}${
            note?.trim() ? ` — ${note.trim()}` : ''
          }`,
          amount,
          actor,
          receiptName,
        }),
      )
    },
    [actor],
  )

  const upsertReceivableFromSale = useCallback((input: UpsertReceivableInput) => {
    const id = `ar-${input.sourceId}`
    const agingDays = agingFromDue(input.dueDateIso)
    const paid = input.paid ?? 0
    setReceivables((list) => {
      const row: ReceivableRow = {
        id,
        customer: input.customer,
        invoice: input.invoice,
        dueDate: dueLabel(input.dueDateIso),
        amount: input.amount,
        paid,
        status: resolveReceivableStatus(input.amount, paid, agingDays),
        agingDays,
      }
      const idx = list.findIndex((r) => r.id === id)
      if (idx >= 0) {
        const next = [...list]
        next[idx] = { ...row, receiptName: list[idx].receiptName }
        return next
      }
      return [row, ...list]
    })
  }, [])

  const applySalePayment = useCallback(
    ({ sourceId, amount, party, invoice, receiptName, note }: ApplyLinkedPayInput) => {
      const id = `ar-${sourceId}`
      setReceivables((list) => {
        const exists = list.some((r) => r.id === id)
        if (!exists) return list
        return list.map((row) => {
          if (row.id !== id) return row
          const paid = row.paid + amount
          return {
            ...row,
            paid,
            status: resolveReceivableStatus(row.amount, paid, row.agingDays),
            receiptName: receiptName ?? row.receiptName,
          }
        })
      })
      setCashEntries((list) =>
        prependCash(list, {
          direction: 'in',
          category: 'Piutang',
          description: `Terima penjualan ${invoice} · ${party}${
            note?.trim() ? ` — ${note.trim()}` : ''
          }`,
          amount,
          actor,
          receiptName,
        }),
      )
    },
    [actor],
  )

  const removeLinkedPayable = useCallback((sourceId: string) => {
    setPayables((list) => list.filter((r) => r.id !== `ap-${sourceId}`))
  }, [])

  const removeLinkedReceivable = useCallback((sourceId: string) => {
    setReceivables((list) => list.filter((r) => r.id !== `ar-${sourceId}`))
  }, [])

  const creditPayable = useCallback((invoice: string, credit: number) => {
    if (credit <= 0) return
    setPayables((list) =>
      list.map((row) => {
        if (row.invoice !== invoice) return row
        const amount = Math.max(row.paid, row.amount - credit)
        return {
          ...row,
          amount,
          status: resolvePayableStatus(amount, row.paid, row.agingDays),
        }
      }),
    )
  }, [])

  const creditReceivable = useCallback((invoice: string, credit: number) => {
    if (credit <= 0) return
    setReceivables((list) =>
      list.map((row) => {
        if (row.invoice !== invoice) return row
        const amount = Math.max(row.paid, row.amount - credit)
        return {
          ...row,
          amount,
          status: resolveReceivableStatus(amount, row.paid, row.agingDays),
        }
      }),
    )
  }, [])

  const mapAccount = useCallback(
    (key: AccountMapKey) => glRef.current.accountMap[key],
    [],
  )

  const setAccountMap = useCallback((map: AccountMap) => {
    const nextMap = { ...map }
    glRef.current = { ...glRef.current, accountMap: nextMap }
    setAccountMapState(nextMap)
  }, [])

  const upsertAccount = useCallback((account: Account): string | undefined => {
    const code = account.code.trim()
    const name = account.name.trim()
    if (!code || !name) return 'Kode dan nama akun wajib diisi.'
    const { accounts: list } = glRef.current
    if (list.some((a) => a.code === code && a.id !== account.id)) {
      return 'Kode akun sudah dipakai.'
    }
    const idx = list.findIndex((a) => a.id === account.id)
    if (idx < 0) {
      if (account.system) return 'Akun baru tidak boleh berstatus sistem.'
      const nextAccounts = [
        { ...account, code, name, system: false },
        ...list,
      ]
      glRef.current = { ...glRef.current, accounts: nextAccounts }
      setAccounts(nextAccounts)
      return undefined
    }
    const prev = list[idx]
    if (prev.system) {
      const nextAccounts = list.map((a) =>
        a.id === account.id
          ? { ...prev, code, name, active: account.active }
          : a,
      )
      glRef.current = { ...glRef.current, accounts: nextAccounts }
      setAccounts(nextAccounts)
      return undefined
    }
    const nextAccounts = list.map((a) =>
      a.id === account.id ? { ...account, code, name, system: false } : a,
    )
    glRef.current = { ...glRef.current, accounts: nextAccounts }
    setAccounts(nextAccounts)
    return undefined
  }, [])

  const setAccountActive = useCallback(
    (id: string, active: boolean): string | undefined => {
      const { accounts: list } = glRef.current
      if (!list.some((a) => a.id === id)) return 'Akun tidak ditemukan.'
      const nextAccounts = list.map((a) =>
        a.id === id ? { ...a, active } : a,
      )
      glRef.current = { ...glRef.current, accounts: nextAccounts }
      setAccounts(nextAccounts)
      return undefined
    },
    [],
  )

  const postJournalEntry = useCallback(
    (input: PostJournalEntryInput): string | undefined => {
      const { accounts: accts, journals: jrn, failedPosts: failed } =
        glRef.current
      const result = postJournal({
        ...input,
        createdBy: actor,
        accounts: accts,
        journals: jrn,
      })
      if (result.ok) {
        const nextFailed = input.sourceKey
          ? removeFailedPost(failed, input.sourceKey)
          : failed
        glRef.current = {
          ...glRef.current,
          journals: result.journals,
          failedPosts: nextFailed,
        }
        setJournals(result.journals)
        if (input.sourceKey) {
          setFailedPosts(nextFailed)
        }
        return undefined
      }
      if (input.sourceKey) {
        const nextFailed = enqueueFailedPost(failed, {
          sourceKey: input.sourceKey,
          payload: {
            date: input.date,
            memo: input.memo,
            sourceKey: input.sourceKey,
            sourceType: input.sourceType,
            manual: input.manual,
            lines: input.lines,
            createdBy: actor,
          },
          error: result.error,
          createdAt: new Date().toISOString(),
        })
        glRef.current = { ...glRef.current, failedPosts: nextFailed }
        setFailedPosts(nextFailed)
      }
      return result.error
    },
    [actor],
  )

  const reverseJournalEntry = useCallback(
    (opts: { sourceKey?: string; id?: string }): string | undefined => {
      const { journals: jrn } = glRef.current
      const result = reverseJournal(jrn, {
        ...opts,
        createdBy: actor,
        date: todayGlDate(),
      })
      if (!result.ok) return result.error
      glRef.current = { ...glRef.current, journals: result.journals }
      setJournals(result.journals)
      return undefined
    },
    [actor],
  )

  const retryFailedPost = useCallback(
    (sourceKey: string): string | undefined => {
      const item = glRef.current.failedPosts.find(
        (f) => f.sourceKey === sourceKey,
      )
      if (!item) return 'Antrian jurnal gagal tidak ditemukan.'
      return postJournalEntry({
        date: item.payload.date,
        memo: item.payload.memo,
        sourceKey: item.sourceKey,
        sourceType: item.payload.sourceType,
        manual: item.payload.manual,
        lines: item.payload.lines,
      })
    },
    [postJournalEntry],
  )

  const value = useMemo(
    () => ({
      cashEntries,
      payables,
      receivables,
      expenses,
      accounts,
      accountMap,
      journals,
      failedPosts,
      postJournalEntry,
      reverseJournalEntry,
      retryFailedPost,
      upsertAccount,
      setAccountActive,
      setAccountMap,
      mapAccount,
      addCashEntry,
      removeCashEntry,
      payPayable,
      receiveReceivable,
      addExpense,
      setExpenseStatus,
      upsertPayableFromPurchase,
      applyPurchasePayment,
      upsertReceivableFromSale,
      applySalePayment,
      removeLinkedPayable,
      removeLinkedReceivable,
      creditPayable,
      creditReceivable,
    }),
    [
      cashEntries,
      payables,
      receivables,
      expenses,
      accounts,
      accountMap,
      journals,
      failedPosts,
      postJournalEntry,
      reverseJournalEntry,
      retryFailedPost,
      upsertAccount,
      setAccountActive,
      setAccountMap,
      mapAccount,
      addCashEntry,
      removeCashEntry,
      payPayable,
      receiveReceivable,
      addExpense,
      setExpenseStatus,
      upsertPayableFromPurchase,
      applyPurchasePayment,
      upsertReceivableFromSale,
      applySalePayment,
      removeLinkedPayable,
      removeLinkedReceivable,
      creditPayable,
      creditReceivable,
    ],
  )

  return (
    <FinanceStoreContext.Provider value={value}>
      {children}
    </FinanceStoreContext.Provider>
  )
}

export function useFinanceStore(): FinanceStoreValue {
  const ctx = useContext(FinanceStoreContext)
  if (!ctx) {
    throw new Error('useFinanceStore harus dipakai di dalam FinanceProvider')
  }
  return ctx
}
