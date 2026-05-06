import { JournalEntry } from '../types';

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
  const provider = localStorage.getItem('jild_ai_provider') || 'google';
  const apiKey = provider === 'google' 
    ? localStorage.getItem('jild_google_key') 
    : localStorage.getItem('jild_qwen_key');

  if (!apiKey || !apiKey.trim()) {
    // Graceful fallback if AI is not configured
    return { suggested_parent_id: null, reasoning: 'AI not configured' };
  }

  const prompt = buildJournalPrompt(newEntry, pastEntries);

  try {
    if (provider === 'google') {
      const model = localStorage.getItem('jild_google_model') || 'gemini-2.0-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
      
      const resp = await fetch(url, {
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

      if (!resp.ok) throw new Error(`Google Gemini request failed (${resp.status})`);
      const data = await resp.json();
      const content = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return parseAIResponse(content);
      
    } else {
      // Qwen
      const model = localStorage.getItem('jild_qwen_model') || 'qwen-vl-max-latest';
      const url = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions';
      
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
          temperature: 0.1,
        }),
      });

      if (!resp.ok) throw new Error(`Qwen request failed (${resp.status})`);
      const data = await resp.json();
      const content = data.choices?.[0]?.message?.content || '';
      return parseAIResponse(content);
    }
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
