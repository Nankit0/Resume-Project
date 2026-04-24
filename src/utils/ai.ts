import type { ATSResult, Profile } from '../types'

export type AIProvider = 'gemini' | 'groq';
export type GeminiModel = typeof GEMINI_MODELS[number];
export type GroqModel = typeof GROQ_MODELS[number];

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || '';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const GROQ_API_BASE = 'https://api.groq.com/openai/v1/chat/completions';

// Only free-tier models. gemini-2.0-flash has limit:0 on free tier; gemini-1.5-flash is deprecated.
export const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash-8b'] as const;
export const GROQ_MODELS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'] as const;

interface GeminiErrorBody {
  error?: {
    message?: string;
    details?: Array<{ '@type'?: string; retryDelay?: string }>;
  };
}

function parseRetryDelay(body: GeminiErrorBody, fallbackMs: number): number {
  const retryInfo = body.error?.details?.find(d => d['@type']?.includes('RetryInfo'));
  if (retryInfo?.retryDelay) {
    const seconds = parseFloat(retryInfo.retryDelay.replace('s', ''));
    if (!isNaN(seconds)) return seconds * 1000;
  }
  return fallbackMs;
}

async function callGemini(
  systemPrompt: string,
  userPrompt: string,
  maxOutputTokens = 1024,
  preferredModel?: GeminiModel,
  allowFallback = true,
): Promise<string> {
  const models = preferredModel
    ? allowFallback
      ? [preferredModel, ...GEMINI_MODELS.filter(m => m !== preferredModel)]
      : [preferredModel]
    : allowFallback
      ? [...GEMINI_MODELS]
      : [GEMINI_MODELS[0]];
  for (const model of models) {
    const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${GEMINI_API_KEY}`;

    for (let attempt = 1; attempt <= 2; attempt++) {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: userPrompt }] }],
          generationConfig: { maxOutputTokens, temperature: 0.7 },
        }),
      });

      if (res.status === 503 || res.status === 429) {
        const body = await res.json() as GeminiErrorBody;
        const delay = parseRetryDelay(body, res.status === 503 ? 8000 : 12000);
        if (attempt === 1) {
          await new Promise(r => setTimeout(r, delay));
          continue; // retry same model once
        }
        break; // both attempts failed → try next model
      }

      if (!res.ok) {
        const err = await res.json() as GeminiErrorBody;
        throw new Error(err?.error?.message || `API error ${res.status}`);
      }

      const data = await res.json() as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
          finishReason?: string;
        }>;
      };

      if (data.candidates?.[0]?.finishReason === 'MAX_TOKENS') {
        throw new Error('Response was cut short — the job description may be too long, try trimming it.');
      }

      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }
  }

  throw new Error('Gemini API is currently overloaded across all available models. Please wait a minute and try again.');
}

async function callGroq(
  systemPrompt: string,
  userPrompt: string,
  maxOutputTokens = 1024,
  model: GroqModel = 'llama-3.3-70b-versatile',
): Promise<string> {
  if (!GROQ_API_KEY) throw new Error('Missing GROQ API key');

  const res = await fetch(GROQ_API_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: maxOutputTokens,
    }),
  });

  if (!res.ok) {
    const err = await res.json() as { error?: { message?: string } };
    throw new Error(err?.error?.message || `API error ${res.status}`);
  }

  const data = await res.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  return data.choices?.[0]?.message?.content || '';
}

async function callAI(
  provider: AIProvider,
  systemPrompt: string,
  userPrompt: string,
  maxOutputTokens = 1024,
  model?: GeminiModel | GroqModel,
  allowFallback = true,
): Promise<string> {
  if (provider === 'groq') {
    return callGroq(systemPrompt, userPrompt, maxOutputTokens, model as GroqModel | undefined);
  }
  return callGemini(systemPrompt, userPrompt, maxOutputTokens, model as GeminiModel | undefined, allowFallback);
}

export async function generateAbout(
  rawNotes: string,
  profile: Profile,
  provider: AIProvider = 'gemini',
  model?: GeminiModel | GroqModel,
  allowFallback = true,
): Promise<string> {
  return callAI(
    provider,
    'You are an expert resume writer specializing in ATS-optimized content for software engineers. Return ONLY the about/summary text, no extra commentary, no markdown.',
    `Write a professional ATS-friendly summary (3-4 sentences) for a software engineer based on these notes/context:\n\nRaw notes: ${rawNotes}\n\nExisting profile info:\n- Name: ${profile.personal?.name}\n- Experience: ${JSON.stringify(profile.experience?.slice(0, 2))}\n- Skills: ${JSON.stringify(profile.skills)}\n\nMake it impactful, keyword-rich, and specific. No fluff.`,
    512,
    model,
    allowFallback,
  );
}

export async function generateExperienceBullets(
  role: string,
  company: string,
  rawNotes: string,
  provider: AIProvider = 'gemini',
  model?: GeminiModel | GroqModel,
  allowFallback = true,
): Promise<string> {
  const text = await callAI(
    provider,
    'You are an expert resume writer. Return ONLY a JSON array of 4 bullet point strings. No markdown, no code blocks, no extra text.',
    `Generate 4 strong ATS-friendly resume bullet points for this experience:\nRole: ${role}\nCompany: ${company}\nContext/Notes: ${rawNotes || 'No extra notes'}\n\nEach bullet must:\n- Start with a strong action verb (Led, Built, Optimized, Reduced, Improved, Designed, etc.)\n- Be 25-40 words — descriptive and specific, not just a phrase\n- Include quantified impact or metrics where possible (percentages, time saved, scale, team size)\n- Describe what you did, how you did it, and the outcome\n\nReturn ONLY a JSON array like: ["bullet1","bullet2","bullet3","bullet4"]`,
    800,
    model,
    allowFallback,
  );
  return text.replace(/```json|```/g, '').trim();
}

export async function generateProjectDesc(
  projectName: string,
  techStack: string,
  rawNotes: string,
  provider: AIProvider = 'gemini',
  model?: GeminiModel | GroqModel,
  allowFallback = true,
): Promise<string> {
  const text = await callAI(
    provider,
    'You are an expert resume writer. Return ONLY a JSON object with keys "description" and "impact". No markdown, no code blocks.',
    `Generate an ATS-friendly project description and impact statement:\nProject: ${projectName}\nTech Stack: ${techStack}\nNotes: ${rawNotes || 'No extra notes'}\n\nReturn ONLY JSON like: {"description":"...","impact":"..."}`,
    512,
    model,
    allowFallback,
  );
  return text.replace(/```json|```/g, '').trim();
}

export async function parseResumeToProfile(
  resumeText: string,
  provider: AIProvider = 'gemini',
  model?: GeminiModel | GroqModel,
  allowFallback = true,
): Promise<string> {
  const text = await callAI(
    provider,
    'You are a resume parser. Extract structured information and return ONLY valid JSON. No markdown, no code blocks, no extra text.',
    `Parse this resume and return a JSON object with exactly this structure (fill every field you can find, use empty string or empty array for missing data):
{
  "personal": { "name": "", "email": "", "phone": "", "linkedin": "", "portfolio": "", "location": "" },
  "about": "",
  "education": [{ "id": "edu1", "degree": "", "institution": "", "startYear": "", "endYear": "", "description": "" }],
  "experience": [{ "id": "exp1", "role": "", "company": "", "startDate": "", "endDate": "", "bullets": [""] }],
  "projects": [{ "id": "proj1", "name": "", "techStack": "", "role": "", "description": "", "impact": "" }],
  "skills": { "Languages": "", "Frameworks": "" },
  "certifications": [""],
  "interests": [""],
  "personalDetails": [""],
  "keyAchievements": [""]
}

Rules:
- IDs must be sequential: edu1 edu2, exp1 exp2, proj1 proj2, etc.
- Skills must be grouped by category (Languages, Frameworks, Databases, etc.) with comma-separated values
- Experience bullets should be individual action-verb strings
- interests: professional or technical interests found in the resume (leave as empty array if none)
- personalDetails: personal information lines like Date of Birth, Languages, Nationality, Marital Status (leave as empty array if none)
- keyAchievements: notable achievements, awards, honours, or key accomplishments listed in a dedicated achievements section (leave as empty array if none found)
- Return ONLY the JSON object, nothing else

Resume text:
${resumeText.slice(0, 8000)}`,
    3000,
    model,
    allowFallback,
  );
  return text.replace(/```json|```/g, '').trim();
}

export async function evaluateATSScore(
  profile: Profile,
  provider: AIProvider = 'gemini',
  model?: GeminiModel | GroqModel,
  allowFallback = true,
): Promise<ATSResult> {
  const profileData = {
    personal: profile.personal,
    about: profile.about || '',
    educationCount: profile.education?.length || 0,
    experience: (profile.experience || []).map(e => ({
      role: e.role,
      company: e.company,
      bulletCount: e.bullets?.filter(b => b.trim()).length || 0,
      sampleBullet: e.bullets?.find(b => b.trim()) || '',
    })),
    skillCategories: Object.keys(profile.skills || {}),
    skillValues: profile.skills,
    projectCount: profile.projects?.length || 0,
    projects: (profile.projects || []).map(p => ({ name: p.name, hasDescription: !!p.description?.trim(), hasImpact: !!p.impact?.trim() })),
    certificationCount: profile.certifications?.filter(c => c.trim()).length || 0,
  };

  const text = await callAI(
    provider,
    'You are an ATS (Applicant Tracking System) expert and resume coach. Return ONLY valid JSON. No markdown, no code blocks.',
    `Evaluate this resume profile for ATS compatibility and overall quality. Score it 0-100 using these criteria:
- Contact completeness (name, email, phone, linkedin, location): up to 15 pts
- Professional summary (present, 3+ sentences, keyword-rich): up to 20 pts
- Work experience (entries with strong action-verb bullet points): up to 30 pts
- Skills (categorized, keyword-rich): up to 20 pts
- Education (present): up to 10 pts
- Projects with descriptions and certifications: up to 5 pts

Return ONLY a JSON object:
{
  "score": <number 0-100>,
  "strengths": ["up to 4 specific things done well"],
  "improvements": ["up to 5 specific actionable suggestions to improve ATS score"]
}

Profile data:
${JSON.stringify(profileData, null, 2)}

Return ONLY the JSON object.`,
    512,
    model,
    allowFallback,
  );

  const cleaned = text.replace(/```json|```/g, '').trim();
  return JSON.parse(cleaned) as ATSResult;
}

export async function fixProfileForATS(
  profile: Profile,
  improvements: string[],
  provider: AIProvider = 'gemini',
  model?: GeminiModel | GroqModel,
  allowFallback = true,
): Promise<Partial<Profile>> {
  const profileData = {
    about: profile.about || '',
    experience: (profile.experience || []).map(e => ({ id: e.id, role: e.role, company: e.company, bullets: e.bullets })),
    projects: (profile.projects || []).map(p => ({ id: p.id, name: p.name, techStack: p.techStack, role: p.role, description: p.description, impact: p.impact })),
    skills: profile.skills || {},
  };

  const text = await callAI(
    provider,
    'You are an expert resume writer specializing in ATS optimization. Return ONLY valid JSON. No markdown, no code blocks.',
    `Apply these ATS improvement suggestions to the resume profile. Return ONLY the fields that were improved.

Improvements to apply:
${improvements.map((imp, i) => `${i + 1}. ${imp}`).join('\n')}

Current profile fields:
${JSON.stringify(profileData, null, 2)}

Return a JSON object with ONLY the improved fields, using the exact same IDs:
{
  "about": "<improved 3-4 sentence ATS-friendly summary, omit key if not changed>",
  "experience": [{"id":"<exact same id>","bullets":["action-verb bullet under 20 words","...up to 4"]}],
  "projects": [{"id":"<exact same id>","description":"<improved>","impact":"<improved>"}]
}

Rules:
- Omit any top-level key that does not need improvement
- Use the exact same experience and project IDs from the profile
- Experience bullets must start with a strong action verb and include metrics where possible
- Professional summary must be keyword-rich and tailored for ATS parsers
- Return ONLY the JSON object, nothing else`,
    1500,
    model,
    allowFallback,
  );

  const cleaned = text.replace(/```json|```/g, '').trim();
  return JSON.parse(cleaned) as Partial<Profile>;
}

export async function analyzeJD(
  jdText: string,
  profile: Profile,
  provider: AIProvider = 'gemini',
  model?: GeminiModel | GroqModel,
  allowFallback = true,
): Promise<string> {
  const profileSummary = `
Name: ${profile.personal?.name}
Current Skills: ${JSON.stringify(profile.skills)}
Experience: ${profile.experience?.map(e => `${e.role} at ${e.company} (id: ${e.id})`).join(', ')}
Projects: ${profile.projects?.map(p => p.name).join(', ')}
Current About: ${profile.about}
  `.trim();

  const text = await callAI(
    provider,
    'You are an expert resume and job application coach. Return ONLY valid JSON. No markdown, no code blocks, no extra text before or after the JSON.',
    `Analyze this job description and tailor the candidate resume content. Return a JSON object with these exact keys:
{
  "matchScore": <number 0-100>,
  "tailoredAbout": "<3-4 sentence ATS-optimized summary tailored to this JD>",
  "keySkills": ["skill1", "skill2", ...up to 12 most relevant skills],
  "missingSkills": ["skill1", ...skills in JD the candidate lacks],
  "tailoredExperience": [{"id":"<use exact experience id from profile>","bullets":["bullet1","bullet2","bullet3","bullet4"]}],
  "highlightProjects": ["project name 1", ...most relevant project names],
  "linkedinMessage": "<short personal outreach message for LinkedIn, 3-4 sentences, friendly tone>",
  "formalEmail": "<formal job application email, include Subject: line at top>"
}

Job Description:
${jdText}

Candidate Profile:
${profileSummary}

Return ONLY the JSON object, nothing else.`,
    4096,
    model,
    allowFallback,
  );
  return text.replace(/```json|```/g, '').trim();
}
