export default function Landing({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="min-h-screen bg-white flex flex-col">

      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-5xl mx-auto w-full">
        <span className="font-bold text-lg tracking-tight text-slate-900">Pulse Academic</span>
        <button
          onClick={onEnter}
          className="text-sm font-semibold text-indigo-600 hover:text-indigo-800"
        >
          Open App →
        </button>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20">
        <span className="inline-block bg-indigo-50 text-indigo-600 text-xs font-semibold px-3 py-1 rounded-full mb-6 tracking-wide uppercase">
          For classroom teachers
        </span>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 leading-tight max-w-2xl">
          Upload your lesson plan.<br />
          <span className="text-indigo-600">Know who's lost before the bell rings.</span>
        </h1>
        <p className="mt-6 text-lg text-slate-500 max-w-xl">
          Pulse Academic turns your weekly lesson plan into live exit ticket prompts — so you can check for understanding in seconds, not after the fact.
        </p>
        <button
          onClick={onEnter}
          className="mt-10 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-base px-8 py-4 rounded-2xl shadow-lg transition-colors"
        >
          Try it free →
        </button>
        <p className="mt-3 text-xs text-slate-400">No sign-up required to explore.</p>
      </section>

      {/* How it works */}
      <section className="bg-slate-50 py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-12">How it works</h2>
          <div className="grid sm:grid-cols-3 gap-8">
            {[
              {
                step: '1',
                title: 'Upload your lesson plan',
                desc: 'Paste text, upload a Word doc, or drop in a PDF. Pulse reads it and builds your week.',
              },
              {
                step: '2',
                title: 'Get AI exit ticket prompts',
                desc: "One tap generates 3 targeted questions based on today's actual lesson — not generic ones.",
              },
              {
                step: '3',
                title: 'Track understanding live',
                desc: 'Tap each student: Got It, Almost, or Needs Help. See the whole class at a glance.',
              },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex flex-col items-center text-center">
                <div className="w-10 h-10 rounded-full bg-indigo-600 text-white font-bold text-lg flex items-center justify-center mb-4">
                  {step}
                </div>
                <h3 className="font-semibold text-slate-900 mb-2">{title}</h3>
                <p className="text-sm text-slate-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature highlights */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto grid sm:grid-cols-2 gap-10">
          {[
            { icon: '📋', title: 'Full week planning', desc: 'Edit, swap, copy, skip, and push lessons around — your plan stays structured without the spreadsheet.' },
            { icon: '💡', title: 'AI exit tickets', desc: 'Context-aware prompts pulled from your real lesson objective — not boilerplate.' },
            { icon: '📊', title: 'Class history', desc: "See how each student trended across lessons. Spot who's consistently struggling before report cards." },
            { icon: '📱', title: 'Works on your phone', desc: 'Built as a PWA. Open it on your classroom iPad or phone — no app store install needed.' },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="flex gap-4">
              <span className="text-3xl">{icon}</span>
              <div>
                <h3 className="font-semibold text-slate-900 mb-1">{title}</h3>
                <p className="text-sm text-slate-500">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-indigo-600 py-16 px-6 text-center">
        <h2 className="text-2xl font-bold text-white mb-4">Built by a teacher, for teachers.</h2>
        <p className="text-indigo-200 mb-8 max-w-md mx-auto">
          I'm Greg — a 3rd grade teacher. I built this because I kept losing track of who actually understood the lesson. It's free.
        </p>
        <button
          onClick={onEnter}
          className="bg-white text-indigo-700 font-bold px-8 py-4 rounded-2xl hover:bg-indigo-50 transition-colors"
        >
          Open Pulse Academic →
        </button>
      </section>

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} Pulse Academic · Made with ☕ by a 3rd grade teacher
      </footer>

    </div>
  )
}
