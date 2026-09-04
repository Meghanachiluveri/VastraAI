import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, CheckCircle2 } from 'lucide-react';
import { Button } from '../common/Button';

export const Footer: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      setIsSubscribed(true);
      setEmail('');
    }
  };

  return (
    <footer className="bg-[#2A2A2A] text-[#F6F7F2] border-t border-[#3E443D] transition-colors pt-16 pb-12 relative">
      {/* Subtle Sage Top Line */}
      <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-[#8AA48A]/50 to-transparent" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Top Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 lg:gap-12 pb-16 border-b border-[#3E443D]/80">
          
          {/* Brand Manifesto */}
          <div className="lg:col-span-4 space-y-4">
            <Link to="/" className="inline-flex items-center group">
              <span className="text-2xl font-serif tracking-tight text-[#F6F7F2] font-medium">
                Vastra
              </span>
              <span className="text-xs font-sans tracking-widest font-bold text-[#8AA48A] uppercase ml-0.5 relative top-[-1px]">
                .AI
              </span>
            </Link>

            <p className="text-xs sm:text-sm text-[#C8CDC5] font-light leading-relaxed max-w-sm">
              "Fashion, found intelligently." <br />
              Bridging centuries of Indian artisanal textile heritage with modern architectural silhouettes and intelligent AI curation.
            </p>

            <div className="pt-2">
              <a
                href="/agent"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs text-[#8AA48A] hover:text-[#CFD8CF] tracking-wider uppercase font-medium transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI Stylist Consultation</span>
              </a>
            </div>

            {/* Social Icons */}
            <div className="flex items-center gap-3 pt-2">
              <a
                href="#instagram"
                aria-label="Instagram"
                className="w-9 h-9 rounded-full bg-[#3E443D] hover:bg-[#8AA48A] hover:text-[#2A2A2A] text-[#F6F7F2] flex items-center justify-center transition-colors"
              >
                <svg className="w-4 h-4 fill-currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
              </a>
              <a
                href="#twitter"
                aria-label="X / Twitter"
                className="w-9 h-9 rounded-full bg-[#3E443D] hover:bg-[#8AA48A] hover:text-[#2A2A2A] text-[#F6F7F2] flex items-center justify-center transition-colors"
              >
                <svg className="w-4 h-4 fill-currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a
                href="#facebook"
                aria-label="Facebook"
                className="w-9 h-9 rounded-full bg-[#3E443D] hover:bg-[#8AA48A] hover:text-[#2A2A2A] text-[#F6F7F2] flex items-center justify-center transition-colors"
              >
                <svg className="w-4 h-4 fill-currentColor" viewBox="0 0 24 24">
                  <path d="M9 8H6v4h3v12h5V12h3.642L18 8h-4V6.333C14 5.374 14.5 5 15.667 5H18V0h-3.808C10.595 0 9 1.582 9 4.615V8z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Shop Links */}
          <div className="lg:col-span-2 space-y-3">
            <h4 className="text-xs uppercase tracking-widest font-semibold text-[#F6F7F2]">
              Shop
            </h4>
            <ul className="space-y-2 text-xs text-[#C8CDC5]">
              <li>
                <Link to="/men" className="hover:text-[#8AA48A] transition-colors">
                  Men's Atelier
                </Link>
              </li>
              <li>
                <Link to="/women" className="hover:text-[#8AA48A] transition-colors">
                  Women's Atelier
                </Link>
              </li>
              <li>
                <Link to="/shop?category=accessories" className="hover:text-[#8AA48A] transition-colors">
                  Accessories
                </Link>
              </li>
              <li>
                <Link to="/new-arrivals" className="hover:text-[#8AA48A] transition-colors">
                  New Arrivals
                </Link>
              </li>
              <li>
                <Link to="/shop" className="hover:text-[#8AA48A] transition-colors">
                  Full Catalog
                </Link>
              </li>
            </ul>
          </div>

          {/* About & AI Stylist */}
          <div className="lg:col-span-2 space-y-3">
            <h4 className="text-xs uppercase tracking-widest font-semibold text-[#F6F7F2]">
              About & AI
            </h4>
            <ul className="space-y-2 text-xs text-[#C8CDC5]">
              <li>
                <a
                  href="/agent"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[#8AA48A] transition-colors cursor-pointer"
                >
                  AI Personal Stylist
                </a>
              </li>
              <li>
                <span className="hover:text-[#8AA48A] cursor-pointer transition-colors">
                  Artisanal Provenance
                </span>
              </li>
              <li>
                <span className="hover:text-[#8AA48A] cursor-pointer transition-colors">
                  Generational Looms
                </span>
              </li>
              <li>
                <Link to="/merchant" className="hover:text-[#8AA48A] transition-colors flex items-center gap-1">
                  <span>Merchant Portal</span>
                  <span className="text-[9px] px-1 py-0.2 bg-[#8AA48A]/20 text-[#8AA48A] rounded">BI</span>
                </Link>
              </li>
              <li>
                <span className="hover:text-[#8AA48A] cursor-pointer transition-colors">
                  Sustainability Ethos
                </span>
              </li>
              <li>
                <span className="hover:text-[#8AA48A] cursor-pointer transition-colors">
                  Atelier Philosophy
                </span>
              </li>
            </ul>
          </div>

          {/* Customer Care */}
          <div className="lg:col-span-2 space-y-3">
            <h4 className="text-xs uppercase tracking-widest font-semibold text-[#F6F7F2]">
              Customer Care
            </h4>
            <ul className="space-y-2 text-xs text-[#C8CDC5]">
              <li>
                <span className="hover:text-[#8AA48A] cursor-pointer transition-colors">
                  Sizing Guide
                </span>
              </li>
              <li>
                <span className="hover:text-[#8AA48A] cursor-pointer transition-colors">
                  Express Shipping
                </span>
              </li>
              <li>
                <span className="hover:text-[#8AA48A] cursor-pointer transition-colors">
                  Complimentary Returns
                </span>
              </li>
              <li>
                <span className="hover:text-[#8AA48A] cursor-pointer transition-colors">
                  Order Tracking
                </span>
              </li>
              <li>
                <span className="hover:text-[#8AA48A] cursor-pointer transition-colors">
                  Private Concierge
                </span>
              </li>
            </ul>
          </div>

          {/* Newsletter */}
          <div className="lg:col-span-2 space-y-3">
            <h4 className="text-xs uppercase tracking-widest font-semibold text-[#F6F7F2]">
              Newsletter
            </h4>
            <p className="text-xs text-[#C8CDC5] font-light leading-relaxed">
              Private previews of limited seasonal drops.
            </p>

            {isSubscribed ? (
              <div className="flex items-center gap-1.5 text-xs text-[#8AA48A] pt-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Subscribed</span>
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="space-y-2 pt-1">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Your email"
                  className="w-full bg-[#343833] border border-[#3E443D] text-xs px-3.5 py-2 rounded-full text-[#F6F7F2] placeholder-stone-400 focus:outline-none focus:border-[#8AA48A]"
                />
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  className="w-full"
                >
                  Join
                </Button>
              </form>
            )}
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-[11px] text-[#C8CDC5] gap-4">
          <p>© {new Date().getFullYear()} Vastra.AI. All rights reserved. Fashion, found intelligently.</p>
          <div className="flex items-center gap-6">
            <span className="hover:text-[#8AA48A] cursor-pointer transition-colors">Privacy Policy</span>
            <span className="hover:text-[#8AA48A] cursor-pointer transition-colors">Terms of Service</span>
            <span className="hover:text-[#8AA48A] cursor-pointer transition-colors">Accessibility</span>
          </div>
        </div>

      </div>
    </footer>
  );
};
