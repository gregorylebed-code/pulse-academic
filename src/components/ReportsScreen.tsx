
export default function ReportsScreen(props: any) {
  const {
    classes, classLabel, reportClassId, setReportClassId, reportRange, setReportRange, reportCustomStart, setReportCustomStart, reportCustomEnd,
    setReportCustomEnd, reportData, copyReport, reportCopied
  } = props

  return (
    <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full">
      <h2 className="text-base font-bold text-slate-800 mb-4">Student Support Report</h2>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm px-4 py-4 mb-4 flex flex-col gap-3">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Class</p>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-1.5">
            <button type="button" onClick={() => setReportClassId('all')} className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors text-center ${reportClassId === 'all' ? 'bg-teal-500 text-white' : 'bg-slate-100 text-slate-500 hover:text-slate-700'}`}>All classes</button>
            {classes.map((cls: any) => (
              <button key={cls.id} type="button" onClick={() => setReportClassId(cls.id)} className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors text-center leading-snug ${reportClassId === cls.id ? 'bg-teal-500 text-white' : 'bg-slate-100 text-slate-500 hover:text-slate-700'}`}>{classLabel(cls)}</button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Time period</p>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-1.5">
            {([['today', 'Today'], ['week', 'This week'], ['month', 'This month'], ['custom', 'Custom range'], ['all', 'All time']] as const).map(([val, label]) => (
              <button key={val} type="button" onClick={() => setReportRange(val)} className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors text-center leading-snug ${reportRange === val ? 'bg-teal-500 text-white' : 'bg-slate-100 text-slate-500 hover:text-slate-700'}`}>{label}</button>
            ))}
          </div>
          {reportRange === 'custom' && (
            <div className="flex flex-col gap-2 mt-2 sm:flex-row">
              <div className="flex-1">
                <p className="text-xs text-slate-400 mb-0.5">From</p>
                <input type="date" value={reportCustomStart} onChange={e => setReportCustomStart(e.target.value)} className="w-full text-sm bg-slate-50 rounded-xl px-3 py-2 outline-none border border-slate-100 focus:border-teal-300" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-slate-400 mb-0.5">To</p>
                <input type="date" value={reportCustomEnd} onChange={e => setReportCustomEnd(e.target.value)} className="w-full text-sm bg-slate-50 rounded-xl px-3 py-2 outline-none border border-slate-100 focus:border-teal-300" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      {reportData.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-400 text-sm">No students flagged for this period.</p>
          <p className="text-slate-300 text-xs mt-1">Everyone got it, or no data yet.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-4 mb-5">
            {reportData.map((cls: any) => (
              <div key={cls.classId} className="bg-white rounded-2xl shadow-sm px-4 py-4">
                <p className="text-sm font-bold text-slate-800 mb-3">{cls.className}</p>

                {cls.needsSupport.length > 0 && (
                  <div className="mb-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
                      <p className="text-xs font-bold text-red-600 uppercase tracking-wide">Needs Support</p>
                    </div>
                    <div className="flex flex-col gap-2">
                      {cls.needsSupport.map((s: any) => {
                        const topics = [...new Set(s.lessons.filter((l: any) => l.status === 'needs-help').map((l: any) => l.title))]
                        return (
                          <div key={s.id} className="pl-4">
                            <p className="text-sm font-semibold text-slate-700">{s.name}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{topics.join(' · ')}</p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {cls.checkIn.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-2 h-2 rounded-full bg-yellow-400 shrink-0" />
                      <p className="text-xs font-bold text-yellow-600 uppercase tracking-wide">Worth a Check-In</p>
                    </div>
                    <div className="flex flex-col gap-2">
                      {cls.checkIn.map((s: any) => {
                        const topics = [...new Set(s.lessons.map((l: any) => l.title))]
                        return (
                          <div key={s.id} className="pl-4">
                            <p className="text-sm font-semibold text-slate-700">{s.name}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{topics.join(' · ')}</p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <button type="button" onClick={copyReport} className="w-full py-3 bg-teal-500 text-white text-sm font-semibold rounded-2xl active:scale-95 transition-transform">
            {reportCopied ? '✓ Copied to clipboard' : 'Copy report'}
          </button>
        </>
      )}
    </main>
  )
}
