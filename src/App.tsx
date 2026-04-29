import { useMemo, useState } from 'react'

type ClassName = 'AM' | 'PM'
type Status = 'got-it' | 'almost' | 'needs-help'

const STATUS_CYCLE: Status[] = ['got-it', 'almost', 'needs-help']

const STATUS_STYLES: Record<Status, string> = {
  'got-it':     'bg-green-500 text-white',
  'almost':     'bg-yellow-400 text-yellow-950',
  'needs-help': 'bg-red-500 text-white',
}

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

function firstNames(students: string[]): string[] {
  return students.map(s => s.split(' ')[0])
}

function App() {
  const classNames = useMemo(() => Object.keys(classes) as ClassName[], [])
  const [selectedClass, setSelectedClass] = useState<ClassName>('AM')
  const [studentStatuses, setStudentStatuses] = useState<Record<string, Status>>({})

  const students = classes[selectedClass]
  const names = firstNames(students)

  function tap(key: string) {
    setStudentStatuses(current => {
      const current_status = current[key] ?? 'got-it'
      const nextIndex = (STATUS_CYCLE.indexOf(current_status) + 1) % STATUS_CYCLE.length
      return { ...current, [key]: STATUS_CYCLE[nextIndex] }
    })
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-800">Pulse</h1>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {classNames.map(cn => (
            <button
              key={cn}
              type="button"
              onClick={() => setSelectedClass(cn)}
              className={`px-4 py-1.5 rounded-md text-sm font-semibold transition ${
                selectedClass === cn
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              {cn}
            </button>
          ))}
        </div>
      </header>

      {/* Grid */}
      <main className="flex-1 p-4">
        <div className="grid grid-cols-4 gap-3">
          {names.map((name, i) => {
            const key = `${selectedClass}-${students[i]}`
            const status = studentStatuses[key] ?? 'got-it'
            return (
              <button
                key={key}
                type="button"
                onClick={() => tap(key)}
                className={`flex flex-col items-center justify-center rounded-full aspect-square text-center font-semibold text-sm shadow-md active:scale-95 transition-transform ${STATUS_STYLES[status]}`}
              >
                {name}
              </button>
            )
          })}
        </div>
      </main>
    </div>
  )
}

export default App
