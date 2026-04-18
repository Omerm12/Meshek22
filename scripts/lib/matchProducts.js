// scripts/lib/matchProducts.js
// Hebrew produce name normalization, analysis, and fuzzy matching.
// Read-only utility — no file or DB writes.

'use strict';

// ── 1. SYNONYM MAP ────────────────────────────────────────────────────────────
// Maps normalized source forms → canonical target forms.
// Longer entries MUST come before shorter ones so that phrase matches win.
// Format: each key is already basic-normalized (no apostrophes/geresh etc).

const SYNONYMS = [
  // ── Potato variants ──────────────────────────────────────────────────────
  ['תפוחי אדמה', 'תפוח אדמה'],
  ['תפו א',      'תפוח אדמה'],   // "תפו"א" after geresh removal becomes "תפוא" or "תפו א"
  ['תפוא',       'תפוח אדמה'],
  ['תפוים',      'תפוח'],
  ['תפוחי',      'תפוח'],

  // ── Hot pepper / chilli ──────────────────────────────────────────────────
  // "צ'ילי" → after removing geresh → "צילי" → canonicalize to "חריף"
  ['פלפלי צילי', 'פלפל חריף'],
  ['פלפל צילי',  'פלפל חריף'],
  ['צילי',       'חריף'],

  // ── Cherry tomato ─────────────────────────────────────────────────────────
  ['עגבניות שרי', 'עגבניית שרי'],
  ['עגבניה שרי',  'עגבניית שרי'],
  ['שרי',         'שרי'],          // keep bare "שרי" as-is (context-dependent)

  // ── Unit / measurement ───────────────────────────────────────────────────
  ['ליחידה', 'יחידה'],
  ['יחי',    'יחידה'],
  ['יח',     'יחידה'],             // after geresh removal "יח׳" → "יח"

  // ── Kg variants ──────────────────────────────────────────────────────────
  ['לק',     'קילוגרם'],
  ['לקג',    'קילוגרם'],
  ['קג',     'קילוגרם'],
  ['קילו',   'קילוגרם'],

  // ── Plural spelling variants ─────────────────────────────────────────────
  ['בצלי ירוק', 'בצל ירוק'],
  ['שומי',       'שום'],
  ['פלפלי',      'פלפל'],
];

// ── 2. PLURAL → SINGULAR MAP ──────────────────────────────────────────────────
// Applied token-by-token after synonym substitution.

const PLURAL_TO_SINGULAR = {
  'עגבניות':  'עגבניה',
  'מלפפונים': 'מלפפון',
  'תפוחים':   'תפוח',
  'אגסים':    'אגס',
  'פלפלים':   'פלפל',
  'בננות':    'בננה',
  'לימונים':  'לימון',
  'חצילים':   'חציל',
  'קישואים':  'קישוא',
  'ענבים':    'ענב',
  'תותים':    'תות',
  'אבוקדות':  'אבוקדו',
  'מנגואים':  'מנגו',
  'גזרים':    'גזר',
  'כרובים':   'כרוב',
  'כרוביות':  'כרובית',
  'בצלים':    'בצל',
  'שומים':    'שום',
  'תמרים':    'תמר',
  'שזיפים':   'שזיף',
  'משמשים':   'משמש',
  'פטריות':   'פטריה',
  'חסות':     'חסה',
  'כרישות':   'כרישה',
  'צנוניות':  'צנונית',
  'ארטישוקים':'ארטישוק',
  'דלועות':   'דלעת',
  'עלים':     'עלה',
  'תאנים':    'תאנה',
  'אפרסקים':  'אפרסק',
  'דובדבנים': 'דובדבן',
  'תפוזים':   'תפוז',
  'אשכוליות': 'אשכולית',
  'לימות':    'לימה',
  'אננסים':   'אננס',
  'תירסים':   'תירס',
  'ברוקולים': 'ברוקולי',
  'בטטות':    'בטטה',
  'שסקים':    'שסק',
  'קלמנטינות':'קלמנטינה',
  'מנדרינות': 'מנדרין',
  // Nuts, dried fruit, olives (commonly searched as plural)
  'ערמונים':  'ערמון',
  'רימונים':  'רימון',
  'אגוזים':   'אגוז',
  'שקדים':    'שקד',
  'בוטנים':   'בוטן',
  'פיסטוקים': 'פיסטוק',
  'פלחים':    'פלח',
  'זיתים':    'זית',
  'צנוברים':  'צנובר',
  'חמוציות':  'חמוצית',
  'ליצ\'ים':  'ליצ\'י',
};

// Reverse: singular → plural, for generating plural-form search queries
const SINGULAR_TO_PLURAL = Object.fromEntries(
  Object.entries(PLURAL_TO_SINGULAR).map(([pl, sg]) => [sg, pl])
);

// ── 3a. PACKAGING / DESCRIPTOR PENALTY WORDS (hard modifiers) ────────────────
// When a candidate has these words and the query does not, confidence is reduced
// strongly (-0.12 per word). These words indicate a commercial packaging or
// processing variant that the query likely does not intend.

const PACKAGING_WORDS = new Set([
  'קופסא', 'מארז', 'ארוז', 'מיקס', 'פרימיום', 'בייבי', 'חסלט',
  'חממה', 'בלאדי', 'תפזורת', 'מיובש', 'מוקפא', 'קפוא',
  'מובחר', 'מדורג', 'מיוחד', 'שקית', 'שק',
]);

// ── 3b. SOFT MODIFIER WORDS (color / variety descriptors) ────────────────────
// These describe the same underlying product (just a color or variety variant).
// When a candidate adds ONLY these words to the query base, they act as soft
// modifiers: confidence is reduced slightly but matching is not blocked.
// They are NOT added to PACKAGING_WORDS and carry no hard penalty.

const SOFT_MODIFIER_WORDS = new Set([
  // Colors (m/f/pl forms)
  'ירוק', 'ירוקה', 'ירוקים', 'ירוקות',
  'אדום', 'אדומה', 'אדומים', 'אדומות',
  'לבן',  'לבנה',  'לבנים',  'לבנות',
  'שחור', 'שחורה', 'שחורים', 'שחורות',
  'צהוב', 'צהובה', 'צהובים', 'צהובות',
  'כתום', 'כתומה', 'כתומים', 'כתומות',
  'סגול', 'סגולה', 'סגולים', 'סגולות',
  'זהוב', 'זהובה', 'זהובים', 'זהובות',
  'כחול', 'כחולה', 'כחולים', 'כחולות',
  'חום',  'חומה',  'חומים',  'חומות',
  'ורוד', 'ורודה', 'ורודים', 'ורודות',
  // Freshness
  'טרי',  'טריה',  'טריים',  'טריות',
]);

// ── 4. NORMALIZATION PIPELINE ─────────────────────────────────────────────────

/**
 * Step 1 — Strip punctuation, geresh, gershayim, quotes, hyphens.
 * After this call, "פלפל צ'ילי חריף" → "פלפל צילי חריף"
 *              and "תפו\"א לבן"      → "תפוא לבן"
 *              and "1 יח׳"           → "1 יח"
 */
function basicNormalize(str) {
  return str
    // Remove Hebrew geresh (׳ \u05F3), gershayim (״ \u05F4)
    .replace(/[\u05F3\u05F4]/g, '')
    // Remove ASCII/Unicode apostrophes, quotes
    .replace(/['"'"""''`]/g, '')
    // Remove punctuation that appears in produce names
    .replace(/[,\.(){}\[\]\/\-–—:;!?\\]/g, ' ')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Step 2 — Apply synonym substitution.
 *
 * Multi-token (phrase) synonyms use substring replacement — phrases cannot be
 * embedded inside a single Hebrew word, so this is safe.
 *
 * Single-token synonyms use exact-token replacement to prevent substring
 * contamination. Without this guard, "יח" → "יחידה" would corrupt "אבטיח"
 * into "אבטיחידה", destroying the watermelon search query.
 */
function applySynonyms(str) {
  let s = str;
  for (const [from, to] of SYNONYMS) {
    if (!s.includes(from)) continue;

    if (from.includes(' ')) {
      // Phrase synonym — substring replacement is safe
      s = s.split(from).join(to);
    } else {
      // Single-token synonym — only replace when it is a whole word
      const tokens = s.split(' ');
      let changed = false;
      s = tokens.map((tok) => {
        if (tok === from) { changed = true; return to; }
        return tok;
      }).join(' ');
      // If no whole-token match was found, the original string is unchanged
      void changed;
    }
  }
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Step 3 — Token-by-token plural → singular substitution.
 */
function singularize(str) {
  return str
    .split(' ')
    .map((tok) => PLURAL_TO_SINGULAR[tok] ?? tok)
    .join(' ');
}

/**
 * Full normalization: basic → synonyms → singularize → collapse.
 * Idempotent: calling twice gives the same result.
 */
function normalize(str) {
  return singularize(applySynonyms(basicNormalize(str)));
}

// ── 5. PRODUCT STRUCTURE ANALYSIS ────────────────────────────────────────────

/**
 * Split a (normalized) product name into:
 *   base  — the core product words (what it actually is)
 *   extra — packaging/descriptor words (מארז, ארוז, חממה…)
 *
 * Matching is driven by `base`; `extra` words only affect confidence.
 *
 * @param {string} name  — raw or already-normalized
 * @returns {{ base: string, extra: string[], normalized: string }}
 */
function analyzeProduct(name) {
  const normalized = normalize(name);
  const tokens     = normalized.split(' ').filter(Boolean);

  const extra = tokens.filter((t) => PACKAGING_WORDS.has(t));
  const base  = tokens.filter((t) => !PACKAGING_WORDS.has(t)).join(' ');

  return { base, extra, normalized };
}

// ── 6. QUERY GENERATION ───────────────────────────────────────────────────────

/**
 * Generate up to ~5 deduplicated search query variants for a product name.
 * Used to widen the net against a search engine that does exact/prefix matching.
 *
 * Variants produced:
 *   1. Normalized original
 *   2. Base product (packaging stripped)
 *   3. Singular base
 *   4. Reordered tokens (2-word base only)
 *   5. Plural variant of the base (if known)
 *
 * @param {string} name
 * @returns {{ queries: string[], analysis: ReturnType<analyzeProduct> }}
 */
function generateQueries(name) {
  const analysis           = analyzeProduct(name);
  const { base, extra, normalized } = analysis;

  const set = new Set();

  const add = (s) => {
    const v = (s || '').replace(/\s+/g, ' ').trim();
    if (v.length > 1) set.add(v);
  };

  // 1. Full normalized form
  add(normalized);

  // 2. Base without packaging words
  add(base);

  // 3. Singularized base (may equal base if already singular)
  const singBase = singularize(base);
  add(singBase);

  // 4. Token reversal for 2-word base
  const baseTokens = base.split(' ').filter(Boolean);
  if (baseTokens.length === 2) add(`${baseTokens[1]} ${baseTokens[0]}`);

  // 5. Plural counterpart (search sites often index plural forms)
  const pluralBase = SINGULAR_TO_PLURAL[base] || SINGULAR_TO_PLURAL[singBase];
  if (pluralBase) add(pluralBase);

  // 6. First meaningful token as a fallback keyword
  if (baseTokens.length >= 2) add(baseTokens[0]);

  return { queries: [...set], analysis };
}

// ── 7. SCORING ────────────────────────────────────────────────────────────────

function bigramSet(s) {
  const bg = new Set();
  for (let i = 0; i < s.length - 1; i++) bg.add(s.slice(i, i + 2));
  return bg;
}

function jaccardSets(a, b) {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

function tokenJaccard(a, b) {
  return jaccardSets(
    new Set(a.split(' ').filter(Boolean)),
    new Set(b.split(' ').filter(Boolean))
  );
}

function bigramJaccard(a, b) {
  return jaccardSets(bigramSet(a), bigramSet(b));
}

/**
 * Like tokenJaccard, but returns 1.0 if ALL query tokens appear in the candidate.
 *
 * This correctly handles the case where a candidate is a superset of the query:
 *   query "אגס" vs candidate "אגס ירוק" → all query tokens ∈ candidate → score 1.0
 * instead of Jaccard 0.5 (which falls below the match threshold).
 *
 * Falls back to standard Jaccard when the query is NOT a subset of the candidate.
 */
function tokenSubsetScore(queryBase, candBase) {
  const qToks = queryBase.split(' ').filter(Boolean);
  const cSet  = new Set(candBase.split(' ').filter(Boolean));
  if (qToks.length > 0 && qToks.every((t) => cSet.has(t))) return 1.0;
  return jaccardSets(new Set(qToks), cSet);
}

/**
 * Classify the extra tokens a candidate adds beyond the query base.
 * Returns two arrays: soft (color/variety words) and hard (unknown words).
 * Packaging words are NOT returned here — they are handled separately via candExtra.
 *
 * @param {string} queryBase
 * @param {string} candBase
 * @returns {{ softExtras: string[], hardExtras: string[] }}
 */
function classifyExtraTokens(queryBase, candBase) {
  if (!queryBase || !candBase) return { softExtras: [], hardExtras: [] };
  const qToks = new Set(queryBase.split(' ').filter(Boolean));
  const cToks = candBase.split(' ').filter(Boolean);
  const extra = cToks.filter((t) => !qToks.has(t));
  return {
    softExtras: extra.filter((t) =>  SOFT_MODIFIER_WORDS.has(t)),
    hardExtras: extra.filter((t) => !SOFT_MODIFIER_WORDS.has(t)),
  };
}

/**
 * Score one (query, candidate) pair with detailed debug output.
 *
 * Signal weights:
 *   40% base-product subset score  — most important: what the item IS
 *                                    (uses tokenSubsetScore, not symmetric Jaccard,
 *                                     so "אגס" vs "אגס ירוק" gets base=1.0)
 *   35% full-name token Jaccard    — overall word overlap
 *   25% bigram Jaccard             — character-level similarity (handles typos)
 *
 * Bonuses:
 *   +0.20 exact base match (after normalize)
 *   +0.08 base substring containment (one is prefix/suffix of other)
 *   +0.05 all extra candidate tokens are soft modifiers (color/variety only)
 *
 * Penalties:
 *   -0.12 per unexpected PACKAGING word in candidate not present in query
 *   -0.04 per extra non-packaging token beyond query length + 1
 *
 * @param {string}   query       fully-normalized query string
 * @param {string}   candNorm    normalized candidate name
 * @param {string}   queryBase   base product name from query
 * @param {string[]} queryExtra  packaging words in query
 * @returns {{ score: number, reason: string, candBase: string, candExtra: string[],
 *             softExtras: string[], hardExtras: string[] }}
 */
function scoreWithDebug(query, candNorm, queryBase, queryExtra) {
  const { base: candBase, extra: candExtra } = analyzeProduct(candNorm);

  const tokScore  = tokenJaccard(query, candNorm);
  const bgScore   = bigramJaccard(query, candNorm);
  const baseScore = queryBase && candBase ? tokenSubsetScore(queryBase, candBase) : tokScore;

  let score = baseScore * 0.40 + tokScore * 0.35 + bgScore * 0.25;
  const parts = [`base=${baseScore.toFixed(2)} tok=${tokScore.toFixed(2)} bg=${bgScore.toFixed(2)}`];

  // Bonus: exact base match
  if (queryBase && candBase && queryBase === candBase) {
    score += 0.20;
    parts.push('+0.20[exact_base]');
  } else if (queryBase && candBase &&
             (candBase.includes(queryBase) || queryBase.includes(candBase))) {
    score += 0.08;
    parts.push('+0.08[base_substr]');
  }

  // Classify extra tokens in candidate base (beyond query base)
  const { softExtras, hardExtras } = classifyExtraTokens(queryBase || query, candBase);

  // Bonus: soft-modifier-only extras (color/variety, no hard or packaging words)
  if (softExtras.length > 0 && hardExtras.length === 0 && candExtra.length === 0) {
    score += 0.05;
    parts.push(`+0.05[soft:${softExtras.join('+')}]`);
  } else if (hardExtras.length > 0) {
    parts.push(`[hard:${hardExtras.join('+')}]`);
  }

  // Penalty: candidate has unexpected packaging words (hard commercial modifiers)
  const unexpectedPkg = candExtra.filter((w) => !queryExtra.includes(w));
  if (unexpectedPkg.length > 0) {
    score -= unexpectedPkg.length * 0.12;
    parts.push(`-${(unexpectedPkg.length * 0.12).toFixed(2)}[pkg:${unexpectedPkg.join('+')}]`);
  }

  // Penalty: candidate is significantly longer than query (over-specific)
  const qLen = query.split(' ').length;
  const cLen = candNorm.split(' ').length;
  if (cLen > qLen + 1) {
    const pen = (cLen - qLen - 1) * 0.04;
    score -= pen;
    parts.push(`-${pen.toFixed(2)}[len]`);
  }

  return {
    score:      Math.min(1, Math.max(0, score)),
    reason:     parts.join(' '),
    candBase,
    candExtra,
    softExtras,
    hardExtras,
  };
}

/** Thin wrapper: returns only the numeric score. */
function scoreOnePair(query, candNorm, queryBase, queryExtra) {
  return scoreWithDebug(query, candNorm, queryBase, queryExtra).score;
}

// ── 8. FIND BEST MATCH ────────────────────────────────────────────────────────

/**
 * Confidence thresholds.
 *   >= HIGH_THRESHOLD → reliable match → use scraping status as-is
 *   >= LOW_THRESHOLD  → uncertain match → force needs_review
 *   < LOW_THRESHOLD   → no match found
 */
const HIGH_THRESHOLD = 0.80;
const LOW_THRESHOLD  = 0.60;

/**
 * Find the best matching candidate across all generated query variants.
 *
 * Always returns an object (never null). Check `result.matched` to determine
 * whether a usable match was found.
 *
 * When matched === false the object contains:
 *   { matched, top_candidates_debug, base_name, extra_words,
 *     normalized_name, generated_queries }
 *
 * When matched === true it additionally contains:
 *   { name, url, confidence, isLowConfidence, winning_query,
 *     original_name, match_notes, top_candidates_debug }
 *
 * @param {string} productName
 * @param {{ name: string, url: string }[]} candidates
 */
function findBestMatch(productName, candidates) {
  const { queries, analysis } = generateQueries(productName);
  const { base, extra, normalized } = analysis;

  const commonFields = {
    base_name:         base,
    extra_words:       extra,
    normalized_name:   normalized,
    generated_queries: queries,
  };

  if (!candidates || candidates.length === 0) {
    return { matched: false, top_candidates_debug: '(no candidates)', ...commonFields };
  }

  let bestScore     = -1;
  let bestCandidate = null;
  let winningQuery  = null;
  let bestDebug     = null;

  // Soft base match: best candidate where ALL query base tokens appear in the
  // candidate, even if the overall score is below LOW_THRESHOLD.
  let softScore     = -1;
  let softCandidate = null;
  let softQuery     = null;
  let softDebug     = null;

  // Collect all (candidate, query) pair scores for top-N debug output
  const allScored = [];

  for (const query of queries) {
    for (const candidate of candidates) {
      const candNorm     = normalize(candidate.name);
      const candSingular = singularize(normalize(basicNormalize(candidate.name)));

      // Score both normalized forms; take the better one
      const d1 = scoreWithDebug(query, candNorm,     base, extra);
      const d2 = scoreWithDebug(query, candSingular, base, extra);
      const d  = d1.score >= d2.score ? d1 : d2;
      const s  = d.score;

      allScored.push({ name: candidate.name, query, score: s, debug: d });

      if (s > bestScore) {
        bestScore     = s;
        bestCandidate = candidate;
        winningQuery  = query;
        bestDebug     = d;
      }

      // Track soft base match: base tokens all present in candidate, regardless of score
      if (base && s > softScore && tokenSubsetScore(base, d.candBase) >= 1.0) {
        softScore     = s;
        softCandidate = candidate;
        softQuery     = query;
        softDebug     = d;
      }
    }
  }

  // Build top-5 unique-by-name summary for debug output
  const seenNames = new Set();
  const top5 = allScored
    .sort((a, b) => b.score - a.score)
    .filter(({ name }) => {
      if (seenNames.has(name)) return false;
      seenNames.add(name);
      return true;
    })
    .slice(0, 5);

  const topDebugStr = top5.map(({ name, score, debug }) => {
    const { softExtras, hardExtras, candExtra } = debug;
    let modNote = '';
    if (softExtras.length > 0 && hardExtras.length === 0 && candExtra.length === 0)
      modNote = ` soft[${softExtras.join('+')}]`;
    else if (hardExtras.length > 0)
      modNote = ` hard[${hardExtras.join('+')}]`;
    else if (candExtra.length > 0)
      modNote = ` pkg[${candExtra.join('+')}]`;

    const verdict =
      score >= HIGH_THRESHOLD ? 'MATCH' :
      score >= LOW_THRESHOLD  ? 'REVIEW' :
      `REJECTED(${score.toFixed(2)}<${LOW_THRESHOLD}${modNote})`;

    return `"${name}"@${score.toFixed(2)}:${verdict}`;
  }).join(' | ');

  if (!bestCandidate || bestScore < LOW_THRESHOLD) {
    // Soft base match fallback: the query base tokens appear in a candidate even
    // though the overall similarity score is below LOW_THRESHOLD.
    // Accept the best such candidate as needs_review instead of not_found.
    if (softCandidate) {
      // Guard: reject soft match when candidate base is far longer than query base.
      // A candidate with many extra tokens is likely a different product that merely
      // contains the query word as an ingredient (e.g. "גבינה עם ערמונים" for "ערמונים").
      const qBaseTokenCount = (base || '').split(' ').filter(Boolean).length;
      const cBaseTokenCount = softDebug.candBase.split(' ').filter(Boolean).length;

      if (cBaseTokenCount <= qBaseTokenCount + 3) {
      const { softExtras, hardExtras } = classifyExtraTokens(base, softDebug.candBase);
      const extraWords = [...softExtras, ...hardExtras, ...softDebug.candExtra];

      return {
        matched:                    true,
        matched_via_soft_base_match: true,
        extra_candidate_words:      extraWords,
        name:                       softCandidate.name,
        url:                        softCandidate.url,
        confidence:                 Math.round(softScore * 100) / 100,
        isLowConfidence:            true,
        winning_query:              softQuery,
        original_name:              productName,
        match_notes:                `Soft base match: query base "${base}" found in candidate "${softDebug.candBase}", extra words [${extraWords.join(', ')}]`,
        top_candidates_debug:       topDebugStr,
        ...commonFields,
      };
      } // end token-count guard
    }

    return {
      matched: false,
      top_candidates_debug: topDebugStr,
      ...commonFields,
    };
  }

  return {
    matched:           true,
    name:              bestCandidate.name,
    url:               bestCandidate.url,
    confidence:        Math.round(bestScore * 100) / 100,
    isLowConfidence:   bestScore < HIGH_THRESHOLD,
    winning_query:     winningQuery,
    original_name:     productName,
    match_notes:       bestDebug ? bestDebug.reason : '',
    top_candidates_debug: topDebugStr,
    ...commonFields,
  };
}

module.exports = {
  normalize,
  basicNormalize,
  singularize,
  analyzeProduct,
  generateQueries,
  scoreWithDebug,
  classifyExtraTokens,
  findBestMatch,
  SOFT_MODIFIER_WORDS,
  PACKAGING_WORDS,
  HIGH_THRESHOLD,
  LOW_THRESHOLD,
};
