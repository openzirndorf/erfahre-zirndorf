import { ChevronDown } from "lucide-react";
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { OzFooter } from "../components/oz-footer";
import faqData from "../faq";
import type { FaqEntry } from "../faq";

function FaqItem({ question, answer, steps, link }: FaqEntry) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 py-4 text-left"
      >
        <span className="font-semibold text-sm text-gray-900 leading-snug">{question}</span>
        <ChevronDown
          className="w-4 h-4 shrink-0 text-gray-400 transition-transform duration-200"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>
      {open && (
        <div className="pb-4">
          <p className="text-sm text-gray-600 leading-relaxed">{answer}</p>
          {steps && (
            <ol className="mt-2 space-y-1.5 text-sm text-gray-600">
              {steps.map((step, i) => (
                <li key={i} className="flex gap-2">
                  <span className="shrink-0 font-semibold" style={{ color: "var(--oz-brand-green)" }}>{i + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          )}
          {link && (
            <Link to={link.to} className="mt-2 inline-block text-sm font-semibold underline" style={{ color: "var(--oz-brand-green)" }}>
              {link.label}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

export function FaqPage() {
  return (
    <div className="max-w-[480px] mx-auto pb-24 md:pb-6">
      <div className="px-4 pt-6">
        <h1 className="text-xl font-black mb-1" style={{ fontFamily: "var(--oz-font-heading)" }}>
          Häufige Fragen
        </h1>
        <p className="text-sm text-gray-500 mb-6">Alles Wichtige zu Erfahre Zirndorf auf einen Blick.</p>

        <div className="bg-white rounded-2xl px-4" style={{ boxShadow: "var(--oz-shadow)" }}>
          {faqData.map((item) => (
            <FaqItem key={item.question} {...item} />
          ))}
        </div>
      </div>
      <div className="mt-6">
        <OzFooter />
      </div>
    </div>
  );
}
