import type { JournalEntry } from '../types';

export interface AISuggestion {
  suggested_parent_id: string | null;
  reasoning: string;
}

function buildJournalPrompt(newEntry: JournalEntry, pastEntries: JournalEntry[]): string {
  const pastContext = pastEntries.map(e => `[ID: ${e.id}]
Date: ${e.entry_date}
Title: ${e.title}
Content: ${e.content || '(no content)'}
---`).join('\n');

  return `You are an AI assistant that analyzes a user's journal entries to find related threads or ongoing conversations.
A user has just created a NEW journal entry. Below is the new entry, followed by their past entries from the last 10 days.

NEW ENTRY:
Title: ${newEntry.title}
Date: ${newEntry.entry_date}
Content: ${newEntry.content || '(no content)'}

PAST ENTRIES (last 10 days):
${pastContext || 'No past entries found.'}

Your task:
Determine if the NEW ENTRY is clearly related to, a follow-up of, or part of a continuing conversation with ONE of the PAST ENTRIES.
If it is related, return the ID of the single most relevant past entry.
If it is a completely new topic or not strongly related to any past entry, return null.

Return ONLY valid JSON in this exact shape:
{
  "suggested_parent_id": "string id of past entry" | null,
  "reasoning": "A short 1 sentence explanation of why you suggested this link (or why you chose null)."
}
`;
}

export async function suggestJournalLink(
  newEntry: JournalEntry,
  pastEntries: JournalEntry[]
): Promise<AISuggestion> {
  // Only look at the 15 most recent entries to save quota/tokens
  const limitedPastEntries = [...pastEntries]
    .sort((a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime())
    .slice(0, 15);

  let provider = localStorage.getItem('jild_ai_provider') || 'google';
  let apiKey = provider === 'google'
    ? localStorage.getItem('jild_google_key')
    : localStorage.getItem('jild_openai_key');

  if ((!apiKey || !apiKey.trim()) && localStorage.getItem('jild_google_key')?.trim()) {
    provider = 'google';
    apiKey = localStorage.getItem('jild_google_key');
    localStorage.setItem('jild_ai_provider', 'google');
  }

  if (!apiKey || !apiKey.trim()) {
    return { suggested_parent_id: null, reasoning: 'AI not configured' };
  }

  const prompt = buildJournalPrompt(newEntry, limitedPastEntries);

  try {
    let resp: Response;
    if (provider === 'google') {
      const model = localStorage.getItem('jild_google_model') || 'gemini-2.0-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
      
      resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
          },
        }),
      });
    } else {
      // OpenAI
      const model = localStorage.getItem('jild_openai_model') || 'gpt-4o-mini';
      const url = 'https://api.openai.com/v1/chat/completions';
      
      resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          response_format: { type: 'json_object' }
        }),
      });
    }

    if (resp.status === 429) {
      return { suggested_parent_id: null, reasoning: 'Rate limit reached. Try again in 1 minute.' };
    }

    if (!resp.ok) {
      const detail = await resp.text().catch(() => '');
      throw new Error(`AI request failed (${resp.status}). ${detail.slice(0, 180) || 'Check your API key and model.'}`);
    }

    const data = await resp.json();
    let content = '';
    if (provider === 'google') {
      content = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else {
      content = data.choices?.[0]?.message?.content || '';
    }
    
    return parseAIResponse(content);

  } catch (err: any) {
    console.error('Journal AI Suggestion error:', err);
    return { suggested_parent_id: null, reasoning: err.message };
  }
}

function parseAIResponse(content: string): AISuggestion {
  try {
    let jsonStr = content.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
    if (!jsonStr.startsWith('{')) {
      const m = jsonStr.match(/\{[\s\S]*\}/);
      if (m) jsonStr = m[0];
    }
    const parsed = JSON.parse(jsonStr);
    return {
      suggested_parent_id: parsed.suggested_parent_id || null,
      reasoning: parsed.reasoning || '',
    };
  } catch {
    return { suggested_parent_id: null, reasoning: 'Failed to parse AI response' };
  }
}
