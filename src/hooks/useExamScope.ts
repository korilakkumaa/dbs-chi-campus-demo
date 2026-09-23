import { useCallback, useEffect, useState } from 'react'
import type { User } from '../types'
import type { ExamScopeYear } from '../data/examScopeTypes'
import {
  bootstrapExamScope,
  canMutateExamScope,
  discoverExamScopeYears,
  hydrateExamScope,
  listHydratedExamScopeYears,
  peekExamScope,
  type BootstrapExamScopeMode,
} from '../data/examScopeStore'

/** Load 測考範圍 year doc (remote preferred, seed fallback) + admin bootstrap. */
export function useExamScope(
  startYear: number,
  user: User | null | undefined,
) {
  const isAdmin = canMutateExamScope(user)
  const [doc, setDoc] = useState<ExamScopeYear>(() => peekExamScope(startYear))
  const [loading, setLoading] = useState(true)
  const [knownYears, setKnownYears] = useState<number[]>(() =>
    listHydratedExamScopeYears(),
  )

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void (async () => {
      await discoverExamScopeYears()
      const next = await hydrateExamScope(startYear)
      if (cancelled) return
      setDoc(next)
      setKnownYears(listHydratedExamScopeYears())
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [startYear])

  const bootstrap = useCallback(
    async (mode: BootstrapExamScopeMode, cloneFromYear?: number) => {
      if (!isAdmin) {
        return { ok: false as const, error: '僅管理員可建立測考範圍資料' }
      }
      const result = await bootstrapExamScope(startYear, mode, cloneFromYear)
      if (!result.ok || !result.doc) {
        return { ok: false as const, error: result.error ?? '無法建立' }
      }
      setDoc(result.doc)
      setKnownYears(listHydratedExamScopeYears())
      return { ok: true as const, doc: result.doc }
    },
    [isAdmin, startYear],
  )

  return {
    isAdmin,
    doc,
    loading,
    knownYears,
    bootstrap,
  }
}
