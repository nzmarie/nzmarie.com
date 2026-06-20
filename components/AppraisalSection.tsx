"use client";

import React, { useState, useEffect, useRef } from "react";
import { translations, Language } from "../lib/translations";

const GEOAPIFY_KEY = process.env.NEXT_PUBLIC_GEOAPIFY_KEY;

export default function AppraisalSection({ lang = "en" }: { lang?: Language }) {
  const t = translations[lang].appraisal;
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    email: "",
    phone: "",
    timeline: "",
    motivation: "",
    languagePreference: "",
    heardFrom: "",
  });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [step, setStep] = useState<1 | 2>(1);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const [isAddressSelected, setIsAddressSelected] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const addressInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
        setNoResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleAddressChange = (value: string) => {
    setFormData((prev) => ({ ...prev, address: value }));
    setIsAddressSelected(false);
    setShowSuggestions(false);
    setNoResults(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const hasLetter = /[a-zA-Z]/.test(value);
    if (value.length < 3 || !hasLetter) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(value)}&filter=countrycode:nz&limit=6&apiKey=${GEOAPIFY_KEY}`
        );
        const data = await res.json();
        const results: string[] = (data.features ?? []).map(
          (f: { properties: { formatted: string } }) => f.properties.formatted
        );
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
        setNoResults(results.length === 0);
      } catch {
        setSuggestions([]);
        setNoResults(false);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  };

  const handleSelectSuggestion = (address: string) => {
    setFormData((prev) => ({ ...prev, address }));
    setIsAddressSelected(true);
    setSuggestions([]);
    setShowSuggestions(false);
    setNoResults(false);
  };

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (isAddressSelected && formData.address.trim()) {
      setStep(2);
    }
  };

  const handleEditAddress = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setStep(1);
    setIsAddressSelected(false);
    setSuggestions([]);
    setShowSuggestions(false);
    setNoResults(false);
    setTimeout(() => {
      const inputElement = addressInputRef.current;
      if (inputElement) {
        inputElement.focus();
        inputElement.select();
        const current = formData.address;
        if (current.length >= 3) {
          handleAddressChange(current);
        }
      }
    }, 50);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/appraisal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setStatus("success");
        setFormData({ name: "", address: "", email: "", phone: "", timeline: "", motivation: "", languagePreference: "", heardFrom: "" });
        setIsAddressSelected(false);
        setStep(1);
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  return (
    <section className="py-20 bg-slate-50 border-t border-b border-gray-100" id="appraisal">
      <div className="container mx-auto px-4 max-w-4xl text-center">
        <span className="text-blue-600 font-semibold uppercase tracking-wider text-sm">
          {lang === "en" ? "Complimentary Private Consultation" : "高定私密资产咨询"}
        </span>
        <h2 className="text-4xl font-bold text-slate-900 mt-2 mb-6">
          {t.title}
        </h2>
        <p className="text-base text-slate-600 max-w-xl mx-auto mb-12 leading-relaxed px-4">
          {t.subtitle}
        </p>

        <div className="max-w-3xl mx-auto mb-20 relative">
          <div className="bg-white p-8 md:p-12 rounded-2xl shadow-xl border border-slate-100 transition-all duration-500">
            {step === 1 ? (
              <form onSubmit={handleNextStep} className="flex flex-col gap-3">
                <div className="flex flex-col md:flex-row items-stretch gap-4">
                  <div className="w-full relative" ref={wrapperRef}>
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl">📍</span>
                    <input
                      ref={addressInputRef}
                      type="text"
                      required
                      autoComplete="off"
                      value={formData.address}
                      onChange={(e) => handleAddressChange(e.target.value)}
                      onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                      className={`w-full pl-12 pr-10 py-4 rounded-xl border focus:outline-none focus:ring-2 focus:border-transparent transition duration-200 text-lg shadow-inner bg-slate-50 ${
                        isAddressSelected 
                          ? "border-green-300 focus:ring-2 focus:ring-green-500"
                          : noResults 
                          ? "border-amber-300 focus:ring-2 focus:ring-amber-500"
                          : "border-gray-200 focus:ring-2 focus:ring-blue-500"
                      }`}
                      placeholder={t.addressPlaceholder}
                    />
                    {isAddressSelected && (
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-green-500 text-lg select-none font-bold">
                        ✓
                      </span>
                    )}
                    {!isAddressSelected && isSearching && (
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-400 text-lg select-none">
                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                      </span>
                    )}
                    {showSuggestions && suggestions.length > 0 && (
                      <ul className="absolute left-0 right-0 top-full mt-2 z-50 bg-white rounded-xl shadow-2xl border-2 border-blue-300 overflow-hidden text-left">
                        <li className="px-5 py-2 bg-blue-50 text-xs font-semibold text-blue-700 border-b border-blue-200">
                          {lang === "en" ? "📍 Select an address:" : "📍 选择一个地址："}
                        </li>
                        {suggestions.map((s, i) => (
                          <li
                            key={i}
                            onMouseDown={() => handleSelectSuggestion(s)}
                            className="px-5 py-3 text-sm text-slate-700 hover:bg-blue-100 cursor-pointer border-b border-slate-100 last:border-0 transition-colors duration-150 font-medium"
                          >
                            <span className="mr-2 text-blue-500">📍</span>{s}
                          </li>
                        ))}
                      </ul>
                    )}
                    {noResults && !isSearching && formData.address.length >= 3 && (
                      <ul className="absolute left-0 right-0 top-full mt-1 z-50 bg-white rounded-xl shadow-2xl border border-amber-100 overflow-hidden text-left">
                        <li className="px-5 py-4 text-sm text-slate-500">
                          <span className="mr-2">💡</span>
                          {lang === "en"
                            ? 'No NZ addresses found. Try including the street name, e.g. "12 Queen Street, Albany"'
                            : '未找到地址，请包含街道名称，如"12 Queen Street, Albany"'}
                        </li>
                      </ul>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={!isAddressSelected}
                    className={`w-full md:w-auto px-8 py-4 font-bold rounded-xl transition-all duration-300 whitespace-nowrap text-lg ${
                      isAddressSelected
                        ? "bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl cursor-pointer"
                        : "bg-gray-300 text-gray-500 cursor-not-allowed"
                    }`}
                  >
                    {lang === "en" ? "Request Bespoke Analysis" : "申请高定分析"}
                  </button>
                </div>
                <p className={`text-xs text-left pl-1 transition-colors ${
                  isAddressSelected ? "text-slate-400" : "text-amber-600 font-medium"
                }`}>
                  {isAddressSelected 
                    ? (lang === "en"
                      ? 'Great! Click the button above to continue.'
                      : '很好！点击上面的按钮继续。')
                    : (lang === "en"
                      ? '⬆️ Please select an address from the suggestions above'
                      : '⬆️ 请从上面的建议中选择一个地址')}
                </p>
              </form>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6 text-left">
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
                  <div>
                    <p className="text-sm text-gray-500">{lang === "en" ? "Property Address:" : "房产地址："}</p>
                    <p className="font-semibold text-gray-900">{formData.address}</p>
                  </div>
                  <button 
                    type="button" 
                    onClick={handleEditAddress} 
                    className="text-sm text-blue-600 hover:text-blue-800 hover:underline transition-colors cursor-pointer px-2 py-1 rounded hover:bg-blue-50 font-medium"
                  >
                    {lang === "en" ? "Edit Address" : "修改地址"}
                  </button>
                </div>

                <p className="text-slate-700 font-medium mb-4">
                  {lang === "en"
                    ? "Great address! Where should Marie send your tailored report?"
                    : "太棒了！Marie 应该把定制报告发送到哪里？"}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {t.fullName} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full pl-4 pr-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200"
                      placeholder="e.g. John Doe"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {t.email} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full pl-4 pr-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200"
                      placeholder="e.g. john@example.com"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {t.phone} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full pl-4 pr-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200"
                      placeholder="e.g. +64 21 000 0000"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {t.timeline} <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={formData.timeline}
                      onChange={(e) => setFormData({ ...formData, timeline: e.target.value })}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white transition duration-200"
                    >
                      <option value="">{t.timelineOptions.placeholder}</option>
                      <option value="within-3-months">{t.timelineOptions.within3}</option>
                      <option value="3-6-months">{t.timelineOptions.months3to6}</option>
                      <option value="6-12-months">{t.timelineOptions.months6to12}</option>
                      <option value="just-exploring">{t.timelineOptions.exploring}</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {t.motivation} <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={formData.motivation}
                      onChange={(e) => setFormData({ ...formData, motivation: e.target.value })}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white transition duration-200"
                    >
                      <option value="">{t.motivationOptions.placeholder}</option>
                      <option value="upsizing">{t.motivationOptions.upsizing}</option>
                      <option value="downsizing">{t.motivationOptions.downsizing}</option>
                      <option value="investment">{t.motivationOptions.investment}</option>
                      <option value="relocating">{t.motivationOptions.relocating}</option>
                      <option value="estate">{t.motivationOptions.estate}</option>
                      <option value="other">{t.motivationOptions.other}</option>
                    </select>
                  </div>
                  <div className="flex flex-col">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {t.languagePreference}
                    </label>
                    <select
                      value={formData.languagePreference}
                      onChange={(e) => setFormData({ ...formData, languagePreference: e.target.value })}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white transition duration-200"
                    >
                      <option value="">{t.languageOptions.none}</option>
                      <option value="en">{t.languageOptions.en}</option>
                      <option value="zh">{t.languageOptions.zh}</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {t.heardFrom}
                  </label>
                  <select
                    value={formData.heardFrom}
                    onChange={(e) => setFormData({ ...formData, heardFrom: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white transition duration-200"
                  >
                    <option value="">{t.heardFromOptions.placeholder}</option>
                    <option value="google">{t.heardFromOptions.google}</option>
                    <option value="wechat">{t.heardFromOptions.wechat}</option>
                    <option value="referral">{t.heardFromOptions.referral}</option>
                    <option value="facebook">{t.heardFromOptions.facebook}</option>
                    <option value="other">{t.heardFromOptions.other}</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-all duration-300 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5 active:translate-y-0 text-center"
                >
                  {status === "loading" ? "..." : t.submit}
                </button>

                {status === "error" && (
                  <p className="text-red-500 text-sm text-center font-medium mt-2">{t.error}</p>
                )}
              </form>
            )}
          </div>
        </div>

        <div className="border-t border-slate-200 pt-16">
          <h3 className="text-2xl font-serif italic text-slate-700 mb-10">
            {lang === "en" ? "What My Clients Say" : "客户评价"}
          </h3>

          <div className="bg-white rounded-2xl shadow-xl p-10 md:p-14 text-left relative overflow-hidden max-w-3xl mx-auto">
            <span className="absolute top-4 left-6 text-slate-100 text-9xl font-serif select-none pointer-events-none">
              &ldquo;
            </span>

            <div className="relative z-10 space-y-6 text-slate-700 leading-relaxed text-base md:text-lg">
              <p>
                &quot;I honestly couldn&apos;t have asked for a more <strong>responsible and forward-thinking agent</strong>. Her level of preparation and attention to detail was exceptional &ndash; she often considered things even more carefully than we did as owners.&quot;
              </p>
              <p>
                &quot;She has a <strong>deep understanding of how business is done in New Zealand</strong>, where relationships and trust matter just as much as numbers. That made a huge difference throughout the process.&quot;
              </p>
              <p>
                &quot;In what has been a very challenging <strong>property market</strong>, she achieved an <strong>outstanding result for our property</strong> &ndash; well beyond what we had hoped for.&quot;
              </p>
              <p>
                &quot;She is honest, reliable, and incredibly professional. What truly stood out was her patience and kindness towards my children during contract negotiations. She made the whole process smooth and stress-free, even with kids around, which we deeply appreciated.&quot;
              </p>
              <p className="italic text-slate-600">
                &quot;I would absolutely recommend her to anyone looking for an agent who genuinely cares and delivers results.&quot;
              </p>

              <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <span className="block font-bold text-slate-900 text-lg">Molly K.</span>
                  <span className="text-xs text-slate-400 uppercase tracking-widest">Verified Homeowner</span>
                </div>
                <div className="flex text-amber-400 font-bold text-xl">★★★★★</div>
              </div>
            </div>
          </div>
        </div>

        {status === "success" && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-2xl border border-gray-100 transform scale-100 transition-all duration-300">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl font-bold">
                ✓
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">{t.successTitle}</h3>
              <p className="text-gray-600 mb-8 leading-relaxed">{t.successMessage}</p>
              <button
                onClick={() => setStatus("idle")}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors duration-200 shadow-md"
              >
                {t.close}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
