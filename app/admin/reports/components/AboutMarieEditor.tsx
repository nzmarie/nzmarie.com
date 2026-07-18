'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { Phone, Mail, Globe, Award } from 'lucide-react';
import { useReportStore } from '../stores/report-store';

import type { ReportEditorContent } from '@/types/report';

interface AboutMarieContent {
  custom: boolean;
  title: string;
  subtitle: string;
  welcomeText: string;
  paragraphs: string[];
  phone: string;
  email: string;
  website: string;
  license: string;
  appraisalTitle: string;
  steps: string[];
  disclaimer1: string;
  disclaimer2: string;
  disclaimer3: string;
}

interface AboutMarieEditorProps {
  docId: string;
  initialContent: unknown;
  onContentChange?: (content: ReportEditorContent) => void;
}

const defaultContent = {
  custom: true,
  title: 'A Personal Note from Marie',
  subtitle: 'Bespoke Consultancy',
  welcomeText: 'Hi, Iʼm Marie Nian, Licensed Residential Sales, Barfoot & Thompson.',
  paragraphs: [
    'In New Zealand, we know that property isnʼt just about data and contracts. Itʼs about people, families, and trust. Every home holds a unique story and years of hard work, which is why I choose to bring genuine care, patience, and absolute preparation to every transaction.',
    'With a background in finance, I love digging into the numbers. But instead of relying on automated online estimates, I prefer spending hours personally analysing underlying REINZ data, school zone dynamics, and the real land potential of our local Northcross streets.',
    'My goal is simple: to remove the noise and anxiety from your property decisions by giving you honest, patient, and clear guidance. There is no high-pressure sales pitch here. Whenever you are ready to look at your property\'s true potential, or if you just want to chat over a coffee, I am always here to listen.'
  ],
  phone: '021 069 3089',
  email: 'm.nian@barfoot.co.nz',
  website: 'nzmarie.com',
  license: 'Licensed under REAA 2008',
  appraisalTitle: 'How a Free Appraisal Works (Our 3-Step No-Pressure Promise)',
  steps: [
    'Send your address: Drop a quick line to m.nian@barfoot.co.nz or visit nzmarie.com/appraisal.',
    'I’ll do the homework: Analysing REINZ stats, local school zones, and unitary land potential.',
    'Private, obligation-free delivery: Receive a clear estimate with zero high-pressure sales pitch.'
  ],
  disclaimer1: 'Note: This data reflects broader neighbourhood trends. Since every street in Northcross has its own unique character, feel free to drop me a line at m.nian@barfoot.co.nz if you ever want a quiet, obligation-free chat about your specific address.',
  disclaimer2: 'This document is an independent market analysis prepared by Marie Nian, Licensed Residential Sales, Barfoot & Thompson (Licensed under the REAA 2008). It is based on official REINZ data and does not constitute binding financial valuation advice.',
  disclaimer3: '© 2026 Marie Nian, Licensed Residential Sales, Barfoot & Thompson (Licensed under the REAA 2008). This publication is an independent market analysis based on official REINZ data.'
};

export default function AboutMarieEditor({ docId, initialContent, onContentChange }: AboutMarieEditorProps) {
  const { setIsSaving, setLastSaved, updateDocument } = useReportStore();
  const [isEditMode, setIsEditMode] = useState(false);

  const [title, setTitle] = useState(defaultContent.title);
  const [subtitle, setSubtitle] = useState(defaultContent.subtitle);
  const [welcomeText, setWelcomeText] = useState(defaultContent.welcomeText);
  const [paragraphs, setParagraphs] = useState(defaultContent.paragraphs);
  const [phone, setPhone] = useState(defaultContent.phone);
  const [email, setEmail] = useState(defaultContent.email);
  const [website, setWebsite] = useState(defaultContent.website);
  const [license, setLicense] = useState(defaultContent.license);
  const [appraisalTitle, setAppraisalTitle] = useState(defaultContent.appraisalTitle);
  const [steps, setSteps] = useState(defaultContent.steps);
  const [disclaimer1, setDisclaimer1] = useState(defaultContent.disclaimer1);
  const [disclaimer2, setDisclaimer2] = useState(defaultContent.disclaimer2);
  const [disclaimer3, setDisclaimer3] = useState(defaultContent.disclaimer3);

  const lastDocIdRef = useRef<string | null>(null);
  const prevContentRef = useRef<string>('');

  useEffect(() => {
    if (docId !== lastDocIdRef.current) {
      lastDocIdRef.current = docId;
      const data = (initialContent && typeof initialContent === 'object' && 'custom' in initialContent)
        ? (initialContent as unknown as AboutMarieContent)
        : defaultContent;
      setTitle(data.title || defaultContent.title);
      setSubtitle(data.subtitle || defaultContent.subtitle);
      setWelcomeText(data.welcomeText || defaultContent.welcomeText);
      setParagraphs(data.paragraphs || defaultContent.paragraphs);
      setPhone(data.phone || defaultContent.phone);
      setEmail(data.email || defaultContent.email);
      setWebsite(data.website || defaultContent.website);
      setLicense(data.license || defaultContent.license);
      setAppraisalTitle(data.appraisalTitle || defaultContent.appraisalTitle);
      setSteps(data.steps || defaultContent.steps);
      setDisclaimer1(data.disclaimer1 || defaultContent.disclaimer1);
      setDisclaimer2(data.disclaimer2 || defaultContent.disclaimer2);
      setDisclaimer3(data.disclaimer3 || defaultContent.disclaimer3);
    }
  }, [docId, initialContent]);

  const saveContent = useCallback(async (contentToSave: AboutMarieContent) => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/reports/documents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: docId, content: contentToSave }),
      });
      const result = await res.json();
      if (result.success) {
        setLastSaved(new Date().toLocaleTimeString('en-NZ'));
        const editorContent = (result.success ? contentToSave : undefined) as unknown as ReportEditorContent;
        updateDocument(docId, { content: editorContent });
        onContentChange?.(editorContent);
      }
    } catch {
    } finally {
      setIsSaving(false);
    }
  }, [docId, setIsSaving, setLastSaved, updateDocument, onContentChange]);

  useEffect(() => {
    const payload = {
      custom: true,
      title,
      subtitle,
      welcomeText,
      paragraphs,
      phone,
      email,
      website,
      license,
      appraisalTitle,
      steps,
      disclaimer1,
      disclaimer2,
      disclaimer3,
    };
    const payloadString = JSON.stringify(payload);
    if (prevContentRef.current && prevContentRef.current !== payloadString) {
      const timer = setTimeout(() => {
        saveContent(payload);
      }, 1500);
      prevContentRef.current = payloadString;
      return () => clearTimeout(timer);
    } else {
      prevContentRef.current = payloadString;
    }
  }, [
    title,
    subtitle,
    welcomeText,
    paragraphs,
    phone,
    email,
    website,
    license,
    appraisalTitle,
    steps,
    disclaimer1,
    disclaimer2,
    disclaimer3,
    saveContent
  ]);

  return (
    <div className="max-w-6xl mx-auto px-8 py-12 bg-white min-h-screen">
      <div className="flex justify-end gap-2 mb-6 print:hidden">
        <button
          onClick={() => setIsEditMode(false)}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-200 cursor-pointer ${
            !isEditMode
              ? 'bg-slate-900 text-white shadow-sm'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          Preview
        </button>
        <button
          onClick={() => setIsEditMode(true)}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-200 cursor-pointer ${
            isEditMode
              ? 'bg-slate-900 text-white shadow-sm'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          Edit Content
        </button>
      </div>

      {!isEditMode ? (
        <div className="text-slate-800">
          <div className="border-b border-slate-200/60 pb-6 mb-8 text-left">
            <div className="inline-block px-3 py-1 bg-slate-100 rounded-full text-[11px] font-semibold text-slate-600 uppercase tracking-widest mb-3">
              {subtitle}
            </div>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-serif font-bold text-slate-900 tracking-tight">
              {title}
            </h1>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-12 mt-10 items-start">
            <div className="md:col-span-4 flex flex-col gap-6 text-left">
              <div className="overflow-hidden rounded-xl shadow-md border border-slate-100 bg-slate-50 aspect-4/5 w-full">
                <Image
                  src="https://reports.nzmarie.com/reports/images/about-marie/headshot.jpg"
                  alt="Marie Nian"
                  width={859}
                  height={1014}
                  className="w-full h-full object-cover object-center"
                />
              </div>

              <div className="space-y-4 bg-slate-50/50 p-6 rounded-xl border border-slate-100">
                <div className="flex items-center gap-3 text-slate-600 text-sm">
                  <Phone className="w-4 h-4 text-slate-800 flex-shrink-0" />
                  <span>{phone}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-600 text-sm">
                  <Mail className="w-4 h-4 text-slate-800 flex-shrink-0" />
                  <a href={`mailto:${email}`} className="hover:text-slate-950 underline transition-colors">
                    {email}
                  </a>
                </div>
                <div className="flex items-center gap-3 text-slate-600 text-sm">
                  <Globe className="w-4 h-4 text-slate-800 flex-shrink-0" />
                  <a href={`https://${website}`} target="_blank" rel="noopener noreferrer" className="hover:text-slate-950 underline transition-colors">
                    {website}
                  </a>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 font-semibold tracking-widest uppercase mt-2">
                {license}
              </div>
            </div>

            <div className="md:col-span-8 flex flex-col gap-6 text-left">
              <div className="text-xl md:text-2xl font-serif text-slate-800 leading-snug">
                {welcomeText}
              </div>

              <div className="space-y-4">
                {paragraphs.map((p, idx) => (
                  <p key={idx} className="text-slate-600 leading-relaxed text-base md:text-lg">
                    {p}
                  </p>
                ))}
              </div>

              <div className="bg-gradient-to-br from-slate-50 to-slate-100/40 border border-slate-200/50 rounded-2xl p-8 mt-8 shadow-sm">
                <h3 className="text-lg md:text-xl font-serif font-semibold text-slate-900 mb-6 flex items-center gap-2">
                  <Award className="w-5 h-5 text-slate-800" />
                  {appraisalTitle}
                </h3>
                <div className="space-y-6">
                  {steps.map((step, idx) => {
                    const parts = step.split(':');
                    const boldPart = parts[0];
                    const normalPart = parts.slice(1).join(':');
                    return (
                      <div key={idx} className="flex items-start gap-4">
                        <div className="w-7 h-7 rounded-full bg-slate-900 text-white font-serif font-semibold text-sm flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5">
                          {idx + 1}
                        </div>
                        <div className="text-slate-700 text-sm md:text-base leading-relaxed">
                          {boldPart && (
                            <strong className="font-semibold text-slate-900 block md:inline md:mr-1">
                              {boldPart}:
                            </strong>
                          )}
                          <span>{normalPart}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-16 pt-8 border-t border-slate-100 text-left space-y-3">
            <p className="text-[10px] text-slate-400 leading-relaxed">
              {disclaimer1}
            </p>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              {disclaimer2}
            </p>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              {disclaimer3}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 max-w-4xl mx-auto p-6 bg-slate-50 rounded-xl border border-slate-100 text-left">
          <div className="border-b border-slate-200 pb-4 mb-4">
            <h2 className="text-lg font-semibold text-slate-800">Edit About Marie</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                Page Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full p-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-950 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                Subtitle Badge
              </label>
              <input
                type="text"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                className="w-full p-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-950 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              Welcome Tagline
            </label>
            <input
              type="text"
              value={welcomeText}
              onChange={(e) => setWelcomeText(e.target.value)}
              className="w-full p-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-950 text-sm font-serif"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              Narrative Paragraphs
            </label>
            <div className="space-y-4">
              {paragraphs.map((p, idx) => (
                <div key={idx} className="flex gap-2 items-start">
                  <textarea
                    value={p}
                    onChange={(e) => {
                      const newParagraphs = [...paragraphs];
                      newParagraphs[idx] = e.target.value;
                      setParagraphs(newParagraphs);
                    }}
                    rows={3}
                    className="w-full p-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-950 text-sm leading-relaxed"
                  />
                  <button
                    onClick={() => {
                      const newParagraphs = paragraphs.filter((_, i) => i !== idx);
                      setParagraphs(newParagraphs);
                    }}
                    className="p-2 text-slate-400 hover:text-red-500 rounded border border-transparent hover:border-slate-200 cursor-pointer"
                  >
                    🗑️
                  </button>
                </div>
              ))}
              <button
                onClick={() => setParagraphs([...paragraphs, ''])}
                className="px-3 py-1.5 text-xs bg-slate-200 text-slate-700 font-medium rounded hover:bg-slate-300 cursor-pointer"
              >
                + Add Paragraph
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                Phone Number
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full p-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-950 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                Email Address
              </label>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-950 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                Website URL
              </label>
              <input
                type="text"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="w-full p-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-950 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                License Info
              </label>
              <input
                type="text"
                value={license}
                onChange={(e) => setLicense(e.target.value)}
                className="w-full p-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-950 text-sm"
              />
            </div>
          </div>

          <div className="border-t border-slate-200 pt-6 mt-4">
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              Appraisal Promise Box Title
            </label>
            <input
              type="text"
              value={appraisalTitle}
              onChange={(e) => setAppraisalTitle(e.target.value)}
              className="w-full p-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-950 text-sm mb-4"
            />

            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              Appraisal Promise Steps
            </label>
            <div className="space-y-4">
              {steps.map((step, idx) => (
                <div key={idx} className="flex gap-4 items-center">
                  <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 font-semibold text-xs flex items-center justify-center flex-shrink-0">
                    {idx + 1}
                  </span>
                  <input
                    type="text"
                    value={step}
                    onChange={(e) => {
                      const newSteps = [...steps];
                      newSteps[idx] = e.target.value;
                      setSteps(newSteps);
                    }}
                    className="w-full p-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-950 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-200 pt-6 mt-4 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                Footer Disclaimer 1
              </label>
              <textarea
                value={disclaimer1}
                onChange={(e) => setDisclaimer1(e.target.value)}
                rows={2}
                className="w-full p-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-950 text-sm leading-relaxed"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                Footer Disclaimer 2
              </label>
              <textarea
                value={disclaimer2}
                onChange={(e) => setDisclaimer2(e.target.value)}
                rows={2}
                className="w-full p-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-950 text-sm leading-relaxed"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                Footer Disclaimer 3
              </label>
              <textarea
                value={disclaimer3}
                onChange={(e) => setDisclaimer3(e.target.value)}
                rows={2}
                className="w-full p-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-950 text-sm leading-relaxed"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
