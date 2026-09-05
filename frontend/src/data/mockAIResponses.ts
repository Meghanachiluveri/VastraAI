import type { AIMessage } from '../types/ai';

export const INITIAL_AI_MESSAGES: AIMessage[] = [
  {
    id: 'msg-init-1',
    sender: 'agent',
    content: "Welcome to Vastra. Tell me what you're dressing for — an upcoming wedding, a summer vacation, or simply pieces in breathable silk and linen. I will curate directly from our atelier collection.",
    timestamp: 'Just now',
    suggestedPrompts: [
      'Something elegant for a wedding',
      'Breathable linen for summer',
      'Build an outfit under ₹5,000',
      'Minimal black evening look',
    ],
  },
];

export interface StylistResponseData {
  content: string;
  productIds: string[];
  whyItFits: string[];
  stylingNote: string;
  completeTheLookId?: string;
  completeTheLookText?: string;
}

export const STYLIST_SCENARIOS: Record<string, StylistResponseData> = {
  wedding: {
    content: "For a celebratory wedding occasion, I've curated handloom raw silk and sheer Chanderi silhouettes that drape effortlessly while catching the evening light.",
    productIds: ['men-001', 'women-002', 'women-008'],
    whyItFits: ['Matches ceremonial dress code', 'Available in your size', 'Traceable handloom silk', 'Highly rated'],
    stylingNote: 'Layer with understated warm metallics to let the texture of the silk lead the ensemble.',
    completeTheLookId: 'men-002',
    completeTheLookText: 'This hand-spun Khadi linen kurta pairs seamlessly beneath the raw silk jacket.',
  },
  summer: {
    content: "For warm days and humid evenings, these hand-spun organic Khadi cotton and pure Irish linen garments provide superior breathability with relaxed architectural tailoring.",
    productIds: ['men-004', 'women-006', 'men-002'],
    whyItFits: ['100% natural organic fibers', 'High airflow weave', 'Relaxed tailored fit', 'Within seasonal palette'],
    stylingNote: 'Embrace the natural slub texture of organic Khadi with minimal tonal styling.',
    completeTheLookId: 'uni-001',
    completeTheLookText: 'This full-grain leather atelier tote adds an effortless utilitarian finish.',
  },
  budget: {
    content: "Here is a curated edit focusing on versatile everyday luxury and trans-seasonal staples under ₹5,000, tailored from certified Belgian linen and organic cotton.",
    productIds: ['men-002', 'women-004', 'uni-004'],
    whyItFits: ['Within your budget', 'Versatile multi-wear staple', 'Machine washable natural weave', 'Available in all sizes'],
    stylingNote: 'Can be dressed down with raw selvedge denim or elevated with tailored trousers.',
    completeTheLookId: 'men-006',
    completeTheLookText: 'Complement this ensemble with our heavyweight Supima cotton t-shirt.',
  },
  evening: {
    content: "For an understated evening affair, these sculpted obsidian and burnished terracotta pieces embody contemporary elegance with zero excess.",
    productIds: ['women-002', 'men-001', 'women-001'],
    whyItFits: ['Sculptural black-tie aesthetic', 'Pre-draped cashmere blend', 'Hand-finished french seams', 'Limited atelier edition'],
    stylingNote: 'Let the drape speak for itself with minimalist footwear and subtle bronze accents.',
    completeTheLookId: 'uni-003',
    completeTheLookText: 'This Grade-A Changthangi cashmere overshirt adds refined warmth for evening breezes.',
  },
  default: {
    content: "Based on your request, I have curated these hand-crafted pieces from our current collection, balancing timeless drape and modern silhouette.",
    productIds: ['men-001', 'women-001', 'uni-003'],
    whyItFits: ['Handwoven natural fibers', 'Available in your size', 'Versatile day-to-night styling', 'Highly rated'],
    stylingNote: 'Each garment is crafted by generational artisans across Varanasi and Kashmir.',
    completeTheLookId: 'men-002',
    completeTheLookText: 'This tailored linen kurta creates a clean, harmonious foundation.',
  },
};

export function getAIStylistResponse(prompt: string): StylistResponseData {
  const lower = prompt.toLowerCase();
  if (lower.includes('wedding') || lower.includes('ceremony') || lower.includes('guest')) {
    return STYLIST_SCENARIOS.wedding;
  }
  if (lower.includes('summer') || lower.includes('linen') || lower.includes('warm') || lower.includes('getaway')) {
    return STYLIST_SCENARIOS.summer;
  }
  if (lower.includes('5,000') || lower.includes('5000') || lower.includes('budget') || lower.includes('under')) {
    return STYLIST_SCENARIOS.budget;
  }
  if (lower.includes('evening') || lower.includes('black') || lower.includes('minimal') || lower.includes('gala')) {
    return STYLIST_SCENARIOS.evening;
  }
  return STYLIST_SCENARIOS.default;
}
