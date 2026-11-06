import type { TranslateRequest, AiConfig, SelectionMode } from '../../shared/types';
import { detectSelectionType } from '../../entrypoints/content/selection';

export interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

export function buildMessages(req: TranslateRequest, cfg: AiConfig): ChatMessage[] {
  const targetLang = cfg.targetLang || '简体中文';
  const mode: SelectionMode = req.mode || detectSelectionType(req.word);

  if (mode === 'word') {
    const systemPrompt = `你是精通多语言的语境词典专家。
根据【原句】判断【目标词】在该句的确切含义，仅输出合法的 JSON 对象，不要输出任何多余的解释、Markdown 代码块或其它文字。
输出字段：
- word: string (用户选中的原词形式)
- lemma: string (小写词典原形)
- phonetic: string (音标，如 "/ˈbɜːdn/"；若不确定则为空字符串)
- contextMeaning: string (${targetLang}的一句简短确切语境释义)
- coreMeanings: string[] (核心词义列表，最多 3 条，格式如 "n. 重担，负担" 或 "v. 使负重荷")
- analysis: string (简明解析，不超过 60 字，说明在该语境下为何取该义、常见搭配或词根考究)

必须严格遵循 JSON 格式输出。`;

    const userPayload = {
      word: req.word.trim(),
      sentence: req.sentence.trim(),
      pageTitle: req.pageTitle?.trim() || '',
    };

    return [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: JSON.stringify(userPayload) },
    ];
  } else if (mode === 'phrase') {
    const systemPrompt = `你是一位精通多语言的语境翻译与词典专家。
请根据【上下文原句】，翻译用户选中的【短语或固定搭配】为流畅的${targetLang}。
仅输出合法的 JSON 对象，不要输出 Markdown 代码块标记（如 \`\`\`json）或任何其它文字。
输出字段：
- word: string (用户选中的短语原形)
- lemma: string (短语原型，小写)
- contextMeaning: string (${targetLang}流畅确切的语境释义/译文)
- coreMeanings: string[] (该短语的常见释义，最多 2 条)
- analysis: string (该短语的搭配用法、语境色彩或同义替换点拨，不超过 60 字)

必须严格遵循 JSON 格式输出。`;

    const userPayload = {
      phrase: req.word.trim(),
      contextSentence: req.sentence.trim() !== req.word.trim() ? req.sentence.trim() : undefined,
      pageTitle: req.pageTitle?.trim() || '',
    };

    return [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: JSON.stringify(userPayload) },
    ];
  } else {
    // Sentence or passage/paragraph translation mode
    const systemPrompt = `你是一位精通多语言的高级同声传译与翻译专家。
请将用户选中的【句子或段落】翻译为流畅、自然、符合表达习惯的${targetLang}。
要求：
1. 忠实原文语境，符合目标语言的行文习惯，做到信达雅，严禁机械字面直译。
2. 保持原有的段落层次、标点节奏与修辞语气。
3. 仅输出合法的 JSON 对象，不要输出任何 Markdown 代码块标记（如 \`\`\`json）或任何其它额外文本。
输出字段：
- translation: string (${targetLang}完整译文，保持自然流畅与排版)
- contextMeaning: string (与 translation 字段一致的内容)
- analysis: string (选填。若有重点难点词汇、核心术语或特殊语法结构，做 1-2 句简明点拨；若内容平实可为空字符串)

必须严格遵循 JSON 格式输出。`;

    const userPayload = {
      text: req.word.trim(),
      pageTitle: req.pageTitle?.trim() || '',
    };

    return [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: JSON.stringify(userPayload) },
    ];
  }
}
