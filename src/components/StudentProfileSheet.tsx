
type HistoryRow = {
  class_id: string
  class_name: string
  student_id: string
  student_name: string
  lesson_id: string
  lesson_title: string
  date: string
  status: string
}

interface Props {
  studentId: string | null
  studentName: string
  historyData: HistoryRow[]
  classes: { id: string; name: string; subject: string }[]
  onClose: () => void
}

export default function StudentProfileSheet({ studentId, studentName, historyData, classes, onClose }: Props) {
  if (!studentId) return null

  const rows = historyData.filter(r => r.student_id === studentId)

  // Group by class_id, sum statuses
  const subjectStats = classes
    .map(cls => {
      const classRows = rows.filter(r => r.class_id === cls.id)
      if (classRows.length === 0) return null
      const gotIt = classRows.filter(r => r.status === 'got-it').length
      const almost = classRows.filter(r => r.status === 'almost').length
      const needsHelp = classRows.filter(r => r.status === 'needs-help').length
      const total = classRows.length
      return { label: cls.subject || cls.name, gotIt, almost, needsHelp, total }
    })
    .filter(Boolean) as { label: string; gotIt: number; almost: number; needsHelp: number; total: number }[]

  // Fallback: if student has data in classes not in the classes array (shouldn't happen, but guard)
  const knownClassIds = new Set(classes.map(c => c.id))
  const unknownRows = rows.filter(r => !knownClassIds.has(r.class_id))
  if (unknownRows.length > 0) {
    const byClass = new Map<string, { name: string; rows: HistoryRow[] }>()
    for (const r of unknownRows) {
      if (!byClass.has(r.class_id)) byClass.set(r.class_id, { name: r.class_name, rows: [] })
      byClass.get(r.class_id)!.rows.push(r)
    }
    for (const { name, rows: cr } of byClass.values()) {
      subjectStats.push({
        label: name,
        gotIt: cr.filter(r => r.status === 'got-it').length,
        almost: cr.filter(r => r.status === 'almost').length,
        needsHelp: cr.filter(r => r.status === 'needs-help').length,
        total: cr.length,
      })
    }
  }

  const firstName = studentName.trim().split(/\s+/)[0]

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl shadow-2xl px-5 pt-5 pb-8 max-h-[80vh] overflow-y-auto" style={{ background: '#161618' }}>
        {/* Handle */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold" style={{ color: '#f0f0f2' }}>{studentName}</h2>
            <p className="text-xs mt-0.5" style={{ color: '#5a5a6a' }}>{rows.length} check-in{rows.length !== 1 ? 's' : ''} across {subjectStats.length} subject{subjectStats.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xl leading-none px-2 hover:text-white transition-colors"
            style={{ color: '#5a5a6a' }}
          >
            ✕
          </button>
        </div>

        {subjectStats.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: '#5a5a6a' }}>No check-in data yet for {firstName}.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {subjectStats.map(({ label, gotIt, almost, needsHelp, total }) => {
              const gotItPct = (gotIt / total) * 100
              const almostPct = (almost / total) * 100
              const needsHelpPct = (needsHelp / total) * 100
              return (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-semibold" style={{ color: '#f0f0f2' }}>{label}</span>
                    <span className="text-xs" style={{ color: '#5a5a6a' }}>{total} session{total !== 1 ? 's' : ''}</span>
                  </div>

                  {/* Stacked bar */}
                  <div className="h-5 w-full rounded-full overflow-hidden flex" style={{ background: 'rgba(255,255,255,0.08)' }}>
                    {gotIt > 0 && (
                      <div
                        className="h-full bg-emerald-400 transition-all"
                        style={{ width: `${gotItPct}%` }}
                      />
                    )}
                    {almost > 0 && (
                      <div
                        className="h-full bg-yellow-400 transition-all"
                        style={{ width: `${almostPct}%` }}
                      />
                    )}
                    {needsHelp > 0 && (
                      <div
                        className="h-full bg-red-400 transition-all"
                        style={{ width: `${needsHelpPct}%` }}
                      />
                    )}
                  </div>

                  {/* Legend counts */}
                  <div className="flex gap-3 mt-1.5">
                    {gotIt > 0 && (
                      <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                        {gotIt} Got It
                      </span>
                    )}
                    {almost > 0 && (
                      <span className="text-xs font-semibold text-yellow-400 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />
                        {almost} Almost
                      </span>
                    )}
                    {needsHelp > 0 && (
                      <span className="text-xs font-semibold text-red-400 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
                        {needsHelp} Needs Help
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
