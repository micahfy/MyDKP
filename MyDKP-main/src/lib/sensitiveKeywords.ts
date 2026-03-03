import fs from 'fs';
import path from 'path';

type TrieNode = {
  next: Map<string, number>;
  fail: number;
  outputs: string[];
};

const DEFAULT_KEYWORD_FILE_PATH = path.join(process.cwd(), 'config', 'sensitive_keywords.txt');
const DEFAULT_CACHE_SIZE = 5000;

let matcher: AhoCorasickMatcher | null = null;
let keywordFileMtimeMs = -1;
let loadedKeywordCount = 0;
let loadedAtIso = '';

const matchCache = new Map<string, string[]>();

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

function parseKeywordFile(filePath: string): { mtimeMs: number; keywords: string[] } {
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
    if (normalized) {
      keywordSet.add(normalized);
    }
  }

  return { mtimeMs: stat.mtimeMs, keywords: [...keywordSet] };
}

function loadMatcherIfNeeded(force = false) {
  const filePath = getKeywordFilePath();
  const parsed = parseKeywordFile(filePath);
  const shouldReload = force || parsed.mtimeMs !== keywordFileMtimeMs || matcher === null;

  if (!shouldReload) return;

  matcher = parsed.keywords.length > 0 ? new AhoCorasickMatcher(parsed.keywords) : null;
  keywordFileMtimeMs = parsed.mtimeMs;
  loadedKeywordCount = parsed.keywords.length;
  loadedAtIso = new Date().toISOString();
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
    loadedAt: loadedAtIso,
    cacheSize: matchCache.size,
  };
}

export function reloadSensitiveKeywordMatcher() {
  loadMatcherIfNeeded(true);
  return getSensitiveKeywordStats();
}

export function matchSensitiveKeywords(rawText: string): string[] {
  if (!isSensitiveAlertEnabled()) {
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
