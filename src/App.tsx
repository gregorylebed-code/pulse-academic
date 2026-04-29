import { useMemo, useState } from 'react'

type ClassName = 'AM' | 'PM'
type Status = 'got-it' | 'almost' | 'needs-help'

const classes: Record<ClassName, string[]> = {
  'AM': [
    'Rian B.', 'Ryleigh C.', 'Luciano D.', 'Carter H.', 'Jaron K.',
    'Gemma K.', 'Sammie L.', 'Charlotte M.', 'Graci P.', 'Sloan R.',
    'Grayson R.', 'Julianna S.', 'Lily S.', 'Ava T.', 'Eloise T.', 'Alexa W.',
  ],
  'PM': [
    'Ire A.', 'Olivia A.', 'Carter A.', 'Ella C.', 'Legacy C.', 'Jovie D.',
    'Logan D.', 'Charles F.', 'Olivia G.', 'Grayson G.', 'Isabella G.',
    'AdaBella H.', 'Trey H.', 'Ezra K.', 'Giada L.', 'Luca L.', 'Riley M.',
    'Julia N.', 'Michael R.', 'Reagan S.', 'William S.', 'Chase S.', 'Emmett V.', 'Chase W.',
  ],
}

const statuses: Array<{
  id: Status
  label: string
  activeClass: string
  inactiveClass: string
}> = [
  {
    id: 'got-it',
    label: 'Got It',
    activeClass: 'border-green-600 bg-green-600 text-white shadow-sm',
    inactiveClass: 'border-green-200 bg-green-50 text-green-800 hover:bg-green-100',
  },
  {
    id: 'almost',
    label: 'Almost',
    activeClass: 'border-yellow-500 bg-yellow-400 text-yellow-950 shadow-sm',
    inactiveClass: 'border-yellow-200 bg-yellow-50 text-yellow-900 hover:bg-yellow-100',
  },
  {
    id: 'needs-help',
    label: 'Needs Help',
    activeClass: 'border-red-600 bg-red-600 text-white shadow-sm',
    inactiveClass: 'border-red-200 bg-red-50 text-red-800 hover:bg-red-100',
  },
]

function App() {
  const classNames = useMemo(() => Object.keys(classes) as ClassName[], [])
  const [selectedClass, setSelectedClass] = useState<ClassName>('AM')
  const [studentStatuses, setStudentStatuses] = useState<Record<string, Status | undefined>>({})

  const students = classes[selectedClass]

  function setStatus(student: string, status: Status) {
    setStudentStatuses((current) => ({
      ...current,
      [`${selectedClass}-${student}`]: status,
    }))
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 text-slate-950 sm:px-6">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="flex flex-col gap-3">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Teacher dashboard</p>
            <h1 className="text-3xl font-bold text-slate-950 sm:text-4xl">Pulse Academic Tracker</h1>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-lg bg-white p-1 shadow-sm ring-1 ring-slate-200">
            {classNames.map((className) => (
              <button
                className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
                  selectedClass === className
                    ? 'bg-slate-950 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
                }`}
                key={className}
                onClick={() => setSelectedClass(className)}
                type="button"
              >
                {className}
              </button>
            ))}
          </div>
        </header>

        <section className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-slate-200">
          <div className="border-b border-slate-200 px-4 py-4 sm:px-5">
            <h2 className="text-lg font-semibold">{selectedClass}</h2>
            <p className="text-sm text-slate-500">{students.length} students</p>
          </div>

          <div className="divide-y divide-slate-200">
            {students.map((student) => {
              const studentKey = `${selectedClass}-${student}`
              const activeStatus = studentStatuses[studentKey]

              return (
                <article className="flex flex-col gap-3 px-4 py-4 sm:px-5" key={studentKey}>
                  <h3 className="text-base font-semibold text-slate-900">{student}</h3>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {statuses.map((status) => {
                      const isActive = activeStatus === status.id

                      return (
                        <button
                          aria-pressed={isActive}
                          className={`rounded-md border px-3 py-2 text-sm font-semibold transition ${
                            isActive ? status.activeClass : status.inactiveClass
                          }`}
                          key={status.id}
                          onClick={() => setStatus(student, status.id)}
                          type="button"
                        >
                          {status.label}
                        </button>
                      )
                    })}
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
