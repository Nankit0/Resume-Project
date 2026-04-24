import jsPDF from 'jspdf';
import type { Profile, PDFOverrides } from '../types';

export type TemplateId = 'classic' | 'ats' | 'modern' | 'skills-first' | 'executive';

interface RGB {
  r: number;
  g: number;
  b: number;
}

export function generateResumePDF(profile: Profile, overrides: PDFOverrides = {}): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const accent = hexToRgb(overrides.accentColor || profile.accentColor || '#7C3AED');
  const pageW = 210;
  const margin = 18;
  const contentW = pageW - margin * 2;
  let y = 18;

  const setAccent = () => doc.setTextColor(accent.r, accent.g, accent.b);
  const setDark = () => doc.setTextColor(17, 24, 39);
  const setGray = () => doc.setTextColor(75, 85, 99);
  const setLightGray = () => doc.setTextColor(107, 114, 128);

  // ── Header ──
  setDark();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  const name = overrides.name || profile.personal?.name || 'Name';
  doc.text(name, pageW / 2, y, { align: 'center' });
  y += 8;

  // Contact line
  const p = profile.personal || {} as Profile['personal'];
  const parts = [p.email, p.phone, p.linkedin, p.portfolio].filter(Boolean) as string[];
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  setGray();
  const sep = '  •  ';
  const contactText = parts.join(sep);
  doc.text(contactText, pageW / 2, y, { align: 'center' });
  // Clickable hyperlinks for linkedin and portfolio
  {
    const totalW = doc.getTextWidth(contactText);
    const sepW = doc.getTextWidth(sep);
    let lx = (pageW - totalW) / 2;
    parts.forEach((part, i) => {
      const pw = doc.getTextWidth(part);
      if (part && (part === p.linkedin || part === p.portfolio)) {
        doc.link(lx, y - 3.5, pw, 4.5, { url: normalizeUrl(part) });
      }
      lx += pw;
      if (i < parts.length - 1) lx += sepW;
    });
  }
  y += 2;

  // Accent line
  doc.setDrawColor(accent.r, accent.g, accent.b);
  doc.setLineWidth(0.5);
  doc.line(margin, y + 2, pageW - margin, y + 2);
  y += 7;

  const checkPage = () => {
    if (y > 270) { doc.addPage(); y = 18; }
  };

  const drawSection = (title: string) => {
    checkPage();
    setAccent();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(title.toUpperCase(), margin, y);
    y += 1;
    doc.setDrawColor(accent.r, accent.g, accent.b);
    doc.setLineWidth(0.3);
    doc.line(margin, y + 1, pageW - margin, y + 1);
    y += 5;
    setDark();
  };

  const wrapText = (text: string, maxW: number, fontSize = 9.5): string[] => {
    doc.setFontSize(fontSize);
    return doc.splitTextToSize(text, maxW) as string[];
  };

  const addBullet = (text: string) => {
    checkPage();
    const lines = wrapText('• ' + text, contentW - 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    setGray();
    lines.forEach((line: string, i: number) => {
      doc.text(i === 0 ? line : '  ' + line.trimStart(), margin + 2, y);
      y += 4.5;
      checkPage();
    });
  };

  // ── Summary ──
  const about = overrides.about || profile.about;
  if (about?.trim()) {
    drawSection('Summary');
    const lines = wrapText(about, contentW);
    doc.setFont('helvetica', 'normal');
    setGray();
    lines.forEach((line: string) => { checkPage(); doc.text(line, margin, y); y += 4.5; });
    y += 3;
  }

  // ── Experience ──
  const experience = (overrides.experience || profile.experience || [])
    .filter(e => e.role?.trim() || e.company?.trim());
  if (experience.length > 0) {
    drawSection('Work Experience');
    experience.forEach(exp => {
      checkPage();
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      setDark();
      const roleText = `${exp.role}, ${exp.company}`;
      const dateText = `${exp.startDate} - ${exp.endDate}`;
      doc.text(roleText, margin, y);
      setLightGray();
      doc.setFontSize(9.5);
      doc.text(dateText, pageW - margin, y, { align: 'right' });
      y += 5;
      const bullets = exp.bullets || [];
      bullets.forEach(b => addBullet(b));
      y += 2;
    });
  }

  // ── Education ──
  const education = (profile.education || []).filter(e => e.degree?.trim() || e.institution?.trim());
  if (education.length > 0) {
    drawSection('Education');
    education.forEach(edu => {
      checkPage();
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      setDark();
      doc.text(edu.degree, margin, y);
      setLightGray();
      doc.setFontSize(9.5);
      const dateStr = `${edu.startYear} - ${edu.endYear}`;
      doc.text(dateStr, pageW - margin, y, { align: 'right' });
      y += 5;
      setGray();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.text(edu.institution, margin, y);
      y += 4.5;
      if (edu.description) {
        const lines = wrapText(edu.description, contentW);
        lines.forEach((l: string) => { checkPage(); doc.text(l, margin, y); y += 4.5; });
      }
      y += 2;
    });
  }

  // ── Projects ──
  const allProjects = (overrides.projects || profile.projects || []).filter(p => p.name?.trim());
  const highlightNames = overrides.highlightProjects || null;
  const filteredProjects = highlightNames
    ? allProjects.filter(p => highlightNames.some(n => p.name.toLowerCase().includes(n.toLowerCase())))
    : allProjects;

  if (filteredProjects.length > 0) {
    drawSection('Projects');
    filteredProjects.forEach(proj => {
      checkPage();
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      setDark();
      doc.text(proj.name, margin, y);
      if (proj.techStack) {
        setLightGray();
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        doc.text(proj.techStack, pageW - margin, y, { align: 'right' });
      }
      y += 5;
      if (proj.role) {
        setAccent();
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(`Role: ${proj.role}`, margin, y);
        y += 4;
      }
      if (proj.description) {
        setGray();
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        const lines = wrapText(`Description: ${proj.description}`, contentW);
        lines.forEach((l: string) => { checkPage(); doc.text(l, margin, y); y += 4.5; });
      }
      if (proj.impact) {
        setGray();
        const lines = wrapText(`Impact: ${proj.impact}`, contentW);
        lines.forEach((l: string) => { checkPage(); doc.text(l, margin, y); y += 4.5; });
      }
      y += 2;
    });
  }

  // ── Skills ──
  const skills = overrides.skills || profile.skills || {};
  const skillRatings = profile.skillRatings || {};
  const skillEntries = Object.entries(skills).filter(([, v]) => v?.trim());
  if (skillEntries.length > 0) {
    drawSection('Technical Skills');
    const ratingColW = 22; // reserved width on right for dots
    skillEntries.forEach(([category, value]) => {
      checkPage();
      const rating = skillRatings[category] ?? 0;
      const hasRating = rating > 0;
      const availableW = hasRating ? contentW - ratingColW : contentW;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      setDark();
      doc.text(`${category}: `, margin, y);
      const labelW = doc.getTextWidth(`${category}: `);

      setGray();
      doc.setFont('helvetica', 'normal');
      const valLines = wrapText(value, availableW - labelW - 2);
      valLines.forEach((line: string, i: number) => {
        doc.text(line, margin + labelW, y);
        if (i < valLines.length - 1) { y += 4.5; checkPage(); }
      });

      // Draw rating dots on the same baseline as the first line
      if (hasRating) {
        const dotR = 1.2;
        const dotGap = 3.5;
        const dotsStartX = pageW - margin - (5 * dotGap) + dotGap / 2;
        for (let i = 0; i < 5; i++) {
          const cx = dotsStartX + i * dotGap;
          if (i < rating) {
            doc.setFillColor(accent.r, accent.g, accent.b);
            doc.circle(cx, y - dotR * 0.4, dotR, 'F');
          } else {
            doc.setDrawColor(180, 180, 180);
            doc.setLineWidth(0.3);
            doc.circle(cx, y - dotR * 0.4, dotR, 'S');
          }
        }
      }
      y += 5;
    });
  }

  // ── Certifications ──
  const certs = (profile.certifications || []).filter(c => c?.trim());
  if (certs.length > 0) {
    drawSection(getSectionTitle(profile, 'certifications', 'Certifications'));
    certs.forEach(cert => addBullet(cert));
    y += 2;
  }

  // ── Key Achievements ──
  const keyAchievements = (profile.keyAchievements || []).filter(a => a?.trim());
  if (keyAchievements.length > 0) {
    drawSection(getSectionTitle(profile, 'keyAchievements', 'Key Achievements'));
    keyAchievements.forEach(a => addBullet(a));
    y += 2;
  }

  // ── Interests ──
  const interests = (profile.interests || []).filter(i => i?.trim());
  if (interests.length > 0) {
    drawSection(getSectionTitle(profile, 'interests', 'Interests'));
    const interestLines = wrapText(interests.join(', '), contentW);
    doc.setFont('helvetica', 'normal');
    setGray();
    interestLines.forEach((line: string) => { checkPage(); doc.text(line, margin, y); y += 4.5; });
    y += 2;
  }

  // ── Personal Details ──
  const personalDetails = (profile.personalDetails || []).filter(d => d?.trim());
  if (personalDetails.length > 0) {
    drawSection(getSectionTitle(profile, 'personalDetails', 'Personal Details'));
    personalDetails.forEach(d => addBullet(d));
    y += 2;
  }

  doc.save(`${name.replace(/\s+/g, '_')}_Resume.pdf`);
}

// ─────────────────────────────────────────────────────────────────────────────
// ATS Optimized Template — no color, left-aligned, max ATS compatibility
// Best for: Google, Microsoft, Amazon, Meta, Apple and any ATS-driven pipeline
// ─────────────────────────────────────────────────────────────────────────────
export function generateATSResumePDF(profile: Profile, overrides: PDFOverrides = {}): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = 210;
  const margin = 20;
  const contentW = pageW - margin * 2;
  let y = 22;

  const dark = () => doc.setTextColor(10, 10, 10);
  const gray = () => doc.setTextColor(55, 55, 55);
  const checkPage = () => { if (y > 272) { doc.addPage(); y = 20; } };

  const name = overrides.name || profile.personal?.name || 'Name';

  // Name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  dark();
  doc.text(name, margin, y);
  y += 7;

  // Contact — left-aligned, pipe-separated
  const p = profile.personal || {} as Profile['personal'];
  const contactParts = [p.email, p.phone, p.linkedin, p.portfolio, p.location].filter(Boolean) as string[];
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  gray();
  const atsSep = '  |  ';
  const atsContactText = contactParts.join(atsSep);
  doc.text(atsContactText, margin, y);
  // Clickable hyperlinks for linkedin and portfolio
  {
    const sepW = doc.getTextWidth(atsSep);
    let lx = margin;
    contactParts.forEach((part, i) => {
      const pw = doc.getTextWidth(part);
      if (part && (part === p.linkedin || part === p.portfolio)) {
        doc.link(lx, y - 3.5, pw, 4.5, { url: normalizeUrl(part) });
      }
      lx += pw;
      if (i < contactParts.length - 1) lx += sepW;
    });
  }
  y += 4;

  // Thick rule
  doc.setDrawColor(10, 10, 10);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageW - margin, y);
  y += 7;

  const drawSection = (title: string) => {
    checkPage();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    dark();
    doc.text(title.toUpperCase(), margin, y);
    y += 2;
    doc.setDrawColor(55, 55, 55);
    doc.setLineWidth(0.4);
    doc.line(margin, y, pageW - margin, y);
    y += 5;
  };

  const addBullet = (text: string) => {
    checkPage();
    const lines = doc.splitTextToSize('• ' + text, contentW - 4) as string[];
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    gray();
    lines.forEach((line: string, i: number) => {
      doc.text(i === 0 ? line : '  ' + line.trimStart(), margin + 2, y);
      y += 4.5;
      checkPage();
    });
  };

  // Summary
  const about = overrides.about || profile.about;
  if (about?.trim()) {
    drawSection('Summary');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    gray();
    const lines = doc.splitTextToSize(about, contentW) as string[];
    lines.forEach((l: string) => { checkPage(); doc.text(l, margin, y); y += 4.5; });
    y += 3;
  }

  // Experience
  const experience = (overrides.experience || profile.experience || [])
    .filter(e => e.role?.trim() || e.company?.trim());
  if (experience.length > 0) {
    drawSection('Work Experience');
    experience.forEach(exp => {
      checkPage();
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      dark();
      doc.text(exp.role, margin, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      gray();
      doc.text(`${exp.startDate} – ${exp.endDate}`, pageW - margin, y, { align: 'right' });
      y += 4.5;
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.text(exp.company, margin, y);
      y += 5;
      (exp.bullets || []).forEach(b => addBullet(b));
      y += 2;
    });
  }

  // Education
  const education = (profile.education || []).filter(e => e.degree?.trim() || e.institution?.trim());
  if (education.length > 0) {
    drawSection('Education');
    education.forEach(edu => {
      checkPage();
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      dark();
      doc.text(edu.degree, margin, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      gray();
      doc.text(`${edu.startYear} – ${edu.endYear}`, pageW - margin, y, { align: 'right' });
      y += 4.5;
      doc.setFont('helvetica', 'italic');
      doc.text(edu.institution, margin, y);
      y += 5;
      if (edu.description) {
        doc.setFont('helvetica', 'normal');
        const ls = doc.splitTextToSize(edu.description, contentW) as string[];
        ls.forEach((l: string) => { checkPage(); doc.text(l, margin, y); y += 4.5; });
      }
      y += 2;
    });
  }

  // Projects
  const allProjects = (overrides.projects || profile.projects || []).filter(p => p.name?.trim());
  const highlightNames = overrides.highlightProjects || null;
  const filteredProjects = highlightNames
    ? allProjects.filter(p => highlightNames.some(n => p.name.toLowerCase().includes(n.toLowerCase())))
    : allProjects;
  if (filteredProjects.length > 0) {
    drawSection('Projects');
    filteredProjects.forEach(proj => {
      checkPage();
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      dark();
      doc.text(proj.name, margin, y);
      if (proj.techStack) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        gray();
        doc.text(proj.techStack, pageW - margin, y, { align: 'right' });
      }
      y += 5;
      if (proj.description) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        gray();
        const ls = doc.splitTextToSize(proj.description, contentW) as string[];
        ls.forEach((l: string) => { checkPage(); doc.text(l, margin, y); y += 4.5; });
      }
      if (proj.impact) {
        const ls = doc.splitTextToSize(`Impact: ${proj.impact}`, contentW) as string[];
        ls.forEach((l: string) => { checkPage(); doc.text(l, margin, y); y += 4.5; });
      }
      y += 2;
    });
  }

  // Skills
  const skills = overrides.skills || profile.skills || {};
  const skillEntries = Object.entries(skills).filter(([, v]) => v?.trim());
  if (skillEntries.length > 0) {
    drawSection('Technical Skills');
    skillEntries.forEach(([category, value]) => {
      checkPage();
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      dark();
      const label = `${category}: `;
      doc.text(label, margin, y);
      const labelW = doc.getTextWidth(label);
      doc.setFont('helvetica', 'normal');
      gray();
      const valLines = doc.splitTextToSize(value, contentW - labelW - 2) as string[];
      valLines.forEach((line: string, i: number) => {
        doc.text(line, margin + labelW, y);
        if (i < valLines.length - 1) { y += 4.5; checkPage(); }
      });
      y += 5;
    });
  }

  // Certifications
  const certs = (profile.certifications || []).filter(c => c?.trim());
  if (certs.length > 0) {
    drawSection(getSectionTitle(profile, 'certifications', 'Certifications'));
    certs.forEach(cert => addBullet(cert));
    y += 2;
  }

  // Key Achievements
  const atsKeyAchievements = (profile.keyAchievements || []).filter(a => a?.trim());
  if (atsKeyAchievements.length > 0) {
    drawSection(getSectionTitle(profile, 'keyAchievements', 'Key Achievements'));
    atsKeyAchievements.forEach(a => addBullet(a));
    y += 2;
  }

  // Interests
  const atsInterests = (profile.interests || []).filter(i => i?.trim());
  if (atsInterests.length > 0) {
    drawSection(getSectionTitle(profile, 'interests', 'Interests'));
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    gray();
    const lines = doc.splitTextToSize(atsInterests.join(', '), contentW) as string[];
    lines.forEach((l: string) => { checkPage(); doc.text(l, margin, y); y += 4.5; });
    y += 2;
  }

  // Personal Details
  const atsPersonalDetails = (profile.personalDetails || []).filter(d => d?.trim());
  if (atsPersonalDetails.length > 0) {
    drawSection(getSectionTitle(profile, 'personalDetails', 'Personal Details'));
    atsPersonalDetails.forEach(d => addBullet(d));
    y += 2;
  }

  doc.save(`${name.replace(/\s+/g, '_')}_ATS_Resume.pdf`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Modern Two-Column Template — colored sidebar + main column
// Best for: Startups, design-forward companies (Figma, Notion, Linear, etc.)
// ─────────────────────────────────────────────────────────────────────────────
export function generateModernResumePDF(profile: Profile, overrides: PDFOverrides = {}): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const accent = hexToRgb(overrides.accentColor || profile.accentColor || '#7C3AED');
  const pageW = 210;
  const pageH = 297;
  const leftW = 68;           // sidebar width
  const leftPad = 10;         // inner padding inside sidebar
  const rightX = leftW + 8;   // right column start
  const rightW = pageW - rightX - 10; // right column content width

  const name = overrides.name || profile.personal?.name || 'Name';
  const p = profile.personal || {} as Profile['personal'];

  // ── Draw accent header band (full width) ──
  doc.setFillColor(accent.r, accent.g, accent.b);
  doc.rect(0, 0, pageW, 32, 'F');

  // Name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text(name, leftPad, 16);

  // Contact in header
  const contactParts = [p.email, p.phone, p.linkedin, p.portfolio].filter(Boolean) as string[];
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(220, 205, 255);
  const modernSep = '   •   ';
  const modernContactText = contactParts.join(modernSep);
  doc.text(modernContactText, leftPad, 24);
  // Clickable hyperlinks for linkedin and portfolio
  {
    const sepW = doc.getTextWidth(modernSep);
    let lx = leftPad;
    contactParts.forEach((part, i) => {
      const pw = doc.getTextWidth(part);
      if (part && (part === p.linkedin || part === p.portfolio)) {
        doc.link(lx, 20.5, pw, 4.5, { url: normalizeUrl(part) });
      }
      lx += pw;
      if (i < contactParts.length - 1) lx += sepW;
    });
  }

  // Location on right side of header (portfolio moved to main contact line)
  if (p.location) {
    doc.text(p.location, pageW - 10, 24, { align: 'right' });
  }

  // ── Left sidebar background (below header) ──
  doc.setFillColor(248, 246, 255);
  doc.rect(0, 32, leftW, pageH - 32, 'F');

  let leftY = 42;
  let rightY = 38;

  // ── Left-column helpers ──
  const drawLeftSection = (title: string) => {
    if (leftY > 272) return; // overflow guard — skip rather than add page in sidebar
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(accent.r, accent.g, accent.b);
    doc.text(title.toUpperCase(), leftPad, leftY);
    leftY += 2;
    doc.setDrawColor(accent.r, accent.g, accent.b);
    doc.setLineWidth(0.3);
    doc.line(leftPad, leftY, leftW - 4, leftY);
    leftY += 4.5;
  };

  // ── Right-column helpers ──
  const checkRightPage = () => {
    if (rightY > 272) {
      doc.addPage();
      // Redraw sidebar bg on new page
      doc.setFillColor(248, 246, 255);
      doc.rect(0, 0, leftW, pageH, 'F');
      rightY = 14;
    }
  };

  const drawRightSection = (title: string) => {
    checkRightPage();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(accent.r, accent.g, accent.b);
    doc.text(title.toUpperCase(), rightX, rightY);
    rightY += 1.5;
    doc.setDrawColor(accent.r, accent.g, accent.b);
    doc.setLineWidth(0.3);
    doc.line(rightX, rightY + 0.5, pageW - 10, rightY + 0.5);
    rightY += 5;
    doc.setTextColor(17, 24, 39);
  };

  // ── LEFT: Skills ──
  const skills = overrides.skills || profile.skills || {};
  const skillEntries = Object.entries(skills).filter(([, v]) => v?.trim());
  if (skillEntries.length > 0) {
    drawLeftSection('Skills');
    skillEntries.forEach(([cat, val]) => {
      if (leftY > 272) return;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(40, 40, 40);
      doc.text(cat, leftPad, leftY);
      leftY += 3.5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(80, 80, 80);
      const lines = doc.splitTextToSize(val, leftW - leftPad - 4) as string[];
      lines.forEach((l: string) => { if (leftY < 272) { doc.text(l, leftPad, leftY); leftY += 3.5; } });
      leftY += 1.5;
    });
    leftY += 3;
  }

  // ── LEFT: Education ──
  const education = (profile.education || []).filter(e => e.degree?.trim() || e.institution?.trim());
  if (education.length > 0) {
    drawLeftSection('Education');
    education.forEach(edu => {
      if (leftY > 272) return;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(30, 30, 30);
      const degLines = doc.splitTextToSize(edu.degree, leftW - leftPad - 4) as string[];
      degLines.forEach((l: string) => { if (leftY < 272) { doc.text(l, leftPad, leftY); leftY += 3.5; } });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(80, 80, 80);
      const instLines = doc.splitTextToSize(edu.institution, leftW - leftPad - 4) as string[];
      instLines.forEach((l: string) => { if (leftY < 272) { doc.text(l, leftPad, leftY); leftY += 3.5; } });
      if (leftY < 272) { doc.text(`${edu.startYear} – ${edu.endYear}`, leftPad, leftY); leftY += 5; }
    });
    leftY += 2;
  }

  // ── LEFT: Certifications ──
  const certs = (profile.certifications || []).filter(c => c?.trim());
  if (certs.length > 0) {
    drawLeftSection(getSectionTitle(profile, 'certifications', 'Certifications'));
    certs.forEach(cert => {
      if (leftY > 272) return;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(70, 70, 70);
      const lines = doc.splitTextToSize('• ' + cert, leftW - leftPad - 4) as string[];
      lines.forEach((l: string) => { if (leftY < 272) { doc.text(l, leftPad, leftY); leftY += 3.5; } });
      leftY += 1;
    });
  }

  // ── LEFT: Key Achievements ──
  const modernKeyAch = (profile.keyAchievements || []).filter(a => a?.trim());
  if (modernKeyAch.length > 0) {
    drawLeftSection(getSectionTitle(profile, 'keyAchievements', 'Key Achievements'));
    modernKeyAch.forEach(a => {
      if (leftY > 272) return;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(70, 70, 70);
      const lines = doc.splitTextToSize('• ' + a, leftW - leftPad - 4) as string[];
      lines.forEach((l: string) => { if (leftY < 272) { doc.text(l, leftPad, leftY); leftY += 3.5; } });
      leftY += 1;
    });
  }

  // ── LEFT: Interests ──
  const modernInterests = (profile.interests || []).filter(i => i?.trim());
  if (modernInterests.length > 0) {
    drawLeftSection(getSectionTitle(profile, 'interests', 'Interests'));
    if (leftY < 272) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(70, 70, 70);
      const lines = doc.splitTextToSize(modernInterests.join(', '), leftW - leftPad - 4) as string[];
      lines.forEach((l: string) => { if (leftY < 272) { doc.text(l, leftPad, leftY); leftY += 3.5; } });
    }
    leftY += 2;
  }

  // ── LEFT: Personal Details ──
  const modernPersonalDet = (profile.personalDetails || []).filter(d => d?.trim());
  if (modernPersonalDet.length > 0) {
    drawLeftSection(getSectionTitle(profile, 'personalDetails', 'Personal Details'));
    modernPersonalDet.forEach(d => {
      if (leftY > 272) return;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(70, 70, 70);
      const lines = doc.splitTextToSize(d, leftW - leftPad - 4) as string[];
      lines.forEach((l: string) => { if (leftY < 272) { doc.text(l, leftPad, leftY); leftY += 3.5; } });
      leftY += 1;
    });
  }

  // ── RIGHT: Summary ──
  const about = overrides.about || profile.about;
  if (about?.trim()) {
    drawRightSection('Summary');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(75, 85, 99);
    const lines = doc.splitTextToSize(about, rightW) as string[];
    lines.forEach((l: string) => { checkRightPage(); doc.text(l, rightX, rightY); rightY += 4.5; });
    rightY += 3;
  }

  // ── RIGHT: Experience ──
  const experience = (overrides.experience || profile.experience || [])
    .filter(e => e.role?.trim() || e.company?.trim());
  if (experience.length > 0) {
    drawRightSection('Work Experience');
    experience.forEach(exp => {
      checkRightPage();
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(17, 24, 39);
      doc.text(exp.role, rightX, rightY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(107, 114, 128);
      doc.text(`${exp.startDate} – ${exp.endDate}`, pageW - 10, rightY, { align: 'right' });
      rightY += 4.5;
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(accent.r, accent.g, accent.b);
      doc.text(exp.company, rightX, rightY);
      rightY += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(75, 85, 99);
      (exp.bullets || []).forEach(b => {
        checkRightPage();
        const lines = doc.splitTextToSize('• ' + b, rightW - 3) as string[];
        lines.forEach((line: string, i: number) => {
          doc.text(i === 0 ? line : '  ' + line.trimStart(), rightX + 2, rightY);
          rightY += 4.5;
          checkRightPage();
        });
      });
      rightY += 2;
    });
  }

  // ── RIGHT: Projects ──
  const allProjects = (overrides.projects || profile.projects || []).filter(p => p.name?.trim());
  const highlightNames = overrides.highlightProjects || null;
  const filteredProjects = highlightNames
    ? allProjects.filter(p => highlightNames.some(n => p.name.toLowerCase().includes(n.toLowerCase())))
    : allProjects;
  if (filteredProjects.length > 0) {
    drawRightSection('Projects');
    filteredProjects.forEach(proj => {
      checkRightPage();
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(17, 24, 39);
      doc.text(proj.name, rightX, rightY);
      if (proj.techStack) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8.5);
        doc.setTextColor(107, 114, 128);
        doc.text(proj.techStack, pageW - 10, rightY, { align: 'right' });
      }
      rightY += 5;
      if (proj.description) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(75, 85, 99);
        const ls = doc.splitTextToSize(proj.description, rightW) as string[];
        ls.forEach((l: string) => { checkRightPage(); doc.text(l, rightX, rightY); rightY += 4.5; });
      }
      if (proj.impact) {
        const ls = doc.splitTextToSize(`Impact: ${proj.impact}`, rightW) as string[];
        ls.forEach((l: string) => { checkRightPage(); doc.text(l, rightX, rightY); rightY += 4.5; });
      }
      rightY += 2;
    });
  }

  doc.save(`${name.replace(/\s+/g, '_')}_Modern_Resume.pdf`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Skills-First Template — ATS-friendly, skills at the top for keyword density
// Best for: Amazon, data science roles, career changers, engineering positions
// ─────────────────────────────────────────────────────────────────────────────
export function generateSkillsFirstResumePDF(profile: Profile, overrides: PDFOverrides = {}): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = 210;
  const margin = 20;
  const contentW = pageW - margin * 2;
  let y = 22;

  const dark = () => doc.setTextColor(10, 10, 10);
  const gray = () => doc.setTextColor(55, 55, 55);
  const checkPage = () => { if (y > 272) { doc.addPage(); y = 20; } };

  const name = overrides.name || profile.personal?.name || 'Name';
  const p = profile.personal || {} as Profile['personal'];

  // Name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  dark();
  doc.text(name, margin, y);
  y += 7;

  // Contact
  const contactParts = [p.email, p.phone, p.linkedin, p.portfolio, p.location].filter(Boolean) as string[];
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  gray();
  const sfSep = '  |  ';
  const sfContactText = contactParts.join(sfSep);
  doc.text(sfContactText, margin, y);
  // Clickable hyperlinks for linkedin and portfolio
  {
    const sepW = doc.getTextWidth(sfSep);
    let lx = margin;
    contactParts.forEach((part, i) => {
      const pw = doc.getTextWidth(part);
      if (part && (part === p.linkedin || part === p.portfolio)) {
        doc.link(lx, y - 3.5, pw, 4.5, { url: normalizeUrl(part) });
      }
      lx += pw;
      if (i < contactParts.length - 1) lx += sepW;
    });
  }
  y += 4;

  doc.setDrawColor(10, 10, 10);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageW - margin, y);
  y += 7;

  const drawSection = (title: string) => {
    checkPage();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    dark();
    doc.text(title.toUpperCase(), margin, y);
    y += 2;
    doc.setDrawColor(55, 55, 55);
    doc.setLineWidth(0.4);
    doc.line(margin, y, pageW - margin, y);
    y += 5;
  };

  const addBullet = (text: string) => {
    checkPage();
    const lines = doc.splitTextToSize('• ' + text, contentW - 4) as string[];
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    gray();
    lines.forEach((line: string, i: number) => {
      doc.text(i === 0 ? line : '  ' + line.trimStart(), margin + 2, y);
      y += 4.5;
      checkPage();
    });
  };

  // ── 1. Summary ──
  const about = overrides.about || profile.about;
  if (about?.trim()) {
    drawSection('Professional Summary');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    gray();
    const lines = doc.splitTextToSize(about, contentW) as string[];
    lines.forEach((l: string) => { checkPage(); doc.text(l, margin, y); y += 4.5; });
    y += 3;
  }

  // ── 2. Skills FIRST (key differentiator for ATS) ──
  const skills = overrides.skills || profile.skills || {};
  const skillEntries = Object.entries(skills).filter(([, v]) => v?.trim());
  if (skillEntries.length > 0) {
    drawSection('Technical Skills');
    skillEntries.forEach(([category, value]) => {
      checkPage();
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      dark();
      const label = `${category}: `;
      doc.text(label, margin, y);
      const labelW = doc.getTextWidth(label);
      doc.setFont('helvetica', 'normal');
      gray();
      const valLines = doc.splitTextToSize(value, contentW - labelW - 2) as string[];
      valLines.forEach((line: string, i: number) => {
        doc.text(line, margin + labelW, y);
        if (i < valLines.length - 1) { y += 4.5; checkPage(); }
      });
      y += 5;
    });
    y += 1;
  }

  // ── 3. Experience ──
  const experience = (overrides.experience || profile.experience || [])
    .filter(e => e.role?.trim() || e.company?.trim());
  if (experience.length > 0) {
    drawSection('Work Experience');
    experience.forEach(exp => {
      checkPage();
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      dark();
      doc.text(exp.role, margin, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      gray();
      doc.text(`${exp.startDate} – ${exp.endDate}`, pageW - margin, y, { align: 'right' });
      y += 4.5;
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.text(exp.company, margin, y);
      y += 5;
      (exp.bullets || []).forEach(b => addBullet(b));
      y += 2;
    });
  }

  // ── 4. Projects ──
  const allProjects = (overrides.projects || profile.projects || []).filter(p => p.name?.trim());
  const highlightNames = overrides.highlightProjects || null;
  const filteredProjects = highlightNames
    ? allProjects.filter(p => highlightNames.some(n => p.name.toLowerCase().includes(n.toLowerCase())))
    : allProjects;
  if (filteredProjects.length > 0) {
    drawSection('Projects');
    filteredProjects.forEach(proj => {
      checkPage();
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      dark();
      doc.text(proj.name, margin, y);
      if (proj.techStack) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        gray();
        doc.text(proj.techStack, pageW - margin, y, { align: 'right' });
      }
      y += 5;
      if (proj.description) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        gray();
        const ls = doc.splitTextToSize(proj.description, contentW) as string[];
        ls.forEach((l: string) => { checkPage(); doc.text(l, margin, y); y += 4.5; });
      }
      if (proj.impact) {
        const ls = doc.splitTextToSize(`Impact: ${proj.impact}`, contentW) as string[];
        ls.forEach((l: string) => { checkPage(); doc.text(l, margin, y); y += 4.5; });
      }
      y += 2;
    });
  }

  // ── 5. Education ──
  const education = (profile.education || []).filter(e => e.degree?.trim() || e.institution?.trim());
  if (education.length > 0) {
    drawSection('Education');
    education.forEach(edu => {
      checkPage();
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      dark();
      doc.text(edu.degree, margin, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      gray();
      doc.text(`${edu.startYear} – ${edu.endYear}`, pageW - margin, y, { align: 'right' });
      y += 4.5;
      doc.setFont('helvetica', 'italic');
      doc.text(edu.institution, margin, y);
      y += 5;
      if (edu.description) {
        doc.setFont('helvetica', 'normal');
        const ls = doc.splitTextToSize(edu.description, contentW) as string[];
        ls.forEach((l: string) => { checkPage(); doc.text(l, margin, y); y += 4.5; });
      }
      y += 2;
    });
  }

  // ── 6. Certifications ──
  const certs = (profile.certifications || []).filter(c => c?.trim());
  if (certs.length > 0) {
    drawSection(getSectionTitle(profile, 'certifications', 'Certifications'));
    certs.forEach(cert => addBullet(cert));
    y += 2;
  }

  // ── 7. Key Achievements ──
  const sfKeyAch = (profile.keyAchievements || []).filter(a => a?.trim());
  if (sfKeyAch.length > 0) {
    drawSection(getSectionTitle(profile, 'keyAchievements', 'Key Achievements'));
    sfKeyAch.forEach(a => addBullet(a));
    y += 2;
  }

  // ── 8. Interests ──
  const sfInterests = (profile.interests || []).filter(i => i?.trim());
  if (sfInterests.length > 0) {
    drawSection(getSectionTitle(profile, 'interests', 'Interests'));
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    gray();
    const lines = doc.splitTextToSize(sfInterests.join(', '), contentW) as string[];
    lines.forEach((l: string) => { checkPage(); doc.text(l, margin, y); y += 4.5; });
    y += 2;
  }

  // ── 9. Personal Details ──
  const sfPersonalDet = (profile.personalDetails || []).filter(d => d?.trim());
  if (sfPersonalDet.length > 0) {
    drawSection(getSectionTitle(profile, 'personalDetails', 'Personal Details'));
    sfPersonalDet.forEach(d => addBullet(d));
    y += 2;
  }

  doc.save(`${name.replace(/\s+/g, '_')}_SkillsFirst_Resume.pdf`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Executive / Harvard Style — formal, elegant, no color, consulting & banking
// Best for: McKinsey, BCG, Goldman Sachs, JPMorgan, IBM, Oracle, senior roles
// ─────────────────────────────────────────────────────────────────────────────
export function generateExecutiveResumePDF(profile: Profile, overrides: PDFOverrides = {}): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = 210;
  const margin = 22;
  const contentW = pageW - margin * 2;
  let y = 24;

  const dark = () => doc.setTextColor(5, 5, 5);
  const mid = () => doc.setTextColor(40, 40, 40);
  const gray = () => doc.setTextColor(70, 70, 70);
  const checkPage = () => { if (y > 272) { doc.addPage(); y = 20; } };

  const name = overrides.name || profile.personal?.name || 'Name';
  const p = profile.personal || {} as Profile['personal'];

  // ── Centered name ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  dark();
  doc.text(name.toUpperCase(), pageW / 2, y, { align: 'center' });
  y += 8;

  // ── Centered contact ──
  const contactParts = [p.email, p.phone, p.linkedin, p.portfolio, p.location].filter(Boolean) as string[];
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  gray();
  const execSep = '   |   ';
  const execContactText = contactParts.join(execSep);
  doc.text(execContactText, pageW / 2, y, { align: 'center' });
  // Clickable hyperlinks for linkedin and portfolio
  {
    const totalW = doc.getTextWidth(execContactText);
    const sepW = doc.getTextWidth(execSep);
    let lx = (pageW - totalW) / 2;
    contactParts.forEach((part, i) => {
      const pw = doc.getTextWidth(part);
      if (part && (part === p.linkedin || part === p.portfolio)) {
        doc.link(lx, y - 3.5, pw, 4.5, { url: normalizeUrl(part) });
      }
      lx += pw;
      if (i < contactParts.length - 1) lx += sepW;
    });
  }
  y += 5;

  // ── Double ruling line ──
  doc.setDrawColor(5, 5, 5);
  doc.setLineWidth(1.2);
  doc.line(margin, y, pageW - margin, y);
  y += 1.5;
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  const drawSection = (title: string) => {
    checkPage();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    dark();
    doc.text(title.toUpperCase(), margin, y);
    y += 2;
    doc.setDrawColor(5, 5, 5);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageW - margin, y);
    y += 5;
  };

  const addBullet = (text: string) => {
    checkPage();
    const lines = doc.splitTextToSize('• ' + text, contentW - 6) as string[];
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    gray();
    lines.forEach((line: string, i: number) => {
      doc.text(i === 0 ? line : '  ' + line.trimStart(), margin + 4, y);
      y += 4.5;
      checkPage();
    });
  };

  // ── Summary ──
  const about = overrides.about || profile.about;
  if (about?.trim()) {
    drawSection('Profile Summary');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    gray();
    const lines = doc.splitTextToSize(about, contentW) as string[];
    lines.forEach((l: string) => { checkPage(); doc.text(l, margin, y); y += 4.5; });
    y += 3;
  }

  // ── Experience ──
  const experience = (overrides.experience || profile.experience || [])
    .filter(e => e.role?.trim() || e.company?.trim());
  if (experience.length > 0) {
    drawSection('Professional Experience');
    experience.forEach(exp => {
      checkPage();
      // Role bold left, dates right on same line
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      dark();
      doc.text(exp.role, margin, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      mid();
      doc.text(`${exp.startDate} – ${exp.endDate}`, pageW - margin, y, { align: 'right' });
      y += 5;
      // Company italic below
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9.5);
      gray();
      doc.text(exp.company, margin + 2, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      (exp.bullets || []).forEach(b => addBullet(b));
      y += 3;
    });
  }

  // ── Education ──
  const education = (profile.education || []).filter(e => e.degree?.trim() || e.institution?.trim());
  if (education.length > 0) {
    drawSection('Education');
    education.forEach(edu => {
      checkPage();
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      dark();
      doc.text(edu.degree, margin, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      mid();
      doc.text(`${edu.startYear} – ${edu.endYear}`, pageW - margin, y, { align: 'right' });
      y += 5;
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9.5);
      gray();
      doc.text(edu.institution, margin + 2, y);
      y += 5;
      if (edu.description) {
        doc.setFont('helvetica', 'normal');
        const ls = doc.splitTextToSize(edu.description, contentW - 4) as string[];
        ls.forEach((l: string) => { checkPage(); doc.text(l, margin + 2, y); y += 4.5; });
      }
      y += 2;
    });
  }

  // ── Skills ──
  const skills = overrides.skills || profile.skills || {};
  const skillEntries = Object.entries(skills).filter(([, v]) => v?.trim());
  if (skillEntries.length > 0) {
    drawSection('Core Competencies');
    skillEntries.forEach(([category, value]) => {
      checkPage();
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      dark();
      const label = `${category}: `;
      doc.text(label, margin, y);
      const labelW = doc.getTextWidth(label);
      doc.setFont('helvetica', 'normal');
      gray();
      const valLines = doc.splitTextToSize(value, contentW - labelW - 2) as string[];
      valLines.forEach((line: string, i: number) => {
        doc.text(line, margin + labelW, y);
        if (i < valLines.length - 1) { y += 4.5; checkPage(); }
      });
      y += 5;
    });
  }

  // ── Projects ──
  const allProjects = (overrides.projects || profile.projects || []).filter(p => p.name?.trim());
  const highlightNames = overrides.highlightProjects || null;
  const filteredProjects = highlightNames
    ? allProjects.filter(p => highlightNames.some(n => p.name.toLowerCase().includes(n.toLowerCase())))
    : allProjects;
  if (filteredProjects.length > 0) {
    drawSection('Key Projects');
    filteredProjects.forEach(proj => {
      checkPage();
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      dark();
      doc.text(proj.name, margin, y);
      if (proj.techStack) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        mid();
        doc.text(proj.techStack, pageW - margin, y, { align: 'right' });
      }
      y += 5;
      if (proj.description) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        gray();
        const ls = doc.splitTextToSize(proj.description, contentW - 4) as string[];
        ls.forEach((l: string) => { checkPage(); doc.text(l, margin + 2, y); y += 4.5; });
      }
      if (proj.impact) {
        const ls = doc.splitTextToSize(`Impact: ${proj.impact}`, contentW - 4) as string[];
        ls.forEach((l: string) => { checkPage(); doc.text(l, margin + 2, y); y += 4.5; });
      }
      y += 2;
    });
  }

  // ── Certifications ──
  const certs = (profile.certifications || []).filter(c => c?.trim());
  if (certs.length > 0) {
    drawSection(getSectionTitle(profile, 'certifications', 'Certifications & Credentials'));
    certs.forEach(cert => addBullet(cert));
    y += 2;
  }

  // ── Key Achievements ──
  const execKeyAch = (profile.keyAchievements || []).filter(a => a?.trim());
  if (execKeyAch.length > 0) {
    drawSection(getSectionTitle(profile, 'keyAchievements', 'Key Achievements'));
    execKeyAch.forEach(a => addBullet(a));
    y += 2;
  }

  // ── Interests ──
  const execInterests = (profile.interests || []).filter(i => i?.trim());
  if (execInterests.length > 0) {
    drawSection(getSectionTitle(profile, 'interests', 'Interests'));
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    gray();
    const lines = doc.splitTextToSize(execInterests.join(', '), contentW) as string[];
    lines.forEach((l: string) => { checkPage(); doc.text(l, margin, y); y += 4.5; });
    y += 2;
  }

  // ── Personal Details ──
  const execPersonalDet = (profile.personalDetails || []).filter(d => d?.trim());
  if (execPersonalDet.length > 0) {
    drawSection(getSectionTitle(profile, 'personalDetails', 'Personal Details'));
    execPersonalDet.forEach(d => addBullet(d));
    y += 2;
  }

  doc.save(`${name.replace(/\s+/g, '_')}_Executive_Resume.pdf`);
}

function hexToRgb(hex: string): RGB {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

function normalizeUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return 'https://' + url;
}

function getSectionTitle(profile: Profile, key: string, defaultTitle: string): string {
  return profile.sectionTitles?.[key] || defaultTitle;
}
