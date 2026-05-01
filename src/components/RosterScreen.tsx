
export default function RosterScreen(props: any) {
  const {
    classes, rosterAddingClass, setRosterAddingClass, rosterNewClassName, setRosterNewClassName, rosterAddClass, rosterNewClassSubject,
    setRosterNewClassSubject, SUBJECTS, rosterSaving, studentsByClass, rosterRenaming, rosterRenameValue, setRosterRenameValue, rosterRenameClass,
    setRosterRenaming, rosterConfirmRemove, rosterRemoveStudent, setRosterConfirmRemove, rosterNewStudentName, setRosterNewStudentName,
    rosterAddStudent, setRosterPasteClassId, setRosterPasteText, setRosterCopySourceClassId, setRosterCopyTargetClassId, rosterCopySourceClassId,
    rosterCopyTargetClassId, rosterCopyFromClass, rosterPasteClassId, rosterPasteText, rosterParsing, rosterBulkAdd,
    setScreen, setSelectedStudentId, setHistoryClassId,
    rosterRenamingStudent, setRosterRenamingStudent, rosterStudentRenameValue, setRosterStudentRenameValue, rosterRenameStudent
  } = props

  return (
    <>
      <main className="flex-1 px-4 py-5 max-w-6xl mx-auto w-full">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-base font-bold text-slate-800">Roster</h2>
          {classes.length < 6 && !rosterAddingClass && (
            <button type="button" onClick={() => setRosterAddingClass(true)} className="shrink-0 text-xs font-semibold text-teal-600 hover:text-teal-700 bg-teal-50 px-3 py-2 rounded-xl">
              + Add class
            </button>
          )}
        </div>

        {rosterAddingClass && (
          <div className="bg-white rounded-2xl shadow-sm px-4 py-4 mb-4">
            <p className="text-sm font-semibold text-slate-700 mb-3">New class</p>
            <div className="flex flex-col gap-2">
              <input
                type="text"
                value={rosterNewClassName}
                onChange={e => setRosterNewClassName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && rosterAddClass()}
                placeholder="Class name (e.g. Period 1)"
                className="text-sm bg-slate-50 rounded-xl px-3 py-2 outline-none border border-slate-100 focus:border-teal-300"
              />
              <select
                value={rosterNewClassSubject}
                onChange={e => setRosterNewClassSubject(e.target.value)}
                className="text-sm bg-slate-50 rounded-xl px-3 py-2 outline-none border border-slate-100 focus:border-teal-300"
              >
                {SUBJECTS.map((s: string) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex gap-2 mt-3">
              <button type="button" onClick={rosterAddClass} disabled={!rosterNewClassName.trim() || rosterSaving} className="px-4 py-2 bg-teal-500 text-white text-sm font-semibold rounded-xl disabled:opacity-40">
                {rosterSaving ? 'Saving…' : 'Add'}
              </button>
              <button type="button" onClick={() => { setRosterAddingClass(false); setRosterNewClassName('') }} className="px-4 py-2 bg-slate-100 text-slate-500 text-sm font-semibold rounded-xl">Cancel</button>
            </div>
          </div>
        )}

        {classes.length === 0 && !rosterAddingClass && (
          <div className="mx-auto mt-10 flex min-h-40 max-w-sm flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white/45 px-6 py-10 text-center">
            <p className="text-2xl mb-3">👋</p>
            <p className="text-sm font-semibold text-slate-500">Welcome! Start by creating your first class.</p>
            <p className="mt-1 text-xs text-slate-400">Tap "+ Add class" above to get started.</p>
          </div>
        )}

        <div className="grid gap-4 xl:grid-cols-2">
          {classes.map((cls: any) => {
            const students = [...(studentsByClass[cls.id] ?? [])].sort((a: any, b: any) => a.name.localeCompare(b.name))
            const isRenaming = rosterRenaming === cls.id
            return (
              <div key={cls.id} className="bg-white rounded-2xl shadow-sm px-4 py-4">
                {isRenaming ? (
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      value={rosterRenameValue}
                      onChange={e => setRosterRenameValue(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && rosterRenameClass(cls.id)}
                      autoFocus
                      className="flex-1 text-sm bg-slate-50 rounded-xl px-3 py-1.5 outline-none border border-slate-100 focus:border-teal-300 font-semibold"
                    />
                    <button type="button" onClick={() => rosterRenameClass(cls.id)} disabled={rosterSaving} className="px-3 py-1.5 bg-teal-500 text-white text-xs font-semibold rounded-xl disabled:opacity-40">Save</button>
                    <button type="button" onClick={() => setRosterRenaming(null)} className="px-3 py-1.5 bg-slate-100 text-slate-500 text-xs font-semibold rounded-xl">Cancel</button>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="text-sm font-bold text-slate-800">{cls.name}</p>
                      <p className="text-xs text-slate-400">{cls.subject} · {students.length} student{students.length !== 1 ? 's' : ''}</p>
                    </div>
                    <button type="button" onClick={() => { setRosterRenaming(cls.id); setRosterRenameValue(cls.name) }} className="shrink-0 text-xs text-slate-400 hover:text-teal-600">Rename</button>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 mb-4">
                  {students.length === 0 && <p className="text-xs text-slate-300 italic col-span-2">No students yet.</p>}
                  {students.map((s: any) => (
                    <div key={s.id} className="flex min-h-10 items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2">
                      {rosterRenamingStudent === s.id ? (
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <input
                            type="text"
                            value={rosterStudentRenameValue}
                            onChange={e => setRosterStudentRenameValue(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && rosterRenameStudent(s.id)}
                            autoFocus
                            className="flex-1 min-w-0 text-sm bg-white rounded-lg px-2 py-1 outline-none border border-slate-200 focus:border-teal-300 font-medium"
                          />
                          <button type="button" onClick={() => rosterRenameStudent(s.id)} disabled={rosterSaving} className="text-xs font-semibold text-teal-600 hover:text-teal-700 disabled:opacity-40">Save</button>
                          <button type="button" onClick={() => setRosterRenamingStudent(null)} className="text-xs text-slate-400 hover:text-slate-600">✕</button>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => { setHistoryClassId(cls.id); setSelectedStudentId(s.id); setScreen('history') }}
                            className="text-sm text-slate-700 hover:text-teal-600 text-left truncate font-medium transition-colors"
                          >
                            {s.name}
                          </button>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {rosterConfirmRemove?.studentId === s.id && rosterConfirmRemove?.classId === cls.id ? (
                              <>
                                <span className="text-xs text-slate-400">Remove?</span>
                                <button type="button" onClick={() => rosterRemoveStudent(s.id, cls.id)} disabled={rosterSaving} className="text-xs font-semibold text-red-500 hover:text-red-700 disabled:opacity-40">Yes</button>
                                <button type="button" onClick={() => setRosterConfirmRemove(null)} className="text-xs text-slate-400 hover:text-slate-600">No</button>
                              </>
                            ) : (
                              <>
                                <button type="button" onClick={() => { setRosterRenamingStudent(s.id); setRosterStudentRenameValue(s.name) }} className="text-xs text-slate-300 hover:text-teal-500">✎</button>
                                <button type="button" onClick={() => setRosterConfirmRemove({ studentId: s.id, classId: cls.id })} className="text-xs text-slate-300 hover:text-red-400">✕</button>
                              </>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <input
                    type="text"
                    value={rosterNewStudentName[cls.id] ?? ''}
                    onChange={e => setRosterNewStudentName((cur: any) => ({ ...cur, [cls.id]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && rosterAddStudent(cls.id)}
                    placeholder="Add student…"
                    className="w-full sm:min-w-[14rem] sm:flex-1 text-sm bg-slate-50 rounded-xl px-3 py-2 outline-none border border-slate-100 focus:border-teal-300"
                  />
                  <div className={`grid gap-2 ${classes.length > 1 ? 'grid-cols-3' : 'grid-cols-2'} sm:flex sm:flex-wrap`}>
                    <button type="button" onClick={() => rosterAddStudent(cls.id)} disabled={!(rosterNewStudentName[cls.id] ?? '').trim() || rosterSaving} className="px-3 py-2 bg-teal-500 text-white text-sm font-semibold rounded-xl disabled:opacity-40">
                      Add
                    </button>
                    <button type="button" onClick={() => { setRosterPasteClassId(cls.id); setRosterPasteText('') }} className="px-3 py-2 bg-slate-100 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-200">
                      Paste list
                    </button>
                    {classes.length > 1 && (
                      <button type="button" onClick={() => { setRosterCopySourceClassId(cls.id); setRosterCopyTargetClassId('') }} className="px-3 py-2 bg-slate-100 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-200">
                        Copy roster
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </main>

      {/* Copy roster modal */}
      {rosterCopySourceClassId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 flex flex-col gap-4">
            <h3 className="font-bold text-slate-800">Copy roster from {classes.find((c: any) => c.id === rosterCopySourceClassId)?.name}</h3>
            <p className="text-sm text-slate-500">Pick a class to copy these students into. Students already in that class will be skipped.</p>
            <select
              value={rosterCopyTargetClassId}
              onChange={e => setRosterCopyTargetClassId(e.target.value)}
              className="w-full text-sm bg-slate-50 rounded-xl px-3 py-2 outline-none border border-slate-100 focus:border-teal-300"
            >
              <option value="">Select a class…</option>
              {classes.filter((c: any) => c.id !== rosterCopySourceClassId).map((c: any) => (
                <option key={c.id} value={c.id}>{c.subject} · {c.name} ({(studentsByClass[c.id] ?? []).length} students)</option>
              ))}
            </select>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => { setRosterCopySourceClassId(null); setRosterCopyTargetClassId('') }} className="px-4 py-2 bg-slate-100 text-slate-500 text-sm font-semibold rounded-xl">Cancel</button>
              <button type="button" onClick={rosterCopyFromClass} disabled={!rosterCopyTargetClassId || rosterSaving} className="px-4 py-2 bg-teal-500 text-white text-sm font-semibold rounded-xl disabled:opacity-40">
                {rosterSaving ? 'Copying…' : 'Copy students'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Paste roster modal */}
      {rosterPasteClassId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 flex flex-col gap-4">
            <h3 className="font-bold text-slate-800">Paste student names</h3>
            <p className="text-sm text-slate-500">Paste names in any format — numbered list, one per line, comma-separated, whatever you have. AI will sort it out.</p>
            <textarea
              autoFocus
              value={rosterPasteText}
              onChange={e => setRosterPasteText(e.target.value)}
              placeholder={"1. Jane Smith\n2. John Doe\nAlex Johnson, Maria Garcia…"}
              rows={8}
              className="w-full text-sm bg-slate-50 rounded-xl px-3 py-2 outline-none border border-slate-100 focus:border-teal-300 resize-none"
            />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setRosterPasteClassId(null)} className="px-4 py-2 bg-slate-100 text-slate-500 text-sm font-semibold rounded-xl">Cancel</button>
              <button type="button" onClick={() => rosterBulkAdd(rosterPasteClassId)} disabled={!rosterPasteText.trim() || rosterParsing} className="px-4 py-2 bg-teal-500 text-white text-sm font-semibold rounded-xl disabled:opacity-40">
                {rosterParsing ? 'Adding…' : 'Add students'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
