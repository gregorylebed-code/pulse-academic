const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY as string
const MODEL = 'llama-3.3-70b-versatile'

async function groqChat(messages: { role: string; content: string }[]): Promise<string> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_API_KEY}` },
    body: JSON.stringify({ model: MODEL, messages, temperature: 0.3 }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Groq error ${res.status}: ${body.slice(0, 200)}`)
  }
  const json = await res.json()
  return json.choices[0].message.content as string
}

export type DayLesson = {
  title: string        // short lesson name shown in tracker input
  subject: string      // e.g. "Math", "Social Studies"
  objective: string
  activities: string
  assessment: string
}

export async function parseLessonPlan(text: string, weekStart: string): Promise<Record<string, DayLesson>> {
  const prompt = `You are a helpful assistant for teachers. Given this lesson plan text, extract the PRIMARY lesson taught each school day (Monday–Friday) of the week starting ${weekStart}. Focus on the main academic subject (Math or the most important lesson if multiple subjects exist per day).

Return ONLY valid JSON in this format (use ISO dates YYYY-MM-DD for the week of ${weekStart}):
{
  "2025-01-06": {
    "title": "Short lesson name (under 50 chars)",
    "subject": "Math",
    "objective": "One sentence objective",
    "activities": "Brief summary of main activities (1-2 sentences)",
    "assessment": "Exit ticket or assessment method"
  }
}

Only include days that have a clear lesson. Do not include any explanation outside the JSON.

Lesson plan text:
${text.slice(0, 6000)}`

  const raw = await groqChat([{ role: 'user', content: prompt }])
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Could not parse lesson plan')
  return JSON.parse(match[0])
}

export async function suggestExitTickets(lesson: DayLesson | string): Promise<string[]> {
  const context = typeof lesson === 'string'
    ? `Lesson: "${lesson}"`
    : `Lesson: "${lesson.title}"\nObjective: ${lesson.objective}\nActivities: ${lesson.activities}\nAssessment: ${lesson.assessment}`

  const prompt = `You are a helpful assistant for elementary/middle school teachers. Suggest 3 short exit ticket prompts based on this lesson:

${context}

Return ONLY a JSON array of 3 strings, each under 120 characters. Make them specific to this lesson — not generic. No explanation, just the array.
Example: ["Draw a number line from 0–2 and mark 3/4 and 5/4", "True or false: 2/4 and 1/2 are the same point on a number line", "Name one fraction equivalent to 1 whole"]`

  const raw = await groqChat([{ role: 'user', content: prompt }])
  const match = raw.match(/\[[\s\S]*\]/)
  if (!match) throw new Error('Could not parse exit tickets')
  return JSON.parse(match[0])
}
