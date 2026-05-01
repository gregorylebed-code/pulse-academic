
export default function TrackerScreen(props: any) {
  const {
    activeLesson, isDemo, handleSuggestExitTicket, exitTicketLoading, setActiveLesson, setLessonInput, setExitTickets, setActiveExitTicket, setShowExitTickets,
    activeSubject, savedPlan, setLessonInputExternal, startLessonByTitle, formatDate, lessonInput, startLesson, DEMO_LESSONS, selectedClassId,
    showExitTickets, activeExitTicket, exitTickets, currentStudents, loading, studentStatuses, formatStudentName, nameFormat, STATUS_DOT, STATUS_INITIAL_BG, STATUS_RING, tap, confirmAllGotIt
  } = props

  return (
    <>
      {/* Lesson bar */}
      <div className="sticky top-0 z-10 bg-white border-t border-slate-100 px-4 py-4 shadow-sm shadow-slate-200/70">
        {activeLesson ? (
          <div className="flex items-center gap-3 w-full">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-400 leading-none mb-0.5">Today's lesson</p>
              <p className="text-sm font-semibold text-slate-700 truncate">{activeLesson.title}</p>
            </div>
            {!isDemo && (
              <button type="button" onClick={handleSuggestExitTicket} disabled={exitTicketLoading} className="text-xs font-semibold text-amber-600 hover:text-amber-700 shrink-0 bg-amber-50 px-3 py-1.5 rounded-xl">
                {exitTicketLoading ? '…' : '💡 Exit Ticket'}
              </button>
            )}
            <button type="button" onClick={() => { setActiveLesson(null); setLessonInput(''); setExitTickets([]); setActiveExitTicket(null); setShowExitTickets(false) }} className="text-xs text-slate-400 hover:text-slate-600 shrink-0">
              Change
            </button>
          </div>
        ) : (() => {
          const planLessons = activeSubject && savedPlan
            ? Object.entries(savedPlan.schedule)
                .sort(([a], [b]) => a.localeCompare(b))
                .flatMap(([date, day]: [string, any]) => day[activeSubject] ? [{ date, title: day[activeSubject].title }] : [])
            : []
          return planLessons.length > 0 ? (
            <div className="w-full max-w-2xl mx-auto">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">Pick a lesson</p>
              <div className="flex flex-col gap-2">
                {planLessons.map(({ date, title }) => (
                  <button key={date} type="button"
                    onClick={() => { setLessonInputExternal(title); startLessonByTitle(title, date) }}
                    className="group text-left px-4 py-3 bg-slate-50 rounded-2xl text-sm font-semibold text-slate-800 hover:bg-teal-50 hover:text-teal-800 border border-slate-100 hover:border-teal-100 flex items-center justify-between gap-4 transition-colors"
                  >
                    <span className="leading-snug">{title}</span>
                    <span className="text-xs text-slate-400 font-semibold shrink-0 group-hover:text-teal-600">{formatDate(date)}</span>
                  </button>
                ))}
                <div className="flex gap-2 mt-2">
                  <input type="text" value={lessonInput} onChange={e => setLessonInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && startLesson()} placeholder="Or type a custom lesson…" className="flex-1 min-w-0 text-sm bg-white rounded-2xl px-4 py-3 outline-none text-slate-700 placeholder-slate-300 border border-slate-100 focus:border-teal-300 shadow-sm" />
                  <button type="button" onClick={startLesson} disabled={!lessonInput.trim()} className="px-5 py-3 bg-teal-500 text-white text-sm font-semibold rounded-2xl disabled:opacity-40 shrink-0 shadow-sm shadow-teal-500/20">Start</button>
                </div>
              </div>
            </div>
          ) : isDemo ? (
            <div className="w-full max-w-2xl mx-auto">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">Pick a demo lesson</p>
              <div className="flex flex-col gap-2">
                {DEMO_LESSONS.filter((l: any) => l.class_id === selectedClassId).map((l: any) => (
                  <button key={l.id} type="button"
                    onClick={() => { setLessonInputExternal(l.title); startLessonByTitle(l.title, l.date) }}
                    className="group text-left px-4 py-3 bg-slate-50 rounded-2xl text-sm font-semibold text-slate-800 hover:bg-teal-50 hover:text-teal-800 border border-slate-100 hover:border-teal-100 flex items-center justify-between gap-4 transition-colors"
                  >
                    <span className="leading-snug">{l.title}</span>
                    <span className="text-xs text-slate-400 font-semibold shrink-0 group-hover:text-teal-600">{formatDate(l.date)}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="flex w-full max-w-2xl mx-auto gap-2">
                <input type="text" value={lessonInput} onChange={e => setLessonInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && startLesson()} placeholder="What are you teaching today?" className="flex-1 min-w-0 text-sm bg-slate-50 rounded-2xl px-4 py-3 outline-none text-slate-700 placeholder-slate-400 border border-slate-100 focus:border-teal-300" />
                <button type="button" onClick={startLesson} disabled={!lessonInput.trim()} className="px-5 py-3 bg-teal-500 text-white text-sm font-semibold rounded-2xl disabled:opacity-40 shrink-0 shadow-sm shadow-teal-500/20">Start</button>
              </div>
            </>
          )
        })()}
      </div>

      {/* Exit ticket panel */}
      {showExitTickets && activeLesson && !isDemo && (
        <div className="bg-amber-50 border-b border-amber-100 px-4 py-3">
          {exitTicketLoading ? (
            <p className="text-xs text-amber-500 text-center">Generating exit tickets…</p>
          ) : activeExitTicket ? (
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <p className="text-xs font-semibold text-amber-700 mb-1">Active Exit Ticket</p>
                <p className="text-sm font-semibold text-slate-800">{activeExitTicket.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{activeExitTicket.description}</p>
              </div>
              <button type="button" onClick={() => { setActiveExitTicket(null); setShowExitTickets(false) }} className="text-xs text-slate-400 hover:text-slate-600 shrink-0 mt-0.5">✕</button>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-amber-700">Pick an exit ticket:</p>
                <button type="button" onClick={() => setShowExitTickets(false)} className="text-xs text-slate-400 hover:text-slate-600">✕</button>
              </div>
              <div className="flex flex-col gap-1.5">
                {exitTickets.map((t: any, i: number) => (
                  <button key={i} type="button" onClick={() => setActiveExitTicket(t)} className="text-left bg-white rounded-xl px-3 py-2.5 shadow-sm hover:bg-amber-50 hover:text-amber-700 transition-colors">
                    <p className="text-sm font-semibold text-slate-800">{t.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{t.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Student grid */}
      <main className="flex-1 px-4 py-6">
        {!activeLesson ? (
          <div className="mx-auto mt-10 flex min-h-40 max-w-sm flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white/45 px-6 py-10 text-center">
            <p className="text-sm font-semibold text-slate-500">
              {currentStudents.length === 0 ? 'No students in this class yet.' : 'Select a lesson to begin.'}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {currentStudents.length === 0 ? 'Add students from the roster when you are ready.' : 'Your class check-in grid will appear here.'}
            </p>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3">
            <svg className="animate-spin h-6 w-6 text-teal-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            <p className="text-slate-400 text-sm">Loading…</p>
          </div>
        ) : (
          <>
            {activeLesson && currentStudents.length > 0 && (() => {
              const gotIt = currentStudents.filter((s: any) => (studentStatuses[s.id] ?? 'got-it') === 'got-it').length
              const almost = currentStudents.filter((s: any) => studentStatuses[s.id] === 'almost').length
              const needsHelp = currentStudents.filter((s: any) => studentStatuses[s.id] === 'needs-help').length
              return (
                <div className="flex items-center justify-between mb-3 bg-white rounded-2xl px-4 py-2.5 shadow-sm">
                  <div className="flex items-center gap-4 text-xs font-semibold">
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400" /><span className="text-emerald-700">{gotIt} Got It</span></span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-400" /><span className="text-yellow-700">{almost} Almost</span></span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400" /><span className="text-red-600">{needsHelp} Needs Help</span></span>
                  </div>
                  {!isDemo && gotIt > 0 && (
                    <button type="button" onClick={confirmAllGotIt} className="text-xs font-semibold px-3 py-1.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-emerald-50 hover:text-emerald-700 transition-colors shrink-0">
                      ✓ Save all Got It
                    </button>
                  )}
                </div>
              )
            })()}
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
            {currentStudents.map((student: any) => {
              const status = studentStatuses[student.id] ?? 'got-it'
              const initial = student.name.trim()[0].toUpperCase()
              const displayName = formatStudentName(student.name, nameFormat, currentStudents.map((s: any) => s.name))
              return (
                <button
                  key={student.id}
                  type="button"
                  onClick={() => tap(student.id)}
                  className="flex flex-col items-center gap-1 bg-white rounded-xl py-2 px-1 shadow-sm active:scale-95 transition-transform relative"
                >
                  <span className={`absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full ${STATUS_DOT[status as keyof typeof STATUS_DOT]}`} />
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${STATUS_INITIAL_BG[status as keyof typeof STATUS_INITIAL_BG]} ${STATUS_RING[status as keyof typeof STATUS_RING]}`}>
                    {initial}
                  </div>
                  <span className="text-[10px] font-bold text-slate-700 leading-tight text-center px-0.5 truncate w-full">{displayName}</span>
                </button>
              )
            })}
          </div>
          </>
        )}
      </main>
    </>
  )
}
