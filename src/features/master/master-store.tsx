import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  nextPartnerId,
  nextProductId,
  nextUserId,
  type MasterPartner,
  type MasterProduct,
  type MasterUser,
  type PartnerKind,
} from '@/features/master/master-data'
import { masterRepository } from '@/features/master/master-storage'

type PartnerInput = Omit<MasterPartner, 'id' | 'kind'>
type ProductInput = Omit<MasterProduct, 'id'>
type UserInput = Omit<MasterUser, 'id'>

type MasterStoreValue = {
  suppliers: MasterPartner[]
  customers: MasterPartner[]
  products: MasterProduct[]
  users: MasterUser[]
  upsertPartner: (kind: PartnerKind, data: PartnerInput, id?: string) => string
  setPartnerActive: (kind: PartnerKind, id: string, active: boolean) => void
  removePartner: (kind: PartnerKind, id: string) => void
  upsertProduct: (data: ProductInput, id?: string) => string
  setProductActive: (id: string, active: boolean) => void
  removeProduct: (id: string) => void
  upsertUser: (data: UserInput, id?: string) => string
  setUserActive: (id: string, active: boolean) => void
  removeUser: (id: string) => void
}

const MasterContext = createContext<MasterStoreValue | null>(null)

export function MasterProvider({ children }: { children: ReactNode }) {
  const boot = masterRepository.load()
  const [suppliers, setSuppliers] = useState(() => [...boot.suppliers])
  const [customers, setCustomers] = useState(() => [...boot.customers])
  const [products, setProducts] = useState(() => [...boot.products])
  const [users, setUsers] = useState(() => [...boot.users])

  useEffect(() => {
    masterRepository.save({
      version: 1,
      suppliers,
      customers,
      products,
      users,
      updatedAt: new Date().toISOString(),
    })
  }, [suppliers, customers, products, users])

  const upsertPartner = useCallback(
    (kind: PartnerKind, data: PartnerInput, id?: string) => {
      const list = kind === 'supplier' ? suppliers : customers
      const setList = kind === 'supplier' ? setSuppliers : setCustomers
      const nextId = id ?? nextPartnerId(kind, list)
      const row: MasterPartner = { ...data, id: nextId, kind }
      setList((prev) => {
        const idx = prev.findIndex((p) => p.id === nextId)
        if (idx >= 0) {
          const copy = [...prev]
          copy[idx] = row
          return copy
        }
        return [row, ...prev]
      })
      return nextId
    },
    [customers, suppliers],
  )

  const setPartnerActive = useCallback(
    (kind: PartnerKind, id: string, active: boolean) => {
      const setList = kind === 'supplier' ? setSuppliers : setCustomers
      setList((prev) => prev.map((p) => (p.id === id ? { ...p, active } : p)))
    },
    [],
  )

  const removePartner = useCallback((kind: PartnerKind, id: string) => {
    const setList = kind === 'supplier' ? setSuppliers : setCustomers
    setList((prev) => prev.filter((p) => p.id !== id))
  }, [])

  const upsertProduct = useCallback(
    (data: ProductInput, id?: string) => {
      const nextId = id ?? nextProductId(products)
      const row: MasterProduct = { ...data, id: nextId }
      setProducts((prev) => {
        const idx = prev.findIndex((p) => p.id === nextId)
        if (idx >= 0) {
          const copy = [...prev]
          copy[idx] = row
          return copy
        }
        return [row, ...prev]
      })
      return nextId
    },
    [products],
  )

  const setProductActive = useCallback((id: string, active: boolean) => {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, active } : p)))
  }, [])

  const removeProduct = useCallback((id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id))
  }, [])

  const upsertUser = useCallback(
    (data: UserInput, id?: string) => {
      const nextId = id ?? nextUserId(data.role, users)
      const row: MasterUser = { ...data, id: nextId }
      setUsers((prev) => {
        const idx = prev.findIndex((u) => u.id === nextId)
        if (idx >= 0) {
          const copy = [...prev]
          copy[idx] = row
          return copy
        }
        return [row, ...prev]
      })
      return nextId
    },
    [users],
  )

  const setUserActive = useCallback((id: string, active: boolean) => {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, active } : u)))
  }, [])

  const removeUser = useCallback((id: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== id))
  }, [])

  const value = useMemo(
    () => ({
      suppliers,
      customers,
      products,
      users,
      upsertPartner,
      setPartnerActive,
      removePartner,
      upsertProduct,
      setProductActive,
      removeProduct,
      upsertUser,
      setUserActive,
      removeUser,
    }),
    [
      suppliers,
      customers,
      products,
      users,
      upsertPartner,
      setPartnerActive,
      removePartner,
      upsertProduct,
      setProductActive,
      removeProduct,
      upsertUser,
      setUserActive,
      removeUser,
    ],
  )

  return <MasterContext.Provider value={value}>{children}</MasterContext.Provider>
}

export function useMasterStore(): MasterStoreValue {
  const ctx = useContext(MasterContext)
  if (!ctx) throw new Error('useMasterStore harus dipakai di dalam MasterProvider')
  return ctx
}

