import { useEffect, useRef, useState } from 'react';
import { useProfile } from '../context/ProfileContext';
import {
  analyzeJD,
  GEMINI_MODELS,
  GROQ_MODELS,
  type AIProvider,
  type GeminiModel,
  type GroqModel,
} from '../utils/ai';
import Toast from '../components/Toast';
import TemplateSelector from '../components/TemplateSelector';
import type { JDAnalysisResult, PDFOverrides } from '../types';
import { clearFetchedJd, fetchJdFromUrl } from '../utils/jdUrlFetcher';
import { Sparkles, Download, Copy, Check, AlertCircle, Loader, ExternalLink, Star, TrendingUp } from 'lucide-react';

const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY;

interface SelectedSections {
  about: boolean;
  skills: boolean;
  experience: boolean;
  projects: boolean;
}

interface ToastState {
  msg: string;
  type: string;
}

function normalizeSkillToken(skill: string): string {
  return skill.trim().toLowerCase().replace(/\s+/g, ' ');
}

function splitSkillValues(value: string): string[] {
  return value
    .split(',')
    .flatMap(part => part.split(/\s*&\s*|\s*\/\s*|\s*\|\s*|\s+and\s+/i))
    .map(skill => skill.trim())
    .filter(Boolean);
}

function uniqueSkills(skills: string[]): string[] {
  const seen = new Set<string>();
  return skills
    .map(skill => skill.trim())
    .filter(Boolean)
    .filter(skill => {
      const key = normalizeSkillToken(skill);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function buildTailoredSkills(existingSkills: Record<string, string>, keySkills: string[]): Record<string, string> {
  const merged = { ...existingSkills };
  const jdSkills = uniqueSkills(keySkills);
  const existingTokens = new Set<string>();

  Object.values(existingSkills).forEach(value => {
    splitSkillValues(value).forEach(skill => existingTokens.add(normalizeSkillToken(skill)));
  });

  const missingSkills = jdSkills.filter(skill => !existingTokens.has(normalizeSkillToken(skill)));
  if (missingSkills.length === 0) return merged;

  const otherKey = Object.keys(merged).find(key => key.trim().toLowerCase() === 'others' || key.trim().toLowerCase() === 'other');

  if (otherKey) {
    const existingOtherSkills = splitSkillValues(merged[otherKey]);
    const combined = uniqueSkills([...existingOtherSkills, ...missingSkills]);
    merged[otherKey] = combined.join(', ');
    return merged;
  }

  merged['Others'] = uniqueSkills(missingSkills).join(', ');
  return merged;
}

export default function JDTab() {
  const { profile } = useProfile();
  const [jdText, setJdText] = useState('');
  const [jobUrl, setJobUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingUrl, setFetchingUrl] = useState(false);
  const [result, setResult] = useState<JDAnalysisResult | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [copied, setCopied] = useState<Record<string, boolean>>({});
  const [templateOverrides, setTemplateOverrides] = useState<PDFOverrides | null>(null);
  const fetchedRecordIdRef = useRef<string | null>(null);
  const cleanupTimerRef = useRef<number | null>(null);
  const [selectedSections, setSelectedSections] = useState<SelectedSections>({ about: true, skills: true, experience: true, projects: true });
  const [aiProvider, setAiProvider] = useState<AIProvider>(
    () => (localStorage.getItem('aiProvider') as AIProvider) || 'gemini'
  );
  const [geminiModel, setGeminiModel] = useState<GeminiModel>(
    () => (localStorage.getItem('geminiModel') as GeminiModel) || GEMINI_MODELS[0]
  );
  const [groqModel, setGroqModel] = useState<GroqModel>(
    () => (localStorage.getItem('groqModel') as GroqModel) || GROQ_MODELS[0]
  );
  const [geminiFallbackEnabled, setGeminiFallbackEnabled] = useState<boolean>(
    () => (localStorage.getItem('geminiFallbackEnabled') ?? 'true') === 'true'
  );

  const showToast = (msg: string, type = 'success') => setToast({ msg, type });

  const isProfileFilled = profile?.personal?.name && profile?.experience?.length > 0;

  useEffect(() => {
    return () => {
      if (cleanupTimerRef.current) {
        window.clearTimeout(cleanupTimerRef.current);
      }
      if (fetchedRecordIdRef.current) {
        void clearFetchedJd(fetchedRecordIdRef.current);
      }
    };
  }, []);

  const scheduleTempCleanup = (id: string) => {
    if (cleanupTimerRef.current) {
      window.clearTimeout(cleanupTimerRef.current);
    }
    cleanupTimerRef.current = window.setTimeout(() => {
      void clearFetchedJd(id);
      if (fetchedRecordIdRef.current === id) {
        fetchedRecordIdRef.current = null;
      }
    }, 10 * 60 * 1000);
  };

  const clearFetchedRecord = async () => {
    const currentId = fetchedRecordIdRef.current;
    if (!currentId) return;
    fetchedRecordIdRef.current = null;
    if (cleanupTimerRef.current) {
      window.clearTimeout(cleanupTimerRef.current);
      cleanupTimerRef.current = null;
    }
    try {
      await clearFetchedJd(currentId);
    } catch {
      // Cleanup is best-effort; the server also prunes expired records.
    }
  };

  const handleFetchJobUrl = async () => {
    if (!jobUrl.trim()) {
      showToast('Paste a job URL first', 'error');
      return;
    }

    setFetchingUrl(true);
    try {
      await clearFetchedRecord();
      const fetched = await fetchJdFromUrl(jobUrl.trim());
      fetchedRecordIdRef.current = fetched.id;
      scheduleTempCleanup(fetched.id);
      setJdText(fetched.text);
      setResult(null);
      showToast(fetched.title ? `Fetched JD from ${fetched.title}` : 'Fetched JD from URL');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to fetch JD from URL.', 'error');
    }
    setFetchingUrl(false);
  };

  const handleAnalyze = async () => {
    if (!jdText.trim()) { showToast('Paste a job description first', 'error'); return; }
    const activeKey = aiProvider === 'groq' ? GROQ_KEY : GEMINI_KEY;
    if (!activeKey) { showToast(`Add ${aiProvider === 'groq' ? 'VITE_GROQ_API_KEY' : 'VITE_GEMINI_API_KEY'} to .env file`, 'error'); return; }
    setLoading(true);
    setResult(null);
    try {
      const model = aiProvider === 'groq' ? groqModel : geminiModel;
      const raw = await analyzeJD(jdText, profile, aiProvider, model, geminiFallbackEnabled);
      const cleaned = raw.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned) as JDAnalysisResult;
      setResult(parsed);
      setSelectedSections({ about: true, skills: true, experience: true, projects: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : `${aiProvider === 'groq' ? 'Groq' : 'Gemini'} AI analysis failed. Check API key or try again.`;
      showToast(msg, 'error');
    }
    setLoading(false);
  };

  const handleDownloadTailored = () => {
    if (!result) return;
    const overrides: PDFOverrides = {};
    if (selectedSections.about) overrides.about = result.tailoredAbout;
    if (selectedSections.experience && result.tailoredExperience) {
      overrides.experience = profile.experience.map(exp => {
        const tailored = result.tailoredExperience.find(t => t.id === exp.id);
        return tailored ? { ...exp, bullets: tailored.bullets } : exp;
      });
    }
    if (selectedSections.projects && result.highlightProjects) {
      overrides.highlightProjects = result.highlightProjects;
    }
    if (selectedSections.skills && result.keySkills) {
      overrides.skills = buildTailoredSkills(profile.skills, result.keySkills);
    }
    setTemplateOverrides(overrides);
  };

  const copyText = (key: string, text: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(c => ({ ...c, [key]: true }));
    setTimeout(() => setCopied(c => ({ ...c, [key]: false })), 2000);
  };

  const scoreColor = (score: number): string => {
    if (score >= 75) return 'text-emerald-600';
    if (score >= 50) return 'text-amber-600';
    return 'text-red-600';
  };

  if (!isProfileFilled) {
    return (
      <div className="max-w-[700px] mx-auto mt-16 text-center px-4">
        <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <AlertCircle size={28} className="text-amber-600" />
        </div>
        <h2 className="font-serif text-2xl text-gray-900 mb-2">Complete your profile first</h2>
        <p className="text-gray-400 text-sm max-w-[400px] mx-auto">
          Head to the Profile Builder tab and fill in at least your personal info and one work experience before using JD Tailoring.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-[960px] mx-auto">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl sm:text-[26px] text-gray-900 mb-1">JD Tailoring</h1>
          <p className="text-gray-400 text-sm">Paste a job description → get a tailored resume, LinkedIn message, and application email</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-2">
            <span className="text-xs text-gray-500 whitespace-nowrap">AI Provider</span>
            <select
              className="field-input !py-1 !text-xs !min-h-0 !h-7"
              value={aiProvider}
              onChange={e => {
                const next = e.target.value as AIProvider;
                setAiProvider(next);
                localStorage.setItem('aiProvider', next);
              }}
            >
              <option value="gemini">Gemini (default)</option>
              <option value="groq">Groq (Llama 3)</option>
            </select>
          </div>
          {aiProvider === 'gemini' ? (
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-2">
              <span className="text-xs text-gray-500 whitespace-nowrap">Gemini Model</span>
              <select
                className="field-input !py-1 !text-xs !min-h-0 !h-7"
                value={geminiModel}
                onChange={e => {
                  const next = e.target.value as GeminiModel;
                  setGeminiModel(next);
                  localStorage.setItem('geminiModel', next);
                }}
              >
                {GEMINI_MODELS.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <label className="flex items-center gap-1.5 text-[11px] text-gray-500 whitespace-nowrap cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="accent-violet-600"
                  checked={geminiFallbackEnabled}
                  onChange={e => {
                    setGeminiFallbackEnabled(e.target.checked);
                    localStorage.setItem('geminiFallbackEnabled', String(e.target.checked));
                  }}
                />
                Auto fallback {geminiFallbackEnabled ? 'enabled' : 'disabled'}
              </label>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-2">
              <span className="text-xs text-gray-500 whitespace-nowrap">Groq Model</span>
              <select
                className="field-input !py-1 !text-xs !min-h-0 !h-7"
                value={groqModel}
                onChange={e => {
                  const next = e.target.value as GroqModel;
                  setGroqModel(next);
                  localStorage.setItem('groqModel', next);
                }}
              >
                {GROQ_MODELS.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <span className="text-[11px] text-gray-400 whitespace-nowrap">
                Faster: {GROQ_MODELS[1]}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Input area */}
      <div className="section-card">
        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_auto] gap-3.5 mb-4">
          <div>
            <label className="field-label">Job URL (optional)</label>
            <div className="relative">
              <ExternalLink size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="field-input pl-8"
                value={jobUrl}
                onChange={e => setJobUrl(e.target.value)}
                placeholder="https://company.com/jobs/123"
              />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row lg:flex-col gap-2 justify-end">
            <button className="btn-secondary justify-center" onClick={() => void handleFetchJobUrl()} disabled={fetchingUrl || !jobUrl.trim()}>
              {fetchingUrl ? <Loader size={14} className="animate-spin" /> : <ExternalLink size={14} />}
              Fetch JD
            </button>
            <div className="text-xs text-gray-600 bg-gray-100 px-3 py-2 rounded-lg leading-relaxed max-w-[340px]">
              <strong>Tip:</strong> When the JD is public, we can fetch it from the link and cache it temporarily.
            </div>
          </div>
        </div>
        <label className="field-label">Job Description *</label>
        <textarea
          className="field-input min-h-[200px]"
          value={jdText}
          onChange={e => setJdText(e.target.value)}
          placeholder={`Paste the complete job description here...\n\nExample:\nWe are looking for a Senior Frontend Engineer with experience in React, TypeScript...\nRequirements:\n- 5+ years of frontend development\n- Strong Angular/React skills\n...`}
        />
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <button className="btn-primary" onClick={handleAnalyze} disabled={loading || !jdText.trim()}>
            {loading ? <><Loader size={14} className="animate-spin" /> Analyzing JD...</> : <><Sparkles size={14} /> Analyze & Tailor Resume</>}
          </button>
          {fetchedRecordIdRef.current && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-violet-50 text-violet-700 border border-violet-100">
              Fetched JD stored temporarily
            </span>
          )}
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="text-center py-12">
          <div className="text-4xl mb-3 animate-pulse-slow">✨</div>
          <p className="text-gray-600 text-sm">AI is analyzing the JD and tailoring your resume...</p>
          <p className="text-gray-400 text-xs mt-1">This usually takes 10–20 seconds</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="animate-fade-in">
          {/* Match Score */}
          <div className="section-card mt-6">
            <div className="flex justify-between items-start gap-4">
              <div>
                <h2 className="section-heading mb-1"><TrendingUp size={18} /> Match Analysis</h2>
                <p className="text-gray-400 text-xs">How well your profile matches this JD</p>
              </div>
              <div className="text-center shrink-0">
                <div className={`text-5xl font-bold font-serif ${scoreColor(result.matchScore)}`}>{result.matchScore}%</div>
                <div className="text-xs text-gray-500 mt-0.5">Match Score</div>
              </div>
            </div>
            {result.missingSkills?.length > 0 && (
              <div className="mt-4 p-3 bg-amber-50 rounded-lg">
                <span className="text-xs font-semibold text-amber-800">Skills to consider learning: </span>
                {result.missingSkills.map(s => (
                  <span key={s} className="inline-block mx-1 my-0.5 px-2 py-0.5 bg-amber-100 text-amber-900 rounded-full text-xs">{s}</span>
                ))}
              </div>
            )}
          </div>

          {/* Section toggles + download */}
          <div className="section-card">
            <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
              <h2 className="section-heading mb-0">📄 Download Tailored Resume</h2>
              <button className="btn-primary" onClick={handleDownloadTailored}>
                <Download size={14} /> Download PDF
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-3">Select which AI improvements to apply to the PDF:</p>
            <div className="flex flex-wrap gap-2.5">
              {([
                { key: 'about',      label: '✏️ Tailored Summary' },
                { key: 'skills',     label: '⚡ Matched Skills'   },
                { key: 'experience', label: '💼 Tuned Bullets'    },
                { key: 'projects',   label: '🚀 Best Projects'    },
              ] as { key: keyof SelectedSections; label: string }[]).map(({ key, label }) => (
                <label
                  key={key}
                  className={`flex items-center gap-1.5 cursor-pointer px-3 py-1.5 border-[1.5px] rounded-lg text-xs font-medium transition-colors ${
                    selectedSections[key]
                      ? 'border-violet-600 bg-violet-50 text-violet-800'
                      : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedSections[key]}
                    onChange={e => setSelectedSections(s => ({ ...s, [key]: e.target.checked }))}
                    className="hidden"
                  />
                  {selectedSections[key] && <Check size={12} />}{label}
                </label>
              ))}
            </div>
          </div>

          {/* Tailored About */}
          {result.tailoredAbout && (
            <div className="section-card">
              <div className="flex justify-between items-center mb-3">
                <h2 className="section-heading mb-0">✏️ Tailored Summary</h2>
                <CopyBtn copied={copied.about} onClick={() => copyText('about', result.tailoredAbout)} />
              </div>
              <div className="bg-gray-50 p-4 rounded-lg text-sm leading-relaxed text-gray-800">{result.tailoredAbout}</div>
            </div>
          )}

          {/* Key Skills */}
          {result.keySkills?.length > 0 && (
            <div className="section-card">
              <div className="flex justify-between items-center mb-3">
                <h2 className="section-heading mb-0">⚡ Key Skills to Highlight</h2>
                <CopyBtn copied={copied.skills} onClick={() => copyText('skills', result.keySkills.join(', '))} />
              </div>
              <div className="flex flex-wrap gap-2">
                {result.keySkills.map(s => <span key={s} className="tag"><Star size={11} />{s}</span>)}
              </div>
            </div>
          )}

          {/* Tailored Experience Bullets */}
          {result.tailoredExperience?.length > 0 && (
            <div className="section-card">
              <h2 className="section-heading mb-4">💼 Tailored Experience Bullets</h2>
              {result.tailoredExperience.map(te => {
                const exp = profile.experience.find(e => e.id === te.id);
                if (!exp) return null;
                return (
                  <div key={te.id} className="mb-4 border-l-[3px] border-violet-600 pl-4">
                    <div className="font-semibold text-sm text-gray-900 mb-2">{exp.role} @ {exp.company}</div>
                    <ul className="pl-4 space-y-1">
                      {te.bullets.map((b, i) => (
                        <li key={i} className="text-sm text-gray-600 leading-relaxed list-disc">{b}</li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}

          {/* LinkedIn Message */}
          {result.linkedinMessage && (
            <div className="section-card">
              <div className="flex justify-between items-center mb-3">
                <h2 className="section-heading mb-0">💬 LinkedIn Personal Message</h2>
                <CopyBtn copied={copied.linkedin} onClick={() => copyText('linkedin', result.linkedinMessage)} />
              </div>
              <div className="bg-gray-50 p-4 rounded-lg text-sm leading-relaxed italic text-gray-800">{result.linkedinMessage}</div>
            </div>
          )}

          {/* Formal Email */}
          {result.formalEmail && (
            <div className="section-card">
              <div className="flex justify-between items-center mb-3">
                <h2 className="section-heading mb-0">📧 Formal Application Email</h2>
                <CopyBtn copied={copied.email} onClick={() => copyText('email', result.formalEmail)} />
              </div>
              <div className="bg-gray-50 p-4 rounded-lg text-sm leading-loose whitespace-pre-wrap text-gray-800 font-mono">{result.formalEmail}</div>
            </div>
          )}
        </div>
      )}

      {templateOverrides !== null && (
        <TemplateSelector
          profile={profile}
          overrides={templateOverrides}
          isJDContext
          onClose={() => setTemplateOverrides(null)}
        />
      )}

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

interface CopyBtnProps {
  copied: boolean;
  onClick: () => void;
}

function CopyBtn({ copied, onClick }: CopyBtnProps) {
  return (
    <button className="btn-secondary btn-sm" onClick={onClick}>
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}
