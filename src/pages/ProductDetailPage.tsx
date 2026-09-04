import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PageContainer } from '../components/common/PageContainer';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { ProductCard } from '../components/product/ProductCard';
import { LoadingState } from '../components/common/LoadingState';
import { api } from '../services/api';
import { productService, COLOR_SWATCHES } from '../services/productService';
import { useCartStore } from '../stores/useCartStore';
import type { Product } from '../types/types';
import { formatCurrency } from '../lib/utils';
import {
  ShoppingBag,
  Sparkles,
  Heart,
  ChevronRight,
  Plus,
  Minus,
  Check,
  Star,
  ShieldCheck,
  Truck,
  RotateCcw,
  Ruler,
  UserCheck,
  ThumbsUp,
} from 'lucide-react';

export const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const addItem = useCartStore((state) => state.addItem);

  const [product, setProduct] = useState<Product | null>(null);
  const [completeTheLook, setCompleteTheLook] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Interaction State
  const [selectedColorIdx, setSelectedColorIdx] = useState(0);
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [isAdded, setIsAdded] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'fabric' | 'sizing' | 'shipping'>('details');

  // Secondary Images for Gallery
  const [galleryImages, setGalleryImages] = useState<string[]>([]);

  useEffect(() => {
    const fetchProduct = async () => {
      if (!id) return;
      setIsLoading(true);
      const found = await api.getProductById(id);
      if (found) {
        setProduct(found);
        setSelectedColorIdx(0);
        setSelectedSize(found.sizes[0] || 'M');
        setActiveImageIdx(0);
        setQuantity(1);

        // Curate a 3-image editorial gallery for the piece
        const secondaryAngle1 = found.gender === 'men'
          ? 'https://images.unsplash.com/photo-1617137984095-74e4e5e3613f?auto=format&fit=crop&w=1000&q=85'
          : 'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=1000&q=85';
        const secondaryAngle2 = 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=1000&q=85';

        setGalleryImages([found.imageUrl, secondaryAngle1, secondaryAngle2]);

        // Fetch Complete the Look complementary pieces
        const picks = await productService.getCompleteTheLook(found);
        setCompleteTheLook(picks);
      }
      setIsLoading(false);
    };
    fetchProduct();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [id]);

  if (isLoading) {
    return (
      <PageContainer className="py-16">
        <LoadingState type="detail" />
      </PageContainer>
    );
  }

  if (!product) {
    return (
      <PageContainer className="py-20 text-center space-y-4">
        <h2 className="text-2xl font-serif">Piece not found</h2>
        <p className="text-sm text-text-secondary">The requested piece is either unavailable or has been archived.</p>
        <Button variant="primary" size="md" onClick={() => navigate('/shop')}>
          Back to collection
        </Button>
      </PageContainer>
    );
  }

  const activeColor = product.colors[selectedColorIdx] || product.colors[0] || 'Default';

  const handleAddToBag = () => {
    if (!selectedSize) return;
    addItem(product, activeColor, selectedSize, quantity);
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 2200);
  };

  // Mock Reviews Data
  const mockReviews = [
    {
      id: 'rev-1',
      author: 'Ananya S.',
      location: 'New Delhi',
      rating: 5,
      date: '2 weeks ago',
      verified: true,
      title: 'Exquisite weave & flawless drape',
      comment:
        'The texture of the handloom fiber is extraordinary. It breathes effortlessly in the evening humidity and commands quiet presence. Packaging in the cedar box was a delightful bespoke touch.',
      helpfulCount: 14,
    },
    {
      id: 'rev-2',
      author: 'Vikramaditya R.',
      location: 'Bangalore',
      rating: 5,
      date: '1 month ago',
      verified: true,
      title: 'Architectural tailoring at its finest',
      comment:
        'True to size with structured shoulder lines that feel relaxed. The natural horn buttons and interior french seams show mastercraft construction.',
      helpfulCount: 9,
    },
    {
      id: 'rev-3',
      author: 'Devika K.',
      location: 'Mumbai',
      rating: 4.8,
      date: '1 month ago',
      verified: true,
      title: 'Intelligent AI styling helped complete the look',
      comment:
        'Consulted the Vastra AI stylist on pairing footwear and jewelry for a summer gala. The recommended sandals matched tone and height flawlessly.',
      helpfulCount: 6,
    },
  ];

  return (
    <div className="py-8 md:py-14 space-y-20 pb-20">
      <PageContainer>
        
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center gap-2 text-xs uppercase tracking-widest text-text-secondary mb-8">
          <Link to="/" className="hover:text-text-primary transition-colors">Home</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <Link to={`/${product.gender}`} className="hover:text-text-primary transition-colors capitalize">
            {product.gender}
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-text-primary truncate max-w-[200px] font-medium">{product.name}</span>
        </nav>

        {/* 1. TWO-COLUMN EDITORIAL SHOWCASE */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-start">
          
          {/* Left Column: Image Gallery with Crossfade & Thumbnails */}
          <div className="lg:col-span-7 flex flex-col-reverse md:flex-row gap-4">
            
            {/* Thumbnail Strip */}
            <div className="flex md:flex-col gap-3 overflow-x-auto md:overflow-y-auto no-scrollbar md:w-24 flex-shrink-0">
              {galleryImages.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveImageIdx(idx)}
                  className={`aspect-[3/4] rounded-2xl overflow-hidden border-2 transition-all flex-shrink-0 w-20 md:w-full ${
                    activeImageIdx === idx
                      ? 'border-[#8AA48A] opacity-100 shadow-sage'
                      : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                >
                  <img
                    src={img}
                    alt={`${product.name} angle ${idx + 1}`}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1000&q=85';
                    }}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>

            {/* Main Image with Hover Zoom & Crossfade */}
            <div className="flex-1 aspect-[3/4] rounded-3xl overflow-hidden bg-stone-100 dark:bg-stone-800 border border-[#E6E2DA] dark:border-[#3E443D] relative group shadow-soft">
              <AnimatePresence mode="wait">
                <motion.img
                  key={activeImageIdx}
                  src={galleryImages[activeImageIdx] || product.imageUrl}
                  alt={product.name}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1000&q=85';
                  }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                  className="w-full h-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105 cursor-zoom-in"
                />
              </AnimatePresence>

              {/* Wishlist Button */}
              <button
                onClick={() => setIsWishlisted(!isWishlisted)}
                aria-label="Save to wishlist"
                className="absolute top-4 right-4 w-11 h-11 rounded-full bg-[#FCFCF9]/95 dark:bg-[#343833]/95 backdrop-blur-md flex items-center justify-center text-text-secondary hover:text-[#8AA48A] transition-colors shadow-subtle border border-[#E6E2DA] dark:border-[#3E443D]"
              >
                <Heart className={`w-5 h-5 ${isWishlisted ? 'fill-[#8AA48A] text-[#8AA48A]' : ''}`} />
              </button>

              {/* Image Angle Indicator */}
              <div className="absolute bottom-4 left-4 bg-[#FCFCF9]/90 dark:bg-[#343833]/90 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-semibold text-text-primary tracking-widest uppercase border border-[#E6E2DA] dark:border-[#3E443D]">
                VIEW {activeImageIdx + 1} OF {galleryImages.length}
              </div>
            </div>

          </div>

          {/* Right Column: Product Information & Purchasing Actions */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Category Badge & Rating */}
            <div className="flex items-center justify-between gap-2">
              <Badge variant="soft-sage">
                {product.category}
              </Badge>

              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#2A2A2A] dark:text-[#F6F7F2]">
                <Star className="w-3.5 h-3.5 fill-[#C9A46A] text-[#C9A46A]" />
                <span>{product.rating}</span>
                <span className="text-text-secondary font-normal">({product.reviewCount} reviews)</span>
              </div>
            </div>

            {/* Title & Universe */}
            <div className="space-y-1.5">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-serif text-text-primary font-normal leading-tight">
                {product.name}
              </h1>
              <p className="text-xs uppercase tracking-widest text-text-secondary font-medium">
                {product.gender} Atelier • {product.category}
              </p>
            </div>

            {/* Price & Stock */}
            <div className="flex items-baseline gap-3 pt-1">
              <span className="text-2xl sm:text-3xl font-semibold text-text-primary">
                {formatCurrency(product.price)}
              </span>
              <span className="text-xs text-[#8AA48A] font-semibold uppercase tracking-wider">
                In Stock ({product.stock} units available)
              </span>
            </div>

            {/* Editorial Description */}
            <p className="text-sm text-text-secondary leading-relaxed font-light">
              {product.description}
            </p>

            {/* Color Selector (Circular Swatches) */}
            {product.colors.length > 0 && (
              <div className="space-y-2 pt-3 border-t border-[#E6E2DA] dark:border-[#3E443D]">
                <div className="flex justify-between text-xs">
                  <span className="uppercase tracking-widest text-text-secondary font-medium">
                    Colorway:
                  </span>
                  <span className="text-text-primary font-semibold">{activeColor}</span>
                </div>
                <div className="flex items-center gap-3">
                  {product.colors.map((c, i) => {
                    const matchingSwatch = COLOR_SWATCHES.find((s) => c.toLowerCase().includes(s.name.toLowerCase()));
                    const swatchHex = matchingSwatch ? matchingSwatch.hex : '#8AA48A';
                    return (
                      <button
                        key={c}
                        onClick={() => setSelectedColorIdx(i)}
                        className={`w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center ${
                          selectedColorIdx === i
                            ? 'border-[#8AA48A] scale-110 ring-2 ring-[#8AA48A]/40 ring-offset-2 ring-offset-background'
                            : 'border-[#E6E2DA] dark:border-[#3E443D] hover:scale-105'
                        }`}
                        style={{ backgroundColor: swatchHex }}
                        title={c}
                      >
                        {selectedColorIdx === i && (
                          <Check className={`w-3.5 h-3.5 ${swatchHex === '#FDFBF7' ? 'text-[#2A2A2A]' : 'text-white'}`} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Size Selector */}
            {product.sizes.length > 0 && (
              <div className="space-y-2 pt-2">
                <div className="flex justify-between text-xs">
                  <span className="uppercase tracking-widest text-text-secondary font-medium">
                    Select Size:
                  </span>
                  <span
                    onClick={() => setActiveTab('sizing')}
                    className="text-[#8AA48A] cursor-pointer hover:underline text-[11px] uppercase tracking-wider font-semibold flex items-center gap-1"
                  >
                    <Ruler className="w-3 h-3" />
                    <span>Size Guide</span>
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {product.sizes.map((s) => {
                    const isSelected = selectedSize === s;
                    return (
                      <button
                        key={s}
                        onClick={() => setSelectedSize(s)}
                        className={`py-2.5 px-3 text-xs uppercase tracking-wider rounded-full border font-medium transition-all ${
                          isSelected
                            ? 'border-[#8AA48A] bg-[#CFD8CF] dark:bg-[#3E443D] text-[#2A2A2A] dark:text-[#F6F7F2] font-semibold shadow-xs'
                            : 'border-[#E6E2DA] dark:border-[#3E443D] text-text-primary bg-surface hover:border-[#8AA48A]'
                        }`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quantity Stepper & Add to Bag */}
            <div className="space-y-3 pt-4 border-t border-[#E6E2DA] dark:border-[#3E443D]">
              <div className="flex gap-3">
                
                {/* Quantity Stepper (Capped at product.stock) */}
                <div className="flex items-center border border-[#E6E2DA] dark:border-[#3E443D] rounded-full bg-surface px-2">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="p-2 text-text-secondary hover:text-text-primary transition-colors disabled:opacity-30"
                    disabled={quantity <= 1}
                    aria-label="Decrease quantity"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-3 text-xs font-semibold text-text-primary select-none">{quantity}</span>
                  <button
                    onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                    className="p-2 text-text-secondary hover:text-text-primary transition-colors disabled:opacity-30"
                    disabled={quantity >= product.stock}
                    aria-label="Increase quantity"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Add to Bag Button */}
                <Button
                  variant="primary"
                  size="lg"
                  className="flex-1 transition-all"
                  disabled={!selectedSize || product.stock === 0}
                  onClick={handleAddToBag}
                  leftIcon={isAdded ? <Check className="w-4 h-4 text-[#2A2A2A]" /> : <ShoppingBag className="w-4 h-4 text-[#2A2A2A]" />}
                >
                  {isAdded ? 'Added to bag' : 'Add to Bag'}
                </Button>
              </div>

              {/* Ask Vastra AI Button */}
              <Button
                variant="secondary"
                size="md"
                className="w-full"
                leftIcon={<Sparkles className="w-4 h-4 text-[#8AA48A]" />}
                onClick={() =>
                  window.open(
                    `/agent?q=${encodeURIComponent(
                      `How should I style the ${product.name} for an upcoming occasion?`
                    )}`,
                    '_blank',
                    'noopener,noreferrer'
                  )
                }
              >
                Ask Vastra AI: Style Consultation
              </Button>
            </div>

            {/* Product Information Tabs */}
            <div className="pt-6 border-t border-[#E6E2DA] dark:border-[#3E443D] space-y-4">
              
              {/* Tab Navigation */}
              <div className="flex border-b border-[#E6E2DA] dark:border-[#3E443D] gap-4 overflow-x-auto no-scrollbar">
                {[
                  { id: 'details', label: 'Details' },
                  { id: 'fabric', label: 'Fabric & Material' },
                  { id: 'sizing', label: 'Size Guide' },
                  { id: 'shipping', label: 'Shipping & Returns' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                    className={`pb-2 text-xs uppercase tracking-widest font-semibold transition-colors relative ${
                      activeTab === tab.id
                        ? 'text-[#2A2A2A] dark:text-[#F6F7F2]'
                        : 'text-text-secondary hover:text-[#2A2A2A] dark:hover:text-[#F6F7F2]'
                    }`}
                  >
                    {tab.label}
                    {activeTab === tab.id && (
                      <motion.div
                        layoutId="activeTabUnderline"
                        className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#8AA48A]"
                      />
                    )}
                  </button>
                ))}
              </div>

              {/* Tab Panels */}
              <div className="text-xs text-text-secondary leading-relaxed font-light pt-1 min-h-[100px]">
                {activeTab === 'details' && (
                  <div className="space-y-1.5">
                    <p>• Hand-finished french seams and tailored shoulder geometry.</p>
                    <p>• Subtle tonal bar-tack reinforcements at all stress points.</p>
                    <p>• Certified organic dye formulations with zero toxic chemical mordants.</p>
                  </div>
                )}

                {activeTab === 'fabric' && (
                  <div className="space-y-1.5">
                    <p>• 100% natural, unadulterated fiber weave.</p>
                    <p>• Sourced directly from certified generational handloom cooperatives.</p>
                    <p>• Care: Gentle cold hand wash or eco dry clean. Line dry in shade.</p>
                  </div>
                )}

                {activeTab === 'sizing' && (
                  <div className="space-y-2">
                    <p>Designed with a contemporary relaxed drape. If between sizes, choose based on your preferred silhouette:</p>
                    <div className="grid grid-cols-4 gap-2 pt-1 font-mono text-[11px] text-text-primary">
                      <div className="p-2 rounded-xl bg-surface border border-[#E6E2DA] dark:border-[#3E443D] text-center">
                        <span>XS</span> <br /> 34–36"
                      </div>
                      <div className="p-2 rounded-xl bg-surface border border-[#E6E2DA] dark:border-[#3E443D] text-center">
                        <span>S</span> <br /> 36–38"
                      </div>
                      <div className="p-2 rounded-xl bg-surface border border-[#E6E2DA] dark:border-[#3E443D] text-center">
                        <span>M</span> <br /> 38–40"
                      </div>
                      <div className="p-2 rounded-xl bg-surface border border-[#E6E2DA] dark:border-[#3E443D] text-center">
                        <span>L/XL</span> <br /> 42–44"
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'shipping' && (
                  <div className="space-y-1.5">
                    <p className="flex items-center gap-1.5 text-[#4A5B4A] dark:text-[#8AA48A] font-semibold">
                      <Truck className="w-3.5 h-3.5" />
                      <span>Complimentary Express Courier on all orders over ₹5,000</span>
                    </p>
                    <p className="flex items-center gap-1.5">
                      <RotateCcw className="w-3.5 h-3.5 text-text-secondary" />
                      <span>Complimentary returns & size exchanges within 15 days of delivery.</span>
                    </p>
                    <p className="flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-text-secondary" />
                      <span>Delivered in our signature cedar preservation box.</span>
                    </p>
                  </div>
                )}
              </div>

            </div>

          </div>

        </div>

      </PageContainer>

      {/* 2. COMPLETE THE LOOK (3 Complementary Products) */}
      {completeTheLook.length > 0 && (
        <section className="bg-[#FCFCF9] dark:bg-[#343833] py-16 border-y border-[#E6E2DA] dark:border-[#3E443D]">
          <PageContainer>
            <div className="text-center mb-10 space-y-1">
              <span className="text-xs uppercase tracking-widest text-[#8AA48A] font-semibold">
                Harmonious Ensemble
              </span>
              <h2 className="text-2xl sm:text-3xl font-serif text-text-primary font-normal">
                Complete the look
              </h2>
              <p className="text-xs sm:text-sm text-text-secondary font-light max-w-md mx-auto">
                Pieces curated by our personal styling intelligence to pair seamlessly with this silhouette.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {completeTheLook.map((compProduct) => (
                <ProductCard key={compProduct.id} product={compProduct} />
              ))}
            </div>
          </PageContainer>
        </section>
      )}

      {/* 3. REVIEWS SECTION */}
      <PageContainer>
        <div className="space-y-10">
          
          {/* Header & Star Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center pb-8 border-b border-[#E6E2DA] dark:border-[#3E443D]">
            
            {/* Overall Score */}
            <div className="lg:col-span-4 text-center lg:text-left space-y-2">
              <span className="text-xs uppercase tracking-widest text-text-secondary font-semibold">
                Client Reflections
              </span>
              <div className="flex items-baseline justify-center lg:justify-start gap-2">
                <span className="text-5xl font-serif font-normal text-text-primary">{product.rating}</span>
                <span className="text-text-secondary text-sm font-light">/ 5.0</span>
              </div>
              <div className="flex items-center justify-center lg:justify-start gap-1 text-[#C9A46A]">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-current" />
                ))}
              </div>
              <p className="text-xs text-text-secondary font-light">
                Based on {product.reviewCount} verified client purchases
              </p>
            </div>

            {/* Star Breakdown Bars */}
            <div className="lg:col-span-8 space-y-2 max-w-md">
              {[
                { stars: 5, pct: 88 },
                { stars: 4, pct: 10 },
                { stars: 3, pct: 2 },
                { stars: 2, pct: 0 },
                { stars: 1, pct: 0 },
              ].map((item) => (
                <div key={item.stars} className="flex items-center gap-3 text-xs text-text-secondary">
                  <span className="w-12 text-right">{item.stars} Stars</span>
                  <div className="flex-1 h-1.5 bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#8AA48A] rounded-full"
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                  <span className="w-8 text-right font-mono text-[11px]">{item.pct}%</span>
                </div>
              ))}
            </div>

          </div>

          {/* Individual Reviews Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {mockReviews.map((rev) => (
              <div
                key={rev.id}
                className="p-6 rounded-3xl bg-[#FCFCF9] dark:bg-[#343833] border border-[#E6E2DA] dark:border-[#3E443D] space-y-3 shadow-subtle flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-[#C9A46A]">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="w-3 h-3 fill-current" />
                      ))}
                    </div>
                    <span className="text-[10px] text-text-secondary">{rev.date}</span>
                  </div>

                  <h4 className="text-sm font-medium text-text-primary">
                    "{rev.title}"
                  </h4>

                  <p className="text-xs text-text-secondary leading-relaxed font-light">
                    {rev.comment}
                  </p>
                </div>

                <div className="pt-3 border-t border-[#E6E2DA] dark:border-[#3E443D] flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-[#8AA48A]" />
                    <span className="text-text-primary font-medium">{rev.author}</span>
                    <span className="text-text-secondary">({rev.location})</span>
                  </div>
                  <div className="flex items-center gap-1 text-text-secondary">
                    <ThumbsUp className="w-3 h-3" />
                    <span>{rev.helpfulCount}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </PageContainer>

      {/* 4. AI PROMOTION FOOTER CALLOUT */}
      <PageContainer>
        <div className="rounded-3xl bg-[#CFD8CF]/40 dark:bg-[#1F231F] border border-[#E6E2DA] dark:border-[#3E443D] p-8 sm:p-12 text-center flex flex-col items-center space-y-4 max-w-3xl mx-auto shadow-subtle">
          <div className="w-10 h-10 rounded-full bg-[#8AA48A]/20 flex items-center justify-center text-[#8AA48A]">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-2xl sm:text-3xl font-serif text-[#2A2A2A] dark:text-[#F6F7F2] font-normal">
              Not sure what to choose?
            </h3>
            <p className="text-xs sm:text-sm text-text-secondary dark:text-[#C8CDC5] font-light max-w-md">
              Let Vastra AI style this piece with matching garments and accessories from the collection.
            </p>
          </div>
          <Button
            variant="primary"
            size="md"
            onClick={() => window.open('/agent', '_blank', 'noopener,noreferrer')}
            leftIcon={<Sparkles className="w-4 h-4 text-[#2A2A2A]" />}
          >
            Ask Vastra AI
          </Button>
        </div>
      </PageContainer>

    </div>
  );
};
