'use client';

import { useState } from 'react';
import Link from 'next/link';

interface FAQItem {
  category: string;
  questions: Array<{
    q: string;
    a: string;
  }>;
}

const faqData: FAQItem[] = [
  {
    category: 'Getting Started',
    questions: [
      {
        q: 'How long does it take to create a brand?',
        a: 'Most brands are created in 5-15 minutes. The initial questionnaire takes 5 minutes, AI generation is instant, and you can download your complete brand kit immediately.',
      },
      {
        q: 'Do I need design experience?',
        a: 'No. diybrand is built for non-designers. Answer simple questions about your business, and AI handles the design. You just pick what you like.',
      },
      {
        q: 'Can I start for free?',
        a: 'Yes. The early access pricing is $49 for a complete brand kit. We may offer a limited free tier in the future, but for now that\'s our standard rate.',
      },
      {
        q: 'Is there a money-back guarantee?',
        a: 'Yes, 100%. If you\'re not happy with your brand, get a full refund within 30 days. No questions asked.',
      },
    ],
  },
  {
    category: 'The Questionnaire',
    questions: [
      {
        q: 'What questions will I answer?',
        a: 'We ask about your business name, industry, target audience, brand personality, and visual preferences. It\'s designed to be quick and intuitive — no right or wrong answers.',
      },
      {
        q: 'Can I skip questions?',
        a: 'Some questions are required to generate a meaningful brand. If something doesn\'t apply to you, we provide options like "Not applicable" or "Skip this question."',
      },
      {
        q: 'What if I don\'t have a business name yet?',
        a: 'You can use a placeholder name and come back to it. Your brand colors, fonts, and logo will still work with any business name.',
      },
      {
        q: 'Can I redo the questionnaire?',
        a: 'Yes. You can retake the questionnaire to regenerate your entire brand. Just start a new session.',
      },
    ],
  },
  {
    category: 'AI Logo Generation',
    questions: [
      {
        q: 'Will my logo be unique?',
        a: 'Yes. diybrand uses Google Gemini Imagen to generate unique logos based on your answers. Each generation is custom to your brand.',
      },
      {
        q: 'What if I don\'t like the logos?',
        a: 'Regenerate them. You can create as many variations as you want until one clicks. There\'s no limit to regenerations.',
      },
      {
        q: 'Can I edit the logo after?',
        a: 'The logo export is in SVG format (vector), so you can edit it in any design tool like Adobe Illustrator, Figma, or Inkscape. We also provide PNG for easy web use.',
      },
      {
        q: 'Are there favicon and app icon versions?',
        a: 'Yes. Your final logo comes in multiple formats: full horizontal/stacked versions, square icons for apps, and favicon size. All included.',
      },
    ],
  },
  {
    category: 'Colors & Typography',
    questions: [
      {
        q: 'Can I customize the color palette?',
        a: 'Your colors are tailored to your brand personality. If you want tweaks, you can regenerate from the questionnaire or edit the hex values in any design tool.',
      },
      {
        q: 'Where do the fonts come from?',
        a: 'All fonts are from Google Fonts — free, open-source, and license-free for personal and commercial use.',
      },
      {
        q: 'Can I change the fonts?',
        a: 'Yes. The exported CSS and JSON files include font links and names. You can swap in your favorite Google Fonts anytime.',
      },
      {
        q: 'What\'s a "color palette"?',
        a: 'Your palette includes a primary color (your brand hero), a secondary color (supporting), and accent colors. Use primary/secondary everywhere, accents for highlights.',
      },
    ],
  },
  {
    category: 'Exporting Your Brand',
    questions: [
      {
        q: 'What files do I get?',
        a: 'You get SVG, PNG, PDF, CSS, JSON, and a brand guidelines PDF. Everything you need for web, print, and social media.',
      },
      {
        q: 'Can I use my brand commercially?',
        a: 'Yes, absolutely. Once you download your brand kit, it\'s entirely yours. Use it on your website, client projects, print materials, social media — no restrictions.',
      },
      {
        q: 'Do I own the logo?',
        a: 'Yes. The logo you generate is yours to keep and use forever. There are no royalties or recurring fees.',
      },
      {
        q: 'What\'s in the brand guidelines PDF?',
        a: 'Color specs (hex, RGB), typography guidelines, logo usage rules, and examples of your brand in action. Share it with anyone designing for your brand.',
      },
      {
        q: 'Can I export again if I lose my files?',
        a: 'You can regenerate your brand from the same questionnaire answers anytime. If you lose your session link, create a new brand with similar answers.',
      },
    ],
  },
  {
    category: 'Using Your Brand Files',
    questions: [
      {
        q: 'How do I add my logo to my website?',
        a: 'Upload the SVG or PNG to your website builder. SVG is best because it scales perfectly. PNG works too if your builder doesn\'t support SVG.',
      },
      {
        q: 'How do I use the colors on my website?',
        a: 'Copy the hex codes from your color palette into your CSS. We also provide a colors.json file with all values for easy integration.',
      },
      {
        q: 'Can I use these fonts on my website?',
        a: 'Yes. The CSS file includes Google Fonts links. Just paste the CSS into your site, and the fonts load automatically.',
      },
      {
        q: 'What about Figma, Adobe, or other design tools?',
        a: 'Import the PNG logo and note the hex codes and font names. All our fonts are on Google Fonts, so they\'re available in every design tool.',
      },
      {
        q: 'Can I use my brand on social media templates?',
        a: 'Yes. We include social media templates pre-sized for Instagram, Twitter, and LinkedIn. Customize with your messaging and post.',
      },
    ],
  },
  {
    category: 'Troubleshooting',
    questions: [
      {
        q: 'The page won\'t load or I see an error.',
        a: 'Try refreshing the page or clearing your browser cache. If that doesn\'t work, try a different browser. Let us know what error you see and we\'ll help.',
      },
      {
        q: 'The color picker didn\'t appear.',
        a: 'This is a known issue on some browsers. Try refreshing, or use a different browser (Chrome or Safari usually work best).',
      },
      {
        q: 'My browser blocked something or I got a CORS error.',
        a: 'This can happen with strict browser settings or VPNs. Try disabling browser extensions, using a different network, or contacting us with the error details.',
      },
      {
        q: 'I can\'t download my files.',
        a: 'Make sure pop-ups aren\'t blocked in your browser. Try right-clicking the download button and selecting "Save link as." If issues persist, refresh and try again.',
      },
      {
        q: 'What if I found a bug?',
        a: 'We\'d love to know. Describe what happened, what you were doing, and what you expected. Email us or use the feedback form on the site.',
      },
    ],
  },
  {
    category: 'Pricing & Refunds',
    questions: [
      {
        q: 'Why does diybrand cost $49?',
        a: 'That covers AI generation, file processing, hosting, and support. It\'s a one-time fee with no subscriptions or recurring charges.',
      },
      {
        q: 'Are there different pricing tiers?',
        a: 'Right now, everyone gets the same complete brand kit for $49. We\'re exploring tiered options in the future.',
      },
      {
        q: 'Do you offer discounts for bulk orders or teams?',
        a: 'Each person gets their own custom brand. Contact us if you\'d like to explore options for teams or multiple brands.',
      },
      {
        q: 'What\'s your refund policy?',
        a: '30-day money-back guarantee. If you\'re not happy, get a full refund. No questions, no hassle.',
      },
      {
        q: 'How do I request a refund?',
        a: 'Email us with your order details. We\'ll process it within 2-3 business days.',
      },
    ],
  },
  {
    category: 'Privacy & Security',
    questions: [
      {
        q: 'Is my data safe?',
        a: 'Yes. We use industry-standard encryption and don\'t share your data with third parties. Your brand answers are only used to generate your brand.',
      },
      {
        q: 'Do you store my brand data?',
        a: 'We keep your questionnaire answers so you can regenerate your brand. You can delete your data anytime by contacting us.',
      },
      {
        q: 'What happens to my payment information?',
        a: 'Payments are processed securely by Stripe. We never see your full card number. You\'re in control of your data.',
      },
    ],
  },
];

const FAQPage = () => {
  const [openCategory, setOpenCategory] = useState<string | null>(
    faqData[0].category
  );
  const [searchTerm, setSearchTerm] = useState('');

  const filteredData = faqData
    .map((category) => ({
      ...category,
      questions: category.questions.filter(
        (q) =>
          q.q.toLowerCase().includes(searchTerm.toLowerCase()) ||
          q.a.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    }))
    .filter((category) => category.questions.length > 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="border-b border-slate-700/50 bg-slate-900/50 backdrop-blur-sm">
        <div className="mx-auto max-w-4xl px-6 py-12">
          <h1 className="text-4xl font-bold text-white mb-2">Frequently Asked Questions</h1>
          <p className="text-slate-400 mb-6">
            Find answers to common questions about creating your brand with diybrand.
          </p>

          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search questions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <span className="absolute right-4 top-3.5 text-slate-500">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-4xl px-6 py-12">
        <div className="grid gap-8 md:grid-cols-12">
          {/* Category Nav */}
          <nav className="md:col-span-3">
            <div className="sticky top-8 space-y-2">
              {faqData.map((category) => (
                <button
                  key={category.category}
                  onClick={() => setOpenCategory(category.category)}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-all ${
                    openCategory === category.category
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {category.category}
                </button>
              ))}
            </div>
          </nav>

          {/* Q&A */}
          <div className="md:col-span-9 space-y-4">
            {filteredData.length === 0 ? (
              <div className="rounded-lg bg-slate-800 border border-slate-700 p-8 text-center">
                <p className="text-slate-400">
                  No questions match "{searchTerm}". Try a different search.
                </p>
              </div>
            ) : (
              filteredData.map((category) => (
                <div key={category.category} className="space-y-3">
                  {category.questions.map((item, idx) => (
                    <details
                      key={idx}
                      className="group rounded-lg bg-slate-800 border border-slate-700 hover:border-slate-600 transition-all"
                    >
                      <summary className="flex cursor-pointer items-center justify-between px-6 py-4 select-none">
                        <span className="text-white font-medium group-open:text-blue-400">
                          {item.q}
                        </span>
                        <span className="ml-4 flex-shrink-0 text-slate-500 group-open:text-blue-400">
                          <svg
                            className="h-5 w-5 transform transition-transform group-open:rotate-180"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 14l-7 7m0 0l-7-7m7 7V3"
                            />
                          </svg>
                        </span>
                      </summary>
                      <div className="border-t border-slate-700 px-6 py-4">
                        <p className="text-slate-300 leading-relaxed">{item.a}</p>
                      </div>
                    </details>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-16 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 p-8 text-center">
          <h2 className="text-2xl font-bold text-white mb-2">Still have a question?</h2>
          <p className="text-blue-100 mb-6">
            We\'re here to help. Reach out anytime.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <a
              href="mailto:support@diybrand.app"
              className="inline-block px-6 py-2 bg-white text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition-colors"
            >
              Email us
            </a>
            <Link
              href="/"
              className="inline-block px-6 py-2 border border-blue-200 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Back to home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FAQPage;
