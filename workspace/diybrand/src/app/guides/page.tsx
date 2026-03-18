'use client';

import { useState } from 'react';
import Link from 'next/link';

interface Guide {
  id: string;
  title: string;
  description: string;
  duration: string;
  icon: string;
}

const guides: Guide[] = [
  {
    id: 'getting-started',
    title: 'Getting Started in 5 Minutes',
    description: 'Learn how to create your complete brand kit from start to finish.',
    duration: '5 min',
    icon: '🚀',
  },
  {
    id: 'questionnaire',
    title: 'Understanding the Questionnaire',
    description: 'A walkthrough of each question and why it matters for your brand.',
    duration: '3 min',
    icon: '📝',
  },
  {
    id: 'using-logo',
    title: 'Using Your Logo Everywhere',
    description: 'Web, print, social media, and apps. How to use your logo in any format.',
    duration: '4 min',
    icon: '🎨',
  },
  {
    id: 'colors-fonts',
    title: 'Applying Colors & Fonts',
    description: 'How to integrate your color palette and fonts into your website.',
    duration: '6 min',
    icon: '🎨',
  },
  {
    id: 'regenerate-brand',
    title: 'Regenerating Your Brand',
    description: 'Not happy with your brand? Learn how to regenerate and try again.',
    duration: '2 min',
    icon: '🔄',
  },
  {
    id: 'export-formats',
    title: 'Understanding Export Formats',
    description: 'SVG, PNG, PDF, CSS, JSON — what each format is for and when to use it.',
    duration: '5 min',
    icon: '📦',
  },
];

const guideContent: Record<string, { title: string; steps: Array<{ title: string; content: string }> }> = {
  'getting-started': {
    title: 'Getting Started in 5 Minutes',
    steps: [
      {
        title: '1. Answer the Questionnaire (2 min)',
        content: `Start by answering questions about your business:
• Business name and industry
• Your target audience
• Brand personality (bold, minimal, playful, etc.)
• Color preferences (optional but helpful)

Don't overthink it. Your answers guide AI to create something unique to your brand.`,
      },
      {
        title: '2. Let AI Generate Your Brand (Instant)',
        content: `Once you submit, diybrand's AI instantly generates:
• 3 logo concepts
• A custom color palette (primary, secondary, accents)
• Font pairings ready to use
• Brand guidelines

Everything appears on your screen immediately.`,
      },
      {
        title: '3. Pick Your Favorites (1 min)',
        content: `Review what was generated:
• Hover over each logo to see variations
• Check if colors feel right
• Review the typography pairings
• Don't like something? Click "Regenerate" to try again

There's no wrong choice — pick what resonates with you.`,
      },
      {
        title: '4. Download Your Kit (1 min)',
        content: `Click "Download Brand Kit" to get:
• Logo files (SVG, PNG, PDF)
• Color codes (hex, RGB, CSS)
• Font files and CSS
• Brand guidelines PDF
• Social media templates
• All files as a ZIP

Everything is ready to use immediately.`,
      },
      {
        title: '5. Start Using Your Brand',
        content: `Your brand is now yours. Use it:
• Upload the logo to your website
• Copy color codes into your CSS
• Load fonts from the CSS file
• Use templates for social media
• Print materials use the PNG/PDF versions

No design experience needed.`,
      },
    ],
  },
  questionnaire: {
    title: 'Understanding the Questionnaire',
    steps: [
      {
        title: 'Business Basics',
        content: `What we ask: Business name, industry, how long you've been in business

Why it matters: This helps AI understand what your brand represents and what industry context matters. A law firm needs a different vibe than a yoga studio.`,
      },
      {
        title: 'Target Audience',
        content: `What we ask: Who are your customers? What do they care about?

Why it matters: The same business can have different brand vibes depending on audience. A luxury brand feels different from an affordable alternative for the same product.`,
      },
      {
        title: 'Brand Personality',
        content: `What we ask: Would you describe your brand as bold, minimal, playful, professional, creative, etc.?

Why it matters: This directly influences your logo, colors, and fonts. "Bold" gets strong typography and saturated colors. "Minimal" gets clean lines and subtle palettes.`,
      },
      {
        title: 'Color Preferences',
        content: `What we ask: Any colors you definitely want or definitely don't want?

Why it matters: Your preference is the final say. If you love blues and want to avoid pastels, we make sure your brand respects that.`,
      },
      {
        title: 'Quick Tips',
        content: `• Answer honestly. The better your answers, the better your brand.
• "Not applicable" is fine. Skip questions that don't fit.
• If you're not sure, go with your gut.
• You can always regenerate to try different answers.`,
      },
    ],
  },
  'using-logo': {
    title: 'Using Your Logo Everywhere',
    steps: [
      {
        title: 'Website (SVG)',
        content: `Best format: SVG

Why SVG: Scales perfectly on any device, tiny file size, crisp on retina displays.

How to add:
• Upload the SVG file to your website
• Use <img src="logo.svg" alt="Brand name" /> in HTML
• Or use as a background image in CSS

You get both vertical and horizontal versions. Use horizontal as your main logo, vertical for narrow spaces.`,
      },
      {
        title: 'Website (PNG Fallback)',
        content: `Use PNG if: Your website builder doesn't support SVG

Why PNG: Works everywhere, but needs to be larger for crisp quality. Use the 2x or 3x version for Retina displays.

How to add:
• Same as SVG: <img src="logo.png" alt="Brand name" />
• Download the PNG at 2x size for best quality`,
      },
      {
        title: 'Favicon (Browser Tab)',
        content: `Format: PNG or ICO

How to add:
• Place favicon.png in your /public folder
• Add to your HTML head: <link rel="icon" href="favicon.png" />
• Clear browser cache if it doesn't update immediately

Your logo will appear on every browser tab.`,
      },
      {
        title: 'Mobile App',
        content: `Format: Square PNG (180x180px, 192x192px)

For iOS: Use the square version as your app icon
For Android: Same square version

Size matters:
• 192x192px for Android app stores
• 180x180px for iOS

The square version is in your download package.`,
      },
      {
        title: 'Print Materials',
        content: `Best format: PDF or high-res PNG

For professional printing:
• Use PDF for the cleanest output
• Request 300 DPI (dots per inch) from your printer
• Print vendor will ask for colors in CMYK (we provide hex — ask printer to convert)
• Always print at original size or larger (never shrink below 1 inch)

For home printing:
• PNG at 300 DPI works fine
• Print at original size`,
      },
      {
        title: 'Social Media',
        content: `Format: PNG

Sizes to use:
• Instagram profile picture: Square at 200x200px
• Twitter header: 1500x500px (use social templates)
• LinkedIn background: 1500x500px
• Facebook cover: 820x312px

We provide templates sized correctly. Just swap in your logo PNG and add your own text/messaging.`,
      },
    ],
  },
  'colors-fonts': {
    title: 'Applying Colors & Fonts',
    steps: [
      {
        title: 'Getting Your Color Codes',
        content: `Your color palette includes:
• Primary color (your brand hero)
• Secondary color (supporting role)
• Accent colors (highlights and calls-to-action)

Where to find them:
• Brand guidelines PDF: Color specs clearly labeled
• colors.json file: All values in JSON format
• colors.css file: CSS variables ready to paste

Each color comes with:
• Hex code (#FFFFFF) — Use on web
• RGB values — Use in code/design tools
• Color names — Reference in documentation`,
      },
      {
        title: 'Using Colors on Your Website',
        content: `Easiest way: Copy the provided CSS variables

1. Download your colors.css file
2. Paste into your website's main CSS file
3. Now use in your site: background: var(--primary);

Without CSS variables:
1. Open colors.json
2. Copy hex codes into your stylesheet
3. Use like: color: #FF5733;

Best practices:
• Primary = buttons, headers, brand accents
• Secondary = borders, secondary buttons
• Accents = alerts, highlights, hover states`,
      },
      {
        title: 'Dark Mode Compatibility',
        content: `Your color palette works in light AND dark mode:
• Primary stays the same (it's high contrast)
• Secondary might need inverting for dark backgrounds
• Accents stay the same

For dark mode:
• Use your primary color on dark backgrounds (works great)
• Use light text on dark backgrounds
• Test contrast with WebAIM Contrast Checker to ensure readability

Our colors are designed for both modes.`,
      },
      {
        title: 'Getting Your Fonts',
        content: `All fonts are from Google Fonts (free, open source):

Where to find them:
• Brand guidelines PDF: Font names and usage
• fonts.css file: Google Fonts links ready to paste
• colors.json: Font family names

Your fonts include:
• Heading font (for titles and main text)
• Body font (for longer reading)
• Accent font (optional, for special emphasis)`,
      },
      {
        title: 'Adding Fonts to Your Website',
        content: `Easiest way: Copy the provided CSS

1. Download fonts.css or copy from colors.css
2. Paste the @import lines into your main CSS file
3. Use in your site: font-family: var(--font-heading);

Or add to HTML head:
<link href="https://fonts.googleapis.com/css2?family=NAME:wght@400;700" rel="stylesheet">

Then use in CSS:
h1 { font-family: 'Font Name', sans-serif; }`,
      },
      {
        title: 'Using Fonts in Figma/Adobe',
        content: `Google Fonts works in all design tools:

Figma:
1. Go to Fonts panel
2. Search for your font name
3. Select Google Fonts option
4. It loads automatically

Adobe Creative Cloud:
1. Fonts panel → Adobe Fonts → Search
2. Find your Google Font (or sync from Google Fonts directly)
3. Click "Activate"

Figma usually has better Google Fonts integration.`,
      },
    ],
  },
  'regenerate-brand': {
    title: 'Regenerating Your Brand',
    steps: [
      {
        title: 'When to Regenerate',
        content: `Regenerate if:
• The logo concepts don't feel right
• Colors don't match your vision
• Fonts aren't your style
• You want to try different questionnaire answers
• You have new information about your brand

You can regenerate unlimited times at no extra cost.`,
      },
      {
        title: 'How to Regenerate Logo Only',
        content: `Keep your colors and fonts, try new logos:

1. Go to the AI Studio section
2. Click "Regenerate Logos"
3. New logo concepts appear instantly
4. Review and pick your favorite

Regenerations are instant — no wait time.`,
      },
      {
        title: 'How to Regenerate Everything',
        content: `Start fresh with new questionnaire answers:

1. Click "New Brand" to restart
2. Answer the questionnaire again
3. Tweak your answers based on what you learned
4. AI generates new logos, colors, and fonts
5. Pick your new favorites

You can also reload your old session and regenerate from there.`,
      },
      {
        title: 'Mixing and Matching',
        content: `You don't have to love everything equally:
• Keep the logo you love, regenerate colors
• Keep the colors you love, regenerate fonts
• Keep the fonts, regenerate logo

Just pick your favorites from each generation.`,
      },
      {
        title: 'Tips for Better Results',
        content: `First time not ideal? Try:
• Being more specific in questionnaire answers
• Avoiding vague terms ("cool" → "bold and modern")
• Thinking about competitors you admire (style-wise)
• Considering your personality (playful vs. serious)

Regenerate 2-3 times. Most people love it by then.`,
      },
    ],
  },
  'export-formats': {
    title: 'Understanding Export Formats',
    steps: [
      {
        title: 'SVG (Scalable Vector Graphics)',
        content: `What it is: Vector format that scales infinitely without loss of quality

When to use:
• Websites and web apps (best choice)
• Social media (perfect for any size)
• Anything digital that needs to resize

Why SVG:
• Tiny file size
• Crisp on any device
• Can be edited with code
• Perfect for responsive design

File: logo.svg

Best for: Web logos, icons, digital-first use.`,
      },
      {
        title: 'PNG (Portable Network Graphics)',
        content: `What it is: Raster format with transparent background

When to use:
• Website fallback (if SVG doesn't work)
• Print materials (at high DPI)
• Social media (if you need to edit the image)
• Mobile apps

You get 3 versions:
• 1x: 500px (web)
• 2x: 1000px (Retina web)
• 3x: 1500px (extra high density)

Best for: Print, fallbacks, social media.`,
      },
      {
        title: 'PDF (Portable Document Format)',
        content: `What it is: Professional print format

When to use:
• Print materials (business cards, letterhead, etc.)
• Sharing with print vendors
• Anything needing guaranteed appearance

Why PDF:
• Professional printing standard
• Exactly matches screen design
• Print vendors understand it

Give PDF to: Printers, print shops, professional printing.`,
      },
      {
        title: 'JSON (JavaScript Object Notation)',
        content: `What it is: Structured data format for developers

When to use:
• Integrating brand with code/APIs
• Design systems and component libraries
• Automation scripts

What's in it:
• Logo metadata
• Color values (hex, RGB, CMYK)
• Font names and links
• Sizing guidelines

For developers who want to import brand programmatically.`,
      },
      {
        title: 'CSS (Stylesheets)',
        content: `What it is: Ready-to-use styling code

Contains:
• CSS variables for colors (--primary, --secondary)
• Font imports from Google Fonts
• Color definitions in multiple formats

How to use:
1. Copy colors.css into your project
2. Use variables: background: var(--primary);
3. Or inline hex codes: background: #FF5733;

Best for: Web developers building sites.`,
      },
      {
        title: 'Brand Guidelines PDF',
        content: `What it is: Your complete brand manual

Includes:
• Logo usage rules (do's and don'ts)
• Color specifications and meanings
• Typography guidelines
• Logo examples in context
• Social media templates
• Favicon specs

Why you need it:
• Share with team/contractors
• Ensure consistent brand use
• Impress clients with professionalism

Everyone who uses your brand should read this.`,
      },
    ],
  },
};

const GuidesPage = () => {
  const [selectedGuide, setSelectedGuide] = useState<string | null>(null);

  const currentGuide = selectedGuide ? guideContent[selectedGuide] : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="border-b border-slate-700/50 bg-slate-900/50 backdrop-blur-sm">
        <div className="mx-auto max-w-5xl px-6 py-12">
          <h1 className="text-4xl font-bold text-white mb-2">How-To Guides</h1>
          <p className="text-slate-400">
            Step-by-step instructions for every feature. Perfect for learning at your own pace.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-5xl px-6 py-12">
        {!selectedGuide ? (
          // Guide List
          <div className="grid gap-6 md:grid-cols-2">
            {guides.map((guide) => (
              <button
                key={guide.id}
                onClick={() => setSelectedGuide(guide.id)}
                className="text-left rounded-lg bg-slate-800 border border-slate-700 p-6 hover:border-blue-500 hover:shadow-lg hover:shadow-blue-500/10 transition-all group"
              >
                <div className="flex items-start gap-4">
                  <span className="text-3xl">{guide.icon}</span>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors">
                      {guide.title}
                    </h3>
                    <p className="text-slate-400 text-sm mt-2">{guide.description}</p>
                    <p className="text-slate-500 text-xs mt-3">{guide.duration} read</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          // Guide Detail
          <div>
            <button
              onClick={() => setSelectedGuide(null)}
              className="mb-6 inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to guides
            </button>

            <div className="rounded-lg bg-slate-800 border border-slate-700 p-8">
              <h2 className="text-3xl font-bold text-white mb-8">{currentGuide?.title}</h2>

              <div className="space-y-8">
                {currentGuide?.steps.map((step, idx) => (
                  <div key={idx} className="border-l-4 border-blue-500 pl-6">
                    <h3 className="text-xl font-bold text-white mb-3">{step.title}</h3>
                    <p className="text-slate-300 whitespace-pre-wrap leading-relaxed">
                      {step.content}
                    </p>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <div className="mt-12 pt-8 border-t border-slate-700">
                <p className="text-slate-400 mb-4">Need more help?</p>
                <div className="flex gap-4">
                  <a
                    href="/faq"
                    className="inline-block px-6 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
                  >
                    Visit FAQ
                  </a>
                  <a
                    href="mailto:support@diybrand.app"
                    className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Email support
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GuidesPage;
