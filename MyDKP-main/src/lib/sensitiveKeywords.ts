import fs from 'fs';
import path from 'path';

type TrieNode = {
  next: Map<string, number>;
  fail: number;
  outputs: string[];
};

const DEFAULT_KEYWORD_FILE_PATH = path.join(process.cwd(), 'config', 'sensitive_keywords.txt');
const DEFAULT_CACHE_SIZE = 5000;
const DEFAULT_MIN_KEYWORD_LENGTH = 2;

let matcher: AhoCorasickMatcher | null = null;
let keywordFileMtimeMs = -1;
let loadedKeywordCount = 0;
let loadedAtIso = '';
let loadedMinKeywordLength = -1;

const matchCache = new Map<string, string[]>();

type MatchRange = {
  start: number;
  end: number;
  keyword: string;
};

class AhoCorasickMatcher {
  private readonly nodes: TrieNode[] = [{ next: new Map(), fail: 0, outputs: [] }];

  constructor(keywords: string[]) {
    for (const keyword of keywords) {
      this.insert(keyword);
    }
    this.buildFailureLinks();
  }

  private insert(keyword: string) {
    let state = 0;
    for (const ch of keyword) {
      const nextState = this.nodes[state].next.get(ch);
      if (nextState !== undefined) {
        state = nextState;
        continue;
      }
      const newIndex = this.nodes.length;
      this.nodes.push({ next: new Map(), fail: 0, outputs: [] });
      this.nodes[state].next.set(ch, newIndex);
      state = newIndex;
    }
    this.nodes[state].outputs.push(keyword);
  }

  private buildFailureLinks() {
    const queue: number[] = [];

    for (const [, nextState] of this.nodes[0].next) {
      this.nodes[nextState].fail = 0;
      queue.push(nextState);
    }

    while (queue.length > 0) {
      const state = queue.shift()!;

      for (const [ch, nextState] of this.nodes[state].next) {
        queue.push(nextState);

        let failState = this.nodes[state].fail;
        while (failState !== 0 && !this.nodes[failState].next.has(ch)) {
          failState = this.nodes[failState].fail;
        }

        if (this.nodes[failState].next.has(ch)) {
          this.nodes[nextState].fail = this.nodes[failState].next.get(ch)!;
        } else {
          this.nodes[nextState].fail = 0;
        }

        this.nodes[nextState].outputs = [
          ...this.nodes[nextState].outputs,
          ...this.nodes[this.nodes[nextState].fail].outputs,
        ];
      }
    }
  }

  match(text: string): string[] {
    if (!text) return [];

    let state = 0;
    const hits = new Set<string>();

    for (const ch of text) {
      while (state !== 0 && !this.nodes[state].next.has(ch)) {
        state = this.nodes[state].fail;
      }

      if (this.nodes[state].next.has(ch)) {
        state = this.nodes[state].next.get(ch)!;
      } else {
        state = 0;
      }

      if (this.nodes[state].outputs.length > 0) {
        for (const keyword of this.nodes[state].outputs) {
          hits.add(keyword);
        }
      }
    }

    return [...hits];
  }

  matchRanges(text: string): MatchRange[] {
    if (!text) return [];

    let state = 0;
    let index = -1;
    const ranges: MatchRange[] = [];

    for (const ch of text) {
      index += 1;

      while (state !== 0 && !this.nodes[state].next.has(ch)) {
        state = this.nodes[state].fail;
      }

      if (this.nodes[state].next.has(ch)) {
        state = this.nodes[state].next.get(ch)!;
      } else {
        state = 0;
      }

      if (this.nodes[state].outputs.length > 0) {
        for (const keyword of this.nodes[state].outputs) {
          const keywordLength = Array.from(keyword).length;
          const start = index - keywordLength + 1;
          if (start >= 0) {
            ranges.push({ start, end: index + 1, keyword });
          }
        }
      }
    }

    return ranges;
  }
}

function getKeywordFilePath() {
  return process.env.SENSITIVE_KEYWORD_FILE_PATH || DEFAULT_KEYWORD_FILE_PATH;
}

function toBool(value: string | undefined, defaultValue = false) {
  if (value === undefined) return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function getCacheSizeLimit() {
  const configured = Number(process.env.SENSITIVE_TEXT_CACHE_SIZE || DEFAULT_CACHE_SIZE);
  return Number.isFinite(configured) && configured > 0 ? Math.floor(configured) : DEFAULT_CACHE_SIZE;
}

function getMinKeywordLength() {
  const configured = Number(process.env.SENSITIVE_MIN_KEYWORD_LENGTH || DEFAULT_MIN_KEYWORD_LENGTH);
  return Number.isFinite(configured) && configured >= 1
    ? Math.floor(configured)
    : DEFAULT_MIN_KEYWORD_LENGTH;
}

function setCachedMatch(normalizedText: string, matched: string[]) {
  if (!normalizedText) return;
  if (matchCache.has(normalizedText)) {
    matchCache.delete(normalizedText);
  }
  matchCache.set(normalizedText, matched);

  const cacheLimit = getCacheSizeLimit();
  if (matchCache.size <= cacheLimit) return;

  const oldestKey = matchCache.keys().next().value;
  if (oldestKey) {
    matchCache.delete(oldestKey);
  }
}

function parseKeywordFile(filePath: string, minKeywordLength: number): { mtimeMs: number; keywords: string[] } {
  if (!fs.existsSync(filePath)) {
    return { mtimeMs: -1, keywords: [] };
  }

  const stat = fs.statSync(filePath);
  const content = fs.readFileSync(filePath, 'utf8');
  const keywordSet = new Set<string>();

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const normalized = normalizeSensitiveText(trimmed);
    if (normalized && Array.from(normalized).length >= minKeywordLength) {
      keywordSet.add(normalized);
    }
  }

  return { mtimeMs: stat.mtimeMs, keywords: [...keywordSet] };
}

function loadMatcherIfNeeded(force = false) {
  const filePath = getKeywordFilePath();
  const minKeywordLength = getMinKeywordLength();
  const parsed = parseKeywordFile(filePath, minKeywordLength);
  const shouldReload =
    force ||
    parsed.mtimeMs !== keywordFileMtimeMs ||
    matcher === null ||
    loadedMinKeywordLength !== minKeywordLength;

  if (!shouldReload) return;

  matcher = parsed.keywords.length > 0 ? new AhoCorasickMatcher(parsed.keywords) : null;
  keywordFileMtimeMs = parsed.mtimeMs;
  loadedKeywordCount = parsed.keywords.length;
  loadedAtIso = new Date().toISOString();
  loadedMinKeywordLength = minKeywordLength;
  matchCache.clear();
}

export function normalizeSensitiveText(value: string) {
  return (value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, '');
}

export function isSensitiveAlertEnabled() {
  return toBool(process.env.SENSITIVE_ALERT_ENABLED, false);
}

export function getSensitiveKeywordStats() {
  loadMatcherIfNeeded(false);
  return {
    enabled: isSensitiveAlertEnabled(),
    filePath: getKeywordFilePath(),
    keywordCount: loadedKeywordCount,
    minKeywordLength: loadedMinKeywordLength > 0 ? loadedMinKeywordLength : getMinKeywordLength(),
    loadedAt: loadedAtIso,
    cacheSize: matchCache.size,
  };
}

export function reloadSensitiveKeywordMatcher() {
  loadMatcherIfNeeded(true);
  return getSensitiveKeywordStats();
}

function matchSensitiveKeywordsInternal(rawText: string, ignoreEnabledFlag: boolean): string[] {
  if (!ignoreEnabledFlag && !isSensitiveAlertEnabled()) {
    return [];
  }

  loadMatcherIfNeeded(false);
  if (!matcher) return [];

  const normalizedText = normalizeSensitiveText(rawText);
  if (!normalizedText) return [];

  const cached = matchCache.get(normalizedText);
  if (cached) {
    return cached;
  }

  const matched = matcher.match(normalizedText);
  setCachedMatch(normalizedText, matched);
  return matched;
}

export function matchSensitiveKeywords(rawText: string): string[] {
  return matchSensitiveKeywordsInternal(rawText, false);
}

export function matchSensitiveKeywordsForDisplay(rawText: string): string[] {
  return matchSensitiveKeywordsInternal(rawText, true);
}

export function maskSensitiveTextForDisplay(rawText: string, placeholder = '*') {
  const text = String(rawText || '');
  if (!text) return text;

  loadMatcherIfNeeded(false);
  if (!matcher) return text;

  const rawChars = Array.from(text);
  const normalizedChars: string[] = [];
  const normalizedIndexToRawIndex: number[] = [];

  for (let rawIndex = 0; rawIndex < rawChars.length; rawIndex += 1) {
    const normalizedChunk = normalizeSensitiveText(rawChars[rawIndex]);
    if (!normalizedChunk) continue;
    for (const normalizedChar of normalizedChunk) {
      normalizedChars.push(normalizedChar);
      normalizedIndexToRawIndex.push(rawIndex);
    }
  }

  if (normalizedChars.length === 0) {
    return text;
  }

  const ranges = matcher.matchRanges(normalizedChars.join(''));
  if (ranges.length === 0) return text;

  const maskedRawIndexes = new Set<number>();
  for (const range of ranges) {
    for (let i = range.start; i < range.end; i += 1) {
      const rawIndex = normalizedIndexToRawIndex[i];
      if (rawIndex !== undefined) {
        maskedRawIndexes.add(rawIndex);
      }
    }
  }

  if (maskedRawIndexes.size === 0) return text;

  const maskChar = placeholder || '*';
  return rawChars
    .map((char, index) => (maskedRawIndexes.has(index) ? maskChar : char))
    .join('');
}
