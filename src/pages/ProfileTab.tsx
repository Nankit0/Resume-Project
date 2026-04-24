import { useState, useRef, useEffect } from 'react';
import type { ReactNode, ChangeEvent } from 'react';
import { useProfile } from '../context/ProfileContext';
import {
  generateAbout,
  generateExperienceBullets,
  generateProjectDesc,
  parseResumeToProfile,
  evaluateATSScore,
  fixProfileForATS,
  GEMINI_MODELS,
  GROQ_MODELS,
  type AIProvider,
  type GeminiModel,
  type GroqModel,
} from '../utils/ai';
import { extractTextFromFile } from '../utils/fileParser';
import AISuggestion from '../components/AISuggestion';
import Toast from '../components/Toast';
import TemplateSelector from '../components/TemplateSelector';
import { useAuth } from '../context/AuthContext';
import type { ATSResult, PersonalInfo, Profile } from '../types';
import { Plus, Trash2, Sparkles, Download, Save, ChevronDown, ChevronUp, Loader, Upload, Pencil, Check, X } from 'lucide-react';

const DEFAULT_SECTION_TITLES: Record<string, string> = {
  personalInfo:    'Personal Information',
  about:           'Professional Summary',
  education:       'Education',
  experience:      'Work Experience',
  projects:        'Projects',
  skills:          'Technical Skills',
  certifications:  'Certifications',
  keyAchievements: 'Key Achievements',
  interests:       'Interests',
  personalDetails: 'Personal Details',
};

const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY;

interface AINotes {
  about: string;
  expNotes: Record<string, string>;
  projNotes: Record<string, string>;
}

interface AISuggestions {
  about: string | null;
  experience: Record<string, string[] | null>;
  projects: Record<string, { description: string; impact: string } | null>;
}

interface ToastState {
  msg: string;
  type: string;
}

export default function ProfileTab() {
  const { user } = useAuth();
  const { profile, saveProfile, deleteProfile, updateField, loadDraftProfile, profiles, switchProfile, createNewProfile, isProfileSelected, isDraft } = useProfile();
  const [toast, setToast] = useState<ToastState | null>(null);
  const [saving, setSaving] = useState(false);
  const [aiNotes, setAiNotes] = useState<AINotes>({ about: '', expNotes: {}, projNotes: {} });
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestions>({ about: null, experience: {}, projects: {} });
  const [loadingAI, setLoadingAI] = useState<Record<string, boolean>>({});
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
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
  const [fileUploading, setFileUploading] = useState(false);
  const [fileError, setFileError] = useState('');
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [showInterests, setShowInterests] = useState(() => !!(profile.interests?.length));
  const [showPersonalDetails, setShowPersonalDetails] = useState(() => !!(profile.personalDetails?.length));
  const [showKeyAchievements, setShowKeyAchievements] = useState(() => !!(profile.keyAchievements?.length));
  const [atsResult, setAtsResult] = useState<ATSResult | null>(null);
  const [loadingATS, setLoadingATS] = useState(false);
  const [loadingFix, setLoadingFix] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastEvaluatedKeyRef = useRef<string | null>(null);

  const showToast = (msg: string, type = 'success') => setToast({ msg, type });

  const runATSEval = async (p: Profile, key: string) => {
    if (lastEvaluatedKeyRef.current === key) return;
    lastEvaluatedKeyRef.current = key;
    const activeKey = aiProvider === 'groq' ? GROQ_KEY : GEMINI_KEY;
    if (!activeKey) return;
    setLoadingATS(true);
    setAtsResult(null);
    try {
      const model = aiProvider === 'groq' ? groqModel : geminiModel;
      const result = await evaluateATSScore(p, aiProvider, model, geminiFallbackEnabled);
      setAtsResult(result);
    } catch {
      // ATS eval is supplementary — silent fail
    }
    setLoadingATS(false);
  };

  useEffect(() => {
    if (!isProfileSelected || isDraft || !profile.id) return;
    void runATSEval(profile, `profile_${profile.id}`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id, isProfileSelected, isDraft]);

  useEffect(() => {
    setShowInterests(!!(profile.interests?.length));
    setShowPersonalDetails(!!(profile.personalDetails?.length));
    setShowKeyAchievements(!!(profile.keyAchievements?.length));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id]);

  const sectionTitle = (key: string) => profile.sectionTitles?.[key] ?? DEFAULT_SECTION_TITLES[key];
  const setSectionTitle = (key: string, title: string) =>
    updateField('sectionTitles', { ...profile.sectionTitles, [key]: title });

  const handleFixViaAI = async () => {
    if (!atsResult?.improvements.length) return;
    const activeKey = aiProvider === 'groq' ? GROQ_KEY : GEMINI_KEY;
    if (!activeKey) { showToast(`Add ${aiProvider === 'groq' ? 'VITE_GROQ_API_KEY' : 'VITE_GEMINI_API_KEY'} to .env`, 'error'); return; }
    setLoadingFix(true);
    try {
      const model = aiProvider === 'groq' ? groqModel : geminiModel;
      const fixed = await fixProfileForATS(profile, atsResult.improvements, aiProvider, model, geminiFallbackEnabled);

      const fixedProfile = { ...profile };

      if (fixed.about) {
        updateField('about', fixed.about);
        fixedProfile.about = fixed.about;
      }

      if (fixed.experience?.length) {
        const aiExpMap = new Map(fixed.experience.map(e => [e.id, e]));
        const mergedExp = profile.experience.map(e => {
          const fix = aiExpMap.get(e.id);
          return fix?.bullets?.length ? { ...e, bullets: fix.bullets } : e;
        });
        updateField('experience', mergedExp);
        fixedProfile.experience = mergedExp;
      }

      if (fixed.projects?.length) {
        const aiProjMap = new Map(fixed.projects.map(p => [p.id, p]));
        const mergedProj = profile.projects.map(p => {
          const fix = aiProjMap.get(p.id);
          return fix ? { ...p, description: fix.description || p.description, impact: fix.impact || p.impact } : p;
        });
        updateField('projects', mergedProj);
        fixedProfile.projects = mergedProj;
      }

      showToast('Profile improved by AI! Review changes and click Save to keep them.');
      // Re-evaluate with the fixed data
      lastEvaluatedKeyRef.current = null;
      void runATSEval(fixedProfile, `fix_${Date.now()}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to apply fixes. Try again.', 'error');
    }
    setLoadingFix(false);
  };

  const handleResumeUpload = async (file: File) => {
    setFileError('');
    setFileUploading(true);
    try {
      const text = await extractTextFromFile(file);
      const activeKey = aiProvider === 'groq' ? GROQ_KEY : GEMINI_KEY;
      if (!activeKey) throw new Error(`Add ${aiProvider === 'groq' ? 'VITE_GROQ_API_KEY' : 'VITE_GEMINI_API_KEY'} to .env`);
      const model = aiProvider === 'groq' ? groqModel : geminiModel;
      const raw = await parseResumeToProfile(text, aiProvider, model, geminiFallbackEnabled);
      const parsed = JSON.parse(raw) as Partial<Profile>;
      loadDraftProfile(parsed);
      showToast('Resume parsed! Review the fields and click Save when ready.');
      const draftKey = `draft_${Date.now()}`;
      void runATSEval(parsed as Profile, draftKey);
    } catch (err) {
      setFileError(err instanceof Error ? err.message : 'Failed to parse resume. Try again.');
    }
    setFileUploading(false);
  };

  const handleSave = async () => {
    const { name, email, phone } = profile.personal || {};
    if (!name?.trim())  { showToast('Full Name is required before saving.', 'error'); return; }
    if (!email?.trim()) { showToast('Email is required before saving.', 'error'); return; }
    if (!phone?.trim()) { showToast('Phone is required before saving.', 'error'); return; }
    setSaving(true);
    await saveProfile(profile);
    setSaving(false);
    showToast('Profile saved!');
  };

  const setPersonal = (key: keyof PersonalInfo, val: string) =>
    updateField('personal', { ...profile.personal, [key]: val });

  const handleGenerateAbout = async () => {
    const activeKey = aiProvider === 'groq' ? GROQ_KEY : GEMINI_KEY;
    if (!activeKey) { showToast(`Add ${aiProvider === 'groq' ? 'VITE_GROQ_API_KEY' : 'VITE_GEMINI_API_KEY'} to .env`, 'error'); return; }
    setLoadingAI(l => ({ ...l, about: true }));
    try {
      const model = aiProvider === 'groq' ? groqModel : geminiModel;
      const text = await generateAbout(aiNotes.about || profile.about, profile, aiProvider, model, geminiFallbackEnabled);
      setAiSuggestions(s => ({ ...s, about: text }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : `${aiProvider === 'groq' ? 'Groq' : 'Gemini'} AI failed. Check API key.`;
      showToast(msg, 'error');
    }
    setLoadingAI(l => ({ ...l, about: false }));
  };

  const handleGenerateExp = async (expId: string, role: string, company: string) => {
    const activeKey = aiProvider === 'groq' ? GROQ_KEY : GEMINI_KEY;
    if (!activeKey) { showToast(`Add ${aiProvider === 'groq' ? 'VITE_GROQ_API_KEY' : 'VITE_GEMINI_API_KEY'} to .env`, 'error'); return; }
    setLoadingAI(l => ({ ...l, [`exp_${expId}`]: true }));
    try {
      const model = aiProvider === 'groq' ? groqModel : geminiModel;
      const raw = await generateExperienceBullets(role, company, aiNotes.expNotes[expId] || '', aiProvider, model, geminiFallbackEnabled);
      const bullets = JSON.parse(raw) as string[];
      setAiSuggestions(s => ({ ...s, experience: { ...s.experience, [expId]: bullets } }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : `${aiProvider === 'groq' ? 'Groq' : 'Gemini'} AI failed. Try again.`;
      showToast(msg, 'error');
    }
    setLoadingAI(l => ({ ...l, [`exp_${expId}`]: false }));
  };

  const acceptExpBullets = (expId: string, bullets: string[]) => {
    updateField('experience', profile.experience.map(e => e.id === expId ? { ...e, bullets } : e));
    setAiSuggestions(s => ({ ...s, experience: { ...s.experience, [expId]: null } }));
    showToast('Bullets updated!');
  };

  const handleGenerateProject = async (projId: string, name: string, techStack: string) => {
    const activeKey = aiProvider === 'groq' ? GROQ_KEY : GEMINI_KEY;
    if (!activeKey) { showToast(`Add ${aiProvider === 'groq' ? 'VITE_GROQ_API_KEY' : 'VITE_GEMINI_API_KEY'} to .env`, 'error'); return; }
    setLoadingAI(l => ({ ...l, [`proj_${projId}`]: true }));
    try {
      const model = aiProvider === 'groq' ? groqModel : geminiModel;
      const raw = await generateProjectDesc(name, techStack, aiNotes.projNotes[projId] || '', aiProvider, model, geminiFallbackEnabled);
      const parsed = JSON.parse(raw) as { description: string; impact: string };
      setAiSuggestions(s => ({ ...s, projects: { ...s.projects, [projId]: parsed } }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : `${aiProvider === 'groq' ? 'Groq' : 'Gemini'} AI failed. Try again.`;
      showToast(msg, 'error');
    }
    setLoadingAI(l => ({ ...l, [`proj_${projId}`]: false }));
  };

  const acceptProject = (projId: string, data: { description: string; impact: string }) => {
    updateField('projects', profile.projects.map(p => p.id === projId ? { ...p, ...data } : p));
    setAiSuggestions(s => ({ ...s, projects: { ...s.projects, [projId]: null } }));
    showToast('Project updated!');
  };

  const addEducation = () => updateField('education', [...(profile.education || []), { id: `edu_${Date.now()}`, degree: '', institution: '', startYear: '', endYear: '', description: '' }]);
  const updateEdu = (id: string, key: string, val: string) => updateField('education', profile.education.map(e => e.id === id ? { ...e, [key]: val } : e));
  const removeEdu = (id: string) => updateField('education', profile.education.filter(e => e.id !== id));

  const addExp = () => updateField('experience', [...(profile.experience || []), { id: `exp_${Date.now()}`, role: '', company: '', startDate: '', endDate: '', bullets: [''] }]);
  const updateExp = (id: string, key: string, val: string | string[]) => updateField('experience', profile.experience.map(e => e.id === id ? { ...e, [key]: val } : e));
  const removeExp = (id: string) => updateField('experience', profile.experience.filter(e => e.id !== id));
  const updateBullet = (expId: string, idx: number, val: string) => {
    const exp = profile.experience.find(e => e.id === expId);
    if (!exp) return;
    const bullets = [...exp.bullets]; bullets[idx] = val;
    updateExp(expId, 'bullets', bullets);
  };
  const addBullet = (expId: string) => {
    const exp = profile.experience.find(e => e.id === expId);
    if (!exp) return;
    updateExp(expId, 'bullets', [...exp.bullets, '']);
  };
  const removeBullet = (expId: string, idx: number) => {
    const exp = profile.experience.find(e => e.id === expId);
    if (!exp) return;
    updateExp(expId, 'bullets', exp.bullets.filter((_, i) => i !== idx));
  };

  const addProject = () => updateField('projects', [...(profile.projects || []), { id: `proj_${Date.now()}`, name: '', techStack: '', role: '', description: '', impact: '' }]);
  const updateProj = (id: string, key: string, val: string) => updateField('projects', profile.projects.map(p => p.id === id ? { ...p, [key]: val } : p));
  const removeProj = (id: string) => updateField('projects', profile.projects.filter(p => p.id !== id));

  const updateSkillRating = (key: string, rating: number) => {
    const next = { ...(profile.skillRatings || {}), [key]: rating };
    if (rating === 0) delete next[key];
    updateField('skillRatings', next);
  };

  const updateSkillCat = (oldKey: string, newKey: string) => {
    const s = { ...profile.skills };
    const val = s[oldKey]; delete s[oldKey]; s[newKey] = val;
    updateField('skills', s);
  };
  const updateSkillVal = (key: string, val: string) => updateField('skills', { ...profile.skills, [key]: val });
  const addSkillCat = () => { const key = `Category ${Object.keys(profile.skills || {}).length + 1}`; updateField('skills', { ...profile.skills, [key]: '' }); };
  const removeSkillCat = (key: string) => { const s = { ...profile.skills }; delete s[key]; updateField('skills', s); };

  const toggleCollapse = (key: string) => setCollapsed(c => ({ ...c, [key]: !c[key] }));
  const selectedProfileId = profile.id;
  const ownProfileCount = profiles.filter(p => p.userId === user?.id).length;
  const canCreateProfile = user?.userRole === 'admin' || ownProfileCount < 4;

  return (
    <div className="max-w-[860px] mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-serif text-2xl sm:text-[26px] text-gray-900 mb-1">Profile Builder</h1>
          <p className="text-gray-400 text-sm">Build your base resume — AI can help polish each section</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Profile Selector */}
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-2">
            <span className="text-xs text-gray-500 whitespace-nowrap">Profile</span>
            <select
              className="field-input !py-1 !text-xs !min-h-0 !h-7"
              value={isProfileSelected ? (profile.id ?? '') : ''}
              onChange={e => {
                const selectedId = e.target.value;
                if (selectedId === 'new') {
                  const created = createNewProfile();
                  if (!created) {
                    showToast('You can create up to 4 profiles only.', 'error');
                  }
                } else if (selectedId !== '') {
                  switchProfile(selectedId);
                }
              }}
            >
              <option value="" disabled>Select a profile</option>
              {profiles.map(p => (
                <option key={p.id} value={p.id}>
                  {p.personal?.name || `Profile ${p.id}`}
                  {user?.userRole === 'admin' && (p.ownerName || p.ownerUsername)
                    ? ` - ${p.ownerName || p.ownerUsername}`
                    : ''}
                </option>
              ))}
              <option value="new" disabled={!canCreateProfile}>+ New Profile</option>
            </select>
          </div>
          {!canCreateProfile && user?.userRole !== 'admin' && (
            <p className="w-full sm:w-auto text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              User profiles are limited to 4. Delete one to create another.
            </p>
          )}
          {isProfileSelected && !isDraft && selectedProfileId !== undefined && selectedProfileId !== null && (
            <button
              className="btn-danger"
              onClick={async () => {
                const label = profile.personal?.name?.trim() || `Profile ${selectedProfileId}`;
                const ok = window.confirm(`Delete ${label}? This cannot be undone.`);
                if (!ok) return;
                await deleteProfile(selectedProfileId);
              }}
            >
              <Trash2 size={13} />
              Delete Profile
            </button>
          )}
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

      {/* Upload panel — shown when no profile selected OR when a new empty draft is active */}
      {(!isProfileSelected || isDraft) && (
        <div className="section-card flex flex-col items-center gap-6 py-12">
          {!isProfileSelected && (
            <p className="text-gray-400 text-sm">Select an existing profile from the dropdown above, or upload your resume to create a new one.</p>
          )}
          {isDraft && (
            <p className="text-gray-400 text-sm">Upload your existing resume to auto-fill the form, or fill in the fields manually below.</p>
          )}

          <div className="w-full max-w-md">
            <div
              className="border-2 border-dashed border-gray-200 rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer hover:border-violet-300 hover:bg-violet-50/50 transition-colors"
              onClick={() => !fileUploading && fileInputRef.current?.click()}
            >
              {fileUploading
                ? <Loader size={28} className="animate-spin text-violet-500" />
                : <Upload size={28} className="text-gray-300" />
              }
              <p className="text-sm font-medium text-gray-600">
                {fileUploading ? 'Parsing your resume with AI…' : 'Upload your existing resume'}
              </p>
              <p className="text-xs text-gray-400">PDF or Word (.docx) — fields will be auto-filled for review</p>
              {!fileUploading && (
                <button className="btn-primary btn-sm mt-1" onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                  <Upload size={13} /> Choose File
                </button>
              )}
            </div>
            {fileError && <p className="text-red-500 text-xs mt-2 text-center">{fileError}</p>}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) { e.target.value = ''; void handleResumeUpload(f); } }}
            />
          </div>
        </div>
      )}

      {isProfileSelected && (<>

      {/* Color Picker */}
      <div className="section-card !py-4 flex flex-wrap items-center gap-4">
        <span className="field-label !mb-0">Resume Accent Color</span>
        <input
          type="color"
          value={profile.accentColor || '#7C3AED'}
          onChange={e => updateField('accentColor', e.target.value)}
          className="w-10 h-9 border-[1.5px] border-gray-200 rounded-md cursor-pointer p-0.5"
        />
        <span className="text-gray-400 text-xs">{profile.accentColor || '#7C3AED'}</span>
        <span className="ml-auto text-xs text-gray-600 hidden sm:block">This color applies to all headings in your PDF</span>
      </div>

      {/* Personal Info */}
      <SectionCard title={sectionTitle('personalInfo')} icon="👤" sectionKey="personalInfo" onTitleChange={t => setSectionTitle('personalInfo', t)}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <Field label="Full Name"        value={profile.personal?.name}      onChange={v => setPersonal('name', v)}      placeholder="Ankit Nagar" />
          <Field label="Email"            value={profile.personal?.email}     onChange={v => setPersonal('email', v)}     placeholder="you@email.com" />
          <Field label="Phone"            value={profile.personal?.phone}     onChange={v => setPersonal('phone', v)}     placeholder="+91 999-019-4803" />
          <Field label="LinkedIn URL"     value={profile.personal?.linkedin}  onChange={v => setPersonal('linkedin', v)}  placeholder="linkedin.com/in/yourname" />
          <Field label="Portfolio / GitHub" value={profile.personal?.portfolio} onChange={v => setPersonal('portfolio', v)} placeholder="github.com/yourusername" />
          <Field label="Location"         value={profile.personal?.location}  onChange={v => setPersonal('location', v)}  placeholder="City, Country" />
        </div>
      </SectionCard>

      {/* About */}
      <SectionCard title={sectionTitle('about')} icon="📝" sectionKey="about" onTitleChange={t => setSectionTitle('about', t)}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="field-label">Current Summary</label>
            <textarea
              className="field-input min-h-[120px]"
              value={profile.about || ''}
              onChange={e => updateField('about', e.target.value)}
              placeholder="Your professional summary..."
            />
          </div>
          <div>
            <label className="field-label">Notes for AI (optional context)</label>
            <textarea
              className="field-input min-h-[80px]"
              value={aiNotes.about}
              onChange={e => setAiNotes(n => ({ ...n, about: e.target.value }))}
              placeholder="E.g. I want to highlight my Angular expertise and team lead experience..."
            />
            <button className="btn-ai" onClick={handleGenerateAbout} disabled={loadingAI.about}>
              {loadingAI.about ? <Loader size={13} className="animate-spin" /> : <Sparkles size={13} />}
              Generate with AI
            </button>
          </div>
        </div>
        {aiSuggestions.about && (
          <AISuggestion
            suggestion={aiSuggestions.about}
            onAccept={() => { updateField('about', aiSuggestions.about!); setAiSuggestions(s => ({ ...s, about: null })); showToast('Summary updated!'); }}
            onReject={() => setAiSuggestions(s => ({ ...s, about: null }))}
          />
        )}
      </SectionCard>

      {/* Education */}
      <SectionCard title={sectionTitle('education')} icon="🎓" sectionKey="education" onTitleChange={t => setSectionTitle('education', t)} onAdd={addEducation}>
        {(profile.education || []).map(edu => (
          <div key={edu.id} className="item-card">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-medium text-gray-600">{edu.degree || 'New Education'}</span>
              <button className="btn-danger" onClick={() => removeEdu(edu.id)}><Trash2 size={13} /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <Field label="Degree / Course" value={edu.degree}      onChange={v => updateEdu(edu.id, 'degree', v)}      placeholder="Master's in Computer Application" />
              <Field label="Institution"     value={edu.institution}  onChange={v => updateEdu(edu.id, 'institution', v)}  placeholder="University Name" />
              <Field label="Start"           value={edu.startYear}    onChange={v => updateEdu(edu.id, 'startYear', v)}    placeholder="Aug 2022" />
              <Field label="End"             value={edu.endYear}      onChange={v => updateEdu(edu.id, 'endYear', v)}      placeholder="Dec 2024" />
            </div>
            <div className="mt-3">
              <label className="field-label">Description</label>
              <textarea className="field-input min-h-[70px]" value={edu.description} onChange={e => updateEdu(edu.id, 'description', e.target.value)} placeholder="Key learnings, achievements..." />
            </div>
          </div>
        ))}
      </SectionCard>

      {/* Experience */}
      <SectionCard title={sectionTitle('experience')} icon="💼" sectionKey="experience" onTitleChange={t => setSectionTitle('experience', t)} onAdd={addExp}>
        {(profile.experience || []).map(exp => (
          <div key={exp.id} className="item-card">
            <div className="flex justify-between items-center mb-3">
              <button className="btn-ghost !px-1.5 !py-1" onClick={() => toggleCollapse(exp.id)}>
                <span className="font-medium text-sm">{exp.role || 'New Role'} @ {exp.company}</span>
                {collapsed[exp.id] ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              </button>
              <button className="btn-danger" onClick={() => removeExp(exp.id)}><Trash2 size={13} /></button>
            </div>
            {!collapsed[exp.id] && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <Field label="Job Title"   value={exp.role}      onChange={v => updateExp(exp.id, 'role', v)}      placeholder="Software Engineer" />
                  <Field label="Company"     value={exp.company}   onChange={v => updateExp(exp.id, 'company', v)}   placeholder="Company Name" />
                  <Field label="Start Date"  value={exp.startDate} onChange={v => updateExp(exp.id, 'startDate', v)} placeholder="Jul 2022" />
                  <Field label="End Date"    value={exp.endDate}   onChange={v => updateExp(exp.id, 'endDate', v)}   placeholder="Present" />
                </div>

                <div className="mt-3">
                  <label className="field-label">Bullet Points</label>
                  {(exp.bullets || []).map((b, i) => (
                    <div key={i} className="flex gap-2 mb-2">
                      <textarea className="field-input !min-h-[56px]" value={b} onChange={e => updateBullet(exp.id, i, e.target.value)} placeholder="Bullet point..." />
                      <button className="btn-danger shrink-0" onClick={() => removeBullet(exp.id, i)}><Trash2 size={13} /></button>
                    </div>
                  ))}
                  <button className="btn-secondary btn-sm mt-2" onClick={() => addBullet(exp.id)}><Plus size={13} /> Add Bullet</button>
                </div>

                <div className="mt-3 bg-gray-50 rounded-lg p-3">
                  <label className="field-label">AI notes for this role (optional)</label>
                  <textarea className="field-input min-h-[60px]" value={aiNotes.expNotes[exp.id] || ''} onChange={e => setAiNotes(n => ({ ...n, expNotes: { ...n.expNotes, [exp.id]: e.target.value } }))} placeholder="E.g. I reduced build time by 40%, led a team of 3..." />
                  <button className="btn-ai" onClick={() => handleGenerateExp(exp.id, exp.role, exp.company)} disabled={loadingAI[`exp_${exp.id}`]}>
                    {loadingAI[`exp_${exp.id}`] ? <Loader size={13} className="animate-spin" /> : <Sparkles size={13} />}
                    Generate Bullets with AI
                  </button>
                </div>

                {aiSuggestions.experience[exp.id] && (
                  <AISuggestion
                    suggestion={aiSuggestions.experience[exp.id]!.join('\n')}
                    label="AI Bullets"
                    onAccept={() => acceptExpBullets(exp.id, aiSuggestions.experience[exp.id]!)}
                    onReject={() => setAiSuggestions(s => ({ ...s, experience: { ...s.experience, [exp.id]: null } }))}
                  />
                )}
              </>
            )}
          </div>
        ))}
      </SectionCard>

      {/* Projects */}
      <SectionCard title={sectionTitle('projects')} icon="🚀" sectionKey="projects" onTitleChange={t => setSectionTitle('projects', t)} onAdd={addProject}>
        {(profile.projects || []).map(proj => (
          <div key={proj.id} className="item-card">
            <div className="flex justify-between items-center mb-3">
              <button className="btn-ghost !px-1.5 !py-1" onClick={() => toggleCollapse(`proj_${proj.id}`)}>
                <span className="font-medium text-sm">{proj.name || 'New Project'}</span>
                {collapsed[`proj_${proj.id}`] ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              </button>
              <button className="btn-danger" onClick={() => removeProj(proj.id)}><Trash2 size={13} /></button>
            </div>
            {!collapsed[`proj_${proj.id}`] && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <Field label="Project Name" value={proj.name}      onChange={v => updateProj(proj.id, 'name', v)}      placeholder="SpinEv (EV Domain)" />
                  <Field label="Tech Stack"   value={proj.techStack} onChange={v => updateProj(proj.id, 'techStack', v)} placeholder="Angular, Node.js, MySQL" />
                  <Field label="Your Role"    value={proj.role}      onChange={v => updateProj(proj.id, 'role', v)}      placeholder="Full Stack Developer" />
                </div>
                <div className="mt-3">
                  <label className="field-label">Description</label>
                  <textarea className="field-input min-h-[70px]" value={proj.description} onChange={e => updateProj(proj.id, 'description', e.target.value)} placeholder="What the project does..." />
                </div>
                <div className="mt-3">
                  <label className="field-label">Impact</label>
                  <textarea className="field-input min-h-[56px]" value={proj.impact} onChange={e => updateProj(proj.id, 'impact', e.target.value)} placeholder="Business/technical impact..." />
                </div>

                <div className="mt-3 bg-gray-50 rounded-lg p-3">
                  <label className="field-label">AI notes (optional extra context)</label>
                  <textarea className="field-input min-h-[56px]" value={aiNotes.projNotes[proj.id] || ''} onChange={e => setAiNotes(n => ({ ...n, projNotes: { ...n.projNotes, [proj.id]: e.target.value } }))} placeholder="Mention metrics, scale, challenges solved..." />
                  <button className="btn-ai" onClick={() => handleGenerateProject(proj.id, proj.name, proj.techStack)} disabled={loadingAI[`proj_${proj.id}`]}>
                    {loadingAI[`proj_${proj.id}`] ? <Loader size={13} className="animate-spin" /> : <Sparkles size={13} />}
                    Polish with AI
                  </button>
                </div>

                {aiSuggestions.projects[proj.id] && (
                  <AISuggestion
                    suggestion={`Description: ${aiSuggestions.projects[proj.id]!.description}\n\nImpact: ${aiSuggestions.projects[proj.id]!.impact}`}
                    label="AI Polish"
                    onAccept={() => acceptProject(proj.id, aiSuggestions.projects[proj.id]!)}
                    onReject={() => setAiSuggestions(s => ({ ...s, projects: { ...s.projects, [proj.id]: null } }))}
                  />
                )}
              </>
            )}
          </div>
        ))}
      </SectionCard>

      {/* Skills */}
      <SectionCard title={sectionTitle('skills')} icon="⚡" sectionKey="skills" onTitleChange={t => setSectionTitle('skills', t)} onAdd={addSkillCat}>
        {Object.entries(profile.skills || {}).map(([key, val]) => {
          const rating = profile.skillRatings?.[key] ?? 0;
          return (
            <div key={key} className="flex gap-2.5 mb-2.5 items-center">
              <input className="field-input w-40 shrink-0" value={key} onChange={e => updateSkillCat(key, e.target.value)} placeholder="Category" />
              <input className="field-input" value={val} onChange={e => updateSkillVal(key, e.target.value)} placeholder="skill1, skill2, skill3" />
              {/* Star rating — click same star to clear */}
              <div className="flex gap-0 shrink-0" title="Optional skill rating for PDF">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => updateSkillRating(key, n === rating ? 0 : n)}
                    className={`text-[16px] leading-none px-0.5 transition-colors ${n <= rating ? 'text-violet-500' : 'text-gray-300 hover:text-violet-400'}`}
                    title={n === rating ? 'Click to clear rating' : `Rate ${n}/5`}
                  >
                    ★
                  </button>
                ))}
              </div>
              <button className="btn-danger shrink-0" onClick={() => removeSkillCat(key)}><Trash2 size={13} /></button>
            </div>
          );
        })}
        <p className="text-[11px] text-gray-400 mt-1">Stars = optional rating shown in PDF. Click same star again to clear.</p>
      </SectionCard>

      {/* Certifications */}
      <SectionCard title={sectionTitle('certifications')} icon="🏆" sectionKey="certifications" onTitleChange={t => setSectionTitle('certifications', t)} onAdd={() => updateField('certifications', [...(profile.certifications || []), ''])}>
        {(profile.certifications || []).map((cert, i) => (
          <div key={i} className="flex gap-2.5 mb-2">
            <input
              className="field-input"
              value={cert}
              onChange={(e: ChangeEvent<HTMLInputElement>) => { const c = [...profile.certifications]; c[i] = e.target.value; updateField('certifications', c); }}
              placeholder="Certification name"
            />
            <button className="btn-danger shrink-0" onClick={() => updateField('certifications', profile.certifications.filter((_, idx) => idx !== i))}><Trash2 size={13} /></button>
          </div>
        ))}
      </SectionCard>

      {/* Key Achievements */}
      <div className="section-card">
        <div className="flex justify-between items-center mb-4">
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              className="accent-violet-600 w-4 h-4"
              checked={showKeyAchievements}
              onChange={e => {
                setShowKeyAchievements(e.target.checked);
                if (!e.target.checked) updateField('keyAchievements', []);
              }}
            />
            <EditableSectionTitle
              icon="🏅"
              value={sectionTitle('keyAchievements')}
              onCommit={t => setSectionTitle('keyAchievements', t)}
            />
            <span className="text-xs text-gray-400">(optional)</span>
          </label>
          {showKeyAchievements && (
            <button className="btn-secondary btn-sm" onClick={() => updateField('keyAchievements', [...(profile.keyAchievements || []), ''])}>
              <Plus size={13} /> Add
            </button>
          )}
        </div>
        {showKeyAchievements && (
          <>
            {(profile.keyAchievements || []).length === 0 && (
              <p className="text-xs text-gray-400">Add key achievements, awards, or notable accomplishments.</p>
            )}
            {(profile.keyAchievements || []).map((item, i) => (
              <div key={i} className="flex gap-2.5 mb-2">
                <input
                  className="field-input"
                  value={item}
                  onChange={e => { const c = [...(profile.keyAchievements || [])]; c[i] = e.target.value; updateField('keyAchievements', c); }}
                  placeholder="e.g. Reduced deployment time by 60% across 3 services"
                />
                <button className="btn-danger shrink-0" onClick={() => updateField('keyAchievements', (profile.keyAchievements || []).filter((_, idx) => idx !== i))}><Trash2 size={13} /></button>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Interests */}
      <div className="section-card">
        <div className="flex justify-between items-center mb-4">
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              className="accent-violet-600 w-4 h-4"
              checked={showInterests}
              onChange={e => {
                setShowInterests(e.target.checked);
                if (!e.target.checked) updateField('interests', []);
              }}
            />
            <EditableSectionTitle
              icon="🎯"
              value={sectionTitle('interests')}
              onCommit={t => setSectionTitle('interests', t)}
            />
            <span className="text-xs text-gray-400">(optional)</span>
          </label>
          {showInterests && (
            <button className="btn-secondary btn-sm" onClick={() => updateField('interests', [...(profile.interests || []), ''])}>
              <Plus size={13} /> Add
            </button>
          )}
        </div>
        {showInterests && (
          <>
            {(profile.interests || []).length === 0 && (
              <p className="text-xs text-gray-400">Add your professional interests, e.g. Open Source, Machine Learning, Cloud Computing.</p>
            )}
            {(profile.interests || []).map((item, i) => (
              <div key={i} className="flex gap-2.5 mb-2">
                <input
                  className="field-input"
                  value={item}
                  onChange={e => { const c = [...(profile.interests || [])]; c[i] = e.target.value; updateField('interests', c); }}
                  placeholder="e.g. Open Source, Machine Learning"
                />
                <button className="btn-danger shrink-0" onClick={() => updateField('interests', (profile.interests || []).filter((_, idx) => idx !== i))}><Trash2 size={13} /></button>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Personal Details */}
      <div className="section-card">
        <div className="flex justify-between items-center mb-4">
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              className="accent-violet-600 w-4 h-4"
              checked={showPersonalDetails}
              onChange={e => {
                setShowPersonalDetails(e.target.checked);
                if (!e.target.checked) updateField('personalDetails', []);
              }}
            />
            <EditableSectionTitle
              icon="🌱"
              value={sectionTitle('personalDetails')}
              onCommit={t => setSectionTitle('personalDetails', t)}
            />
            <span className="text-xs text-gray-400">(optional)</span>
          </label>
          {showPersonalDetails && (
            <button className="btn-secondary btn-sm" onClick={() => updateField('personalDetails', [...(profile.personalDetails || []), ''])}>
              <Plus size={13} /> Add
            </button>
          )}
        </div>
        {showPersonalDetails && (
          <>
            {(profile.personalDetails || []).length === 0 && (
              <p className="text-xs text-gray-400">Add personal details, e.g. Date of Birth, Languages spoken, Nationality.</p>
            )}
            {(profile.personalDetails || []).map((item: string, i: number) => (
              <div key={i} className="flex gap-2.5 mb-2">
                <input
                  className="field-input"
                  value={item}
                  onChange={e => { const c = [...(profile.personalDetails || [])]; c[i] = e.target.value; updateField('personalDetails', c); }}
                  placeholder="e.g. Date of Birth: 1 Jan 1995"
                />
                <button className="btn-danger shrink-0" onClick={() => updateField('personalDetails', (profile.personalDetails || []).filter((_: string, idx: number) => idx !== i))}><Trash2 size={13} /></button>
              </div>
            ))}
          </>
        )}
      </div>

      {/* ATS Score */}
      {(loadingATS || atsResult) && (
        <div className="section-card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="section-heading">⚡ ATS Score</h2>
            {atsResult && !loadingATS && (
              <span className={`text-2xl font-bold tabular-nums ${atsResult.score >= 75 ? 'text-emerald-600' : atsResult.score >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                {atsResult.score}/100
              </span>
            )}
            {loadingATS && <Loader size={18} className="animate-spin text-violet-400" />}
          </div>

          {loadingATS && (
            <p className="text-sm text-gray-400">Evaluating your profile against ATS criteria…</p>
          )}

          {atsResult && !loadingATS && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-2">Strengths</p>
                <ul className="space-y-1.5">
                  {atsResult.strengths.map((s, i) => (
                    <li key={i} className="flex gap-2 text-sm text-gray-700">
                      <span className="text-emerald-500 shrink-0 mt-0.5">✓</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">Improvements</p>
                <ul className="space-y-1.5">
                  {atsResult.improvements.map((imp, i) => (
                    <li key={i} className="flex gap-2 text-sm text-gray-700">
                      <span className="text-amber-500 shrink-0 mt-0.5">→</span>
                      {imp}
                    </li>
                  ))}
                </ul>
                {atsResult.improvements.length > 0 && (
                  <button
                    className="btn-ai mt-4"
                    onClick={handleFixViaAI}
                    disabled={loadingFix || loadingATS}
                  >
                    {loadingFix ? <Loader size={13} className="animate-spin" /> : <Sparkles size={13} />}
                    {loadingFix ? 'Applying fixes…' : 'Fix via AI'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sticky Save bar */}
      <div className="sticky bottom-0 bg-gradient-to-t from-[#F8F7FF] via-[#F8F7FF]/90 to-transparent py-4 flex justify-end gap-2.5">
        <button className="btn-secondary" onClick={() => setShowTemplateSelector(true)}>
          <Download size={14} /> Download PDF
        </button>
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? <Loader size={14} className="animate-spin" /> : <Save size={14} />} Save Profile
        </button>
      </div>

      </>)}

      {showTemplateSelector && (
        <TemplateSelector profile={profile} onClose={() => setShowTemplateSelector(false)} />
      )}

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

interface SectionCardProps {
  title: string;
  icon: string;
  children: ReactNode;
  onAdd?: () => void;
  sectionKey?: string;
  onTitleChange?: (newTitle: string) => void;
}

function SectionCard({ title, icon, children, onAdd, onTitleChange }: SectionCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== title) onTitleChange?.(trimmed);
    else setDraft(title);
    setEditing(false);
  };

  return (
    <div className="section-card">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-1.5 min-w-0">
          {editing ? (
            <>
              <input
                autoFocus
                className="field-input !py-0.5 !h-7 !text-sm font-semibold w-48"
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(title); setEditing(false); } }}
              />
              <button className="text-emerald-500 hover:text-emerald-600" onMouseDown={e => { e.preventDefault(); commit(); }}><Check size={14} /></button>
              <button className="text-gray-400 hover:text-gray-600" onMouseDown={e => { e.preventDefault(); setDraft(title); setEditing(false); }}><X size={14} /></button>
            </>
          ) : (
            <>
              <h2 className="section-heading !mb-0">{icon} {title}</h2>
              {onTitleChange && (
                <button className="text-gray-300 hover:text-violet-400 transition-colors ml-1" onClick={() => { setDraft(title); setEditing(true); }} title="Rename section">
                  <Pencil size={12} />
                </button>
              )}
            </>
          )}
        </div>
        {onAdd && (
          <button className="btn-secondary btn-sm" onClick={onAdd}>
            <Plus size={13} /> Add
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

interface FieldProps {
  label: string;
  value: string | undefined;
  onChange: (v: string) => void;
  placeholder: string;
}

function Field({ label, value, onChange, placeholder }: FieldProps) {
  return (
    <div>
      <label className="field-label">{label}</label>
      <input className="field-input" value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

interface EditableSectionTitleProps {
  icon: string;
  value: string;
  onCommit: (newTitle: string) => void;
}

function EditableSectionTitle({ icon, value, onCommit }: EditableSectionTitleProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onCommit(trimmed);
    else setDraft(value);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          autoFocus
          className="field-input !py-0.5 !h-7 !text-sm font-semibold w-40"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value); setEditing(false); } }}
        />
        <button className="text-emerald-500 hover:text-emerald-600" onMouseDown={e => { e.preventDefault(); commit(); }}><Check size={14} /></button>
        <button className="text-gray-400 hover:text-gray-600" onMouseDown={e => { e.preventDefault(); setDraft(value); setEditing(false); }}><X size={14} /></button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <h2 className="section-heading !mb-0">{icon} {value}</h2>
      <button
        className="text-gray-300 hover:text-violet-400 transition-colors ml-1"
        onClick={e => { e.preventDefault(); setDraft(value); setEditing(true); }}
        title="Rename section"
      >
        <Pencil size={12} />
      </button>
    </div>
  );
}
