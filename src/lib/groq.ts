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
  subject: string      // e.g. "Math", "Science"
  objective: string
  activities: string
  assessment: string
}

// All subjects found across the week, keyed by date then subject name
export type WeekSchedule = Record<string, Record<string, DayLesson>>

export async function parseLessonPlan(text: string, weekStart: string): Promise<WeekSchedule> {
  const prompt = `You are a helpful assistant for teachers. Given this lesson plan text, extract ALL subjects taught each school day (Monday–Friday) of the week starting ${weekStart}. A teacher may teach multiple subjects per day (e.g. Math, Science, Health, Reading).

Return ONLY valid JSON in this format (use ISO dates YYYY-MM-DD for the week of ${weekStart}):
{
  "2025-01-06": {
    "Math": {
      "title": "Short lesson name (under 50 chars)",
      "subject": "Math",
      "objective": "One sentence objective",
      "activities": "Brief summary of main activities (1-2 sentences)",
      "assessment": "Exit ticket or assessment method"
    },
    "Science": {
      "title": "Short lesson name (under 50 chars)",
      "subject": "Science",
      "objective": "One sentence objective",
      "activities": "Brief summary of main activities (1-2 sentences)",
      "assessment": "Exit ticket or assessment method"
    }
  }
}

Only include days and subjects that have a clear lesson. Do not include any explanation outside the JSON.

Lesson plan text:
${text.slice(0, 6000)}`

  const raw = await groqChat([{ role: 'user', content: prompt }])
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Could not parse lesson plan')
  return JSON.parse(match[0])
}

export async function parseStudentNames(text: string): Promise<string[]> {
  const prompt = `Extract student names from this text. The text may be a numbered list, bullet list, comma-separated, one per line, or mixed. Return ONLY a JSON array of clean full names (capitalized properly), no duplicates, no blank entries. No explanation, just the array.

Text:
${text.slice(0, 3000)}`

  const raw = await groqChat([{ role: 'user', content: prompt }])
  const match = raw.match(/\[[\s\S]*\]/)
  if (!match) throw new Error('Could not parse student names')
  return JSON.parse(match[0])
}

export type ExitTicket = { title: string; description: string }

export async function suggestExitTickets(lesson: DayLesson | string): Promise<ExitTicket[]> {
  const context = typeof lesson === 'string'
    ? `Lesson: "${lesson}"`
    : `Lesson: "${lesson.title}"\nObjective: ${lesson.objective}\nActivities: ${lesson.activities}\nAssessment: ${lesson.assessment}`

  const prompt = `You are a helpful assistant for elementary/middle school teachers. Suggest 3 exit ticket ideas based on this lesson:

${context}

Return ONLY a JSON array of 3 objects. Each object has:
- "title": a short name for the exit ticket (under 60 characters)
- "description": 1-2 sentences explaining what students do and what the teacher learns from it (under 180 characters)

Make them specific to this lesson, not generic. No explanation outside the JSON.
Example: [{"title":"Number Line Placement","description":"Students mark 3/4 and 5/4 on a blank number line. Reveals if they understand fractions greater and less than 1."},{"title":"True or False","description":"Students answer: 2/4 and 1/2 are the same point on a number line. Shows if they can identify equivalent fractions."},{"title":"Equivalent to 1 Whole","description":"Students name one fraction equal to 1 whole. Checks understanding of fractions with equal numerator and denominator."}]`

  const raw = await groqChat([{ role: 'user', content: prompt }])
  const match = raw.match(/\[[\s\S]*\]/)
  if (!match) throw new Error('Could not parse exit tickets')
  return JSON.parse(match[0])
}
