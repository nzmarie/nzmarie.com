"use client";

import React from "react";
import Header from "./Header";
import Hero from "./Hero";
import About from "./About";
import AppraisalSection from "./AppraisalSection";
import Services from "./Services";
import PropertyListings from "./PropertyListings";
import Contact from "./Contact";
import ReportDownloadSection from "./ReportDownloadSection";
import Footer from "./Footer";
import Qualifications from "./Qualifications";
import { Language } from "../lib/translations";

export default function MainPageContent({ lang = "en" }: { lang?: Language }) {
    return (
        <main>
            <Header lang={lang} />
            <Hero lang={lang} />
            <About lang={lang} />
            <AppraisalSection lang={lang} />
            <Services lang={lang} />
            <PropertyListings lang={lang} />
            <Qualifications lang={lang} />
            <Contact lang={lang} />
            <ReportDownloadSection lang={lang} />
            <Footer lang={lang} />
        </main>
    );
}
