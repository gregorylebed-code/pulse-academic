import type { WeekSchedule, DayLesson } from '../lib/groq'

export default function PlanScreen(props: any) {
  const {
    formatWeek, weekStart, pendingSchedule, subjectChoices, setSubjectChoices, confirmSubjects, planSaving, setPendingSchedule,
    savedPlan, undoSnapshot, handleUndo, swapSource, setSwapSource, swapSubjectSource, setSwapSubjectSource, DAYS, getDateForDayOffset,
    today, expandedDay, editingDay, editDraft, editSubject, setEditDraft, saveEdit, setEditingDay, setEditSubject, handleSwap, startEdit,
    setExpandedDay, handleSwapSubject, skipConfirmSubject, setSkipConfirmSubject, skipSubject, copyToNext, skipConfirmDay, setSkipConfirmDay,
    skipDay, setSavedPlan, fileInputRef, handleFileUpload, planText, setPlanText, planError, handleSavePlan, planLoading, planSaved
  } = props

  return (
    <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full">
      <h2 className="text-base font-bold text-slate-800 mb-1">Weekly Lesson Plan</h2>
      <p className="text-xs text-slate-400 mb-4">{formatWeek(weekStart)}</p>

      {pendingSchedule && (
        <div className="bg-white rounded-2xl shadow-sm px-4 py-4 mb-4">
          <p className="text-sm font-semibold text-slate-700 mb-1">Which subjects do you want to track?</p>
          <p className="text-xs text-slate-400 mb-4">Uncheck any subjects you don't grade (e.g. Health, PE).</p>
          <div className="flex flex-col gap-2 mb-4">
            {(() => {
              const found = new Set<string>()
              for (const day of Object.values(pendingSchedule as WeekSchedule)) for (const subj of Object.keys(day)) found.add(subj)
              return [...found].sort().map(subj => (
                <label key={subj} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={subjectChoices.includes(subj)}
                    onChange={e => setSubjectChoices(e.target.checked ? [...subjectChoices, subj] : subjectChoices.filter((s: string) => s !== subj))}
                    className="w-4 h-4 accent-teal-500"
                  />
                  <span className="text-sm font-semibold text-slate-700">{subj}</span>
                </label>
              ))
            })()}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={confirmSubjects} disabled={subjectChoices.length === 0 || planSaving} className="flex-1 py-2.5 bg-teal-500 text-white text-sm font-semibold rounded-2xl disabled:opacity-40">
              {planSaving ? 'Saving…' : `Save with ${subjectChoices.length} subject${subjectChoices.length !== 1 ? 's' : ''}`}
            </button>
            <button type="button" onClick={() => { setPendingSchedule(null); setSubjectChoices([]) }} className="px-4 py-2.5 bg-slate-100 text-slate-500 text-sm font-semibold rounded-2xl">Cancel</button>
          </div>
        </div>
      )}

      {savedPlan && !pendingSchedule ? (
        <div className="bg-white rounded-2xl shadow-sm px-4 py-3 mb-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-wide">This week's schedule</p>
            <div className="flex items-center gap-3">
              {undoSnapshot && !planSaving && (
                <button type="button" onClick={handleUndo} className="text-xs font-semibold text-slate-500 hover:text-teal-600 underline">↩ Undo</button>
              )}
              {swapSource && <p className="text-xs text-amber-600 font-semibold">Tap another day to swap — <button type="button" onClick={() => setSwapSource(null)} className="underline">cancel</button></p>}
              {swapSubjectSource && <p className="text-xs text-amber-600 font-semibold">Tap another day to swap <strong>{swapSubjectSource.subject}</strong> — <button type="button" onClick={() => setSwapSubjectSource(null)} className="underline">cancel</button></p>}
              {planSaving && <p className="text-xs text-slate-400">Saving…</p>}
            </div>
          </div>
          {DAYS.map((dayName: string, i: number) => {
            const dateISO = getDateForDayOffset(i)
            const dayLessons = savedPlan.schedule[dateISO] ?? {}
            const isToday = dateISO === today
            const isExpanded = expandedDay === dateISO
            const isEditing = editingDay === dateISO
            const isSwapSource = swapSource === dateISO
            const subjects = savedPlan.trackedSubjects.filter((s: string) => dayLessons[s])

            if (isEditing && editDraft && editSubject) {
              return (
                <div key={dayName} className="border-b border-slate-50 last:border-0 py-3">
                  <p className="text-xs font-semibold text-teal-600 mb-0.5">{dayName}</p>
                  <p className="text-xs text-slate-400 mb-2">{editSubject}</p>
                  <div className="flex flex-col gap-2">
                    {(['title', 'objective', 'activities', 'assessment'] as (keyof DayLesson)[]).filter(f => f !== 'subject').map(field => (
                      <div key={field}>
                        <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">{field}</p>
                        {field !== 'title' ? (
                          <textarea value={editDraft[field]} onChange={e => setEditDraft({ ...editDraft, [field]: e.target.value })} rows={2} className="w-full text-sm bg-slate-50 rounded-xl px-3 py-2 outline-none border border-slate-100 focus:border-teal-300 resize-none" />
                        ) : (
                          <input type="text" value={editDraft[field]} onChange={e => setEditDraft({ ...editDraft, [field]: e.target.value })} className="w-full text-sm bg-slate-50 rounded-xl px-3 py-2 outline-none border border-slate-100 focus:border-teal-300" />
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button type="button" onClick={saveEdit} className="px-4 py-1.5 bg-teal-500 text-white text-xs font-semibold rounded-xl">Save</button>
                    <button type="button" onClick={() => { setEditingDay(null); setEditSubject(null); setEditDraft(null) }} className="px-4 py-1.5 bg-slate-100 text-slate-500 text-xs font-semibold rounded-xl">Cancel</button>
                  </div>
                </div>
              )
            }

            const isSubjectSwapTarget = swapSubjectSource !== null && swapSubjectSource.dateISO !== dateISO

            return (
              <div key={dayName} className={`border-b border-slate-50 last:border-0 ${isToday ? 'bg-teal-50 -mx-4 px-4' : ''} ${isSwapSource ? 'bg-amber-50 -mx-4 px-4' : ''} ${isSubjectSwapTarget ? 'bg-amber-50 -mx-4 px-4' : ''}`}>
                <button type="button" onClick={() => { if (swapSource) { handleSwap(dateISO); return } if (!swapSubjectSource) setExpandedDay(isExpanded ? null : dateISO) }} className="flex items-start gap-3 py-2.5 w-full text-left">
                  <span className={`text-xs font-semibold w-10 shrink-0 mt-0.5 ${isToday ? 'text-teal-600' : isSwapSource ? 'text-amber-500' : 'text-slate-400'}`}>{dayName.slice(0, 3)}</span>
                  <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                    {subjects.length > 0 ? subjects.map((subj: string) => {
                      const isSwapSubjSrc = swapSubjectSource?.dateISO === dateISO && swapSubjectSource?.subject === subj
                      return (
                        <div key={subj} className="flex items-baseline gap-2">
                          <span className="text-xs font-semibold text-slate-400 w-14 shrink-0">{subj}</span>
                          <span className="text-sm font-semibold text-slate-700 truncate">{dayLessons[subj].title}</span>
                          {isSwapSubjSrc && <span className="text-xs text-amber-500 font-semibold shrink-0">← swapping</span>}
                          {isSubjectSwapTarget && swapSubjectSource?.subject === subj && (
                            <button type="button" onClick={e => { e.stopPropagation(); handleSwapSubject(dateISO, subj) }} className="text-xs font-semibold text-amber-600 underline shrink-0">swap here</button>
                          )}
                        </div>
                      )
                    }) : <span className="text-slate-300 italic text-sm">No lesson</span>}
                  </div>
                  {!swapSource && !swapSubjectSource && <span className="text-slate-300 text-xs mt-0.5">{isExpanded ? '▲' : '▼'}</span>}
                </button>
                {isExpanded && !swapSource && !swapSubjectSource && (
                  <div className="pb-3 flex flex-col gap-4" style={{ paddingLeft: '3.25rem' }}>
                    {subjects.map((subj: string) => {
                      const lesson = dayLessons[subj]
                      const isSkippingThisSubj = skipConfirmSubject?.dateISO === dateISO && skipConfirmSubject?.subject === subj
                      return (
                        <div key={subj}>
                          <p className="text-xs font-bold text-teal-600 mb-1.5">{subj}</p>
                          <div className="flex flex-col gap-1.5">
                            {(['objective', 'activities', 'assessment'] as const).map(f => (
                              <div key={f}>
                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">{f}</p>
                                <p className="text-sm text-slate-700">{lesson[f]}</p>
                              </div>
                            ))}
                          </div>
                          <div className="flex flex-wrap gap-2 mt-2">
                            <button type="button" onClick={() => startEdit(dateISO, subj)} className="text-xs font-semibold px-3 py-1.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-teal-50 hover:text-teal-700">✏️ Edit</button>
                            <button type="button" onClick={() => { setExpandedDay(null); handleSwapSubject(dateISO, subj) }} className="text-xs font-semibold px-3 py-1.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-amber-50 hover:text-amber-700">⇄ Swap {subj}</button>
                            {!isSkippingThisSubj && (
                              <button type="button" onClick={() => setSkipConfirmSubject({ dateISO, subject: subj })} className="text-xs font-semibold px-3 py-1.5 bg-slate-100 text-red-400 rounded-xl hover:bg-red-50">✕ Skip {subj}</button>
                            )}
                            {isSkippingThisSubj && (
                              <div className="flex flex-col gap-1.5 w-full mt-1">
                                <p className="text-xs text-slate-500 font-semibold">Skip {subj} how?</p>
                                <button type="button" onClick={() => skipSubject(dateISO, subj, false)} className="text-xs font-semibold px-3 py-1.5 bg-red-50 text-red-500 rounded-xl text-left">✕ Just remove {subj} this day</button>
                                <button type="button" onClick={() => skipSubject(dateISO, subj, true)} className="text-xs font-semibold px-3 py-1.5 bg-amber-50 text-amber-600 rounded-xl text-left">⇩ Remove and push {subj} lessons back</button>
                                <button type="button" onClick={() => setSkipConfirmSubject(null)} className="text-xs text-slate-400 px-1">cancel</button>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                      <button type="button" onClick={() => handleSwap(dateISO)} className="text-xs font-semibold px-3 py-1.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-amber-50 hover:text-amber-700">⇄ Swap entire day</button>
                      {subjects.length > 0 && <button type="button" onClick={() => copyToNext(dateISO)} className="text-xs font-semibold px-3 py-1.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-blue-50 hover:text-blue-700">→ Copy to next day</button>}
                      {subjects.length > 0 && skipConfirmDay !== dateISO && (
                        <button type="button" onClick={() => setSkipConfirmDay(dateISO)} className="text-xs font-semibold px-3 py-1.5 bg-slate-100 text-red-400 rounded-xl hover:bg-red-50">✕ Skip entire day</button>
                      )}
                      {subjects.length > 0 && skipConfirmDay === dateISO && (
                        <div className="flex flex-col gap-1.5 w-full mt-1">
                          <p className="text-xs text-slate-500 font-semibold">Skip entire day how?</p>
                          <button type="button" onClick={() => skipDay(dateISO, false)} className="text-xs font-semibold px-3 py-1.5 bg-red-50 text-red-500 rounded-xl text-left">✕ Just remove this day</button>
                          <button type="button" onClick={() => skipDay(dateISO, true)} className="text-xs font-semibold px-3 py-1.5 bg-amber-50 text-amber-600 rounded-xl text-left">⇩ Remove and push remaining days back</button>
                          <button type="button" onClick={() => setSkipConfirmDay(null)} className="text-xs text-slate-400 px-1">cancel</button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          <button type="button" onClick={() => { setSavedPlan(null); setExpandedDay(null); setEditingDay(null); setEditSubject(null); setSwapSource(null); setSwapSubjectSource(null); setSkipConfirmSubject(null) }} className="text-xs text-slate-400 hover:text-slate-600 mt-3">Upload new plan</button>
        </div>
      ) : !pendingSchedule ? (
        <>
          <div className="bg-white rounded-2xl shadow-sm px-4 py-4 mb-4">
            <p className="text-sm font-semibold text-slate-700 mb-3">Upload or paste your lesson plan</p>
            <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full border-2 border-dashed border-slate-200 rounded-xl py-3 text-sm text-slate-500 hover:border-teal-300 hover:text-teal-600 transition-colors mb-3">
              📎 Upload PDF, Word, or text file
            </button>
            <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.txt" className="hidden" onChange={handleFileUpload} />
            <textarea value={planText} onChange={e => setPlanText(e.target.value)} placeholder={"Or paste your lesson plan here…\n\nMonday: Fractions — Adding Unlike Denominators\nTuesday: Fractions — Subtracting\n…"} rows={8} className="w-full text-sm bg-slate-50 rounded-xl px-4 py-3 outline-none text-slate-700 placeholder-slate-300 resize-none border border-slate-100 focus:border-teal-300" />
            {planError && <p className="text-xs text-red-500 mt-2">{planError}</p>}
          </div>
          <button type="button" onClick={handleSavePlan} disabled={!planText.trim() || planLoading} className="w-full py-3 bg-teal-500 text-white text-sm font-semibold rounded-2xl disabled:opacity-40">
            {planLoading ? 'Analyzing with AI…' : "Save this week's plan"}
          </button>
          {planSaved && <p className="text-xs text-emerald-600 text-center mt-3 font-semibold">✓ Plan saved! Today's lesson was auto-filled.</p>}
        </>
      ) : null}
    </main>
  )
}
