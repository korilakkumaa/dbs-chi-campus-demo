import { useCallback, useEffect, useState } from 'react'
import type { User } from '../types'
import type { DeptDutyItem, DeptDutyYear } from '../data/deptDutyTypes'
import { withDerivedDeptTeachers } from '../data/deptDutyDerive'
import {
  canMutateDuty,
  hydrateDeptDuty,
  listHydratedDeptYears,
  peekDeptDuty,
  saveDeptDuty,
} from '../data/dutyStore'

function cloneDuty(duty: DeptDutyYear): DeptDutyYear {
  return structuredClone(duty)
}

/**
 * Shared year-document load + admin edit draft for 職責.
 * Mirrors useAssessmentDutyEditor for papers.
 */
export function useDeptDutyEditor(
  startYear: number,
  user: User | null | undefined,
) {
  const isAdmin = canMutateDuty(user)
  const [duty, setDuty] = useState<DeptDutyYear | null>(() =>
    peekDeptDuty(startYear),
  )
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<DeptDutyYear | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [knownYears, setKnownYears] = useState<number[]>(() =>
    listHydratedDeptYears(),
  )

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setEditing(false)
    setDraft(null)
    setDirty(false)
    void hydrateDeptDuty(startYear).then((next) => {
      if (cancelled) return
      setDuty(next)
      setKnownYears(listHydratedDeptYears())
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [startYear])

  const displayDuty = editing && draft ? draft : duty

  const enterEdit = useCallback(
    (source?: DeptDutyYear | null) => {
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

  const patchDraftItems = useCallback((items: DeptDutyItem[]) => {
    setDraft((prev) => {
      if (!prev) return prev
      return withDerivedDeptTeachers({
        ...prev,
        items,
        teachers: prev.teachers,
      })
    })
    setDirty(true)
  }, [])

  const save = useCallback(async () => {
    if (!draft || !user) {
      return { ok: false as const, error: '無法儲存' }
    }
    setSaving(true)
    const result = await saveDeptDuty(draft, user)
    setSaving(false)
    if (!result.ok || !result.duty) {
      return { ok: false as const, error: result.error ?? '無法寫入 Supabase。' }
    }
    setDuty(result.duty)
    setDirty(false)
    setDraft(cloneDuty(result.duty))
    setKnownYears(listHydratedDeptYears())
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
    patchDraftItems,
    save,
  }
}
