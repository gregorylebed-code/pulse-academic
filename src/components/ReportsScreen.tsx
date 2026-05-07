import { useState, useRef } from 'react'
import type { ReportsScreenProps, AppClass, ReportClass, ReportStudent } from '../types'

interface ExtraProps extends ReportsScreenProps {
  classLabel: (cls: AppClass) => string
  showSkills: boolean
}

export default function ReportsScreen(props: ExtraProps) {
  const {
    classes, classLabel, reportClassId, setReportClassId, reportRange, setReportRange, reportCustomStart, setReportCustomStart, reportCustomEnd,
    setReportCustomEnd, reportData, copyReport, reportCopied, showSkills, dismissCheckin
  } = props

  // key: `${studentId}|${lessonId}|${skill ?? ''}`
  const [pendingDismiss, setPendingDismiss] = useState<Set<string>>(new Set())
  const timerRefs = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  function dismissKey(studentId: string, lessonId: string, skill: string | null | undefined) {
    return `${studentId}|${lessonId}|${skill ?? ''}`
  }

  function handleDismiss(studentId: string, lessonId: string, skill: string | null | undefined) {
    const key = dismissKey(studentId, lessonId, skill)
    setPendingDismiss(cur => new Set([...cur, key]))
    const t = setTimeout(() => {
      dismissCheckin(studentId, lessonId, skill)
      setPendingDismiss(cur => { const next = new Set(cur); next.delete(key); return next })
      timerRefs.current.delete(key)
    }, 3000)
    timerRefs.current.set(key, t)
  }

  function handleUndo(studentId: string, lessonId: string, skill: string | null | undefined) {
    const key = dismissKey(studentId, lessonId, skill)
    const t = timerRefs.current.get(key)
    if (t) { clearTimeout(t); timerRefs.current.delete(key) }
    setPendingDismiss(cur => { const next = new Set(cur); next.delete(key); return next })
  }

  const surface = { background: '#161618', border: '1px solid rgba(255,255,255,0.07)' }
  const inputStyle = { background: '#1e1e22', borderColor: 'rgba(255,255,255,0.1)', color: '#f0f0f2' }
  const chipBase = { background: 'rgba(255,255,255,0.07)', color: '#8b8b9a' }

  return (
    <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full">
      <h2 className="text-base font-bold mb-4" style={{ color: '#f0f0f2' }}>Student Support Report</h2>

      {/* Filters */}
      <div className="rounded-2xl px-4 py-4 mb-4 flex flex-col gap-3" style={surface}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#5a5a6a' }}>Class</p>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-1.5">
            <button type="button" onClick={() => setReportClassId('all')} className="px-3 py-2 rounded-xl text-xs font-semibold transition-colors text-center" style={reportClassId === 'all' ? { background: '#14b8a6', color: '#fff' } : chipBase}>All classes</button>
            {classes.map((cls: AppClass) => (
              <button key={cls.id} type="button" onClick={() => setReportClassId(cls.id)} className="px-3 py-2 rounded-xl text-xs font-semibold transition-colors text-center leading-snug" style={reportClassId === cls.id ? { background: '#14b8a6', color: '#fff' } : chipBase}>{classLabel(cls)}</button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#5a5a6a' }}>Time period</p>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-1.5">
            {([['today', 'Today'], ['week', 'This week'], ['month', 'This month'], ['custom', 'Custom range'], ['all', 'All time']] as const).map(([val, label]) => (
              <button key={val} type="button" onClick={() => setReportRange(val)} className="px-3 py-2 rounded-xl text-xs font-semibold transition-colors text-center leading-snug" style={reportRange === val ? { background: '#14b8a6', color: '#fff' } : chipBase}>{label}</button>
            ))}
          </div>
          {reportRange === 'custom' && (
            <div className="flex flex-col gap-2 mt-2 sm:flex-row">
              <div className="flex-1">
                <p className="text-xs mb-0.5" style={{ color: '#5a5a6a' }}>From</p>
                <input type="date" value={reportCustomStart} onChange={e => setReportCustomStart(e.target.value)} className="w-full text-sm rounded-xl px-3 py-2 outline-none border focus:border-teal-500" style={inputStyle} />
              </div>
              <div className="flex-1">
                <p className="text-xs mb-0.5" style={{ color: '#5a5a6a' }}>To</p>
                <input type="date" value={reportCustomEnd} onChange={e => setReportCustomEnd(e.target.value)} className="w-full text-sm rounded-xl px-3 py-2 outline-none border focus:border-teal-500" style={inputStyle} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      {reportData.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm" style={{ color: '#5a5a6a' }}>No students flagged for this period.</p>
          <p className="text-xs mt-1" style={{ color: '#3a3a4a' }}>Everyone got it, or no data yet.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-4 mb-5">
            {reportData.map((cls: ReportClass) => {

              return (
                <div key={cls.classId} className="rounded-2xl px-4 py-4" style={surface}>
                  <p className="text-sm font-bold mb-3" style={{ color: '#f0f0f2' }}>{cls.className}</p>

                  {cls.needsSupport.length > 0 && (
                    <div className="mb-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
                        <p className="text-xs font-bold text-red-400 uppercase tracking-wide">Needs Support</p>
                      </div>
                      <div className="flex flex-col gap-1">
                        {cls.needsSupport.map((s: ReportStudent) => {
                          const rows = s.lessons.filter(l => l.status === 'needs-help')
                          return rows.map(l => {
                            const label = (showSkills && l.skill?.trim()) ? l.skill.trim() : l.title
                            const key = dismissKey(s.id, l.lessonId, l.skill)
                            const isPending = pendingDismiss.has(key)
                            return (
                              <div key={key} className={`flex items-center justify-between gap-2 pl-4 py-1 transition-opacity ${isPending ? 'opacity-40' : ''}`}>
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold" style={{ color: '#f0f0f2' }}>{s.name}</p>
                                  <p className="text-xs mt-0.5" style={{ color: '#5a5a6a' }}>{label}</p>
                                </div>
                                {isPending ? (
                                  <button type="button" onClick={() => handleUndo(s.id, l.lessonId, l.skill)} className="text-xs font-semibold px-2.5 py-1 rounded-xl shrink-0" style={{ background: 'rgba(255,255,255,0.08)', color: '#8b8b9a' }}>
                                    Undo
                                  </button>
                                ) : (
                                  <button type="button" onClick={() => handleDismiss(s.id, l.lessonId, l.skill)} className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors" style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399' }} title="Mark as remediated">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                  </button>
                                )}
                              </div>
                            )
                          })
                        })}
                      </div>
                    </div>
                  )}

                  {cls.checkIn.length > 0 && (
                    <div className={cls.absent.length > 0 ? 'mb-3' : ''}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-2 h-2 rounded-full bg-yellow-400 shrink-0" />
                        <p className="text-xs font-bold text-yellow-400 uppercase tracking-wide">Worth a Check-In</p>
                      </div>
                      <div className="flex flex-col gap-1">
                        {cls.checkIn.map((s: ReportStudent) => {
                          const topics = [...new Set(s.lessons.filter(l => l.status === 'almost').map(l => (showSkills && l.skill?.trim()) ? l.skill.trim() : l.title))]
                          return topics.map(topic => (
                            <div key={`${s.id}|${topic}`} className="pl-4 py-1">
                              <p className="text-sm font-semibold" style={{ color: '#f0f0f2' }}>{s.name}</p>
                              <p className="text-xs mt-0.5" style={{ color: '#5a5a6a' }}>{topic}</p>
                            </div>
                          ))
                        })}
                      </div>
                    </div>
                  )}

                  {cls.absent.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
                        <p className="text-xs font-bold text-blue-400 uppercase tracking-wide">Missed Lesson</p>
                      </div>
                      <div className="flex flex-col gap-1">
                        {cls.absent.map((s: ReportStudent) => {
                          const titles = [...new Set(s.lessons.filter(l => l.status === 'absent').map(l => l.title))]
                          return titles.map(title => (
                            <div key={`${s.id}|${title}`} className="pl-4 py-1">
                              <p className="text-sm font-semibold" style={{ color: '#f0f0f2' }}>{s.name}</p>
                              <p className="text-xs mt-0.5" style={{ color: '#5a5a6a' }}>{title}</p>
                            </div>
                          ))
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <button type="button" onClick={copyReport} className="w-full py-3 bg-teal-500 text-white text-sm font-semibold rounded-2xl active:scale-95 transition-transform">
            {reportCopied ? '✓ Copied to clipboard' : 'Copy report'}
          </button>
        </>
      )}
    </main>
  )
}
