import Anthropic from '@anthropic-ai/sdk';
import type { CartPayload, Product, ShoppingContext } from '../types';

export const CLAUDE_MODEL_NAME = 'claude-sonnet-5';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';

let anthropicClient: Anthropic | null = null;

if (ANTHROPIC_API_KEY && ANTHROPIC_API_KEY.trim().length > 0 && !ANTHROPIC_API_KEY.includes('vastra_dev')) {
  try {
    anthropicClient = new Anthropic({
      apiKey: ANTHROPIC_API_KEY.trim()
    });
  } catch (err: any) {
    console.warn('[ClaudeService] Failed to initialize Anthropic client:', err?.message || err);
  }
}

/**
 * Returns whether Claude API is configured with a valid key.
 */
export function isClaudeConfigured(): boolean {
  return Boolean(anthropicClient && ANTHROPIC_API_KEY && !ANTHROPIC_API_KEY.includes('vastra_dev'));
}

/**
 * System instruction defining the Vastra.AI quiet luxury fashion concierge persona.
 */
const CLAUDE_SYSTEM_PROMPT = `You are the VASTRA.AI luxury fashion stylist and artisanal concierge.
Vastra.AI is an elevated Indian atelier celebrating handloom silk, pashmina, organic Khadi cotton, Chanderi organza, and bespoke tailored silhouettes.

CRITICAL PRODUCT GROUNDING RULES:
1. NEVER invent products, prices, stock counts, sizes, or product IDs.
2. Every product you mention or recommend MUST be selected strictly from the [GROUNDED_CATALOG_PRODUCTS] provided in the prompt context.
3. Always extract every mentioned attribute — color, size, category, gender, occasion, and price constraints — into the search_products call. Never omit an attribute the user mentioned.
   Examples:
   - "black dress under 5000" -> search_products({ color: "black", category: "dresses", maxPrice: 5000 })
   - "something in blue instead" -> search_products({ color: "blue", category: "dresses", maxPrice: 5000 })
   - "show me formal shirts for men under 2000" -> search_products({ category: "formal shirts", gender: "men", maxPrice: 2000 })
   - "I want something for a wedding, budget 8000" -> search_products({ occasion: "wedding", maxPrice: 8000 })
4. Only describe and recommend products that were actually returned by the search_products tool call. Never describe a product's color, price, or attributes from memory — always read them from the tool result.
5. If no matching products exist within the budget or criteria, honestly state that no pieces match and mention our actual collection prices (e.g., "Our handcrafted shirts start from ₹2,899").
6. Respect category, gender, color, occasion, and spending limits:
   - If the user asks for "dresses", mention ONLY dresses. Never wallets, cardholders, belts, or footwear.
   - If the user asks for "jeans", mention ONLY jeans. Never accessories.
   - The global maximum spending limit is ₹10,000 per order. Never suggest combinations exceeding ₹10,000.
7. Tone & Style:
   - Quiet luxury, refined, editorial, knowledgeable.
   - Speak with reverence for textile heritage (Bhagalpur mulberry silk, Kashmiri cashmere, hand-spun Khadi, antique horn buttons).
   - Keep answers concise (2 to 4 sentences). Avoid repetitive robotic confirmation prompts.
8. Commerce Actions:
   - All shopping bag mutations, inventory checks, and order calculations are performed deterministically by the backend server.
   - Reflect the exact status confirmed by the backend (e.g., item added, cart total, stock verified).
   - Never initiate payment automatically without explicit human confirmation.`;

export interface ClaudeStylistInput {
  userMessage: string;
  candidateProducts?: Product[];
  currentCart?: CartPayload;
  context?: ShoppingContext;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  actionExecuted?: string;
  actionDetails?: string;
}

export interface ClaudeStylistOutput {
  message: string;
  model: string;
  success: boolean;
  error?: string;
}

/**
 * Generates an editorial stylist response using Claude Sonnet 5, strictly grounded in provided catalog data.
 */
export async function generateClaudeStylistResponse(input: ClaudeStylistInput): Promise<ClaudeStylistOutput> {
  if (!isClaudeConfigured() || !anthropicClient) {
    return {
      message: '',
      model: CLAUDE_MODEL_NAME,
      success: false,
      error: 'CLAUDE_NOT_CONFIGURED'
    };
  }

  try {
    // 1. Build Grounded Context Block
    const catalogSummary = (input.candidateProducts || []).map((p, idx) => {
      return `[Product ${idx + 1}] ID: ${p.id} | Name: ${p.name} | Price: ₹${p.price} | Category: ${p.category} | Gender: ${p.gender} | Sizes: ${p.sizes.join(', ')} | Colors: ${p.colors.join(', ')} | Stock: ${p.stock} | Material: ${p.material || 'Artisanal'} | Description: ${p.description}`;
    }).join('\n');

    let groundedContext = `\n[GROUNDED_CATALOG_PRODUCTS (Count: ${(input.candidateProducts || []).length})]\n${catalogSummary || 'None matching current criteria.'}`;

    if (input.currentCart) {
      groundedContext += `\n\n[CURRENT_SHOPPING_BAG]\nItems: ${input.currentCart.itemCount} piece(s) | Total: ₹${input.currentCart.total.toLocaleString('en-IN')}`;
    }

    if (input.actionExecuted) {
      groundedContext += `\n\n[COMMERCE_ACTION_EXECUTED]\nAction: ${input.actionExecuted} | Status: ${input.actionDetails || 'Completed'}`;
    }

    // 2. Build conversation history for Claude
    const claudeMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    if (input.history && input.history.length > 0) {
      // Keep recent 4 turns to maintain context without bloat
      const recentHistory = input.history.slice(-4);
      for (const turn of recentHistory) {
        if (turn.content && turn.content.trim().length > 0) {
          claudeMessages.push({
            role: turn.role === 'assistant' ? 'assistant' : 'user',
            content: turn.content.trim()
          });
        }
      }
    }

    // Append current user message augmented with grounded catalog data
    claudeMessages.push({
      role: 'user',
      content: `${input.userMessage}\n\n${groundedContext}`
    });

    // 3. Call Claude Sonnet 5
    const response = await anthropicClient.messages.create({
      model: CLAUDE_MODEL_NAME,
      max_tokens: 500,
      temperature: 0.2,
      system: CLAUDE_SYSTEM_PROMPT,
      messages: claudeMessages
    });

    const responseText = response.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as any).text)
      .join('\n')
      .trim();

    return {
      message: responseText,
      model: CLAUDE_MODEL_NAME,
      success: true
    };
  } catch (err: any) {
    console.error('[ClaudeService] Error calling Claude API:', err?.message || err);
    return {
      message: '',
      model: CLAUDE_MODEL_NAME,
      success: false,
      error: err?.message || 'CLAUDE_REQUEST_FAILED'
    };
  }
}

export default {
  CLAUDE_MODEL_NAME,
  isClaudeConfigured,
  generateClaudeStylistResponse
};
