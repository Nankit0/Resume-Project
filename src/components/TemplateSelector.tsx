import { X, Check } from 'lucide-react';
import type { Profile, PDFOverrides } from '../types';
import {
  generateResumePDF,
  generateATSResumePDF,
  generateModernResumePDF,
  generateSkillsFirstResumePDF,
  generateExecutiveResumePDF,
  type TemplateId,
} from '../utils/pdfGenerator';

interface TemplateInfo {
  id: TemplateId;
  name: string;
  tagline: string;
  description: string;
  atsScore: 'Excellent' | 'Good' | 'Poor';
  atsColor: string;
  companies: string;
  preview: React.ReactNode;
}

const TEMPLATES: TemplateInfo[] = [
  {
    id: 'classic',
    name: 'Classic',
    tagline: 'Centered header · accent color sections',
    description: 'Polished look with violet-accented section headers. Great for service companies and consulting.',
    atsScore: 'Good',
    atsColor: 'text-amber-600',
    companies: 'TCS, Infosys, Wipro, Accenture, Deloitte',
    preview: <ClassicPreview />,
  },
  {
    id: 'ats',
    name: 'ATS Optimized',
    tagline: 'Left-aligned · zero decoration · max ATS score',
    description: 'Plain black text, no colors. Engineered to pass every Applicant Tracking System used by FAANG.',
    atsScore: 'Excellent',
    atsColor: 'text-emerald-600',
    companies: 'Google, Microsoft, Amazon, Meta, Apple, Netflix',
    preview: <ATSPreview />,
  },
  {
    id: 'skills-first',
    name: 'Skills First',
    tagline: 'Skills at top · keyword-dense · ATS-friendly',
    description: 'Puts Technical Skills before Experience — maximizes keyword density at the top where ATS scanners weight it most.',
    atsScore: 'Excellent',
    atsColor: 'text-emerald-600',
    companies: 'Amazon, Microsoft, Flipkart, data science & engineering roles',
    preview: <SkillsFirstPreview />,
  },
  {
    id: 'executive',
    name: 'Executive',
    tagline: 'Harvard style · centered name · formal',
    description: 'Centered name with double ruling line. Formal and authoritative — the standard for consulting firms and investment banks.',
    atsScore: 'Excellent',
    atsColor: 'text-emerald-600',
    companies: 'McKinsey, BCG, Goldman Sachs, JPMorgan, IBM, Oracle',
    preview: <ExecutivePreview />,
  },
  {
    id: 'modern',
    name: 'Modern',
    tagline: 'Sidebar layout · visually distinct',
    description: 'Colored sidebar with skills & education, main column for experience. Stands out in a stack — but avoid for ATS-heavy pipelines.',
    atsScore: 'Poor',
    atsColor: 'text-red-500',
    companies: 'Figma, Notion, Linear, Vercel, early-stage startups',
    preview: <ModernPreview />,
  },
];

interface Props {
  profile: Profile;
  overrides?: PDFOverrides;
  isJDContext?: boolean;
  onClose: () => void;
}

export default function TemplateSelector({ profile, overrides = {}, isJDContext = false, onClose }: Props) {
  const handleSelect = (id: TemplateId) => {
    if (id === 'classic')      generateResumePDF(profile, overrides);
    else if (id === 'ats')     generateATSResumePDF(profile, overrides);
    else if (id === 'modern')  generateModernResumePDF(profile, overrides);
    else if (id === 'skills-first') generateSkillsFirstResumePDF(profile, overrides);
    else if (id === 'executive')    generateExecutiveResumePDF(profile, overrides);
    onClose();
  };

  const recommendedId: TemplateId = isJDContext ? 'ats' : 'ats';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-[980px] max-h-[93vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="font-serif text-xl text-gray-900">Choose a Resume Template</h2>
            {isJDContext ? (
              <p className="text-xs text-violet-600 mt-0.5 font-medium">
                For product/tech company applications, ATS Optimized or Skills First are strongly recommended.
              </p>
            ) : (
              <p className="text-xs text-gray-400 mt-0.5">
                Click any template to download your PDF instantly
              </p>
            )}
          </div>
          <button className="btn-ghost p-2 -mt-1 -mr-1" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Template cards — 5 items in a responsive grid */}
        <div className="p-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {TEMPLATES.map(t => {
            const isRecommended = isJDContext && t.id === recommendedId;
            return (
              <button
                key={t.id}
                onClick={() => handleSelect(t.id)}
                className={`group text-left border-2 rounded-xl p-3 transition-all hover:shadow-lg focus:outline-none ${
                  isRecommended
                    ? 'border-violet-500 bg-violet-50 ring-2 ring-violet-200'
                    : 'border-gray-200 hover:border-violet-300 bg-white'
                }`}
              >
                {/* Recommended badge */}
                {isRecommended && (
                  <div className="mb-1.5">
                    <span className="inline-flex items-center gap-1 text-[10px] bg-violet-600 text-white px-1.5 py-0.5 rounded-full font-medium">
                      <Check size={9} /> Recommended
                    </span>
                  </div>
                )}

                {/* SVG mini-preview */}
                <div className="rounded-md overflow-hidden border border-gray-100 mb-2.5 shadow-sm group-hover:shadow-md transition-shadow bg-white">
                  {t.preview}
                </div>

                {/* Info */}
                <div className="font-semibold text-xs text-gray-900 mb-0.5">{t.name}</div>
                <div className="text-[10px] text-gray-400 mb-1.5 leading-snug">{t.tagline}</div>
                <p className="text-[10px] text-gray-500 leading-relaxed mb-2 hidden sm:block">{t.description}</p>

                <div className="space-y-1 text-[10px]">
                  <div className="flex items-center gap-1">
                    <span className="text-gray-400 shrink-0">ATS:</span>
                    <span className={`font-semibold ${t.atsColor}`}>{t.atsScore}</span>
                  </div>
                  <div className="text-gray-500 leading-snug">{t.companies}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Bottom tip */}
        <div className="px-5 pb-5">
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-[11px] text-blue-800 leading-relaxed">
            <strong>For big tech & product companies (Google, Amazon, Microsoft, Meta):</strong> Use <strong>ATS Optimized</strong> or <strong>Skills First</strong> — their automated screening systems parse plain text only and ignore colors/graphics. <strong>Executive</strong> is the top choice for consulting (McKinsey, BCG) and investment banking (Goldman Sachs, JPMorgan). Save <strong>Modern</strong> for startups where a human reads every resume.
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SVG Mini Preview Components ───
// All previews use viewBox="0 0 210 280" (A4-proportioned, 3:4 ratio)
// They show realistic dummy content so the user can see the actual layout.

const F = 'Helvetica, Arial, sans-serif'; // font shorthand

function ClassicPreview() {
  const ac = '#7C3AED';
  return (
    <svg viewBox="0 0 210 275" xmlns="http://www.w3.org/2000/svg" className="w-full">
      <rect width="210" height="275" fill="white" />
      {/* Name – centered */}
      <text x="105" y="16" textAnchor="middle" fontFamily={F} fontSize="12" fontWeight="bold" fill="#111">Alex Johnson</text>
      <text x="105" y="23" textAnchor="middle" fontFamily={F} fontSize="5" fill="#666">alex@email.com  •  +91 98765 43210  •  linkedin.com/in/alexj</text>
      <line x1="10" y1="27" x2="200" y2="27" stroke={ac} strokeWidth="0.7" />

      {/* SUMMARY */}
      <text x="10" y="36" fontFamily={F} fontSize="6.5" fontWeight="bold" fill={ac}>SUMMARY</text>
      <line x1="10" y1="38" x2="200" y2="38" stroke={ac} strokeWidth="0.3" />
      <text x="10" y="46" fontFamily={F} fontSize="5" fill="#555">Full-stack engineer with 5+ years building scalable</text>
      <text x="10" y="52" fontFamily={F} fontSize="5" fill="#555">web applications. Expert in React and Node.js.</text>

      {/* WORK EXPERIENCE */}
      <text x="10" y="63" fontFamily={F} fontSize="6.5" fontWeight="bold" fill={ac}>WORK EXPERIENCE</text>
      <line x1="10" y1="65" x2="200" y2="65" stroke={ac} strokeWidth="0.3" />
      <text x="10" y="73" fontFamily={F} fontSize="6" fontWeight="bold" fill="#111">Software Engineer, TechCorp</text>
      <text x="200" y="73" textAnchor="end" fontFamily={F} fontSize="4.5" fill="#999">2021 – Present</text>
      <text x="12" y="80" fontFamily={F} fontSize="4.5" fill="#666">• Led redesign cutting load time by 40%</text>
      <text x="12" y="86" fontFamily={F} fontSize="4.5" fill="#666">• Architected microservices serving 2M users</text>
      <text x="12" y="92" fontFamily={F} fontSize="4.5" fill="#666">• Mentored 4 junior engineers</text>
      <text x="10" y="100" fontFamily={F} fontSize="6" fontWeight="bold" fill="#111">Frontend Dev, StartupCo</text>
      <text x="200" y="100" textAnchor="end" fontFamily={F} fontSize="4.5" fill="#999">2019 – 2021</text>
      <text x="12" y="107" fontFamily={F} fontSize="4.5" fill="#666">• Built React dashboard used by 10k+ daily users</text>
      <text x="12" y="113" fontFamily={F} fontSize="4.5" fill="#666">• Integrated 12 REST APIs and GraphQL endpoints</text>

      {/* TECHNICAL SKILLS */}
      <text x="10" y="124" fontFamily={F} fontSize="6.5" fontWeight="bold" fill={ac}>TECHNICAL SKILLS</text>
      <line x1="10" y1="126" x2="200" y2="126" stroke={ac} strokeWidth="0.3" />
      <text x="10" y="134" fontFamily={F} fontSize="5" fill="#555"><tspan fontWeight="bold">Languages:</tspan> JavaScript, TypeScript, Python</text>
      <text x="10" y="141" fontFamily={F} fontSize="5" fill="#555"><tspan fontWeight="bold">Frameworks:</tspan> React, Node.js, Express, Django</text>
      <text x="10" y="148" fontFamily={F} fontSize="5" fill="#555"><tspan fontWeight="bold">Tools:</tspan> Git, Docker, AWS, PostgreSQL, Redis</text>

      {/* EDUCATION */}
      <text x="10" y="159" fontFamily={F} fontSize="6.5" fontWeight="bold" fill={ac}>EDUCATION</text>
      <line x1="10" y1="161" x2="200" y2="161" stroke={ac} strokeWidth="0.3" />
      <text x="10" y="169" fontFamily={F} fontSize="6" fontWeight="bold" fill="#111">B.Tech Computer Science</text>
      <text x="200" y="169" textAnchor="end" fontFamily={F} fontSize="4.5" fill="#999">2015 – 2019</text>
      <text x="10" y="176" fontFamily={F} fontSize="5" fill="#666">State University of Engineering, Delhi</text>

      {/* PROJECTS */}
      <text x="10" y="187" fontFamily={F} fontSize="6.5" fontWeight="bold" fill={ac}>PROJECTS</text>
      <line x1="10" y1="189" x2="200" y2="189" stroke={ac} strokeWidth="0.3" />
      <text x="10" y="197" fontFamily={F} fontSize="6" fontWeight="bold" fill="#111">E-Commerce Platform</text>
      <text x="200" y="197" textAnchor="end" fontFamily={F} fontSize="4.5" fill="#999" fontStyle="italic">React, Node, MongoDB</text>
      <text x="10" y="204" fontFamily={F} fontSize="4.5" fill="#666">Full-stack marketplace with payment integration</text>
      <text x="10" y="210" fontFamily={F} fontSize="4.5" fill="#666">and real-time inventory management for 500+ SKUs.</text>
    </svg>
  );
}

function ATSPreview() {
  return (
    <svg viewBox="0 0 210 275" xmlns="http://www.w3.org/2000/svg" className="w-full">
      <rect width="210" height="275" fill="white" />
      {/* Name – left-aligned */}
      <text x="10" y="16" fontFamily={F} fontSize="13" fontWeight="bold" fill="#0a0a0a">Alex Johnson</text>
      <text x="10" y="24" fontFamily={F} fontSize="5" fill="#444">alex@email.com  |  +91 98765 43210  |  linkedin.com/in/alexj  |  Delhi</text>
      <line x1="10" y1="28" x2="200" y2="28" stroke="#111" strokeWidth="0.9" />

      {/* SUMMARY */}
      <text x="10" y="37" fontFamily={F} fontSize="6.5" fontWeight="bold" fill="#0a0a0a">SUMMARY</text>
      <line x1="10" y1="39" x2="200" y2="39" stroke="#555" strokeWidth="0.35" />
      <text x="10" y="47" fontFamily={F} fontSize="5" fill="#444">Full-stack engineer with 5+ years building scalable web</text>
      <text x="10" y="53" fontFamily={F} fontSize="5" fill="#444">applications. Expert in React, Node.js, and cloud infra.</text>

      {/* WORK EXPERIENCE */}
      <text x="10" y="64" fontFamily={F} fontSize="6.5" fontWeight="bold" fill="#0a0a0a">WORK EXPERIENCE</text>
      <line x1="10" y1="66" x2="200" y2="66" stroke="#555" strokeWidth="0.35" />
      <text x="10" y="74" fontFamily={F} fontSize="6" fontWeight="bold" fill="#0a0a0a">Software Engineer</text>
      <text x="200" y="74" textAnchor="end" fontFamily={F} fontSize="4.5" fill="#555">2021 – Present</text>
      <text x="10" y="80" fontFamily={F} fontSize="5" fontStyle="italic" fill="#444">TechCorp Inc.</text>
      <text x="12" y="88" fontFamily={F} fontSize="4.5" fill="#555">• Reduced page load time 40% via code-splitting</text>
      <text x="12" y="94" fontFamily={F} fontSize="4.5" fill="#555">• Architected microservices handling 2M+ requests/day</text>
      <text x="12" y="100" fontFamily={F} fontSize="4.5" fill="#555">• Led team of 5 engineers across 3 product squads</text>
      <text x="10" y="108" fontFamily={F} fontSize="6" fontWeight="bold" fill="#0a0a0a">Frontend Developer</text>
      <text x="200" y="108" textAnchor="end" fontFamily={F} fontSize="4.5" fill="#555">2019 – 2021</text>
      <text x="10" y="114" fontFamily={F} fontSize="5" fontStyle="italic" fill="#444">StartupCo</text>
      <text x="12" y="122" fontFamily={F} fontSize="4.5" fill="#555">• Built dashboard adopted by 10k active daily users</text>
      <text x="12" y="128" fontFamily={F} fontSize="4.5" fill="#555">• Integrated REST APIs reducing dev time by 30%</text>

      {/* TECHNICAL SKILLS */}
      <text x="10" y="139" fontFamily={F} fontSize="6.5" fontWeight="bold" fill="#0a0a0a">TECHNICAL SKILLS</text>
      <line x1="10" y1="141" x2="200" y2="141" stroke="#555" strokeWidth="0.35" />
      <text x="10" y="149" fontFamily={F} fontSize="5" fill="#444"><tspan fontWeight="bold">Languages:</tspan> JavaScript, TypeScript, Python, SQL</text>
      <text x="10" y="156" fontFamily={F} fontSize="5" fill="#444"><tspan fontWeight="bold">Frameworks:</tspan> React, Node.js, Express, Django</text>
      <text x="10" y="163" fontFamily={F} fontSize="5" fill="#444"><tspan fontWeight="bold">Tools:</tspan> Git, Docker, AWS, PostgreSQL, Redis</text>

      {/* EDUCATION */}
      <text x="10" y="174" fontFamily={F} fontSize="6.5" fontWeight="bold" fill="#0a0a0a">EDUCATION</text>
      <line x1="10" y1="176" x2="200" y2="176" stroke="#555" strokeWidth="0.35" />
      <text x="10" y="184" fontFamily={F} fontSize="6" fontWeight="bold" fill="#0a0a0a">B.Tech Computer Science</text>
      <text x="200" y="184" textAnchor="end" fontFamily={F} fontSize="4.5" fill="#555">2015 – 2019</text>
      <text x="10" y="191" fontFamily={F} fontSize="5" fontStyle="italic" fill="#444">State University of Engineering, Delhi</text>
    </svg>
  );
}

function SkillsFirstPreview() {
  return (
    <svg viewBox="0 0 210 275" xmlns="http://www.w3.org/2000/svg" className="w-full">
      <rect width="210" height="275" fill="white" />
      {/* Name */}
      <text x="10" y="16" fontFamily={F} fontSize="13" fontWeight="bold" fill="#0a0a0a">Alex Johnson</text>
      <text x="10" y="24" fontFamily={F} fontSize="5" fill="#444">alex@email.com  |  +91 98765 43210  |  linkedin.com/in/alexj</text>
      <line x1="10" y1="28" x2="200" y2="28" stroke="#111" strokeWidth="0.9" />

      {/* SUMMARY */}
      <text x="10" y="37" fontFamily={F} fontSize="6.5" fontWeight="bold" fill="#0a0a0a">PROFESSIONAL SUMMARY</text>
      <line x1="10" y1="39" x2="200" y2="39" stroke="#555" strokeWidth="0.35" />
      <text x="10" y="47" fontFamily={F} fontSize="5" fill="#444">Full-stack engineer with 5+ years of experience in</text>
      <text x="10" y="53" fontFamily={F} fontSize="5" fill="#444">scalable systems, APIs, and cloud-native architecture.</text>

      {/* TECHNICAL SKILLS — appears before Experience */}
      <text x="10" y="64" fontFamily={F} fontSize="6.5" fontWeight="bold" fill="#0a0a0a">TECHNICAL SKILLS</text>
      <line x1="10" y1="66" x2="200" y2="66" stroke="#555" strokeWidth="0.35" />
      <text x="10" y="74" fontFamily={F} fontSize="5" fill="#444"><tspan fontWeight="bold">Languages:</tspan> JavaScript, TypeScript, Python, Go, SQL</text>
      <text x="10" y="81" fontFamily={F} fontSize="5" fill="#444"><tspan fontWeight="bold">Frameworks:</tspan> React, Node.js, Express, FastAPI</text>
      <text x="10" y="88" fontFamily={F} fontSize="5" fill="#444"><tspan fontWeight="bold">Cloud/DevOps:</tspan> AWS, GCP, Docker, Kubernetes, CI/CD</text>
      <text x="10" y="95" fontFamily={F} fontSize="5" fill="#444"><tspan fontWeight="bold">Databases:</tspan> PostgreSQL, MongoDB, Redis, DynamoDB</text>

      {/* WORK EXPERIENCE — below skills */}
      <text x="10" y="107" fontFamily={F} fontSize="6.5" fontWeight="bold" fill="#0a0a0a">WORK EXPERIENCE</text>
      <line x1="10" y1="109" x2="200" y2="109" stroke="#555" strokeWidth="0.35" />
      <text x="10" y="117" fontFamily={F} fontSize="6" fontWeight="bold" fill="#0a0a0a">Senior Software Engineer</text>
      <text x="200" y="117" textAnchor="end" fontFamily={F} fontSize="4.5" fill="#555">2021 – Present</text>
      <text x="10" y="123" fontFamily={F} fontSize="5" fontStyle="italic" fill="#444">TechCorp Inc.</text>
      <text x="12" y="131" fontFamily={F} fontSize="4.5" fill="#555">• Designed distributed caching reducing DB load 60%</text>
      <text x="12" y="137" fontFamily={F} fontSize="4.5" fill="#555">• Delivered 8 product features across 3 quarters</text>
      <text x="12" y="143" fontFamily={F} fontSize="4.5" fill="#555">• Introduced code review standards adopted team-wide</text>
      <text x="10" y="151" fontFamily={F} fontSize="6" fontWeight="bold" fill="#0a0a0a">Frontend Developer</text>
      <text x="200" y="151" textAnchor="end" fontFamily={F} fontSize="4.5" fill="#555">2019 – 2021</text>
      <text x="10" y="157" fontFamily={F} fontSize="5" fontStyle="italic" fill="#444">StartupCo</text>
      <text x="12" y="165" fontFamily={F} fontSize="4.5" fill="#555">• Built real-time analytics dashboard (10k+ DAU)</text>
      <text x="12" y="171" fontFamily={F} fontSize="4.5" fill="#555">• Reduced bundle size 35% with tree-shaking</text>

      {/* EDUCATION */}
      <text x="10" y="183" fontFamily={F} fontSize="6.5" fontWeight="bold" fill="#0a0a0a">EDUCATION</text>
      <line x1="10" y1="185" x2="200" y2="185" stroke="#555" strokeWidth="0.35" />
      <text x="10" y="193" fontFamily={F} fontSize="6" fontWeight="bold" fill="#0a0a0a">B.Tech Computer Science</text>
      <text x="200" y="193" textAnchor="end" fontFamily={F} fontSize="4.5" fill="#555">2015 – 2019</text>
      <text x="10" y="200" fontFamily={F} fontSize="5" fontStyle="italic" fill="#444">State University of Engineering, Delhi</text>
    </svg>
  );
}

function ExecutivePreview() {
  return (
    <svg viewBox="0 0 210 275" xmlns="http://www.w3.org/2000/svg" className="w-full">
      <rect width="210" height="275" fill="white" />
      {/* Name – centered, all caps */}
      <text x="105" y="17" textAnchor="middle" fontFamily={F} fontSize="13" fontWeight="bold" fill="#050505">ALEX JOHNSON</text>
      <text x="105" y="24" textAnchor="middle" fontFamily={F} fontSize="5" fill="#555">alex@email.com   |   +91 98765 43210   |   linkedin.com/in/alexj</text>
      {/* Double rule */}
      <line x1="12" y1="28" x2="198" y2="28" stroke="#050505" strokeWidth="1.1" />
      <line x1="12" y1="30" x2="198" y2="30" stroke="#050505" strokeWidth="0.3" />

      {/* PROFESSIONAL EXPERIENCE */}
      <text x="12" y="40" fontFamily={F} fontSize="6.5" fontWeight="bold" fill="#050505">PROFESSIONAL EXPERIENCE</text>
      <line x1="12" y1="42" x2="198" y2="42" stroke="#050505" strokeWidth="0.5" />
      <text x="12" y="51" fontFamily={F} fontSize="6.5" fontWeight="bold" fill="#050505">Senior Software Engineer</text>
      <text x="198" y="51" textAnchor="end" fontFamily={F} fontSize="5" fill="#444">2021 – Present</text>
      <text x="14" y="58" fontFamily={F} fontSize="5.5" fontStyle="italic" fill="#555">TechCorp Inc., Bangalore</text>
      <text x="16" y="66" fontFamily={F} fontSize="4.5" fill="#555">• Reduced system latency 40% via distributed caching</text>
      <text x="16" y="72" fontFamily={F} fontSize="4.5" fill="#555">• Architected API gateway serving 2M+ requests daily</text>
      <text x="16" y="78" fontFamily={F} fontSize="4.5" fill="#555">• Managed cross-functional team of 6 engineers</text>
      <text x="12" y="87" fontFamily={F} fontSize="6.5" fontWeight="bold" fill="#050505">Software Engineer</text>
      <text x="198" y="87" textAnchor="end" fontFamily={F} fontSize="5" fill="#444">2019 – 2021</text>
      <text x="14" y="94" fontFamily={F} fontSize="5.5" fontStyle="italic" fill="#555">StartupCo, Delhi</text>
      <text x="16" y="102" fontFamily={F} fontSize="4.5" fill="#555">• Delivered analytics platform growing to 10k DAU</text>
      <text x="16" y="108" fontFamily={F} fontSize="4.5" fill="#555">• Optimized queries reducing DB cost by 25%</text>

      {/* EDUCATION */}
      <text x="12" y="120" fontFamily={F} fontSize="6.5" fontWeight="bold" fill="#050505">EDUCATION</text>
      <line x1="12" y1="122" x2="198" y2="122" stroke="#050505" strokeWidth="0.5" />
      <text x="12" y="131" fontFamily={F} fontSize="6.5" fontWeight="bold" fill="#050505">B.Tech Computer Science</text>
      <text x="198" y="131" textAnchor="end" fontFamily={F} fontSize="5" fill="#444">2015 – 2019</text>
      <text x="14" y="138" fontFamily={F} fontSize="5.5" fontStyle="italic" fill="#555">State University of Engineering, Delhi</text>

      {/* CORE COMPETENCIES */}
      <text x="12" y="150" fontFamily={F} fontSize="6.5" fontWeight="bold" fill="#050505">CORE COMPETENCIES</text>
      <line x1="12" y1="152" x2="198" y2="152" stroke="#050505" strokeWidth="0.5" />
      <text x="12" y="160" fontFamily={F} fontSize="5" fill="#555"><tspan fontWeight="bold">Languages:</tspan> JavaScript, TypeScript, Python, Go</text>
      <text x="12" y="167" fontFamily={F} fontSize="5" fill="#555"><tspan fontWeight="bold">Frameworks:</tspan> React, Node.js, Express, FastAPI</text>
      <text x="12" y="174" fontFamily={F} fontSize="5" fill="#555"><tspan fontWeight="bold">Platforms:</tspan> AWS, GCP, Docker, Kubernetes, CI/CD</text>
    </svg>
  );
}

function ModernPreview() {
  const ac = '#7C3AED';
  const bgL = '#f5f3ff';
  return (
    <svg viewBox="0 0 210 275" xmlns="http://www.w3.org/2000/svg" className="w-full">
      <rect width="210" height="275" fill="white" />
      {/* Sidebar background */}
      <rect width="72" height="275" fill={bgL} />
      {/* Header band — full width */}
      <rect width="210" height="30" fill={ac} />
      {/* Name in header */}
      <text x="10" y="14" fontFamily={F} fontSize="10" fontWeight="bold" fill="white">Alex Johnson</text>
      <text x="10" y="22" fontFamily={F} fontSize="4.5" fill="#d8b4fe">alex@email.com  •  +91 98765 43210</text>

      {/* LEFT SIDEBAR content (below header) */}
      {/* SKILLS */}
      <text x="8" y="42" fontFamily={F} fontSize="5.5" fontWeight="bold" fill={ac}>SKILLS</text>
      <line x1="8" y1="44" x2="68" y2="44" stroke={ac} strokeWidth="0.3" />
      <text x="8" y="52" fontFamily={F} fontSize="4.5" fontWeight="bold" fill="#222">Languages</text>
      <text x="8" y="58" fontFamily={F} fontSize="4" fill="#555">JS, TS, Python, Go</text>
      <text x="8" y="66" fontFamily={F} fontSize="4.5" fontWeight="bold" fill="#222">Frameworks</text>
      <text x="8" y="72" fontFamily={F} fontSize="4" fill="#555">React, Node.js</text>
      <text x="8" y="78" fontFamily={F} fontSize="4" fill="#555">Express, FastAPI</text>
      <text x="8" y="86" fontFamily={F} fontSize="4.5" fontWeight="bold" fill="#222">Cloud / DevOps</text>
      <text x="8" y="92" fontFamily={F} fontSize="4" fill="#555">AWS, Docker, CI/CD</text>
      <text x="8" y="98" fontFamily={F} fontSize="4" fill="#555">Kubernetes, Redis</text>

      {/* EDUCATION */}
      <text x="8" y="112" fontFamily={F} fontSize="5.5" fontWeight="bold" fill={ac}>EDUCATION</text>
      <line x1="8" y1="114" x2="68" y2="114" stroke={ac} strokeWidth="0.3" />
      <text x="8" y="122" fontFamily={F} fontSize="4.5" fontWeight="bold" fill="#222">B.Tech CS</text>
      <text x="8" y="128" fontFamily={F} fontSize="4" fill="#555">State Univ. Engg.</text>
      <text x="8" y="134" fontFamily={F} fontSize="4" fill="#555">2015 – 2019</text>

      {/* RIGHT MAIN COLUMN */}
      {/* SUMMARY */}
      <text x="80" y="42" fontFamily={F} fontSize="6" fontWeight="bold" fill={ac}>SUMMARY</text>
      <line x1="80" y1="44" x2="202" y2="44" stroke={ac} strokeWidth="0.3" />
      <text x="80" y="52" fontFamily={F} fontSize="4.5" fill="#555">Full-stack engineer with 5+ years building</text>
      <text x="80" y="58" fontFamily={F} fontSize="4.5" fill="#555">scalable web apps. React & Node.js expert.</text>

      {/* WORK EXPERIENCE */}
      <text x="80" y="70" fontFamily={F} fontSize="6" fontWeight="bold" fill={ac}>WORK EXPERIENCE</text>
      <line x1="80" y1="72" x2="202" y2="72" stroke={ac} strokeWidth="0.3" />
      <text x="80" y="80" fontFamily={F} fontSize="5.5" fontWeight="bold" fill="#111">Software Engineer</text>
      <text x="202" y="80" textAnchor="end" fontFamily={F} fontSize="4" fill="#999">2021–Present</text>
      <text x="80" y="86" fontFamily={F} fontSize="5" fontStyle="italic" fill={ac}>TechCorp Inc.</text>
      <text x="82" y="93" fontFamily={F} fontSize="4.5" fill="#666">• Load time cut 40% via optimization</text>
      <text x="82" y="99" fontFamily={F} fontSize="4.5" fill="#666">• Microservices for 2M+ daily requests</text>
      <text x="82" y="105" fontFamily={F} fontSize="4.5" fill="#666">• Led team of 5 across 3 squads</text>
      <text x="80" y="113" fontFamily={F} fontSize="5.5" fontWeight="bold" fill="#111">Frontend Dev</text>
      <text x="202" y="113" textAnchor="end" fontFamily={F} fontSize="4" fill="#999">2019–2021</text>
      <text x="80" y="119" fontFamily={F} fontSize="5" fontStyle="italic" fill={ac}>StartupCo</text>
      <text x="82" y="127" fontFamily={F} fontSize="4.5" fill="#666">• Dashboard with 10k+ daily active users</text>
      <text x="82" y="133" fontFamily={F} fontSize="4.5" fill="#666">• Integrated REST APIs & GraphQL</text>

      {/* PROJECTS */}
      <text x="80" y="145" fontFamily={F} fontSize="6" fontWeight="bold" fill={ac}>PROJECTS</text>
      <line x1="80" y1="147" x2="202" y2="147" stroke={ac} strokeWidth="0.3" />
      <text x="80" y="155" fontFamily={F} fontSize="5.5" fontWeight="bold" fill="#111">E-Commerce Platform</text>
      <text x="202" y="155" textAnchor="end" fontFamily={F} fontSize="4" fontStyle="italic" fill="#999">React, Node, MongoDB</text>
      <text x="80" y="162" fontFamily={F} fontSize="4.5" fill="#666">Full-stack marketplace with payments</text>
      <text x="80" y="168" fontFamily={F} fontSize="4.5" fill="#666">and real-time inventory for 500+ SKUs.</text>
    </svg>
  );
}
