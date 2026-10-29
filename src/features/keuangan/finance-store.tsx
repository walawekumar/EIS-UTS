import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from '@/features/auth/AuthContext'
import {
  CASH_ENTRIES,
  EXPENSES,
  PAYABLES,
  RECEIVABLES,
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

type FinanceStoreValue = {
  cashEntries: CashEntry[]
  payables: PayableRow[]
  receivables: ReceivableRow[]
  expenses: ExpenseRow[]
  addCashEntry: (input: AddCashInput) => void
  removeCashEntry: (id: string) => void
  payPayable: (input: PayInput) => void
  receiveReceivable: (input: PayInput) => void
  addExpense: (input: AddExpenseInput) => void
  setExpenseStatus: (id: string, status: ExpenseStatus) => void
}

const FinanceStoreContext = createContext<FinanceStoreValue | null>(null)

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

  const [cashEntries, setCashEntries] = useState<CashEntry[]>(() => [
    ...CASH_ENTRIES,
  ])
  const [payables, setPayables] = useState<PayableRow[]>(() => [...PAYABLES])
  const [receivables, setReceivables] = useState<ReceivableRow[]>(() => [
    ...RECEIVABLES,
  ])
  const [expenses, setExpenses] = useState<ExpenseRow[]>(() => [...EXPENSES])

  const addCashEntry = useCallback(
    (input: AddCashInput) => {
      setCashEntries((list) =>
        prependCash(list, {
          ...input,
          actor,
        }),
      )
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

  const value = useMemo(
    () => ({
      cashEntries,
      payables,
      receivables,
      expenses,
      addCashEntry,
      removeCashEntry,
      payPayable,
      receiveReceivable,
      addExpense,
      setExpenseStatus,
    }),
    [
      cashEntries,
      payables,
      receivables,
      expenses,
      addCashEntry,
      removeCashEntry,
      payPayable,
      receiveReceivable,
      addExpense,
      setExpenseStatus,
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
