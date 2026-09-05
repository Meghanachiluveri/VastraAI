import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PageContainer } from '../components/common/PageContainer';
import { SectionHeading } from '../components/common/SectionHeading';
import { Button } from '../components/common/Button';
import { ProductGrid } from '../components/product/ProductGrid';
import { api } from '../services/api';
import type { Product } from '../types/types';
import { Sparkles, ArrowRight, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { sectionFadeUpVariants } from '../lib/motion';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    const loadCatalog = async () => {
      setIsLoading(true);
      try {
        const products = await api.getProducts();
        setAllProducts(products);
      } catch (err) {
        console.error('Failed to load products:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadCatalog();
  }, []);

  // Split into curated sets of 6–8 products
  const newArrivals = allProducts.slice(0, 8);
  const trendingNow = allProducts.slice(8, 16);

  const categories = [
    {
      id: 'cat-men',
      name: 'Men',
      description: 'Handloom bandhgalas, artisanal linens & tailored selvedge denim',
      slug: '/men',
      imageUrl: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=1000&q=85',
    },
    {
      id: 'cat-women',
      name: 'Women',
      description: 'Chanderi silk trench dresses, cashmere sarees & sculptural co-ords',
      slug: '/women',
      imageUrl: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=1000&q=85',
    },
    {
      id: 'cat-acc',
      name: 'Accessories',
      description: 'Full-grain leather totes, GI-certified pashmina shawls & brass accents',
      slug: '/shop?category=accessories',
      imageUrl: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1000&q=85',
    },
  ];

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (newsletterEmail.trim()) {
      setIsSubscribed(true);
      setNewsletterEmail('');
    }
  };

  return (
    <div className="space-y-20 md:space-y-28 pb-16">
      
      {/* 1. HERO SECTION */}
      <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden bg-[#2A2A2A] text-[#F6F7F2]">
        
        {/* Cinematic Background Image */}
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=2000&q=85"
            alt="Vastra Editorial Campaign"
            className="w-full h-full object-cover object-center opacity-50 scale-105 transform"
          />
          
          {/* Layered Editorial Gradient Overlays */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'linear-gradient(180deg, rgba(42, 42, 42, 0.3) 0%, rgba(42, 42, 42, 0.2) 45%, rgba(42, 42, 42, 0.85) 100%)',
            }}
          />
          
          {/* Ambient Warm Sage Glow */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at 50% 40%, rgba(138, 164, 138, 0.20) 0%, transparent 65%)',
            }}
          />
        </div>

        {/* Hero Content */}
        <PageContainer className="relative z-10 py-20 text-center flex flex-col items-center">
          
          {/* Eyebrow */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full backdrop-blur-md text-xs font-semibold uppercase tracking-widest mb-5 select-none"
            style={{
              borderColor: 'rgba(138, 164, 138, 0.45)',
              borderWidth: '1px',
              backgroundColor: 'rgba(138, 164, 138, 0.15)',
              color: '#CFD8CF',
            }}
          >
            <Sparkles className="w-3.5 h-3.5 text-[#8AA48A]" />
            <span className="text-[#F6F7F2]">AUTUMN / WINTER 2026 ATELIER DROP</span>
          </motion.div>

          {/* Heading */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-serif font-normal tracking-tight max-w-5xl leading-[1.08] text-[#F6F7F2]"
          >
            Fashion, found <span className="italic font-light text-[#8AA48A]">intelligently.</span>
          </motion.h1>

          {/* Subtle Sage Editorial Detail Line */}
          <motion.div
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="w-14 h-[1.5px] bg-[#8AA48A] my-4"
          />

          {/* Supporting Text */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="text-sm sm:text-base md:text-lg text-stone-300 max-w-2xl font-light leading-relaxed"
          >
            Vastra combines a luxury visual storefront with an intelligent AI personal stylist. 
            Discover artisanal Indian handlooms architected for timeless contemporary living.
          </motion.p>

          {/* Hero CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35 }}
            className="mt-9 flex flex-col sm:flex-row items-center gap-4 w-full justify-center max-w-md"
          >
            {/* Primary CTA: Shop the collection */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/shop')}
              className="w-full sm:w-auto inline-flex items-center justify-center font-medium tracking-wide transition-all duration-200 select-none text-xs sm:text-sm px-7 py-3.5 rounded-full gap-2 uppercase tracking-editorial border border-[#E6E2DA] text-[#F6F7F2] bg-transparent hover:bg-[#CFD8CF] hover:text-[#2A2A2A]"
            >
              <span>Shop the collection</span>
              <ArrowRight className="w-4 h-4" />
            </motion.button>

            {/* Secondary CTA: Shop with AI - Opens in NEW TAB */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              whileHover={{ scale: 1.02 }}
              onClick={() => window.open('/agent', '_blank', 'noopener,noreferrer')}
              className="w-full sm:w-auto inline-flex items-center justify-center font-medium tracking-wide transition-all duration-300 select-none text-xs sm:text-sm px-7 py-3.5 rounded-full gap-2.5 uppercase tracking-editorial bg-[#8AA48A]/90 hover:bg-[#8AA48A] text-[#1E231E] border border-[#A2BBA2] shadow-sm backdrop-blur-xs group cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-[#1E231E] group-hover:rotate-12 transition-transform duration-300" />
              <span className="font-semibold">Shop with AI</span>
              <ArrowRight className="w-4 h-4 text-[#1E231E] opacity-75 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-200" />
            </motion.button>
          </motion.div>

        </PageContainer>
      </section>

      {/* 2. SHOP BY CATEGORY (Men, Women, Accessories) */}
      <PageContainer>
        <SectionHeading
          eyebrow="Explore By Universe"
          title="Shop by Category"
          subtitle="Explore curated menswear, womenswear, and handcrafted accessories designed for effortless versatility."
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              to={cat.slug}
              className="group relative flex flex-col overflow-hidden rounded-3xl bg-[#2A2A2A] border border-[#E6E2DA] dark:border-[#3E443D] aspect-[4/5] shadow-subtle hover:shadow-soft transition-all"
            >
              <img
                src={cat.imageUrl}
                alt={cat.name}
                loading="lazy"
                className="w-full h-full object-cover object-center opacity-85 group-hover:scale-103 group-hover:opacity-95 transition-all duration-700 ease-out"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#2A2A2A] via-[#2A2A2A]/30 to-transparent" />
              
              <div className="absolute inset-x-0 bottom-0 p-7 flex flex-col justify-end space-y-1.5 text-[#F6F7F2]">
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-serif font-medium group-hover:text-[#8AA48A] transition-colors">
                    {cat.name}
                  </h3>
                  <div className="w-9 h-9 rounded-full bg-white/10 backdrop-blur-xs flex items-center justify-center group-hover:bg-[#8AA48A] group-hover:text-[#2A2A2A] transition-colors">
                    <ArrowUpRight className="w-4 h-4 text-white group-hover:text-[#2A2A2A]" />
                  </div>
                </div>
                <p className="text-xs text-stone-300 line-clamp-2 font-light leading-relaxed">
                  {cat.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </PageContainer>

      {/* 3. NEW ARRIVALS (6–8 Products with Skeleton) */}
      <PageContainer>
        <SectionHeading
          eyebrow="Seasonal Drop"
          title="New arrivals"
          subtitle="Sculptural silhouettes tailored in small-batch runs from Bhagalpur silk, organic Khadi, and Belgian linen."
          action={
            <Link
              to="/new-arrivals"
              className="inline-flex items-center gap-1.5 text-xs uppercase tracking-widest font-semibold text-[#8AA48A] hover:text-[#758E75] transition-colors"
            >
              <span>View All ({allProducts.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          }
        />

        <ProductGrid products={newArrivals} isLoading={isLoading} columns={4} />
      </PageContainer>

      {/* 4. AI PROMOTION BANNER */}
      <PageContainer>
        <motion.div
          variants={sectionFadeUpVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="relative overflow-hidden rounded-3xl bg-[#FCFCF9] dark:bg-[#343833] border border-[#E6E2DA] dark:border-[#3E443D] p-8 sm:p-12 lg:p-16 shadow-soft text-center flex flex-col items-center space-y-6"
        >
          {/* Subtle Ambient Glow */}
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#8AA48A]/15 rounded-full blur-3xl pointer-events-none" />

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#CFD8CF]/60 dark:bg-[#3E443D] border border-[#8AA48A]/30 text-[#4A5B4A] dark:text-[#8AA48A] text-xs font-semibold tracking-widest uppercase">
            <Sparkles className="w-3.5 h-3.5 text-[#8AA48A]" />
            <span>VASTRA AI CONCIERGE</span>
          </div>

          <div className="space-y-2 max-w-2xl">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif font-normal text-[#2A2A2A] dark:text-[#F6F7F2] tracking-tight">
              Not sure what to wear?
            </h2>
            <p className="text-base sm:text-lg text-text-secondary dark:text-[#C8CDC5] font-light">
              Let Vastra AI curate it for you.
            </p>
          </div>

          <p className="text-xs sm:text-sm text-text-secondary dark:text-[#C8CDC5] max-w-lg font-light leading-relaxed">
            Describe an event, mood, climate or budget in plain words. Our personal stylist intelligence cross-references the entire catalog to assemble your tailored edit.
          </p>

          <div className="pt-2">
            <Button
              variant="primary"
              size="lg"
              onClick={() => window.open('/agent', '_blank', 'noopener,noreferrer')}
              leftIcon={<Sparkles className="w-4 h-4 text-[#2A2A2A]" />}
            >
              Ask Vastra AI
            </Button>
          </div>
        </motion.div>
      </PageContainer>

      {/* 5. TRENDING NOW (6–8 Products with Staggered Framer Motion Reveal) */}
      <PageContainer>
        <SectionHeading
          eyebrow="Client Favorites"
          title="Trending now"
          subtitle="Our most sought-after atelier garments, trending across private clients globally."
          action={
            <Link
              to="/shop"
              className="inline-flex items-center gap-1.5 text-xs uppercase tracking-widest font-semibold text-[#8AA48A] hover:text-[#758E75] transition-colors"
            >
              <span>Explore All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          }
        />

        <ProductGrid products={trendingNow} isLoading={isLoading} columns={4} />
      </PageContainer>

      {/* 6. NEWSLETTER ("Join the Vastra edit.") */}
      <PageContainer>
        <motion.div
          variants={sectionFadeUpVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="rounded-3xl bg-[#CFD8CF]/30 dark:bg-[#1F231F] border border-[#E6E2DA] dark:border-[#3E443D] p-8 sm:p-12 lg:p-16 text-center flex flex-col items-center space-y-4 max-w-4xl mx-auto shadow-subtle"
        >
          <span className="text-xs uppercase tracking-widest text-[#4A5B4A] dark:text-[#8AA48A] font-semibold">
            Private Client Roster
          </span>
          <h2 className="text-3xl sm:text-4xl font-serif text-[#2A2A2A] dark:text-[#F6F7F2] font-normal">
            Join the Vastra edit.
          </h2>
          <p className="text-xs sm:text-sm text-text-secondary dark:text-[#C8CDC5] font-light max-w-md leading-relaxed">
            Receive private previews of limited edition drops, textile monographs, and intelligent styling releases.
          </p>

          {isSubscribed ? (
            <div className="flex items-center gap-2 text-sm text-[#4A5B4A] dark:text-[#8AA48A] font-medium pt-2">
              <CheckCircle2 className="w-5 h-5" />
              <span>You have been added to the private client roster.</span>
            </div>
          ) : (
            <form onSubmit={handleSubscribe} className="pt-3 w-full max-w-md">
              <div className="relative flex items-center bg-[#FCFCF9] dark:bg-[#343833] p-1.5 pl-5 rounded-full border border-[#E6E2DA] dark:border-[#3E443D] shadow-subtle focus-within:border-[#8AA48A]">
                <input
                  type="email"
                  required
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  placeholder="Enter your email address"
                  className="w-full bg-transparent text-sm text-[#2A2A2A] dark:text-[#F6F7F2] placeholder-text-secondary/70 focus:outline-none pr-28"
                />
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  className="absolute right-1.5"
                >
                  Join
                </Button>
              </div>
            </form>
          )}
        </motion.div>
      </PageContainer>

    </div>
  );
};
