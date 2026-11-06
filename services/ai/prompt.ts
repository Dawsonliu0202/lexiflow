import type { TranslateRequest, AiConfig } from '../../shared/types';

export interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

export function buildMessages(req: TranslateRequest, cfg: AiConfig): ChatMessage[] {
  const targetLang = cfg.targetLang || '简体中文';
  const systemPrompt = `你是精通多语言的语境词典专家。
根据【原句】判断【目标词】在该句的确切含义，仅输出合法的 JSON 对象，不要输出任何多余的解释、Markdown 代码块或其它文字。
输出字段：
- word: string (用户选中的原词形式)
- lemma: string (小写词典原形，若为短语则为短语原形)
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
}
