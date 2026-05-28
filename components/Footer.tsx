import React from "react";
import { FaEnvelope, FaFacebookF, FaLinkedinIn } from "react-icons/fa";
import { translations, Language } from "../lib/translations";

export default function Footer({ lang = "en" }: { lang?: Language }) {
  const t = translations[lang].footer;

  return (
    <footer className="footer-area section-gap bg-gray-800 text-white">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left side - About */}
          <div className="single-footer-widget">
            <h6 className="text-xl font-semibold mb-4">{t.aboutTitle}</h6>
            <p className="text-gray-300 mb-6 leading-relaxed whitespace-pre-line">
              {t.aboutText}
            </p>
            <p className="footer-text text-sm text-gray-400 leading-relaxed">
              {t.copyright.replace("{year}", new Date().getFullYear().toString())}
              <br />
              {t.license}
            </p>
          </div>

          {/* Right side - Social Media */}
          <div className="single-footer-widget">
            <h6 className="text-xl font-semibold mb-4">{t.followTitle}</h6>
            <p className="text-gray-300 mb-6">{t.socialText}</p>
            <div className="footer-social flex gap-4">
              <a
                href="mailto:nzmarie.com@gmail.com"
                target="_self"
                className="w-10 h-10 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition-colors duration-300"
                aria-label="Email"
              >
                <FaEnvelope className="text-white text-lg" />
              </a>
              <a
                href="https://www.facebook.com/nian.hong.10"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 bg-blue-600 hover:bg-blue-700 rounded-full flex items-center justify-center transition-colors duration-300"
                aria-label="Facebook"
              >
                <FaFacebookF className="text-white text-lg" />
              </a>
              <a
                href="https://www.linkedin.com/in/nzmarie"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 bg-blue-700 hover:bg-blue-800 rounded-full flex items-center justify-center transition-colors duration-300"
                aria-label="LinkedIn"
              >
                <FaLinkedinIn className="text-white text-lg" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
