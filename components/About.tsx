"use client";

import React from "react";
import Image from "next/image";

import { translations, Language } from "../lib/translations";

export default function About({ lang = "en" }: { lang?: Language }) {
  const t = translations[lang].about;
  const skills = t.skills;

  return (
    <section className="about-area section-gap" id="about">
      <div className="container mx-auto px-4">
        <div className="flex justify-center mb-16">
          <div className="text-center max-w-2xl">
            <h1 className="text-4xl font-bold mb-4 text-gray-800">
              {t.title}
            </h1>
            <p className="text-lg text-gray-600">
              {t.license}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 xl:gap-16 items-center lg:items-start">
          {/* Left side - Text content and skills */}
          <div className="w-full lg:max-w-2xl mx-auto lg:mx-0">
            <div className="space-y-6 mb-12 text-center lg:text-left">
              <p className="text-gray-700 leading-relaxed text-base md:text-lg">
                {t.p1}
              </p>

              <p className="text-gray-700 leading-relaxed text-base md:text-lg">
                {t.p2}
              </p>

              <h5 className="text-xl md:text-2xl font-semibold text-gray-800 pt-8">
                {t.footer}
              </h5>
            </div>

            {/* Skills section */}
            <div className="max-w-xl mx-auto lg:mx-0">
              <h4 className="text-2xl font-bold mb-8 text-gray-800 text-center lg:text-left">
                {t.experienceTitle}
              </h4>
              <div className="space-y-6">
                {skills.map((skill, index) => (
                  <div key={index} className="skillbar">
                    <div className="skill-bar-percent">{skill.name}</div>
                    <div className="skillwrap">
                      <div
                        className="skillbar-bar"
                        style={{ width: `${skill.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right side - Profile card */}
          <div className="w-full flex justify-center lg:justify-end">
            <div className="myself-wrap bg-white rounded-lg shadow-lg overflow-hidden w-full sm:max-w-sm lg:max-w-md">
              <div className="relative">
                <Image
                  src="/img/about-img.jpg"
                  alt="Marie Nian - Licensed Real Estate Consultant"
                  width={400}
                  height={500}
                  className="w-full h-auto object-cover"
                />
              </div>

              <div className="desc p-6 text-center lg:text-left">
                <h4 className="text-2xl font-bold mb-2 text-gray-800">
                  {t.name}
                </h4>
                <p className="text-gray-600 mb-4 text-sm md:text-base">
                  {t.license}
                </p>
                <p className="text-gray-600 mb-4 text-sm md:text-base font-medium">
                  {t.fluent}
                </p>

                <div className="contact-info space-y-2 mb-6">
                  <p className="flex flex-col items-center lg:flex-row lg:items-center text-gray-700 text-sm md:text-base">
                    <span className="w-5 h-5 mb-1 lg:mb-0 lg:mr-3 text-blue-600">📞</span>
                    (+64) 21 069 3089
                  </p>
                  <p className="flex flex-col items-center lg:flex-row lg:items-center text-gray-700 text-sm md:text-base">
                    <span className="w-5 h-5 mb-1 lg:mb-0 lg:mr-3 text-blue-600">✉️</span>
                    nzmarie.com@gmail.com
                  </p>
                </div>

                <a
                  href="#contact"
                  className="talk-btn block text-center w-full"
                >
                  {t.contactBtn}
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
