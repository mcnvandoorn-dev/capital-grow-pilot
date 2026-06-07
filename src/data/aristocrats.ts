export type AristocratSector =
  | "Consumer Staples"
  | "Industrials"
  | "Materials"
  | "Financials"
  | "Health Care"
  | "Energy"
  | "Consumer Discretionary"
  | "Real Estate"
  | "Utilities"
  | "Information Technology";

export interface Aristocrat {
  ticker: string;
  name: string;
  sector: AristocratSector;
  yield: number;
  consecutiveYears: number;
  dividendCAGR5yr: number;
  payoutRatio: number;
  marketCapB: number;
}

export const aristocrats: Aristocrat[] = [
  { ticker: "JNJ",  name: "Johnson & Johnson",            sector: "Health Care",            yield: 3.1, consecutiveYears: 62, dividendCAGR5yr: 5.6,  payoutRatio: 49, marketCapB: 380 },
  { ticker: "PG",   name: "Procter & Gamble",             sector: "Consumer Staples",       yield: 2.4, consecutiveYears: 68, dividendCAGR5yr: 6.0,  payoutRatio: 62, marketCapB: 390 },
  { ticker: "KO",   name: "Coca-Cola",                    sector: "Consumer Staples",       yield: 3.0, consecutiveYears: 62, dividendCAGR5yr: 3.6,  payoutRatio: 68, marketCapB: 270 },
  { ticker: "MMM",  name: "3M",                           sector: "Industrials",            yield: 2.6, consecutiveYears: 65, dividendCAGR5yr: 3.2,  payoutRatio: 55, marketCapB: 70  },
  { ticker: "ABT",  name: "Abbott Laboratories",          sector: "Health Care",            yield: 1.9, consecutiveYears: 52, dividendCAGR5yr: 11.4, payoutRatio: 47, marketCapB: 200 },
  { ticker: "AFL",  name: "Aflac",                        sector: "Financials",             yield: 2.0, consecutiveYears: 42, dividendCAGR5yr: 11.0, payoutRatio: 25, marketCapB: 60  },
  { ticker: "ADP",  name: "Automatic Data Processing",    sector: "Industrials",            yield: 2.1, consecutiveYears: 49, dividendCAGR5yr: 12.4, payoutRatio: 60, marketCapB: 110 },
  { ticker: "APD",  name: "Air Products & Chemicals",     sector: "Materials",              yield: 2.7, consecutiveYears: 42, dividendCAGR5yr: 9.2,  payoutRatio: 64, marketCapB: 65  },
  { ticker: "BDX",  name: "Becton Dickinson",             sector: "Health Care",            yield: 1.7, consecutiveYears: 52, dividendCAGR5yr: 4.7,  payoutRatio: 28, marketCapB: 70  },
  { ticker: "CAT",  name: "Caterpillar",                  sector: "Industrials",            yield: 1.5, consecutiveYears: 31, dividendCAGR5yr: 8.0,  payoutRatio: 25, marketCapB: 180 },
  { ticker: "CINF", name: "Cincinnati Financial",         sector: "Financials",             yield: 2.3, consecutiveYears: 64, dividendCAGR5yr: 5.1,  payoutRatio: 38, marketCapB: 21  },
  { ticker: "CL",   name: "Colgate-Palmolive",            sector: "Consumer Staples",       yield: 2.2, consecutiveYears: 61, dividendCAGR5yr: 3.4,  payoutRatio: 58, marketCapB: 80  },
  { ticker: "CLX",  name: "Clorox",                       sector: "Consumer Staples",       yield: 3.4, consecutiveYears: 47, dividendCAGR5yr: 5.4,  payoutRatio: 80, marketCapB: 18  },
  { ticker: "ED",   name: "Consolidated Edison",          sector: "Utilities",              yield: 3.3, consecutiveYears: 50, dividendCAGR5yr: 2.8,  payoutRatio: 65, marketCapB: 33  },
  { ticker: "EMR",  name: "Emerson Electric",             sector: "Industrials",            yield: 1.9, consecutiveYears: 67, dividendCAGR5yr: 1.2,  payoutRatio: 38, marketCapB: 60  },
  { ticker: "ESS",  name: "Essex Property Trust",         sector: "Real Estate",            yield: 3.6, consecutiveYears: 30, dividendCAGR5yr: 4.6,  payoutRatio: 65, marketCapB: 18  },
  { ticker: "GPC",  name: "Genuine Parts",                sector: "Consumer Discretionary", yield: 2.9, consecutiveYears: 68, dividendCAGR5yr: 5.8,  payoutRatio: 50, marketCapB: 19  },
  { ticker: "GWW",  name: "W.W. Grainger",                sector: "Industrials",            yield: 0.8, consecutiveYears: 53, dividendCAGR5yr: 6.4,  payoutRatio: 22, marketCapB: 50  },
  { ticker: "HRL",  name: "Hormel Foods",                 sector: "Consumer Staples",       yield: 3.7, consecutiveYears: 58, dividendCAGR5yr: 8.2,  payoutRatio: 75, marketCapB: 17  },
  { ticker: "IBM",  name: "International Business Machines", sector: "Information Technology", yield: 3.2, consecutiveYears: 29, dividendCAGR5yr: 1.1, payoutRatio: 65, marketCapB: 180 },
  { ticker: "CVX",  name: "Chevron",                      sector: "Energy",                 yield: 4.2, consecutiveYears: 37, dividendCAGR5yr: 6.1,  payoutRatio: 60, marketCapB: 280 },
  { ticker: "XOM",  name: "Exxon Mobil",                  sector: "Energy",                 yield: 3.4, consecutiveYears: 41, dividendCAGR5yr: 2.4,  payoutRatio: 45, marketCapB: 460 },
  { ticker: "PEP",  name: "PepsiCo",                      sector: "Consumer Staples",       yield: 3.1, consecutiveYears: 52, dividendCAGR5yr: 7.1,  payoutRatio: 70, marketCapB: 230 },
  { ticker: "MCD",  name: "McDonald's",                   sector: "Consumer Discretionary", yield: 2.4, consecutiveYears: 48, dividendCAGR5yr: 7.9,  payoutRatio: 58, marketCapB: 210 },
  { ticker: "LOW",  name: "Lowe's Companies",             sector: "Consumer Discretionary", yield: 1.8, consecutiveYears: 61, dividendCAGR5yr: 18.8, payoutRatio: 36, marketCapB: 140 },
];
