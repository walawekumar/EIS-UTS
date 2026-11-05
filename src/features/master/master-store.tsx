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
  nextPartnerId,
  nextProductId,
  nextUserId,
  type MasterPartner,
  type MasterProduct,
  type MasterUser,
  type PartnerKind,
} from '@/features/master/master-data'
import {
  createBranchUser,
  loadMasterCloud,
  mapSupabaseError,
  saveMasterCloud,
  updateProfileUser,
} from '@/features/master/master-cloud'
import { masterRepository } from '@/features/master/master-storage'
import { isSupabaseConfigured } from '@/lib/supabase-client'

type PartnerInput = Omit<MasterPartner, 'id' | 'kind'>
type ProductInput = Omit<MasterProduct, 'id'>
type UserInput = Omit<MasterUser, 'id'>

type MasterStoreValue = {
  suppliers: MasterPartner[]
  customers: MasterPartner[]
  products: MasterProduct[]
  users: MasterUser[]
  cloudReady: boolean
  persistError: string | null
  upsertPartner: (kind: PartnerKind, data: PartnerInput, id?: string) => string
  setPartnerActive: (kind: PartnerKind, id: string, active: boolean) => void
  removePartner: (kind: PartnerKind, id: string) => void
  upsertProduct: (data: ProductInput, id?: string) => string
  setProductActive: (id: string, active: boolean) => void
  removeProduct: (id: string) => void
  upsertUser: (data: UserInput, id?: string) => string
  createBranchAccount: (
    data: UserInput & { password: string },
  ) => Promise<string | undefined>
  setUserActive: (id: string, active: boolean) => void
  removeUser: (id: string) => void
}

const MasterContext = createContext<MasterStoreValue | null>(null)

function snapshotOf(
  suppliers: MasterPartner[],
  customers: MasterPartner[],
  products: MasterProduct[],
  users: MasterUser[],
) {
  return {
    version: 1 as const,
    suppliers,
    customers,
    products,
    users,
    updatedAt: new Date().toISOString(),
  }
}

export function MasterProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured()
  const boot = configured
    ? {
        suppliers: [] as MasterPartner[],
        customers: [] as MasterPartner[],
        products: [] as MasterProduct[],
        users: [] as MasterUser[],
      }
    : masterRepository.load()

  const [suppliers, setSuppliers] = useState(() => [...boot.suppliers])
  const [customers, setCustomers] = useState(() => [...boot.customers])
  const [products, setProducts] = useState(() => [...boot.products])
  const [users, setUsers] = useState(() => [...boot.users])
  const [cloudReady, setCloudReady] = useState(!configured)
  const [persistError, setPersistError] = useState<string | null>(null)
  const skipPersist = useRef(configured)

  useEffect(() => {
    if (!configured) return
    let cancelled = false
    void (async () => {
      try {
        const snap = await loadMasterCloud()
        if (cancelled) return
        skipPersist.current = true
        setSuppliers([...snap.suppliers])
        setCustomers([...snap.customers])
        setProducts([...snap.products])
        setUsers([...snap.users])
        setPersistError(null)
        setCloudReady(true)
      } catch (e) {
        if (cancelled) return
        setPersistError(
          `${mapSupabaseError(e)} Data master belum dimuat — penyimpanan cloud dinonaktifkan.`,
        )
        setCloudReady(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [configured])

  useEffect(() => {
    if (configured) {
      if (!cloudReady) return
      if (skipPersist.current) {
        skipPersist.current = false
        return
      }
      const handle = window.setTimeout(() => {
        void saveMasterCloud(snapshotOf(suppliers, customers, products, users))
          .then(() => setPersistError(null))
          .catch((e) => setPersistError(mapSupabaseError(e)))
      }, 300)
      return () => window.clearTimeout(handle)
    }
    masterRepository.save(snapshotOf(suppliers, customers, products, users))
  }, [suppliers, customers, products, users, cloudReady, configured])

  const assertMasterWritable = useCallback((): boolean => {
    if (configured && !cloudReady) {
      setPersistError(
        'Data master cloud belum siap. Muat ulang halaman setelah koneksi pulih.',
      )
      return false
    }
    return true
  }, [configured, cloudReady])

  const upsertPartner = useCallback(
    (kind: PartnerKind, data: PartnerInput, id?: string) => {
      if (!assertMasterWritable()) return id ?? ''
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
    [customers, suppliers, assertMasterWritable],
  )

  const setPartnerActive = useCallback(
    (kind: PartnerKind, id: string, active: boolean) => {
      if (!assertMasterWritable()) return
      const setList = kind === 'supplier' ? setSuppliers : setCustomers
      setList((prev) => prev.map((p) => (p.id === id ? { ...p, active } : p)))
    },
    [assertMasterWritable],
  )

  const removePartner = useCallback(
    (kind: PartnerKind, id: string) => {
      if (!assertMasterWritable()) return
      const setList = kind === 'supplier' ? setSuppliers : setCustomers
      setList((prev) => prev.filter((p) => p.id !== id))
    },
    [assertMasterWritable],
  )

  const upsertProduct = useCallback(
    (data: ProductInput, id?: string) => {
      if (!assertMasterWritable()) return id ?? ''
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
    [products, assertMasterWritable],
  )

  const setProductActive = useCallback(
    (id: string, active: boolean) => {
      if (!assertMasterWritable()) return
      setProducts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, active } : p)),
      )
    },
    [assertMasterWritable],
  )

  const removeProduct = useCallback(
    (id: string) => {
      if (!assertMasterWritable()) return
      setProducts((prev) => prev.filter((p) => p.id !== id))
    },
    [assertMasterWritable],
  )

  const createBranchAccount = useCallback(
    async (data: UserInput & { password: string }) => {
      if (!assertMasterWritable()) return 'Data master belum siap.'
      if (!configured) return 'Supabase belum dikonfigurasi.'
      try {
        const id = await createBranchUser(data)
        setPersistError(null)
        setUsers((prev) => [
          {
            id,
            name: data.name,
            email: data.email,
            role: data.role,
            title: data.title,
            phone: data.phone,
            branch: data.branch,
            department: data.department,
            active: data.active,
          },
          ...prev,
        ])
        return undefined
      } catch (e) {
        const msg = mapSupabaseError(e)
        setPersistError(msg)
        return msg
      }
    },
    [assertMasterWritable, configured],
  )

  const upsertUser = useCallback(
    (data: UserInput, id?: string) => {
      if (!assertMasterWritable()) return id ?? ''
      const nextId = id ?? nextUserId(data.role, users)
      const row: MasterUser = { ...data, id: nextId }
      if (configured) {
        void updateProfileUser(row)
          .then(() => {
            setPersistError(null)
            setUsers((prev) => {
              const idx = prev.findIndex((u) => u.id === nextId)
              if (idx >= 0) {
                const copy = [...prev]
                copy[idx] = row
                return copy
              }
              return [row, ...prev]
            })
          })
          .catch((e) => setPersistError(mapSupabaseError(e)))
        return nextId
      }
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
    [users, configured, assertMasterWritable],
  )

  const setUserActive = useCallback(
    (id: string, active: boolean) => {
      if (!assertMasterWritable()) return
      if (configured) {
        const existing = users.find((u) => u.id === id)
        if (!existing) return
        const row = { ...existing, active }
        void updateProfileUser(row)
          .then(() => {
            setPersistError(null)
            setUsers((prev) =>
              prev.map((u) => (u.id === id ? { ...u, active } : u)),
            )
          })
          .catch((e) => setPersistError(mapSupabaseError(e)))
        return
      }
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, active } : u)))
    },
    [configured, users, assertMasterWritable],
  )

  const removeUser = useCallback(
    (id: string) => {
      if (!assertMasterWritable()) return
      if (configured) {
        const existing = users.find((u) => u.id === id)
        if (!existing) return
        const row = { ...existing, active: false }
        void updateProfileUser(row)
          .then(() => {
            setPersistError(null)
            setUsers((prev) =>
              prev.map((u) => (u.id === id ? { ...u, active: false } : u)),
            )
          })
          .catch((e) => setPersistError(mapSupabaseError(e)))
        return
      }
      setUsers((prev) => prev.filter((u) => u.id !== id))
    },
    [configured, users, assertMasterWritable],
  )

  const value = useMemo(
    () => ({
      suppliers,
      customers,
      products,
      users,
      cloudReady,
      persistError,
      upsertPartner,
      setPartnerActive,
      removePartner,
      upsertProduct,
      setProductActive,
      removeProduct,
      upsertUser,
      createBranchAccount,
      setUserActive,
      removeUser,
    }),
    [
      suppliers,
      customers,
      products,
      users,
      cloudReady,
      persistError,
      upsertPartner,
      setPartnerActive,
      removePartner,
      upsertProduct,
      setProductActive,
      removeProduct,
      upsertUser,
      createBranchAccount,
      setUserActive,
      removeUser,
    ],
  )

  return (
    <MasterContext.Provider value={value}>
      {persistError ? (
        <div
          className="bg-red-50 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          {persistError}
        </div>
      ) : null}
      {children}
    </MasterContext.Provider>
  )
}

export function useMasterStore(): MasterStoreValue {
  const ctx = useContext(MasterContext)
  if (!ctx) {
    throw new Error('useMasterStore harus dipakai di dalam MasterProvider')
  }
  return ctx
}
