
export default function HistoryScreen(props: any) {
  const {
    historyTab, setHistoryTab, setSelectedStudentId, setSelectedLesson, classes, setHistoryClassId, historyClassId, classLabel,
    historyLoading, selectedStudentId, formatStudentName, historyStudents, nameFormat, studentHistoryRows, formatDate, STATUS_PILL, STATUS_LABEL,
    filteredHistory, selectedLesson, lessonDetail, lessonGroups, openProfile,
  } = props

  return (
    <main className="flex-1 flex flex-col">
      <div className="bg-white border-t border-slate-100 px-4 pt-3 pb-0 shadow-sm flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex gap-0">
          {(['student', 'lesson'] as const).map((tab) => (
            <button key={tab} type="button"
              onClick={() => { setHistoryTab(tab); setSelectedStudentId(null); setSelectedLesson(null) }}
              className={`px-5 py-2 text-sm font-semibold border-b-2 transition-colors capitalize ${historyTab === tab ? 'border-teal-500 text-teal-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            >
              By {tab}
            </button>
          ))}
        </div>
        {classes.length > 1 && (
          <div className="w-full overflow-x-auto scrollbar-none pb-2 sm:w-auto sm:pb-2">
            <div className="flex w-max gap-2 rounded-xl bg-slate-100 p-1.5">
              {classes.map((cls: any) => (
                <button key={cls.id} type="button"
                  onClick={() => { setHistoryClassId(cls.id); setSelectedStudentId(null); setSelectedLesson(null) }}
                  className={`max-w-[10.5rem] truncate whitespace-nowrap px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${historyClassId === cls.id ? 'bg-teal-500 text-white shadow-sm' : 'bg-white text-slate-500 shadow-sm hover:text-slate-700'}`}
                >
                  {classLabel(cls)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 px-4 py-4 overflow-auto">
        {historyLoading ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3">
            <svg className="animate-spin h-6 w-6 text-teal-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            <p className="text-slate-400 text-sm">Loading…</p>
          </div>
        ) : historyTab === 'student' ? (
          selectedStudentId ? (
            <div>
              <button type="button" onClick={() => setSelectedStudentId(null)} className="text-sm text-teal-600 mb-3 flex items-center gap-1">← All students</button>
              <h2 className="text-base font-bold text-slate-800 mb-3">
                {formatStudentName(historyStudents.find((s: any) => s.id === selectedStudentId)?.name ?? '', nameFormat, historyStudents.map((s: any) => s.name))}
              </h2>
              {studentHistoryRows.length === 0 ? (
                <p className="text-slate-400 text-sm">No data yet.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {studentHistoryRows.map((row: any, i: number) => (
                    <div key={i} className="bg-white rounded-2xl px-4 py-3 shadow-sm flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-700">{row.lesson_title}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{formatDate(row.date)} · {row.class_name}</p>
                      </div>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_PILL[row.status as keyof typeof STATUS_PILL]}`}>{STATUS_LABEL[row.status as keyof typeof STATUS_LABEL]}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
              {historyStudents.map((s: any) => {
                const rows = filteredHistory.filter((r: any) => r.student_id === s.id)
                const needsHelp = rows.filter((r: any) => r.status === 'needs-help').length
                const almost = rows.filter((r: any) => r.status === 'almost').length
                return (
                  <div key={s.id} className="bg-white rounded-2xl px-3 py-3 shadow-sm flex flex-col items-center text-center gap-1">
                    <button type="button" onClick={() => setSelectedStudentId(s.id)} className="w-full flex flex-col items-center gap-1">
                      <p className="text-sm font-semibold text-slate-700 leading-tight">{formatStudentName(s.name, nameFormat, historyStudents.map((x: any) => x.name))}</p>
                      <p className="text-xs text-slate-400">{rows.length} lesson{rows.length !== 1 ? 's' : ''}</p>
                      <div className="flex flex-wrap justify-center gap-1 mt-0.5">
                        {needsHelp > 0 && <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">{needsHelp} ⚠</span>}
                        {almost > 0 && <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700">{almost} ~</span>}
                      </div>
                    </button>
                    <button type="button" onClick={() => openProfile(s.id, s.name)} className="text-[10px] text-teal-500 font-semibold mt-0.5 hover:text-teal-700">
                      View profile
                    </button>
                  </div>
                )
              })}
            </div>
          )
        ) : (
          selectedLesson ? (
            <div>
              <button type="button" onClick={() => setSelectedLesson(null)} className="text-sm text-teal-600 mb-3 flex items-center gap-1">← All lessons</button>
              <div className="mb-3">
                <h2 className="text-base font-bold text-slate-800">{selectedLesson.lesson_title}</h2>
                <p className="text-xs text-slate-400">{formatDate(selectedLesson.date)}</p>
              </div>
              {lessonDetail.length === 0 ? (
                <p className="text-slate-400 text-sm">No data.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {lessonDetail.sort((a: any, b: any) => a.student_name.localeCompare(b.student_name)).map((row: any, i: number) => (
                    <div key={i} className="bg-white rounded-2xl px-4 py-3 shadow-sm flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-700">{formatStudentName(row.student_name, nameFormat, historyStudents.map((s: any) => s.name))}</p>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_PILL[row.status as keyof typeof STATUS_PILL]}`}>{STATUS_LABEL[row.status as keyof typeof STATUS_LABEL]}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {lessonGroups.length === 0 ? (
                <p className="text-slate-400 text-sm text-center mt-10">No history yet.</p>
              ) : lessonGroups.map((g: any, i: number) => {
                const needsHelp = g.rows.filter((r: any) => r.status === 'needs-help').length
                const almost = g.rows.filter((r: any) => r.status === 'almost').length
                const gotIt = g.rows.filter((r: any) => r.status === 'got-it').length
                return (
                  <button key={i} type="button" onClick={() => setSelectedLesson({ lesson_id: g.lesson_id, lesson_title: g.lesson_title, date: g.date })} className="bg-white rounded-2xl px-4 py-3 shadow-sm flex items-center justify-between text-left">
                    <div>
                      <p className="text-sm font-semibold text-slate-700">{g.lesson_title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{formatDate(g.date)} · {g.rows.length} student{g.rows.length !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="flex gap-1 flex-wrap justify-end max-w-32">
                      {gotIt > 0 && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{gotIt} ✓</span>}
                      {almost > 0 && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">{almost} ~</span>}
                      {needsHelp > 0 && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-600">{needsHelp} ✗</span>}
                    </div>
                  </button>
                )
              })}
            </div>
          )
        )}
      </div>
    </main>
  )
}
