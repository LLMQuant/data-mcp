import {
  LlmquantTransportError,
  toLlmquantApiError,
} from "../shared/errors";

export interface LlmquantWebApiInternalAuth {
  secret: string;
  userId: string;
  clientType: string;
  mcpTokenId?: string;
}

export interface LlmquantWebApiClientOptions {
  apiKey?: string;
  baseUrl: string;
  timeoutMs: number;
  internalAuth?: LlmquantWebApiInternalAuth;
}

interface CreditMeta {
  remainingCredits?: number;
  creditsUsed?: number;
}

interface SearchWikiApiResult {
  wiki_item_id: string;
  slug: string;
  title: string;
  summary: string | null;
  tags: string[];
  semantic_score: number;
  lexical_score: number;
  combined_score: number;
}

interface SearchWikiApiResponse {
  data: SearchWikiApiResult[];
  meta: {
    remainingCredits: number;
    creditsUsed: number;
  };
}

interface ReadWikiApiResult {
  wiki_item_id: string;
  slug: string;
  title: string;
  summary: string | null;
  body_markdown: string | null;
  tags: string[];
  aliases: string[];
  related_concepts: string[];
  source_updated_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ReadWikiApiResponse {
  data: ReadWikiApiResult;
  meta?: CreditMeta;
}

interface PaperSectionManifestApiResult {
  section_key: string;
  section_type: string;
  title: string | null;
  char_count: number;
  section_order: number;
}

interface SearchPaperApiResult {
  paper_card_id: string;
  source_paper_id: string;
  title: string;
  authors: string[];
  abstract: string | null;
  summary: string | null;
  tags: string[];
  available_sections: PaperSectionManifestApiResult[];
  section_count: number;
  full_text_char_count: number;
  pdf_url: string | null;
  semantic_score: number;
}

interface SearchPaperApiResponse {
  data: SearchPaperApiResult[];
  meta: {
    remainingCredits: number;
    creditsUsed: number;
  };
}

interface ReadPaperSectionApiResult {
  paper_card_id: string;
  section_key: string;
  section_type: string;
  title: string | null;
  section_order: number;
  body_markdown: string;
  char_count: number;
}

interface ReadPaperApiResult {
  paper_card_id: string;
  source_paper_id: string;
  title: string;
  authors: string[];
  abstract: string | null;
  summary: string | null;
  tags: string[];
  pdf_url: string | null;
  section_count: number;
  full_text_char_count: number;
  available_sections: PaperSectionManifestApiResult[];
  source_updated_at: string | null;
  created_at: string;
  updated_at: string;
  sections: ReadPaperSectionApiResult[];
}

interface ReadPaperApiResponse {
  data: ReadPaperApiResult;
  meta?: CreditMeta;
}

export interface WikiSearchResult {
  wikiItemId: string;
  slug: string;
  title: string;
  summary: string | null;
  tags: string[];
  semanticScore: number;
  lexicalScore: number;
  combinedScore: number;
}

export interface WikiSearchResponse {
  data: WikiSearchResult[];
  meta: {
    remainingCredits: number;
    creditsUsed: number;
  };
}

export interface WikiItem {
  wikiItemId: string;
  slug: string;
  title: string;
  summary: string | null;
  bodyMarkdown: string | null;
  tags: string[];
  aliases: string[];
  relatedConcepts: string[];
  sourceUpdatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WikiReadResponse {
  data: WikiItem;
  meta: {
    remainingCredits: number | null;
    creditsUsed: number;
  };
}

export interface PaperSectionManifest {
  sectionKey: string;
  sectionType: string;
  title: string | null;
  charCount: number;
  sectionOrder: number;
}

export interface PaperSearchResult {
  paperCardId: string;
  sourcePaperId: string;
  title: string;
  authors: string[];
  abstract: string | null;
  summary: string | null;
  tags: string[];
  availableSections: PaperSectionManifest[];
  sectionCount: number;
  fullTextCharCount: number;
  pdfUrl: string | null;
  semanticScore: number;
}

export interface PaperSearchResponse {
  data: PaperSearchResult[];
  meta: {
    remainingCredits: number;
    creditsUsed: number;
  };
}

export interface PaperReadSection {
  paperCardId: string;
  sectionKey: string;
  sectionType: string;
  title: string | null;
  sectionOrder: number;
  bodyMarkdown: string;
  charCount: number;
}

export interface PaperItem {
  paperCardId: string;
  sourcePaperId: string;
  title: string;
  authors: string[];
  abstract: string | null;
  summary: string | null;
  tags: string[];
  pdfUrl: string | null;
  sectionCount: number;
  fullTextCharCount: number;
  availableSections: PaperSectionManifest[];
  sourceUpdatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  sections: PaperReadSection[];
}

export interface PaperReadResponse {
  data: PaperItem;
  meta: {
    remainingCredits: number | null;
    creditsUsed: number;
  };
}

// ---------------------------------------------------------------------------
// Crypto types
// ---------------------------------------------------------------------------

interface CryptoKlineBarApiResult {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  time: string;
}

interface CryptoHistoricalApiResponse {
  data: {
    ticker: string;
    interval: string;
    prices: CryptoKlineBarApiResult[];
  };
  meta: {
    creditsUsed: number;
    remainingCredits: number;
    notice?: string;
  };
}

export interface CryptoKlineBar {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  time: string;
}

export interface CryptoHistoricalResponse {
  data: {
    ticker: string;
    interval: string;
    prices: CryptoKlineBar[];
  };
  meta: {
    creditsUsed: number;
    remainingCredits: number;
    notice?: string;
  };
}

export interface CryptoSnapshot {
  price: number;
  ticker: string;
  dayChange: number;
  dayChangePercent: number;
  volume24h: number;
  time: string;
}

export interface CryptoSnapshotResponse {
  data: CryptoSnapshot;
  meta: {
    creditsUsed: number;
    remainingCredits: number;
  };
}

// ---------------------------------------------------------------------------
// Equity types
// ---------------------------------------------------------------------------

interface EquityDailyBarApiResult {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjusted_close: number;
  dividend: number;
  stock_split: number;
  time: string;
}

interface EquityHistoricalApiResponse {
  data: {
    ticker: string;
    interval: string;
    prices: EquityDailyBarApiResult[];
  };
  meta: {
    creditsUsed: number;
    remainingCredits: number;
    notice?: string;
  };
}

export interface EquityDailyBar {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjustedClose: number;
  dividend: number;
  stockSplit: number;
  time: string;
}

export interface EquityHistoricalResponse {
  data: {
    ticker: string;
    interval: string;
    prices: EquityDailyBar[];
  };
  meta: {
    creditsUsed: number;
    remainingCredits: number;
    notice?: string;
  };
}

interface EquityIntradayBarApiResult {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  time: string;
}

interface EquityIntradayApiResponse {
  data: {
    ticker: string;
    interval: "1h";
    prices: EquityIntradayBarApiResult[];
  };
  meta: {
    creditsUsed: number;
    remainingCredits: number;
    notice?: string;
  };
}

export interface EquityIntradayBar {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  time: string;
}

export interface EquityIntradayResponse {
  data: {
    ticker: string;
    interval: "1h";
    prices: EquityIntradayBar[];
  };
  meta: {
    creditsUsed: number;
    remainingCredits: number;
    notice?: string;
  };
}

// ---------------------------------------------------------------------------
// Macro types
// ---------------------------------------------------------------------------

interface MacroCatalogItemApiResult {
  indicator: string;
  series_id: string;
  title: string;
  category: string;
  frequency: string;
  units: string;
  observation_start: string;
  observation_end: string;
  copyright_status: string;
  attribution: string;
}

interface MacroObservationApiResult {
  date: string;
  value: number | null;
  realtime_start: string;
  realtime_end: string;
}

// Compliant success-envelope meta for the macro catalog (a free endpoint):
// `{ creditsUsed: 0, remainingCredits, notice? }`. `count` lives in `data` now,
// and the FRED `sourceNotice` is no longer surfaced on this endpoint's meta.
interface MacroIndicatorsMeta {
  creditsUsed: number;
  remainingCredits: number;
  notice?: string;
}

interface MacroIndicatorsApiResponse {
  data: MacroCatalogItemApiResult[];
  meta: MacroIndicatorsMeta;
}

interface MacroHistoricalApiResponse {
  data: {
    indicator: string;
    series_id: string;
    title: string;
    frequency: string;
    units: string;
    observations: MacroObservationApiResult[];
    attribution: string;
    stale?: boolean;
  };
  meta: {
    creditsUsed: number;
    remainingCredits: number;
    notice?: string;
  };
}

interface MacroSnapshotApiResponse {
  data: {
    indicator: string;
    series_id: string;
    title: string;
    frequency: string;
    units: string;
    latest: { date: string; value: number | null; realtime_start: string; realtime_end: string } | null;
    previous: { date: string; value: number | null } | null;
    delta_abs: number | null;
    delta_pct: number | null;
    attribution: string;
  };
  meta: {
    creditsUsed: number;
    remainingCredits: number;
    notice?: string;
  };
}

export interface MacroCatalogItem {
  indicator: string;
  seriesId: string;
  title: string;
  category: string;
  frequency: string;
  units: string;
  observationStart: string;
  observationEnd: string;
  copyrightStatus: string;
  attribution: string;
}

export interface MacroIndicatorsResponse {
  data: MacroCatalogItem[];
  meta: MacroIndicatorsMeta;
}

export interface MacroObservation {
  date: string;
  value: number | null;
  realtimeStart: string;
  realtimeEnd: string;
}

export interface MacroHistoricalResponse {
  data: {
    indicator: string;
    seriesId: string;
    title: string;
    frequency: string;
    units: string;
    observations: MacroObservation[];
    attribution: string;
    stale?: boolean;
  };
  meta: {
    creditsUsed: number;
    remainingCredits: number;
    notice?: string;
  };
}

export interface MacroSnapshotResponse {
  data: {
    indicator: string;
    seriesId: string;
    title: string;
    frequency: string;
    units: string;
    latest: { date: string; value: number | null; realtimeStart: string; realtimeEnd: string } | null;
    previous: { date: string; value: number | null } | null;
    deltaAbs: number | null;
    deltaPct: number | null;
    attribution: string;
  };
  meta: {
    creditsUsed: number;
    remainingCredits: number;
    notice?: string;
  };
}

// ---------------------------------------------------------------------------
// SEC filing types
// ---------------------------------------------------------------------------

/**
 * The unified success envelope `meta` (see
 * contexts/project/api/response-contract.md §三): credits + an optional
 * server-rendered `notice` that explains an empty / partial result. MCP never
 * generates this prose itself; it forwards whatever Web sends.
 */
interface SecForwardedMeta {
  creditsUsed: number;
  remainingCredits: number;
  notice?: string;
}

interface SecFilingApiResult {
  ticker: string;
  company_name: string | null;
  filing_type: string;
  accession_number: string;
  filing_date: string;
  report_date: string | null;
  url: string;
  section_keys: string[];
}

interface SecSectionManifestApiResult {
  section_key: string;
  section_title: string;
  ordinal: number;
  char_count: number;
}

interface SecFilingReadItemApiResult {
  number: string;
  name: string;
  text: string;
}

interface SecFilingBrowseApiResponse {
  data: SecFilingApiResult[];
  meta: SecForwardedMeta;
}

interface SecFilingReadApiResponse {
  data: {
    ticker: string;
    filing_type: string;
    accession_number: string | null;
    year: number | null;
    quarter: number | null;
    available_sections: SecSectionManifestApiResult[];
    items: SecFilingReadItemApiResult[];
  };
  meta: SecForwardedMeta;
}

export interface SecFiling {
  ticker: string;
  companyName: string | null;
  filingType: string;
  accessionNumber: string;
  filingDate: string;
  reportDate: string | null;
  url: string;
  sectionKeys: string[];
}

export interface SecSectionManifest {
  sectionKey: string;
  sectionTitle: string;
  ordinal: number;
  charCount: number;
}

export interface SecFilingReadItem {
  number: string;
  name: string;
  text: string;
}

export interface SecFilingBrowseResponse {
  data: SecFiling[];
  meta: SecForwardedMeta;
}

export interface SecFilingReadResponse {
  data: {
    ticker: string;
    filingType: string;
    accessionNumber: string | null;
    year: number | null;
    quarter: number | null;
    availableSections: SecSectionManifest[];
    items: SecFilingReadItem[];
  };
  meta: SecForwardedMeta;
}

function mapPaperSectionManifest(item: PaperSectionManifestApiResult): PaperSectionManifest {
  return {
    sectionKey: item.section_key,
    sectionType: item.section_type,
    title: item.title,
    charCount: item.char_count,
    sectionOrder: item.section_order,
  };
}

function readZeroCreditMeta(meta: CreditMeta | undefined) {
  return {
    creditsUsed:
      typeof meta?.creditsUsed === "number" ? meta.creditsUsed : 0,
    remainingCredits:
      typeof meta?.remainingCredits === "number"
        ? meta.remainingCredits
        : null,
  };
}

// ---------------------------------------------------------------------------
// SEC 13F types
// ---------------------------------------------------------------------------

interface Sec13fHoldingApi {
  cusip: string;
  ticker: string | null;
  name_of_issuer: string;
  title_of_class: string;
  value_usd: number;
  shares: number;
  shares_type: "SH" | "PRN";
  investment_discretion: string;
  voting_sole: number;
  voting_shared: number;
  voting_none: number;
  put_call: "Put" | "Call" | null;
}

interface Sec13fHolderApi {
  manager_cik: string;
  manager_name: string;
  manager_period_reportable_value_usd: number;
  manager_period_of_report: string | null;
  manager_period_rank: number | null;
  accession_number: string;
  cusip: string;
  title_of_class: string;
  value_usd: number;
  shares: number;
  shares_type: "SH" | "PRN";
}

interface Sec13fByManagerApiResponse {
  data: {
    ranking_period: string | null;
    manager: {
      manager_cik: string;
      manager_name: string;
      match_type: "cik" | "exact" | "alias" | "fuzzy";
      latest_reportable_value_usd: number;
      latest_reportable_value_period: string | null;
      period_rank: number | null;
      period_reportable_value_usd: number | null;
      is_in_covered_manager_set: boolean;
    } | null;
    filing: {
      filing_type: string;
      accession_number: string;
      filed_at: string;
      period_of_report: string;
      is_amendment: boolean;
      table_entry_total: number | null;
      table_value_total: number | null;
      filing_url: string;
    } | null;
    holdings: Sec13fHoldingApi[];
  };
  meta: SecForwardedMeta;
}

interface Sec13fByTickerApiResponse {
  data: {
    ticker: string;
    ranking_period: string | null;
    total_holders_in_scope: number;
    aggregate_value_usd: number;
    holders: Sec13fHolderApi[];
  };
  meta: SecForwardedMeta;
}

interface Sec13fTopManagerApi {
  manager_cik: string;
  manager_name: string;
  aliases: string[];
  period_rank: number;
  period_reportable_value_usd: number;
}

interface Sec13fTopManagersApiResponse {
  data: {
    manager_set_period: string | null;
    ranking_period: string | null;
    managers: Sec13fTopManagerApi[];
  };
  meta: SecForwardedMeta;
}

export interface Sec13fByManagerResponse {
  data: Sec13fByManagerApiResponse["data"];
  meta: Sec13fByManagerApiResponse["meta"];
}

export interface Sec13fByTickerResponse {
  data: Sec13fByTickerApiResponse["data"];
  meta: Sec13fByTickerApiResponse["meta"];
}

interface EtfTopHoldingApi {
  holding_name: string;
  ticker: string | null;
  cusip: string | null;
  isin: string | null;
  sector: string | null;
  country: string | null;
  asset_type: string | null;
  weight: number | null;
  market_value: number | null;
}

interface EtfHoldingApi {
  holding_name: string;
  ticker: string | null;
  cusip: string | null;
  isin: string | null;
  sedol: string | null;
  asset_type: string | null;
  sector: string | null;
  country: string | null;
  shares: number | null;
  market_value: number | null;
  weight: number | null;
  notional_value: number | null;
  source: string;
  source_url: string | null;
  as_of_date: string | null;
}

interface EtfLookupApiResponse {
  data: {
    ticker: string;
    fund_name: string | null;
    issuer: string | null;
    asset_class: string | null;
    category: string | null;
    cik: string | null;
    series_id: string | null;
    class_id: string | null;
    expense_ratio: number | null;
    aum: number | null;
    nav: number | null;
    market_price: number | null;
    premium_discount_pct: number | null;
    inception_date: string | null;
    holdings_count: number | null;
    top_holdings: EtfTopHoldingApi[];
    sector_exposure: unknown[] | null;
    country_exposure: unknown[] | null;
    asset_type_exposure: unknown[] | null;
    source: string | null;
    source_url: string | null;
    as_of_date: string | null;
    fetched_at: string | null;
    stale: boolean;
    coverage_status: "full" | "partial" | "stale" | "unsupported";
    coverage_notice: string;
  };
  meta: {
    creditsUsed: number;
    remainingCredits: number;
  };
}

interface EtfHoldingsApiResponse {
  data: {
    ticker: string;
    fund_name: string | null;
    issuer: string | null;
    holdings: EtfHoldingApi[];
    source: string | null;
    source_url: string | null;
    as_of_date: string | null;
    fetched_at: string | null;
    stale: boolean;
    coverage_status: "full" | "partial" | "stale" | "unsupported";
    coverage_notice: string;
  };
  meta: {
    creditsUsed: number;
    remainingCredits: number;
  };
}

export interface EtfLookupResponse {
  data: EtfLookupApiResponse["data"];
  meta: EtfLookupApiResponse["meta"];
}

export interface EtfHoldingsResponse {
  data: EtfHoldingsApiResponse["data"];
  meta: EtfHoldingsApiResponse["meta"];
}

export interface Sec13fTopManagersResponse {
  data: Sec13fTopManagersApiResponse["data"];
  meta: Sec13fTopManagersApiResponse["meta"];
}

// ---------------------------------------------------------------------------
// Polymarket / Prediction Markets types
// ---------------------------------------------------------------------------

export type PolymarketEventStatus =
  | "active"
  | "inactive"
  | "closed"
  | "active_or_recently_closed";

export type PolymarketPriceInterval = "1h" | "1d";

export interface PolymarketOutcome {
  outcomeId: string | null;
  label: string;
  outcomeIndex: number | null;
  outcomeTokenId: string | null;
  currentProbability: number | null;
  lastPriceTime: string | null;
  coverageStatus: string | null;
  coverageReason: string | null;
  [key: string]: unknown;
}

export interface PolymarketMarketPreview {
  marketCardId: string;
  sourceMarketId: string;
  sourceMarketSlug: string | null;
  marketQuestion: string;
  semanticSummary: string | null;
  outcomes: PolymarketOutcome[];
  tags: string[];
  labels: string[];
  status: string;
  lifecycleStatus: string;
  coverageStatus: string;
  active: boolean;
  closed: boolean;
  archived: boolean;
  volume: number | null;
  liquidity: number | null;
  startTime: string | null;
  endTime: string | null;
  lastSeenAt: string | null;
  inactiveAt: string | null;
  [key: string]: unknown;
}

export interface PolymarketEventCard {
  eventCardId: string;
  sourceEventId: string;
  sourceEventSlug: string;
  title: string;
  description: string | null;
  marketCount: number;
  markets: PolymarketMarketPreview[];
  tags: string[];
  financeRelevance: unknown;
  maxMarketVolume: number | null;
  maxMarketLiquidity: number | null;
  status: string;
  lifecycleStatus: string;
  active: boolean;
  closed: boolean;
  archived: boolean;
  startTime: string | null;
  endTime: string | null;
  closedTime: string | null;
  resolutionSource: string | null;
  coverageStatus: string;
  syncedAt: string | null;
  lastSeenAt: string | null;
  inactiveAt: string | null;
  cardVersion: number;
  semanticScore?: number;
  lexicalScore?: number;
  combinedScore?: number;
  [key: string]: unknown;
}

export interface PolymarketMarketCard extends PolymarketMarketPreview {
  eventCardId: string;
  sourceEventId: string;
  sourceEventSlug: string | null;
  eventTitle: string | null;
  eventDescription: string | null;
  resolutionCriteria: string | null;
  resolutionSource: string | null;
  conditionId: string | null;
  questionId: string | null;
  financeRelevance: unknown;
  qualityFlags: string[];
  acceptingOrders: boolean | null;
  closedTime: string | null;
  syncedAt: string | null;
  cardVersion: number;
}

export interface PolymarketPricePoint {
  time: string;
  probability: number;
  price: number;
}

export interface PolymarketPriceHistoryData {
  outcomeTokenId: string;
  interval: PolymarketPriceInterval;
  points: PolymarketPricePoint[];
  count: number;
  coverageStatus: string;
  coverageNotice: string;
  [key: string]: unknown;
}

export interface PolymarketEventsResponse {
  data: {
    events: PolymarketEventCard[];
    count: number;
    nextCursor?: string | null;
    scope: string;
  };
  meta: {
    creditsUsed: number;
    remainingCredits: number;
  };
}

export interface PolymarketEventReadResponse {
  data: PolymarketEventCard;
  meta: {
    creditsUsed: number;
    remainingCredits: number;
  };
}

export interface PolymarketMarketReadResponse {
  data: PolymarketMarketCard;
  meta: {
    creditsUsed: number;
    remainingCredits: number;
  };
}

export interface PolymarketPriceHistoryResponse {
  data: PolymarketPriceHistoryData;
  meta: {
    creditsUsed: number;
    remainingCredits: number;
    notice?: string;
  };
}

// ---------------------------------------------------------------------------
// Personal (saved holdings + financial profile) types
// ---------------------------------------------------------------------------

/** Credits envelope for the 0-credit personal read endpoints. */
interface PersonalMeta {
  creditsUsed: number;
  remainingCredits: number;
}

interface PersonalHoldingApiResult {
  symbol: string | null;
  name: string | null;
  asset_class: string;
  quantity: number | null;
  market_value: number | null;
  cost_basis: number | null;
  currency: string;
  as_of_date: string | null;
}

export interface PersonalHoldingsResponse {
  data: {
    total_count: number;
    holdings: PersonalHoldingApiResult[];
  };
  meta: PersonalMeta;
}

interface PersonalProfileApiResult {
  risk_preference: string | null;
  investment_horizon: string | null;
  base_currency: string;
  extra_notes: string | null;
}

export interface PersonalProfileResponse {
  // null when the caller has not saved a profile (empty data → 200, not error).
  data: PersonalProfileApiResult | null;
  meta: PersonalMeta;
}

// ---------------------------------------------------------------------------
// News types
// ---------------------------------------------------------------------------

interface NewsBrowseApiResponse {
  data: {
    items: Array<{
      title: string;
      abstract: string;
      summary: string;
      events: string[];
      topics: string[];
      tickers: string[];
      published_at: string;
      source_url: string;
    }>;
    count: number;
  };
  meta: {
    creditsUsed: number;
    remainingCredits: number;
    notice?: string;
  };
}

export interface NewsBrowseResponse {
  data: NewsBrowseApiResponse["data"];
  meta: NewsBrowseApiResponse["meta"];
}

function snakeToCamelKey(value: string) {
  return value.replace(/_([a-z])/gu, (_, letter: string) => letter.toUpperCase());
}

function camelizePolymarketValue<T>(value: unknown): T {
  if (Array.isArray(value)) {
    return value.map((item) => camelizePolymarketValue(item)) as T;
  }

  if (!value || typeof value !== "object") {
    return value as T;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, child]) => [
      snakeToCamelKey(key),
      camelizePolymarketValue(child),
    ]),
  ) as T;
}

export class LlmquantWebApiClient {
  constructor(private readonly env: LlmquantWebApiClientOptions) {}

  async searchWiki({
    query,
    limit,
  }: {
    query: string;
    limit: number;
  }): Promise<WikiSearchResponse> {
    const response = await this.request<SearchWikiApiResponse>("/api/wiki/search", {
      method: "POST",
      body: JSON.stringify({ query, limit }),
    });

    return {
      data: response.data.map((item) => ({
        wikiItemId: item.wiki_item_id,
        slug: item.slug,
        title: item.title,
        summary: item.summary,
        tags: item.tags,
        semanticScore: item.semantic_score,
        lexicalScore: item.lexical_score,
        combinedScore: item.combined_score,
      })),
      meta: response.meta,
    };
  }

  async readWikiItem({
    wikiItemId,
    maxLength,
  }: {
    wikiItemId: string;
    maxLength?: number;
  }): Promise<WikiReadResponse> {
    const url = new URL(
      `/api/wiki/items/${encodeURIComponent(wikiItemId)}`,
      this.env.baseUrl,
    );

    if (maxLength != null) {
      url.searchParams.set("max_length", String(maxLength));
    }

    const response = await this.request<ReadWikiApiResponse>(url, {
      method: "GET",
    });

    return {
      data: {
        wikiItemId: response.data.wiki_item_id,
        slug: response.data.slug,
        title: response.data.title,
        summary: response.data.summary,
        bodyMarkdown: response.data.body_markdown,
        tags: response.data.tags,
        aliases: response.data.aliases,
        relatedConcepts: response.data.related_concepts,
        sourceUpdatedAt: response.data.source_updated_at,
        createdAt: response.data.created_at,
        updatedAt: response.data.updated_at,
      },
      meta: readZeroCreditMeta(response.meta),
    };
  }

  async searchPaper({
    query,
    limit,
  }: {
    query: string;
    limit: number;
  }): Promise<PaperSearchResponse> {
    const response = await this.request<SearchPaperApiResponse>("/api/paper/search", {
      method: "POST",
      body: JSON.stringify({ query, limit }),
    });

    return {
      data: response.data.map((item) => ({
        paperCardId: item.paper_card_id,
        sourcePaperId: item.source_paper_id,
        title: item.title,
        authors: item.authors,
        abstract: item.abstract,
        summary: item.summary,
        tags: item.tags,
        availableSections: item.available_sections.map(mapPaperSectionManifest),
        sectionCount: item.section_count,
        fullTextCharCount: item.full_text_char_count,
        pdfUrl: item.pdf_url,
        semanticScore: item.semantic_score,
      })),
      meta: response.meta,
    };
  }

  async readPaper({
    paperCardId,
    sections,
  }: {
    paperCardId: string;
    sections?: string[];
  }): Promise<PaperReadResponse> {
    const response = await this.request<ReadPaperApiResponse>("/api/paper/read", {
      method: "POST",
      body: JSON.stringify({
        paperCardId,
        ...(sections ? { sections } : {}),
      }),
    });

    return {
      data: {
        paperCardId: response.data.paper_card_id,
        sourcePaperId: response.data.source_paper_id,
        title: response.data.title,
        authors: response.data.authors,
        abstract: response.data.abstract,
        summary: response.data.summary,
        tags: response.data.tags,
        pdfUrl: response.data.pdf_url,
        sectionCount: response.data.section_count,
        fullTextCharCount: response.data.full_text_char_count,
        availableSections: response.data.available_sections.map(
          mapPaperSectionManifest,
        ),
        sourceUpdatedAt: response.data.source_updated_at,
        createdAt: response.data.created_at,
        updatedAt: response.data.updated_at,
        sections: response.data.sections.map((item) => ({
          paperCardId: item.paper_card_id,
          sectionKey: item.section_key,
          sectionType: item.section_type,
          title: item.title,
          sectionOrder: item.section_order,
          bodyMarkdown: item.body_markdown,
          charCount: item.char_count,
        })),
      },
      meta: readZeroCreditMeta(response.meta),
    };
  }

  async getCryptoHistorical(params: {
    ticker: string;
    interval: string;
    startTime?: string;
    endTime?: string;
    limit?: number;
    takeFrom?: "latest" | "earliest";
  }): Promise<CryptoHistoricalResponse> {
    const url = new URL("/api/crypto/historical", this.env.baseUrl);
    url.searchParams.set("ticker", params.ticker);
    url.searchParams.set("interval", params.interval);

    if (params.startTime) {
      url.searchParams.set("start_time", params.startTime);
    }

    if (params.endTime) {
      url.searchParams.set("end_time", params.endTime);
    }

    if (params.limit != null) {
      url.searchParams.set("limit", String(params.limit));
    }
    if (params.takeFrom) {
      url.searchParams.set("take_from", params.takeFrom);
    }

    const response = await this.request<CryptoHistoricalApiResponse>(url, {
      method: "GET",
    });

    return {
      data: response.data,
      meta: response.meta,
    };
  }

  async getEquityHistorical(params: {
    ticker: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    takeFrom?: "latest" | "earliest";
  }): Promise<EquityHistoricalResponse> {
    const url = new URL("/api/equity/historical", this.env.baseUrl);
    url.searchParams.set("ticker", params.ticker);

    if (params.startDate) {
      url.searchParams.set("start_date", params.startDate);
    }

    if (params.endDate) {
      url.searchParams.set("end_date", params.endDate);
    }

    if (params.limit != null) {
      url.searchParams.set("limit", String(params.limit));
    }
    if (params.takeFrom) {
      url.searchParams.set("take_from", params.takeFrom);
    }

    const response = await this.request<EquityHistoricalApiResponse>(url, {
      method: "GET",
    });

    return {
      data: {
        ticker: response.data.ticker,
        interval: response.data.interval,
        prices: response.data.prices.map((p) => ({
          open: p.open,
          high: p.high,
          low: p.low,
          close: p.close,
          volume: p.volume,
          adjustedClose: p.adjusted_close,
          dividend: p.dividend,
          stockSplit: p.stock_split,
          time: p.time,
        })),
      },
      meta: response.meta,
    };
  }

  async getEquityIntraday(params: {
    ticker: string;
    interval?: "1h";
    startDate?: string;
    endDate?: string;
    limit?: number;
    takeFrom?: "latest" | "earliest";
  }): Promise<EquityIntradayResponse> {
    const url = new URL("/api/equity/intraday", this.env.baseUrl);
    url.searchParams.set("ticker", params.ticker);

    if (params.interval) {
      url.searchParams.set("interval", params.interval);
    }

    if (params.startDate) {
      url.searchParams.set("start_date", params.startDate);
    }

    if (params.endDate) {
      url.searchParams.set("end_date", params.endDate);
    }

    if (params.limit != null) {
      url.searchParams.set("limit", String(params.limit));
    }
    if (params.takeFrom) {
      url.searchParams.set("take_from", params.takeFrom);
    }

    const response = await this.request<EquityIntradayApiResponse>(url, {
      method: "GET",
    });

    return {
      data: response.data,
      meta: response.meta,
    };
  }

  async getCryptoSnapshot(params: {
    ticker: string;
  }): Promise<CryptoSnapshotResponse> {
    const url = new URL("/api/crypto/snapshot", this.env.baseUrl);
    url.searchParams.set("ticker", params.ticker);

    return this.request<CryptoSnapshotResponse>(url, { method: "GET" });
  }

  async getMacroIndicators(params: {
    query?: string;
    category?: string;
    frequency?: string;
    limit?: number;
  }): Promise<MacroIndicatorsResponse> {
    const url = new URL("/api/macro/indicators", this.env.baseUrl);
    if (params.query) url.searchParams.set("query", params.query);
    if (params.category) url.searchParams.set("category", params.category);
    if (params.frequency) url.searchParams.set("frequency", params.frequency);
    if (params.limit != null) url.searchParams.set("limit", String(params.limit));

    const response = await this.request<MacroIndicatorsApiResponse>(url, { method: "GET" });

    return {
      data: response.data.map((item) => ({
        indicator: item.indicator,
        seriesId: item.series_id,
        title: item.title,
        category: item.category,
        frequency: item.frequency,
        units: item.units,
        observationStart: item.observation_start,
        observationEnd: item.observation_end,
        copyrightStatus: item.copyright_status,
        attribution: item.attribution,
      })),
      meta: response.meta,
    };
  }

  async getMacroHistorical(params: {
    indicator?: string;
    seriesId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    takeFrom?: "latest" | "earliest";
  }): Promise<MacroHistoricalResponse> {
    const url = new URL("/api/macro/historical", this.env.baseUrl);
    if (params.indicator) url.searchParams.set("indicator", params.indicator);
    if (params.seriesId) url.searchParams.set("series_id", params.seriesId);
    if (params.startDate) url.searchParams.set("start_date", params.startDate);
    if (params.endDate) url.searchParams.set("end_date", params.endDate);
    if (params.limit != null) url.searchParams.set("limit", String(params.limit));
    if (params.takeFrom) url.searchParams.set("take_from", params.takeFrom);

    const response = await this.request<MacroHistoricalApiResponse>(url, { method: "GET" });

    return {
      data: {
        indicator: response.data.indicator,
        seriesId: response.data.series_id,
        title: response.data.title,
        frequency: response.data.frequency,
        units: response.data.units,
        observations: response.data.observations.map((o) => ({
          date: o.date,
          value: o.value,
          realtimeStart: o.realtime_start,
          realtimeEnd: o.realtime_end,
        })),
        attribution: response.data.attribution,
        stale: response.data.stale,
      },
      meta: response.meta,
    };
  }

  async getMacroSnapshot(params: {
    indicator?: string;
    seriesId?: string;
  }): Promise<MacroSnapshotResponse> {
    const url = new URL("/api/macro/snapshot", this.env.baseUrl);
    if (params.indicator) url.searchParams.set("indicator", params.indicator);
    if (params.seriesId) url.searchParams.set("series_id", params.seriesId);

    const response = await this.request<MacroSnapshotApiResponse>(url, { method: "GET" });

    return {
      data: {
        indicator: response.data.indicator,
        seriesId: response.data.series_id,
        title: response.data.title,
        frequency: response.data.frequency,
        units: response.data.units,
        latest: response.data.latest
          ? {
              date: response.data.latest.date,
              value: response.data.latest.value,
              realtimeStart: response.data.latest.realtime_start,
              realtimeEnd: response.data.latest.realtime_end,
            }
          : null,
        previous: response.data.previous,
        deltaAbs: response.data.delta_abs,
        deltaPct: response.data.delta_pct,
        attribution: response.data.attribution,
      },
      meta: response.meta,
    };
  }

  async getSecFilingBrowse(params: {
    ticker: string;
    filingType?: string;
    limit?: number;
  }): Promise<SecFilingBrowseResponse> {
    const url = new URL("/api/filings", this.env.baseUrl);
    url.searchParams.set("ticker", params.ticker);
    if (params.filingType) {
      url.searchParams.set("filing_type", params.filingType);
    }
    if (params.limit != null) {
      url.searchParams.set("limit", String(params.limit));
    }

    const response = await this.request<SecFilingBrowseApiResponse>(url, {
      method: "GET",
    });

    return {
      data: response.data.map((item) => ({
        ticker: item.ticker,
        companyName: item.company_name,
        filingType: item.filing_type,
        accessionNumber: item.accession_number,
        filingDate: item.filing_date,
        reportDate: item.report_date,
        url: item.url,
        sectionKeys: item.section_keys ?? [],
      })),
      meta: response.meta,
    };
  }

  async getSecFilingRead(params: {
    ticker: string;
    filingType: string;
    year?: number;
    quarter?: number;
    items?: string[];
    accessionNumber?: string;
  }): Promise<SecFilingReadResponse> {
    const url = new URL("/api/filings/sections", this.env.baseUrl);
    url.searchParams.set("ticker", params.ticker);
    url.searchParams.set("filing_type", params.filingType);
    if (params.year != null) {
      url.searchParams.set("year", String(params.year));
    }
    if (params.quarter != null) {
      url.searchParams.set("quarter", String(params.quarter));
    }
    if (params.items && params.items.length > 0) {
      // Web route accepts the canonical comma-separated `items` batch (and a
      // singular `item` alias, which the MCP tool no longer surfaces).
      url.searchParams.set("items", params.items.join(","));
    }
    if (params.accessionNumber) {
      url.searchParams.set("accession_number", params.accessionNumber);
    }

    const response = await this.request<SecFilingReadApiResponse>(url, {
      method: "GET",
    });

    return {
      data: {
        ticker: response.data.ticker,
        filingType: response.data.filing_type,
        accessionNumber: response.data.accession_number,
        year: response.data.year,
        quarter: response.data.quarter,
        availableSections: response.data.available_sections.map((section) => ({
          sectionKey: section.section_key,
          sectionTitle: section.section_title,
          ordinal: section.ordinal,
          charCount: section.char_count,
        })),
        items: response.data.items.map((item) => ({
          number: item.number,
          name: item.name,
          text: item.text,
        })),
      },
      meta: response.meta,
    };
  }

  async getSec13fByManager(params: {
    managerCik?: string;
    managerName?: string;
    year?: number;
    quarter?: number;
    limit?: number;
  }): Promise<Sec13fByManagerResponse> {
    const url = new URL("/api/filings/13f/by-manager", this.env.baseUrl);
    if (params.managerCik) {
      url.searchParams.set("manager_cik", params.managerCik);
    }
    if (params.managerName) {
      url.searchParams.set("manager_name", params.managerName);
    }
    if (params.year != null) {
      url.searchParams.set("year", String(params.year));
    }
    if (params.quarter != null) {
      url.searchParams.set("quarter", String(params.quarter));
    }
    if (params.limit != null) {
      url.searchParams.set("limit", String(params.limit));
    }

    const response = await this.request<Sec13fByManagerApiResponse>(url, {
      method: "GET",
    });

    return { data: response.data, meta: response.meta };
  }

  async getSec13fByTicker(params: {
    ticker: string;
    year?: number;
    quarter?: number;
    limit?: number;
  }): Promise<Sec13fByTickerResponse> {
    const url = new URL("/api/filings/13f/by-ticker", this.env.baseUrl);
    url.searchParams.set("ticker", params.ticker);
    if (params.year != null) {
      url.searchParams.set("year", String(params.year));
    }
    if (params.quarter != null) {
      url.searchParams.set("quarter", String(params.quarter));
    }
    if (params.limit != null) {
      url.searchParams.set("limit", String(params.limit));
    }

    const response = await this.request<Sec13fByTickerApiResponse>(url, {
      method: "GET",
    });

    return { data: response.data, meta: response.meta };
  }

  async listTop13FManagers(params: {
    limit?: number;
    year?: number;
    quarter?: number;
  }): Promise<Sec13fTopManagersResponse> {
    const url = new URL("/api/filings/13f/managers", this.env.baseUrl);
    if (params.limit != null) {
      url.searchParams.set("limit", String(params.limit));
    }
    if (params.year != null) {
      url.searchParams.set("year", String(params.year));
    }
    if (params.quarter != null) {
      url.searchParams.set("quarter", String(params.quarter));
    }

    const response = await this.request<Sec13fTopManagersApiResponse>(url, {
      method: "GET",
    });

    return { data: response.data, meta: response.meta };
  }

  async getEtfLookup(params: {
    ticker: string;
    asOf?: string;
  }): Promise<EtfLookupResponse> {
    const url = new URL("/api/etf/lookup", this.env.baseUrl);
    url.searchParams.set("ticker", params.ticker);
    if (params.asOf != null) {
      url.searchParams.set("as_of", params.asOf);
    }

    const response = await this.request<EtfLookupApiResponse>(url, {
      method: "GET",
    });
    return { data: response.data, meta: response.meta };
  }

  async getEtfHoldings(params: {
    ticker: string;
    limit?: number;
    asOf?: string;
  }): Promise<EtfHoldingsResponse> {
    const url = new URL("/api/etf/holdings", this.env.baseUrl);
    url.searchParams.set("ticker", params.ticker);
    if (params.limit != null) {
      url.searchParams.set("limit", String(params.limit));
    }
    if (params.asOf != null) {
      url.searchParams.set("as_of", params.asOf);
    }

    const response = await this.request<EtfHoldingsApiResponse>(url, {
      method: "GET",
    });
    return { data: response.data, meta: response.meta };
  }

  async browsePolymarketEvents(params: {
    status?: PolymarketEventStatus;
    query?: string;
    tag?: string;
    asset?: string;
    startTime?: string;
    endTime?: string;
    minVolume?: number;
    minLiquidity?: number;
    limit?: number;
    cursor?: string;
  }): Promise<PolymarketEventsResponse> {
    const url = new URL("/api/polymarket/events", this.env.baseUrl);
    if (params.status) url.searchParams.set("status", params.status);
    if (params.query) url.searchParams.set("query", params.query);
    if (params.tag) url.searchParams.set("tag", params.tag);
    if (params.asset) url.searchParams.set("asset", params.asset);
    if (params.startTime) url.searchParams.set("start_time", params.startTime);
    if (params.endTime) url.searchParams.set("end_time", params.endTime);
    if (params.minVolume != null) url.searchParams.set("min_volume", String(params.minVolume));
    if (params.minLiquidity != null) url.searchParams.set("min_liquidity", String(params.minLiquidity));
    if (params.limit != null) url.searchParams.set("limit", String(params.limit));
    if (params.cursor) url.searchParams.set("cursor", params.cursor);

    const response = await this.request<{ data: unknown; meta: PolymarketEventsResponse["meta"] }>(
      url,
      { method: "GET" },
    );

    return {
      data: camelizePolymarketValue<PolymarketEventsResponse["data"]>(response.data),
      meta: response.meta,
    };
  }

  async searchPolymarketEvents(params: {
    query: string;
    status?: PolymarketEventStatus;
    tag?: string;
    limit?: number;
  }): Promise<PolymarketEventsResponse> {
    const body = {
      query: params.query,
      status: params.status,
      tag: params.tag,
      limit: params.limit,
    };
    const response = await this.request<{ data: unknown; meta: PolymarketEventsResponse["meta"] }>(
      "/api/polymarket/events/search",
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    );

    return {
      data: camelizePolymarketValue<PolymarketEventsResponse["data"]>(response.data),
      meta: response.meta,
    };
  }

  async readPolymarketEvent(params: {
    eventCardId: string;
  }): Promise<PolymarketEventReadResponse> {
    const response = await this.request<{
      data: unknown;
      meta: PolymarketEventReadResponse["meta"];
    }>(
      `/api/polymarket/events/${encodeURIComponent(params.eventCardId)}`,
      { method: "GET" },
    );

    return {
      data: camelizePolymarketValue<PolymarketEventCard>(response.data),
      meta: response.meta,
    };
  }

  async readPolymarketMarket(params: {
    marketCardId: string;
  }): Promise<PolymarketMarketReadResponse> {
    const response = await this.request<{
      data: unknown;
      meta: PolymarketMarketReadResponse["meta"];
    }>(
      `/api/polymarket/markets/${encodeURIComponent(params.marketCardId)}`,
      { method: "GET" },
    );

    return {
      data: camelizePolymarketValue<PolymarketMarketCard>(response.data),
      meta: response.meta,
    };
  }

  async getPolymarketPriceHistory(params: {
    outcomeTokenId: string;
    interval: PolymarketPriceInterval;
    startTime?: string;
    endTime?: string;
    limit?: number;
    takeFrom?: "latest" | "earliest";
  }): Promise<PolymarketPriceHistoryResponse> {
    const url = new URL("/api/polymarket/price-history", this.env.baseUrl);
    url.searchParams.set("outcome_token_id", params.outcomeTokenId);
    url.searchParams.set("interval", params.interval);
    if (params.startTime) url.searchParams.set("start_time", params.startTime);
    if (params.endTime) url.searchParams.set("end_time", params.endTime);
    if (params.limit != null) url.searchParams.set("limit", String(params.limit));
    if (params.takeFrom) url.searchParams.set("take_from", params.takeFrom);

    const response = await this.request<{
      data: unknown;
      meta: PolymarketPriceHistoryResponse["meta"];
    }>(url, { method: "GET" });

    return {
      data: camelizePolymarketValue<PolymarketPriceHistoryData>(response.data),
      meta: response.meta,
    };
  }

  async getNewsBrowse(params: {
    tickers?: string[];
    events?: string[];
    topics?: string[];
    startDate?: string;
    endDate?: string;
    limit: number;
  }): Promise<NewsBrowseResponse> {
    const url = new URL("/api/news/browse", this.env.baseUrl);
    if (params.tickers) {
      url.searchParams.set("tickers", params.tickers.join(","));
    }
    if (params.events) {
      url.searchParams.set("events", params.events.join(","));
    }
    if (params.topics) {
      url.searchParams.set("topics", params.topics.join(","));
    }
    if (params.startDate) {
      url.searchParams.set("start_date", params.startDate);
    }
    if (params.endDate) {
      url.searchParams.set("end_date", params.endDate);
    }
    url.searchParams.set("limit", String(params.limit));

    const response = await this.request<NewsBrowseApiResponse>(url, {
      method: "GET",
    });

    return response;
  }

  async getPersonalHoldings(params: {
    assetClass?: string;
    limit?: number;
  }): Promise<PersonalHoldingsResponse> {
    const url = new URL("/api/personal/holdings", this.env.baseUrl);
    if (params.assetClass) {
      url.searchParams.set("asset_class", params.assetClass);
    }
    if (params.limit != null) {
      url.searchParams.set("limit", String(params.limit));
    }

    // Thin wrapper: forward Web's data + meta verbatim (snake_case field set).
    return this.request<PersonalHoldingsResponse>(url, { method: "GET" });
  }

  async getPersonalProfile(): Promise<PersonalProfileResponse> {
    const url = new URL("/api/personal/profile", this.env.baseUrl);

    return this.request<PersonalProfileResponse>(url, { method: "GET" });
  }

  private async request<T>(pathOrUrl: string | URL, init: RequestInit) {
    const url =
      typeof pathOrUrl === "string"
        ? new URL(pathOrUrl, this.env.baseUrl)
        : pathOrUrl;

    const headers = new Headers(init.headers);
    headers.set("accept", "application/json");

    if (this.env.internalAuth) {
      headers.set("authorization", `Bearer ${this.env.internalAuth.secret}`);
      headers.set("x-llmquant-user-id", this.env.internalAuth.userId);
      headers.set("x-llmquant-client-type", this.env.internalAuth.clientType);

      if (this.env.internalAuth.mcpTokenId) {
        headers.set("x-llmquant-mcp-token-id", this.env.internalAuth.mcpTokenId);
      }
    } else if (this.env.apiKey) {
      headers.set("authorization", `Bearer ${this.env.apiKey}`);
    } else {
      throw new LlmquantTransportError(
        "LLMQuant API credentials are missing.",
        url.toString(),
      );
    }

    if (init.body && !headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }

    let response: Response;

    try {
      response = await fetch(url, {
        ...init,
        headers,
        signal: AbortSignal.timeout(this.env.timeoutMs),
      });
    } catch {
      throw new LlmquantTransportError(
        "Failed to reach LLMQuant API. Please try again later.",
        url.toString(),
      );
    }

    if (!response.ok) {
      throw await toLlmquantApiError(response);
    }

    try {
      return (await response.json()) as T;
    } catch {
      throw new LlmquantTransportError(
        "Failed to read LLMQuant API response. Please try again later.",
        url.toString(),
      );
    }
  }
}
