import type { AIMessage } from '../types/ai';
import { getAIStylistResponse } from '../data/mockAIResponses';
import { api } from './api';

export interface StylistConsultationPayload {
  message: string;
  conversationHistory?: AIMessage[];
  context?: {
    currentProductId?: string;
    genderPreference?: 'men' | 'women' | 'unisex' | 'all';
    budget?: number;
    occasion?: string;
  };
}

export interface StylistConsultationResult {
  content: string;
  whyItFits: string[];
  stylingTips: string[];
  productIds: string[];
  completeTheLookId?: string;
  completeTheLookText?: string;
  suggestedPrompts: string[];
}

export const agentApi = {
  // Main consultation call (delegates to mock currently, ready for backend Axios/fetch)
  async consultStylist(payload: StylistConsultationPayload): Promise<StylistConsultationResult> {
    // Simulate natural AI latency
    await new Promise((resolve) => setTimeout(resolve, 800));

    const response = getAIStylistResponse(payload.message);

    return {
      content: response.content,
      whyItFits: response.whyItFits,
      stylingTips: [response.stylingNote],
      productIds: response.productIds,
      completeTheLookId: response.completeTheLookId,
      completeTheLookText: response.completeTheLookText,
      suggestedPrompts: [
        'Show coordinating accessories or footwear',
        'Explore in lighter ecru tones',
        'Compare fabric breathability for warm weather',
      ],
    };
  },

  // Get curated product recommendations for a specific garment
  async getProductStylingNotes(productId: string) {
    const product = await api.getProductById(productId);
    if (!product) return null;

    return {
      pairingSuggestions: [
        `Pair this ${product.name} with natural unbleached organic linen and minimal footwear.`,
        'Opt for raw metal or brass accents to complement the artisanal dye tonality.',
      ],
      occasions: ['Evening Soirées', 'Summer Resort Galas', 'Art Openings & Atelier Gatherings'],
    };
  },
};

export default agentApi;
