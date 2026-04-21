import type { LlmquantEnv } from "../env";
import {
  LlmquantTransportError,
  toLlmquantApiError,
} from "../shared/errors";

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
    topK: number;
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
    topK: number;
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
    topK: number;
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
    topK: number;
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
    count: number;
    creditsUsed: number;
    remainingCredits: number;
  };
}

interface CryptoSnapshotApiResponse {
  data: {
    price: number;
    ticker: string;
    day_change: number;
    day_change_percent: number;
    volume_24h: number;
    time: string;
  };
  meta: {
    creditsUsed: number;
    remainingCredits: number;
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
    count: number;
    creditsUsed: number;
    remainingCredits: number;
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
    count: number;
    creditsUsed: number;
    remainingCredits: number;
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
    count: number;
    creditsUsed: number;
    remainingCredits: number;
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

interface MacroIndicatorsApiResponse {
  data: MacroCatalogItemApiResult[];
  meta: {
    count: number;
    creditsUsed: number;
    sourceNotice: string;
  };
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
  };
  meta: {
    count: number;
    stale?: boolean;
    creditsUsed: number;
    remainingCredits: number;
    sourceNotice: string;
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
    sourceNotice: string;
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
  meta: {
    count: number;
    creditsUsed: number;
  };
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
  };
  meta: {
    count: number;
    creditsUsed: number;
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
  };
}

// ---------------------------------------------------------------------------
// SEC filing types
// ---------------------------------------------------------------------------

interface SecFilingApiResult {
  sec_filing_id: string;
  ticker: string;
  company_name: string | null;
  filing_type: string;
  accession_number: string;
  filing_date: string;
  report_date: string | null;
  url: string;
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
  meta: {
    count: number;
    creditsUsed: number;
  };
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
  meta: {
    count: number;
    creditsUsed: number;
    remainingCredits: number;
  };
}

export interface SecFiling {
  secFilingId: string;
  ticker: string;
  companyName: string | null;
  filingType: string;
  accessionNumber: string;
  filingDate: string;
  reportDate: string | null;
  url: string;
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
  meta: {
    count: number;
    creditsUsed: number;
  };
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
  meta: {
    count: number;
    creditsUsed: number;
  };
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
  manager_reportable_value_usd: number;
  manager_reportable_value_period: string | null;
  manager_scope_rank: number | null;
  sec_13f_filing_id: string;
  accession_number: string;
  cusip: string;
  title_of_class: string;
  value_usd: number;
  shares: number;
  shares_type: "SH" | "PRN";
}

interface Sec13fScopeApi {
  managers_seeded: number;
  latest_period: string | null;
  earliest_period: string | null;
  selection_basis: string;
  is_top_1000_only: boolean;
}

interface Sec13fByManagerApiResponse {
  data: {
    manager: {
      manager_cik: string;
      manager_name: string;
      match_type: "cik" | "exact" | "alias" | "fuzzy";
      latest_reportable_value_usd: number;
      latest_reportable_value_period: string | null;
      current_scope_rank: number | null;
      is_in_latest_seed_universe: boolean;
    } | null;
    filing: {
      sec_13f_filing_id: string;
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
  meta: {
    creditsUsed: number;
    remainingCredits: number;
    scope: Sec13fScopeApi;
    scope_notice: string;
  };
}

interface Sec13fByTickerApiResponse {
  data: {
    ticker: string;
    period_of_report: string;
    total_holders_in_scope: number;
    aggregate_value_usd: number;
    holders: Sec13fHolderApi[];
  };
  meta: {
    creditsUsed: number;
    remainingCredits: number;
    scope: Sec13fScopeApi;
    scope_notice: string;
  };
}

export interface Sec13fByManagerResponse {
  data: Sec13fByManagerApiResponse["data"];
  meta: Sec13fByManagerApiResponse["meta"];
}

export interface Sec13fByTickerResponse {
  data: Sec13fByTickerApiResponse["data"];
  meta: Sec13fByTickerApiResponse["meta"];
}

export class LlmquantWebApiClient {
  constructor(private readonly env: LlmquantEnv) {}

  async searchWiki({
    query,
    topK,
  }: {
    query: string;
    topK: number;
  }): Promise<WikiSearchResponse> {
    const response = await this.request<SearchWikiApiResponse>("/api/wiki/search", {
      method: "POST",
      body: JSON.stringify({ query, topK }),
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
    };
  }

  async searchPaper({
    query,
    topK,
  }: {
    query: string;
    topK: number;
  }): Promise<PaperSearchResponse> {
    const response = await this.request<SearchPaperApiResponse>("/api/paper/search", {
      method: "POST",
      body: JSON.stringify({ query, topK }),
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
    };
  }

  async getCryptoHistorical(params: {
    ticker: string;
    interval: string;
    startTime?: string;
    endTime?: string;
    limit?: number;
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

  async getCryptoSnapshot(params: {
    ticker: string;
  }): Promise<CryptoSnapshotResponse> {
    const url = new URL("/api/crypto/snapshot", this.env.baseUrl);
    url.searchParams.set("ticker", params.ticker);

    const response = await this.request<CryptoSnapshotApiResponse>(url, {
      method: "GET",
    });

    return {
      data: {
        price: response.data.price,
        ticker: response.data.ticker,
        dayChange: response.data.day_change,
        dayChangePercent: response.data.day_change_percent,
        volume24h: response.data.volume_24h,
        time: response.data.time,
      },
      meta: response.meta,
    };
  }

  async getMacroIndicators(params: {
    q?: string;
    category?: string;
    frequency?: string;
    limit?: number;
  }): Promise<MacroIndicatorsResponse> {
    const url = new URL("/api/macro/indicators", this.env.baseUrl);
    if (params.q) url.searchParams.set("q", params.q);
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
      meta: { count: response.meta.count, creditsUsed: response.meta.creditsUsed },
    };
  }

  async getMacroHistorical(params: {
    indicator?: string;
    seriesId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<MacroHistoricalResponse> {
    const url = new URL("/api/macro/historical", this.env.baseUrl);
    if (params.indicator) url.searchParams.set("indicator", params.indicator);
    if (params.seriesId) url.searchParams.set("series_id", params.seriesId);
    if (params.startDate) url.searchParams.set("start_date", params.startDate);
    if (params.endDate) url.searchParams.set("end_date", params.endDate);
    if (params.limit != null) url.searchParams.set("limit", String(params.limit));

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
      },
      meta: { count: response.meta.count, creditsUsed: response.meta.creditsUsed },
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
      meta: { creditsUsed: response.meta.creditsUsed },
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
        secFilingId: item.sec_filing_id,
        ticker: item.ticker,
        companyName: item.company_name,
        filingType: item.filing_type,
        accessionNumber: item.accession_number,
        filingDate: item.filing_date,
        reportDate: item.report_date,
        url: item.url,
      })),
      meta: {
        count: response.meta.count,
        creditsUsed: response.meta.creditsUsed,
      },
    };
  }

  async getSecFilingRead(params: {
    ticker: string;
    filingType: string;
    year?: number;
    quarter?: number;
    item?: string;
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
    if (params.item) {
      url.searchParams.set("item", params.item);
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
      meta: {
        count: response.meta.count,
        creditsUsed: response.meta.creditsUsed,
      },
    };
  }

  async getSec13fByManager(params: {
    managerCik?: string;
    managerName?: string;
    period?: string;
    limit?: number;
  }): Promise<Sec13fByManagerResponse> {
    const url = new URL("/api/filings/13f/by-manager", this.env.baseUrl);
    if (params.managerCik) {
      url.searchParams.set("manager_cik", params.managerCik);
    }
    if (params.managerName) {
      url.searchParams.set("manager_name", params.managerName);
    }
    if (params.period) {
      url.searchParams.set("period", params.period);
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
    period?: string;
    limit?: number;
  }): Promise<Sec13fByTickerResponse> {
    const url = new URL("/api/filings/13f/by-ticker", this.env.baseUrl);
    url.searchParams.set("ticker", params.ticker);
    if (params.period) {
      url.searchParams.set("period", params.period);
    }
    if (params.limit != null) {
      url.searchParams.set("limit", String(params.limit));
    }

    const response = await this.request<Sec13fByTickerApiResponse>(url, {
      method: "GET",
    });

    return { data: response.data, meta: response.meta };
  }

  private async request<T>(pathOrUrl: string | URL, init: RequestInit) {
    const url =
      typeof pathOrUrl === "string"
        ? new URL(pathOrUrl, this.env.baseUrl)
        : pathOrUrl;

    const headers = new Headers(init.headers);
    headers.set("accept", "application/json");
    headers.set("authorization", `Bearer ${this.env.apiKey}`);

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
    } catch (error) {
      if (error instanceof Error) {
        throw new LlmquantTransportError(
          `Failed to reach LLMQuant API: ${error.message}`,
          url.toString(),
        );
      }

      throw new LlmquantTransportError(
        "Failed to reach LLMQuant API.",
        url.toString(),
      );
    }

    if (!response.ok) {
      throw await toLlmquantApiError(response);
    }

    try {
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof Error) {
        throw new LlmquantTransportError(
          `Failed to decode JSON response: ${error.message}`,
          url.toString(),
        );
      }

      throw new LlmquantTransportError(
        "Failed to decode JSON response.",
        url.toString(),
      );
    }
  }
}
