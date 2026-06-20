import React from "react";
import { FaEnvelope, FaFacebookF, FaLinkedinIn, FaPhone } from "react-icons/fa";
import { translations, Language } from "../lib/translations";

export default function Footer({ lang = "en" }: { lang?: Language }) {
  const t = translations[lang].footer;

  return (
    <footer className="bg-gray-900 text-white">
      <div className="mx-auto px-4 sm:px-6 lg:px-8 max-w-screen-xl py-12 lg:py-16">

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10 lg:gap-16 mb-10 pb-10 border-b border-gray-700">

          <div className="sm:col-span-2 lg:col-span-1">
            <h6 className="text-lg font-bold mb-3 tracking-wide">{t.aboutTitle}</h6>
            <p className="text-gray-300 text-sm leading-relaxed mb-4 whitespace-pre-line">
              {t.aboutText}
            </p>
            <p className="text-xs text-gray-500 leading-relaxed">
              {t.license}
            </p>
          </div>

          <div>
            <h6 className="text-lg font-bold mb-3 tracking-wide">Contact</h6>
            <ul className="space-y-3 text-sm text-gray-300">
              <li className="flex items-center gap-3">
                <FaPhone className="text-blue-400 shrink-0" />
                <a href="tel:+6421069308" className="hover:text-white transition-colors">
                  (+64) 21 069 3089
                </a>
              </li>
              <li className="flex items-center gap-3">
                <FaEnvelope className="text-blue-400 shrink-0" />
                <a href="mailto:m.nian@barfoot.co.nz" className="hover:text-white transition-colors break-all">
                  m.nian@barfoot.co.nz
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h6 className="text-lg font-bold mb-3 tracking-wide">{t.followTitle}</h6>
            <p className="text-gray-400 text-sm mb-4">{t.socialText}</p>
            <div className="flex gap-3">
              <a
                href="mailto:m.nian@barfoot.co.nz"
                aria-label="Email"
                className="w-10 h-10 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors duration-300"
              >
                <FaEnvelope className="text-white text-base" />
              </a>
              <a
                href="https://www.facebook.com/nian.hong.10"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
                className="w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-700 flex items-center justify-center transition-colors duration-300"
              >
                <FaFacebookF className="text-white text-base" />
              </a>
              <a
                href="https://www.linkedin.com/in/nzmarie"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn"
                className="w-10 h-10 rounded-full bg-blue-700 hover:bg-blue-800 flex items-center justify-center transition-colors duration-300"
              >
                <FaLinkedinIn className="text-white text-base" />
              </a>
            </div>
          </div>

        </div>

        <p className="text-center text-xs text-gray-500">
          {t.copyright.replace("{year}", new Date().getFullYear().toString())}
        </p>

      </div>
    </footer>
  );
}
