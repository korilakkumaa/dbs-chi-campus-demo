import { useCallback, useEffect, useState } from 'react'
import type { User } from '../types'
import type { AssessmentDutyYear } from '../data/assessmentDutyTypes'
import {
  bootstrapAssessmentDuty,
  type BootstrapAssessmentMode,
  canMutateDuty,
  discoverAssessmentDutyYears,
  hydrateAssessmentDuty,
  listHydratedAssessmentYears,
  peekAssessmentDuty,
  saveAssessmentDuty,
} from '../data/dutyStore'
import { withDerivedAssessmentTeachers } from '../data/assessmentDutyDerive'

function cloneDuty(duty: AssessmentDutyYear): AssessmentDutyYear {
  return structuredClone(duty)
}

/**
 * Shared year-document load + admin edit draft for 出卷.
 * Keeps PapersPage focused on view layout; persist rules stay in dutyStore.
 */
export function useAssessmentDutyEditor(
  startYear: number,
  user: User | null | undefined,
) {
  const isAdmin = canMutateDuty(user)
  const [duty, setDuty] = useState<AssessmentDutyYear | null>(() =>
    peekAssessmentDuty(startYear),
  )
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<AssessmentDutyYear | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [knownYears, setKnownYears] = useState<number[]>(() =>
    listHydratedAssessmentYears(),
  )

  useEffect(() => {
    let cancelled = false
    void discoverAssessmentDutyYears().then((years) => {
      if (!cancelled) setKnownYears(years)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setEditing(false)
    setDraft(null)
    setDirty(false)
    void hydrateAssessmentDuty(startYear).then((next) => {
      if (cancelled) return
      setDuty(next)
      setKnownYears(listHydratedAssessmentYears())
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [startYear])

  const displayDuty = editing && draft ? draft : duty

  const enterEdit = useCallback(
    (source?: AssessmentDutyYear | null) => {
      const base = source ?? duty
      if (!base || !isAdmin) return false
      setDraft(cloneDuty(base))
      setEditing(true)
      setDirty(false)
      return true
    },
    [duty, isAdmin],
  )

  const exitEdit = useCallback(() => {
    setEditing(false)
    setDraft(null)
    setDirty(false)
  }, [])

  const patchDraft = useCallback(
    (patch: Partial<Pick<AssessmentDutyYear, 'gradeMatrix' | 'ecAppendix'>>) => {
      setDraft((prev) => {
        if (!prev) return prev
        return withDerivedAssessmentTeachers({
          ...prev,
          ...patch,
        })
      })
      setDirty(true)
    },
    [],
  )

  const bootstrap = useCallback(
    async (mode: BootstrapAssessmentMode, cloneFromYear?: number) => {
      if (!isAdmin) {
        return { ok: false as const, error: '僅管理員可建立出卷資料' }
      }
      const result = await bootstrapAssessmentDuty(startYear, mode, cloneFromYear)
      if (!result.ok || !result.duty) {
        return { ok: false as const, error: result.error ?? '建立失敗' }
      }
      setDuty(result.duty)
      setKnownYears(listHydratedAssessmentYears())
      enterEdit(result.duty)
      setDirty(true)
      return { ok: true as const, duty: result.duty }
    },
    [enterEdit, isAdmin, startYear],
  )

  const save = useCallback(async () => {
    if (!draft || !user) {
      return { ok: false as const, error: '無法儲存' }
    }
    setSaving(true)
    const result = await saveAssessmentDuty(draft, user)
    setSaving(false)
    if (!result.ok || !result.duty) {
      return { ok: false as const, error: result.error ?? '無法寫入 Supabase。' }
    }
    setDuty(result.duty)
    setDirty(false)
    setDraft(cloneDuty(result.duty))
    setKnownYears(listHydratedAssessmentYears())
    return { ok: true as const, duty: result.duty }
  }, [draft, user])

  return {
    isAdmin,
    duty,
    displayDuty,
    loading,
    editing,
    draft,
    dirty,
    saving,
    knownYears,
    enterEdit,
    exitEdit,
    patchDraft,
    bootstrap,
    save,
  }
}
