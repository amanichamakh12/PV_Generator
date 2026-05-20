// Client Staging Types
export interface ClientInfo {
  clientId: string;
  name: string;
  segment: 'PME' | 'Corporate' | 'Retail';
  industry: string;
  riskRating: 'Low' | 'Medium' | 'High' | 'Very High';
}

export interface FinancialIndicators {
  revenue: number;
  netIncome: number;
  totalAssets: number;
  totalLiabilities: number;
  workingCapital: number;
  debtToEquity: number;
  currentRatio: number;
  profitMargin: number;
  roe: number; // Return on Equity
  roa: number; // Return on Assets
}

export interface PDFactors {
  macroeconomicScore: number; // 0-100
  industryRiskScore: number; // 0-100
  companyFinancialScore: number; // 0-100
  paymentHistoryScore: number; // 0-100
  managementQualityScore: number; // 0-100
}

export interface ProbabilityOfDefault {
  pdPercentage: number; // 0-100
  pdRating: string; // AAA, AA, A, BBB, BB, B, CCC, CC, C
  confidenceLevel: number; // 0-100
  calculatedAt: Date;
}

export interface ExposureAtDefault {
  outstandingBalance: number;
  creditLimit: number;
  uncommittedFacilities: number;
  totalExposure: number;
}

export interface LossGivenDefault {
  collateralValue: number;
  collateralType: string;
  recoveryRate: number; // 0-100
  lgdPercentage: number; // 0-100
}

export interface ExpectedCreditLoss {
  pd: number; // Probability of Default (0-1)
  ead: number; // Exposure at Default
  lgd: number; // Loss Given Default (0-1)
  eclAmount: number; // ECL = PD × EAD × LGD
  eclPercentage: number; // ECL as % of exposure
  riskCategory: 'Stage 1' | 'Stage 2' | 'Stage 3';
  calculatedAt: Date;
}

export interface ClientStagingAnalysis {
  analysisId: string;
  clientId: string;
  clientInfo: ClientInfo;
  financialIndicators: FinancialIndicators;
  pdFactors: PDFactors;
  pd: ProbabilityOfDefault;
  ead: ExposureAtDefault;
  lgd: LossGivenDefault;
  ecl: ExpectedCreditLoss;
  analysisDate: Date;
  updatedAt: Date;
  createdBy: string;
  notes: string;
}

export interface StagingScenario {
  scenarioId: string;
  scenarioName: string;
  description: string;
  pdAdjustment: number; // % adjustment
  eadAdjustment: number; // % adjustment
  lgdAdjustment: number; // % adjustment
  projectedEcl: ExpectedCreditLoss;
}
